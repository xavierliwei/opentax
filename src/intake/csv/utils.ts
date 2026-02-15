/**
 * CSV parsing and data cleaning utilities for broker imports.
 *
 * - Manual RFC 4180 CSV parser (no papaparse dependency)
 * - Currency, date, and term parsers for brokerage data
 */

// ── RFC 4180 CSV parser ──────────────────────────────────────

/**
 * Parse a CSV string into rows of string arrays.
 *
 * Handles:
 * - Quoted fields (including embedded commas, newlines, quotes)
 * - Escaped quotes ("" inside quoted fields)
 * - CRLF and LF line endings
 * - Trailing newline (does not produce an extra empty row)
 */
export function parseCSV(raw: string): string[][] {
  const rows: string[][] = []
  let i = 0
  const len = raw.length

  // Empty input → no rows
  if (len === 0) return rows

  while (i < len) {
    const { row, nextIndex } = parseRow(raw, i, len)
    rows.push(row)
    i = nextIndex
  }

  return rows
}

function parseRow(
  raw: string,
  start: number,
  len: number,
): { row: string[]; nextIndex: number } {
  const fields: string[] = []
  let i = start

  while (i < len) {
    if (raw[i] === '"') {
      // Quoted field
      const { value, nextIndex } = parseQuotedField(raw, i, len)
      fields.push(value)
      i = nextIndex
      // After a quoted field, expect comma or end-of-row
      if (i < len && raw[i] === ',') {
        i++ // consume comma
        // If comma is immediately followed by EOL or EOF, there's a trailing empty field
        if (i >= len || raw[i] === '\n' || (raw[i] === '\r' && i + 1 < len && raw[i + 1] === '\n')) {
          fields.push('')
          if (i < len) {
            i = raw[i] === '\r' ? i + 2 : i + 1
          }
          break
        }
      } else {
        // End of row
        if (i < len && raw[i] === '\r') i++
        if (i < len && raw[i] === '\n') i++
        break
      }
    } else {
      // Unquoted field — scan to comma or end-of-line
      let fieldStart = i
      while (i < len && raw[i] !== ',' && raw[i] !== '\n' && raw[i] !== '\r') {
        i++
      }
      fields.push(raw.slice(fieldStart, i))

      if (i < len && raw[i] === ',') {
        i++ // consume comma
        // If comma is immediately followed by EOL or EOF, there's a trailing empty field
        if (i >= len || raw[i] === '\n' || (raw[i] === '\r' && i + 1 < len && raw[i + 1] === '\n')) {
          fields.push('')
          if (i < len) {
            i = raw[i] === '\r' ? i + 2 : i + 1
          }
          break
        }
      } else {
        // End of row
        if (i < len && raw[i] === '\r') i++
        if (i < len && raw[i] === '\n') i++
        break
      }
    }
  }

  return { row: fields, nextIndex: i }
}

function parseQuotedField(
  raw: string,
  start: number,
  len: number,
): { value: string; nextIndex: number } {
  let i = start + 1 // skip opening quote
  let value = ''

  while (i < len) {
    if (raw[i] === '"') {
      if (i + 1 < len && raw[i + 1] === '"') {
        // Escaped quote
        value += '"'
        i += 2
      } else {
        // Closing quote
        i++ // skip closing quote
        return { value, nextIndex: i }
      }
    } else {
      value += raw[i]
      i++
    }
  }

  // Unterminated quoted field — return what we have
  return { value, nextIndex: i }
}

// ── Currency parsing ─────────────────────────────────────────

/**
 * Parse a currency string into integer cents.
 *
 * Handles:
 * - "$1,234.56" → 123456
 * - "($500.00)" → -50000   (parenthesized negatives)
 * - "-$500.00"  → -50000
 * - "$0.00"     → 0
 * - ""          → null
 * - "N/A"       → null
 *
 * Also handles Robinhood-specific suffixes:
 * - "1234.56N"  → proceeds net of option premium (suffix stripped)
 * - "1234.56G"  → gross proceeds (suffix stripped)
 * - "1234.56W"  → wash sale amount (suffix stripped)
 */
export function parseCurrency(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.toLowerCase() === 'n/a') return null

  // Strip trailing N/G/W indicators (Robinhood-specific)
  let cleaned = trimmed.replace(/[NGW]$/i, '')

  // Detect negative: parenthesized or leading minus
  let negative = false
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    negative = true
    cleaned = cleaned.slice(1, -1)
  } else if (cleaned.startsWith('-')) {
    negative = true
    cleaned = cleaned.slice(1)
  }

  // Strip $ and commas
  cleaned = cleaned.replace(/[$,]/g, '')

  if (cleaned === '') return null

  const num = parseFloat(cleaned)
  if (isNaN(num)) return null

  const amountCents = Math.round(num * 100)
  return negative ? -amountCents : amountCents
}

// ── Date parsing ─────────────────────────────────────────────

/**
 * Parse a date string into ISO format (YYYY-MM-DD).
 *
 * Handles:
 * - "01/15/2025" → "2025-01-15"
 * - "1/5/2025"   → "2025-01-05"
 * - "2025-01-15" → "2025-01-15" (passthrough)
 * - "Various"    → null
 * - ""           → null
 */
export function parseDate(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.toLowerCase() === 'various') return null

  // MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, mm, dd, yyyy] = slashMatch
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  // Already ISO (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/)
  if (isoMatch) return trimmed

  return null
}

// ── Term parsing ─────────────────────────────────────────────

/**
 * Parse a term description into 'short' or 'long'.
 *
 * Handles variations like:
 * - "Short Term", "SHORT-TERM", "short", "ST" → 'short'
 * - "Long Term", "LONG-TERM", "long", "LT" → 'long'
 * - "" / unrecognized → null
 */
export function parseTerm(raw: string): 'short' | 'long' | null {
  const lower = raw.trim().toLowerCase()
  if (lower === '' || lower === 'n/a') return null

  if (lower === 'st' || lower.startsWith('short')) return 'short'
  if (lower === 'lt' || lower.startsWith('long')) return 'long'

  return null
}
