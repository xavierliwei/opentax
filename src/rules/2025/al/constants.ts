/**
 * Alabama Form 40 constants (Tax Year 2025)
 *
 * Alabama uses graduated tax rates with 3 brackets.  The bracket widths
 * differ by filing status (single vs. MFJ/MFS/HOH), but the rates are the
 * same for all statuses.
 *
 * Alabama is one of very few states that allows a deduction for federal
 * income tax paid.  It also fully exempts Social Security benefits.
 *
 * NOTE: monetary values are represented in integer cents.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

// ── Tax brackets ─────────────────────────────────────────────

export interface ALTaxBracket {
  rate: number
  upTo: number  // cents — cumulative upper bound of the bracket (Infinity for last)
}

/**
 * AL graduated rates (same rates for all filing statuses; bracket widths differ).
 *
 * Single:     2% on first $500,  4% on next $2,500,  5% on amount over $3,000
 * MFJ/QW:    2% on first $1,000, 4% on next $5,000,  5% on amount over $6,000
 * MFS:       2% on first $500,  4% on next $2,500,  5% on amount over $3,000
 * HOH:       2% on first $500,  4% on next $2,500,  5% on amount over $3,000
 */
export const AL_TAX_BRACKETS: Record<FilingStatus, ALTaxBracket[]> = {
  single: [
    { rate: 0.02, upTo: c(500) },
    { rate: 0.04, upTo: c(3000) },
    { rate: 0.05, upTo: Infinity },
  ],
  mfj: [
    { rate: 0.02, upTo: c(1000) },
    { rate: 0.04, upTo: c(6000) },
    { rate: 0.05, upTo: Infinity },
  ],
  mfs: [
    { rate: 0.02, upTo: c(500) },
    { rate: 0.04, upTo: c(3000) },
    { rate: 0.05, upTo: Infinity },
  ],
  hoh: [
    { rate: 0.02, upTo: c(500) },
    { rate: 0.04, upTo: c(3000) },
    { rate: 0.05, upTo: Infinity },
  ],
  qw: [
    { rate: 0.02, upTo: c(1000) },
    { rate: 0.04, upTo: c(6000) },
    { rate: 0.05, upTo: Infinity },
  ],
}

// ── Standard deduction ───────────────────────────────────────

export const AL_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(2500),
  mfj:    c(7500),
  mfs:    c(3750),
  hoh:    c(4700),
  qw:     c(7500),
}

// ── Personal exemption ───────────────────────────────────────

export const AL_PERSONAL_EXEMPTION: Record<FilingStatus, number> = {
  single: c(1500),
  mfj:    c(3000),
  mfs:    c(1500),
  hoh:    c(3000),
  qw:     c(3000),
}

/** Per-dependent exemption: $1,000 each */
export const AL_DEPENDENT_EXEMPTION = c(1000)
