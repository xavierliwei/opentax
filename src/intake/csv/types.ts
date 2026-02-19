/**
 * Shared broker CSV import types.
 *
 * Every broker parser (Robinhood, Fidelity, Vanguard, etc.)
 * implements the BrokerParser interface and produces a ParseResult.
 */

import type { Form1099B, Form1099DIV, Form1099INT } from '../../model/types'

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

/** Extended result for consolidated PDFs that contain DIV/INT alongside 1099-B */
export interface ConsolidatedParseResult extends ParseResult {
  form1099DIVs: Form1099DIV[]
  form1099INTs: Form1099INT[]
}

// ── Broker parser interface ──────────────────────────────────

export interface BrokerParser {
  /** Human-readable broker name (e.g., "Robinhood") */
  readonly brokerName: string

  /** Parse a raw CSV string into Form1099B transactions. */
  parse(csv: string): ParseResult
}
