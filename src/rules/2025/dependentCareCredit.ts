/**
 * Dependent Care Credit (Form 2441)
 *
 * IRC §21 — Credit for expenses paid for the care of qualifying individuals
 * to enable the taxpayer to work.
 *
 * Rate: 35% of allowable expenses, reduced by 1% for each $2K of AGI above
 * $15K, with a floor of 20%.
 *
 * Source: 2025 Form 2441 instructions
 */

import type { Dependent, DependentCareExpenses } from '../../model/types'
import {
  DEPENDENT_CARE_MAX_ONE,
  DEPENDENT_CARE_MAX_TWO,
  DEPENDENT_CARE_BASE_RATE,
  DEPENDENT_CARE_MIN_RATE,
  DEPENDENT_CARE_AGI_STEP,
  DEPENDENT_CARE_AGI_FLOOR,
  TAX_YEAR,
} from './constants'

// ── Result type ──────────────────────────────────────────────────

export interface DependentCareCreditResult {
  numQualifyingPersons: number
  expenseLimit: number          // cents
  allowableExpenses: number     // cents
  creditRate: number            // decimal (e.g., 0.20)
  creditAmount: number          // cents
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Count dependents under age 13 at end of tax year.
 */
function countQualifyingPersonsFromDependents(dependents: Dependent[]): number {
  let count = 0
  for (const dep of dependents) {
    if (!dep.dateOfBirth) continue
    const parts = dep.dateOfBirth.split('-')
    if (parts.length !== 3) continue
    const birthYear = parseInt(parts[0], 10)
    if (isNaN(birthYear)) continue
    const age = TAX_YEAR - birthYear
    if (age < 13 && age >= 0) count++
  }
  return count
}

// ── Main computation ─────────────────────────────────────────────

/**
 * Compute the Dependent Care Credit (Form 2441).
 *
 * @param dependentCare - User-entered care expenses and qualifying person count
 * @param dependents - All dependents on the return (used for auto-counting under 13)
 * @param agi - Adjusted gross income (cents)
 * @param earnedIncome - Sum of W-2 Box 1 wages (cents)
 */
export function computeDependentCareCredit(
  dependentCare: DependentCareExpenses,
  dependents: Dependent[],
  agi: number,
  earnedIncome: number,
): DependentCareCreditResult {
  // Use user-specified count, or auto-derive from dependents under 13
  const autoCount = countQualifyingPersonsFromDependents(dependents)
  const numQualifyingPersons = dependentCare.numQualifyingPersons > 0
    ? dependentCare.numQualifyingPersons
    : autoCount

  if (numQualifyingPersons === 0 || dependentCare.totalExpenses <= 0) {
    return {
      numQualifyingPersons,
      expenseLimit: 0,
      allowableExpenses: 0,
      creditRate: 0,
      creditAmount: 0,
    }
  }

  // Expense limit: $3K (1 person) or $6K (2+)
  const expenseLimit = numQualifyingPersons >= 2
    ? DEPENDENT_CARE_MAX_TWO
    : DEPENDENT_CARE_MAX_ONE

  // Allowable expenses = min(total, limit, earned income)
  const allowableExpenses = Math.min(
    dependentCare.totalExpenses,
    expenseLimit,
    earnedIncome,
  )

  if (allowableExpenses <= 0) {
    return {
      numQualifyingPersons,
      expenseLimit,
      allowableExpenses: 0,
      creditRate: 0,
      creditAmount: 0,
    }
  }

  // Rate = 35% − 1% per $2K of AGI above $15K, floor 20%
  const excessAGI = Math.max(0, agi - DEPENDENT_CARE_AGI_FLOOR)
  const reductionSteps = Math.floor(excessAGI / DEPENDENT_CARE_AGI_STEP)
  const creditRate = Math.max(
    DEPENDENT_CARE_MIN_RATE,
    DEPENDENT_CARE_BASE_RATE - reductionSteps * 0.01,
  )

  const creditAmount = Math.round(allowableExpenses * creditRate)

  return {
    numQualifyingPersons,
    expenseLimit,
    allowableExpenses,
    creditRate,
    creditAmount,
  }
}
