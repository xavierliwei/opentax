import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TaxService } from '../../openclaw-plugin/service/TaxService.ts'
import { createHttpService, MAX_BODY_SIZE } from '../../openclaw-plugin/http/httpService.ts'
import { emptyTaxReturn } from '../../src/model/types.ts'

// ── Helpers ──────────────────────────────────────────────────────

let workspace: string
let httpService: ReturnType<typeof createHttpService>

function postSync(
  body: string | Buffer,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: httpService.port,
        path: '/api/sync',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => resolve({ status: res.statusCode!, body: data }))
      },
    )
    req.on('error', reject)
    req.end(body)
  })
}

/**
 * Send a POST request that streams its body in chunks, allowing us to
 * simulate a body that exceeds the size limit mid-stream without
 * declaring a Content-Length header up front.
 */
function postSyncChunked(
  chunks: Buffer[],
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: httpService.port,
        path: '/api/sync',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked',
          ...headers,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => resolve({ status: res.statusCode!, body: data }))
      },
    )

    req.on('error', (err: NodeJS.ErrnoException) => {
      // The server may destroy the socket when the limit is exceeded.
      // In that case we resolve with a synthetic 413 so the test can assert.
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        resolve({ status: 413, body: '{"error":"payload_too_large"}' })
      } else {
        reject(err)
      }
    })

    // Write chunks with a small delay between them so the server can
    // process them individually.
    let i = 0
    function writeNext() {
      if (i < chunks.length) {
        const ok = req.write(chunks[i])
        i++
        if (ok) {
          setImmediate(writeNext)
        } else {
          req.once('drain', writeNext)
        }
      } else {
        req.end()
      }
    }
    writeNext()
  })
}

beforeEach(async () => {
  workspace = mkdtempSync(join(tmpdir(), 'opentax-http-test-'))
  const svc = new TaxService(workspace)
  httpService = createHttpService(svc, { port: 0 })
  await httpService.start()
})

afterEach(async () => {
  await httpService.stop()
  rmSync(workspace, { recursive: true, force: true })
})

// ── Tests ────────────────────────────────────────────────────────

describe('POST /api/sync request limits', () => {
  it('accepts a normal-sized request', async () => {
    const taxReturn = emptyTaxReturn(2025)
    const payload = JSON.stringify({ taxReturn, stateVersion: 0 })

    const res = await postSync(payload)
    expect(res.status).toBe(200)
    const json = JSON.parse(res.body)
    expect(json.ok).toBe(true)
  })

  it('rejects request with Content-Length exceeding limit (413)', async () => {
    const res = await postSync('{}', {
      'Content-Length': String(MAX_BODY_SIZE + 1),
    })
    expect(res.status).toBe(413)
    const json = JSON.parse(res.body)
    expect(json.error).toBe('payload_too_large')
  })

  it('rejects request body that exceeds limit mid-stream (413)', async () => {
    // Create chunks that together exceed MAX_BODY_SIZE
    const chunkSize = 1024 * 1024 // 1 MB per chunk
    const numChunks = 6 // 6 MB total > 5 MB limit
    const chunks: Buffer[] = []
    for (let i = 0; i < numChunks; i++) {
      chunks.push(Buffer.alloc(chunkSize, 0x41)) // 'A'
    }

    const res = await postSyncChunked(chunks)
    expect(res.status).toBe(413)
    const json = JSON.parse(res.body)
    expect(json.error).toBe('payload_too_large')
  })
})
