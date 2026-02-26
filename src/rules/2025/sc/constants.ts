/**
 * South Carolina SC1040 constants (Tax Year 2025)
 *
 * SC enacted major tax reform effective 2025, moving from a graduated
 * rate structure (0-6.4%) to a flat 3.99% rate.
 *
 * NOTE: monetary values are represented in cents.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/** SC flat income tax rate (2025) — 3.99% */
export const SC_FLAT_TAX_RATE = 0.0399

/**
 * SC personal exemption per person (2025): $4,700
 * Applies to taxpayer, spouse (if MFJ), and each dependent.
 * SC kept personal exemptions even with the flat tax reform.
 */
export const SC_PERSONAL_EXEMPTION = c(4700)

/**
 * SC standard deduction — SC uses federal standard deduction amounts.
 * These are the 2025 federal standard deduction amounts.
 */
export const SC_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(15000),
  mfs: c(15000),
  mfj: c(30000),
  hoh: c(22500),
  qw: c(30000),
}

/**
 * SC retirement income deduction:
 * - Under 65: up to $10,000 of qualifying retirement income
 * - Age 65+: full retirement income deduction (effectively unlimited)
 */
export const SC_RETIREMENT_DEDUCTION_UNDER_65 = c(10000)

/**
 * SC Earned Income Tax Credit rate: 41.67% of federal EITC
 * One of the highest state EITC rates in the country.
 */
export const SC_EITC_RATE = 0.4167

/**
 * SC two-wage earner credit: lesser of $350 or 100% of the lower-earning
 * spouse's qualified earned income. Only for MFJ filers.
 */
export const SC_TWO_WAGE_EARNER_CREDIT_MAX = c(350)
