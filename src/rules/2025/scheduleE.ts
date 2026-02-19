/**
 * Schedule E Part I — Supplemental Income and Loss (Rental Real Estate)
 *
 * Per property: net = rents + royalties - expenses
 * Line 23a: total rental/royalty income or loss (before PAL)
 * Line 25:  total rental/royalty losses allowed (after PAL)
 * Line 26:  total Schedule E income → Schedule 1 Line 5
 *
 * Passive Activity Loss (PAL) — IRC §469(i):
 *   $25,000 special allowance, phased out $100K–$150K AGI.
 *   MFS gets $0 allowance.
 *
 * All amounts are in integer cents.
 */

import type { ScheduleEProperty, FilingStatus } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation } from '../../model/traced'
import {
  PAL_SPECIAL_ALLOWANCE,
  PAL_PHASEOUT_START,
  PAL_PHASEOUT_RANGE,
} from './constants'

// ── Result types ──────────────────────────────────────────────────

export interface ScheduleEPropertyResult {
  propertyId: string
  income: TracedValue     // rents + royalties
  expenses: TracedValue   // total expenses
  netIncome: TracedValue  // income - expenses
}

export interface ScheduleEResult {
  properties: ScheduleEPropertyResult[]
  line23a: TracedValue   // total rental/royalty income or loss (before PAL)
  line25: TracedValue    // total rental/royalty losses allowed (after PAL)
  line26: TracedValue    // total Schedule E income → Schedule 1 Line 5
  disallowedLoss: number // PAL carryforward (cents, informational)
}

// ── Helpers ────────────────────────────────────────────────────────

function totalExpenses(p: ScheduleEProperty): number {
  return (
    p.advertising +
    p.auto +
    p.cleaning +
    p.commissions +
    p.insurance +
    p.legal +
    p.management +
    p.mortgageInterest +
    p.otherInterest +
    p.repairs +
    p.supplies +
    p.taxes +
    p.utilities +
    p.depreciation +
    p.other
  )
}

function computePALAllowance(
  totalLoss: number,
  agi: number,
  filingStatus: FilingStatus,
): number {
  // totalLoss is negative; we work with the absolute value
  const absLoss = Math.abs(totalLoss)
  const phaseoutStart = PAL_PHASEOUT_START[filingStatus]

  // MFS: phaseoutStart=0 → allowance=0 always
  if (phaseoutStart === 0) return 0

  const excessAGI = Math.max(0, agi - phaseoutStart)
  const reduction = Math.round(
    (PAL_SPECIAL_ALLOWANCE * Math.min(excessAGI, PAL_PHASEOUT_RANGE)) / PAL_PHASEOUT_RANGE,
  )
  const allowance = Math.max(0, PAL_SPECIAL_ALLOWANCE - reduction)

  return Math.min(absLoss, allowance)
}

// ── Main computation ──────────────────────────────────────────────

export function computeScheduleE(
  properties: ScheduleEProperty[],
  filingStatus: FilingStatus,
  agi: number,
): ScheduleEResult {
  // Per-property results
  const propertyResults: ScheduleEPropertyResult[] = properties.map((p) => {
    const incomeAmount = p.rentsReceived + p.royaltiesReceived
    const expensesAmount = totalExpenses(p)
    const net = incomeAmount - expensesAmount

    const income = tracedFromComputation(
      incomeAmount,
      `scheduleE.${p.id}.income`,
      [`scheduleE:${p.id}:rentsReceived`, `scheduleE:${p.id}:royaltiesReceived`],
      `Schedule E — ${p.address || 'Property'} income`,
    )

    const expenses = tracedFromComputation(
      expensesAmount,
      `scheduleE.${p.id}.expenses`,
      [`scheduleE:${p.id}:expenses`],
      `Schedule E — ${p.address || 'Property'} expenses`,
    )

    const netIncome = tracedFromComputation(
      net,
      `scheduleE.${p.id}.net`,
      [`scheduleE.${p.id}.income`, `scheduleE.${p.id}.expenses`],
      `Schedule E — ${p.address || 'Property'} net`,
    )

    return { propertyId: p.id, income, expenses, netIncome }
  })

  // Line 23a: total net
  const line23aAmount = propertyResults.reduce((sum, r) => sum + r.netIncome.amount, 0)
  const line23aInputs = propertyResults.map((r) => `scheduleE.${r.propertyId}.net`)

  const line23a = tracedFromComputation(
    line23aAmount,
    'scheduleE.line23a',
    line23aInputs,
    'Schedule E, Line 23a',
  )

  let line25Amount: number
  let disallowedLoss = 0

  if (line23aAmount >= 0) {
    // Profit — no PAL limitation
    line25Amount = 0 // line 25 is only for losses
  } else {
    // Loss — apply PAL
    const allowedLoss = computePALAllowance(line23aAmount, agi, filingStatus)
    line25Amount = allowedLoss > 0 ? -allowedLoss : 0 // negative (loss allowed), avoid -0
    disallowedLoss = line23aAmount - line25Amount // remaining disallowed (negative)
  }

  const line25 = tracedFromComputation(
    line25Amount,
    'scheduleE.line25',
    ['scheduleE.line23a'],
    'Schedule E, Line 25',
  )

  // Line 26: total to Schedule 1
  // If profit: line23a; if loss: line25 (allowed portion)
  const line26Amount = line23aAmount >= 0 ? line23aAmount : line25Amount
  const line26 = tracedFromComputation(
    line26Amount,
    'scheduleE.line26',
    line23aAmount >= 0 ? ['scheduleE.line23a'] : ['scheduleE.line25'],
    'Schedule E, Line 26',
  )

  return {
    properties: propertyResults,
    line23a,
    line25,
    line26,
    disallowedLoss,
  }
}
