import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TaxService } from '../../openclaw-plugin/service/TaxService.ts'
import { createHttpService } from '../../openclaw-plugin/http/httpService.ts'
import type { CorsConfig } from '../../openclaw-plugin/http/securityHeaders.ts'
import { parseCorsOrigins, setSecurityHeaders, setCorsHeaders } from '../../openclaw-plugin/http/securityHeaders.ts'

// ── Helpers ──────────────────────────────────────────────────────

let workspace: string
let httpService: ReturnType<typeof createHttpService>

function get(
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: httpService.port,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () =>
          resolve({ status: res.statusCode!, headers: res.headers, body: data }),
        )
      },
    )
    req.on('error', reject)
    req.end()
  })
}

function options(
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: httpService.port,
        path,
        method: 'OPTIONS',
        headers,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () =>
          resolve({ status: res.statusCode!, headers: res.headers, body: data }),
        )
      },
    )
    req.on('error', reject)
    req.end()
  })
}

// ── Unit tests for parseCorsOrigins ──────────────────────────────

describe('parseCorsOrigins', () => {
  it('returns empty allowedOrigins for undefined input', () => {
    const config = parseCorsOrigins(undefined)
    expect(config.allowedOrigins).toEqual([])
  })

  it('returns empty allowedOrigins for empty string', () => {
    const config = parseCorsOrigins('')
    expect(config.allowedOrigins).toEqual([])
  })

  it('returns empty allowedOrigins for whitespace-only string', () => {
    const config = parseCorsOrigins('   ')
    expect(config.allowedOrigins).toEqual([])
  })

  it('parses a single origin', () => {
    const config = parseCorsOrigins('http://localhost:5173')
    expect(config.allowedOrigins).toEqual(['http://localhost:5173'])
  })

  it('parses multiple comma-separated origins', () => {
    const config = parseCorsOrigins('http://localhost:5173, http://localhost:7891')
    expect(config.allowedOrigins).toEqual([
      'http://localhost:5173',
      'http://localhost:7891',
    ])
  })

  it('trims whitespace around origins', () => {
    const config = parseCorsOrigins('  http://a.com , http://b.com  ')
    expect(config.allowedOrigins).toEqual(['http://a.com', 'http://b.com'])
  })
})

// ── Integration tests: security headers on responses ─────────────

describe('security headers on API responses', () => {
  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), 'opentax-sec-test-'))
    const svc = new TaxService(workspace)
    httpService = createHttpService(svc, {
      port: 0,
      corsOrigin: { allowedOrigins: ['http://localhost:5173'] },
    })
    await httpService.start()
  })

  afterEach(async () => {
    await httpService.stop()
    rmSync(workspace, { recursive: true, force: true })
  })

  it('includes X-Content-Type-Options: nosniff', async () => {
    const res = await get('/api/status')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('includes X-Frame-Options: DENY', async () => {
    const res = await get('/api/status')
    expect(res.headers['x-frame-options']).toBe('DENY')
  })

  it('includes X-XSS-Protection: 0', async () => {
    const res = await get('/api/status')
    expect(res.headers['x-xss-protection']).toBe('0')
  })

  it('includes Referrer-Policy', async () => {
    const res = await get('/api/status')
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  it('includes Content-Security-Policy', async () => {
    const res = await get('/api/status')
    const csp = res.headers['content-security-policy']
    expect(csp).toBeDefined()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('does NOT include Strict-Transport-Security on localhost', async () => {
    const res = await get('/api/status')
    expect(res.headers['strict-transport-security']).toBeUndefined()
  })

  it('includes security headers on 404 responses', async () => {
    const res = await get('/api/nonexistent')
    expect(res.status).toBe(404)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
  })
})

// ── Integration tests: CORS ──────────────────────────────────────

describe('CORS with allowed origins', () => {
  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), 'opentax-cors-test-'))
    const svc = new TaxService(workspace)
    httpService = createHttpService(svc, {
      port: 0,
      corsOrigin: { allowedOrigins: ['http://localhost:5173', 'http://localhost:7891'] },
    })
    await httpService.start()
  })

  afterEach(async () => {
    await httpService.stop()
    rmSync(workspace, { recursive: true, force: true })
  })

  it('sets Access-Control-Allow-Origin for an allowed origin', async () => {
    const res = await get('/api/status', { Origin: 'http://localhost:5173' })
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('does NOT set Access-Control-Allow-Origin for a disallowed origin', async () => {
    const res = await get('/api/status', { Origin: 'http://evil.com' })
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('does NOT set Access-Control-Allow-Origin when no Origin header is sent', async () => {
    const res = await get('/api/status')
    // Same-origin requests don't send Origin, so no CORS header needed
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('includes Vary: Origin when origin is allowed', async () => {
    const res = await get('/api/status', { Origin: 'http://localhost:5173' })
    // Node lowercases header names; Vary may be combined with other values
    const vary = res.headers['vary'] ?? ''
    expect(vary).toContain('Origin')
  })

  it('handles preflight OPTIONS with allowed origin', async () => {
    const res = await options('/api/sync', {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
    })
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(res.headers['access-control-allow-methods']).toContain('POST')
    expect(res.headers['access-control-allow-headers']).toContain('Content-Type')
  })

  it('handles preflight OPTIONS with disallowed origin', async () => {
    const res = await options('/api/sync', {
      Origin: 'http://evil.com',
      'Access-Control-Request-Method': 'POST',
    })
    expect(res.status).toBe(204)
    // Headers should NOT include the disallowed origin
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('still includes security headers on preflight responses', async () => {
    const res = await options('/api/sync', {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
    })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
  })
})

describe('CORS with no configured origins (restrictive default)', () => {
  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), 'opentax-cors-default-'))
    const svc = new TaxService(workspace)
    // No corsOrigin option — defaults to restrictive (empty allowed list)
    httpService = createHttpService(svc, { port: 0 })
    await httpService.start()
  })

  afterEach(async () => {
    await httpService.stop()
    rmSync(workspace, { recursive: true, force: true })
  })

  it('does NOT set Access-Control-Allow-Origin for any cross-origin request', async () => {
    const res = await get('/api/status', { Origin: 'http://localhost:5173' })
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('still responds to same-origin requests without CORS headers', async () => {
    const res = await get('/api/status')
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})
