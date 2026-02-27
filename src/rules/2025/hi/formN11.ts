/**
 * Hawaii Form N-11 — Individual Income Tax Return (Resident) (TY 2025)
 *
 * Computes HI state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * HI-specific adjustments, deductions, exemptions, and credits.
 *
 * Reference: HI Form N-11 Instructions, HRS Chapter 235
 *
 * Key features:
 *   - 12-bracket graduated tax (1.4% to 11%) — most brackets of any state
 *   - HI standard deduction (lower than federal)
 *   - Personal exemption: $1,144/person
 *   - HI EITC: 20% of federal EITC (nonrefundable)
 *   - Food/excise tax credit: $110/person (income-limited)
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import {
  HI_TAX_BRACKETS,
  HI_STANDARD_DEDUCTION,
  HI_PERSONAL_EXEMPTION,
  HI_EITC_RATE,
  HI_FOOD_EXCISE_CREDIT_PER_EXEMPTION,
  HI_FOOD_EXCISE_CREDIT_AGI_LIMIT,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface FormN11Result {
  // Income
  federalAGI: number
  hiAdditions: number
  hiSubtractions: number
  hiAGI: number

  // Subtraction detail
  usGovInterest: number

  // Deductions & exemptions
  hiStandardDeduction: number
  personalExemptions: number
  numExemptions: number
  hiTaxableIncome: number

  // Tax
  hiTax: number

  // Credits
  hiEITC: number
  foodExciseTaxCredit: number
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
  hiSourceIncome?: number
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

export function computeFormN11(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormN11Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  const federalAGI = form1040.line11.amount

  // ── HI Additions ─────────────────────────────────────────────
  const hiAdditions = 0

  // ── HI Subtractions ──────────────────────────────────────────
  // US government obligation interest
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const hiSubtractions = usGovInterest
  const hiAGI = federalAGI + hiAdditions - hiSubtractions

  // ── HI Standard Deduction ──────────────────────────────────────
  const hiStandardDeduction = HI_STANDARD_DEDUCTION[filingStatus]

  // ── Personal Exemptions ──────────────────────────────────────
  let numExemptions = 1 // taxpayer
  if (filingStatus === 'mfj' || filingStatus === 'qw') {
    numExemptions += 1 // spouse
  }
  numExemptions += model.dependents.length
  const personalExemptions = numExemptions * HI_PERSONAL_EXEMPTION

  // ── Taxable Income ───────────────────────────────────────────
  const hiTaxableIncome = Math.max(0, hiAGI - hiStandardDeduction - personalExemptions)

  // ── Tax computation ──────────────────────────────────────────
  const brackets = HI_TAX_BRACKETS[filingStatus]
  const fullYearTax = computeBracketTax(hiTaxableIncome, brackets)
  const hiTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ──────────────────────────────────────────────────

  // HI EITC: 20% of federal EITC (nonrefundable)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const hiEITC = Math.round(federalEITC * HI_EITC_RATE)

  // Food/excise tax credit: $110 per exemption, income-limited
  const foodExciseTaxCredit = federalAGI <= HI_FOOD_EXCISE_CREDIT_AGI_LIMIT[filingStatus]
    ? numExemptions * HI_FOOD_EXCISE_CREDIT_PER_EXEMPTION
    : 0

  // All nonrefundable credits limited to tax
  const totalNonrefundableCredits = Math.min(hiTax, hiEITC + foodExciseTaxCredit)
  const taxAfterCredits = Math.max(0, hiTax - totalNonrefundableCredits)

  const totalRefundableCredits = 0

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'HI' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + totalRefundableCredits

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const hiSourceIncome = ratio < 1.0
    ? Math.round(hiAGI * ratio)
    : undefined

  return {
    federalAGI,
    hiAdditions,
    hiSubtractions,
    hiAGI,
    usGovInterest,
    hiStandardDeduction,
    personalExemptions,
    numExemptions,
    hiTaxableIncome,
    hiTax,
    hiEITC,
    foodExciseTaxCredit,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    hiSourceIncome,
  }
}
