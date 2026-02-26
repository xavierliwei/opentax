import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TaxService } from '../../openclaw-plugin/service/TaxService.ts'
import {
  createHttpService,
  API_VERSION,
  LEGACY_SUNSET_DATE,
  resolveApiRoute,
} from '../../openclaw-plugin/http/httpService.ts'

// ── resolveApiRoute unit tests (no server needed) ────────────────

describe('resolveApiRoute', () => {
  it('resolves /api/v1/status as versioned', () => {
    expect(resolveApiRoute('/api/v1/status')).toEqual({ route: 'status', legacy: false })
  })

  it('resolves /api/status as legacy', () => {
    expect(resolveApiRoute('/api/status')).toEqual({ route: 'status', legacy: true })
  })

  it('resolves /api/v1/gap-analysis as versioned', () => {
    expect(resolveApiRoute('/api/v1/gap-analysis')).toEqual({ route: 'gap-analysis', legacy: false })
  })

  it('resolves /api/gap-analysis as legacy', () => {
    expect(resolveApiRoute('/api/gap-analysis')).toEqual({ route: 'gap-analysis', legacy: true })
  })

  it('resolves /api/v1/return.json as versioned', () => {
    expect(resolveApiRoute('/api/v1/return.json')).toEqual({ route: 'return.json', legacy: false })
  })

  it('returns null for non-API paths', () => {
    expect(resolveApiRoute('/')).toBeNull()
    expect(resolveApiRoute('/foo')).toBeNull()
    expect(resolveApiRoute('/other/path')).toBeNull()
  })
})

// ── HTTP integration tests (require a running server) ────────────

describe('HTTP API versioning', () => {
  let workspace: string
  let service: TaxService
  let httpService: ReturnType<typeof createHttpService>
  let baseUrl: string

  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), 'opentax-http-test-'))
    service = new TaxService(workspace)
    httpService = createHttpService(service, { port: 0 })
    await httpService.start()
    const addr = httpService.server.address()
    const port = typeof addr === 'object' && addr ? addr.port : httpService.port
    baseUrl = `http://localhost:${port}`
  })

  afterEach(async () => {
    await httpService.stop()
    rmSync(workspace, { recursive: true, force: true })
  })

  // ── Versioned routes (/api/v1/*) ───────────────────────────────

  describe('versioned routes (/api/v1/*)', () => {
    it('GET /api/v1/status returns 200 with X-API-Version header', async () => {
      const res = await fetch(`${baseUrl}/api/v1/status`)
      expect(res.status).toBe(200)
      expect(res.headers.get('x-api-version')).toBe(API_VERSION)
      const body = await res.json()
      expect(body).toHaveProperty('taxReturn')
      expect(body).toHaveProperty('stateVersion')
    })

    it('GET /api/v1/gap-analysis returns 200 with X-API-Version header', async () => {
      const res = await fetch(`${baseUrl}/api/v1/gap-analysis`)
      expect(res.status).toBe(200)
      expect(res.headers.get('x-api-version')).toBe(API_VERSION)
      const body = await res.json()
      expect(body).toHaveProperty('completionPercent')
    })

    it('GET /api/v1/return.json returns 200 with X-API-Version header', async () => {
      const res = await fetch(`${baseUrl}/api/v1/return.json`)
      expect(res.status).toBe(200)
      expect(res.headers.get('x-api-version')).toBe(API_VERSION)
      const body = await res.json()
      expect(body).toHaveProperty('taxYear')
    })

    it('POST /api/v1/sync returns 200 with X-API-Version header', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxReturn: service.taxReturn,
          stateVersion: service.stateVersion,
        }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('x-api-version')).toBe(API_VERSION)
      const body = await res.json()
      expect(body).toHaveProperty('ok', true)
    })

    it('GET /api/v1/events returns SSE stream with X-API-Version header', async () => {
      const controller = new AbortController()
      const res = await fetch(`${baseUrl}/api/v1/events`, { signal: controller.signal })
      expect(res.status).toBe(200)
      expect(res.headers.get('x-api-version')).toBe(API_VERSION)
      expect(res.headers.get('content-type')).toBe('text/event-stream')
      controller.abort()
    })

    it('versioned routes do NOT have deprecation headers', async () => {
      const res = await fetch(`${baseUrl}/api/v1/status`)
      expect(res.headers.get('deprecation')).toBeNull()
      expect(res.headers.get('sunset')).toBeNull()
    })
  })

  // ── Legacy routes (/api/*) ─────────────────────────────────────

  describe('legacy routes (/api/*)', () => {
    it('GET /api/status still works with deprecation headers', async () => {
      const res = await fetch(`${baseUrl}/api/status`)
      expect(res.status).toBe(200)
      expect(res.headers.get('x-api-version')).toBe(API_VERSION)
      expect(res.headers.get('deprecation')).toBe('true')
      expect(res.headers.get('sunset')).toBe(LEGACY_SUNSET_DATE)
      const body = await res.json()
      expect(body).toHaveProperty('taxReturn')
    })

    it('GET /api/gap-analysis still works with deprecation headers', async () => {
      const res = await fetch(`${baseUrl}/api/gap-analysis`)
      expect(res.status).toBe(200)
      expect(res.headers.get('deprecation')).toBe('true')
      expect(res.headers.get('sunset')).toBe(LEGACY_SUNSET_DATE)
    })

    it('GET /api/return.json still works with deprecation headers', async () => {
      const res = await fetch(`${baseUrl}/api/return.json`)
      expect(res.status).toBe(200)
      expect(res.headers.get('deprecation')).toBe('true')
      expect(res.headers.get('sunset')).toBe(LEGACY_SUNSET_DATE)
    })

    it('POST /api/sync still works with deprecation headers', async () => {
      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxReturn: service.taxReturn,
          stateVersion: service.stateVersion,
        }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('deprecation')).toBe('true')
      expect(res.headers.get('sunset')).toBe(LEGACY_SUNSET_DATE)
    })

    it('GET /api/events still works with deprecation headers', async () => {
      const controller = new AbortController()
      const res = await fetch(`${baseUrl}/api/events`, { signal: controller.signal })
      expect(res.status).toBe(200)
      expect(res.headers.get('deprecation')).toBe('true')
      expect(res.headers.get('sunset')).toBe(LEGACY_SUNSET_DATE)
      controller.abort()
    })
  })

  // ── Response consistency ───────────────────────────────────────

  describe('response consistency', () => {
    it('versioned and legacy status endpoints return the same data', async () => {
      const [v1Res, legacyRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/status`).then(r => r.json()),
        fetch(`${baseUrl}/api/status`).then(r => r.json()),
      ])
      expect(v1Res).toEqual(legacyRes)
    })

    it('versioned and legacy gap-analysis endpoints return the same data', async () => {
      const [v1Res, legacyRes] = await Promise.all([
        fetch(`${baseUrl}/api/v1/gap-analysis`).then(r => r.json()),
        fetch(`${baseUrl}/api/gap-analysis`).then(r => r.json()),
      ])
      expect(v1Res).toEqual(legacyRes)
    })

    it('unknown API routes return 404 with version header', async () => {
      const res = await fetch(`${baseUrl}/api/v1/nonexistent`)
      expect(res.status).toBe(404)
      expect(res.headers.get('x-api-version')).toBe(API_VERSION)
    })
  })
})
