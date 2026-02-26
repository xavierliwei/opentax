/**
 * Missouri (MO) Tax Year 2025 Constants
 *
 * Missouri uses graduated tax brackets with the same brackets for all
 * filing statuses. For 2025, the top rate is projected at 4.8% (reduced
 * from 4.95% in prior years under HB 2400 phased reductions).
 *
 * Missouri is one of few states that allows a deduction for federal
 * income tax paid, subject to caps.
 *
 * Sources:
 *  - Missouri Revised Statutes Chapter 143
 *  - MO DOR MO-1040 Instructions
 *  - HB 2400 (2022) — phased rate reduction to 4.8% for 2025
 */

import type { FilingStatus } from '../../../model/types'
import type { TaxBracket } from '../constants'

// ── Helpers ────────────────────────────────────────────────────

/** Convert dollars to cents for readability in this file. */
function c(dollars: number): number {
  return Math.round(dollars * 100)
}

// ── Tax Brackets ─────────────────────────────────────────────
// Missouri uses the same brackets for all filing statuses.
// Brackets are narrow — most income falls in the top bracket.
// For 2025, the top rate is 4.8% (HB 2400 phased reduction).

export const MO_TAX_BRACKETS: TaxBracket[] = [
  { rate: 0.020, floor: 0 },
  { rate: 0.025, floor: c(1207) },
  { rate: 0.030, floor: c(2414) },
  { rate: 0.035, floor: c(3621) },
  { rate: 0.040, floor: c(4828) },
  { rate: 0.045, floor: c(6035) },
  { rate: 0.048, floor: c(7242) },
  // $8,449+ is still 4.8% — same as the bracket above
  // No additional bracket needed since 7242–8449 and 8449+ share the same rate
]

// ── Standard Deduction ───────────────────────────────────────
// Missouri uses the federal standard deduction amounts.

export const MO_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(15000),
  mfj:    c(30000),
  mfs:    c(15000),
  hoh:    c(22500),
  qw:     c(30000),
}

// ── Federal Tax Deduction Cap ────────────────────────────────
// Missouri allows a deduction for federal income tax paid,
// subject to a cap (RSMo 143.171). For 2025:
//   - Single/HoH/MFS: $5,000
//   - MFJ/QW: $10,000

export const MO_FEDERAL_TAX_DEDUCTION_CAP: Record<FilingStatus, number> = {
  single: c(5000),
  mfj:    c(10000),
  mfs:    c(5000),
  hoh:    c(5000),
  qw:     c(10000),
}

// ── Social Security Exemption ────────────────────────────────
// Missouri exempts Social Security benefits from state tax
// if the taxpayer's AGI is below certain thresholds.
// For 2025: $100,000 for all filing statuses.
// Above the threshold, the exemption phases out (simplified:
// full SS included in MO income if over threshold).

export const MO_SS_EXEMPTION_AGI_LIMIT: Record<FilingStatus, number> = {
  single: c(100000),
  mfj:    c(100000),
  mfs:    c(100000),
  hoh:    c(100000),
  qw:     c(100000),
}
