/**
 * Schedule 1 — Additional Income and Adjustments to Income
 *
 * Part I — Additional Income:
 *   Line 1  = Taxable refunds, credits, or offsets of state/local income taxes
 *             (1099-G Box 2 — only taxable if taxpayer itemized in prior year)
 *   Line 5  = Rental real estate, royalties, partnerships, etc.
 *             (1099-MISC Box 1 rents + Box 2 royalties)
 *   Line 7  = Unemployment compensation (1099-G Box 1)
 *   Line 8z = Other income (1099-MISC Box 3 — prizes, awards, etc.)
 *   Line 10 = Total additional income (Lines 1–7 + Line 9)
 *
 * All amounts are in integer cents.
 */

import type { TaxReturn } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation, tracedZero } from '../../model/traced'
import type { ScheduleEResult } from './scheduleE'
import type { ScheduleCAggregateResult } from './scheduleC'
import type { ScheduleSEResult } from './scheduleSE'
import type { K1AggregateResult } from './scheduleK1'
import type { AlimonyReceivedResult } from './schedule1Adjustments'

// ── Result type ──────────────────────────────────────────────────

export interface Schedule1Result {
  line1: TracedValue   // Taxable refunds (state/local)
  line2a: TracedValue  // Alimony received (pre-2019 agreements)
  line3: TracedValue   // Business income or (loss) — Schedule C
  line5: TracedValue   // Rents + royalties
  line7: TracedValue   // Unemployment compensation
  line8z: TracedValue  // Other income
  line10: TracedValue  // Total additional income
  line15: TracedValue  // Deductible half of SE tax — Part II adjustment
}

// ── Computation ──────────────────────────────────────────────────

export function computeSchedule1(
  model: TaxReturn,
  scheduleE?: ScheduleEResult,
  scheduleCAggregate?: ScheduleCAggregateResult,
  scheduleSEResult?: ScheduleSEResult,
  k1Aggregate?: K1AggregateResult,
  alimonyResult?: AlimonyReceivedResult | null,
): Schedule1Result {
  const forms = model.form1099MISCs ?? []
  const form1099Gs = model.form1099Gs ?? []

  // Line 1 — Taxable refunds of state/local income taxes
  // Only taxable if taxpayer itemized deductions in the prior year AND
  // deducted state/local income taxes (tax benefit rule — IRC §111).
  // Simplified: if itemizedLastYear is true, sum of 1099-G Box 2 is taxable.
  const itemizedLastYear = model.priorYear?.itemizedLastYear ?? false
  let line1Total = 0
  const line1Inputs: string[] = []
  if (itemizedLastYear) {
    for (const g of form1099Gs) {
      if (g.box2 > 0) {
        line1Total += g.box2
        line1Inputs.push(`1099g:${g.id}:box2`)
      }
    }
  }
  const line1: TracedValue = line1Total > 0
    ? tracedFromComputation(line1Total, 'schedule1.line1', line1Inputs, 'Schedule 1, Line 1')
    : tracedZero('schedule1.line1', 'Schedule 1, Line 1')

  // Line 2a — Alimony received (pre-2019 agreements only, per TCJA §11051)
  const line2a: TracedValue = alimonyResult && alimonyResult.amount > 0
    ? tracedFromComputation(alimonyResult.amount, 'schedule1.line2a', ['alimony.received'], 'Schedule 1, Line 2a')
    : tracedZero('schedule1.line2a', 'Schedule 1, Line 2a')

  // Line 3 — Business income or (loss) from Schedule C + 1099-NEC
  const scheduleCProfit = scheduleCAggregate?.totalNetProfitCents ?? 0
  const nec1099Total = (model.form1099NECs ?? []).reduce(
    (sum, f) => sum + (f.nonemployeeCompensation ?? 0), 0,
  )
  const line3Total = scheduleCProfit + nec1099Total
  let line3: TracedValue
  if (line3Total !== 0) {
    const line3Inputs: string[] = []
    if (scheduleCProfit !== 0) line3Inputs.push('scheduleC.totalNetProfit')
    for (const f of (model.form1099NECs ?? [])) {
      if ((f.nonemployeeCompensation ?? 0) > 0) {
        line3Inputs.push(`1099nec:${f.id}:box1`)
      }
    }
    line3 = tracedFromComputation(
      line3Total,
      'schedule1.line3',
      line3Inputs,
      'Schedule 1, Line 3',
    )
  } else {
    line3 = tracedZero('schedule1.line3', 'Schedule 1, Line 3')
  }

  // Line 5 — rents, royalties, partnerships, S-corps, trusts
  // Includes: Schedule E Part I (rental properties), K-1 passthrough income
  // (ordinary + rental), and fallback 1099-MISC rents/royalties.
  let line5Total = 0
  const line5Inputs: string[] = []

  // Schedule E Part I (rental properties)
  if (scheduleE && scheduleE.line26.amount !== 0) {
    line5Total += scheduleE.line26.amount
    line5Inputs.push('scheduleE.line26')
  }

  // K-1 passthrough income (ordinary + rental) — Schedule E Part II
  const k1Passthrough = k1Aggregate?.totalPassthroughIncome ?? 0
  if (k1Passthrough !== 0) {
    line5Total += k1Passthrough
    line5Inputs.push('k1.totalPassthroughIncome')
  }

  // Fallback: 1099-MISC rents/royalties (only if no Schedule E)
  if (!scheduleE && !k1Aggregate) {
    for (const f of forms) {
      if (f.box1 > 0) {
        line5Total += f.box1
        line5Inputs.push(`1099misc:${f.id}:box1`)
      }
      if (f.box2 > 0) {
        line5Total += f.box2
        line5Inputs.push(`1099misc:${f.id}:box2`)
      }
    }
  }

  const line5: TracedValue = line5Total !== 0
    ? tracedFromComputation(line5Total, 'schedule1.line5', line5Inputs, 'Schedule 1, Line 5')
    : tracedZero('schedule1.line5', 'Schedule 1, Line 5')

  // Line 7 — Unemployment compensation (1099-G Box 1)
  let line7Total = 0
  const line7Inputs: string[] = []
  for (const g of form1099Gs) {
    if (g.box1 > 0) {
      line7Total += g.box1
      line7Inputs.push(`1099g:${g.id}:box1`)
    }
  }
  const line7: TracedValue = line7Total > 0
    ? tracedFromComputation(line7Total, 'schedule1.line7', line7Inputs, 'Schedule 1, Line 7')
    : tracedZero('schedule1.line7', 'Schedule 1, Line 7')

  // Line 8z — other income (box3)
  const line8zInputs: string[] = []
  let line8zTotal = 0
  for (const f of forms) {
    if (f.box3 > 0) {
      line8zTotal += f.box3
      line8zInputs.push(`1099misc:${f.id}:box3`)
    }
  }
  const line8z: TracedValue = line8zTotal > 0
    ? tracedFromComputation(line8zTotal, 'schedule1.line8z', line8zInputs, 'Schedule 1, Line 8z')
    : tracedZero('schedule1.line8z', 'Schedule 1, Line 8z')

  // Line 10 — total additional income (Lines 1 + 2a + 3 + 5 + 7 + Line 9 (= 8z for now))
  const line10Total = line1.amount + line2a.amount + line3.amount + line5.amount + line7.amount + line8zTotal
  const line10Inputs: string[] = []
  if (line1.amount > 0) line10Inputs.push('schedule1.line1')
  if (line2a.amount > 0) line10Inputs.push('schedule1.line2a')
  if (line3.amount !== 0) line10Inputs.push('schedule1.line3')
  if (line5.amount !== 0) line10Inputs.push('schedule1.line5')
  if (line7.amount > 0) line10Inputs.push('schedule1.line7')
  if (line8zTotal > 0) line10Inputs.push('schedule1.line8z')

  const line10: TracedValue = line10Total !== 0
    ? tracedFromComputation(line10Total, 'schedule1.line10', line10Inputs, 'Schedule 1, Line 10')
    : tracedZero('schedule1.line10', 'Schedule 1, Line 10')

  // Part II — Adjustments to Income
  // Line 15 — Deductible half of self-employment tax
  let line15: TracedValue
  if (scheduleSEResult && scheduleSEResult.deductibleHalfCents > 0) {
    line15 = tracedFromComputation(
      scheduleSEResult.deductibleHalfCents,
      'schedule1.line15',
      ['scheduleSE.deductibleHalf'],
      'Schedule 1, Line 15',
    )
  } else {
    line15 = tracedZero('schedule1.line15', 'Schedule 1, Line 15')
  }

  return { line1, line2a, line3, line5, line7, line8z, line10, line15 }
}
