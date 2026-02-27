/**
 * North Dakota Form ND-1 — Individual Income Tax Return (TY 2025)
 *
 * Computes ND state income tax. North Dakota starts from federal TAXABLE
 * income (Form 1040 Line 15), NOT federal AGI. There are no state-level
 * standard deductions or personal exemptions.
 *
 * Reference: ND Form ND-1 Instructions, ND Century Code 57-38-30.3
 *
 * Key features:
 *   - 2-bracket graduated tax (1.95%, 2.50%)
 *   - Same brackets for all filing statuses
 *   - Starts from federal taxable income (line 15)
 *   - No state standard deduction or personal exemption
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import { ND_TAX_BRACKETS } from './constants'

// ── Result types ────────────────────────────────────────────────

export interface FormND1Result {
  federalTaxableIncome: number
  ndSubtractions: number
  ndTaxableIncome: number
  ndTax: number
  taxAfterCredits: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  ndSourceIncome?: number
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

export function computeFormND1(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormND1Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  // ND starts from federal taxable income (line 15)
  const federalTaxableIncome = form1040.line15.amount

  // ── ND Subtractions ──────────────────────────────────────────
  // US government obligation interest
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )
  const ndSubtractions = usGovInterest

  // ── ND Taxable Income ────────────────────────────────────────
  const ndTaxableIncomeBeforeApportion = Math.max(0, federalTaxableIncome - ndSubtractions)
  const ndTaxableIncome = ratio < 1.0
    ? Math.round(ndTaxableIncomeBeforeApportion * ratio)
    : ndTaxableIncomeBeforeApportion

  // ── Tax computation ──────────────────────────────────────────
  const brackets = ND_TAX_BRACKETS[filingStatus]
  const ndTax = computeBracketTax(ndTaxableIncome, brackets)

  // ND has no state credits in simplified implementation
  const taxAfterCredits = ndTax

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'ND' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const ndSourceIncome = ratio < 1.0
    ? Math.round(federalTaxableIncome * ratio)
    : undefined

  return {
    federalTaxableIncome,
    ndSubtractions,
    ndTaxableIncome,
    ndTax,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    ndSourceIncome,
  }
}
