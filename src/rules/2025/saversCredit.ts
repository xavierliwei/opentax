/**
 * Saver's Credit (Form 8880) — Retirement Savings Contributions Credit
 *
 * IRC §25B — Non-refundable credit for eligible retirement contributions.
 * Rate (50%, 20%, 10%, or 0%) depends on AGI and filing status.
 * Max eligible contribution: $2,000 per person ($4,000 MFJ/QW).
 *
 * Source: 2025 Form 8880 instructions, Rev. Proc. 2024-40 §3.10
 */

import type { FilingStatus, W2, RetirementContributions } from '../../model/types'
import {
  SAVERS_CREDIT_THRESHOLDS,
  SAVERS_CREDIT_MAX_CONTRIBUTION,
} from './constants'

// ── Result type ──────────────────────────────────────────────────

export interface SaversCreditResult {
  electiveDeferrals: number       // cents — from W-2 Box 12
  iraContributions: number        // cents — traditional + Roth IRA
  totalContributions: number      // cents
  eligibleContributions: number   // cents — capped at $2K/$4K
  creditRate: number              // 0.50, 0.20, 0.10, or 0
  creditAmount: number            // cents
}

// ── W-2 Box 12 codes for elective deferrals ──────────────────────

/** Box 12 codes that represent elective deferrals for retirement plans */
const DEFERRAL_CODES = new Set(['D', 'E', 'AA', 'BB', 'G', 'H'])

/**
 * Sum W-2 Box 12 entries with deferral codes.
 */
function sumElectiveDeferrals(w2s: W2[]): number {
  let total = 0
  for (const w2 of w2s) {
    for (const entry of w2.box12) {
      if (DEFERRAL_CODES.has(entry.code)) {
        total += entry.amount
      }
    }
  }
  return total
}

// ── Main computation ─────────────────────────────────────────────

/**
 * Compute the Saver's Credit (Form 8880).
 *
 * @param contributions - User-entered IRA contributions
 * @param w2s - All W-2s (for auto-deriving Box 12 deferrals)
 * @param filingStatus - Filing status for threshold lookup
 * @param agi - Adjusted gross income (cents)
 */
export function computeSaversCredit(
  contributions: RetirementContributions,
  w2s: W2[],
  filingStatus: FilingStatus,
  agi: number,
): SaversCreditResult {
  const electiveDeferrals = sumElectiveDeferrals(w2s)
  const iraContributions = contributions.traditionalIRA + contributions.rothIRA
  const totalContributions = electiveDeferrals + iraContributions

  if (totalContributions <= 0) {
    return {
      electiveDeferrals,
      iraContributions,
      totalContributions: 0,
      eligibleContributions: 0,
      creditRate: 0,
      creditAmount: 0,
    }
  }

  // Max eligible per person: $2K; MFJ/QW doubles to $4K
  const maxEligible = (filingStatus === 'mfj' || filingStatus === 'qw')
    ? SAVERS_CREDIT_MAX_CONTRIBUTION * 2
    : SAVERS_CREDIT_MAX_CONTRIBUTION
  const eligibleContributions = Math.min(totalContributions, maxEligible)

  // Determine rate from AGI thresholds
  const thresholds = SAVERS_CREDIT_THRESHOLDS[filingStatus]
  let creditRate: number
  if (agi <= thresholds.rate50) {
    creditRate = 0.50
  } else if (agi <= thresholds.rate20) {
    creditRate = 0.20
  } else if (agi <= thresholds.rate10) {
    creditRate = 0.10
  } else {
    creditRate = 0
  }

  const creditAmount = Math.round(eligibleContributions * creditRate)

  return {
    electiveDeferrals,
    iraContributions,
    totalContributions,
    eligibleContributions,
    creditRate,
    creditAmount,
  }
}
