/**
 * Montana Form 2 -- Individual Income Tax Return (TY 2025)
 *
 * Computes MT state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * MT-specific adjustments, deductions, exemptions, and credits.
 *
 * Reference: MT Form 2 Instructions, 15-30-2101 et seq., MCA
 *
 * Key features:
 *   - 2-bracket graduated tax (4.7%, 5.9%) -- same for all filing statuses
 *   - 20% of AGI standard deduction (capped by filing status)
 *   - Personal exemption: $3,000/person
 *   - No state EITC
 *   - No state dependent care credit
 *   - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeApportionmentRatio } from '../ca/form540'
import {
  MT_TAX_BRACKETS,
  MT_STANDARD_DEDUCTION_RATE,
  MT_STANDARD_DEDUCTION_CAP,
  MT_PERSONAL_EXEMPTION,
} from './constants'

// -- Result types ------------------------------------------------------------

export interface Form2Result {
  // Income
  federalAGI: number
  mtAdditions: number
  mtSubtractions: number
  mtAGI: number

  // Subtraction detail
  usGovInterest: number

  // Deductions & exemptions
  mtStandardDeduction: number
  personalExemptions: number
  numExemptions: number
  mtTaxableIncome: number

  // Tax
  mtTax: number

  // Credits
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
  mtSourceIncome?: number
}

// -- Bracket tax computation -------------------------------------------------

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

// -- Main computation --------------------------------------------------------

export function computeForm2(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form2Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  const federalAGI = form1040.line11.amount

  // -- MT Additions ----------------------------------------------------------
  const mtAdditions = 0

  // -- MT Subtractions -------------------------------------------------------
  // US government obligation interest (exempt from state tax)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Montana does NOT exempt Social Security benefits
  const mtSubtractions = usGovInterest
  const mtAGI = federalAGI + mtAdditions - mtSubtractions

  // -- MT Standard Deduction -------------------------------------------------
  // 20% of MT AGI, capped by filing status
  const deductionFromPct = Math.round(Math.max(0, mtAGI) * MT_STANDARD_DEDUCTION_RATE)
  const mtStandardDeduction = Math.min(deductionFromPct, MT_STANDARD_DEDUCTION_CAP[filingStatus])

  // -- Personal Exemptions ---------------------------------------------------
  let numExemptions = 1 // taxpayer
  if (filingStatus === 'mfj' || filingStatus === 'qw') {
    numExemptions += 1 // spouse
  }
  numExemptions += model.dependents.length
  const personalExemptions = numExemptions * MT_PERSONAL_EXEMPTION

  // -- Taxable Income --------------------------------------------------------
  const mtTaxableIncome = Math.max(0, mtAGI - mtStandardDeduction - personalExemptions)

  // -- Tax computation -------------------------------------------------------
  const fullYearTax = computeBracketTax(mtTaxableIncome, MT_TAX_BRACKETS)
  const mtTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // -- Credits ---------------------------------------------------------------
  // Montana has no state EITC and no dependent care credit at state level
  const totalNonrefundableCredits = 0
  const totalRefundableCredits = 0
  const taxAfterCredits = Math.max(0, mtTax - totalNonrefundableCredits)

  // -- Payments --------------------------------------------------------------
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'MT' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + totalRefundableCredits

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const mtSourceIncome = ratio < 1.0
    ? Math.round(mtAGI * ratio)
    : undefined

  return {
    federalAGI,
    mtAdditions,
    mtSubtractions,
    mtAGI,
    usGovInterest,
    mtStandardDeduction,
    personalExemptions,
    numExemptions,
    mtTaxableIncome,
    mtTax,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    mtSourceIncome,
  }
}
