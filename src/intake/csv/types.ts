/**
 * Shared broker CSV import types.
 *
 * Every broker parser (Robinhood, Fidelity, Vanguard, etc.)
 * implements the BrokerParser interface and produces a ParseResult.
 */

import type { Form1099B } from '../../model/types'

// ── Parse result ─────────────────────────────────────────────

export interface ParseResult {
  transactions: Form1099B[]
  warnings: string[]
  errors: string[]
  rowCounts: {
    total: number    // total data rows encountered
    parsed: number   // successfully parsed
    skipped: number  // skipped (summary rows, blanks, etc.)
  }
}

// ── Broker parser interface ──────────────────────────────────

export interface BrokerParser {
  /** Human-readable broker name (e.g., "Robinhood") */
  readonly brokerName: string

  /** Parse a raw CSV string into Form1099B transactions. */
  parse(csv: string): ParseResult
}
