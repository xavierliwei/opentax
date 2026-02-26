/**
 * Kansas Form K-40 — Individual Income Tax Return (TY 2025)
 *
 * Computes KS state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * KS-specific additions, subtractions, deductions, exemptions, and credits.
 *
 * Reference: KS K-40 Instructions, K.S.A. 79-32,110 et seq.
 *
 * Key features:
 *   - 3-bracket graduated tax (3.1%, 5.25%, 5.7%)
 *   - KS standard deduction (lower than federal)
 *   - Personal exemption: $2,250/person
 *   - Social Security exemption for AGI <= $75,000
 *   - Food sales tax credit: $125/person (refundable, income-limited)
 *   - Child/dependent care credit: 25% of federal credit
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import {
  KS_TAX_BRACKETS,
  KS_STANDARD_DEDUCTION,
  KS_PERSONAL_EXEMPTION,
  KS_SS_EXEMPTION_AGI_LIMIT,
  KS_FOOD_SALES_TAX_CREDIT_PER_PERSON,
  KS_FOOD_SALES_TAX_CREDIT_INCOME_LIMIT,
  KS_DEPENDENT_CARE_CREDIT_RATE,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface FormK40Result {
  // Income
  federalAGI: number
  ksAdditions: number
  ksSubtractions: number
  ksAGI: number

  // Subtraction detail
  ssExemption: number
  usGovInterest: number

  // Deductions & exemptions
  ksStandardDeduction: number
  personalExemptions: number
  numExemptions: number
  ksTaxableIncome: number

  // Tax
  ksTax: number

  // Credits
  foodSalesTaxCredit: number
  dependentCareCredit: number
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
  ksSourceIncome?: number
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

export function computeFormK40(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormK40Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  const federalAGI = form1040.line11.amount

  // ── KS Additions ─────────────────────────────────────────────
  // Common additions:
  //   - Non-KS municipal bond interest (tax-exempt interest from other states)
  //   - State/local tax refund included in federal AGI (already there)
  // For initial implementation, we handle additions as 0 since bond interest
  // from other states is not separately tracked in the current model.
  const ksAdditions = 0

  // ── KS Subtractions ──────────────────────────────────────────
  // Social Security exemption: KS exempts SS benefits when federal AGI <= $75,000
  const ssBenefits = form1040.line6b.amount
  const ssExemption = federalAGI <= KS_SS_EXEMPTION_AGI_LIMIT ? ssBenefits : 0

  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const ksSubtractions = ssExemption + usGovInterest
  const ksAGI = federalAGI + ksAdditions - ksSubtractions

  // ── KS Standard Deduction ────────────────────────────────────
  // Kansas uses its own standard deduction amounts (lower than federal).
  // KS does not have its own itemized deduction computation — if you itemize
  // on the federal return, you use the KS standard deduction on K-40.
  const ksStandardDeduction = KS_STANDARD_DEDUCTION[filingStatus]

  // ── Personal Exemptions ──────────────────────────────────────
  // $2,250 per person: taxpayer + spouse (if MFJ) + dependents
  let numExemptions = 1 // taxpayer
  if (filingStatus === 'mfj' || filingStatus === 'qw') {
    numExemptions += 1 // spouse
  }
  numExemptions += model.dependents.length
  const personalExemptions = numExemptions * KS_PERSONAL_EXEMPTION

  // ── Taxable Income ───────────────────────────────────────────
  const ksTaxableIncome = Math.max(0, ksAGI - ksStandardDeduction - personalExemptions)

  // ── Tax computation ──────────────────────────────────────────
  const brackets = KS_TAX_BRACKETS[filingStatus]
  const fullYearTax = computeBracketTax(ksTaxableIncome, brackets)
  const ksTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ──────────────────────────────────────────────────

  // Child and dependent care credit: 25% of federal credit (nonrefundable)
  const federalDependentCareCredit = form1040.dependentCareCredit?.creditAmount ?? 0
  const dependentCareCredit = Math.round(federalDependentCareCredit * KS_DEPENDENT_CARE_CREDIT_RATE)

  // Nonrefundable credits limited to tax
  const totalNonrefundableCredits = Math.min(ksTax, dependentCareCredit)
  const taxAfterNonrefundable = Math.max(0, ksTax - totalNonrefundableCredits)

  // Food sales tax credit: $125 per person, refundable, income-limited at $30,615
  // "Income" for this credit uses federal AGI
  const foodSalesTaxCredit = federalAGI <= KS_FOOD_SALES_TAX_CREDIT_INCOME_LIMIT
    ? numExemptions * KS_FOOD_SALES_TAX_CREDIT_PER_PERSON
    : 0

  const totalRefundableCredits = foodSalesTaxCredit
  const taxAfterCredits = taxAfterNonrefundable

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'KS' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  // Refundable credits are treated like additional payments
  const totalPayments = stateWithholding + totalRefundableCredits

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const ksSourceIncome = ratio < 1.0
    ? Math.round(ksAGI * ratio)
    : undefined

  return {
    federalAGI,
    ksAdditions,
    ksSubtractions,
    ksAGI,
    ssExemption,
    usGovInterest,
    ksStandardDeduction,
    personalExemptions,
    numExemptions,
    ksTaxableIncome,
    ksTax,
    foodSalesTaxCredit,
    dependentCareCredit,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    ksSourceIncome,
  }
}
