/**
 * Earned Income Credit (EITC)
 *
 * IRC §32 — Refundable credit for low/mid-income workers.
 * Computed as a piecewise linear function at both earned income and AGI,
 * taking the smaller result.
 *
 * Source: 2025 Form 1040 instructions, IRS Rev. Proc. 2024-40
 */

import type { Dependent, FilingStatus } from '../../model/types'
import {
  EIC_SCHEDULES,
  EIC_INVESTMENT_INCOME_LIMIT,
  EIC_MIN_AGE_NO_CHILDREN,
  EIC_MAX_AGE_NO_CHILDREN,
  TAX_YEAR,
} from './constants'
import type { EICSchedule } from './constants'

// ── Qualifying child test ────────────────────────────────────────

/** Qualifying child relationships for EITC (same as CTC — IRC §152(c)) */
const QUALIFYING_CHILD_RELATIONSHIPS = new Set([
  'son', 'daughter', 'stepchild', 'foster child', 'sibling', 'grandchild',
])

/**
 * Is this dependent a qualifying child for the Earned Income Credit?
 * Requirements: under 19 at Dec 31 of tax year, qualifying relationship,
 * lived with taxpayer > 6 months, has valid SSN.
 *
 * Note: Students under 24 and permanently disabled children of any age
 * also qualify but require model extensions not yet implemented.
 */
export function isEITCQualifyingChild(dep: Dependent): boolean {
  if (!dep.dateOfBirth || !dep.ssn || dep.ssn.length !== 9) return false
  if (!QUALIFYING_CHILD_RELATIONSHIPS.has(dep.relationship)) return false
  if (dep.monthsLived < 7) return false

  // Age test: must be under 19 at Dec 31 of tax year
  const parts = dep.dateOfBirth.split('-')
  if (parts.length !== 3) return false

  const birthYear = parseInt(parts[0], 10)
  const birthMonth = parseInt(parts[1], 10)
  const birthDay = parseInt(parts[2], 10)
  if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return false
  if (birthMonth > 12 || birthDay > 31) return false

  const age = TAX_YEAR - birthYear
  return age < 19 && age >= 0
}

// ── Piecewise linear credit at a given income ────────────────────

/**
 * Compute the EIC at a given income level using the piecewise linear schedule.
 *
 * Phase-in:  credit = income × phase_in_rate           (income ≤ earnedIncomeAmount)
 * Plateau:   credit = maxCredit                         (earnedIncomeAmount < income ≤ phaseOutStart)
 * Phase-out: credit = maxCredit - (income - phaseOutStart) × phaseOutRate  (floored at 0)
 */
export function computeEICAtIncome(income: number, schedule: EICSchedule, phaseOutStart: number): number {
  if (income <= 0) return 0

  if (income <= schedule.earnedIncomeAmount) {
    // Phase-in
    return Math.round(income * schedule.phaseInRate)
  }

  if (income <= phaseOutStart) {
    // Plateau
    return schedule.maxCredit
  }

  // Phase-out
  const reduction = Math.round((income - phaseOutStart) * schedule.phaseOutRate)
  return Math.max(0, schedule.maxCredit - reduction)
}

// ── Result type ──────────────────────────────────────────────────

export interface EarnedIncomeCreditResult {
  numQualifyingChildren: number
  scheduleIndex: number             // 0, 1, 2, or 3 (index into EIC_SCHEDULES)
  eligible: boolean
  ineligibleReason?: 'mfs' | 'investment_income' | 'age' | 'no_income'
  creditAtEarnedIncome: number      // cents
  creditAtAGI: number               // cents
  creditAmount: number              // min(above two) → Line 27
}

// ── Main computation ─────────────────────────────────────────────

/**
 * Compute the Earned Income Credit.
 *
 * @param dependents - All dependents on the return
 * @param filingStatus - Filing status (MFS is ineligible)
 * @param earnedIncome - Sum of W-2 Box 1 wages (cents)
 * @param agi - Adjusted gross income (cents)
 * @param investmentIncome - Line 2a + 2b + 3b + max(0, Line 7) (cents)
 * @param filerAge - Taxpayer's age at Dec 31, or null if DOB not set
 */
export function computeEarnedIncomeCredit(
  dependents: Dependent[],
  filingStatus: FilingStatus,
  earnedIncome: number,
  agi: number,
  investmentIncome: number,
  filerAge: number | null,
): EarnedIncomeCreditResult {
  const numQualifyingChildren = dependents.filter(isEITCQualifyingChild).length
  const scheduleIndex = Math.min(numQualifyingChildren, 3)

  const ineligible = (reason: EarnedIncomeCreditResult['ineligibleReason']): EarnedIncomeCreditResult => ({
    numQualifyingChildren,
    scheduleIndex,
    eligible: false,
    ineligibleReason: reason,
    creditAtEarnedIncome: 0,
    creditAtAGI: 0,
    creditAmount: 0,
  })

  // Eligibility checks
  if (filingStatus === 'mfs') return ineligible('mfs')
  if (investmentIncome > EIC_INVESTMENT_INCOME_LIMIT) return ineligible('investment_income')
  if (earnedIncome <= 0) return ineligible('no_income')

  // Age check for 0 qualifying children
  if (numQualifyingChildren === 0 && filerAge !== null) {
    if (filerAge < EIC_MIN_AGE_NO_CHILDREN || filerAge > EIC_MAX_AGE_NO_CHILDREN) {
      return ineligible('age')
    }
  }

  const schedule = EIC_SCHEDULES[scheduleIndex]
  const phaseOutStart = filingStatus === 'mfj'
    ? schedule.phaseOutStartMFJ
    : schedule.phaseOutStartSingle

  const creditAtEarnedIncome = computeEICAtIncome(earnedIncome, schedule, phaseOutStart)
  const creditAtAGI = computeEICAtIncome(agi, schedule, phaseOutStart)
  const creditAmount = Math.min(creditAtEarnedIncome, creditAtAGI)

  return {
    numQualifyingChildren,
    scheduleIndex,
    eligible: true,
    creditAtEarnedIncome,
    creditAtAGI,
    creditAmount,
  }
}
