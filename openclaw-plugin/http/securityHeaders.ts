/**
 * Security headers and CORS configuration for the HTTP service.
 *
 * Provides a middleware-like function that sets security headers on every
 * response, plus CORS helpers that restrict origins to a configurable
 * allow-list (defaults to localhost only).
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

// ── CORS ──────────────────────────────────────────────────────────

/** Parsed CORS configuration. */
export interface CorsConfig {
  /** Allowed origins. An empty array means same-origin only (no CORS header). */
  allowedOrigins: string[]
}

/**
 * Build a CorsConfig from an environment variable value.
 *
 * Accepts a comma-separated list of origins, e.g.
 *   "http://localhost:5173,http://localhost:7891"
 *
 * The special value "*" is intentionally NOT supported — callers who want
 * wide-open CORS must list each origin explicitly.
 *
 * When `envValue` is undefined or empty the default is localhost on common
 * dev ports.
 */
export function parseCorsOrigins(envValue: string | undefined): CorsConfig {
  if (!envValue || envValue.trim() === '') {
    return { allowedOrigins: [] }
  }

  const origins = envValue
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  return { allowedOrigins: origins }
}

/**
 * Set CORS response headers if the request's Origin is in the allow-list.
 *
 * Returns `true` if the origin was allowed (headers were set), `false`
 * otherwise.
 */
export function setCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  config: CorsConfig,
): boolean {
  const origin = req.headers.origin

  // No Origin header → same-origin request, no CORS headers needed.
  if (!origin) return true

  const allowed = config.allowedOrigins.includes(origin)
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Vary', 'Origin')
  }

  return allowed
}

// ── Security headers ──────────────────────────────────────────────

/**
 * Returns `true` when the hostname looks like localhost / loopback.
 */
function isLocalhost(host: string | undefined): boolean {
  if (!host) return true // no Host header → assume local
  const hostname = host.split(':')[0]
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  )
}

/**
 * Content-Security-Policy for a React/Vite SPA.
 *
 * - `'self'` for scripts, styles, images, fonts, connect
 * - `'unsafe-inline'` for styles only (many UI libraries inject inline styles)
 * - `data:` for images (common for small icons / SVG data URIs)
 * - `blob:` for workers that Vite may spawn
 * - No `'unsafe-eval'` — React does not need it in production
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

/**
 * Apply standard security headers to the response.
 *
 * Call this early in request handling, before `writeHead` — it only calls
 * `res.setHeader()` so it composes well with later `writeHead()` calls.
 */
export function setSecurityHeaders(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '0')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Content-Security-Policy', CSP)

  // HSTS only makes sense when not running on localhost (i.e. behind TLS)
  if (!isLocalhost(req.headers.host)) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  }
}
