/**
 * Mississippi Form 80-105 -- Individual Income Tax Return
 *
 * MS starts from federal AGI, applies additions and subtractions,
 * deducts the MS standard deduction and personal/dependent exemptions,
 * then applies a flat 4.4% rate on income above $10,000 (2025).
 *
 * Key features:
 * - Flat 4.4% tax rate with $10,000 exemption (transitioning from graduated)
 * - Generous personal exemptions ($6K single / $12K MFJ)
 * - Social Security benefits fully exempt
 * - Qualified retirement income fully exempt
 * - US government obligation interest exempt
 * - No state EITC
 * - Part-year/nonresident apportionment supported
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  MS_FLAT_TAX_RATE,
  MS_EXEMPT_AMOUNT,
  MS_STANDARD_DEDUCTION,
  MS_PERSONAL_EXEMPTION,
  MS_DEPENDENT_EXEMPTION,
} from './constants'

export interface Form80105Result {
  federalAGI: number

  // Additions
  msAdditions: number
  nonMSMuniBondInterest: number    // non-MS municipal bond interest (tax-exempt federally)

  // Subtractions
  msSubtractions: number
  usGovInterest: number            // US government obligation interest
  ssExemption: number              // Social Security benefits (MS fully exempts)
  retirementExemption: number      // Qualified retirement income (MS fully exempts)
  stateTaxRefund: number           // State tax refund included in federal AGI

  // MS adjusted gross income
  msAGI: number

  // Deductions & exemptions
  standardDeduction: number
  personalExemption: number
  dependentExemption: number
  totalExemptions: number

  // Taxable income & tax
  msTaxableIncome: number
  msExemptAmount: number           // first $10,000 exempt
  msIncomeSubjectToTax: number     // taxable income minus exempt amount
  msTax: number                    // flat 4.4% on income above exempt amount

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
  msSourceIncome?: number
}

export function computeMSApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

export function computeForm80105(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form80105Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeMSApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // -- MS Additions --------------------------------------------------------
  // Non-MS municipal bond interest: federally tax-exempt interest from
  // non-Mississippi municipal bonds (1099-INT box 8 + 1099-DIV box 11)
  const nonMSMuniBondInterest =
    model.form1099INTs.reduce((sum, f) => sum + f.box8, 0) +
    model.form1099DIVs.reduce((sum, f) => sum + f.box11, 0)

  const msAdditions = nonMSMuniBondInterest

  // -- MS Subtractions -----------------------------------------------------
  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Social Security benefits: MS fully exempts SS income
  // form1040 line6b is the taxable portion of SS already in federal AGI
  const ssExemption = form1040.line6b.amount

  // Retirement income: MS fully exempts qualified retirement income
  // 1099-R box 2a (taxable amount) — this is the portion included in federal AGI
  const retirementExemption = model.form1099Rs.reduce(
    (sum, r) => sum + r.box2a, 0,
  )

  // State tax refund included in federal AGI (1099-G Box 2)
  // Only subtract if taxpayer itemized last year (otherwise refund isn't in federal AGI)
  const stateTaxRefund = (model.priorYear?.itemizedLastYear ?? false)
    ? model.form1099Gs.reduce((sum, g) => sum + g.box2, 0)
    : 0

  const msSubtractions = usGovInterest + ssExemption + retirementExemption + stateTaxRefund

  // -- MS Adjusted Gross Income -------------------------------------------
  const msAGI = Math.max(0, federalAGI + msAdditions - msSubtractions)

  // -- Deductions & Exemptions --------------------------------------------
  const standardDeduction = MS_STANDARD_DEDUCTION[model.filingStatus]

  const personalExemption = MS_PERSONAL_EXEMPTION[model.filingStatus]

  const dependentExemption = model.dependents.length * MS_DEPENDENT_EXEMPTION

  const totalExemptions = standardDeduction + personalExemption + dependentExemption

  // -- Taxable Income -----------------------------------------------------
  const msTaxableIncome = Math.max(0, msAGI - totalExemptions)

  // -- Tax Computation ----------------------------------------------------
  // First $10,000 of taxable income is exempt (remnant of old 0% bracket)
  const msExemptAmount = Math.min(msTaxableIncome, MS_EXEMPT_AMOUNT)
  const msIncomeSubjectToTax = Math.max(0, msTaxableIncome - msExemptAmount)

  // Full-year tax at flat rate
  const fullYearTax = Math.round(msIncomeSubjectToTax * MS_FLAT_TAX_RATE)

  // Part-year/nonresident apportionment
  const msTax = ratio < 1 ? Math.round(fullYearTax * ratio) : fullYearTax

  // Credits (MS does not have a state EITC; placeholder for credit-for-taxes-paid-to-other-states)
  const taxAfterCredits = msTax

  // -- Withholding --------------------------------------------------------
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'MS' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding

  // -- Result -------------------------------------------------------------
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const msSourceIncome = ratio < 1 ? Math.round(msAGI * ratio) : undefined

  return {
    federalAGI,
    msAdditions,
    nonMSMuniBondInterest,
    msSubtractions,
    usGovInterest,
    ssExemption,
    retirementExemption,
    stateTaxRefund,
    msAGI,
    standardDeduction,
    personalExemption,
    dependentExemption,
    totalExemptions,
    msTaxableIncome,
    msExemptAmount,
    msIncomeSubjectToTax,
    msTax,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    msSourceIncome,
  }
}
