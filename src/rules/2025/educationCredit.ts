/**
 * Education Credits (Form 8863)
 *
 * American Opportunity Tax Credit (AOTC) — up to $2,500/student, 40% refundable, max 4 years
 * Lifetime Learning Credit (LLC) — up to $2,000/return, non-refundable
 *
 * Both phase out at MAGI $80K–$90K (single) / $160K–$180K (MFJ).
 * MFS cannot claim either credit.
 *
 * Source: IRC §25A, IRS Form 8863 Instructions
 */

import type { EducationExpenses, FilingStatus } from '../../model/types'
import {
  AOTC_FIRST_TIER,
  AOTC_SECOND_TIER,
  AOTC_MAX_CREDIT,
  AOTC_REFUNDABLE_RATE,
  AOTC_MAX_YEARS,
  LLC_EXPENSE_LIMIT,
  LLC_CREDIT_RATE,
  LLC_MAX_CREDIT,
  EDUCATION_CREDIT_PHASEOUT,
} from './constants'

// ── Result types ─────────────────────────────────────────────────

export interface StudentAOTCResult {
  studentName: string
  qualifiedExpenses: number       // cents
  rawCredit: number               // cents — 100% of first $2K + 25% of next $2K
  creditAfterPhaseOut: number     // cents
  nonRefundable: number           // cents — 60% of credit
  refundable: number              // cents — 40% of credit (max $1,000)
}

export interface EducationCreditResult {
  aotcStudents: StudentAOTCResult[]
  aotcTotalCredit: number         // cents — sum of all student AOTC
  aotcNonRefundable: number       // cents — goes to Line 20
  aotcRefundable: number          // cents — goes to Line 29

  llcQualifiedExpenses: number    // cents — sum of LLC student expenses (capped at $10K)
  llcRawCredit: number            // cents — 20% of expenses
  llcCreditAfterPhaseOut: number  // cents — goes to Line 20

  totalNonRefundable: number      // cents — AOTC non-refundable + LLC → Line 20
  totalRefundable: number         // cents — AOTC refundable → Line 29

  phaseOutApplies: boolean
  mfsIneligible: boolean
}

// ── Main computation ─────────────────────────────────────────────

export function computeEducationCredit(
  expenses: EducationExpenses,
  filingStatus: FilingStatus,
  magi: number,
): EducationCreditResult {
  // MFS cannot claim either credit
  if (filingStatus === 'mfs') {
    return zeroResult(true)
  }

  const phaseOut = EDUCATION_CREDIT_PHASEOUT[filingStatus]
  const phaseOutRatio = computePhaseOutRatio(magi, phaseOut.start, phaseOut.end)
  const phaseOutApplies = phaseOutRatio > 0

  // ── AOTC per student ─────────────────────────────────────
  const aotcStudents: StudentAOTCResult[] = []
  for (const student of expenses.students) {
    if (student.creditType !== 'aotc') continue

    // Eligibility checks
    if (!student.isAtLeastHalfTime || student.hasCompletedFourYears || student.priorYearsAOTCClaimed >= AOTC_MAX_YEARS) {
      continue
    }

    const rawCredit = computeAOTCRaw(student.qualifiedExpenses)
    const creditAfterPhaseOut = Math.round(rawCredit * (1 - phaseOutRatio))
    const refundable = Math.round(creditAfterPhaseOut * AOTC_REFUNDABLE_RATE)
    const nonRefundable = creditAfterPhaseOut - refundable

    aotcStudents.push({
      studentName: student.studentName,
      qualifiedExpenses: student.qualifiedExpenses,
      rawCredit,
      creditAfterPhaseOut,
      nonRefundable,
      refundable,
    })
  }

  const aotcTotalCredit = aotcStudents.reduce((s, r) => s + r.creditAfterPhaseOut, 0)
  const aotcNonRefundable = aotcStudents.reduce((s, r) => s + r.nonRefundable, 0)
  const aotcRefundable = aotcStudents.reduce((s, r) => s + r.refundable, 0)

  // ── LLC total ────────────────────────────────────────────
  const llcExpensesRaw = expenses.students
    .filter(s => s.creditType === 'llc')
    .reduce((sum, s) => sum + s.qualifiedExpenses, 0)
  const llcQualifiedExpenses = Math.min(llcExpensesRaw, LLC_EXPENSE_LIMIT)
  const llcRawCredit = Math.min(Math.round(llcQualifiedExpenses * LLC_CREDIT_RATE), LLC_MAX_CREDIT)
  const llcCreditAfterPhaseOut = Math.round(llcRawCredit * (1 - phaseOutRatio))

  return {
    aotcStudents,
    aotcTotalCredit,
    aotcNonRefundable,
    aotcRefundable,

    llcQualifiedExpenses,
    llcRawCredit,
    llcCreditAfterPhaseOut,

    totalNonRefundable: aotcNonRefundable + llcCreditAfterPhaseOut,
    totalRefundable: aotcRefundable,

    phaseOutApplies,
    mfsIneligible: false,
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function computeAOTCRaw(qualifiedExpenses: number): number {
  const firstTier = Math.min(qualifiedExpenses, AOTC_FIRST_TIER)
  const secondTier = Math.min(Math.max(qualifiedExpenses - AOTC_FIRST_TIER, 0), AOTC_SECOND_TIER)
  const raw = firstTier + Math.round(secondTier * 0.25)
  return Math.min(raw, AOTC_MAX_CREDIT)
}

function computePhaseOutRatio(magi: number, start: number, end: number): number {
  if (start >= end) return 1 // MFS: fully phased out
  if (magi <= start) return 0
  if (magi >= end) return 1
  return (magi - start) / (end - start)
}

function zeroResult(mfsIneligible: boolean): EducationCreditResult {
  return {
    aotcStudents: [],
    aotcTotalCredit: 0,
    aotcNonRefundable: 0,
    aotcRefundable: 0,
    llcQualifiedExpenses: 0,
    llcRawCredit: 0,
    llcCreditAfterPhaseOut: 0,
    totalNonRefundable: 0,
    totalRefundable: 0,
    phaseOutApplies: false,
    mfsIneligible,
  }
}
