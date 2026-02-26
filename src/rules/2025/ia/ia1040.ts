/**
 * Iowa Form IA 1040 — Individual Income Tax Return
 *
 * Iowa completed its tax reform in 2025, moving to a flat 3.8% rate.
 * Key features:
 * - Starts from federal AGI (Form 1040 Line 11)
 * - Iowa standard deduction (much lower than federal)
 * - Social Security fully exempt (starting 2023)
 * - No federal income tax deduction (eliminated starting 2025)
 * - Personal exemption credit: $40/person
 * - IA EIC: 15% of federal EITC
 * - US government obligation interest subtraction
 * - Tax-exempt interest addition (other-state municipal bonds)
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  IA_FLAT_TAX_RATE,
  IA_STANDARD_DEDUCTION,
  IA_PERSONAL_EXEMPTION_CREDIT,
  IA_EIC_RATE,
} from './constants'

export interface IA1040Result {
  federalAGI: number

  // Additions
  iaAdditions: number
  taxExemptInterest: number              // other-state municipal bond interest

  // Subtractions
  iaSubtractions: number
  usGovInterest: number                  // US government obligation interest
  socialSecuritySubtraction: number      // Social Security benefits (fully exempt)

  // Iowa net income (federal AGI + additions - subtractions)
  iaNetIncome: number

  // Standard deduction
  standardDeduction: number

  // Taxable income
  iaTaxableIncome: number                // net income minus standard deduction, apportioned for NR/part-year

  // Tax
  iaTax: number                          // flat 3.8%

  // Credits
  exemptionCount: number                 // taxpayer + spouse + dependents
  personalExemptionCredit: number        // $40 per person
  iaEIC: number                          // 15% of federal EITC
  totalCredits: number

  taxAfterCredits: number

  // Withholding & payments
  stateWithholding: number
  totalPayments: number

  // Result
  overpaid: number
  amountOwed: number

  // Residency
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  iaSourceIncome?: number
}

export function computeIAApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
  if (config.residencyType === 'full-year') return 1
  if (config.residencyType === 'nonresident') return 0

  const daysInYear = isLeapYear(taxYear) ? 366 : 365
  const yearStart = Date.UTC(taxYear, 0, 1)
  const yearEnd = Date.UTC(taxYear, 11, 31)
  const dayMs = 86400000

  let start = yearStart
  let end = yearEnd

  if (config.moveInDate) {
    const [y, m, d] = config.moveInDate.split('-').map(Number)
    const parsed = Date.UTC(y, m - 1, d)
    if (!Number.isNaN(parsed)) start = parsed
  }

  if (config.moveOutDate) {
    const [y, m, d] = config.moveOutDate.split('-').map(Number)
    const parsed = Date.UTC(y, m - 1, d)
    if (!Number.isNaN(parsed)) end = parsed
  }

  if (start < yearStart) start = yearStart
  if (end > yearEnd) end = yearEnd
  if (end < start) return 0

  const daysInState = Math.round((end - start) / dayMs) + 1
  return Math.min(1, Math.max(0, daysInState / daysInYear))
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function computeIA1040(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): IA1040Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeIAApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── IA Additions ─────────────────────────────────────────────
  // Federally tax-exempt interest (1099-INT box 8 + 1099-DIV box 11)
  // This is interest from municipal bonds of other states that Iowa taxes
  const taxExemptInterest =
    model.form1099INTs.reduce((sum, f) => sum + f.box8, 0) +
    model.form1099DIVs.reduce((sum, f) => sum + f.box11, 0)

  const iaAdditions = taxExemptInterest

  // ── IA Subtractions ──────────────────────────────────────────
  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Social Security benefits: Iowa fully exempts SS income (starting 2023)
  // form1040 line6b is the taxable portion of SS; we subtract it from IA income
  const socialSecuritySubtraction = form1040.line6b.amount

  const iaSubtractions = usGovInterest + socialSecuritySubtraction

  // ── Iowa Net Income ──────────────────────────────────────────
  const iaNetIncome = Math.max(0, federalAGI + iaAdditions - iaSubtractions)

  // ── Standard Deduction ───────────────────────────────────────
  const standardDeduction = IA_STANDARD_DEDUCTION[model.filingStatus]

  // ── Taxable Income (with apportionment for part-year/NR) ────
  const fullYearTaxableIncome = Math.max(0, iaNetIncome - standardDeduction)
  const iaTaxableIncome = ratio < 1
    ? Math.round(fullYearTaxableIncome * ratio)
    : fullYearTaxableIncome

  // ── IA Tax ───────────────────────────────────────────────────
  const iaTax = Math.round(iaTaxableIncome * IA_FLAT_TAX_RATE)

  // ── Credits ──────────────────────────────────────────────────

  // Personal exemption credit: $40 per person (taxpayer + spouse + dependents)
  let exemptionCount = 1  // taxpayer
  if (model.filingStatus === 'mfj' && model.spouse) {
    exemptionCount += 1   // spouse
  }
  exemptionCount += model.dependents.length

  const personalExemptionCredit = exemptionCount * IA_PERSONAL_EXEMPTION_CREDIT

  // Iowa Earned Income Credit: 15% of federal EITC
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const iaEIC = Math.round(federalEITC * IA_EIC_RATE)

  const totalCredits = personalExemptionCredit + iaEIC

  // Tax after credits (cannot go below zero)
  const taxAfterCredits = Math.max(0, iaTax - totalCredits)

  // ── Withholding ──────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'IA' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding

  // ── Result ───────────────────────────────────────────────────
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const iaSourceIncome = ratio < 1 ? Math.round(iaNetIncome * ratio) : undefined

  return {
    federalAGI,
    iaAdditions,
    taxExemptInterest,
    iaSubtractions,
    usGovInterest,
    socialSecuritySubtraction,
    iaNetIncome,
    standardDeduction,
    iaTaxableIncome,
    iaTax,
    exemptionCount,
    personalExemptionCredit,
    iaEIC,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    iaSourceIncome,
  }
}
