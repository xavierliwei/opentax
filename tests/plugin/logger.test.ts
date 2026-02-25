import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Logger } from '../../openclaw-plugin/utils/logger.ts'
import type { LogEntry } from '../../openclaw-plugin/utils/logger.ts'

// ── Helpers ──────────────────────────────────────────────────────

function captureOutput(fn: () => void): { stdout: string[]; stderr: string[] } {
  const stdout: string[] = []
  const stderr: string[] = []
  const origOut = process.stdout.write
  const origErr = process.stderr.write
  process.stdout.write = ((chunk: string) => { stdout.push(chunk); return true }) as typeof process.stdout.write
  process.stderr.write = ((chunk: string) => { stderr.push(chunk); return true }) as typeof process.stderr.write
  try {
    fn()
  } finally {
    process.stdout.write = origOut
    process.stderr.write = origErr
  }
  return { stdout, stderr }
}

function parseLine(raw: string): LogEntry {
  return JSON.parse(raw.trimEnd()) as LogEntry
}

// ── Tests ────────────────────────────────────────────────────────

describe('Logger', () => {
  describe('JSON output format', () => {
    it('produces valid JSON with required fields', () => {
      const log = new Logger('debug')
      const { stdout } = captureOutput(() => log.info('hello world'))

      expect(stdout).toHaveLength(1)
      const entry = parseLine(stdout[0])
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(entry.level).toBe('info')
      expect(entry.message).toBe('hello world')
    })

    it('includes context data in the log entry', () => {
      const log = new Logger('debug')
      const { stdout } = captureOutput(() =>
        log.info('request', { method: 'GET', path: '/api/status', durationMs: 42 }),
      )

      const entry = parseLine(stdout[0])
      expect(entry.method).toBe('GET')
      expect(entry.path).toBe('/api/status')
      expect(entry.durationMs).toBe(42)
    })

    it('outputs one line per log call (newline-delimited JSON)', () => {
      const log = new Logger('debug')
      const { stdout } = captureOutput(() => {
        log.info('first')
        log.info('second')
      })

      expect(stdout).toHaveLength(2)
      expect(stdout[0]).toMatch(/\n$/)
      expect(stdout[1]).toMatch(/\n$/)
    })
  })

  describe('log level filtering', () => {
    it('default level (info) suppresses debug', () => {
      const log = new Logger('info')
      const { stdout } = captureOutput(() => log.debug('hidden'))
      expect(stdout).toHaveLength(0)
    })

    it('info level allows info, warn, error', () => {
      const log = new Logger('info')
      const { stdout, stderr } = captureOutput(() => {
        log.info('a')
        log.warn('b')
        log.error('c')
      })
      expect(stdout).toHaveLength(2) // info + warn
      expect(stderr).toHaveLength(1) // error
    })

    it('debug level allows all messages', () => {
      const log = new Logger('debug')
      const { stdout, stderr } = captureOutput(() => {
        log.debug('a')
        log.info('b')
        log.warn('c')
        log.error('d')
      })
      expect(stdout).toHaveLength(3)
      expect(stderr).toHaveLength(1)
    })

    it('error level suppresses everything except error', () => {
      const log = new Logger('error')
      const { stdout, stderr } = captureOutput(() => {
        log.debug('a')
        log.info('b')
        log.warn('c')
        log.error('d')
      })
      expect(stdout).toHaveLength(0)
      expect(stderr).toHaveLength(1)
      expect(parseLine(stderr[0]).message).toBe('d')
    })

    it('warn level allows warn and error', () => {
      const log = new Logger('warn')
      const { stdout, stderr } = captureOutput(() => {
        log.debug('a')
        log.info('b')
        log.warn('c')
        log.error('d')
      })
      expect(stdout).toHaveLength(1) // warn
      expect(stderr).toHaveLength(1) // error
      expect(parseLine(stdout[0]).message).toBe('c')
    })
  })

  describe('error output', () => {
    it('writes error-level messages to stderr', () => {
      const log = new Logger('debug')
      const { stdout, stderr } = captureOutput(() => log.error('something broke'))

      expect(stdout).toHaveLength(0)
      expect(stderr).toHaveLength(1)
      const entry = parseLine(stderr[0])
      expect(entry.level).toBe('error')
      expect(entry.message).toBe('something broke')
    })
  })

  describe('child logger', () => {
    it('includes default context in every log line', () => {
      const root = new Logger('debug')
      const child = root.child({ component: 'http', requestId: '123' })

      const { stdout } = captureOutput(() => child.info('handled request'))
      const entry = parseLine(stdout[0])

      expect(entry.component).toBe('http')
      expect(entry.requestId).toBe('123')
      expect(entry.message).toBe('handled request')
    })

    it('per-call context overrides child defaults', () => {
      const root = new Logger('debug')
      const child = root.child({ component: 'http' })

      const { stdout } = captureOutput(() =>
        child.info('override', { component: 'custom' }),
      )
      const entry = parseLine(stdout[0])
      expect(entry.component).toBe('custom')
    })

    it('respects parent log level filtering', () => {
      const root = new Logger('warn')
      const child = root.child({ component: 'test' })

      const { stdout, stderr } = captureOutput(() => {
        child.debug('hidden')
        child.info('hidden')
        child.warn('visible')
        child.error('visible')
      })
      expect(stdout).toHaveLength(1)
      expect(stderr).toHaveLength(1)
    })
  })

  describe('LOG_LEVEL environment variable', () => {
    const origEnv = process.env.LOG_LEVEL

    afterEach(() => {
      if (origEnv === undefined) {
        delete process.env.LOG_LEVEL
      } else {
        process.env.LOG_LEVEL = origEnv
      }
    })

    it('respects LOG_LEVEL=debug', () => {
      process.env.LOG_LEVEL = 'debug'
      const log = new Logger()
      const { stdout } = captureOutput(() => log.debug('visible'))
      expect(stdout).toHaveLength(1)
    })

    it('respects LOG_LEVEL=error', () => {
      process.env.LOG_LEVEL = 'error'
      const log = new Logger()
      const { stdout, stderr } = captureOutput(() => {
        log.info('hidden')
        log.error('visible')
      })
      expect(stdout).toHaveLength(0)
      expect(stderr).toHaveLength(1)
    })

    it('falls back to info for invalid LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'bogus'
      const log = new Logger()
      const { stdout } = captureOutput(() => {
        log.debug('hidden')
        log.info('visible')
      })
      expect(stdout).toHaveLength(1)
    })
  })
})
