/**
 * Form 8582 — Passive Activity Loss Limitations
 *
 * IRC §469: Passive activity losses may only offset passive activity income.
 * Special allowance (§469(i)): Up to $25,000 of rental real estate losses
 * can offset non-passive income for taxpayers who actively participate.
 *
 * Phase-out: $25,000 allowance reduced by 50% of MAGI over $100,000.
 * MFS (lived together): $0 allowance.
 * MFS (lived apart all year): $12,500 allowance, phased out $50,000–$75,000.
 *
 * This module computes the Form 8582 line items from Schedule E results.
 * The actual PAL math is already in scheduleE.ts — this module structures
 * the result into Form 8582 line items for PDF filling and display.
 *
 * All amounts are in integer cents.
 */

import type { FilingStatus } from '../../model/types'
import type { ScheduleEResult } from './scheduleE'
import {
  PAL_SPECIAL_ALLOWANCE,
  PAL_PHASEOUT_START,
  PAL_PHASEOUT_RANGE,
} from './constants'

// ── Result type ──────────────────────────────────────────────────

export interface Form8582Result {
  /** Whether Form 8582 is needed (net rental loss exists) */
  required: boolean

  // Part I — 2025 Passive Activity Loss
  // Rental Activities With Active Participation
  /** Line 1a: Activities with net loss (negative, from Schedule E) */
  line1a: number
  /** Line 1b: Activities with net income (positive, from Schedule E) */
  line1b: number
  /** Line 1c: Combine lines 1a and 1b */
  line1c: number
  /** Line 3: Combine lines 1c and 2c (line 2 = 0 for rental-only) */
  line3: number
  /** Line 4: line 3 if negative, otherwise 0 */
  line4: number

  // Part II — Special Allowance for Rental Real Estate Activities
  /** Line 5: $150,000 ($75,000 MFS) — ceiling for phase-out */
  line5: number
  /** Line 6: Modified adjusted gross income (MAGI) */
  line6: number
  /** Line 7: Line 5 minus Line 6 (0 if negative) */
  line7: number
  /** Line 8: Multiply Line 7 by 50% */
  line8: number
  /** Line 9: $25,000 ($12,500 MFS) — maximum special allowance */
  line9: number
  /** Line 10: Smaller of Line 8 or Line 9 */
  line10: number

  // Part III not computed (only for credit carryovers, not common)

  // Summary
  /** Allowable passive activity loss (flows to Schedule E Line 25) */
  allowableLoss: number
  /** Suspended (disallowed) loss — carried forward to future years */
  suspendedLoss: number
  /** Total net passive activity income or loss before limitation */
  totalNetPassiveActivity: number
}

// ── Computation ──────────────────────────────────────────────────

/**
 * Compute Form 8582 line items from Schedule E result and filing context.
 *
 * @param scheduleE  Result from computeScheduleE
 * @param agi        Pre-PAL AGI (MAGI for Form 8582 purposes)
 * @param filingStatus Filing status
 * @param mfsLivedApart True if MFS and taxpayers lived apart all year
 * @returns Form8582Result with all line items
 */
export function computeForm8582(
  scheduleE: ScheduleEResult,
  agi: number,
  filingStatus: FilingStatus,
  mfsLivedApart: boolean = false,
): Form8582Result {
  const totalNet = scheduleE.line23a.amount

  // If net gain or zero, Form 8582 not required
  if (totalNet >= 0) {
    return {
      required: false,
      line1a: 0,
      line1b: 0,
      line1c: 0,
      line3: 0,
      line4: 0,
      line5: 0,
      line6: 0,
      line7: 0,
      line8: 0,
      line9: 0,
      line10: 0,
      allowableLoss: 0,
      suspendedLoss: 0,
      totalNetPassiveActivity: totalNet,
    }
  }

  // Separate properties into net loss and net income groups
  let totalLossProperties = 0
  let totalIncomeProperties = 0
  for (const prop of scheduleE.properties) {
    const net = prop.netIncome.amount
    if (net < 0) {
      totalLossProperties += net  // negative
    } else {
      totalIncomeProperties += net  // positive
    }
  }

  // Part I
  const line1a = totalLossProperties    // negative
  const line1b = totalIncomeProperties  // positive
  const line1c = line1a + line1b        // net (should match totalNet)
  const line3 = line1c                  // no line 2 for rental-only
  const line4 = line3 < 0 ? line3 : 0  // only if loss

  // Part II — Special Allowance
  // Determine effective thresholds based on filing status and MFS status
  let effectivePhaseoutCeiling: number
  let effectiveAllowance: number
  let effectivePhaseoutStart: number

  if (filingStatus === 'mfs') {
    if (mfsLivedApart) {
      // MFS lived apart: $12,500 allowance, phased out $50,000–$75,000
      effectiveAllowance = 1250000   // $12,500 in cents
      effectivePhaseoutStart = 5000000  // $50,000 in cents
      effectivePhaseoutCeiling = 7500000  // $75,000 in cents
    } else {
      // MFS lived together: $0 allowance
      effectiveAllowance = 0
      effectivePhaseoutStart = 0
      effectivePhaseoutCeiling = 0
    }
  } else {
    effectiveAllowance = PAL_SPECIAL_ALLOWANCE    // $25,000
    effectivePhaseoutStart = PAL_PHASEOUT_START[filingStatus]  // $100,000
    effectivePhaseoutCeiling = effectivePhaseoutStart + PAL_PHASEOUT_RANGE  // $150,000
  }

  const line5 = effectivePhaseoutCeiling
  const line6 = agi
  const line7 = Math.max(0, line5 - line6)
  const line8 = Math.round(line7 * 0.50)
  const line9 = effectiveAllowance
  const line10 = Math.min(line8, line9)

  // Allowable loss: minimum of |net loss| and special allowance
  const absLoss = Math.abs(line4)
  const allowableLoss = Math.min(absLoss, line10)
  const suspendedLoss = absLoss - allowableLoss

  return {
    required: true,
    line1a,
    line1b,
    line1c,
    line3,
    line4,
    line5,
    line6,
    line7,
    line8,
    line9,
    line10,
    allowableLoss,
    suspendedLoss,
    totalNetPassiveActivity: totalNet,
  }
}
