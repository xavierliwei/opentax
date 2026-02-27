/**
 * 2026 Tax Year Constants — STUB
 *
 * Placeholder values for tax year 2026 (returns filed in 2027).
 * All monetary amounts are in integer cents.
 *
 * When the IRS publishes Revenue Procedure for 2026 (typically Oct 2025):
 * 1. Update bracket thresholds, standard deduction, phase-out ranges below
 * 2. Add any new constants introduced by legislation
 * 3. Run `npm test` to verify the year module still works
 *
 * NOTE: Values below are copied from 2025 as placeholders.
 * Replace with actual IRS-published 2026 figures when available.
 *
 * Source (pending): IRS Revenue Procedure 2025-XX
 */

import type { FilingStatus } from '../../model/types'

// ── Helpers ────────────────────────────────────────────────────

/** Convert dollars to cents for readability in this file. */
function c(dollars: number): number {
  return Math.round(dollars * 100)
}

// ── Standard Deduction ─────────────────────────────────────────
// TODO: Update from Rev. Proc. 2025-XX when published

export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(15750),
  mfj:    c(31500),
  mfs:    c(15750),
  hoh:    c(23625),
  qw:     c(31500),
}

// ── Tax Year ───────────────────────────────────────────────────

export const TAX_YEAR = 2026
