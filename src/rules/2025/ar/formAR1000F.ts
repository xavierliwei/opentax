/**
 * Arkansas Form AR1000F — Full-Year Resident Individual Income Tax Return (TY 2025)
 *
 * Computes AR state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * AR-specific adjustments, deductions, and credits.
 *
 * Reference: AR1000F Instructions, Ark. Code Ann. 26-51-201 et seq.
 *
 * Key features:
 *   - 3-bracket graduated tax (2%, 4%, 4.4%) — same for all filing statuses
 *   - AR standard deduction ($2,340/$4,680)
 *   - Personal tax credit: $29/person
 *   - AR EITC: 20% of federal EITC (nonrefundable)
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import {
  AR_TAX_BRACKETS,
  AR_STANDARD_DEDUCTION,
  AR_PERSONAL_TAX_CREDIT,
  AR_EITC_RATE,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface FormAR1000FResult {
  // Income
  federalAGI: number
  arAdditions: number
  arSubtractions: number
  arAGI: number

  // Subtraction detail
  usGovInterest: number

  // Deductions
  arStandardDeduction: number
  arTaxableIncome: number

  // Tax
  arTax: number

  // Credits
  personalTaxCredit: number
  numExemptions: number
  arEITC: number
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
  arSourceIncome?: number
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

export function computeFormAR1000F(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormAR1000FResult {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  const federalAGI = form1040.line11.amount

  // ── AR Additions ─────────────────────────────────────────────
  const arAdditions = 0

  // ── AR Subtractions ──────────────────────────────────────────
  // US government obligation interest
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const arSubtractions = usGovInterest
  const arAGI = federalAGI + arAdditions - arSubtractions

  // ── AR Standard Deduction ──────────────────────────────────────
  const arStandardDeduction = AR_STANDARD_DEDUCTION[filingStatus]

  // ── Taxable Income ───────────────────────────────────────────
  const arTaxableIncome = Math.max(0, arAGI - arStandardDeduction)

  // ── Tax computation ──────────────────────────────────────────
  const brackets = AR_TAX_BRACKETS[filingStatus]
  const fullYearTax = computeBracketTax(arTaxableIncome, brackets)
  const arTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ──────────────────────────────────────────────────

  // Personal tax credit: $29 per exemption
  let numExemptions = 1 // taxpayer
  if (filingStatus === 'mfj' || filingStatus === 'qw') {
    numExemptions += 1 // spouse
  }
  numExemptions += model.dependents.length
  const personalTaxCredit = numExemptions * AR_PERSONAL_TAX_CREDIT

  // AR EITC: 20% of federal EITC (nonrefundable in AR)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const arEITC = Math.round(federalEITC * AR_EITC_RATE)

  // Nonrefundable credits limited to tax
  const totalNonrefundableCredits = Math.min(arTax, personalTaxCredit + arEITC)
  const taxAfterCredits = Math.max(0, arTax - totalNonrefundableCredits)

  const totalRefundableCredits = 0

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'AR' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + totalRefundableCredits

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const arSourceIncome = ratio < 1.0
    ? Math.round(arAGI * ratio)
    : undefined

  return {
    federalAGI,
    arAdditions,
    arSubtractions,
    arAGI,
    usGovInterest,
    arStandardDeduction,
    arTaxableIncome,
    arTax,
    personalTaxCredit,
    numExemptions,
    arEITC,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    arSourceIncome,
  }
}
