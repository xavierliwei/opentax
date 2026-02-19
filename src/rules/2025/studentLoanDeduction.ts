/**
 * Student Loan Interest Deduction (Schedule 1, Line 21)
 *
 * IRC §221 — Above-the-line deduction for interest paid on qualified
 * education loans, capped at $2,500, with MAGI-based phase-out.
 *
 * Phase-out ranges for 2025 (Rev. Proc. 2024-40):
 *   Single/HOH: $85,000–$100,000
 *   MFJ/QW:     $170,000–$200,000
 *   MFS:        ineligible (IRC §221(b)(2)(B))
 *
 * MAGI for this deduction = AGI computed without the student loan interest
 * deduction itself (i.e. Line 9 − IRA deduction − HSA deduction).
 *
 * Source: 2025 Form 1040 Schedule 1 instructions, Rev. Proc. 2024-40
 */

import type { TaxReturn } from '../../model/types'
import { STUDENT_LOAN_DEDUCTION_MAX, STUDENT_LOAN_PHASEOUT } from './constants'

// ── Result type ──────────────────────────────────────────────────

export interface StudentLoanDeductionResult {
  interestPaid: number        // cents — actual interest from 1098-E
  maxDeduction: number        // cents — min(interestPaid, $2,500)
  phaseOutApplies: boolean
  phaseOutStart: number       // cents
  phaseOutEnd: number         // cents
  magi: number                // cents — MAGI used for phase-out
  deductibleAmount: number    // cents — final deduction after phase-out
}

// ── Main computation ─────────────────────────────────────────────

/**
 * Compute the student loan interest deduction.
 *
 * @param model - The tax return (for studentLoanInterest, filingStatus)
 * @param magi - MAGI for student loan purposes (Line 9 − IRA − HSA), in cents
 * @returns StudentLoanDeductionResult or null if no student loan interest
 */
export function computeStudentLoanDeduction(
  model: TaxReturn,
  magi: number,
): StudentLoanDeductionResult | null {
  const interestPaid = model.studentLoanInterest ?? 0
  if (interestPaid <= 0) return null

  const maxDeduction = Math.min(interestPaid, STUDENT_LOAN_DEDUCTION_MAX)

  // MFS → ineligible per IRC §221(b)(2)(B)
  const phaseOut = STUDENT_LOAN_PHASEOUT[model.filingStatus]
  if (phaseOut === null) {
    return {
      interestPaid,
      maxDeduction,
      phaseOutApplies: false,
      phaseOutStart: 0,
      phaseOutEnd: 0,
      magi,
      deductibleAmount: 0,
    }
  }

  const { start, end } = phaseOut

  let deductibleAmount: number

  if (magi <= start) {
    // Below phase-out → full deduction
    deductibleAmount = maxDeduction
  } else if (magi >= end) {
    // Above phase-out → $0
    deductibleAmount = 0
  } else {
    // In phase-out range: reduction = maxDeduction × (MAGI - start) / (end - start)
    const reduction = Math.round((maxDeduction * (magi - start)) / (end - start))
    deductibleAmount = maxDeduction - reduction
  }

  return {
    interestPaid,
    maxDeduction,
    phaseOutApplies: magi > start,
    phaseOutStart: start,
    phaseOutEnd: end,
    magi,
    deductibleAmount,
  }
}
