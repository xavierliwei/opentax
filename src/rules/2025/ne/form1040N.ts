/**
 * Nebraska Form 1040N — Individual Income Tax Return (TY 2025)
 *
 * Computes NE state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * NE-specific additions, subtractions, deductions, and credits.
 *
 * Reference: NE Form 1040N Instructions, Neb. Rev. Stat. 77-2715 et seq.
 *
 * Key features:
 *   - 3-bracket graduated tax (2.46%, 3.51%, 5.84%)
 *   - Uses federal standard/itemized deduction
 *   - Personal exemption credit: $157/person
 *   - Full Social Security exemption (effective 2025)
 *   - NE EITC: 10% of federal EITC (refundable)
 *   - Child/dependent care credit: 25% of federal credit
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import {
  NE_TAX_BRACKETS,
  NE_STANDARD_DEDUCTION,
  NE_PERSONAL_EXEMPTION_CREDIT,
  NE_DEPENDENT_CARE_CREDIT_RATE,
  NE_EITC_RATE,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface Form1040NResult {
  // Income
  federalAGI: number
  neAdditions: number
  neSubtractions: number
  neAGI: number

  // Subtraction detail
  ssExemption: number
  usGovInterest: number

  // Deductions
  neDeduction: number
  neTaxableIncome: number

  // Tax
  neTax: number

  // Credits
  personalExemptionCredit: number
  numExemptions: number
  dependentCareCredit: number
  neEITC: number
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
  neSourceIncome?: number
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

export function computeForm1040N(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form1040NResult {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  const federalAGI = form1040.line11.amount

  // ── NE Additions ─────────────────────────────────────────────
  const neAdditions = 0

  // ── NE Subtractions ──────────────────────────────────────────
  // Full Social Security exemption (effective 2025)
  const ssBenefits = form1040.line6b.amount
  const ssExemption = ssBenefits

  // US government obligation interest
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const neSubtractions = ssExemption + usGovInterest
  const neAGI = federalAGI + neAdditions - neSubtractions

  // ── NE Deduction ────────────────────────────────────────────
  // Nebraska allows the federal standard deduction or NE itemized deductions.
  // For simplicity, use the NE standard deduction amounts (which track federal).
  const neDeduction = NE_STANDARD_DEDUCTION[filingStatus]

  // ── Taxable Income ───────────────────────────────────────────
  const neTaxableIncome = Math.max(0, neAGI - neDeduction)

  // ── Tax computation ──────────────────────────────────────────
  const brackets = NE_TAX_BRACKETS[filingStatus]
  const fullYearTax = computeBracketTax(neTaxableIncome, brackets)
  const neTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ──────────────────────────────────────────────────

  // Personal exemption credit: $157 per exemption
  let numExemptions = 1 // taxpayer
  if (filingStatus === 'mfj' || filingStatus === 'qw') {
    numExemptions += 1 // spouse
  }
  numExemptions += model.dependents.length
  const personalExemptionCredit = numExemptions * NE_PERSONAL_EXEMPTION_CREDIT

  // Child and dependent care credit: 25% of federal credit (nonrefundable)
  const federalDependentCareCredit = form1040.dependentCareCredit?.creditAmount ?? 0
  const dependentCareCredit = Math.round(federalDependentCareCredit * NE_DEPENDENT_CARE_CREDIT_RATE)

  // Nonrefundable credits limited to tax
  const totalNonrefundableCredits = Math.min(neTax, personalExemptionCredit + dependentCareCredit)
  const taxAfterNonrefundable = Math.max(0, neTax - totalNonrefundableCredits)

  // NE EITC: 10% of federal EITC (refundable)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const neEITC = Math.round(federalEITC * NE_EITC_RATE)

  const totalRefundableCredits = neEITC
  const taxAfterCredits = taxAfterNonrefundable

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'NE' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + totalRefundableCredits

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const neSourceIncome = ratio < 1.0
    ? Math.round(neAGI * ratio)
    : undefined

  return {
    federalAGI,
    neAdditions,
    neSubtractions,
    neAGI,
    ssExemption,
    usGovInterest,
    neDeduction,
    neTaxableIncome,
    neTax,
    personalExemptionCredit,
    numExemptions,
    dependentCareCredit,
    neEITC,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    neSourceIncome,
  }
}
