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
import type { ScheduleEPropertyType } from '../../model/types'
import {
  PAL_SPECIAL_ALLOWANCE,
  PAL_PHASEOUT_START,
  PAL_PHASEOUT_RANGE,
  TAX_YEAR,
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

// ── Depreciation ──────────────────────────────────────────────────
//
// Straight-line depreciation with mid-month convention.
//
// Residential rental property (single-family, multi-family, vacation): 27.5 years
// Nonresidential real property (commercial): 39 years
// Land and royalties: not depreciable via this calculator
//
// Limitation: this is simplified straight-line only. For MACRS percentage
// tables (IRS Rev. Proc. 87-57), Section 179 expensing, or bonus depreciation,
// enter the depreciation amount manually.

const USEFUL_LIFE: Partial<Record<ScheduleEPropertyType, number>> = {
  'single-family': 27.5,
  'multi-family': 27.5,
  'vacation': 27.5,
  'commercial': 39,
  'other': 27.5,
}

/**
 * Compute straight-line depreciation for the current tax year.
 *
 * Uses mid-month convention: the property is treated as placed in service
 * at the midpoint of the month. First-year depreciation is prorated by
 * the number of months (including half of the placed-in-service month).
 *
 * Returns cents. Returns 0 if the property type is not depreciable (land,
 * royalties) or if the property is fully depreciated.
 */
export function straightLineDepreciation(
  basis: number,
  placedMonth: number,
  placedYear: number,
  propertyType: ScheduleEPropertyType,
  taxYear: number = TAX_YEAR,
): number {
  const life = USEFUL_LIFE[propertyType]
  if (!life || basis <= 0 || placedYear <= 0 || placedMonth < 1 || placedMonth > 12) return 0
  if (taxYear < placedYear) return 0

  const annualDep = basis / life
  const yearsElapsed = taxYear - placedYear

  // First year: mid-month convention — half month for placed-in-service month
  const firstYearMonths = 12 - placedMonth + 0.5
  const firstYearDep = Math.round(annualDep * firstYearMonths / 12)

  if (yearsElapsed === 0) return firstYearDep

  // Subsequent years: full annual depreciation, capped at remaining basis
  const fullYearDep = Math.round(annualDep)
  const priorDep = firstYearDep + fullYearDep * (yearsElapsed - 1)
  const remaining = basis - priorDep
  if (remaining <= 0) return 0

  return Math.min(fullYearDep, remaining)
}

/**
 * Get the effective depreciation for a property: auto-computed from basis/date
 * when available, otherwise falls back to the manual depreciation field.
 */
export function getEffectiveDepreciation(p: ScheduleEProperty, taxYear: number = TAX_YEAR): number {
  const basis = p.depreciableBasis ?? 0
  const month = p.placedInServiceMonth ?? 0
  const year = p.placedInServiceYear ?? 0
  if (basis > 0 && year > 0 && month > 0) {
    return straightLineDepreciation(basis, month, year, p.propertyType, taxYear)
  }
  return p.depreciation
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
    getEffectiveDepreciation(p) +
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
