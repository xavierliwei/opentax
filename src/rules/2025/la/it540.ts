/**
 * Louisiana Form IT-540 -- Resident Individual Income Tax Return
 *
 * LA starts from federal AGI, applies additions and subtractions,
 * computes a standard deduction, and applies a flat 3.0% rate (2025 reform).
 *
 * Key features of 2025 reform:
 * - Flat 3.0% rate (replaces old graduated 1.85%/3.5%/4.25%)
 * - Personal exemptions eliminated
 * - New LA standard deduction ($12,500 single, $25,000 MFJ, etc.)
 * - Dependent credit: $100 per dependent
 * - LA EITC: 5% of federal EITC (new!)
 * - Social Security fully exempt
 * - Federal income tax deduction eliminated
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  LA_FLAT_TAX_RATE,
  LA_STANDARD_DEDUCTION,
  LA_DEPENDENT_CREDIT_PER_DEPENDENT,
  LA_EIC_RATE,
} from './constants'

export interface IT540Result {
  federalAGI: number

  // Additions
  laAdditions: number
  taxExemptInterest: number            // Non-LA municipal bond interest (federally exempt but LA-taxable)

  // Subtractions
  laSubtractions: number
  usGovInterest: number                // US government obligation interest (Treasury bonds, I-bonds, etc.)
  socialSecuritySubtraction: number    // Social Security benefits included in federal AGI (fully exempt)

  // LA adjusted gross income (federal AGI + additions - subtractions)
  laAGI: number

  // Standard deduction
  standardDeduction: number

  // Taxable income and tax
  laTaxableIncome: number
  laTax: number                        // flat 3.0% of taxable income

  // Credits
  dependentCredit: number              // $100 per dependent
  laEIC: number                        // 5% of federal EITC
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
  laSourceIncome?: number
}

export function computeLAApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

export function computeIT540(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): IT540Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeLAApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── LA Additions ─────────────────────────────────────────────
  // Non-Louisiana municipal bond interest: federally tax-exempt interest
  // from other states that LA taxes (1099-INT box 8 + 1099-DIV box 11)
  const taxExemptInterest =
    model.form1099INTs.reduce((sum, f) => sum + f.box8, 0) +
    model.form1099DIVs.reduce((sum, f) => sum + f.box11, 0)

  // Note: Under 2025 reform, federal income tax deduction is eliminated
  // (previously LA allowed deducting federal taxes paid).
  const laAdditions = taxExemptInterest

  // ── LA Subtractions ──────────────────────────────────────────
  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Social Security benefits: LA fully exempts SS income
  // form1040 line6b is the taxable portion of SS; we subtract it from LA income
  const socialSecuritySubtraction = form1040.line6b.amount

  const laSubtractions = usGovInterest + socialSecuritySubtraction

  // ── LA Adjusted Gross Income ─────────────────────────────────
  const laAGI = Math.max(0, federalAGI + laAdditions - laSubtractions)

  // ── Standard Deduction ───────────────────────────────────────
  const standardDeduction = LA_STANDARD_DEDUCTION[model.filingStatus]

  // ── Taxable Income (with apportionment for part-year/NR) ────
  const fullYearTaxable = Math.max(0, laAGI - standardDeduction)
  const laTaxableIncome = ratio < 1
    ? Math.round(fullYearTaxable * ratio)
    : fullYearTaxable

  // ── LA Tax ───────────────────────────────────────────────────
  const laTax = Math.round(laTaxableIncome * LA_FLAT_TAX_RATE)

  // ── Credits ──────────────────────────────────────────────────

  // Dependent credit: $100 per dependent (2025 reform)
  const dependentCredit = model.dependents.length * LA_DEPENDENT_CREDIT_PER_DEPENDENT

  // LA Earned Income Credit: 5% of federal EITC (new under 2025 reform)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const laEIC = Math.round(federalEITC * LA_EIC_RATE)

  const totalCredits = dependentCredit + laEIC

  // Tax after credits (nonrefundable credits cannot reduce below zero)
  // Note: dependentCredit is nonrefundable; laEIC is treated as refundable
  // For simplicity, apply all credits against tax, then handle refundable separately
  const nonrefundableCredits = dependentCredit
  const taxAfterNonrefundable = Math.max(0, laTax - nonrefundableCredits)
  const taxAfterCredits = Math.max(0, taxAfterNonrefundable - laEIC)

  // ── Withholding ──────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'LA' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding

  // ── Result ───────────────────────────────────────────────────
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const laSourceIncome = ratio < 1 ? Math.round(laAGI * ratio) : undefined

  return {
    federalAGI,
    laAdditions,
    taxExemptInterest,
    laSubtractions,
    usGovInterest,
    socialSecuritySubtraction,
    laAGI,
    standardDeduction,
    laTaxableIncome,
    laTax,
    dependentCredit,
    laEIC,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    laSourceIncome,
  }
}
