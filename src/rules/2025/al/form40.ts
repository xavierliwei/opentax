/**
 * Alabama Form 40 — Resident / Part-Year / Nonresident Income Tax Return
 *
 * Alabama starts from federal AGI, applies additions and subtractions, then
 * applies its own standard deduction, personal exemptions, and graduated
 * tax rates (2%/4%/5%).
 *
 * Key features:
 * - Federal tax deduction: AL allows deducting federal income tax paid
 *   (Form 1040 Line 24) — this is a major unique feature.
 * - Social Security is fully exempt from AL tax.
 * - Graduated rates: 2% / 4% / 5% with bracket widths that vary by status.
 * - Personal exemption + dependent exemptions.
 * - Part-year/nonresident: apportionment of AL-source income.
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  AL_TAX_BRACKETS,
  AL_STANDARD_DEDUCTION,
  AL_PERSONAL_EXEMPTION,
  AL_DEPENDENT_EXEMPTION,
} from './constants'
import type { ALTaxBracket } from './constants'

export interface Form40Result {
  federalAGI: number

  // Additions
  alAdditions: number
  taxExemptInterest: number        // Non-AL municipal bond interest

  // Subtractions
  alSubtractions: number
  usGovInterest: number            // US government obligation interest
  socialSecuritySubtraction: number // SS benefits fully exempt
  stateRefundSubtraction: number   // State tax refund included in federal AGI

  // Federal tax deduction (AL-unique: deduct federal tax paid)
  federalTaxDeduction: number

  // AL adjusted gross income
  alAGI: number

  // Deductions & exemptions
  standardDeduction: number
  personalExemption: number
  dependentExemption: number

  // Taxable income & tax
  alTaxableIncome: number
  alTax: number

  // Credits
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
  alSourceIncome?: number
}

// ── Graduated tax computation ─────────────────────────────────

function computeGraduatedTax(taxableIncome: number, brackets: ALTaxBracket[]): number {
  if (taxableIncome <= 0) return 0

  let tax = 0
  let remaining = taxableIncome
  let prevLimit = 0

  for (const bracket of brackets) {
    const bracketWidth = bracket.upTo === Infinity
      ? remaining
      : bracket.upTo - prevLimit
    const taxableInBracket = Math.min(remaining, bracketWidth)
    tax += Math.round(taxableInBracket * bracket.rate)
    remaining -= taxableInBracket
    prevLimit = bracket.upTo
    if (remaining <= 0) break
  }

  return tax
}

// ── Apportionment ─────────────────────────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function computeALApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

// ── Main computation ──────────────────────────────────────────

export function computeForm40(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form40Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeALApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── AL Additions ────────────────────────────────────────────
  // Non-Alabama municipal bond interest: federally tax-exempt interest
  // from other states that AL taxes (1099-INT box 8 + 1099-DIV box 11)
  const taxExemptInterest =
    model.form1099INTs.reduce((sum, f) => sum + f.box8, 0) +
    model.form1099DIVs.reduce((sum, f) => sum + f.box11, 0)

  const alAdditions = taxExemptInterest

  // ── AL Subtractions ─────────────────────────────────────────
  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Social Security: AL fully exempts SS income
  // form1040 line6b is the taxable portion of SS; we subtract it from AL income
  const socialSecuritySubtraction = form1040.line6b.amount

  // State income tax refund included in federal AGI (1099-G box 2)
  const stateRefundSubtraction = model.form1099Gs.reduce(
    (sum, f) => sum + f.box2, 0,
  )

  const alSubtractions = usGovInterest + socialSecuritySubtraction + stateRefundSubtraction

  // ── Federal Tax Deduction (AL-unique feature) ───────────────
  // Alabama allows deducting federal income tax paid from Form 1040 Line 24
  // (total tax before payments/credits). This is a significant deduction
  // available in only a few states.
  const federalTaxDeduction = form1040.line24.amount

  // ── AL Adjusted Gross Income ────────────────────────────────
  const alAGI = Math.max(0, federalAGI + alAdditions - alSubtractions - federalTaxDeduction)

  // ── Standard Deduction ──────────────────────────────────────
  const standardDeduction = AL_STANDARD_DEDUCTION[filingStatus]

  // ── Personal Exemption ──────────────────────────────────────
  const personalExemption = AL_PERSONAL_EXEMPTION[filingStatus]

  // ── Dependent Exemption ─────────────────────────────────────
  const dependentExemption = model.dependents.length * AL_DEPENDENT_EXEMPTION

  // ── Taxable Income ──────────────────────────────────────────
  const totalDeductions = standardDeduction + personalExemption + dependentExemption
  const fullYearTaxable = Math.max(0, alAGI - totalDeductions)
  const alTaxableIncome = ratio < 1
    ? Math.round(fullYearTaxable * ratio)
    : fullYearTaxable

  // ── AL Tax (graduated rates) ────────────────────────────────
  const brackets = AL_TAX_BRACKETS[filingStatus]
  const alTax = computeGraduatedTax(alTaxableIncome, brackets)

  // ── Credits ─────────────────────────────────────────────────
  // Alabama does not have a state EITC. Credits for taxes paid to other
  // states can be added in the future. For now, totalCredits = 0.
  const totalCredits = 0

  const taxAfterCredits = Math.max(0, alTax - totalCredits)

  // ── Withholding ─────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'AL' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding

  // ── Result ──────────────────────────────────────────────────
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const alSourceIncome = ratio < 1 ? Math.round(alAGI * ratio) : undefined

  return {
    federalAGI,
    alAdditions,
    taxExemptInterest,
    alSubtractions,
    usGovInterest,
    socialSecuritySubtraction,
    stateRefundSubtraction,
    federalTaxDeduction,
    alAGI,
    standardDeduction,
    personalExemption,
    dependentExemption,
    alTaxableIncome,
    alTax,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    alSourceIncome,
  }
}
