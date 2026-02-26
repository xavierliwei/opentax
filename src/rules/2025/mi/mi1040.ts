/**
 * Michigan Form MI-1040 — Individual Income Tax Return
 *
 * Michigan uses a flat 4.25% tax rate applied to taxable income.
 * Starting point is federal AGI. Additions and subtractions adjust to MI AGI.
 * Personal exemptions ($5,600 each) reduce taxable income.
 *
 * Key features implemented:
 * - Full-year resident computation
 * - Part-year/nonresident apportionment (day-based)
 * - Personal exemptions (taxpayer + spouse + dependents)
 * - Additions: interest/dividends from other state obligations
 * - Subtractions: US gov bond interest, Social Security exemption
 * - MI EITC (30% of federal EITC)
 * - State withholding from W-2 Box 17
 *
 * Sources:
 * - 2024 MI-1040 instructions
 * - MCL 206.30 (rate), MCL 206.30(1) (exemption)
 * - MCL 206.272 (EITC at 30%)
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  MI_FLAT_TAX_RATE,
  MI_PERSONAL_EXEMPTION,
  MI_EITC_RATE,
} from './constants'

// ── Result interface ──────────────────────────────────────────

export interface MI1040Result {
  federalAGI: number

  // Additions to income
  miAdditions: number
  otherStateObligationInterest: number

  // Subtractions from income
  miSubtractions: number
  ssExemption: number
  usGovInterest: number

  miAGI: number

  // Exemptions
  personalExemptions: number
  numExemptions: number

  miTaxableIncome: number
  miTax: number

  // Credits
  miEITC: number
  totalCredits: number
  taxAfterCredits: number

  // Payments
  stateWithholding: number
  totalPayments: number

  // Result
  overpaid: number
  amountOwed: number

  // Residency
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  miSourceIncome?: number
}

// ── Apportionment ─────────────────────────────────────────────

export function computeMIApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
  if (config.residencyType === 'full-year') return 1
  if (config.residencyType === 'nonresident') return 0

  // Part-year: day-based proration
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

// ── Main computation ──────────────────────────────────────────

export function computeMI1040(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): MI1040Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeMIApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── MI Additions ────────────────────────────────────────────
  // Interest/dividends from obligations of other states/municipalities
  // (tax-exempt on federal return but taxable to MI)
  // This is typically reported by the taxpayer; for now, we set to 0
  // as the model doesn't have a dedicated field for state/local bond interest.
  const otherStateObligationInterest = 0
  const miAdditions = otherStateObligationInterest

  // ── MI Subtractions ─────────────────────────────────────────
  // Social Security benefits: Michigan fully exempts SS income
  const ssExemption = form1040.line6b.amount

  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  // These are taxable on federal but exempt from MI tax
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const miSubtractions = ssExemption + usGovInterest

  // ── MI AGI ──────────────────────────────────────────────────
  const miAGI = federalAGI + miAdditions - miSubtractions

  // ── Personal Exemptions ─────────────────────────────────────
  // Count exemptions: taxpayer + spouse (if MFJ) + dependents
  let numExemptions = 1 // taxpayer
  if (model.filingStatus === 'mfj' && model.spouse) {
    numExemptions += 1  // spouse
  }
  numExemptions += model.dependents.length

  const personalExemptions = numExemptions * MI_PERSONAL_EXEMPTION

  // ── MI Taxable Income ───────────────────────────────────────
  const miTaxableIncome = Math.max(0, miAGI - personalExemptions)

  // ── MI Tax ──────────────────────────────────────────────────
  const fullYearTax = Math.round(miTaxableIncome * MI_FLAT_TAX_RATE)
  const miTax = ratio < 1 ? Math.round(fullYearTax * ratio) : fullYearTax

  // ── Credits ─────────────────────────────────────────────────
  // MI EITC: 30% of federal EITC (refundable)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const miEITC = Math.round(federalEITC * MI_EITC_RATE)

  // Nonrefundable credits (capped at tax)
  const nonrefundableCredits = 0
  const taxAfterNonrefundable = Math.max(0, miTax - nonrefundableCredits)

  // Refundable credits (applied after nonrefundable, can create refund)
  const totalCredits = nonrefundableCredits + miEITC
  const taxAfterCredits = Math.max(0, taxAfterNonrefundable - miEITC)

  // ── Payments ────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'MI' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + miEITC

  // ── Result ──────────────────────────────────────────────────
  const overpaid = Math.max(0, totalPayments - taxAfterNonrefundable)
  const amountOwed = Math.max(0, taxAfterNonrefundable - totalPayments)

  const miSourceIncome = ratio < 1 ? Math.round(miAGI * ratio) : undefined

  return {
    federalAGI,
    miAdditions,
    otherStateObligationInterest,
    miSubtractions,
    ssExemption,
    usGovInterest,
    miAGI,
    personalExemptions,
    numExemptions,
    miTaxableIncome,
    miTax,
    miEITC,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    miSourceIncome,
  }
}
