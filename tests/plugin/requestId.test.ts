import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getRequestId } from '../../openclaw-plugin/http/requestId.ts'
import { TaxService } from '../../openclaw-plugin/service/TaxService.ts'
import { createHttpService } from '../../openclaw-plugin/http/httpService.ts'
import { emptyTaxReturn } from '../../src/model/types.ts'

// ── UUID v4 format regex ──────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ── Helpers ───────────────────────────────────────────────────────

/** Create a minimal IncomingMessage with the given headers. */
function fakeRequest(headers: Record<string, string | string[] | undefined> = {}): IncomingMessage {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  // Assign headers directly — they are lowercase-keyed by Node convention
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      req.headers[key.toLowerCase()] = value as string
    }
  }
  return req
}

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
        res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: data }))
      },
    )
    req.on('error', reject)
    req.end()
  })
}

function postSync(
  body: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: httpService.port,
        path: '/api/v1/sync',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: data }))
      },
    )
    req.on('error', reject)
    req.end(body)
  })
}

// ── Unit tests for getRequestId ───────────────────────────────────

describe('getRequestId (unit)', () => {
  it('returns a UUID when no x-request-id header is present', () => {
    const req = fakeRequest()
    const id = getRequestId(req)
    expect(id).toMatch(UUID_RE)
  })

  it('returns the provided x-request-id header', () => {
    const clientId = 'my-custom-correlation-id'
    const req = fakeRequest({ 'x-request-id': clientId })
    const id = getRequestId(req)
    expect(id).toBe(clientId)
  })

  it('generates a new UUID when x-request-id header is empty string', () => {
    const req = fakeRequest({ 'x-request-id': '' })
    const id = getRequestId(req)
    expect(id).toMatch(UUID_RE)
  })

  it('each call generates a unique ID when no header provided', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(getRequestId(fakeRequest()))
    }
    expect(ids.size).toBe(100)
  })

  it('generated ID is a valid UUID v4 format', () => {
    const req = fakeRequest()
    const id = getRequestId(req)
    // UUID v4: 8-4-4-4-12 hex chars, version nibble is '4', variant bits are '8', '9', 'a', or 'b'
    expect(id).toMatch(UUID_RE)
  })
})

// ── HTTP integration tests ────────────────────────────────────────

let workspace: string
let httpService: ReturnType<typeof createHttpService>

describe('x-request-id HTTP integration', () => {
  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), 'opentax-reqid-test-'))
    const svc = new TaxService(workspace)
    httpService = createHttpService(svc, { port: 0 })
    await httpService.start()
  })

  afterEach(async () => {
    await httpService.stop()
    rmSync(workspace, { recursive: true, force: true })
  })

  it('response includes x-request-id header', async () => {
    const res = await get('/api/v1/status')
    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).toBeDefined()
    expect(typeof res.headers['x-request-id']).toBe('string')
    expect((res.headers['x-request-id'] as string).length).toBeGreaterThan(0)
  })

  it('client-provided x-request-id is echoed back', async () => {
    const clientId = 'client-supplied-id-12345'
    const res = await get('/api/v1/status', { 'x-request-id': clientId })
    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).toBe(clientId)
  })

  it('each request gets a unique ID when none provided', async () => {
    const res1 = await get('/api/v1/status')
    const res2 = await get('/api/v1/status')
    const id1 = res1.headers['x-request-id'] as string
    const id2 = res2.headers['x-request-id'] as string
    expect(id1).toBeDefined()
    expect(id2).toBeDefined()
    expect(id1).not.toBe(id2)
  })

  it('auto-generated request ID is a valid UUID format', async () => {
    const res = await get('/api/v1/status')
    const id = res.headers['x-request-id'] as string
    expect(id).toMatch(UUID_RE)
  })

  it('request ID is included in Zod validation error response body', async () => {
    const clientId = 'validation-error-trace-id'
    const res = await postSync(
      JSON.stringify({ taxReturn: { invalid: true }, stateVersion: 0 }),
      { 'x-request-id': clientId },
    )
    expect(res.status).toBe(400)
    const json = JSON.parse(res.body)
    expect(json.error).toBe('validation_error')
    expect(json.requestId).toBe(clientId)
  })
})
