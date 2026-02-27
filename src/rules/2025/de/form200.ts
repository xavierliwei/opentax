/**
 * Delaware Form 200-01 — Individual Income Tax Return (TY 2025)
 *
 * Computes DE state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * DE-specific subtractions, deductions, and credits.
 *
 * Reference: DE Form 200-01 Instructions, 30 Del. C. § 1101 et seq.
 *
 * Key features:
 *   - 7-bracket graduated tax (0%, 2.2%, 3.9%, 4.8%, 5.2%, 5.55%, 6.6%)
 *   - Same brackets for all filing statuses
 *   - DE standard deduction ($3,250 single, $6,500 MFJ)
 *   - Personal credit: $110/person (nonrefundable)
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import {
  DE_TAX_BRACKETS,
  DE_STANDARD_DEDUCTION,
  DE_PERSONAL_CREDIT,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface Form200Result {
  federalAGI: number
  deSubtractions: number
  deAGI: number
  deStandardDeduction: number
  deTaxableIncome: number
  deTax: number
  personalCredit: number
  numExemptions: number
  taxAfterCredits: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  deSourceIncome?: number
}

// ── Bracket tax computation ─────────────────────────────────────

function computeBracketTax(
  taxableIncome: number,
  brackets: { limit: number; rate: number }[],
): number {
  let remaining = taxableIncome
  let tax = 0
  let prevLimit = 0
  for (const bracket of brackets) {
    const width = bracket.limit === Infinity
      ? remaining
      : Math.min(remaining, bracket.limit - prevLimit)
    if (width <= 0) break
    tax += width * bracket.rate
    remaining -= width
    prevLimit = bracket.limit
  }
  return Math.round(tax)
}

// ── Main computation ────────────────────────────────────────────

export function computeForm200(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form200Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  const federalAGI = form1040.line11.amount

  // ── DE Subtractions ──────────────────────────────────────────
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )
  const deSubtractions = usGovInterest
  const deAGI = federalAGI - deSubtractions

  // ── DE Standard Deduction ────────────────────────────────────
  const deStandardDeduction = DE_STANDARD_DEDUCTION[filingStatus]

  // ── Taxable Income ───────────────────────────────────────────
  const deTaxableIncome = Math.max(0, deAGI - deStandardDeduction)

  // ── Tax computation ──────────────────────────────────────────
  const brackets = DE_TAX_BRACKETS[filingStatus]
  const fullYearTax = computeBracketTax(deTaxableIncome, brackets)
  const deTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ──────────────────────────────────────────────────
  // Personal credit: $110 per person (nonrefundable)
  let numExemptions = 1
  if (filingStatus === 'mfj' || filingStatus === 'qw') {
    numExemptions += 1
  }
  numExemptions += model.dependents.length
  const personalCredit = Math.min(deTax, numExemptions * DE_PERSONAL_CREDIT)

  const taxAfterCredits = Math.max(0, deTax - personalCredit)

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'DE' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const deSourceIncome = ratio < 1.0
    ? Math.round(deAGI * ratio)
    : undefined

  return {
    federalAGI,
    deSubtractions,
    deAGI,
    deStandardDeduction,
    deTaxableIncome,
    deTax,
    personalCredit,
    numExemptions,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    deSourceIncome,
  }
}
