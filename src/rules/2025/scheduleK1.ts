/**
 * Schedule K-1 Income Aggregation — Passthrough Entity Income
 *
 * Aggregates K-1 income from partnerships (Form 1065), S-corps (Form 1120-S),
 * and trusts/estates (Form 1041) into the appropriate Form 1040 income lines.
 *
 * IRS routing per K-1 instructions:
 *   Box 1  (Ordinary income)    → Schedule E Part II → Schedule 1, Line 5
 *   Box 2  (Rental income)      → Schedule E Part II → Schedule 1, Line 5
 *   Box 4  (Guaranteed payments)→ Schedule 1, Line 5 (also subject to SE tax)
 *   Box 5  (Interest income)    → Schedule B → Form 1040, Line 2b
 *   Box 6a (Dividends)          → Schedule B → Form 1040, Line 3b
 *   Box 8  (ST capital gains)   → Schedule D, Line 5
 *   Box 9a (LT capital gains)   → Schedule D, Line 12
 *   Box 14 Code A (SE earnings) → Schedule SE (combined with Schedule C)
 *   Box 20 Code Z (QBI)         → Form 8995 (already handled by qbiDeduction.ts)
 *
 * Limitations:
 *   - K-1 dividends treated as ordinary (non-qualified) — conservative; the
 *     data model does not yet capture the qualified dividend breakdown.
 *   - Passive activity loss rules for K-1 rental income: a conservative
 *     $25K special allowance guardrail is applied (same as Schedule E Part I)
 *     but full basis/at-risk tracking is not modeled.
 *   - SE tax from partnership K-1s is computed only when Box 14 Code A
 *     (selfEmploymentEarnings) is explicitly provided. If not provided,
 *     SE tax is not computed (conservative — avoids overtaxing limited partners).
 *   - Foreign taxes (Box 16), AMT items (Box 17), and other exotic K-1
 *     boxes are not supported.
 *
 * All amounts in integer cents.
 */

import type { ScheduleK1, FilingStatus } from '../../model/types'
import {
  PAL_SPECIAL_ALLOWANCE,
  PAL_PHASEOUT_START,
  PAL_PHASEOUT_RANGE,
} from './constants'

// ── Result types ──────────────────────────────────────────────────

export interface K1EntityResult {
  id: string
  entityName: string
  entityType: ScheduleK1['entityType']
  ordinaryIncome: number
  rentalIncome: number
  guaranteedPayments: number
  interestIncome: number
  dividendIncome: number
  shortTermCapitalGain: number
  longTermCapitalGain: number
  section199AQBI: number
  selfEmploymentEarnings: number
}

export interface K1AggregateResult {
  /** Total ordinary business income from all K-1s → Schedule 1 Line 5 */
  totalOrdinaryIncome: number

  /** Total rental income from all K-1s → Schedule 1 Line 5 */
  totalRentalIncome: number

  /** Total guaranteed payments from all partnership K-1s → Schedule 1 Line 5 + SE tax */
  totalGuaranteedPayments: number

  /** Total interest income from all K-1s → Form 1040 Line 2b */
  totalInterest: number

  /** Total dividend income from all K-1s → Form 1040 Line 3b (as ordinary) */
  totalDividends: number

  /** Total short-term capital gains from all K-1s → Schedule D */
  totalSTCapitalGain: number

  /** Total long-term capital gains from all K-1s → Schedule D */
  totalLTCapitalGain: number

  /** Total Section 199A QBI → already routed by qbiDeduction.ts */
  totalQBI: number

  /** Total SE earnings from partnership K-1 Box 14 Code A → Schedule SE */
  totalSEEarnings: number

  /** Combined passthrough income for Schedule 1 Line 5 (ordinary + rental + guaranteed payments) */
  totalPassthroughIncome: number

  /** Per-entity breakdown */
  entities: K1EntityResult[]

  /** Number of K-1 forms processed */
  k1Count: number
}

// ── Computation ──────────────────────────────────────────────────

/**
 * Aggregate all K-1 income items by type.
 *
 * Returns structured totals that can be wired into the Form 1040 flow.
 * Each income type maps to a specific form line per IRS instructions.
 */
export function computeK1Aggregate(k1s: ScheduleK1[]): K1AggregateResult {
  let totalOrdinaryIncome = 0
  let totalRentalIncome = 0
  let totalGuaranteedPayments = 0
  let totalInterest = 0
  let totalDividends = 0
  let totalSTCapitalGain = 0
  let totalLTCapitalGain = 0
  let totalQBI = 0
  let totalSEEarnings = 0

  const entities: K1EntityResult[] = []

  for (const k of k1s) {
    const gp = k.guaranteedPayments ?? 0
    const se = k.selfEmploymentEarnings ?? 0

    totalOrdinaryIncome += k.ordinaryIncome
    totalRentalIncome += k.rentalIncome
    totalGuaranteedPayments += gp
    totalInterest += k.interestIncome
    totalDividends += k.dividendIncome
    totalSTCapitalGain += k.shortTermCapitalGain
    totalLTCapitalGain += k.longTermCapitalGain
    totalQBI += k.section199AQBI
    totalSEEarnings += se

    entities.push({
      id: k.id,
      entityName: k.entityName,
      entityType: k.entityType,
      ordinaryIncome: k.ordinaryIncome,
      rentalIncome: k.rentalIncome,
      guaranteedPayments: gp,
      interestIncome: k.interestIncome,
      dividendIncome: k.dividendIncome,
      shortTermCapitalGain: k.shortTermCapitalGain,
      longTermCapitalGain: k.longTermCapitalGain,
      section199AQBI: k.section199AQBI,
      selfEmploymentEarnings: se,
    })
  }

  return {
    totalOrdinaryIncome,
    totalRentalIncome,
    totalGuaranteedPayments,
    totalInterest,
    totalDividends,
    totalSTCapitalGain,
    totalLTCapitalGain,
    totalQBI,
    totalSEEarnings,
    totalPassthroughIncome: totalOrdinaryIncome + totalRentalIncome + totalGuaranteedPayments,
    entities,
    k1Count: k1s.length,
  }
}

// ── K-1 Rental Loss PAL Guardrail ─────────────────────────────────

export interface K1RentalPALResult {
  /** Raw rental income/loss total from K-1s (before guardrail) */
  grossRentalIncome: number
  /** Allowed rental loss after PAL guardrail (negative or zero), or full profit if positive */
  allowedRentalIncome: number
  /** Disallowed loss (negative — informational only, not carried forward) */
  disallowedLoss: number
  /** Whether the PAL guardrail was applied */
  palApplied: boolean
}

/**
 * Apply a conservative PAL guardrail to K-1 rental losses.
 *
 * Uses the same $25K special allowance as IRC §469(i) for directly-owned
 * rental properties. This is a guardrail, not a full PAL computation:
 * - It does NOT track basis or at-risk amounts
 * - It does NOT carry forward disallowed losses across tax years
 * - It does NOT distinguish active vs. material participation
 *
 * If the total K-1 rental income is positive (profit), the guardrail
 * does not apply — the full profit flows through.
 *
 * @param totalRentalIncome - Total K-1 rental income/loss (cents, may be negative)
 * @param agi - Preliminary AGI for phase-out (cents)
 * @param filingStatus - Filing status (MFS gets $0 allowance)
 * @param scheduleEPALUsed - PAL allowance already consumed by Schedule E Part I (cents)
 */
export function computeK1RentalPAL(
  totalRentalIncome: number,
  agi: number,
  filingStatus: FilingStatus,
  scheduleEPALUsed: number = 0,
): K1RentalPALResult {
  // If rental income is positive (profit), no PAL applies
  if (totalRentalIncome >= 0) {
    return {
      grossRentalIncome: totalRentalIncome,
      allowedRentalIncome: totalRentalIncome,
      disallowedLoss: 0,
      palApplied: false,
    }
  }

  const absLoss = Math.abs(totalRentalIncome)
  const phaseoutStart = PAL_PHASEOUT_START[filingStatus]

  // MFS: phaseoutStart=0 → allowance=0 always
  if (phaseoutStart === 0) {
    return {
      grossRentalIncome: totalRentalIncome,
      allowedRentalIncome: 0,
      disallowedLoss: totalRentalIncome,
      palApplied: true,
    }
  }

  // Compute total allowance from §469(i), then subtract what Schedule E already used
  const excessAGI = Math.max(0, agi - phaseoutStart)
  const reduction = Math.round(
    (PAL_SPECIAL_ALLOWANCE * Math.min(excessAGI, PAL_PHASEOUT_RANGE)) / PAL_PHASEOUT_RANGE,
  )
  const totalAllowance = Math.max(0, PAL_SPECIAL_ALLOWANCE - reduction)
  const remainingAllowance = Math.max(0, totalAllowance - scheduleEPALUsed)

  const allowedLoss = Math.min(absLoss, remainingAllowance)
  const allowedRentalIncome = allowedLoss > 0 ? -allowedLoss : 0
  const disallowedLoss = totalRentalIncome - allowedRentalIncome

  return {
    grossRentalIncome: totalRentalIncome,
    allowedRentalIncome,
    disallowedLoss,
    palApplied: true,
  }
}
