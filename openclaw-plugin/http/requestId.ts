/**
 * Request correlation ID helper.
 *
 * Extracts an existing `x-request-id` header from the incoming request or
 * generates a new UUID when none is provided. This ID is used to correlate
 * all log entries and responses for a single HTTP request.
 */

import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

/**
 * Return the correlation ID for the given request.
 *
 * 1. If the client (or a reverse proxy) supplied an `x-request-id` header,
 *    that value is returned as-is.
 * 2. Otherwise a new v4 UUID is generated.
 */
export function getRequestId(req: IncomingMessage): string {
  const header = req.headers['x-request-id']
  if (typeof header === 'string' && header.length > 0) {
    return header
  }
  return randomUUID()
}
