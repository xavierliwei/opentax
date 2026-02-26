import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TaxService } from '../../openclaw-plugin/service/TaxService.ts'
import { createHttpService } from '../../openclaw-plugin/http/httpService.ts'

// ── Helpers ──────────────────────────────────────────────────────

let workspace: string
let service: TaxService
let httpService: ReturnType<typeof createHttpService>
let baseUrl: string

beforeEach(async () => {
  workspace = mkdtempSync(join(tmpdir(), 'opentax-health-test-'))
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

// ── GET /api/v1/health ──────────────────────────────────────────

describe('GET /api/v1/health', () => {
  it('returns 200 with correct shape', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status', 'ok')
    expect(body).toHaveProperty('uptime')
    expect(body).toHaveProperty('stateVersion')
    expect(body).toHaveProperty('timestamp')
  })

  it('returns uptime > 0', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`)
    const body = await res.json()
    expect(body.uptime).toBeGreaterThan(0)
  })

  it('returns a valid ISO timestamp', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`)
    const body = await res.json()
    const parsed = new Date(body.timestamp)
    expect(parsed.toISOString()).toBe(body.timestamp)
  })

  it('returns the current stateVersion', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`)
    const body = await res.json()
    expect(body.stateVersion).toBe(service.stateVersion)
  })

  it('works on legacy /api/health route', async () => {
    const res = await fetch(`${baseUrl}/api/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('status', 'ok')
    expect(body).toHaveProperty('uptime')
    expect(body).toHaveProperty('stateVersion')
    expect(body).toHaveProperty('timestamp')
    // Legacy routes get deprecation headers
    expect(res.headers.get('deprecation')).toBe('true')
  })

  it('responds in under 50ms', async () => {
    const start = performance.now()
    await fetch(`${baseUrl}/api/v1/health`)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(50)
  })

  it('is not logged (no request log emitted)', async () => {
    // Spy on process.stdout.write to capture log output
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await fetch(`${baseUrl}/api/v1/health`)
    // Give the finish handler a tick to fire
    await new Promise((resolve) => setTimeout(resolve, 50))

    const logLines = writeSpy.mock.calls
      .map(([arg]) => (typeof arg === 'string' ? arg : ''))
      .filter((line) => line.includes('"message":"request"') && line.includes('/api/v1/health'))

    expect(logLines).toHaveLength(0)

    writeSpy.mockRestore()
  })
})

// ── GET /api/v1/ready ───────────────────────────────────────────

describe('GET /api/v1/ready', () => {
  it('returns 200 with status ready when service has data', async () => {
    // TaxService always initializes with a tax return (empty or loaded)
    expect(service.taxReturn).toBeDefined()
    const res = await fetch(`${baseUrl}/api/v1/ready`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ready' })
  })

  it('returns 503 with status not_ready when taxReturn is null', async () => {
    // Force the service into an unloaded state for this test
    ;(service as unknown as { taxReturn: null }).taxReturn = null

    const res = await fetch(`${baseUrl}/api/v1/ready`)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toEqual({ status: 'not_ready' })
  })

  it('works on legacy /api/ready route', async () => {
    const res = await fetch(`${baseUrl}/api/ready`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ready' })
    // Legacy routes get deprecation headers
    expect(res.headers.get('deprecation')).toBe('true')
  })
})
