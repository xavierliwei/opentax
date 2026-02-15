/**
 * Tax Computation — bracket math and QDCG worksheet
 *
 * Contains the core tax calculation functions:
 * - Ordinary income tax via progressive brackets
 * - Qualified Dividends and Capital Gain Tax Worksheet
 *   (preferential 0%/15%/20% rates for LTCG and qualified dividends)
 *
 * Source: 2025 Form 1040 instructions, "Qualified Dividends and
 * Capital Gain Tax Worksheet — Line 16"
 */

import type { FilingStatus } from '../../model/types'
import type { TaxBracket } from './constants'
import { INCOME_TAX_BRACKETS, LTCG_BRACKETS } from './constants'

// ── Ordinary bracket computation ────────────────────────────────

/**
 * Compute tax using progressive tax brackets.
 *
 * @param taxableIncome - amount in cents (must be ≥ 0)
 * @param brackets - ordered bracket array (ascending by floor)
 * @returns tax in cents (rounded to nearest cent)
 */
export function computeBracketTax(taxableIncome: number, brackets: TaxBracket[]): number {
  if (taxableIncome <= 0) return 0

  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const floor = brackets[i].floor
    const ceiling = i + 1 < brackets.length ? brackets[i + 1].floor : Infinity
    if (taxableIncome <= floor) break
    const taxableInBracket = Math.min(taxableIncome, ceiling) - floor
    tax += taxableInBracket * brackets[i].rate
  }

  return Math.round(tax)
}

/**
 * Compute ordinary income tax for a filing status.
 */
export function computeOrdinaryTax(taxableIncome: number, filingStatus: FilingStatus): number {
  return computeBracketTax(taxableIncome, INCOME_TAX_BRACKETS[filingStatus])
}

// ── QDCG worksheet ──────────────────────────────────────────────

/**
 * Determine the net capital gain amount for the QDCG worksheet.
 *
 * Per IRS instructions: "Enter the smaller of Schedule D, line 15,
 * or Schedule D, line 16. If either line is zero or a loss, enter -0-."
 *
 * @param scheduleDLine15 - net long-term capital gain/(loss) in cents
 * @param scheduleDLine16 - combined net capital gain/(loss) in cents
 * @returns amount for QDCG worksheet Line 3 (cents, ≥ 0)
 */
export function netCapGainForQDCG(scheduleDLine15: number, scheduleDLine16: number): number {
  if (scheduleDLine15 <= 0 || scheduleDLine16 <= 0) return 0
  return Math.min(scheduleDLine15, scheduleDLine16)
}

/**
 * Qualified Dividends and Capital Gain Tax Worksheet.
 *
 * Applies preferential rates (0%, 15%, 20%) to qualified dividends
 * and net capital gains. The preferential income "stacks" above
 * ordinary income in the rate brackets.
 *
 * @param taxableIncome - Form 1040 Line 15 (cents)
 * @param qualifiedDividends - Form 1040 Line 3a (cents)
 * @param netCapGain - from netCapGainForQDCG() (cents, ≥ 0)
 * @param filingStatus
 * @returns tax in cents
 */
export function computeQDCGTax(
  taxableIncome: number,
  qualifiedDividends: number,
  netCapGain: number,
  filingStatus: FilingStatus,
): number {
  if (taxableIncome <= 0) return 0

  // Preferential income = qualified dividends + net cap gain,
  // but cannot exceed taxable income
  const preferentialIncome = Math.min(
    qualifiedDividends + netCapGain,
    taxableIncome,
  )

  if (preferentialIncome <= 0) {
    // No preferential income — use all-ordinary rates
    return computeOrdinaryTax(taxableIncome, filingStatus)
  }

  // Ordinary portion = taxable income minus preferential portion
  const ordinaryIncome = taxableIncome - preferentialIncome

  // Tax on ordinary portion at regular rates
  const ordinaryTax = computeBracketTax(ordinaryIncome, INCOME_TAX_BRACKETS[filingStatus])

  // Tax on preferential portion at LTCG rates.
  // The preferential income sits in the "income stack" from
  // ordinaryIncome to taxableIncome. Apply LTCG rates to each
  // segment that falls within a bracket.
  const ltcgBrackets = LTCG_BRACKETS[filingStatus]
  let prefTax = 0

  for (let i = 0; i < ltcgBrackets.length; i++) {
    const bracketFloor = ltcgBrackets[i].floor
    const bracketCeiling = i + 1 < ltcgBrackets.length
      ? ltcgBrackets[i + 1].floor
      : Infinity
    const rate = ltcgBrackets[i].rate

    // Intersect [bracketFloor, bracketCeiling) with [ordinaryIncome, taxableIncome]
    const segmentBottom = Math.max(bracketFloor, ordinaryIncome)
    const segmentTop = Math.min(bracketCeiling, taxableIncome)

    if (segmentTop > segmentBottom) {
      prefTax += (segmentTop - segmentBottom) * rate
    }
  }

  prefTax = Math.round(prefTax)

  const qdcgTax = ordinaryTax + prefTax

  // Safety check: QDCG result should never exceed all-ordinary tax
  const allOrdinaryTax = computeOrdinaryTax(taxableIncome, filingStatus)

  return Math.min(qdcgTax, allOrdinaryTax)
}
