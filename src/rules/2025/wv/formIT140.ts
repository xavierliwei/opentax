/**
 * West Virginia Form IT-140 — Individual Income Tax Return (TY 2025)
 *
 * Computes WV state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * WV-specific adjustments, deductions, exemptions, and credits.
 *
 * Reference: WV Form IT-140 Instructions, W. Va. Code 11-21-1 et seq.
 *
 * Key features:
 *   - 3-bracket graduated tax (2.36%, 3.15%, 5.12%) — same for all filing statuses
 *   - Uses federal-equivalent standard deduction
 *   - Personal exemption: $2,000/person
 *   - Full Social Security exemption
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import {
  WV_TAX_BRACKETS,
  WV_STANDARD_DEDUCTION,
  WV_PERSONAL_EXEMPTION,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface FormIT140Result {
  // Income
  federalAGI: number
  wvAdditions: number
  wvSubtractions: number
  wvAGI: number

  // Subtraction detail
  ssExemption: number
  usGovInterest: number

  // Deductions & exemptions
  wvStandardDeduction: number
  personalExemptions: number
  numExemptions: number
  wvTaxableIncome: number

  // Tax
  wvTax: number

  // Credits
  totalNonrefundableCredits: number
  totalRefundableCredits: number

  // Result
  taxAfterCredits: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number

  // Residency
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  wvSourceIncome?: number
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

export function computeFormIT140(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormIT140Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  const federalAGI = form1040.line11.amount

  // ── WV Additions ─────────────────────────────────────────────
  const wvAdditions = 0

  // ── WV Subtractions ──────────────────────────────────────────
  // Full Social Security exemption
  const ssBenefits = form1040.line6b.amount
  const ssExemption = ssBenefits

  // US government obligation interest
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const wvSubtractions = ssExemption + usGovInterest
  const wvAGI = federalAGI + wvAdditions - wvSubtractions

  // ── WV Standard Deduction ──────────────────────────────────────
  const wvStandardDeduction = WV_STANDARD_DEDUCTION[filingStatus]

  // ── Personal Exemptions ──────────────────────────────────────
  let numExemptions = 1 // taxpayer
  if (filingStatus === 'mfj' || filingStatus === 'qw') {
    numExemptions += 1 // spouse
  }
  numExemptions += model.dependents.length
  const personalExemptions = numExemptions * WV_PERSONAL_EXEMPTION

  // ── Taxable Income ───────────────────────────────────────────
  const wvTaxableIncome = Math.max(0, wvAGI - wvStandardDeduction - personalExemptions)

  // ── Tax computation ──────────────────────────────────────────
  const brackets = WV_TAX_BRACKETS[filingStatus]
  const fullYearTax = computeBracketTax(wvTaxableIncome, brackets)
  const wvTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ──────────────────────────────────────────────────
  const totalNonrefundableCredits = 0
  const totalRefundableCredits = 0
  const taxAfterCredits = Math.max(0, wvTax - totalNonrefundableCredits)

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'WV' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + totalRefundableCredits

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const wvSourceIncome = ratio < 1.0
    ? Math.round(wvAGI * ratio)
    : undefined

  return {
    federalAGI,
    wvAdditions,
    wvSubtractions,
    wvAGI,
    ssExemption,
    usGovInterest,
    wvStandardDeduction,
    personalExemptions,
    numExemptions,
    wvTaxableIncome,
    wvTax,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    wvSourceIncome,
  }
}
