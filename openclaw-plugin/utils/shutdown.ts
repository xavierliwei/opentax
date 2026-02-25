/**
 * GracefulShutdown — manages ordered shutdown of services on process signals.
 *
 * Handlers run in LIFO (reverse registration) order so that higher-level
 * services (e.g. HTTP) close before lower-level ones (e.g. database).
 * A configurable timeout prevents a stuck handler from blocking exit forever.
 *
 * Usage:
 *   const shutdown = createShutdownManager()
 *   shutdown.register('http', () => httpServer.close())
 *   shutdown.register('db', () => db.close())
 *   shutdown.installSignalHandlers()
 */

import { logger } from './logger.ts'

const log = logger.child({ component: 'shutdown' })

export interface ShutdownHandler {
  name: string
  fn: () => Promise<void> | void
}

export class GracefulShutdown {
  private handlers: ShutdownHandler[] = []
  private shutdownInProgress = false
  private readonly timeoutMs: number

  constructor(opts?: { timeoutMs?: number }) {
    this.timeoutMs = opts?.timeoutMs ?? 10_000
  }

  /** Register a cleanup handler. Handlers run in reverse order (LIFO). */
  register(name: string, fn: () => Promise<void> | void): void {
    this.handlers.push({ name, fn })
  }

  /**
   * Run all registered handlers in reverse order.
   * If a handler throws, it is logged and remaining handlers still execute.
   * Resolves when all handlers complete or the timeout expires.
   */
  async shutdown(): Promise<void> {
    if (this.shutdownInProgress) {
      log.warn('Shutdown already in progress, ignoring duplicate call')
      return
    }
    this.shutdownInProgress = true

    log.info('Graceful shutdown started', {
      handlerCount: this.handlers.length,
      timeoutMs: this.timeoutMs,
    })

    const runHandlers = async (): Promise<void> => {
      // Run in reverse registration order (LIFO)
      const reversed = [...this.handlers].reverse()
      for (const handler of reversed) {
        try {
          log.info('Running shutdown handler', { handler: handler.name })
          await handler.fn()
          log.info('Shutdown handler completed', { handler: handler.name })
        } catch (err) {
          log.error('Shutdown handler failed', {
            handler: handler.name,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    // Race the handlers against a timeout
    await Promise.race([
      runHandlers(),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          log.error('Shutdown timed out, forcing exit', { timeoutMs: this.timeoutMs })
          resolve()
        }, this.timeoutMs)
      }),
    ])

    log.info('Graceful shutdown complete')
  }

  /**
   * Install process signal handlers for SIGTERM, SIGINT, and uncaughtException.
   * A second signal forces immediate exit.
   */
  installSignalHandlers(): void {
    let forceExitOnNextSignal = false

    const onSignal = (signal: string) => {
      if (forceExitOnNextSignal) {
        log.warn('Received second signal, forcing exit', { signal })
        process.exit(1)
      }

      forceExitOnNextSignal = true
      log.info('Received signal, starting shutdown', { signal })

      this.shutdown().then(() => {
        process.exit(0)
      }).catch((err) => {
        log.error('Shutdown error', { error: err instanceof Error ? err.message : String(err) })
        process.exit(1)
      })
    }

    process.on('SIGTERM', () => onSignal('SIGTERM'))
    process.on('SIGINT', () => onSignal('SIGINT'))

    process.on('uncaughtException', (err) => {
      log.error('Uncaught exception, starting shutdown', {
        error: err.message,
        stack: err.stack,
      })

      this.shutdown().then(() => {
        process.exit(1)
      }).catch(() => {
        process.exit(1)
      })
    })
  }
}

/** Create a new shutdown manager with optional configuration. */
export function createShutdownManager(opts?: { timeoutMs?: number }): GracefulShutdown {
  return new GracefulShutdown(opts)
}
