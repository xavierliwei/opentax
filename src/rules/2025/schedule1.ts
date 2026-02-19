/**
 * Schedule 1 — Additional Income and Adjustments to Income
 *
 * Part I — Additional Income:
 *   Line 5  = Rental real estate, royalties, partnerships, etc.
 *             (1099-MISC Box 1 rents + Box 2 royalties)
 *   Line 8z = Other income (1099-MISC Box 3 — prizes, awards, etc.)
 *   Line 10 = Total additional income (Line 5 + Line 8z)
 *
 * All amounts are in integer cents.
 */

import type { TaxReturn } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation, tracedZero } from '../../model/traced'
import type { ScheduleEResult } from './scheduleE'

// ── Result type ──────────────────────────────────────────────────

export interface Schedule1Result {
  line5: TracedValue   // Rents + royalties
  line8z: TracedValue  // Other income
  line10: TracedValue  // Total additional income
}

// ── Computation ──────────────────────────────────────────────────

export function computeSchedule1(model: TaxReturn, scheduleE?: ScheduleEResult): Schedule1Result {
  const forms = model.form1099MISCs ?? []

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

  // Line 10 — total additional income
  const line10Total = line5.amount + line8zTotal
  const line10Inputs: string[] = []
  if (line5.amount !== 0) line10Inputs.push('schedule1.line5')
  if (line8zTotal > 0) line10Inputs.push('schedule1.line8z')

  const line10: TracedValue = line10Total !== 0
    ? tracedFromComputation(line10Total, 'schedule1.line10', line10Inputs, 'Schedule 1, Line 10')
    : tracedZero('schedule1.line10', 'Schedule 1, Line 10')

  return { line5, line8z, line10 }
}
