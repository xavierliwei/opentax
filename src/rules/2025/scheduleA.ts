/**
 * Schedule A — Itemized Deductions
 *
 * Applies IRS rules to raw itemized deduction inputs:
 * - Medical expenses: only the amount exceeding 7.5% of AGI (IRC §213)
 * - SALT: income/sales tax election; capped with phase-out (IRC §164(b)(6), OBBBA §70120)
 * - Mortgage interest: proportionally limited by $750K/$1M loan balance cap (IRC §163(h)(3))
 * - Investment interest: limited to net investment income (IRC §163(d), Form 4952 simplified)
 * - Charitable: 60%/30% AGI limits (IRC §170(b))
 * - Other deductions: pass-through
 *
 * Source: 2025 Schedule A (Form 1040) instructions
 */

import type { TaxReturn } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation, tracedZero } from '../../model/traced'
import {
  MEDICAL_AGI_FLOOR_RATE,
  SALT_BASE_CAP,
  SALT_PHASEOUT_THRESHOLD,
  SALT_PHASEOUT_RATE,
  SALT_FLOOR,
  MORTGAGE_LIMIT_POST_TCJA,
  MORTGAGE_LIMIT_PRE_TCJA,
  CHARITABLE_CASH_AGI_LIMIT,
  CHARITABLE_NONCASH_AGI_LIMIT,
} from './constants'

// ── Schedule A result ────────────────────────────────────────

export interface ScheduleAResult {
  // Medical and Dental Expenses (Lines 1–4)
  line1: TracedValue    // raw medical expenses
  line2: TracedValue    // AGI (from Form 1040 Line 11)
  line3: TracedValue    // 7.5% of AGI
  line4: TracedValue    // max(0, line1 - line3)

  // Taxes You Paid (Lines 5a–7)
  line5a: TracedValue   // max(stateLocalIncomeTaxes, stateLocalSalesTaxes)
  line5b: TracedValue   // realEstateTaxes (IRS Schedule A Line 5b)
  line5c: TracedValue   // personalPropertyTaxes (IRS Schedule A Line 5c)
  line5e: TracedValue   // 5a + 5b + 5c (total SALT before cap)
  line7:  TracedValue   // min(5e, effectiveSaltCap)

  // Interest You Paid (Lines 8a, 9, 10)
  line8a: TracedValue   // deductible home mortgage interest (after $750K/$1M cap)
  line9:  TracedValue   // deductible investment interest (limited to net investment income)
  line10: TracedValue   // line8a + line9

  // Gifts to Charity (Lines 11, 12, 14)
  line11: TracedValue   // cash charitable (60% AGI limited)
  line12: TracedValue   // non-cash charitable (30% AGI limited)
  line14: TracedValue   // total charitable (overall 60% AGI cap)

  // Other Deductions (Lines 15–16)
  line16: TracedValue   // other itemized deductions

  // Total Itemized Deductions
  line17: TracedValue   // sum of lines 4 + 7 + 10 + 14 + 16
}

// ── SALT cap with phase-out ──────────────────────────────────
// One Big Beautiful Bill Act §70120:
//   effectiveCap = max(floor, baseCap − 0.30 × max(0, MAGI − threshold))
// For most filers, MAGI ≈ AGI.

export function computeSaltCap(filingStatus: TaxReturn['filingStatus'], magi: number): number {
  const baseCap = SALT_BASE_CAP[filingStatus]
  const threshold = SALT_PHASEOUT_THRESHOLD[filingStatus]
  const floor = SALT_FLOOR[filingStatus]

  const excess = Math.max(0, magi - threshold)
  const reduction = Math.round(excess * SALT_PHASEOUT_RATE)
  return Math.max(floor, baseCap - reduction)
}

// ── Computation ──────────────────────────────────────────────

/**
 * Compute Schedule A from the tax return model, AGI, and net investment income.
 *
 * Requires `model.deductions.itemized` to be present.
 * If not present, returns all-zero result.
 *
 * @param netInvestmentIncome - used to limit investment interest deduction (Form 4952 simplified)
 */
export function computeScheduleA(
  model: TaxReturn,
  agi: number,
  netInvestmentIncome: number,
): ScheduleAResult {
  const d = model.deductions.itemized

  if (!d) {
    return zeroScheduleA(agi)
  }

  // ── Medical (Lines 1–4) ─────────────────────────────────

  const line1 = tracedFromComputation(
    d.medicalExpenses,
    'scheduleA.line1',
    ['itemized.medicalExpenses'],
    'Schedule A, Line 1',
  )

  const line2 = tracedFromComputation(
    agi,
    'scheduleA.line2',
    ['form1040.line11'],
    'Schedule A, Line 2',
  )

  const floorAmount = Math.round(agi * MEDICAL_AGI_FLOOR_RATE)
  const line3 = tracedFromComputation(
    floorAmount,
    'scheduleA.line3',
    ['scheduleA.line2'],
    'Schedule A, Line 3',
  )

  const medicalDeduction = Math.max(0, d.medicalExpenses - floorAmount)
  const line4 = tracedFromComputation(
    medicalDeduction,
    'scheduleA.line4',
    ['scheduleA.line1', 'scheduleA.line3'],
    'Schedule A, Line 4',
  )

  // ── SALT (Lines 5a–7) ──────────────────────────────────
  // Line 5a: taxpayer elects the higher of state income tax or sales tax (IRC §164(b)(5))

  const electedSalt = Math.max(d.stateLocalIncomeTaxes, d.stateLocalSalesTaxes)
  const line5a = tracedFromComputation(
    electedSalt,
    'scheduleA.line5a',
    ['itemized.stateLocalIncomeTaxes', 'itemized.stateLocalSalesTaxes'],
    'Schedule A, Line 5a',
  )

  const line5b = tracedFromComputation(
    d.realEstateTaxes,
    'scheduleA.line5b',
    ['itemized.realEstateTaxes'],
    'Schedule A, Line 5b',
  )

  const line5c = tracedFromComputation(
    d.personalPropertyTaxes,
    'scheduleA.line5c',
    ['itemized.personalPropertyTaxes'],
    'Schedule A, Line 5c',
  )

  const saltTotal = electedSalt + d.realEstateTaxes + d.personalPropertyTaxes
  const line5e = tracedFromComputation(
    saltTotal,
    'scheduleA.line5e',
    ['scheduleA.line5a', 'scheduleA.line5b', 'scheduleA.line5c'],
    'Schedule A, Line 5e',
  )

  const effectiveSaltCap = computeSaltCap(model.filingStatus, agi)
  const saltDeduction = Math.min(saltTotal, effectiveSaltCap)
  const line7 = tracedFromComputation(
    saltDeduction,
    'scheduleA.line7',
    ['scheduleA.line5e'],
    'Schedule A, Line 7',
  )

  // ── Mortgage Interest (Line 8a) — IRC §163(h)(3) ───────
  // If loan balance exceeds limit, only the proportional share of interest is deductible.
  // If principal is 0 (user didn't fill it in), pass interest through unchanged.

  const loanLimit = d.mortgagePreTCJA
    ? MORTGAGE_LIMIT_PRE_TCJA[model.filingStatus]
    : MORTGAGE_LIMIT_POST_TCJA[model.filingStatus]

  const deductibleMortgage = (d.mortgagePrincipal > 0 && d.mortgagePrincipal > loanLimit)
    ? Math.round(d.mortgageInterest * loanLimit / d.mortgagePrincipal)
    : d.mortgageInterest

  const line8a = tracedFromComputation(
    deductibleMortgage,
    'scheduleA.line8a',
    ['itemized.mortgageInterest'],
    'Schedule A, Line 8a',
  )

  // ── Investment Interest (Line 9) — IRC §163(d) ─────────
  // Deductible only up to net investment income (Form 4952 simplified).
  // Excess is silently zeroed (no current-year carryover in MVP).

  const investDeductible = Math.min(d.investmentInterest, Math.max(0, netInvestmentIncome))
  const line9 = tracedFromComputation(
    investDeductible,
    'scheduleA.line9',
    ['itemized.investmentInterest'],
    'Schedule A, Line 9',
  )

  const line10 = tracedFromComputation(
    deductibleMortgage + investDeductible,
    'scheduleA.line10',
    ['scheduleA.line8a', 'scheduleA.line9'],
    'Schedule A, Line 10',
  )

  // ── Charitable (Lines 11–14) — IRC §170(b) ─────────────

  const cashDeductible = Math.min(d.charitableCash, Math.round(agi * CHARITABLE_CASH_AGI_LIMIT))
  const line11 = tracedFromComputation(
    cashDeductible,
    'scheduleA.line11',
    ['itemized.charitableCash'],
    'Schedule A, Line 11',
  )

  const noncashDeductible = Math.min(d.charitableNoncash, Math.round(agi * CHARITABLE_NONCASH_AGI_LIMIT))
  const line12 = tracedFromComputation(
    noncashDeductible,
    'scheduleA.line12',
    ['itemized.charitableNoncash'],
    'Schedule A, Line 12',
  )

  const totalCharitable = Math.min(
    cashDeductible + noncashDeductible,
    Math.round(agi * CHARITABLE_CASH_AGI_LIMIT),
  )
  const line14 = tracedFromComputation(
    totalCharitable,
    'scheduleA.line14',
    ['scheduleA.line11', 'scheduleA.line12'],
    'Schedule A, Line 14',
  )

  // ── Other (Lines 15–16) ────────────────────────────────

  const line16 = tracedFromComputation(
    d.otherDeductions,
    'scheduleA.line16',
    ['itemized.otherDeductions'],
    'Schedule A, Line 16',
  )

  // ── Total (Line 17) ───────────────────────────────────

  const total = medicalDeduction + saltDeduction + deductibleMortgage + investDeductible + totalCharitable + d.otherDeductions
  const line17 = tracedFromComputation(
    total,
    'scheduleA.line17',
    ['scheduleA.line4', 'scheduleA.line7', 'scheduleA.line10', 'scheduleA.line14', 'scheduleA.line16'],
    'Schedule A, Line 17',
  )

  return {
    line1, line2, line3, line4,
    line5a, line5b, line5c, line5e, line7,
    line8a, line9, line10,
    line11, line12, line14,
    line16, line17,
  }
}

/** All-zero Schedule A (when no itemized data is present). */
function zeroScheduleA(agi: number): ScheduleAResult {
  return {
    line1:  tracedZero('scheduleA.line1', 'Schedule A, Line 1'),
    line2:  tracedFromComputation(agi, 'scheduleA.line2', ['form1040.line11'], 'Schedule A, Line 2'),
    line3:  tracedFromComputation(Math.round(agi * MEDICAL_AGI_FLOOR_RATE), 'scheduleA.line3', ['scheduleA.line2'], 'Schedule A, Line 3'),
    line4:  tracedZero('scheduleA.line4', 'Schedule A, Line 4'),
    line5a: tracedZero('scheduleA.line5a', 'Schedule A, Line 5a'),
    line5b: tracedZero('scheduleA.line5b', 'Schedule A, Line 5b'),
    line5c: tracedZero('scheduleA.line5c', 'Schedule A, Line 5c'),
    line5e: tracedZero('scheduleA.line5e', 'Schedule A, Line 5e'),
    line7:  tracedZero('scheduleA.line7', 'Schedule A, Line 7'),
    line8a: tracedZero('scheduleA.line8a', 'Schedule A, Line 8a'),
    line9:  tracedZero('scheduleA.line9', 'Schedule A, Line 9'),
    line10: tracedZero('scheduleA.line10', 'Schedule A, Line 10'),
    line11: tracedZero('scheduleA.line11', 'Schedule A, Line 11'),
    line12: tracedZero('scheduleA.line12', 'Schedule A, Line 12'),
    line14: tracedZero('scheduleA.line14', 'Schedule A, Line 14'),
    line16: tracedZero('scheduleA.line16', 'Schedule A, Line 16'),
    line17: tracedZero('scheduleA.line17', 'Schedule A, Line 17'),
  }
}
