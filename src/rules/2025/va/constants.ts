/**
 * Virginia 2025 Tax Year Constants (Form 760)
 *
 * All monetary amounts are in integer cents.
 *
 * Primary sources:
 *   Virginia Dept. of Taxation — 2025 Tax Rate Schedule
 *   Virginia Form 760 Instructions
 *   https://www.tax.virginia.gov/individual-income-tax
 */

import type { FilingStatus } from '../../../model/types'
import type { TaxBracket } from '../constants'

// ── Helpers ────────────────────────────────────────────────────

/** Convert dollars to cents for readability in this file. */
function c(dollars: number): number {
  return Math.round(dollars * 100)
}

// ── Standard Deduction ──────────────────────────────────────────
// Source: VA Form 760 Instructions — Line 6

export const VA_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(8000),
  mfj:    c(16000),
  mfs:    c(8000),
  hoh:    c(16000),  // VA treats HOH same as MFJ for std deduction
  qw:     c(16000),
}

// ── Tax Brackets (4 brackets: 2% – 5.75%) ───────────────────────
// Virginia uses the SAME brackets for ALL filing statuses.
// Source: VA 2025 Tax Rate Schedule

export const VA_TAX_BRACKETS: TaxBracket[] = [
  { rate: 0.02,   floor: c(0) },      // $0 – $3,000
  { rate: 0.03,   floor: c(3000) },    // $3,001 – $5,000
  { rate: 0.05,   floor: c(5000) },    // $5,001 – $17,000
  { rate: 0.0575, floor: c(17000) },   // $17,001+
]

// ── Personal Exemptions ─────────────────────────────────────────
// Virginia uses exemption DEDUCTIONS (reduces taxable income),
// not exemption credits like CA.

export const VA_PERSONAL_EXEMPTION = c(930)           // per filer
export const VA_DEPENDENT_EXEMPTION = c(930)           // per dependent
export const VA_AGE65_EXTRA_EXEMPTION = c(800)         // per filer age 65+
export const VA_BLIND_EXTRA_EXEMPTION = c(800)         // per filer who is blind

// ── Age Deduction (Age 65+ subtraction) ─────────────────────────
// Virginia provides an age deduction for filers born before 1/2/1961
// (age 65+ during tax year 2025).
// - If FAGI ≤ $75,000: full deduction of $12,000
// - If FAGI > $75,000: $12,000 minus dollar-for-dollar reduction
// - Phases out completely at FAGI of $87,000

export const VA_AGE_DEDUCTION_MAX = c(12000)
export const VA_AGE_DEDUCTION_PHASEOUT_START = c(75000)

// ── Low-Income Credit ───────────────────────────────────────────
// 2025 HHS poverty guidelines (estimated)

export const VA_POVERTY_GUIDELINES: Record<number, number> = {
  1: c(15650),
  2: c(21150),
  3: c(26650),
  4: c(32150),
  5: c(37650),
  6: c(43150),
  7: c(48650),
  8: c(54150),
}
