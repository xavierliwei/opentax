/**
 * QBI Deduction — IRC §199A (Form 8995, Simplified Computation)
 *
 * Implements the simplified QBI deduction for taxpayers with taxable
 * income at or below the threshold ($191,950 single / $383,900 MFJ).
 *
 * The simplified path (Form 8995) applies when:
 *   - Taxable income is below the threshold, AND
 *   - The taxpayer has qualified business income (QBI) from:
 *     • Sole proprietorship (Schedule C)
 *     • Partnership/S-corp (K-1 — when supported)
 *     • Elected rental real estate safe harbor
 *
 * The deduction = min(20% × QBI, 20% × taxable income before QBI deduction).
 *
 * For taxpayers ABOVE the threshold:
 *   - W-2 wage / UBIA limitations apply (Form 8995-A)
 *   - SSTB phase-out applies
 *   - These are NOT yet supported — a validation warning is emitted
 *
 * Source: IRC §199A, Form 8995 instructions
 * All amounts in integer cents.
 */

import type { FilingStatus } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation, tracedZero } from '../../model/traced'
import { QBI_DEDUCTION_RATE, QBI_TAXABLE_INCOME_THRESHOLD } from './constants'

// ── Result type ──────────────────────────────────────────────────

export interface QBIDeductionResult {
  /** Total qualified business income from all sources (cents) */
  totalQBI: number

  /** 20% of QBI (cents) */
  qbiComponent: number

  /** 20% of taxable income before QBI deduction (cents) */
  taxableIncomeComponent: number

  /** Final QBI deduction: min(qbiComponent, taxableIncomeComponent) (cents) */
  deductionAmount: number

  /** Whether simplified path was used (vs. needing Form 8995-A) */
  simplifiedPath: boolean

  /** Whether above-threshold warning should be emitted */
  aboveThreshold: boolean

  /** Traced value for Form 1040 Line 13 */
  line13: TracedValue
}

// ── Computation ──────────────────────────────────────────────────

/**
 * Compute QBI deduction (Form 8995 simplified path).
 *
 * @param scheduleCNetProfit - Net profit from Schedule C businesses (cents, can be negative)
 * @param k1QBI - QBI from K-1 forms (cents, currently 0 until K-1 is supported)
 * @param taxableIncomeBeforeQBI - Form 1040 Line 11 (AGI) minus Line 12 (deduction) (cents)
 * @param filingStatus
 */
export function computeQBIDeduction(
  scheduleCNetProfit: number,
  k1QBI: number,
  taxableIncomeBeforeQBI: number,
  filingStatus: FilingStatus,
): QBIDeductionResult {
  // Total QBI — sum of all qualified business income sources
  // QBI can be negative (loss); negative QBI reduces deduction to $0
  const totalQBI = scheduleCNetProfit + k1QBI

  const threshold = QBI_TAXABLE_INCOME_THRESHOLD[filingStatus]
  const aboveThreshold = taxableIncomeBeforeQBI > threshold

  // If QBI ≤ 0 or taxable income ≤ 0, no deduction
  if (totalQBI <= 0 || taxableIncomeBeforeQBI <= 0) {
    return {
      totalQBI,
      qbiComponent: 0,
      taxableIncomeComponent: 0,
      deductionAmount: 0,
      simplifiedPath: !aboveThreshold,
      aboveThreshold,
      line13: tracedZero('form1040.line13', 'Form 1040, Line 13'),
    }
  }

  // Above threshold: emit warning, compute $0 (conservative — needs Form 8995-A)
  if (aboveThreshold) {
    return {
      totalQBI,
      qbiComponent: Math.round(totalQBI * QBI_DEDUCTION_RATE),
      taxableIncomeComponent: Math.round(taxableIncomeBeforeQBI * QBI_DEDUCTION_RATE),
      deductionAmount: 0,
      simplifiedPath: false,
      aboveThreshold: true,
      line13: tracedZero('form1040.line13', 'Form 1040, Line 13'),
    }
  }

  // Below threshold: simplified path (Form 8995)
  const qbiComponent = Math.round(totalQBI * QBI_DEDUCTION_RATE)
  const taxableIncomeComponent = Math.round(taxableIncomeBeforeQBI * QBI_DEDUCTION_RATE)
  const deductionAmount = Math.min(qbiComponent, taxableIncomeComponent)

  const line13 = deductionAmount > 0
    ? tracedFromComputation(
        deductionAmount,
        'form1040.line13',
        ['qbi.deduction'],
        'Form 1040, Line 13',
      )
    : tracedZero('form1040.line13', 'Form 1040, Line 13')

  return {
    totalQBI,
    qbiComponent,
    taxableIncomeComponent,
    deductionAmount,
    simplifiedPath: true,
    aboveThreshold: false,
    line13,
  }
}
