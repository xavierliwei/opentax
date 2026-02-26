/**
 * Schedule C — Profit or Loss From Business (Sole Proprietorship)
 *
 * Computes net profit/loss for a single Schedule C business.
 * Supports the core path for common single-owner self-employment cases.
 *
 * Unsupported advanced features (emit validation warnings):
 *   - COGS Part III detail (hasInventory)
 *   - Vehicle depreciation (Form 4562 Part V)
 *   - Net Operating Loss (NOL) carryforward
 *   - At-risk limitations (Form 6198)
 *
 * Source: 2025 Schedule C instructions
 * All amounts in integer cents.
 */

import type { ScheduleC } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation, tracedZero } from '../../model/traced'

// ── Result type ──────────────────────────────────────────────────

export interface ScheduleCResult {
  businessId: string
  businessName: string

  // Part I — Income
  line1: TracedValue   // Gross receipts
  line3: TracedValue   // Gross profit (line1 - returns - COGS)
  line7: TracedValue   // Gross income (= line3 for simplified path)

  // Part II — Expenses
  line28: TracedValue  // Total expenses
  line29: TracedValue  // Tentative profit (loss): line7 - line28
  line30: TracedValue  // Business use of home (Form 8829)
  line31: TracedValue  // Net profit or (loss): line29 - line30

  // Detailed expense breakdown (for form population)
  totalExpenses: number  // cents

  // Warnings for unsupported features
  warnings: string[]
}

// ── Computation ──────────────────────────────────────────────────

/**
 * Compute Schedule C for a single business.
 *
 * @param business              The Schedule C input data
 * @param homeOfficeDeduction   Form 8829 deduction (cents) for this business (Line 30)
 */
export function computeScheduleC(business: ScheduleC, homeOfficeDeduction = 0): ScheduleCResult {
  const warnings: string[] = []

  // Check for unsupported features
  if (business.hasInventory) {
    warnings.push('Schedule C Part III (Cost of Goods Sold detail) is not yet supported. COGS is used as entered.')
  }
  if (business.hasVehicleExpenses) {
    warnings.push('Vehicle expense detail (Form 4562 Part V) is not yet supported. Car/truck expenses are used as entered.')
  }

  // Part I — Gross Income
  const line1 = tracedFromComputation(
    business.grossReceipts,
    `scheduleC.${business.id}.line1`,
    [`scheduleC:${business.id}:grossReceipts`],
    'Schedule C, Line 1',
  )

  const grossProfit = business.grossReceipts - business.returns - business.costOfGoodsSold
  const line3 = tracedFromComputation(
    grossProfit,
    `scheduleC.${business.id}.line3`,
    [`scheduleC.${business.id}.line1`],
    'Schedule C, Line 3',
  )

  // Line 7 = Gross income (same as line 3 for simplified path — no other income)
  const line7 = tracedFromComputation(
    grossProfit,
    `scheduleC.${business.id}.line7`,
    [`scheduleC.${business.id}.line3`],
    'Schedule C, Line 7',
  )

  // Part II — Expenses
  // Meals are 50% deductible (IRC §274(n))
  const mealsDeductible = Math.round(business.meals * 0.50)

  const totalExpenses =
    business.advertising +
    business.carAndTruck +
    business.commissions +
    business.contractLabor +
    business.depreciation +
    business.insurance +
    business.mortgageInterest +
    business.otherInterest +
    business.legal +
    business.officeExpense +
    business.rent +
    business.repairs +
    business.supplies +
    business.taxes +
    business.travel +
    mealsDeductible +
    business.utilities +
    business.wages +
    business.otherExpenses

  const line28 = tracedFromComputation(
    totalExpenses,
    `scheduleC.${business.id}.line28`,
    [`scheduleC:${business.id}:expenses`],
    'Schedule C, Line 28',
  )

  // Line 29 — Tentative profit (loss): line 7 − line 28
  const tentativeProfit = grossProfit - totalExpenses
  const line29 = tracedFromComputation(
    tentativeProfit,
    `scheduleC.${business.id}.line29`,
    [`scheduleC.${business.id}.line7`, `scheduleC.${business.id}.line28`],
    'Schedule C, Line 29',
  )

  // Line 30 — Business use of home (Form 8829)
  const line30 = tracedFromComputation(
    homeOfficeDeduction,
    `scheduleC.${business.id}.line30`,
    [`form8829.${business.id}.deduction`],
    'Schedule C, Line 30 (Form 8829)',
  )

  // Line 31 — Net profit or (loss): line 29 − line 30
  const netProfitLoss = tentativeProfit - homeOfficeDeduction
  const line31 = tracedFromComputation(
    netProfitLoss,
    `scheduleC.${business.id}.line31`,
    [`scheduleC.${business.id}.line29`, `scheduleC.${business.id}.line30`],
    'Schedule C, Line 31',
  )

  return {
    businessId: business.id,
    businessName: business.businessName,
    line1,
    line3,
    line7,
    line28,
    line29,
    line30,
    line31,
    totalExpenses,
    warnings,
  }
}

// ── Aggregate all Schedule C businesses ──────────────────────────

export interface ScheduleCAggregateResult {
  businesses: ScheduleCResult[]
  totalNetProfit: TracedValue   // Sum of all line31 values (can be negative)
  totalNetProfitCents: number   // Raw cents for SE tax computation
}

/**
 * Compute Schedule C for all businesses and aggregate results.
 *
 * @param businesses              All Schedule C businesses
 * @param homeOfficeDeductions    Map of scheduleCId → deduction (cents) from Form 8829
 */
export function computeAllScheduleC(
  businesses: ScheduleC[],
  homeOfficeDeductions?: Map<string, number>,
): ScheduleCAggregateResult {
  if (businesses.length === 0) {
    return {
      businesses: [],
      totalNetProfit: tracedZero('scheduleC.totalNetProfit', 'Schedule C, Total Net Profit'),
      totalNetProfitCents: 0,
    }
  }

  const results = businesses.map(b => {
    const homeOffice = homeOfficeDeductions?.get(b.id) ?? 0
    return computeScheduleC(b, homeOffice)
  })
  const total = results.reduce((sum, r) => sum + r.line31.amount, 0)
  const inputs = results.map(r => `scheduleC.${r.businessId}.line31`)

  return {
    businesses: results,
    totalNetProfit: tracedFromComputation(
      total,
      'scheduleC.totalNetProfit',
      inputs,
      'Schedule C, Total Net Profit',
    ),
    totalNetProfitCents: total,
  }
}
