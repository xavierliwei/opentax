/**
 * TracedValue and ValueSource — the explainability backbone.
 *
 * Every monetary value in the system carries its provenance:
 * where it came from, how confident we are, and what IRS line it maps to.
 */

// ── Value sources ──────────────────────────────────────────────

/** A value extracted from a source document (W-2 box, 1099 field, etc.) */
export interface DocumentSource {
  kind: 'document'
  documentType: string   // e.g., "W-2", "1099-B", "1099-INT"
  documentId: string     // unique ID within the return
  field: string          // e.g., "Box 1", "Proceeds"
  description?: string   // e.g., "Acme Corp W-2, Box 1 (Wages)"
}

/** A value produced by a deterministic computation node */
export interface ComputedSource {
  kind: 'computed'
  nodeId: string         // e.g., "form1040.line1a"
  inputs: string[]       // node IDs this was derived from
  description?: string   // e.g., "Sum of all W-2 Box 1 values"
}

/** A value manually entered by the user */
export interface UserEntrySource {
  kind: 'user-entry'
  field: string          // which UI field
  enteredAt: string      // ISO timestamp
  description?: string
}

export type ValueSource = DocumentSource | ComputedSource | UserEntrySource

// ── TracedValue ────────────────────────────────────────────────

/**
 * A monetary amount with full provenance tracking.
 * `amount` is always in integer cents to avoid floating-point errors.
 */
export interface TracedValue {
  amount: number          // integer cents (e.g., 10050 = $100.50)
  source: ValueSource
  confidence: number      // 0–1 (1.0 = certain, <1.0 = OCR/heuristic)
  irsCitation?: string    // e.g., "Form 1040, Line 1a"
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * Convert a dollar amount to integer cents.
 * Rounds to nearest cent to handle floating-point imprecision.
 *
 *   cents(100.10) → 10010
 *   cents(0)      → 0
 *   cents(-50.5)  → -5050
 */
export function cents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Convert integer cents back to dollars for display.
 *
 *   dollars(10010)  → 100.10
 *   dollars(0)      → 0
 *   dollars(-5050)  → -50.50
 */
export function dollars(amountInCents: number): number {
  return amountInCents / 100
}

/**
 * Create a TracedValue with a document source.
 * Convenience for the most common case: reading a value from a tax form.
 */
export function tracedFromDocument(
  amount: number,
  documentType: string,
  documentId: string,
  field: string,
  irsCitation?: string,
): TracedValue {
  return {
    amount,
    source: {
      kind: 'document',
      documentType,
      documentId,
      field,
    },
    confidence: 1.0,
    irsCitation,
  }
}

/**
 * Create a TracedValue from a computation.
 */
export function tracedFromComputation(
  amount: number,
  nodeId: string,
  inputs: string[],
  irsCitation?: string,
): TracedValue {
  return {
    amount,
    source: {
      kind: 'computed',
      nodeId,
      inputs,
    },
    confidence: 1.0,
    irsCitation,
  }
}

/**
 * Create a zero-value TracedValue (common for unused/placeholder lines).
 */
export function tracedZero(nodeId: string, irsCitation?: string): TracedValue {
  return tracedFromComputation(0, nodeId, [], irsCitation)
}
