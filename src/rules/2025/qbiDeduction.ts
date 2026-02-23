/**
 * QBI Deduction — IRC §199A (Form 8995 & Form 8995-A)
 *
 * Implements both simplified (Form 8995) and above-threshold (Form 8995-A)
 * QBI deduction paths.
 *
 * Form 8995 (Simplified):
 *   Applies when taxable income ≤ threshold ($191,950 single / $383,900 MFJ).
 *   Deduction = min(20% × QBI, 20% × taxable income before QBI).
 *
 * Form 8995-A (Above Threshold):
 *   Applies when taxable income > threshold.
 *   Per-business QBI is limited by the greater of:
 *     (a) 50% × W-2 wages, or
 *     (b) 25% × W-2 wages + 2.5% × UBIA of qualified property
 *   In the phase-in range (threshold to threshold + $50K/$100K MFJ),
 *   the limitation is phased in proportionally.
 *
 * SSTB Handling:
 *   If a business is a Specified Service Trade or Business (SSTB):
 *   - Fully above phase-in range → QBI from that business = $0
 *   - In phase-in range → QBI, W-2 wages, UBIA all reduced by applicable %
 *   Currently: SSTB businesses emit a warning. If isSSTB is set and the
 *   taxpayer is fully above the phase-in range, that business's QBI is
 *   excluded. Phase-in SSTB reduction is supported.
 *
 * Source: IRC §199A, Form 8995/8995-A instructions, Reg. §1.199A
 * All amounts in integer cents.
 */

import type { FilingStatus } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation, tracedZero } from '../../model/traced'
import {
  QBI_DEDUCTION_RATE,
  QBI_TAXABLE_INCOME_THRESHOLD,
  QBI_PHASEOUT_RANGE,
} from './constants'

// ── Per-business QBI input ──────────────────────────────────────

/** Per-business QBI data for Form 8995-A computation */
export interface QBIBusinessInput {
  /** Unique business identifier */
  id: string
  /** Business name (for tracing / diagnostics) */
  name: string
  /** Qualified business income for this business (cents, can be negative) */
  qbi: number
  /** W-2 wages paid by this business (cents, 0 if not provided) */
  w2Wages: number
  /** UBIA of qualified property (cents, 0 if not provided) */
  ubia: number
  /** Whether this is a Specified Service Trade or Business */
  isSSTB: boolean
}

// ── Per-business QBI result ─────────────────────────────────────

/** Per-business result from Form 8995-A computation */
export interface QBIBusinessResult {
  id: string
  name: string
  /** Original QBI before any adjustments (cents) */
  qbi: number
  /** 20% of QBI (before limitation) */
  twentyPercentQBI: number
  /** W-2/UBIA wage limitation: max(50%×W2, 25%×W2 + 2.5%×UBIA) */
  wageLimitation: number
  /** Deductible QBI for this business after all limitations */
  deductibleQBI: number
  /** Whether SSTB exclusion applied */
  sstbExcluded: boolean
  /** Whether SSTB phase-in reduction was applied */
  sstbPhaseInApplied: boolean
}

// ── Result type ──────────────────────────────────────────────────

export interface QBIDeductionResult {
  /** Total qualified business income from all sources (cents) */
  totalQBI: number

  /** 20% of QBI (cents) */
  qbiComponent: number

  /** 20% of taxable income before QBI deduction (cents) */
  taxableIncomeComponent: number

  /** Final QBI deduction: min(combined deductible QBI, 20% × TI) (cents) */
  deductionAmount: number

  /** Whether simplified path was used (vs. Form 8995-A) */
  simplifiedPath: boolean

  /** Whether above-threshold warning should be emitted */
  aboveThreshold: boolean

  /** Per-business results (Form 8995-A only, null for simplified path) */
  businessResults: QBIBusinessResult[] | null

  /** True if any SSTB businesses were encountered */
  hasSSTB: boolean

  /** True if any SSTB businesses had unsupported phase-in (kept conservative) */
  sstbWarning: boolean

  /** Traced value for Form 1040 Line 13 */
  line13: TracedValue
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Compute the W-2/UBIA wage limitation for a single business.
 * Limitation = max(50% × W-2 wages, 25% × W-2 wages + 2.5% × UBIA)
 */
export function computeWageLimitation(w2Wages: number, ubia: number): number {
  const fiftyPercentW2 = Math.round(w2Wages * 0.50)
  const twentyFivePercentW2PlusUBIA = Math.round(w2Wages * 0.25) + Math.round(ubia * 0.025)
  return Math.max(fiftyPercentW2, twentyFivePercentW2PlusUBIA)
}

/**
 * Compute phase-in factor: fraction of phase-in range consumed.
 * Returns 0 at threshold, 1 at threshold + phaseout range.
 * Clamped to [0, 1].
 */
export function computePhaseInFactor(
  taxableIncome: number,
  filingStatus: FilingStatus,
): number {
  const threshold = QBI_TAXABLE_INCOME_THRESHOLD[filingStatus]
  const range = QBI_PHASEOUT_RANGE[filingStatus]
  if (taxableIncome <= threshold) return 0
  if (taxableIncome >= threshold + range) return 1
  return (taxableIncome - threshold) / range
}

/**
 * Compute QBI deduction for a single business in the above-threshold path.
 *
 * For non-SSTB businesses in the phase-in range:
 *   deductible = 20%×QBI - phaseInFactor × (20%×QBI - wageLimitation)
 *   (but never below wageLimitation, never above 20%×QBI)
 *
 * For non-SSTB businesses fully above phase-in range:
 *   deductible = min(20%×QBI, wageLimitation)
 *
 * For SSTB businesses fully above phase-in range:
 *   deductible = $0 (QBI excluded)
 *
 * For SSTB businesses in the phase-in range:
 *   QBI, W-2, UBIA all reduced by (1 - phaseInFactor), then same wage limitation logic.
 */
function computeBusinessQBI(
  biz: QBIBusinessInput,
  phaseInFactor: number,
  fullyAbove: boolean,
): QBIBusinessResult {
  // Negative QBI businesses contribute losses (no limitation applied to losses)
  if (biz.qbi <= 0) {
    return {
      id: biz.id,
      name: biz.name,
      qbi: biz.qbi,
      twentyPercentQBI: 0,
      wageLimitation: 0,
      deductibleQBI: biz.qbi, // pass through the loss
      sstbExcluded: false,
      sstbPhaseInApplied: false,
    }
  }

  // SSTB fully above threshold + phaseout range → excluded
  if (biz.isSSTB && fullyAbove) {
    return {
      id: biz.id,
      name: biz.name,
      qbi: biz.qbi,
      twentyPercentQBI: Math.round(biz.qbi * QBI_DEDUCTION_RATE),
      wageLimitation: 0,
      deductibleQBI: 0,
      sstbExcluded: true,
      sstbPhaseInApplied: false,
    }
  }

  // SSTB in phase-in range: reduce QBI, W-2, UBIA by (1 - phaseInFactor)
  let effectiveQBI = biz.qbi
  let effectiveW2 = biz.w2Wages
  let effectiveUBIA = biz.ubia
  let sstbPhaseInApplied = false

  if (biz.isSSTB && phaseInFactor > 0) {
    const reductionFactor = 1 - phaseInFactor
    effectiveQBI = Math.round(biz.qbi * reductionFactor)
    effectiveW2 = Math.round(biz.w2Wages * reductionFactor)
    effectiveUBIA = Math.round(biz.ubia * reductionFactor)
    sstbPhaseInApplied = true
  }

  const twentyPercentQBI = Math.round(effectiveQBI * QBI_DEDUCTION_RATE)
  const wageLimitation = computeWageLimitation(effectiveW2, effectiveUBIA)

  let deductibleQBI: number

  if (fullyAbove || (biz.isSSTB && phaseInFactor > 0)) {
    // Fully above phase-in (non-SSTB) or SSTB in phase-in:
    // Deductible = min(20% × effectiveQBI, wageLimitation)
    deductibleQBI = Math.min(twentyPercentQBI, wageLimitation)
  } else if (phaseInFactor > 0) {
    // Non-SSTB in phase-in range:
    // deductible = 20%×QBI - phaseInFactor × max(0, 20%×QBI - wageLimitation)
    const excess = Math.max(0, twentyPercentQBI - wageLimitation)
    deductibleQBI = Math.round(twentyPercentQBI - phaseInFactor * excess)
  } else {
    // At or below threshold (shouldn't reach here in 8995-A path, but safety)
    deductibleQBI = twentyPercentQBI
  }

  return {
    id: biz.id,
    name: biz.name,
    qbi: biz.qbi,
    twentyPercentQBI,
    wageLimitation,
    deductibleQBI: Math.max(0, deductibleQBI),
    sstbExcluded: false,
    sstbPhaseInApplied,
  }
}

// ── Main computation ─────────────────────────────────────────────

/**
 * Compute QBI deduction (Form 8995 simplified path or Form 8995-A).
 *
 * Backward-compatible: if no businesses array is provided, uses the legacy
 * aggregate (scheduleCNetProfit + k1QBI) and falls through to simplified
 * or conservative $0 for above-threshold.
 *
 * @param scheduleCNetProfit - Net profit from Schedule C businesses (cents, can be negative)
 * @param k1QBI - QBI from K-1 forms (cents)
 * @param taxableIncomeBeforeQBI - Form 1040 Line 11 (AGI) minus Line 12 (deduction) (cents)
 * @param filingStatus
 * @param businesses - Optional per-business QBI data for Form 8995-A
 */
export function computeQBIDeduction(
  scheduleCNetProfit: number,
  k1QBI: number,
  taxableIncomeBeforeQBI: number,
  filingStatus: FilingStatus,
  businesses?: QBIBusinessInput[],
): QBIDeductionResult {
  // Total QBI — sum of all qualified business income sources
  const totalQBI = scheduleCNetProfit + k1QBI

  const threshold = QBI_TAXABLE_INCOME_THRESHOLD[filingStatus]
  const phaseoutRange = QBI_PHASEOUT_RANGE[filingStatus]
  const aboveThreshold = taxableIncomeBeforeQBI > threshold

  const hasSSTB = businesses?.some(b => b.isSSTB) ?? false

  // If QBI ≤ 0 or taxable income ≤ 0, no deduction
  if (totalQBI <= 0 || taxableIncomeBeforeQBI <= 0) {
    return {
      totalQBI,
      qbiComponent: 0,
      taxableIncomeComponent: 0,
      deductionAmount: 0,
      simplifiedPath: !aboveThreshold,
      aboveThreshold,
      businessResults: null,
      hasSSTB,
      sstbWarning: false,
      line13: tracedZero('form1040.line13', 'Form 1040, Line 13'),
    }
  }

  // ── Below threshold: Form 8995 simplified path ──
  if (!aboveThreshold) {
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
      businessResults: null,
      hasSSTB,
      sstbWarning: false,
      line13,
    }
  }

  // ── Above threshold: Form 8995-A ──

  // If no per-business data provided, fall back to conservative $0
  // (backward compatibility for callers that don't provide business details)
  if (!businesses || businesses.length === 0) {
    return {
      totalQBI,
      qbiComponent: Math.round(totalQBI * QBI_DEDUCTION_RATE),
      taxableIncomeComponent: Math.round(taxableIncomeBeforeQBI * QBI_DEDUCTION_RATE),
      deductionAmount: 0,
      simplifiedPath: false,
      aboveThreshold: true,
      businessResults: null,
      hasSSTB,
      sstbWarning: false,
      line13: tracedZero('form1040.line13', 'Form 1040, Line 13'),
    }
  }

  // Compute phase-in factor and whether fully above the phase-in range
  const phaseInFactor = computePhaseInFactor(taxableIncomeBeforeQBI, filingStatus)
  const fullyAbove = taxableIncomeBeforeQBI >= threshold + phaseoutRange

  // Compute per-business deductible QBI
  const businessResults = businesses.map(biz =>
    computeBusinessQBI(biz, phaseInFactor, fullyAbove),
  )

  // Combined deductible QBI = sum of positive deductible amounts + losses
  // Per IRC §199A(b)(1): aggregate positive deductible QBI, then net with losses
  const totalPositiveDeductible = businessResults
    .filter(r => r.deductibleQBI > 0)
    .reduce((sum, r) => sum + r.deductibleQBI, 0)
  const totalLosses = businessResults
    .filter(r => r.qbi < 0)
    .reduce((sum, r) => sum + r.qbi, 0) // negative number
  // After aggregating losses, the combined amount can't go below zero
  const combinedDeductible = Math.max(0, totalPositiveDeductible + Math.round(totalLosses * QBI_DEDUCTION_RATE))

  // Still capped by 20% of taxable income
  const taxableIncomeComponent = Math.round(taxableIncomeBeforeQBI * QBI_DEDUCTION_RATE)
  const deductionAmount = Math.min(combinedDeductible, taxableIncomeComponent)

  const sstbWarning = hasSSTB

  const line13 = deductionAmount > 0
    ? tracedFromComputation(
        deductionAmount,
        'form1040.line13',
        ['qbi.deduction.8995a'],
        'Form 1040, Line 13 (Form 8995-A)',
      )
    : tracedZero('form1040.line13', 'Form 1040, Line 13')

  return {
    totalQBI,
    qbiComponent: Math.round(totalQBI * QBI_DEDUCTION_RATE),
    taxableIncomeComponent,
    deductionAmount,
    simplifiedPath: false,
    aboveThreshold: true,
    businessResults,
    hasSSTB,
    sstbWarning,
    line13,
  }
}
