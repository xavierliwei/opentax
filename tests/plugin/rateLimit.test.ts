import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RateLimiter, createRateLimiter } from '../../openclaw-plugin/http/rateLimit.ts'
import { TaxService } from '../../openclaw-plugin/service/TaxService.ts'
import { createHttpService } from '../../openclaw-plugin/http/httpService.ts'
import { emptyTaxReturn } from '../../src/model/types.ts'

// ── Unit tests for RateLimiter ──────────────────────────────────

describe('RateLimiter', () => {
  let limiter: RateLimiter

  afterEach(() => {
    limiter?.destroy()
  })

  it('allows requests under the limit', () => {
    limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 })

    for (let i = 0; i < 5; i++) {
      const result = limiter.check('client-a')
      expect(result.allowed).toBe(true)
      expect(result.retryAfterMs).toBe(0)
    }
  })

  it('rejects requests over the limit', () => {
    limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3 })

    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      expect(limiter.check('client-a').allowed).toBe(true)
    }

    // 4th request should be rejected
    const result = limiter.check('client-a')
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets after windowMs elapses', () => {
    vi.useFakeTimers()
    try {
      limiter = createRateLimiter({ windowMs: 1000, maxRequests: 2 })

      // Exhaust the limit
      expect(limiter.check('client-a').allowed).toBe(true)
      expect(limiter.check('client-a').allowed).toBe(true)
      expect(limiter.check('client-a').allowed).toBe(false)

      // Advance time past the window
      vi.advanceTimersByTime(1001)

      // Should be allowed again
      const result = limiter.check('client-a')
      expect(result.allowed).toBe(true)
      expect(result.retryAfterMs).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('tracks different keys independently', () => {
    limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 })

    // Client A uses up its limit
    expect(limiter.check('client-a').allowed).toBe(true)
    expect(limiter.check('client-a').allowed).toBe(true)
    expect(limiter.check('client-a').allowed).toBe(false)

    // Client B should still be allowed
    expect(limiter.check('client-b').allowed).toBe(true)
    expect(limiter.check('client-b').allowed).toBe(true)
    expect(limiter.check('client-b').allowed).toBe(false)
  })

  it('reset() clears a specific key', () => {
    limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 })

    // Exhaust limit for both clients
    limiter.check('client-a')
    limiter.check('client-a')
    limiter.check('client-b')
    limiter.check('client-b')

    expect(limiter.check('client-a').allowed).toBe(false)
    expect(limiter.check('client-b').allowed).toBe(false)

    // Reset only client-a
    limiter.reset('client-a')

    expect(limiter.check('client-a').allowed).toBe(true)
    // client-b should still be limited
    expect(limiter.check('client-b').allowed).toBe(false)
  })

  it('reset() with no key clears all entries', () => {
    limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 })

    limiter.check('client-a')
    limiter.check('client-b')

    expect(limiter.check('client-a').allowed).toBe(false)
    expect(limiter.check('client-b').allowed).toBe(false)

    // Reset everything
    limiter.reset()

    expect(limiter.check('client-a').allowed).toBe(true)
    expect(limiter.check('client-b').allowed).toBe(true)
  })

  it('retryAfterMs is a positive value when rate limited', () => {
    vi.useFakeTimers()
    try {
      limiter = createRateLimiter({ windowMs: 10_000, maxRequests: 1 })

      limiter.check('client-a')
      const result = limiter.check('client-a')

      expect(result.allowed).toBe(false)
      // retryAfterMs should be close to windowMs since the only request
      // was just made at the current time
      expect(result.retryAfterMs).toBeGreaterThan(0)
      expect(result.retryAfterMs).toBeLessThanOrEqual(10_000)
    } finally {
      vi.useRealTimers()
    }
  })

  it('destroy() stops the cleanup timer and clears entries', () => {
    limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 })

    limiter.check('client-a')
    limiter.destroy()

    // After destroy, check still works (stateless) but starts fresh
    // because destroy clears entries
    const result = limiter.check('client-a')
    expect(result.allowed).toBe(true)
  })
})

// ── HTTP integration tests ──────────────────────────────────────

describe('POST /api/v1/sync rate limiting (HTTP integration)', () => {
  let workspace: string
  let httpService: ReturnType<typeof createHttpService>

  function postSync(
    body: string,
    path = '/api/v1/sync',
  ): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: httpService.port,
          path,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => resolve({
            status: res.statusCode!,
            body: data,
            headers: res.headers,
          }))
        },
      )
      req.on('error', reject)
      req.end(body)
    })
  }

  function getStatus(): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: httpService.port,
          path: '/api/v1/status',
          method: 'GET',
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => resolve({ status: res.statusCode!, body: data }))
        },
      )
      req.on('error', reject)
      req.end()
    })
  }

  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), 'opentax-ratelimit-test-'))
    const svc = new TaxService(workspace)
    // Use a very low rate limit so we can trigger it easily in tests
    httpService = createHttpService(svc, {
      port: 0,
      rateLimiter: { windowMs: 60_000, maxRequests: 3 },
    })
    await httpService.start()
  })

  afterEach(async () => {
    await httpService.stop()
    rmSync(workspace, { recursive: true, force: true })
  })

  it('allows requests under the rate limit', async () => {
    const taxReturn = emptyTaxReturn(2025)
    // Omit stateVersion to skip the version conflict check, so each
    // request is accepted regardless of the server's current version.
    const payload = JSON.stringify({ taxReturn })

    // Send 3 requests (our limit)
    for (let i = 0; i < 3; i++) {
      const res = await postSync(payload)
      expect(res.status).toBe(200)
      const json = JSON.parse(res.body)
      expect(json.ok).toBe(true)
    }
  })

  it('returns 429 when rate limit is exceeded', async () => {
    const taxReturn = emptyTaxReturn(2025)
    const payload = JSON.stringify({ taxReturn })

    // Exhaust the limit (3 requests)
    for (let i = 0; i < 3; i++) {
      const res = await postSync(payload)
      expect(res.status).toBe(200)
    }

    // 4th request should be rate limited
    const res = await postSync(payload)
    expect(res.status).toBe(429)
    const json = JSON.parse(res.body)
    expect(json.error).toBe('rate_limited')
    expect(json.retryAfterMs).toBeGreaterThan(0)
  })

  it('includes Retry-After header on 429 responses', async () => {
    const taxReturn = emptyTaxReturn(2025)
    const payload = JSON.stringify({ taxReturn })

    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      await postSync(payload)
    }

    // Trigger rate limit
    const res = await postSync(payload)
    expect(res.status).toBe(429)

    // Retry-After header should be present and be a positive integer (seconds)
    const retryAfter = res.headers['retry-after']
    expect(retryAfter).toBeDefined()
    const retryAfterSeconds = parseInt(retryAfter as string, 10)
    expect(retryAfterSeconds).toBeGreaterThan(0)
  })

  it('does not rate limit GET requests', async () => {
    // Make many GET /api/v1/status requests — they should never be rate limited
    for (let i = 0; i < 10; i++) {
      const res = await getStatus()
      expect(res.status).toBe(200)
    }
  })

  it('rate limits legacy POST /api/sync as well', async () => {
    const taxReturn = emptyTaxReturn(2025)
    const payload = JSON.stringify({ taxReturn })

    // Exhaust the limit via legacy path
    for (let i = 0; i < 3; i++) {
      const res = await postSync(payload, '/api/sync')
      expect(res.status).toBe(200)
    }

    // 4th request should be rate limited
    const res = await postSync(payload, '/api/sync')
    expect(res.status).toBe(429)
    const json = JSON.parse(res.body)
    expect(json.error).toBe('rate_limited')
  })
})
