/**
 * HTTP background service — serves the dashboard API and SSE event stream.
 *
 * Runs on port 7890 using node:http. CORS is restricted to configured origins
 * (defaults to localhost). Security headers are applied to all responses.
 *
 * All API routes are served under /api/v1/. Legacy unversioned /api/ routes
 * are still supported but emit deprecation headers (Deprecation + Sunset).
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import type { TaxService } from '../service/TaxService.ts'
import { analyzeGaps } from '../service/GapAnalysis.ts'
import { serializeComputeResult } from './serialize.ts'
import { taxReturnStrictSchema } from '../../src/model/schemas.ts'
import { logger } from '../utils/logger.ts'
import { setSecurityHeaders, setCorsHeaders, parseCorsOrigins, type CorsConfig } from './securityHeaders.ts'

const log = logger.child({ component: 'http' })

const DEFAULT_PORT = 7890

/** Maximum allowed request body size in bytes (5 MB). */
export const MAX_BODY_SIZE = 5 * 1024 * 1024

/** Maximum time (ms) to wait for the full request body before aborting. */
export const BODY_TIMEOUT_MS = 30_000

/** Current API version identifier. */
export const API_VERSION = 'v1'

/** Sunset date for legacy unversioned routes (6 months from 2026-02-25). */
export const LEGACY_SUNSET_DATE = '2026-08-25'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
}

export interface HttpServiceOptions {
  port?: number
  staticDir?: string
  /** Comma-separated allowed CORS origins, or a pre-parsed CorsConfig. */
  corsOrigin?: string | CorsConfig
}

/**
 * Resolve an incoming request path to an API route name and whether it is
 * a legacy (unversioned) request.
 *
 * Returns `null` if the path is not an API route.
 *
 * Examples:
 *   /api/v1/status   -> { route: 'status', legacy: false }
 *   /api/status      -> { route: 'status', legacy: true }
 *   /other           -> null
 */
export function resolveApiRoute(path: string): { route: string; legacy: boolean } | null {
  if (path.startsWith('/api/v1/')) {
    return { route: path.slice('/api/v1/'.length), legacy: false }
  }
  if (path.startsWith('/api/')) {
    return { route: path.slice('/api/'.length), legacy: true }
  }
  return null
}

export function createHttpService(service: TaxService, options: HttpServiceOptions = {}) {
  const port = options.port ?? DEFAULT_PORT
  const staticDir = options.staticDir

  // Parse CORS config — accept a string (from env var) or a pre-built config
  const corsConfig: CorsConfig =
    typeof options.corsOrigin === 'string'
      ? parseCorsOrigins(options.corsOrigin)
      : options.corsOrigin ?? parseCorsOrigins(process.env.OPENTAX_CORS_ORIGIN)

  const sseClients = new Set<ServerResponse>()

  // Push SSE events on state changes
  service.on('stateChanged', ({ stateVersion }) => {
    const gap = analyzeGaps(service.taxReturn, service.computeResult)
    const data = JSON.stringify({
      type: 'stateChanged',
      stateVersion,
      completionPercent: gap.completionPercent,
      timestamp: new Date().toISOString(),
    })
    for (const res of sseClients) {
      res.write(`data: ${data}\n\n`)
    }
  })

  /** Set the X-API-Version header and, for legacy routes, deprecation headers. */
  function setApiHeaders(res: ServerResponse, legacy: boolean) {
    res.setHeader('X-API-Version', API_VERSION)
    if (legacy) {
      res.setHeader('Deprecation', 'true')
      res.setHeader('Sunset', LEGACY_SUNSET_DATE)
    }
  }

  function sendJson(res: ServerResponse, data: unknown, status = 200, legacy = false) {
    setApiHeaders(res, legacy)
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  async function serveStatic(urlPath: string, res: ServerResponse): Promise<boolean> {
    if (!staticDir) return false

    // Prevent directory traversal
    const safePath = urlPath.replace(/\.\./g, '').replace(/\/\//g, '/')
    const filePath = join(staticDir, safePath === '/' ? 'index.html' : safePath)

    // Ensure resolved path stays within staticDir
    if (!filePath.startsWith(staticDir)) return false

    try {
      const fileStat = await stat(filePath)
      if (!fileStat.isFile()) return false
      const content = await readFile(filePath)
      const ext = extname(filePath)
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content)
      return true
    } catch {
      return false
    }
  }

  async function serveSpaFallback(res: ServerResponse): Promise<boolean> {
    if (!staticDir) return false
    try {
      const content = await readFile(join(staticDir, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(content)
      return true
    } catch {
      return false
    }
  }

  function handleRequest(req: IncomingMessage, res: ServerResponse) {
    const startTime = Date.now()
    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    const path = url.pathname

    // Apply security headers to every response
    setSecurityHeaders(req, res)

    // Log response when finished
    res.on('finish', () => {
      // Skip SSE connections — they stay open for a long time
      if (path.endsWith('/events')) return
      const duration = Date.now() - startTime
      log.info('request', {
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: duration,
      })
    })

    // CORS preflight
    if (req.method === 'OPTIONS') {
      setCorsHeaders(req, res, corsConfig)
      res.writeHead(204)
      res.end()
      return
    }

    // Set CORS headers for all non-preflight requests
    setCorsHeaders(req, res, corsConfig)

    // ── API routing ──────────────────────────────────────────────
    // Both /api/v1/<route> and /api/<route> (legacy) resolve to the
    // same handler. Legacy routes receive deprecation headers.
    const apiRoute = resolveApiRoute(path)

    if (apiRoute) {
      const { route, legacy } = apiRoute

      // GET status
      if (req.method === 'GET' && route === 'status') {
        const gap = analyzeGaps(service.taxReturn, service.computeResult)
        sendJson(res, {
          taxReturn: service.taxReturn,
          computeResult: serializeComputeResult(service.computeResult),
          stateVersion: service.stateVersion,
          gapAnalysis: gap,
        }, 200, legacy)
        return
      }

      // GET gap-analysis
      if (req.method === 'GET' && route === 'gap-analysis') {
        const gap = analyzeGaps(service.taxReturn, service.computeResult)
        sendJson(res, gap, 200, legacy)
        return
      }

      // GET events (SSE)
      if (req.method === 'GET' && route === 'events') {
        setApiHeaders(res, legacy)
        // Flush headers immediately; disable chunked encoding for SSE
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Transfer-Encoding': 'identity',
        })
        res.flushHeaders()
        res.write(`data: ${JSON.stringify({ type: 'connected', stateVersion: service.stateVersion })}\n\n`)
        sseClients.add(res)
        log.debug('SSE client connected', { clients: sseClients.size })
        req.on('close', () => {
          sseClients.delete(res)
          log.debug('SSE client disconnected', { clients: sseClients.size })
        })
        return
      }

      // POST sync
      if (req.method === 'POST' && route === 'sync') {
        // Reject early if Content-Length exceeds the limit
        const contentLength = req.headers['content-length']
        if (contentLength != null && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
          sendJson(res, { error: 'payload_too_large' }, 413, legacy)
          req.resume() // drain the request so the socket can be freed
          return
        }

        let body = ''
        let bodySize = 0
        let aborted = false

        // Timeout: abort if body isn't received within the limit
        const timer = setTimeout(() => {
          if (!aborted) {
            aborted = true
            sendJson(res, { error: 'request_timeout' }, 408, legacy)
            req.destroy()
          }
        }, BODY_TIMEOUT_MS)

        req.on('data', (chunk: Buffer) => {
          if (aborted) return
          bodySize += chunk.length
          if (bodySize > MAX_BODY_SIZE) {
            aborted = true
            clearTimeout(timer)
            sendJson(res, { error: 'payload_too_large' }, 413, legacy)
            req.destroy()
            return
          }
          body += chunk
        })

        req.on('end', () => {
          clearTimeout(timer)
          if (aborted) return
          try {
            const parsed = JSON.parse(body)
            const { taxReturn, stateVersion } = parsed
            if (stateVersion != null && stateVersion < service.stateVersion) {
              log.warn('Sync version conflict', {
                serverVersion: service.stateVersion,
                clientVersion: stateVersion,
              })
              sendJson(res, {
                error: 'version_conflict',
                serverVersion: service.stateVersion,
                clientVersion: stateVersion,
              }, 409, legacy)
              return
            }

            // Validate taxReturn against Zod schema
            const result = taxReturnStrictSchema.safeParse(taxReturn)
            if (!result.success) {
              const issues = result.error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
              }))
              sendJson(res, { error: 'validation_error', issues }, 400, legacy)
              return
            }

            service.importReturn(result.data)
            sendJson(res, { ok: true, stateVersion: service.stateVersion }, 200, legacy)
          } catch (err) {
            log.warn('Invalid JSON in sync request', {
              error: err instanceof Error ? err.message : String(err),
            })
            sendJson(res, { error: 'invalid_json' }, 400, legacy)
          }
        })

        req.on('error', () => {
          clearTimeout(timer)
        })

        return
      }

      // GET return.json
      if (req.method === 'GET' && route === 'return.json') {
        sendJson(res, service.taxReturn, 200, legacy)
        return
      }

      // Unknown API route — 404 with version headers
      sendJson(res, { error: 'not_found' }, 404, legacy)
      return
    }

    // ── Static file serving (non-API GET requests) ───────────────
    if (req.method === 'GET' && staticDir) {
      serveStatic(path, res).then((served) => {
        if (!served) {
          // SPA fallback: serve index.html for HTML-accepting requests
          const accept = req.headers.accept ?? ''
          if (accept.includes('text/html')) {
            serveSpaFallback(res).then((ok) => {
              if (!ok) sendJson(res, { error: 'not_found' }, 404)
            })
          } else {
            sendJson(res, { error: 'not_found' }, 404)
          }
        }
      })
      return
    }

    // 404
    sendJson(res, { error: 'not_found' }, 404)
  }

  const server = createServer(handleRequest)

  const svc = {
    start() {
      return new Promise<void>((resolve) => {
        server.listen(port, () => resolve())
      })
    },
    stop() {
      return new Promise<void>((resolve, reject) => {
        for (const client of sseClients) {
          client.end()
        }
        sseClients.clear()
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
    server,
    /** The port the server is listening on (resolves OS-assigned port when 0). */
    get port(): number {
      const addr = server.address()
      if (addr && typeof addr === 'object') return addr.port
      return port
    },
  }

  return svc
}
