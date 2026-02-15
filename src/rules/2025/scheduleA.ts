/**
 * Schedule A — Itemized Deductions
 *
 * Applies IRS rules to raw itemized deduction inputs:
 * - Medical expenses: only the amount exceeding 7.5% of AGI (IRC §213)
 * - SALT: capped at $40,000 ($20,000 MFS) with phase-out (IRC §164(b)(6), OBBBA §70120)
 * - Mortgage interest, charitable, other: pass-through
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
} from './constants'

// ── Schedule A result ────────────────────────────────────────

export interface ScheduleAResult {
  // Medical and Dental Expenses (Lines 1–4)
  line1: TracedValue    // raw medical expenses
  line2: TracedValue    // AGI (from Form 1040 Line 11)
  line3: TracedValue    // 7.5% of AGI
  line4: TracedValue    // max(0, line1 - line3)

  // Taxes You Paid (Lines 5–7)
  line5e: TracedValue   // total state/local taxes (before cap)
  line7: TracedValue    // min(line5e, SALT_CAP)

  // Interest You Paid (Lines 8–10)
  line10: TracedValue   // mortgage interest

  // Gifts to Charity (Lines 11–14)
  line14: TracedValue   // total charitable contributions

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
 * Compute Schedule A from the tax return model and AGI.
 *
 * Requires `model.deductions.itemized` to be present.
 * If not present, returns all-zero result.
 */
export function computeScheduleA(model: TaxReturn, agi: number): ScheduleAResult {
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

  // ── SALT (Lines 5–7) ───────────────────────────────────

  const line5e = tracedFromComputation(
    d.stateLocalTaxes,
    'scheduleA.line5e',
    ['itemized.stateLocalTaxes'],
    'Schedule A, Line 5e',
  )

  const effectiveSaltCap = computeSaltCap(model.filingStatus, agi)
  const saltDeduction = Math.min(d.stateLocalTaxes, effectiveSaltCap)
  const line7 = tracedFromComputation(
    saltDeduction,
    'scheduleA.line7',
    ['scheduleA.line5e'],
    'Schedule A, Line 7',
  )

  // ── Interest (Lines 8–10) ──────────────────────────────

  const line10 = tracedFromComputation(
    d.mortgageInterest,
    'scheduleA.line10',
    ['itemized.mortgageInterest'],
    'Schedule A, Line 10',
  )

  // ── Charitable (Lines 11–14) ───────────────────────────

  const charitableTotal = d.charitableCash + d.charitableNoncash
  const line14 = tracedFromComputation(
    charitableTotal,
    'scheduleA.line14',
    ['itemized.charitableCash', 'itemized.charitableNoncash'],
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

  const total = medicalDeduction + saltDeduction + d.mortgageInterest + charitableTotal + d.otherDeductions
  const line17 = tracedFromComputation(
    total,
    'scheduleA.line17',
    ['scheduleA.line4', 'scheduleA.line7', 'scheduleA.line10', 'scheduleA.line14', 'scheduleA.line16'],
    'Schedule A, Line 17',
  )

  return { line1, line2, line3, line4, line5e, line7, line10, line14, line16, line17 }
}

/** All-zero Schedule A (when no itemized data is present). */
function zeroScheduleA(agi: number): ScheduleAResult {
  return {
    line1: tracedZero('scheduleA.line1', 'Schedule A, Line 1'),
    line2: tracedFromComputation(agi, 'scheduleA.line2', ['form1040.line11'], 'Schedule A, Line 2'),
    line3: tracedFromComputation(Math.round(agi * MEDICAL_AGI_FLOOR_RATE), 'scheduleA.line3', ['scheduleA.line2'], 'Schedule A, Line 3'),
    line4: tracedZero('scheduleA.line4', 'Schedule A, Line 4'),
    line5e: tracedZero('scheduleA.line5e', 'Schedule A, Line 5e'),
    line7: tracedZero('scheduleA.line7', 'Schedule A, Line 7'),
    line10: tracedZero('scheduleA.line10', 'Schedule A, Line 10'),
    line14: tracedZero('scheduleA.line14', 'Schedule A, Line 14'),
    line16: tracedZero('scheduleA.line16', 'Schedule A, Line 16'),
    line17: tracedZero('scheduleA.line17', 'Schedule A, Line 17'),
  }
}
