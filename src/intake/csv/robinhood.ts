/**
 * Robinhood 1099-B CSV parser.
 *
 * Parses Robinhood's CSV export format into Form1099B[].
 * Handles stocks, options, ETFs with flexible header mapping.
 *
 * Expected columns (Robinhood 2024-2025 export format):
 *   Description, Date Acquired, Date Sold, Proceeds,
 *   Cost Basis, Wash Sale Loss Disallowed, Gain/Loss,
 *   Term, Box (or Category)
 *
 * Column names are matched case-insensitively with fuzzy matching
 * so minor variations across export years are handled.
 */

import type { Form1099B } from '../../model/types'
import type { BrokerParser, ParseResult } from './types'
import { parseCSV, parseCurrency, parseDate, parseTerm } from './utils'

// ── Column mappings ──────────────────────────────────────────

/** Known synonyms for each logical column */
const COLUMN_PATTERNS: Record<string, RegExp> = {
  description:   /^(description|security\s*name|security|name)/i,
  cusip:         /^cusip/i,
  dateAcquired:  /^date\s*(acquired|bought|purchased|opened)/i,
  dateSold:      /^date\s*(sold|closed|disposed)/i,
  proceeds:      /^(proceeds|sales?\s*proceeds|gross\s*proceeds)/i,
  costBasis:     /^(cost\s*basis|basis|cost)/i,
  washSale:      /^(wash\s*sale|wash\s*sale\s*loss|wash\s*sale\s*loss\s*disallowed|accrued\s*mkt)/i,
  gainLoss:      /^(gain|loss|gain\s*[\/(or)]*\s*loss|realized\s*gain)/i,
  term:          /^(term|holding\s*period|type)/i,
  box:           /^(box|category|form\s*8949\s*box|reporting\s*category)/i,
  quantity:      /^(quantity|qty|shares|units)/i,
}

interface ColumnMap {
  description: number
  cusip: number
  dateAcquired: number
  dateSold: number
  proceeds: number
  costBasis: number
  washSale: number
  gainLoss: number
  term: number
  box: number
  quantity: number
}

function mapHeaders(headers: string[]): { map: Partial<ColumnMap>; missing: string[] } {
  const map: Partial<ColumnMap> = {}
  const found = new Set<string>()

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim()
    for (const [key, pattern] of Object.entries(COLUMN_PATTERNS)) {
      if (pattern.test(h) && !(key in map)) {
        ;(map as Record<string, number>)[key] = i
        found.add(key)
      }
    }
  }

  // Required columns
  const required = ['description', 'dateSold', 'proceeds'] as const
  const missing = required.filter(k => !(k in map))

  return { map, missing }
}

// ── Row parsing helpers ──────────────────────────────────────

function getField(row: string[], index: number | undefined): string {
  if (index === undefined || index >= row.length) return ''
  return row[index].trim()
}

function isSummaryRow(description: string): boolean {
  const lower = description.toLowerCase()
  return (
    lower.startsWith('security total') ||
    lower.startsWith('totals') ||
    lower.startsWith('total') ||
    lower === ''
  )
}

/** Parse the Form 8949 box/category from the row data */
function parseCategory(
  boxField: string,
  term: 'short' | 'long' | null,
  basisReported: boolean,
): { longTerm: boolean | null; noncoveredSecurity: boolean; basisReportedToIrs: boolean } {
  const upper = boxField.trim().toUpperCase()

  // Direct box letter
  if (upper === 'A') return { longTerm: false, noncoveredSecurity: false, basisReportedToIrs: true }
  if (upper === 'B') return { longTerm: false, noncoveredSecurity: true, basisReportedToIrs: false }
  if (upper === 'D') return { longTerm: true, noncoveredSecurity: false, basisReportedToIrs: true }
  if (upper === 'E') return { longTerm: true, noncoveredSecurity: true, basisReportedToIrs: false }

  // Fall back to term + basis-reported heuristic
  const isLong = term === 'long' ? true : term === 'short' ? false : null
  return {
    longTerm: isLong,
    noncoveredSecurity: !basisReported,
    basisReportedToIrs: basisReported,
  }
}

// ── RSU detection ────────────────────────────────────────────

function isLikelyRSU(description: string, costBasis: number | null): boolean {
  const lower = description.toLowerCase()
  if (lower.includes('rsu')) return true
  // $0 basis on a stock sale is a strong RSU signal
  if (costBasis === 0 && !lower.includes('option') && !lower.includes('call') && !lower.includes('put')) {
    return true
  }
  return false
}

// ── Main parser ──────────────────────────────────────────────

export class RobinhoodParser implements BrokerParser {
  readonly brokerName = 'Robinhood'

  parse(csv: string): ParseResult {
    const transactions: Form1099B[] = []
    const warnings: string[] = []
    const errors: string[] = []
    let total = 0
    let parsed = 0
    let skipped = 0

    const rows = parseCSV(csv)
    if (rows.length === 0) {
      return { transactions, warnings, errors, rowCounts: { total: 0, parsed: 0, skipped: 0 } }
    }

    // First row is headers
    const headers = rows[0]
    const { map, missing } = mapHeaders(headers)

    if (missing.length > 0) {
      errors.push(`Missing required columns: ${missing.join(', ')}`)
      return { transactions, warnings, errors, rowCounts: { total: 0, parsed: 0, skipped: 0 } }
    }

    // Parse data rows
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      total++

      const description = getField(row, map.description)

      // Skip summary/total rows and empty rows
      if (isSummaryRow(description)) {
        skipped++
        continue
      }

      // Parse fields
      const proceeds = parseCurrency(getField(row, map.proceeds))
      const costBasis = parseCurrency(getField(row, map.costBasis))
      const washSale = parseCurrency(getField(row, map.washSale))
      const gainLoss = parseCurrency(getField(row, map.gainLoss))
      const dateAcquired = parseDate(getField(row, map.dateAcquired))
      const dateSold = parseDate(getField(row, map.dateSold))
      const term = parseTerm(getField(row, map.term))
      const boxField = getField(row, map.box)
      const cusip = getField(row, map.cusip) || undefined

      // Validate required fields
      if (dateSold === null) {
        errors.push(`Row ${r + 1}: missing or invalid date sold`)
        skipped++
        continue
      }

      if (proceeds === null) {
        errors.push(`Row ${r + 1}: missing or invalid proceeds for "${description}"`)
        skipped++
        continue
      }

      // Determine category
      const hasBasis = costBasis !== null
      const { longTerm, noncoveredSecurity, basisReportedToIrs } =
        parseCategory(boxField, term, hasBasis)

      // Compute gain/loss if not provided
      const effectiveCostBasis = costBasis ?? 0
      const effectiveGainLoss = gainLoss ?? (proceeds - effectiveCostBasis - (washSale ?? 0))

      const txn: Form1099B = {
        id: `rh-${r}`,
        brokerName: 'Robinhood Securities LLC',
        brokerTin: undefined,
        description,
        cusip,
        dateAcquired: dateAcquired,
        dateSold,
        proceeds,
        costBasis: costBasis,
        washSaleLossDisallowed: washSale ?? 0,
        gainLoss: effectiveGainLoss,
        basisReportedToIrs,
        longTerm,
        noncoveredSecurity,
        federalTaxWithheld: 0,
      }

      // RSU warning
      if (isLikelyRSU(description, costBasis)) {
        warnings.push(
          `Row ${r + 1}: "${description}" may be an RSU sale (cost basis ${costBasis === 0 ? 'is $0' : 'check needed'}). ` +
          `Verify basis matches FMV at vest date to avoid double taxation.`
        )
      }

      transactions.push(txn)
      parsed++
    }

    return {
      transactions,
      warnings,
      errors,
      rowCounts: { total, parsed, skipped },
    }
  }
}
