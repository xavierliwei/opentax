/**
 * Schedule B — Interest and Ordinary Dividends
 *
 * Required when taxable interest or ordinary dividends exceed $1,500.
 * Lists each payer with name and amount, then totals.
 *
 * Source: 2025 Schedule B (Form 1040) instructions
 */

import type { TaxReturn } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation } from '../../model/traced'
import { SCHEDULE_B_THRESHOLD } from './constants'

// ── Line item (payer detail row) ───────────────────────────────

export interface ScheduleBLineItem {
  payerName: string
  payerTin?: string
  amount: number          // cents
  sourceDocumentId: string
}

// ── Schedule B result ──────────────────────────────────────────

export interface ScheduleBResult {
  required: boolean

  // Part I — Interest
  interestItems: ScheduleBLineItem[]
  line4: TracedValue      // total interest

  // Part II — Ordinary Dividends
  dividendItems: ScheduleBLineItem[]
  line6: TracedValue      // total ordinary dividends
}

// ── Computation ────────────────────────────────────────────────

/**
 * Compute the full Schedule B from the tax return model.
 */
export function computeScheduleB(model: TaxReturn): ScheduleBResult {
  // Part I — Interest
  const interestItems: ScheduleBLineItem[] = model.form1099INTs.map(f => ({
    payerName: f.payerName,
    payerTin: f.payerTin,
    amount: f.box1,
    sourceDocumentId: f.id,
  }))

  const interestTotal = interestItems.reduce((sum, item) => sum + item.amount, 0)
  const line4 = tracedFromComputation(
    interestTotal,
    'scheduleB.line4',
    model.form1099INTs.map(f => `1099int:${f.id}:box1`),
    'Schedule B, Line 4',
  )

  // Part II — Ordinary Dividends
  const dividendItems: ScheduleBLineItem[] = model.form1099DIVs.map(f => ({
    payerName: f.payerName,
    payerTin: f.payerTin,
    amount: f.box1a,
    sourceDocumentId: f.id,
  }))

  const dividendTotal = dividendItems.reduce((sum, item) => sum + item.amount, 0)
  const line6 = tracedFromComputation(
    dividendTotal,
    'scheduleB.line6',
    model.form1099DIVs.map(f => `1099div:${f.id}:box1a`),
    'Schedule B, Line 6',
  )

  // Required if either total exceeds $1,500
  const required = interestTotal > SCHEDULE_B_THRESHOLD
    || dividendTotal > SCHEDULE_B_THRESHOLD

  return { required, interestItems, line4, dividendItems, line6 }
}

/**
 * Quick check: is Schedule B required for this return?
 */
export function isScheduleBRequired(model: TaxReturn): boolean {
  return computeScheduleB(model).required
}
