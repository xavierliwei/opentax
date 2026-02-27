/**
 * Rhode Island Form RI-1040 — Resident Income Tax Return (TY 2025)
 *
 * Computes RI state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * RI-specific adjustments, deductions, exemptions, and credits.
 *
 * Reference: RI Form RI-1040 Instructions, R.I. Gen. Laws § 44-30
 *
 * Key features:
 *   - 3-bracket graduated tax (3.75%, 4.75%, 5.99%)
 *   - Uses federal standard deduction amounts
 *   - Personal exemption: $4,700/person (deduction, not credit)
 *   - RI EITC: 15% of federal EITC (refundable)
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import {
  RI_TAX_BRACKETS,
  RI_STANDARD_DEDUCTION,
  RI_PERSONAL_EXEMPTION,
  RI_EITC_RATE,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface FormRI1040Result {
  // Income
  federalAGI: number
  riAdditions: number
  riSubtractions: number
  riAGI: number

  // Subtraction detail
  usGovInterest: number

  // Deductions & exemptions
  riStandardDeduction: number
  personalExemptions: number
  numExemptions: number
  riTaxableIncome: number

  // Tax
  riTax: number

  // Credits
  riEITC: number
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
  riSourceIncome?: number
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

export function computeFormRI1040(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormRI1040Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  const federalAGI = form1040.line11.amount

  // ── RI Additions ─────────────────────────────────────────────
  // No additions modeled in initial implementation
  const riAdditions = 0

  // ── RI Subtractions ──────────────────────────────────────────
  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const riSubtractions = usGovInterest
  const riAGI = federalAGI + riAdditions - riSubtractions

  // ── RI Standard Deduction ──────────────────────────────────────
  // RI follows federal standard deduction amounts
  const riStandardDeduction = RI_STANDARD_DEDUCTION[filingStatus]

  // ── Personal Exemptions ──────────────────────────────────────
  // $4,700 per person (taxpayer, spouse, dependents)
  // This is a deduction, not a credit
  let numExemptions = 1 // taxpayer
  if (filingStatus === 'mfj' || filingStatus === 'qw') {
    numExemptions += 1 // spouse
  }
  numExemptions += model.dependents.length
  const personalExemptions = numExemptions * RI_PERSONAL_EXEMPTION

  // ── Taxable Income ───────────────────────────────────────────
  const riTaxableIncome = Math.max(0, riAGI - riStandardDeduction - personalExemptions)

  // ── Tax computation ──────────────────────────────────────────
  // RI uses the same brackets for all filing statuses
  const brackets = RI_TAX_BRACKETS[filingStatus]
  const fullYearTax = computeBracketTax(riTaxableIncome, brackets)
  const riTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ──────────────────────────────────────────────────

  // Nonrefundable credits: none modeled initially
  const totalNonrefundableCredits = 0
  const taxAfterCredits = Math.max(0, riTax - totalNonrefundableCredits)

  // RI EITC: 15% of federal EITC (refundable)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const riEITC = Math.round(federalEITC * RI_EITC_RATE)

  const totalRefundableCredits = riEITC

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'RI' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + totalRefundableCredits

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const riSourceIncome = ratio < 1.0
    ? Math.round(riAGI * ratio)
    : undefined

  return {
    federalAGI,
    riAdditions,
    riSubtractions,
    riAGI,
    usGovInterest,
    riStandardDeduction,
    personalExemptions,
    numExemptions,
    riTaxableIncome,
    riTax,
    riEITC,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    riSourceIncome,
  }
}
