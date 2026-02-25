/**
 * Structured JSON logger — lightweight, zero-dependency.
 *
 * Usage:
 *   import { logger } from './logger.ts'
 *   logger.info('Server started', { port: 7890 })
 *
 * Output (one JSON object per line):
 *   {"timestamp":"2025-06-01T12:00:00.000Z","level":"info","message":"Server started","port":7890}
 *
 * Configure via LOG_LEVEL env var (default: "info").
 * Levels in ascending severity: debug, info, warn, error
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function resolveLevel(env: string | undefined): LogLevel {
  const raw = (env ?? 'info').toLowerCase()
  if (raw in LEVEL_PRIORITY) return raw as LogLevel
  return 'info'
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  [key: string]: unknown
}

export class Logger {
  private threshold: number

  constructor(level?: LogLevel) {
    const effective = level ?? resolveLevel(process.env.LOG_LEVEL)
    this.threshold = LEVEL_PRIORITY[effective]
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < this.threshold) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    }

    const line = JSON.stringify(entry)

    if (level === 'error') {
      process.stderr.write(line + '\n')
    } else {
      process.stdout.write(line + '\n')
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write('debug', message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write('warn', message, context)
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.write('error', message, context)
  }

  /** Create a child logger that injects fixed context fields into every log line. */
  child(defaults: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, defaults)
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private defaults: Record<string, unknown>,
  ) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.defaults, ...context })
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.defaults, ...context })
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(message, { ...this.defaults, ...context })
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.parent.error(message, { ...this.defaults, ...context })
  }
}

/** Singleton logger instance for the application. */
export const logger = new Logger()
