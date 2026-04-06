/**
 * New Mexico Form PIT-1 — Personal Income Tax Return (TY 2025)
 *
 * Starts from federal AGI and applies NM-specific subtractions,
 * deductions, exemptions, and credits.
 *
 * Key features:
 *   - 4-bracket graduated tax (1.7%, 3.2%, 4.7%, 4.9%)
 *   - Different thresholds per filing status
 *   - Federal standard deduction (NM conforms)
 *   - Personal exemption: $4,150/person
 *   - 25% refundable EITC
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import {
  NM_TAX_BRACKETS,
  NM_STANDARD_DEDUCTION,
  NM_PERSONAL_EXEMPTION,
  NM_EITC_RATE,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface FormPIT1Result {
  federalAGI: number
  nmSubtractions: number
  nmAGI: number
  nmStandardDeduction: number
  personalExemptions: number
  numExemptions: number
  nmTaxableIncome: number
  nmTax: number
  nmEITC: number
  taxAfterCredits: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  nmSourceIncome?: number
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

export function computeFormPIT1(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormPIT1Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  const federalAGI = form1040.line11.amount

  // ── NM Subtractions ──────────────────────────────────────────
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )
  const nmSubtractions = usGovInterest
  const nmAGI = federalAGI - nmSubtractions

  // ── NM Standard Deduction ────────────────────────────────────
  const nmStandardDeduction = NM_STANDARD_DEDUCTION[filingStatus]

  // ── Personal Exemptions ──────────────────────────────────────
  let numExemptions = 1
  if (filingStatus === 'mfj' || filingStatus === 'qw') {
    numExemptions += 1
  }
  numExemptions += model.dependents.length
  const personalExemptions = numExemptions * NM_PERSONAL_EXEMPTION

  // ── Taxable Income ───────────────────────────────────────────
  const nmTaxableIncome = Math.max(0, nmAGI - nmStandardDeduction - personalExemptions)

  // ── Tax computation ──────────────────────────────────────────
  const brackets = NM_TAX_BRACKETS[filingStatus]
  const fullYearTax = computeBracketTax(nmTaxableIncome, brackets)
  const nmTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ──────────────────────────────────────────────────
  // NM EITC: 25% of federal EITC (refundable)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const nmEITC = Math.round(federalEITC * NM_EITC_RATE)

  const taxAfterCredits = Math.max(0, nmTax - nmEITC)

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'NM' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const excessRefundable = Math.max(0, nmEITC - nmTax)
  const totalPayments = stateWithholding + excessRefundable

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const nmSourceIncome = ratio < 1.0
    ? Math.round(nmAGI * ratio)
    : undefined

  return {
    federalAGI,
    nmSubtractions,
    nmAGI,
    nmStandardDeduction,
    personalExemptions,
    numExemptions,
    nmTaxableIncome,
    nmTax,
    nmEITC,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    nmSourceIncome,
  }
}
