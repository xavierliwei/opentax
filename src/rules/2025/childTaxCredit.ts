/**
 * Child Tax Credit (CTC) and Additional Child Tax Credit (ACTC)
 *
 * IRC §24 — $2,000 per qualifying child under 17, $500 per other dependent.
 * Non-refundable portion reduces tax liability (Form 1040 Line 19).
 * Refundable portion (Additional CTC, Form 8812) → Form 1040 Line 28.
 *
 * Source: 2025 Form 1040 instructions, Schedule 8812
 */

import type { Dependent, FilingStatus } from '../../model/types'
import {
  CTC_PER_QUALIFYING_CHILD,
  CTC_PER_OTHER_DEPENDENT,
  CTC_REFUNDABLE_MAX_PER_CHILD,
  CTC_EARNED_INCOME_THRESHOLD,
  CTC_REFUNDABLE_RATE,
  CTC_PHASEOUT_THRESHOLD,
  CTC_PHASEOUT_RATE_PER_1000,
  TAX_YEAR,
} from './constants'

// ── Qualifying child test ────────────────────────────────────────

/** Qualifying child relationships for CTC (IRC §152(c)) */
const QUALIFYING_CHILD_RELATIONSHIPS = new Set([
  'son', 'daughter', 'stepchild', 'foster child', 'sibling', 'grandchild',
])

/**
 * Is this dependent a qualifying child for the Child Tax Credit?
 * Requirements: under 17 at Dec 31 of tax year, qualifying relationship,
 * lived with taxpayer > 6 months, has valid SSN.
 */
export function isQualifyingChild(dep: Dependent): boolean {
  if (!dep.dateOfBirth || !dep.ssn || dep.ssn.length !== 9) return false
  if (!QUALIFYING_CHILD_RELATIONSHIPS.has(dep.relationship)) return false
  if (dep.monthsLived < 7) return false

  // Age test: must be under 17 at Dec 31 of tax year
  // Use manual year/month/day extraction to avoid timezone issues
  const parts = dep.dateOfBirth.split('-')
  if (parts.length !== 3) return false

  const birthYear = parseInt(parts[0], 10)
  const birthMonth = parseInt(parts[1], 10)
  const birthDay = parseInt(parts[2], 10)
  if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return false

  // Age at Dec 31 of tax year
  let age = TAX_YEAR - birthYear
  // If birthday hasn't happened by Dec 31, they're still the younger age
  // But Dec 31 is the last day of the year, so if born on Dec 31 they've turned that age
  if (birthMonth > 12 || (birthMonth === 12 && birthDay > 31)) {
    // Invalid date
    return false
  }
  // If born after Dec 31 (impossible since max month=12, day=31), no adjustment needed
  // If born in a later month than Dec, subtract 1... but Dec is month 12, the last month
  // So the only adjustment is if birthMonth > 12 which is invalid
  // Actually: born on Jan 1, 2009 → age on Dec 31 2025 = 16 (TAX_YEAR - 2009 = 16)
  // Born on Dec 31, 2008 → age on Dec 31 2025 = 17 (TAX_YEAR - 2008 = 17)
  // So the simple subtraction works: age = TAX_YEAR - birthYear
  // But wait — born Jan 1, 2009 → on Dec 31, 2025 they are 16 (haven't turned 17 yet)
  // TAX_YEAR - 2009 = 16 ✓
  // Born Dec 31, 2008 → on Dec 31, 2025 they are 17
  // TAX_YEAR - 2008 = 17, not under 17 → correctly excluded ✓

  return age < 17 && age >= 0
}

/**
 * Is this dependent an "other dependent" (qualifies for $500 credit)?
 * An other dependent has a valid DOB and SSN but does not qualify as a
 * qualifying child for CTC purposes.
 */
export function isOtherDependent(dep: Dependent): boolean {
  if (!dep.dateOfBirth || !dep.ssn || dep.ssn.length !== 9) return false
  return !isQualifyingChild(dep)
}

// ── CTC computation result ───────────────────────────────────────

export interface ChildTaxCreditResult {
  numQualifyingChildren: number
  numOtherDependents: number
  initialCredit: number           // (numQC × $2,000) + (numOD × $500) in cents
  phaseOutReduction: number       // ceil(excessAGI / $1,000) × $50 in cents
  creditAfterPhaseOut: number     // initial - phaseOut, floored at 0
  nonRefundableCredit: number     // min(afterPhaseOut, taxLiability) → Line 19
  additionalCTC: number           // Form 8812 refundable portion → Line 28
}

// ── Main computation ─────────────────────────────────────────────

/**
 * Compute Child Tax Credit (non-refundable) and Additional CTC (refundable).
 *
 * @param dependents - All dependents on the return
 * @param filingStatus - Filing status for phase-out threshold
 * @param agi - Adjusted gross income (cents)
 * @param taxLiability - Line 18 tax liability (cents) — caps non-refundable portion
 * @param earnedIncome - Sum of W-2 Box 1 wages (cents) — for refundable calc
 */
export function computeChildTaxCredit(
  dependents: Dependent[],
  filingStatus: FilingStatus,
  agi: number,
  taxLiability: number,
  earnedIncome: number,
): ChildTaxCreditResult {
  const numQualifyingChildren = dependents.filter(isQualifyingChild).length
  const numOtherDependents = dependents.filter(isOtherDependent).length

  // Initial credit
  const initialCredit =
    numQualifyingChildren * CTC_PER_QUALIFYING_CHILD +
    numOtherDependents * CTC_PER_OTHER_DEPENDENT

  if (initialCredit === 0) {
    return {
      numQualifyingChildren,
      numOtherDependents,
      initialCredit: 0,
      phaseOutReduction: 0,
      creditAfterPhaseOut: 0,
      nonRefundableCredit: 0,
      additionalCTC: 0,
    }
  }

  // Phase-out: $50 per $1,000 (or fraction thereof) of AGI above threshold
  const threshold = CTC_PHASEOUT_THRESHOLD[filingStatus]
  const excessAGI = Math.max(0, agi - threshold)
  const thousandsOver = Math.ceil(excessAGI / 100000) // cents: $1,000 = 100000 cents
  const phaseOutReduction = Math.min(thousandsOver * CTC_PHASEOUT_RATE_PER_1000, initialCredit)

  const creditAfterPhaseOut = Math.max(0, initialCredit - phaseOutReduction)

  // Non-refundable: capped at tax liability
  const nonRefundableCredit = Math.min(creditAfterPhaseOut, taxLiability)

  // Additional CTC (refundable, Form 8812 simplified)
  // Only qualifying children generate refundable credit, not other dependents
  let additionalCTC = 0
  if (numQualifyingChildren > 0 && creditAfterPhaseOut > nonRefundableCredit) {
    const maxRefundable = numQualifyingChildren * CTC_REFUNDABLE_MAX_PER_CHILD
    const earnedIncomeAboveFloor = Math.max(0, earnedIncome - CTC_EARNED_INCOME_THRESHOLD)
    const earnedIncomeBased = Math.round(earnedIncomeAboveFloor * CTC_REFUNDABLE_RATE)
    const refundablePool = Math.min(maxRefundable, earnedIncomeBased)
    // Cannot exceed the unused portion of the credit
    additionalCTC = Math.min(refundablePool, creditAfterPhaseOut - nonRefundableCredit)
  }

  return {
    numQualifyingChildren,
    numOtherDependents,
    initialCredit,
    phaseOutReduction,
    creditAfterPhaseOut,
    nonRefundableCredit,
    additionalCTC,
  }
}
