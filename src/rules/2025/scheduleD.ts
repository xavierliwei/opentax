/**
 * Schedule D — Capital Gains and Losses
 *
 * Part I:  Short-term (Lines 1–7)
 * Part II: Long-term (Lines 8–15)
 * Part III: Summary (Lines 16–21)
 *
 * Source: 2025 Schedule D (Form 1040) instructions
 */

import type { TaxReturn } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation, tracedZero } from '../../model/traced'
import { computeForm8949, getCategoryTotals } from './form8949'
import { CAPITAL_LOSS_LIMIT } from './constants'
import type { Form8949Result } from './form8949'

// ── Schedule D result ──────────────────────────────────────────

export interface ScheduleDResult {
  form8949: Form8949Result

  // Part I — Short-Term
  line1a: TracedValue   // 8949 category A totals (gain/loss)
  line1b: TracedValue   // 8949 category B totals (gain/loss)
  line6: TracedValue    // Short-term capital loss carryover from prior year
  line7: TracedValue    // Net short-term gain/(loss)

  // Part II — Long-Term
  line8a: TracedValue   // 8949 category D totals (gain/loss)
  line8b: TracedValue   // 8949 category E totals (gain/loss)
  line13: TracedValue   // Capital gain distributions (from 1099-DIV Box 2a)
  line14: TracedValue   // Long-term capital loss carryover from prior year
  line15: TracedValue   // Net long-term gain/(loss)

  // Part III — Summary
  line16: TracedValue   // Combined net gain/(loss) = Line 7 + Line 15
  line21: TracedValue   // Amount for Form 1040 Line 7 (loss-limited if negative)

  // Carry-forward info
  capitalLossCarryforward: number  // cents, positive = unused loss to carry to next year
}

// ── Computation ────────────────────────────────────────────────

export function computeScheduleD(model: TaxReturn): ScheduleDResult {
  const form8949 = computeForm8949(model.capitalTransactions, model.form1099Bs)

  // ── Part I — Short-Term ──────────────────────────────────────

  const catA = getCategoryTotals(form8949, 'A')
  const catB = getCategoryTotals(form8949, 'B')

  const line1a = tracedFromComputation(
    catA.totalGainLoss.amount,
    'scheduleD.line1a',
    ['form8949.A.gainLoss'],
    'Schedule D, Line 1a',
  )

  const line1b = tracedFromComputation(
    catB.totalGainLoss.amount,
    'scheduleD.line1b',
    ['form8949.B.gainLoss'],
    'Schedule D, Line 1b',
  )

  // Line 6 — Short-term capital loss carryover from prior year (entered as positive, applied as negative)
  const stCarryover = model.priorYear?.capitalLossCarryforwardST ?? 0
  const line6 = tracedFromComputation(
    stCarryover > 0 ? -stCarryover : 0,
    'scheduleD.line6',
    [],
    'Schedule D, Line 6',
  )

  // Line 7 = net short-term = Line 1a + Line 1b + Line 6
  const line7 = tracedFromComputation(
    line1a.amount + line1b.amount + line6.amount,
    'scheduleD.line7',
    ['scheduleD.line1a', 'scheduleD.line1b', 'scheduleD.line6'],
    'Schedule D, Line 7',
  )

  // ── Part II — Long-Term ──────────────────────────────────────

  const catD = getCategoryTotals(form8949, 'D')
  const catE = getCategoryTotals(form8949, 'E')

  const line8a = tracedFromComputation(
    catD.totalGainLoss.amount,
    'scheduleD.line8a',
    ['form8949.D.gainLoss'],
    'Schedule D, Line 8a',
  )

  const line8b = tracedFromComputation(
    catE.totalGainLoss.amount,
    'scheduleD.line8b',
    ['form8949.E.gainLoss'],
    'Schedule D, Line 8b',
  )

  // Line 13 — Capital gain distributions from 1099-DIV Box 2a
  const capGainDist = model.form1099DIVs.reduce((sum, f) => sum + f.box2a, 0)
  const line13 = capGainDist > 0
    ? tracedFromComputation(
      capGainDist,
      'scheduleD.line13',
      model.form1099DIVs.map(f => `1099div:${f.id}:box2a`),
      'Schedule D, Line 13',
    )
    : tracedZero('scheduleD.line13', 'Schedule D, Line 13')

  // Line 14 — Long-term capital loss carryover from prior year (entered as positive, applied as negative)
  const ltCarryover = model.priorYear?.capitalLossCarryforwardLT ?? 0
  const line14 = tracedFromComputation(
    ltCarryover > 0 ? -ltCarryover : 0,
    'scheduleD.line14',
    [],
    'Schedule D, Line 14',
  )

  // Line 15 = net long-term = Line 8a + Line 8b + Line 13 + Line 14
  const line15 = tracedFromComputation(
    line8a.amount + line8b.amount + line13.amount + line14.amount,
    'scheduleD.line15',
    ['scheduleD.line8a', 'scheduleD.line8b', 'scheduleD.line13', 'scheduleD.line14'],
    'Schedule D, Line 15',
  )

  // ── Part III — Summary ───────────────────────────────────────

  // Line 16 = Line 7 + Line 15
  const line16 = tracedFromComputation(
    line7.amount + line15.amount,
    'scheduleD.line16',
    ['scheduleD.line7', 'scheduleD.line15'],
    'Schedule D, Line 16',
  )

  // Line 21 — amount for Form 1040 Line 7
  // If gain (≥ 0): Line 21 = Line 16
  // If loss (< 0): Line 21 = max(Line 16, -capitalLossLimit)
  const lossLimit = CAPITAL_LOSS_LIMIT[model.filingStatus]
  let line21Amount: number
  let capitalLossCarryforward: number

  if (line16.amount >= 0) {
    line21Amount = line16.amount
    capitalLossCarryforward = 0
  } else {
    // Loss: apply limitation
    line21Amount = Math.max(line16.amount, -lossLimit)
    // Carryforward = total loss - deductible portion (stored as positive)
    // Use Math.abs to avoid -0
    capitalLossCarryforward = Math.abs(line16.amount - line21Amount)
  }

  const line21 = tracedFromComputation(
    line21Amount,
    'scheduleD.line21',
    ['scheduleD.line16'],
    'Schedule D, Line 21',
  )

  return {
    form8949,
    line1a, line1b, line6, line7,
    line8a, line8b, line13, line14, line15,
    line16, line21,
    capitalLossCarryforward,
  }
}
