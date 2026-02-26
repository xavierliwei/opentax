/**
 * Louisiana IT-540 constants (Tax Year 2025)
 *
 * Louisiana underwent major tax reform effective January 1, 2025:
 * - Old graduated rates (1.85%, 3.5%, 4.25%) replaced with a single flat rate
 * - Personal exemptions eliminated
 * - New standard deduction amounts (Louisiana-specific)
 * - New dependent credit ($100/dependent)
 * - New LA EITC (5% of federal EITC)
 *
 * NOTE: monetary values are represented in cents.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/** LA flat income tax rate (2025) — replaces old graduated rates */
export const LA_FLAT_TAX_RATE = 0.03

/** LA standard deduction by filing status (2025 reform) */
export const LA_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(12500),
  mfs:    c(12500),
  mfj:    c(25000),
  hoh:    c(18750),
  qw:     c(25000),
}

/** LA dependent credit: $100 per dependent (2025 reform) */
export const LA_DEPENDENT_CREDIT_PER_DEPENDENT = c(100)

/** LA Earned Income Credit: 5% of federal EITC (new under 2025 reform) */
export const LA_EIC_RATE = 0.05
