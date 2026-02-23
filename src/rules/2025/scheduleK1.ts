/**
 * Schedule K-1 Income Aggregation — Passthrough Entity Income
 *
 * Aggregates K-1 income from partnerships (Form 1065), S-corps (Form 1120-S),
 * and trusts/estates (Form 1041) into the appropriate Form 1040 income lines.
 *
 * IRS routing per K-1 instructions:
 *   Box 1  (Ordinary income)    → Schedule E Part II → Schedule 1, Line 5
 *   Box 2  (Rental income)      → Schedule E Part II → Schedule 1, Line 5
 *   Box 5  (Interest income)    → Schedule B → Form 1040, Line 2b
 *   Box 6a (Dividends)          → Schedule B → Form 1040, Line 3b
 *   Box 8  (ST capital gains)   → Schedule D, Line 5
 *   Box 9a (LT capital gains)   → Schedule D, Line 12
 *   Box 20 Code Z (QBI)         → Form 8995 (already handled by qbiDeduction.ts)
 *
 * Limitations:
 *   - K-1 dividends treated as ordinary (non-qualified) — conservative; the
 *     data model does not yet capture the qualified dividend breakdown.
 *   - Passive activity loss rules for K-1 rental income are simplified:
 *     rental income/loss is treated as passive and routed through Schedule 1
 *     without applying the $25K special allowance (which requires basis
 *     tracking and at-risk limitations not yet modeled).
 *   - Self-employment income from partnerships is NOT computed (Box 14);
 *     only S-corp/trust K-1 ordinary income flows as non-SE income.
 *   - Guaranteed payments (Box 4), foreign taxes (Box 16), AMT items (Box 17),
 *     and other exotic K-1 boxes are not supported.
 *
 * All amounts in integer cents.
 */

import type { ScheduleK1 } from '../../model/types'

// ── Result types ──────────────────────────────────────────────────

export interface K1EntityResult {
  id: string
  entityName: string
  entityType: ScheduleK1['entityType']
  ordinaryIncome: number
  rentalIncome: number
  interestIncome: number
  dividendIncome: number
  shortTermCapitalGain: number
  longTermCapitalGain: number
  section199AQBI: number
}

export interface K1AggregateResult {
  /** Total ordinary business income from all K-1s → Schedule 1 Line 5 */
  totalOrdinaryIncome: number

  /** Total rental income from all K-1s → Schedule 1 Line 5 */
  totalRentalIncome: number

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

  /** Combined passthrough income for Schedule 1 Line 5 (ordinary + rental) */
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
  let totalInterest = 0
  let totalDividends = 0
  let totalSTCapitalGain = 0
  let totalLTCapitalGain = 0
  let totalQBI = 0

  const entities: K1EntityResult[] = []

  for (const k of k1s) {
    totalOrdinaryIncome += k.ordinaryIncome
    totalRentalIncome += k.rentalIncome
    totalInterest += k.interestIncome
    totalDividends += k.dividendIncome
    totalSTCapitalGain += k.shortTermCapitalGain
    totalLTCapitalGain += k.longTermCapitalGain
    totalQBI += k.section199AQBI

    entities.push({
      id: k.id,
      entityName: k.entityName,
      entityType: k.entityType,
      ordinaryIncome: k.ordinaryIncome,
      rentalIncome: k.rentalIncome,
      interestIncome: k.interestIncome,
      dividendIncome: k.dividendIncome,
      shortTermCapitalGain: k.shortTermCapitalGain,
      longTermCapitalGain: k.longTermCapitalGain,
      section199AQBI: k.section199AQBI,
    })
  }

  return {
    totalOrdinaryIncome,
    totalRentalIncome,
    totalInterest,
    totalDividends,
    totalSTCapitalGain,
    totalLTCapitalGain,
    totalQBI,
    totalPassthroughIncome: totalOrdinaryIncome + totalRentalIncome,
    entities,
    k1Count: k1s.length,
  }
}
