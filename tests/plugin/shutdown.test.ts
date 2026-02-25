import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GracefulShutdown, createShutdownManager } from '../../openclaw-plugin/utils/shutdown.ts'

// Suppress log output during tests
vi.mock('../../openclaw-plugin/utils/logger.ts', () => {
  const noop = () => {}
  const noopLogger = { debug: noop, info: noop, warn: noop, error: noop, child: () => noopLogger }
  return { logger: noopLogger }
})

describe('GracefulShutdown', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('handler execution order', () => {
    it('runs handlers in reverse registration order (LIFO)', async () => {
      const order: string[] = []
      const shutdown = createShutdownManager()

      shutdown.register('first', () => { order.push('first') })
      shutdown.register('second', () => { order.push('second') })
      shutdown.register('third', () => { order.push('third') })

      await shutdown.shutdown()

      expect(order).toEqual(['third', 'second', 'first'])
    })
  })

  describe('completion', () => {
    it('completes shutdown within timeout', async () => {
      const shutdown = createShutdownManager({ timeoutMs: 5000 })

      shutdown.register('fast', async () => {
        await new Promise((r) => setTimeout(r, 10))
      })

      const start = Date.now()
      await shutdown.shutdown()
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(5000)
    })
  })

  describe('error resilience', () => {
    it('continues running remaining handlers if one throws', async () => {
      const order: string[] = []
      const shutdown = createShutdownManager()

      shutdown.register('first', () => { order.push('first') })
      shutdown.register('failing', () => { throw new Error('boom') })
      shutdown.register('third', () => { order.push('third') })

      await shutdown.shutdown()

      // 'failing' is between 'first' and 'third', executed in LIFO order: third, failing, first
      expect(order).toEqual(['third', 'first'])
    })

    it('continues running remaining handlers if an async handler rejects', async () => {
      const order: string[] = []
      const shutdown = createShutdownManager()

      shutdown.register('first', () => { order.push('first') })
      shutdown.register('failing', async () => { throw new Error('async boom') })
      shutdown.register('third', () => { order.push('third') })

      await shutdown.shutdown()

      expect(order).toEqual(['third', 'first'])
    })
  })

  describe('double-shutdown protection', () => {
    it('second shutdown call is a no-op', async () => {
      let callCount = 0
      const shutdown = createShutdownManager()

      shutdown.register('counter', () => { callCount++ })

      await shutdown.shutdown()
      await shutdown.shutdown()

      expect(callCount).toBe(1)
    })
  })

  describe('timeout', () => {
    it('completes after timeout if a handler hangs', async () => {
      const shutdown = createShutdownManager({ timeoutMs: 100 })

      shutdown.register('hanging', () => new Promise(() => {
        // Never resolves
      }))

      const start = Date.now()
      await shutdown.shutdown()
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(90) // allow small timing variance
      expect(elapsed).toBeLessThan(1000)
    })
  })

  describe('zero handlers', () => {
    it('shutdown completes with no registered handlers', async () => {
      const shutdown = createShutdownManager()

      await expect(shutdown.shutdown()).resolves.toBeUndefined()
    })
  })

  describe('createShutdownManager factory', () => {
    it('returns a GracefulShutdown instance', () => {
      const shutdown = createShutdownManager()
      expect(shutdown).toBeInstanceOf(GracefulShutdown)
    })

    it('accepts custom timeout', () => {
      const shutdown = createShutdownManager({ timeoutMs: 5000 })
      expect(shutdown).toBeInstanceOf(GracefulShutdown)
    })
  })
})
