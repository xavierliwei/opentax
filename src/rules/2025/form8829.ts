/**
 * Form 8829 — Expenses for Business Use of Your Home
 *
 * Supports two methods:
 *   1. Simplified Method ($5/sq ft, max 300 sq ft = $1,500)
 *   2. Regular Method (actual expenses prorated by business-use percentage)
 *
 * The deduction flows to Schedule C, Line 30 and cannot exceed
 * the tentative profit from the associated Schedule C (before this deduction).
 *
 * For homeowners who itemize, the business-use portion of mortgage interest
 * and real estate taxes is removed from Schedule A and claimed here instead.
 *
 * Source: 2025 Form 8829 instructions
 * All amounts in integer cents.
 */

import type { Form8829Data } from '../../model/types'

// ── Constants ────────────────────────────────────────────────────

/** Maximum square footage for simplified method */
const SIMPLIFIED_MAX_SQFT = 300
/** Rate per square foot for simplified method (in cents) */
const SIMPLIFIED_RATE_CENTS = 500  // $5.00
/** Straight-line depreciation years for residential property (IRC §168(c)) */
const DEPRECIATION_YEARS = 39
/** Business percentage for mid-month convention: 1/24 for month placed in service */
const MID_MONTH_FRACTION = 1 / 24

// ── Result types ─────────────────────────────────────────────────

export interface Form8829Result {
  scheduleCId: string
  method: 'simplified' | 'regular'

  /** The deduction amount that flows to Schedule C Line 30 (cents) */
  deduction: number

  /** Business-use percentage (0–100 scale, two decimal precision) */
  businessPercentage: number

  // Regular method detail (populated only for regular method)
  /** Total direct expenses (cents) */
  directExpenses: number
  /** Total indirect expenses before prorating (cents) */
  indirectExpensesTotal: number
  /** Indirect expenses after prorating by business % (cents) */
  indirectExpensesProrated: number
  /** Depreciation amount (cents) */
  depreciation: number
  /** Total allowable deduction before profit limit (cents) */
  totalBeforeLimit: number
  /** Excess deduction carried forward (cents) — informational only */
  excessCarryforward: number

  /**
   * Amount of mortgage interest allocated to business use (cents).
   * Must be REMOVED from Schedule A to avoid double-counting.
   */
  mortgageInterestBusiness: number
  /**
   * Amount of real estate taxes allocated to business use (cents).
   * Must be REMOVED from Schedule A to avoid double-counting.
   */
  realEstateTaxesBusiness: number
}

// ── Simplified method ────────────────────────────────────────────

function computeSimplified(
  data: Form8829Data,
  tentativeProfit: number,
): Form8829Result {
  const sqft = Math.min(data.businessSquareFootage ?? 0, SIMPLIFIED_MAX_SQFT)
  const rawDeduction = sqft * SIMPLIFIED_RATE_CENTS

  // Cannot exceed Schedule C tentative profit (before this deduction)
  const deduction = Math.min(rawDeduction, Math.max(0, tentativeProfit))

  return {
    scheduleCId: data.scheduleCId,
    method: 'simplified',
    deduction,
    businessPercentage: 0,  // not applicable for simplified
    directExpenses: 0,
    indirectExpensesTotal: 0,
    indirectExpensesProrated: 0,
    depreciation: 0,
    totalBeforeLimit: rawDeduction,
    excessCarryforward: Math.max(0, rawDeduction - deduction),
    mortgageInterestBusiness: 0,
    realEstateTaxesBusiness: 0,
  }
}

// ── Regular method ───────────────────────────────────────────────

function computeRegular(
  data: Form8829Data,
  tentativeProfit: number,
): Form8829Result {
  // Part I — Business-use percentage
  let businessPct: number
  if (data.businessUsePercentage !== undefined && data.businessUsePercentage > 0) {
    // Direct percentage override
    businessPct = Math.min(data.businessUsePercentage, 100)
  } else {
    const totalSqFt = data.totalHomeSquareFootage ?? 0
    const bizSqFt = data.businessUseSquareFootage ?? 0
    businessPct = totalSqFt > 0 ? Math.min((bizSqFt / totalSqFt) * 100, 100) : 0
  }

  const pctFraction = businessPct / 100

  // Part II — Direct expenses (100% deductible, not prorated)
  const directRepairs = data.directRepairs ?? 0
  const directOther = data.directOther ?? 0
  const directExpenses = directRepairs + directOther

  // Part II — Indirect expenses (prorated by business %)
  const mortgageInterest = data.mortgageInterest ?? 0
  const realEstateTaxes = data.realEstateTaxes ?? 0
  const insurance = data.insurance ?? 0
  const rent = data.rent ?? 0
  const utilities = data.utilities ?? 0
  const repairs = data.repairs ?? 0
  const other = data.other ?? 0

  const indirectExpensesTotal =
    mortgageInterest + realEstateTaxes + insurance +
    rent + utilities + repairs + other

  const indirectExpensesProrated = Math.round(indirectExpensesTotal * pctFraction)

  // Business-use portions for Schedule A adjustment
  const mortgageInterestBusiness = Math.round(mortgageInterest * pctFraction)
  const realEstateTaxesBusiness = Math.round(realEstateTaxes * pctFraction)

  // Depreciation — simplified straight-line over 39 years
  // Only for homeowners (not renters — renters claim rent as indirect expense)
  let depreciation = 0
  const homeValue = data.homeValue ?? 0
  if (homeValue > 0 && !rent) {
    // Annual depreciation = homeValue / 39
    // Apply business-use percentage
    const annualDepreciation = Math.round(homeValue / DEPRECIATION_YEARS)
    depreciation = Math.round(annualDepreciation * pctFraction)

    // Mid-month convention for the first year placed in service
    if (data.datePlacedInService) {
      const placedYear = parseInt(data.datePlacedInService.split('-')[0])
      const placedMonth = parseInt(data.datePlacedInService.split('-')[1])
      // 2025 tax year — if placed in service this year, prorate
      if (placedYear === 2025 && placedMonth >= 1 && placedMonth <= 12) {
        // Months of use = (13 - placedMonth) - 0.5 (mid-month convention)
        const monthsUsed = (13 - placedMonth) - MID_MONTH_FRACTION * 12
        const fraction = Math.max(0, monthsUsed / 12)
        depreciation = Math.round(depreciation * fraction)
      } else if (placedYear > 2025) {
        // Not yet placed in service
        depreciation = 0
      }
    }
  }

  // Total deduction before profit limit
  const totalBeforeLimit = directExpenses + indirectExpensesProrated + depreciation

  // The allowable deduction cannot exceed Schedule C tentative profit
  const deduction = Math.min(totalBeforeLimit, Math.max(0, tentativeProfit))
  const excessCarryforward = Math.max(0, totalBeforeLimit - deduction)

  return {
    scheduleCId: data.scheduleCId,
    method: 'regular',
    deduction,
    businessPercentage: Math.round(businessPct * 100) / 100,  // round to 2 decimals
    directExpenses,
    indirectExpensesTotal,
    indirectExpensesProrated,
    depreciation,
    totalBeforeLimit,
    excessCarryforward,
    mortgageInterestBusiness,
    realEstateTaxesBusiness,
  }
}

// ── Main entry point ─────────────────────────────────────────────

/**
 * Compute Form 8829 deduction for a single home office.
 *
 * @param data             The Form 8829 input data
 * @param tentativeProfit  Schedule C tentative profit (line 7 - line 28) in cents,
 *                         BEFORE the home office deduction. Must be >= 0 for a deduction.
 */
export function computeForm8829(
  data: Form8829Data,
  tentativeProfit: number,
): Form8829Result {
  if (data.method === 'simplified') {
    return computeSimplified(data, tentativeProfit)
  }
  return computeRegular(data, tentativeProfit)
}

/**
 * Compute Form 8829 for all home offices and return aggregate results.
 * Returns an array of results, one per Form 8829.
 */
export function computeAllForm8829(
  form8829s: Form8829Data[],
  scheduleCProfits: Map<string, number>,  // scheduleCId → tentative profit (cents)
): Form8829Result[] {
  return form8829s.map(data => {
    const tentativeProfit = scheduleCProfits.get(data.scheduleCId) ?? 0
    return computeForm8829(data, tentativeProfit)
  })
}
