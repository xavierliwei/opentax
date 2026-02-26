/**
 * Utah Form TC-40 — Individual Income Tax Return
 *
 * Utah starts from federal AGI and applies a flat 4.55% tax rate.
 * Unlike most states, Utah has NO standard deduction. Instead it uses a unique
 * "Taxpayer Tax Credit" system that functions as a deduction equivalent:
 *
 *   Credit = 6% × (federal standard/itemized deductions + personal exemptions)
 *
 * The credit phases out for higher incomes (above $15,548 single / $31,096 MFJ),
 * reduced by 1.3 cents per dollar over the threshold.
 *
 * Key features:
 * - Flat 4.55% rate on all taxable income (no brackets)
 * - Taxpayer Tax Credit (deduction equivalent)
 * - UT EITC: 20% of federal EITC
 * - Social Security and retirement income partially exempted via credit (stub)
 * - Part-year/nonresident apportionment by days in state
 */

import type { TaxReturn, StateReturnConfig, FilingStatus } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  UT_FLAT_TAX_RATE,
  UT_TAXPAYER_TAX_CREDIT_RATE,
  UT_PERSONAL_EXEMPTION,
  UT_CREDIT_PHASEOUT_THRESHOLD,
  UT_CREDIT_PHASEOUT_RATE,
  UT_EITC_RATE,
} from './constants'

export interface TC40Result {
  federalAGI: number

  // Utah taxable income (same as federal AGI — no additions/subtractions in basic flow)
  utAdditions: number
  utSubtractions: number
  utAdjustedIncome: number

  // Tax
  utTaxableIncome: number           // after apportionment
  utTaxBeforeCredits: number        // flat 4.55%

  // Taxpayer Tax Credit
  federalDeduction: number          // federal standard or itemized deduction amount
  personalExemptionCount: number
  personalExemptionTotal: number
  taxpayerTaxCreditBase: number     // deduction + exemptions
  taxpayerTaxCreditGross: number    // 6% of base
  taxpayerTaxCreditPhaseout: number // reduction for high income
  taxpayerTaxCredit: number         // final credit after phaseout

  // Other credits
  utEITC: number                    // 20% of federal EITC
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
  utSourceIncome?: number
}

export function computeUTApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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
 * Compute the Utah Taxpayer Tax Credit.
 *
 * Credit = 6% × (federal deductions + personal exemptions)
 * Phaseout: reduced by 1.3 cents per dollar of state taxable income above threshold.
 */
function computeTaxpayerTaxCredit(
  federalDeduction: number,
  personalExemptionTotal: number,
  utTaxableIncome: number,
  filingStatus: FilingStatus,
): { gross: number; phaseout: number; net: number } {
  const base = federalDeduction + personalExemptionTotal
  const gross = Math.round(base * UT_TAXPAYER_TAX_CREDIT_RATE)

  const threshold = UT_CREDIT_PHASEOUT_THRESHOLD[filingStatus]
  let phaseout = 0

  if (utTaxableIncome > threshold) {
    // Phaseout: 1.3 cents per dollar over threshold
    // Income is in cents, threshold is in cents
    const excessDollars = (utTaxableIncome - threshold) / 100
    phaseout = Math.round(excessDollars * UT_CREDIT_PHASEOUT_RATE * 100)
  }

  const net = Math.max(0, gross - phaseout)
  return { gross, phaseout, net }
}

export function computeTC40(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): TC40Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeUTApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── UT Additions ─────────────────────────────────────────────
  // Minimal for initial implementation — most income flows through
  const utAdditions = 0

  // ── UT Subtractions ──────────────────────────────────────────
  // State tax refund included in federal AGI (1099-G Box 2)
  const stateTaxRefundSubtraction = (model.priorYear?.itemizedLastYear ?? false)
    ? model.form1099Gs.reduce((sum, g) => sum + g.box2, 0)
    : 0

  const utSubtractions = stateTaxRefundSubtraction

  // ── UT Adjusted Income ───────────────────────────────────────
  const utAdjustedIncome = Math.max(0, federalAGI + utAdditions - utSubtractions)

  // ── Taxable Income (with apportionment for part-year/NR) ────
  const utTaxableIncome = ratio < 1
    ? Math.round(utAdjustedIncome * ratio)
    : utAdjustedIncome

  // ── UT Tax ───────────────────────────────────────────────────
  const utTaxBeforeCredits = Math.round(utTaxableIncome * UT_FLAT_TAX_RATE)

  // ── Taxpayer Tax Credit ──────────────────────────────────────
  // Federal deduction: line 12 is the standard or itemized deduction
  const federalDeduction = form1040.line12.amount

  // Personal exemption count: taxpayer + spouse (if MFJ) + dependents
  let personalExemptionCount = 1  // taxpayer
  if (model.filingStatus === 'mfj' && model.spouse) {
    personalExemptionCount += 1   // spouse
  }
  personalExemptionCount += model.dependents.length

  const personalExemptionTotal = personalExemptionCount * UT_PERSONAL_EXEMPTION

  const creditResult = computeTaxpayerTaxCredit(
    federalDeduction,
    personalExemptionTotal,
    utTaxableIncome,
    model.filingStatus,
  )

  const taxpayerTaxCreditBase = federalDeduction + personalExemptionTotal

  // Apply apportionment to credit for part-year/NR
  const taxpayerTaxCredit = ratio < 1
    ? Math.round(creditResult.net * ratio)
    : creditResult.net

  // ── Other Credits ────────────────────────────────────────────

  // UT Earned Income Credit: 20% of federal EITC
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const utEITC = Math.round(federalEITC * UT_EITC_RATE)

  const totalCredits = taxpayerTaxCredit + utEITC

  // Tax after credits (credits cannot reduce below zero)
  const taxAfterCredits = Math.max(0, utTaxBeforeCredits - totalCredits)

  // ── Withholding ──────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'UT' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding

  // ── Result ───────────────────────────────────────────────────
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const utSourceIncome = ratio < 1 ? Math.round(utAdjustedIncome * ratio) : undefined

  return {
    federalAGI,
    utAdditions,
    utSubtractions,
    utAdjustedIncome,
    utTaxableIncome,
    utTaxBeforeCredits,
    federalDeduction,
    personalExemptionCount,
    personalExemptionTotal,
    taxpayerTaxCreditBase,
    taxpayerTaxCreditGross: creditResult.gross,
    taxpayerTaxCreditPhaseout: creditResult.phaseout,
    taxpayerTaxCredit,
    utEITC,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    utSourceIncome,
  }
}
