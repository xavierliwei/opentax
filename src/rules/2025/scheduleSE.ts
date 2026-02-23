/**
 * Schedule SE — Self-Employment Tax
 *
 * Computes self-employment tax on net earnings from self-employment.
 * Implements the short Schedule SE (Section A) for common cases.
 *
 * Long Schedule SE (Section B) is required when:
 *   - Church employee income > $108.28
 *   - Taxpayer received tips subject to SS tax
 *   - Certain other uncommon scenarios
 * These are emitted as validation warnings.
 *
 * The deductible half of SE tax flows to Schedule 1 as an adjustment
 * (Form 1040 Line 10 → reduces AGI).
 *
 * Source: 2025 Schedule SE instructions, IRC §1401, §1402
 * All amounts in integer cents.
 */

import {
  SE_TAX_RATE_SS,
  SE_TAX_RATE_MEDICARE,
  SE_NET_EARNINGS_FACTOR,
  SE_DEDUCTIBLE_HALF,
  SS_WAGE_BASE,
  ADDITIONAL_MEDICARE_RATE,
  ADDITIONAL_MEDICARE_THRESHOLD,
} from './constants'
import type { FilingStatus } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation, tracedZero } from '../../model/traced'

// ── Result type ──────────────────────────────────────────────────

export interface ScheduleSEResult {
  // Section A lines
  line2: TracedValue   // Net earnings from self-employment (Schedule C total)
  line3: TracedValue   // line2 × 92.35% (net SE earnings)
  line4a: TracedValue  // Social Security portion: min(line3, SS wage base - W-2 SS wages)
  line4b: TracedValue  // SS tax: line4a × 12.4%
  line5: TracedValue   // Medicare tax: line3 × 2.9%
  line6: TracedValue   // Total SE tax: line4b + line5

  // Deductible half
  deductibleHalf: TracedValue  // line6 × 50% → Schedule 1 adjustment

  // Raw values for integration
  totalSETax: number        // cents
  deductibleHalfCents: number  // cents
  netSEEarnings: number     // cents (for Additional Medicare Tax and EIC)
}

// ── Computation ──────────────────────────────────────────────────

/**
 * Compute Schedule SE (Short form — Section A).
 *
 * @param scheduleCNetProfit - Total net profit/loss from all Schedule C businesses (cents)
 * @param w2SocialSecurityWages - Total W-2 Box 3 wages (cents) — reduces SS tax base
 * @param filingStatus - For Additional Medicare Tax threshold (informational)
 */
export function computeScheduleSE(
  scheduleCNetProfit: number,
  w2SocialSecurityWages: number,
  _filingStatus: FilingStatus,
): ScheduleSEResult {
  // Line 2 — Net profit from Schedule C (combined)
  const line2 = scheduleCNetProfit > 0
    ? tracedFromComputation(scheduleCNetProfit, 'scheduleSE.line2', ['scheduleC.totalNetProfit'], 'Schedule SE, Line 2')
    : tracedZero('scheduleSE.line2', 'Schedule SE, Line 2')

  // If net profit ≤ 0, no SE tax is due
  if (scheduleCNetProfit <= 0) {
    const zero = tracedZero('scheduleSE.line3', 'Schedule SE, Line 3')
    return {
      line2,
      line3: zero,
      line4a: tracedZero('scheduleSE.line4a', 'Schedule SE, Line 4a'),
      line4b: tracedZero('scheduleSE.line4b', 'Schedule SE, Line 4b'),
      line5: tracedZero('scheduleSE.line5', 'Schedule SE, Line 5'),
      line6: tracedZero('scheduleSE.line6', 'Schedule SE, Line 6'),
      deductibleHalf: tracedZero('scheduleSE.deductibleHalf', 'Schedule SE, Deductible Half'),
      totalSETax: 0,
      deductibleHalfCents: 0,
      netSEEarnings: 0,
    }
  }

  // Line 3 — Net SE earnings: line2 × 92.35%
  // The 92.35% factor simulates the employer-equivalent deduction
  const netSEEarnings = Math.round(scheduleCNetProfit * SE_NET_EARNINGS_FACTOR)
  const line3 = tracedFromComputation(
    netSEEarnings,
    'scheduleSE.line3',
    ['scheduleSE.line2'],
    'Schedule SE, Line 3',
  )

  // Line 4a — Social Security earnings: min(line3, SS wage base minus W-2 SS wages)
  // If W-2 wages already cover the wage base, no additional SS tax on SE income
  const ssWageRoom = Math.max(0, SS_WAGE_BASE - w2SocialSecurityWages)
  const ssTaxableEarnings = Math.min(netSEEarnings, ssWageRoom)
  const line4a = tracedFromComputation(
    ssTaxableEarnings,
    'scheduleSE.line4a',
    ['scheduleSE.line3'],
    'Schedule SE, Line 4a',
  )

  // Line 4b — Social Security tax: 12.4%
  const ssTax = Math.round(ssTaxableEarnings * SE_TAX_RATE_SS)
  const line4b = tracedFromComputation(
    ssTax,
    'scheduleSE.line4b',
    ['scheduleSE.line4a'],
    'Schedule SE, Line 4b',
  )

  // Line 5 — Medicare tax: 2.9% on ALL net SE earnings (no cap)
  const medicareTax = Math.round(netSEEarnings * SE_TAX_RATE_MEDICARE)
  const line5 = tracedFromComputation(
    medicareTax,
    'scheduleSE.line5',
    ['scheduleSE.line3'],
    'Schedule SE, Line 5',
  )

  // Line 6 — Total SE tax
  const totalSETax = ssTax + medicareTax
  const line6 = tracedFromComputation(
    totalSETax,
    'scheduleSE.line6',
    ['scheduleSE.line4b', 'scheduleSE.line5'],
    'Schedule SE, Line 6',
  )

  // Deductible half — 50% of SE tax is an above-the-line deduction
  const deductibleHalfCents = Math.round(totalSETax * SE_DEDUCTIBLE_HALF)
  const deductibleHalf = tracedFromComputation(
    deductibleHalfCents,
    'scheduleSE.deductibleHalf',
    ['scheduleSE.line6'],
    'Schedule SE, Deductible Half',
  )

  return {
    line2,
    line3,
    line4a,
    line4b,
    line5,
    line6,
    deductibleHalf,
    totalSETax,
    deductibleHalfCents,
    netSEEarnings,
  }
}
