/**
 * Vermont Form IN-111 — Individual Income Tax Return (TY 2025)
 *
 * Computes VT state income tax for full-year residents, part-year
 * residents, and nonresidents.
 *
 * IMPORTANT: Vermont starts from federal TAXABLE income (Form 1040
 * Line 15), NOT federal AGI. There is no state standard deduction or
 * personal exemption because those are already embedded in the federal
 * taxable income figure.
 *
 * Reference: VT Form IN-111 Instructions, 32 V.S.A. 5822 et seq.
 *
 * Key features:
 *   - 4-bracket graduated tax (3.35%, 6.60%, 7.60%, 8.75%)
 *   - Starts from federal taxable income (Form 1040 Line 15)
 *   - No state standard deduction or personal exemption
 *   - VT EITC: 38% of federal EITC (refundable)
 *   - Child/dependent care credit: 24% of federal credit (nonrefundable)
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import {
  VT_TAX_BRACKETS,
  VT_EITC_RATE,
  VT_DEPENDENT_CARE_CREDIT_RATE,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface FormIN111Result {
  // Income
  federalTaxableIncome: number
  vtAdditions: number
  vtSubtractions: number
  vtTaxableIncome: number

  // Subtraction detail
  usGovInterest: number

  // Tax
  vtTax: number

  // Credits
  dependentCareCredit: number
  vtEITC: number
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
  vtSourceIncome?: number
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

export function computeFormIN111(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormIN111Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  // VT starts from federal TAXABLE income (Form 1040 Line 15)
  const federalTaxableIncome = form1040.line15.amount

  // ── VT Additions ─────────────────────────────────────────────
  const vtAdditions = 0

  // ── VT Subtractions ──────────────────────────────────────────
  // US government obligation interest
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const vtSubtractions = usGovInterest
  const vtTaxableIncome = Math.max(0, federalTaxableIncome + vtAdditions - vtSubtractions)

  // ── Tax computation ──────────────────────────────────────────
  const brackets = VT_TAX_BRACKETS[filingStatus]
  const fullYearTax = computeBracketTax(vtTaxableIncome, brackets)
  const vtTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ──────────────────────────────────────────────────

  // Child and dependent care credit: 24% of federal credit (nonrefundable)
  const federalDependentCareCredit = form1040.dependentCareCredit?.creditAmount ?? 0
  const dependentCareCredit = Math.round(federalDependentCareCredit * VT_DEPENDENT_CARE_CREDIT_RATE)

  // Nonrefundable credits limited to tax
  const totalNonrefundableCredits = Math.min(vtTax, dependentCareCredit)
  const taxAfterNonrefundable = Math.max(0, vtTax - totalNonrefundableCredits)

  // VT EITC: 38% of federal EITC (refundable)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const vtEITC = Math.round(federalEITC * VT_EITC_RATE)

  const totalRefundableCredits = vtEITC
  const taxAfterCredits = taxAfterNonrefundable

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'VT' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + totalRefundableCredits

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const vtSourceIncome = ratio < 1.0
    ? Math.round(vtTaxableIncome * ratio)
    : undefined

  return {
    federalTaxableIncome,
    vtAdditions,
    vtSubtractions,
    vtTaxableIncome,
    usGovInterest,
    vtTax,
    dependentCareCredit,
    vtEITC,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    vtSourceIncome,
  }
}
