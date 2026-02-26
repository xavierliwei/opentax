/**
 * Kentucky Form 740 — Individual Income Tax Return
 *
 * KY starts from federal AGI, applies additions and subtractions,
 * uses the KY standard deduction, and applies a flat 4.0% rate.
 *
 * Key features:
 * - Flat 4.0% tax rate
 * - KY standard deduction ($3,160 per person; $6,320 for MFJ)
 * - Social Security fully exempt
 * - US government obligation interest subtraction
 * - Pension income exclusion ($31,110)
 * - Personal tax credit ($40 per person)
 * - Family Size Tax Credit for low-income taxpayers
 * - Part-year/nonresident apportionment
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  KY_FLAT_TAX_RATE,
  KY_PERSONAL_TAX_CREDIT,
  KY_FSTC_BASE_INCOME_SINGLE,
  KY_FSTC_INCREMENT_PER_PERSON,
  KY_FSTC_FULL_CREDIT_RATIO,
  KY_FSTC_PHASEOUT_END_RATIO,
  kyStandardDeduction,
} from './constants'

export interface Form740Result {
  federalAGI: number

  // Additions to federal AGI (KY Schedule M, Part I)
  kyAdditions: number
  taxExemptInterestOtherStates: number   // interest from other states' municipal bonds

  // Subtractions from federal AGI (KY Schedule M, Part II)
  kySubtractions: number
  usGovInterest: number                  // US government obligation interest
  ssExemption: number                    // Social Security benefits (fully exempt in KY)
  pensionExclusion: number               // Pension income exclusion ($31,110)

  // Kentucky AGI
  kyAGI: number

  // Deductions
  standardDeduction: number
  kyTaxableIncome: number

  // Tax
  kyTax: number

  // Credits
  personalTaxCredit: number              // $40 per person
  personalTaxCreditCount: number         // number of persons for personal credit
  familySizeTaxCredit: number            // Family Size Tax Credit
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
  kySourceIncome?: number
}

export function computeKYApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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
 * Compute the Family Size Tax Credit.
 *
 * The FSTC is a percentage of the computed tax based on modified gross income
 * and family size. For very low income, the credit equals 100% of the tax
 * (effectively zero tax). It phases out as income rises.
 */
function computeFamilySizeTaxCredit(
  modifiedGrossIncome: number,
  familySize: number,
  taxBeforeCredit: number,
): number {
  if (taxBeforeCredit <= 0) return 0

  // Threshold for 100% credit based on family size
  const threshold = KY_FSTC_BASE_INCOME_SINGLE +
    Math.max(0, familySize - 1) * KY_FSTC_INCREMENT_PER_PERSON

  if (modifiedGrossIncome <= threshold * KY_FSTC_FULL_CREDIT_RATIO) {
    // Full credit — tax is eliminated
    return taxBeforeCredit
  }

  if (modifiedGrossIncome >= threshold * KY_FSTC_PHASEOUT_END_RATIO) {
    // No credit — above phaseout
    return 0
  }

  // Linear phase-out between 100% and 133% of threshold
  const range = threshold * (KY_FSTC_PHASEOUT_END_RATIO - KY_FSTC_FULL_CREDIT_RATIO)
  const excess = modifiedGrossIncome - threshold * KY_FSTC_FULL_CREDIT_RATIO
  const creditRate = Math.max(0, 1 - excess / range)
  return Math.round(taxBeforeCredit * creditRate)
}

export function computeForm740(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form740Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeKYApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── KY Additions (Schedule M, Part I) ──────────────────────
  // Federally tax-exempt interest from other states' municipal bonds
  // KY taxes this income even though it's exempt federally
  const taxExemptInterestOtherStates =
    model.form1099INTs.reduce((sum, f) => sum + f.box8, 0) +
    model.form1099DIVs.reduce((sum, f) => sum + f.box11, 0)

  const kyAdditions = taxExemptInterestOtherStates

  // ── KY Subtractions (Schedule M, Part II) ──────────────────
  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Social Security benefits: KY fully exempts SS income
  // form1040 line6b is the taxable portion of SS; we subtract it from KY income
  const ssExemption = form1040.line6b.amount

  // Pension income exclusion — $31,110 per person
  // Applies to taxable retirement distributions (1099-R Box 2a)
  // For simplicity, we apply the exclusion up to the max per filer
  const totalPensionIncome = model.form1099Rs.reduce(
    (sum, r) => sum + r.box2a, 0,
  )
  // Note: the $31,110 is per person; for MFJ both spouses can claim it.
  // For now we use a single exclusion against total pension income.
  // A more precise implementation would track per-owner.
  const pensionExclusion = Math.min(totalPensionIncome, 3111000) // $31,110 in cents

  const kySubtractions = usGovInterest + ssExemption + pensionExclusion

  // ── KY AGI ─────────────────────────────────────────────────
  const kyAGI = Math.max(0, federalAGI + kyAdditions - kySubtractions)

  // ── Deductions ─────────────────────────────────────────────
  // Kentucky uses its own standard deduction, NOT the federal amount
  const standardDeduction = kyStandardDeduction(model.filingStatus)

  const kyTaxableIncome = Math.max(0, kyAGI - standardDeduction)

  // ── Tax ────────────────────────────────────────────────────
  const fullYearTax = Math.round(kyTaxableIncome * KY_FLAT_TAX_RATE)
  const kyTax = ratio < 1 ? Math.round(fullYearTax * ratio) : fullYearTax

  // ── Credits ────────────────────────────────────────────────

  // Personal tax credit: $40 per person (taxpayer + spouse + dependents)
  let personalTaxCreditCount = 1  // taxpayer
  if (model.filingStatus === 'mfj' && model.spouse) {
    personalTaxCreditCount += 1   // spouse
  }
  personalTaxCreditCount += model.dependents.length

  const personalTaxCredit = personalTaxCreditCount * KY_PERSONAL_TAX_CREDIT

  // Family Size Tax Credit
  // Uses the KY AGI (modified gross income) and family size
  const familySize = personalTaxCreditCount  // same count: taxpayer + spouse + dependents
  const taxAfterPersonalCredit = Math.max(0, kyTax - personalTaxCredit)
  const familySizeTaxCredit = computeFamilySizeTaxCredit(
    kyAGI, familySize, taxAfterPersonalCredit,
  )

  const totalCredits = personalTaxCredit + familySizeTaxCredit

  // Tax after credits (credits cannot reduce below zero)
  const taxAfterCredits = Math.max(0, kyTax - totalCredits)

  // ── Withholding ────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'KY' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding

  // ── Result ─────────────────────────────────────────────────
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const kySourceIncome = ratio < 1 ? Math.round(kyAGI * ratio) : undefined

  return {
    federalAGI,
    kyAdditions,
    taxExemptInterestOtherStates,
    kySubtractions,
    usGovInterest,
    ssExemption,
    pensionExclusion,
    kyAGI,
    standardDeduction,
    kyTaxableIncome,
    kyTax,
    personalTaxCredit,
    personalTaxCreditCount,
    familySizeTaxCredit,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    kySourceIncome,
  }
}
