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

// ── Result type ──────────────────────────────────────────────────

export interface Schedule1Result {
  line1: TracedValue   // Taxable refunds (state/local)
  line5: TracedValue   // Rents + royalties
  line7: TracedValue   // Unemployment compensation
  line8z: TracedValue  // Other income
  line10: TracedValue  // Total additional income
}

// ── Computation ──────────────────────────────────────────────────

export function computeSchedule1(model: TaxReturn, scheduleE?: ScheduleEResult): Schedule1Result {
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

  // Line 5 — rents and royalties
  // If Schedule E is provided, it takes precedence (proper computation).
  // Otherwise fallback to 1099-MISC box1 + box2 (simplified proxy).
  let line5: TracedValue
  if (scheduleE) {
    line5 = scheduleE.line26.amount !== 0
      ? tracedFromComputation(scheduleE.line26.amount, 'schedule1.line5', ['scheduleE.line26'], 'Schedule 1, Line 5')
      : tracedZero('schedule1.line5', 'Schedule 1, Line 5')
  } else {
    const line5Inputs: string[] = []
    let line5Total = 0
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
    line5 = line5Total > 0
      ? tracedFromComputation(line5Total, 'schedule1.line5', line5Inputs, 'Schedule 1, Line 5')
      : tracedZero('schedule1.line5', 'Schedule 1, Line 5')
  }

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

  // Line 10 — total additional income (Lines 1 + 5 + 7 + Line 9 (= 8z for now))
  const line10Total = line1.amount + line5.amount + line7.amount + line8zTotal
  const line10Inputs: string[] = []
  if (line1.amount > 0) line10Inputs.push('schedule1.line1')
  if (line5.amount !== 0) line10Inputs.push('schedule1.line5')
  if (line7.amount > 0) line10Inputs.push('schedule1.line7')
  if (line8zTotal > 0) line10Inputs.push('schedule1.line8z')

  const line10: TracedValue = line10Total !== 0
    ? tracedFromComputation(line10Total, 'schedule1.line10', line10Inputs, 'Schedule 1, Line 10')
    : tracedZero('schedule1.line10', 'Schedule 1, Line 10')

  return { line1, line5, line7, line8z, line10 }
}
