/**
 * Schedule ADJ — Virginia Adjustments to Federal AGI
 *
 * Converts federal AGI → VA AGI by applying additions and subtractions.
 *
 * Phase 1 scope: Age deduction only.
 * Most W-2 tech employees under 65 have VA AGI = Federal AGI (zero adjustments).
 *
 * Source: VA Schedule ADJ Instructions
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  VA_AGE_DEDUCTION_MAX,
  VA_AGE_DEDUCTION_PHASEOUT_START,
} from './constants'

// ── Result type ──────────────────────────────────────────────────

export interface ScheduleADJResult {
  federalAGI: number             // cents — Form 1040 Line 11
  additions: number              // cents — Schedule ADJ Part 1 total
  subtractions: number           // cents — Schedule ADJ Part 2 total
  vaAGI: number                  // cents — FAGI + additions - subtractions

  // Detail
  ageDeduction: number           // cents — age 65+ subtraction (up to $12,000)
}

// ── Age deduction computation ────────────────────────────────────

/**
 * Compute the VA age deduction for a single qualifying filer (age 65+).
 * - FAGI ≤ $75,000: full $12,000
 * - FAGI > $75,000: reduced $1-for-$1
 * - FAGI ≥ $87,000: fully phased out
 */
function computeSingleAgeDeduction(federalAGI: number): number {
  if (federalAGI <= VA_AGE_DEDUCTION_PHASEOUT_START) {
    return VA_AGE_DEDUCTION_MAX
  }
  const excess = federalAGI - VA_AGE_DEDUCTION_PHASEOUT_START
  return Math.max(0, VA_AGE_DEDUCTION_MAX - excess)
}

// ── Main computation ─────────────────────────────────────────────

export function computeScheduleADJ(
  form1040: Form1040Result,
  model: TaxReturn,
  _config: StateReturnConfig,
): ScheduleADJResult {
  const federalAGI = form1040.line11.amount

  // ── Additions (Part 1) ────────────────────────────────────
  // Phase 1: no additions needed for typical W-2 filer
  // (VA conforms to IRC §223, unlike CA)
  const additions = 0

  // ── Subtractions (Part 2) ──────────────────────────────────
  // Age deduction: each qualifying filer (age 65+) gets an independent deduction
  let ageDeduction = 0
  const tp65 = model.deductions.taxpayerAge65 ?? false
  const sp65 = model.deductions.spouseAge65 ?? false

  if (tp65) {
    ageDeduction += computeSingleAgeDeduction(federalAGI)
  }
  if (sp65 && (model.filingStatus === 'mfj' || model.filingStatus === 'mfs')) {
    ageDeduction += computeSingleAgeDeduction(federalAGI)
  }

  const subtractions = ageDeduction

  const vaAGI = federalAGI + additions - subtractions

  return {
    federalAGI,
    additions,
    subtractions,
    vaAGI,
    ageDeduction,
  }
}
