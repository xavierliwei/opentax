/**
 * Maine Form 1040ME — Individual Income Tax Return (TY 2025)
 *
 * Computes ME state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * ME-specific adjustments, deductions, exemptions, and credits.
 *
 * Reference: ME Form 1040ME Instructions, 36 M.R.S. 5111 et seq.
 *
 * Key features:
 *   - 3-bracket graduated tax (5.8%, 6.75%, 7.15%)
 *   - Uses federal standard deduction
 *   - Personal exemption: $5,000/person
 *   - ME EITC: 25% of federal EITC (refundable)
 *   - Child/dependent care credit: 25% of federal credit
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import {
  ME_TAX_BRACKETS,
  ME_STANDARD_DEDUCTION,
  ME_PERSONAL_EXEMPTION,
  ME_EITC_RATE,
  ME_DEPENDENT_CARE_CREDIT_RATE,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface Form1040MEResult {
  // Income
  federalAGI: number
  meAdditions: number
  meSubtractions: number
  meAGI: number

  // Subtraction detail
  usGovInterest: number

  // Deductions & exemptions
  meStandardDeduction: number
  personalExemptions: number
  numExemptions: number
  meTaxableIncome: number

  // Tax
  meTax: number

  // Credits
  dependentCareCredit: number
  meEITC: number
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
  meSourceIncome?: number
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

export function computeForm1040ME(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form1040MEResult {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  const federalAGI = form1040.line11.amount

  // ── ME Additions ─────────────────────────────────────────────
  const meAdditions = 0

  // ── ME Subtractions ──────────────────────────────────────────
  // US government obligation interest
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const meSubtractions = usGovInterest
  const meAGI = federalAGI + meAdditions - meSubtractions

  // ── ME Standard Deduction ──────────────────────────────────────
  const meStandardDeduction = ME_STANDARD_DEDUCTION[filingStatus]

  // ── Personal Exemptions ──────────────────────────────────────
  let numExemptions = 1 // taxpayer
  if (filingStatus === 'mfj' || filingStatus === 'qw') {
    numExemptions += 1 // spouse
  }
  numExemptions += model.dependents.length
  const personalExemptions = numExemptions * ME_PERSONAL_EXEMPTION

  // ── Taxable Income ───────────────────────────────────────────
  const meTaxableIncome = Math.max(0, meAGI - meStandardDeduction - personalExemptions)

  // ── Tax computation ──────────────────────────────────────────
  const brackets = ME_TAX_BRACKETS[filingStatus]
  const fullYearTax = computeBracketTax(meTaxableIncome, brackets)
  const meTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ──────────────────────────────────────────────────

  // Child and dependent care credit: 25% of federal credit (nonrefundable)
  const federalDependentCareCredit = form1040.dependentCareCredit?.creditAmount ?? 0
  const dependentCareCredit = Math.round(federalDependentCareCredit * ME_DEPENDENT_CARE_CREDIT_RATE)

  // Nonrefundable credits limited to tax
  const totalNonrefundableCredits = Math.min(meTax, dependentCareCredit)
  const taxAfterNonrefundable = Math.max(0, meTax - totalNonrefundableCredits)

  // ME EITC: 25% of federal EITC (refundable)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const meEITC = Math.round(federalEITC * ME_EITC_RATE)

  const totalRefundableCredits = meEITC
  const taxAfterCredits = taxAfterNonrefundable

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'ME' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + totalRefundableCredits

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const meSourceIncome = ratio < 1.0
    ? Math.round(meAGI * ratio)
    : undefined

  return {
    federalAGI,
    meAdditions,
    meSubtractions,
    meAGI,
    usGovInterest,
    meStandardDeduction,
    personalExemptions,
    numExemptions,
    meTaxableIncome,
    meTax,
    dependentCareCredit,
    meEITC,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    meSourceIncome,
  }
}
