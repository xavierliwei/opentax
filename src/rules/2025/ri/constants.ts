/**
 * Rhode Island RI-1040 constants (Tax Year 2025)
 *
 * Sources:
 *   - Rhode Island Division of Taxation — Form RI-1040 Instructions
 *   - R.I. Gen. Laws § 44-30
 *   - https://tax.ri.gov/tax-sections/personal-income-tax
 *
 * NOTE: All dollar amounts are in cents.
 *
 * RI uses the same brackets for all filing statuses.
 * RI follows the federal standard deduction amounts.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * RI progressive income tax brackets (3 brackets).
 *
 * All filing statuses: 3.75% ($0–$73,450), 4.75% ($73,450–$166,950), 5.99% ($166,950+)
 *
 * Rhode Island uses the same bracket thresholds regardless of filing status.
 */
const RI_BRACKETS: { limit: number; rate: number }[] = [
  { limit: c(73450),   rate: 0.0375 },
  { limit: c(166950),  rate: 0.0475 },
  { limit: Infinity,   rate: 0.0599 },
]

export const RI_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: RI_BRACKETS,
  mfj:    RI_BRACKETS,
  mfs:    RI_BRACKETS,
  hoh:    RI_BRACKETS,
  qw:     RI_BRACKETS,
}

/**
 * RI standard deduction — Rhode Island follows federal standard deduction amounts.
 */
export const RI_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(15750),
  mfj:    c(31500),
  mfs:    c(15750),
  hoh:    c(23625),
  qw:     c(31500),
}

/**
 * RI personal exemption — $4,700 per person.
 *
 * Applies to taxpayer, spouse (if MFJ), and each dependent.
 * Subject to phase-out at high incomes (not modeled in initial implementation).
 */
export const RI_PERSONAL_EXEMPTION = c(4700)

/**
 * RI EITC — 15% of federal EITC (refundable).
 *
 * Rhode Island's EITC is calculated as a percentage of the federal earned
 * income credit and is fully refundable.
 */
export const RI_EITC_RATE = 0.15
