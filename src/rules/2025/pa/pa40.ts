/**
 * PA-40 — Pennsylvania Personal Income Tax Return
 *
 * Main computation orchestrator. Classifies income into 8 classes,
 * applies deductions, computes flat tax, credits, and withholding.
 *
 * Source: 2025 PA-40 Instructions
 * All amounts in integer cents.
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { PA_TAX_RATE, PA_529_DEDUCTION_LIMIT_PER_BENEFICIARY } from './constants'
import { classifyPAIncome, sumPositiveClasses } from './incomeClasses'
import { computeScheduleSP } from './scheduleSP'
import type { PAIncomeClasses } from './incomeClasses'
import type { ScheduleSPResult } from './scheduleSP'

// ── Result type ──────────────────────────────────────────────

export interface PA40Result {
  residencyType: 'full-year' | 'part-year' | 'nonresident'

  // Income (Part I)
  incomeClasses: PAIncomeClasses
  totalPATaxableIncome: number  // Line 9: sum of positive classes
  deductions529: number         // Line 10: IRC §529 contributions
  adjustedTaxableIncome: number // Line 11: Line 9 - Line 10

  // Tax (Part II)
  paTax: number                 // Line 12: Line 11 × 3.07%
  residentCredit: number        // Line 14: credit for taxes paid to other states
  otherCredits: number          // Line 15
  taxForgiveness: ScheduleSPResult  // Line 16: Schedule SP
  totalCredits: number          // Line 17
  taxAfterCredits: number       // Line 18

  // Payments (Part III)
  stateWithholding: number      // Line 23: W-2 Box 17 (PA)
  estimatedPayments: number     // Line 24
  totalPayments: number         // Line 27

  // Result (Part IV)
  overpaid: number              // Line 28
  amountOwed: number            // Line 30

  // Part-year apportionment
  apportionmentRatio: number    // days in PA / days in year (1.0 for full-year)
}

// ── Helpers ──────────────────────────────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Compute part-year apportionment ratio (days in PA / days in year).
 * Returns 1.0 for full-year, 0.0 for nonresident.
 */
export function computeApportionmentRatio(
  config: StateReturnConfig,
  taxYear: number,
): number {
  if (config.residencyType === 'full-year') return 1.0
  if (config.residencyType === 'nonresident') return 0.0

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
  return Math.min(1.0, Math.max(0, daysInState / daysInYear))
}

/**
 * Compute §529 deduction (Line 10).
 * Cap at $18,000 per beneficiary ($36,000 MFJ).
 * Phase 1: single beneficiary assumed.
 */
function compute529Deduction(config: StateReturnConfig): number {
  const contributed = config.contributions529 ?? 0
  if (contributed <= 0) return 0
  return Math.min(contributed, PA_529_DEDUCTION_LIMIT_PER_BENEFICIARY)
}

/**
 * Sum PA withholding from all W-2s where Box 15 = "PA".
 */
function sumPAWithholding(model: TaxReturn): number {
  return model.w2s.reduce((sum, w) => {
    if (w.box15State === 'PA') return sum + (w.box17StateIncomeTax ?? 0)
    return sum
  }, 0)
}

// ── Main computation ────────────────────────────────────────

export function computePA40(
  model: TaxReturn,
  _federal: Form1040Result,
  config: StateReturnConfig,
): PA40Result {
  const residencyType = config.residencyType

  // Step 1: Classify income into PA's 8 classes
  const incomeClasses = classifyPAIncome(model, config)

  // Step 2: Sum positive classes only (losses don't offset other classes)
  const totalPATaxableIncome = sumPositiveClasses(incomeClasses)

  // Step 3: Apply deductions (§529 only in Phase 1)
  const deductions529 = compute529Deduction(config)
  const adjustedTaxableIncome = Math.max(0, totalPATaxableIncome - deductions529)

  // Step 4: Compute flat tax
  let paTax = Math.round(adjustedTaxableIncome * PA_TAX_RATE)

  // Step 5: Part-year apportionment
  const apportionmentRatio = computeApportionmentRatio(config, model.taxYear)
  if (residencyType === 'part-year') {
    paTax = Math.round(paTax * apportionmentRatio)
  }

  // Step 6: Credits
  const residentCredit = 0  // Phase 2
  const otherCredits = 0
  const taxForgiveness = computeScheduleSP(model, adjustedTaxableIncome, paTax)
  const totalCredits = residentCredit + otherCredits + taxForgiveness.forgivenessCredit
  const taxAfterCredits = Math.max(0, paTax - totalCredits)

  // Step 7: Withholding & payments
  const stateWithholding = sumPAWithholding(model)
  const estimatedPayments = 0  // Not yet modeled
  const totalPayments = stateWithholding + estimatedPayments

  // Step 8: Refund or owed
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  return {
    residencyType,
    incomeClasses,
    totalPATaxableIncome,
    deductions529,
    adjustedTaxableIncome,
    paTax,
    residentCredit,
    otherCredits,
    taxForgiveness,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    estimatedPayments,
    totalPayments,
    overpaid,
    amountOwed,
    apportionmentRatio,
  }
}
