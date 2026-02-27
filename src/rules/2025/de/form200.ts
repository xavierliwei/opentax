/**
 * Delaware Form 200-01 — Individual Income Tax Return (TY 2025)
 *
 * Computes DE state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * DE-specific additions, subtractions, deductions, and credits.
 *
 * Reference: DE Form 200-01 Instructions, 30 Del. C. § 1102 et seq.
 *
 * Key features:
 *   - 7-bracket graduated tax (0%, 2.2%, 3.9%, 4.8%, 5.2%, 5.55%, 6.6%)
 *   - Same brackets for ALL filing statuses
 *   - DE standard deduction ($3,250 single / $6,500 MFJ)
 *   - Personal credit: $110/person (nonrefundable)
 *   - No state EITC
 *   - US gov interest subtraction
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
  // Income
  federalAGI: number
  deAdditions: number
  deSubtractions: number
  deAGI: number

  // Subtraction detail
  usGovInterest: number

  // Deductions
  deStandardDeduction: number
  deTaxableIncome: number

  // Tax
  deTax: number

  // Credits
  personalCredit: number
  numExemptions: number
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

  // ── DE Additions ─────────────────────────────────────────────
  // Common additions:
  //   - Non-DE municipal bond interest (tax-exempt interest from other states)
  //   - State/local tax refund adjustments
  // For initial implementation, we handle additions as 0 since bond interest
  // from other states is not separately tracked in the current model.
  const deAdditions = 0

  // ── DE Subtractions ──────────────────────────────────────────
  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const deSubtractions = usGovInterest
  const deAGI = federalAGI + deAdditions - deSubtractions

  // ── DE Standard Deduction ────────────────────────────────────
  // Delaware uses its own standard deduction amounts.
  // Itemized deductions follow federal but are optional; we use standard deduction.
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

  // Personal credit: $110 per person (taxpayer + spouse if MFJ + dependents)
  let numExemptions = 1 // taxpayer
  if (filingStatus === 'mfj' || filingStatus === 'qw') {
    numExemptions += 1 // spouse
  }
  numExemptions += model.dependents.length
  const personalCredit = numExemptions * DE_PERSONAL_CREDIT

  // Nonrefundable credits limited to tax
  const totalNonrefundableCredits = Math.min(deTax, personalCredit)
  const taxAfterCredits = Math.max(0, deTax - totalNonrefundableCredits)

  // No refundable credits (no EITC, no food sales tax credit)
  const totalRefundableCredits = 0

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'DE' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  // Refundable credits are treated like additional payments
  const totalPayments = stateWithholding + totalRefundableCredits

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const deSourceIncome = ratio < 1.0
    ? Math.round(deAGI * ratio)
    : undefined

  return {
    federalAGI,
    deAdditions,
    deSubtractions,
    deAGI,
    usGovInterest,
    deStandardDeduction,
    deTaxableIncome,
    deTax,
    personalCredit,
    numExemptions,
    totalNonrefundableCredits,
    totalRefundableCredits,
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
