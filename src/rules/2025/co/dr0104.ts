/**
 * Colorado Form DR 0104 — Individual Income Tax Return
 *
 * Key differences from other states:
 * - CO starts from federal TAXABLE income (Form 1040 Line 15), NOT AGI
 * - DR 0104 Line 1 = Federal taxable income
 * - Lines 2-8: Additions (SALT from Sch A, QBI addback, std/itemized deduction addback, etc.)
 * - Line 9: Subtotal (line 1 + additions)
 * - Line 10: Subtractions (from DR 0104AD)
 * - Line 11: CO Taxable Income (line 9 - line 10)
 * - Line 12: CO Tax (4.40% flat rate)
 * - Line 15: Subtotal tax
 * - Lines 16-19: Nonrefundable credits
 * - Line 20: Net Income Tax
 * - Line 21: CO withholding
 * - Lines 22-29: Prepayments and refundable credits
 * - Line 30: Total payments
 * - Lines 31-34: TABOR Modified AGI calculation
 * - Line 35: TABOR State Sales Tax Refund
 * - Line 36: Sum of payments + TABOR
 * - Line 37: Overpayment (if line 36 > line 20)
 * - Line 39: Refund
 * - Line 40: Net Tax Due (if line 20 > line 36)
 * - Line 44: Amount You Owe
 */

import type { TaxReturn, StateReturnConfig, FilingStatus } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  CO_FLAT_TAX_RATE,
  CO_EITC_RATE,
  CO_CTC_RATE,
  CO_PENSION_SUBTRACTION_65_PLUS,
  CO_PENSION_SUBTRACTION_55_TO_64,
} from './constants'

export interface DR0104Result {
  // ── DR 0104 Line Items ────────────────────────────────────────
  /** Line 1: Federal Taxable Income (Form 1040 Line 15) */
  line1: number
  /** Line 2: State/local taxes from federal Sch A line 5a (addition) */
  line2: number
  /** Line 9: Subtotal (line 1 + additions) */
  line9: number
  /** Line 10: Subtractions from DR 0104AD */
  line10: number
  /** Line 11: Colorado Taxable Income (line 9 - line 10) */
  line11: number
  /** Line 12: Colorado Tax */
  line12: number
  /** Line 15: Subtotal tax (= line 12, no AMT/recapture) */
  line15: number
  /** Line 16: Nonrefundable credits (CO CTC) */
  line16: number
  /** Line 20: Net Income Tax (line 15 - nonrefundable credits) */
  line20: number
  /** Line 21: CO income tax withheld */
  line21: number
  /** Line 28: Refundable credits (CO EITC) */
  line28: number
  /** Line 30: Total payments + refundable credits */
  line30: number
  /** Line 31: Federal AGI (for TABOR) */
  line31: number
  /** Line 34: Modified AGI for TABOR */
  line34: number
  /** Line 35: TABOR State Sales Tax Refund */
  line35: number
  /** Line 36: Sum of lines 30 and 35 */
  line36: number
  /** Line 37: Overpayment (if line 36 > line 20) */
  line37: number
  /** Line 39: Refund */
  line39: number
  /** Line 40: Net Tax Due (if line 20 > line 36) */
  line40: number
  /** Line 44: Amount You Owe */
  line44: number

  // ── Convenience aliases ───────────────────────────────────────
  federalTaxableIncome: number
  federalAGI: number
  coAdditions: number
  coSubtractions: number
  coTaxableIncome: number
  coTax: number

  // Subtraction detail
  usGovInterestSubtraction: number
  socialSecuritySubtraction: number
  pensionSubtraction: number

  // Credit detail
  coEITC: number
  coCTC: number
  totalCredits: number
  taxAfterCredits: number
  taborRefund: number

  // Payments & result
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number

  // Apportionment
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  coSourceIncome?: number
}

// ── TABOR Sales Tax Refund lookup ─────────────────────────────────

interface TABORTier { threshold: number; single: number; joint: number }

const TABOR_TIERS: TABORTier[] = [
  { threshold:  53_000_00, single: 177_00, joint: 354_00 },
  { threshold: 105_000_00, single: 240_00, joint: 480_00 },
  { threshold: 166_000_00, single: 277_00, joint: 554_00 },
  { threshold: 233_000_00, single: 323_00, joint: 646_00 },
  { threshold: 302_000_00, single: 350_00, joint: 700_00 },
  { threshold: Infinity,    single: 565_00, joint: 1130_00 },
]

function lookupTABORRefund(modifiedAGI: number, filingStatus: FilingStatus): number {
  const isJoint = filingStatus === 'mfj' || filingStatus === 'qw'
  for (const tier of TABOR_TIERS) {
    if (modifiedAGI <= tier.threshold) {
      return isJoint ? tier.joint : tier.single
    }
  }
  return isJoint ? TABOR_TIERS[TABOR_TIERS.length - 1].joint : TABOR_TIERS[TABOR_TIERS.length - 1].single
}

// ── Apportionment ─────────────────────────────────────────────────

export function computeCOApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

export function computeDR0104(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): DR0104Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeCOApportionmentRatio(config, model.taxYear) : 1

  // ── Line 1: Federal Taxable Income (1040 Line 15) ────────────
  const line1 = form1040.line15.amount
  const federalAGI = form1040.line11.amount

  // ── Lines 2-8: Additions to Federal Taxable Income ───────────
  // Line 2: State/local income taxes or sales taxes from federal Sch A, line 5a
  // Only when itemizing on federal return
  const line2 = model.deductions.method === 'itemized'
    ? Math.max(
        model.deductions.itemized?.stateLocalIncomeTaxes ?? 0,
        model.deductions.itemized?.stateLocalSalesTaxes ?? 0,
      )
    : 0

  // Lines 3-8: Other additions (QBI addback, std/itemized deduction addback, etc.)
  // Not yet implemented — these are complex and rare for most filers
  const coAdditions = line2

  // ── Line 9: Subtotal ─────────────────────────────────────────
  const line9 = line1 + coAdditions

  // ── Line 10: Subtractions (from DR 0104AD) ───────────────────
  // US government obligation interest (Treasury bonds, etc.)
  const usGovInterestSubtraction = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Social Security subtraction
  // CO exempts SS benefits that were included in federal taxable income
  const socialSecuritySubtraction = form1040.line6b.amount

  // Pension/annuity subtraction
  const taxpayerAge = ageAtEndOfYear(model.taxpayer.dateOfBirth, model.taxYear)
  const retirementIncome = form1040.line4b.amount + form1040.line5b.amount
  let pensionLimit = 0
  if (taxpayerAge >= 65) {
    pensionLimit = CO_PENSION_SUBTRACTION_65_PLUS
  } else if (taxpayerAge >= 55) {
    pensionLimit = CO_PENSION_SUBTRACTION_55_TO_64
  }
  const pensionSubtraction = Math.min(pensionLimit, Math.max(0, retirementIncome))

  const coSubtractions = usGovInterestSubtraction + socialSecuritySubtraction + pensionSubtraction
  const line10 = coSubtractions

  // ── Line 11: Colorado Taxable Income ─────────────────────────
  const coTaxableIncomeBeforeApportion = Math.max(0, line9 - line10)

  // Apply apportionment for part-year/nonresident
  const line11 = ratio < 1
    ? Math.round(coTaxableIncomeBeforeApportion * ratio)
    : coTaxableIncomeBeforeApportion

  // ── Line 12: Colorado Tax (4.40% flat rate) ──────────────────
  const line12 = Math.round(line11 * CO_FLAT_TAX_RATE)

  // ── Line 15: Subtotal tax (no AMT/recapture in simplified) ───
  const line15 = line12

  // ── Line 16: Nonrefundable Credits ───────────────────────────
  // CO Child Tax Credit: 20% of federal CTC (simplified — income-based 20-60%)
  const federalCTC = form1040.childTaxCredit?.creditAfterPhaseOut ?? 0
  const coCTC = Math.round(federalCTC * CO_CTC_RATE)
  const line16 = Math.min(coCTC, line15) // Cannot exceed tax

  // ── Line 20: Net Income Tax ──────────────────────────────────
  const line20 = Math.max(0, line15 - line16)

  // ── Line 21: CO income tax withheld ──────────────────────────
  const line21 = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'CO' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  // ── Line 28: Refundable Credits (CO EITC) ────────────────────
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const coEITC = Math.round(federalEITC * CO_EITC_RATE)
  const line28 = coEITC

  // ── Line 30: Subtotal payments ───────────────────────────────
  const line30 = line21 + line28

  // ── Lines 31-34: TABOR Modified AGI ──────────────────────────
  const line31 = federalAGI
  // Line 32: Nontaxable Social Security = gross SS (line6a) - taxable SS (line6b)
  const nontaxableSS = Math.max(0, (form1040.line6a.amount) - form1040.line6b.amount)
  const line32 = nontaxableSS
  // Line 33: Nontaxable interest (tax-exempt interest)
  const line33 = model.form1099INTs.reduce((sum, f) => sum + f.box8, 0)
  const line34 = line31 + line32 + line33

  // ── Line 35: TABOR State Sales Tax Refund ────────────────────
  // Only for full-year CO residents
  const line35 = residencyType === 'full-year'
    ? lookupTABORRefund(line34, model.filingStatus)
    : 0

  // ── Lines 36-39: Overpayment / Refund ────────────────────────
  const line36 = line30 + line35
  const line37 = Math.max(0, line36 - line20) // Overpayment
  const line39 = line37 // Refund (no estimated carryforward)

  // ── Lines 40-44: Net Tax Due / Amount Owed ───────────────────
  const line40 = Math.max(0, line20 - line36) // Net Tax Due
  const line44 = line40 // Amount You Owe (no penalties/interest)

  const totalCredits = line16 + line28
  const taxAfterCredits = line20
  const coSourceIncome = ratio < 1 ? Math.round(coTaxableIncomeBeforeApportion * ratio) : undefined

  return {
    // Line-level detail
    line1, line2, line9, line10, line11, line12, line15,
    line16, line20, line21, line28, line30,
    line31, line34, line35, line36, line37, line39,
    line40, line44,

    // Convenience aliases
    federalTaxableIncome: line1,
    federalAGI,
    coAdditions,
    coSubtractions,
    coTaxableIncome: line11,
    coTax: line12,

    // Subtraction detail
    usGovInterestSubtraction,
    socialSecuritySubtraction,
    pensionSubtraction,

    // Credit detail
    coEITC,
    coCTC,
    totalCredits,
    taxAfterCredits,
    taborRefund: line35,

    // Payments & result
    stateWithholding: line21,
    totalPayments: line30,
    overpaid: line37,
    amountOwed: line44,

    // Apportionment
    residencyType,
    apportionmentRatio: ratio,
    coSourceIncome,
  }
}
