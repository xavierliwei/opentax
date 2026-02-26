/**
 * Ohio Form IT 1040 — Individual Income Tax Return
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  OH_TAX_BRACKETS,
  OH_PERSONAL_EXEMPTION_CREDIT,
  OH_EXEMPTION_FULL_THRESHOLD,
  OH_EXEMPTION_PHASEOUT_THRESHOLD,
  OH_JOINT_FILING_CREDIT,
  OH_EXEMPTION_COUNT,
} from './constants'

export interface FormIT1040Result {
  federalAGI: number
  ohAdditions: number
  ohDeductions: number
  ohAGI: number
  ssExemption: number
  ohTaxableIncome: number
  ohTaxBeforeCredits: number
  personalExemptionCredit: number
  jointFilingCredit: number
  totalCredits: number
  ohTax: number
  taxAfterCredits: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
}

export function computeOHApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

/**
 * Compute Ohio progressive tax using the 2025 brackets.
 * Income is in cents; returns tax in cents.
 */
function computeOHProgressiveTax(taxableIncome: number): number {
  let tax = 0
  for (const bracket of OH_TAX_BRACKETS) {
    if (taxableIncome <= bracket.lower) break
    const taxableInBracket = Math.min(taxableIncome, bracket.upper) - bracket.lower
    tax += Math.round(taxableInBracket * bracket.rate)
  }
  return tax
}

/**
 * Compute the Ohio personal exemption credit, phased out based on Ohio AGI.
 */
function computePersonalExemptionCredit(ohAGI: number, exemptionCount: number): number {
  if (ohAGI <= OH_EXEMPTION_FULL_THRESHOLD) {
    // Full credit
    return OH_PERSONAL_EXEMPTION_CREDIT * exemptionCount
  }
  if (ohAGI > OH_EXEMPTION_PHASEOUT_THRESHOLD) {
    // Fully phased out
    return 0
  }
  // Proportional phase-out between $40,000 and $80,000
  const phaseoutRange = OH_EXEMPTION_PHASEOUT_THRESHOLD - OH_EXEMPTION_FULL_THRESHOLD
  const amountOver = ohAGI - OH_EXEMPTION_FULL_THRESHOLD
  const ratio = 1 - amountOver / phaseoutRange
  return Math.round(OH_PERSONAL_EXEMPTION_CREDIT * exemptionCount * ratio)
}

export function computeFormIT1040(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormIT1040Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeOHApportionmentRatio(config, model.taxYear) : 1

  // 1. Start with federal AGI
  const federalAGI = form1040.line11.amount

  // 2. Ohio additions: none currently modeled
  const ohAdditions = 0

  // 3. Ohio deductions: Social Security exemption (Ohio fully exempts SS)
  const ssExemption = form1040.line6b.amount
  const ohDeductions = ssExemption

  // 4. Ohio AGI = federalAGI + ohAdditions - ohDeductions
  const ohAGI = federalAGI + ohAdditions - ohDeductions

  // 5. Ohio taxable income = max(0, ohAGI) — no standard deduction in Ohio
  const ohTaxableIncome = Math.max(0, ohAGI)

  // 6. Compute tax using progressive brackets
  const ohTaxBeforeCredits = computeOHProgressiveTax(ohTaxableIncome)

  // 7. Personal exemption credit (based on Ohio AGI thresholds)
  const exemptionCount = OH_EXEMPTION_COUNT[model.filingStatus]
  const personalExemptionCredit = computePersonalExemptionCredit(ohAGI, exemptionCount)

  // 8. Joint filing credit if MFJ (lesser of $650 or remaining tax after personal exemption)
  const taxAfterPersonalExemption = Math.max(0, ohTaxBeforeCredits - personalExemptionCredit)
  const jointFilingCredit = model.filingStatus === 'mfj'
    ? Math.min(OH_JOINT_FILING_CREDIT, taxAfterPersonalExemption)
    : 0

  const totalCredits = personalExemptionCredit + jointFilingCredit

  // 9. Tax after credits
  const ohTax = Math.max(0, ohTaxBeforeCredits - totalCredits)

  // 10. Apply apportionment for part-year/nonresident
  const taxAfterCredits = ratio < 1 ? Math.round(ohTax * ratio) : ohTax

  // 11. State withholding from W-2s where box15State === 'OH'
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'OH' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding

  // 12–13. Overpaid / amount owed
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  return {
    federalAGI,
    ohAdditions,
    ohDeductions,
    ohAGI,
    ssExemption,
    ohTaxableIncome,
    ohTaxBeforeCredits,
    personalExemptionCredit,
    jointFilingCredit,
    totalCredits,
    ohTax,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
  }
}
