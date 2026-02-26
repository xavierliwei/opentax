/**
 * South Carolina Form SC1040 — Individual Income Tax Return
 *
 * SC starts from federal taxable income (Form 1040 Line 15), applies
 * additions and subtractions, deducts personal exemptions, and applies
 * a flat 3.99% rate (2025 reform — previously graduated 0-6.4%).
 *
 * Key features:
 * - Flat 3.99% tax rate (2025 reform)
 * - Uses federal standard deduction (already embedded in Line 15)
 * - Personal exemption: $4,700 per person
 * - Full Social Security exemption
 * - Retirement income deduction ($10,000 under 65; full if 65+)
 * - SC EITC: 41.67% of federal EITC (one of the highest)
 * - Two-wage earner credit (MFJ only)
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  SC_FLAT_TAX_RATE,
  SC_PERSONAL_EXEMPTION,
  SC_RETIREMENT_DEDUCTION_UNDER_65,
  SC_EITC_RATE,
  SC_TWO_WAGE_EARNER_CREDIT_MAX,
} from './constants'

export interface SC1040Result {
  /** Federal taxable income (Form 1040 Line 15) — SC starting point */
  federalTaxableIncome: number
  /** Federal AGI (for reference) */
  federalAGI: number

  // ── Additions ─────────────────────────────────────────────────
  scAdditions: number

  // ── Subtractions ──────────────────────────────────────────────
  scSubtractions: number
  socialSecuritySubtraction: number
  retirementIncomeDeduction: number
  usGovInterestSubtraction: number
  stateRefundSubtraction: number

  // ── SC AGI & Exemptions ──────────────────────────────────────
  scAGI: number
  exemptionCount: number
  exemptionAmount: number

  // ── Taxable Income & Tax ─────────────────────────────────────
  scTaxableIncome: number
  scTax: number

  // ── Credits ──────────────────────────────────────────────────
  scEITC: number
  twoWageEarnerCredit: number
  totalNonrefundableCredits: number
  totalRefundableCredits: number
  taxAfterCredits: number

  // ── Withholding & Payments ───────────────────────────────────
  stateWithholding: number
  totalPayments: number

  // ── Result ───────────────────────────────────────────────────
  overpaid: number
  amountOwed: number

  // ── Residency / Apportionment ────────────────────────────────
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  scSourceIncome?: number
}

// ── Apportionment ─────────────────────────────────────────────────

export function computeSCApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

// ── Age helper ──────────────────────────────────────────────────

function ageAtEndOfYear(dateOfBirth: string | undefined, taxYear: number): number {
  if (!dateOfBirth) return 0
  const [y, m, d] = dateOfBirth.split('-').map(Number)
  if (!y || !m || !d) return 0
  const endOfYear = new Date(taxYear, 11, 31)
  const birth = new Date(y, m - 1, d)
  let age = endOfYear.getFullYear() - birth.getFullYear()
  if (
    endOfYear.getMonth() < birth.getMonth() ||
    (endOfYear.getMonth() === birth.getMonth() && endOfYear.getDate() < birth.getDate())
  ) {
    age--
  }
  return age
}

// ── Main computation ──────────────────────────────────────────────

export function computeSC1040(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): SC1040Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeSCApportionmentRatio(config, model.taxYear) : 1

  // ── Starting point: Federal Taxable Income (1040 Line 15) ─────
  // SC starts from federal taxable income, which already includes
  // the standard/itemized deduction. This is different from states
  // like NC/IL that start from federal AGI.
  const federalTaxableIncome = form1040.line15.amount
  const federalAGI = form1040.line11.amount

  // ── SC Additions ──────────────────────────────────────────────
  // Minimal additions because SC starts from federal taxable income.
  // Most add-backs are only needed for states that start from AGI.
  const scAdditions = 0

  // ── SC Subtractions ───────────────────────────────────────────

  // Social Security: SC fully exempts Social Security benefits
  // Since form1040 Line 15 already includes taxable SS (line 6b),
  // we subtract it to exempt it from SC tax
  const socialSecuritySubtraction = form1040.line6b.amount

  // Retirement income deduction
  // SC allows a deduction for qualifying retirement income (1099-R)
  // Under 65: up to $10,000; Age 65+: full amount
  const taxpayerAge = ageAtEndOfYear(model.taxpayer.dateOfBirth, model.taxYear)
  const retirementIncome = form1040.line4b.amount + form1040.line5b.amount
  let retirementLimit: number
  if (taxpayerAge >= 65) {
    // Age 65+: full retirement income deduction
    retirementLimit = retirementIncome
  } else {
    retirementLimit = SC_RETIREMENT_DEDUCTION_UNDER_65
  }
  const retirementIncomeDeduction = Math.min(retirementLimit, Math.max(0, retirementIncome))

  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterestSubtraction = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // State/local income tax refund subtraction
  // If a prior-year state tax refund is included in federal income (1099-G Box 2)
  // and the taxpayer itemized last year, SC allows subtracting it
  const stateRefundSubtraction = (model.priorYear?.itemizedLastYear ?? false)
    ? model.form1099Gs.reduce((sum, g) => sum + g.box2, 0)
    : 0

  const scSubtractions = socialSecuritySubtraction
    + retirementIncomeDeduction
    + usGovInterestSubtraction
    + stateRefundSubtraction

  // ── SC AGI ────────────────────────────────────────────────────
  const scAGI = Math.max(0, federalTaxableIncome + scAdditions - scSubtractions)

  // ── Personal Exemptions ───────────────────────────────────────
  // $4,700 per person: taxpayer + spouse (if MFJ/QW) + dependents
  let exemptionCount = 1  // taxpayer
  if ((model.filingStatus === 'mfj' || model.filingStatus === 'qw') && model.spouse) {
    exemptionCount += 1   // spouse
  }
  exemptionCount += model.dependents.length

  const exemptionAmount = exemptionCount * SC_PERSONAL_EXEMPTION

  // ── SC Taxable Income ─────────────────────────────────────────
  const scTaxableIncomeBeforeApportion = Math.max(0, scAGI - exemptionAmount)

  // Apply apportionment for part-year/nonresident
  const scTaxableIncome = ratio < 1
    ? Math.round(scTaxableIncomeBeforeApportion * ratio)
    : scTaxableIncomeBeforeApportion

  // ── SC Tax (3.99% flat rate) ──────────────────────────────────
  const scTax = Math.round(scTaxableIncome * SC_FLAT_TAX_RATE)

  // ── Credits ───────────────────────────────────────────────────

  // SC Earned Income Tax Credit: 41.67% of federal EITC (nonrefundable in SC)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const scEITC = Math.round(federalEITC * SC_EITC_RATE)

  // Two-wage earner credit (MFJ only)
  // Lesser of $350 or the lower-earning spouse's qualified earned income
  let twoWageEarnerCredit = 0
  if (model.filingStatus === 'mfj' && model.spouse) {
    const taxpayerWages = model.w2s
      .filter(w => w.owner !== 'spouse')
      .reduce((sum, w) => sum + w.box1, 0)
    const spouseWages = model.w2s
      .filter(w => w.owner === 'spouse')
      .reduce((sum, w) => sum + w.box1, 0)
    const lowerWages = Math.min(taxpayerWages, spouseWages)
    if (lowerWages > 0) {
      twoWageEarnerCredit = Math.min(SC_TWO_WAGE_EARNER_CREDIT_MAX, lowerWages)
    }
  }

  // SC EITC is nonrefundable — it reduces tax but cannot go below zero
  const totalNonrefundableCredits = scEITC + twoWageEarnerCredit
  const totalRefundableCredits = 0

  // Tax after credits (nonrefundable credits cannot reduce below zero)
  const taxAfterCredits = Math.max(0, scTax - totalNonrefundableCredits)

  // ── Withholding ───────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'SC' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding

  // ── Result ────────────────────────────────────────────────────
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const scSourceIncome = ratio < 1 ? Math.round(scAGI * ratio) : undefined

  return {
    federalTaxableIncome,
    federalAGI,

    scAdditions,
    scSubtractions,
    socialSecuritySubtraction,
    retirementIncomeDeduction,
    usGovInterestSubtraction,
    stateRefundSubtraction,

    scAGI,
    exemptionCount,
    exemptionAmount,

    scTaxableIncome,
    scTax,

    scEITC,
    twoWageEarnerCredit,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,

    stateWithholding,
    totalPayments,

    overpaid,
    amountOwed,

    residencyType,
    apportionmentRatio: ratio,
    scSourceIncome,
  }
}
