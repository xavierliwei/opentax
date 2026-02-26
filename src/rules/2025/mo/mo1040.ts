/**
 * Missouri Form MO-1040 — Individual Income Tax Return
 *
 * Main orchestrator for MO state tax computation.
 * Sits downstream of federal Form 1040 — consumes Form1040Result.
 *
 * Key features:
 *  - Starts from federal AGI
 *  - Graduated tax brackets (same for all filing statuses)
 *  - Federal standard deduction pass-through
 *  - Federal tax deduction (capped at $5,000 single / $10,000 MFJ)
 *  - Social Security exemption (income-limited)
 *  - Part-year/nonresident apportionment
 *
 * Source: MO DOR Form MO-1040 Instructions
 */

import type { TaxReturn, FilingStatus, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeBracketTax } from '../taxComputation'
import {
  MO_TAX_BRACKETS,
  MO_STANDARD_DEDUCTION,
  MO_FEDERAL_TAX_DEDUCTION_CAP,
  MO_SS_EXEMPTION_AGI_LIMIT,
} from './constants'

// ── Apportionment ──────────────────────────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function computeApportionmentRatio(
  config: StateReturnConfig,
  taxYear: number,
): number {
  if (config.residencyType === 'full-year') return 1.0
  if (config.residencyType === 'nonresident') return 0.0

  // part-year: compute from move-in / move-out dates
  const daysInYear = isLeapYear(taxYear) ? 366 : 365
  const yearStartMs = Date.UTC(taxYear, 0, 1)
  const yearEndMs = Date.UTC(taxYear, 11, 31)
  const MS_PER_DAY = 86400000

  let startMs = yearStartMs
  let endMs = yearEndMs

  if (config.moveInDate) {
    const parts = config.moveInDate.split('-').map(Number)
    if (parts.length === 3) {
      const ms = Date.UTC(parts[0], parts[1] - 1, parts[2])
      if (!isNaN(ms)) startMs = ms
    }
  }
  if (config.moveOutDate) {
    const parts = config.moveOutDate.split('-').map(Number)
    if (parts.length === 3) {
      const ms = Date.UTC(parts[0], parts[1] - 1, parts[2])
      if (!isNaN(ms)) endMs = ms
    }
  }

  if (startMs < yearStartMs) startMs = yearStartMs
  if (endMs > yearEndMs) endMs = yearEndMs
  if (endMs < startMs) return 0

  const daysInState = Math.round((endMs - startMs) / MS_PER_DAY) + 1
  return Math.min(1, Math.max(0, daysInState / daysInYear))
}

// ── MO Adjustments ─────────────────────────────────────────────

export interface MOAdjustmentsResult {
  federalAGI: number

  // Additions to federal AGI
  stateIncomeTaxAddBack: number    // add back state/local income tax deduction if itemized
  additions: number                // total additions

  // Subtractions from federal AGI
  socialSecuritySubtraction: number  // SS benefits excluded from MO tax
  usBondInterestSubtraction: number  // US government bond interest (1099-INT Box 3)
  subtractions: number               // total subtractions

  moAGI: number
}

function computeMOAdjustments(
  model: TaxReturn,
  form1040: Form1040Result,
): MOAdjustmentsResult {
  const federalAGI = form1040.line11.amount

  // ── Additions ────────────────────────────────────────────
  // If taxpayer itemized federally, add back state/local income taxes
  // (since MO doesn't allow deducting state income taxes)
  const stateIncomeTaxAddBack = model.deductions.method === 'itemized'
    ? (model.deductions.itemized?.stateLocalIncomeTaxes ?? 0)
    : 0

  const additions = stateIncomeTaxAddBack

  // ── Subtractions ─────────────────────────────────────────
  // Social Security exemption: if AGI is under the threshold,
  // subtract the taxable SS benefits (line 6b) from MO income
  const filingStatus = model.filingStatus
  const ssThreshold = MO_SS_EXEMPTION_AGI_LIMIT[filingStatus]
  const taxableSS = form1040.line6b.amount
  const socialSecuritySubtraction = federalAGI <= ssThreshold ? taxableSS : 0

  // US government bond interest (exempt from state tax)
  const usBondInterestSubtraction = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3,
    0,
  )

  const subtractions = socialSecuritySubtraction + usBondInterestSubtraction

  const moAGI = federalAGI + additions - subtractions

  return {
    federalAGI,
    stateIncomeTaxAddBack,
    additions,
    socialSecuritySubtraction,
    usBondInterestSubtraction,
    subtractions,
    moAGI,
  }
}

// ── Federal Tax Deduction ──────────────────────────────────────

/**
 * Missouri allows a deduction for federal income tax paid,
 * capped at $5,000 (single) / $10,000 (MFJ) for 2025.
 */
function computeFederalTaxDeduction(
  form1040: Form1040Result,
  filingStatus: FilingStatus,
): number {
  // Federal tax liability (Line 24 total tax, but capped)
  // Use the actual total tax from the federal return
  const federalTax = Math.max(0, form1040.line24.amount)
  const cap = MO_FEDERAL_TAX_DEDUCTION_CAP[filingStatus]
  return Math.min(federalTax, cap)
}

// ── Result type ────────────────────────────────────────────────

export interface MO1040Result {
  // Income
  federalAGI: number
  moAdjustments: MOAdjustmentsResult
  moAGI: number

  // Deductions
  moStandardDeduction: number
  federalTaxDeduction: number
  totalDeductions: number

  // Tax
  moTaxableIncome: number
  moTax: number

  // Credits
  totalCredits: number
  taxAfterCredits: number

  // Payments
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number

  // Residency
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  moSourceIncome?: number
}

// ── Main Computation ───────────────────────────────────────────

export function computeMO1040(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): MO1040Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  // ── MO Adjustments (additions/subtractions) ───────────
  const moAdjustments = computeMOAdjustments(model, form1040)
  const federalAGI = moAdjustments.federalAGI
  const moAGI = moAdjustments.moAGI

  // ── Deductions ────────────────────────────────────────
  // Missouri uses federal standard deduction amounts
  const moStandardDeduction = MO_STANDARD_DEDUCTION[filingStatus]

  // Federal tax deduction (unique to MO — capped)
  const federalTaxDeduction = computeFederalTaxDeduction(form1040, filingStatus)

  const totalDeductions = moStandardDeduction + federalTaxDeduction

  // ── Taxable Income ────────────────────────────────────
  const moTaxableIncome = Math.max(0, moAGI - totalDeductions)

  // ── Tax Computation ───────────────────────────────────
  // Missouri uses graduated brackets (same for all filing statuses)
  const fullYearTax = computeBracketTax(moTaxableIncome, MO_TAX_BRACKETS)
  const moTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ───────────────────────────────────────────
  // MO does not have a state EITC or general personal credits
  // Property tax credit (Circuit Breaker) is a separate form, not implemented here
  const totalCredits = 0
  const taxAfterCredits = Math.max(0, moTax - totalCredits)

  // ── Payments ──────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w) => {
    if (w.box15State === 'MO') return sum + (w.box17StateIncomeTax ?? 0)
    return sum
  }, 0)

  const totalPayments = stateWithholding

  const overpaid = totalPayments > taxAfterCredits
    ? totalPayments - taxAfterCredits
    : 0
  const amountOwed = taxAfterCredits > totalPayments
    ? taxAfterCredits - totalPayments
    : 0

  const moSourceIncome = ratio < 1.0
    ? Math.round(moAGI * ratio)
    : undefined

  return {
    federalAGI,
    moAdjustments,
    moAGI,
    moStandardDeduction,
    federalTaxDeduction,
    totalDeductions,
    moTaxableIncome,
    moTax,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    moSourceIncome,
  }
}
