/**
 * In-memory rate limiter using a sliding-window token bucket algorithm.
 *
 * Each key (typically a client IP) tracks an array of request timestamps.
 * When `check()` is called, expired timestamps (older than `windowMs`) are
 * pruned. If the remaining count is under `maxRequests`, the request is
 * allowed and a new timestamp is recorded. Otherwise, the request is
 * rejected and `retryAfterMs` indicates how long until the oldest timestamp
 * expires and frees a slot.
 *
 * A periodic cleanup timer evicts stale entries to prevent unbounded memory
 * growth. Call `destroy()` to clear the timer when shutting down.
 */

export interface RateLimitOptions {
  /** Duration of the sliding window in milliseconds. */
  windowMs: number
  /** Maximum number of requests allowed within the window. */
  maxRequests: number
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean
  /** Milliseconds until the client should retry (0 if allowed). */
  retryAfterMs: number
}

export class RateLimiter {
  private readonly windowMs: number
  private readonly maxRequests: number
  /** Map of key -> sorted array of request timestamps (ms). */
  private readonly entries = new Map<string, number[]>()
  /** Periodic cleanup interval handle. */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs
    this.maxRequests = options.maxRequests

    // Run cleanup every windowMs to evict fully-expired entries
    this.cleanupTimer = setInterval(() => this.cleanup(), this.windowMs)
    // Allow the process to exit even if the timer is still active
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref()
    }
  }

  /**
   * Check whether a request from `key` is allowed under the rate limit.
   *
   * If allowed, the request is recorded. If rejected, `retryAfterMs`
   * indicates how long until a slot opens up.
   */
  check(key: string): RateLimitResult {
    const now = Date.now()
    const windowStart = now - this.windowMs

    let timestamps = this.entries.get(key)
    if (!timestamps) {
      timestamps = []
      this.entries.set(key, timestamps)
    }

    // Prune expired timestamps (those before the window start)
    while (timestamps.length > 0 && timestamps[0] <= windowStart) {
      timestamps.shift()
    }

    if (timestamps.length < this.maxRequests) {
      // Allowed — record this request
      timestamps.push(now)
      return { allowed: true, retryAfterMs: 0 }
    }

    // Rejected — calculate when the oldest entry in the window expires
    const oldestInWindow = timestamps[0]
    const retryAfterMs = oldestInWindow + this.windowMs - now

    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1) }
  }

  /**
   * Reset rate limit state. If `key` is provided, only that key is cleared.
   * Otherwise all entries are cleared.
   */
  reset(key?: string): void {
    if (key !== undefined) {
      this.entries.delete(key)
    } else {
      this.entries.clear()
    }
  }

  /** Remove entries that are entirely outside the current window. */
  private cleanup(): void {
    const windowStart = Date.now() - this.windowMs
    for (const [key, timestamps] of this.entries) {
      // If all timestamps are expired, remove the entry entirely
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= windowStart) {
        this.entries.delete(key)
      }
    }
  }

  /** Stop the cleanup timer. Call this when shutting down. */
  destroy(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.entries.clear()
  }
}

/** Factory function to create a RateLimiter instance. */
export function createRateLimiter(opts: RateLimitOptions): RateLimiter {
  return new RateLimiter(opts)
}
