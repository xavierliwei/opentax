/**
 * Utah TC-40 constants (Tax Year 2025)
 *
 * NOTE: monetary values are represented in cents.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/** UT flat income tax rate (2025) — reduced from 4.65% to 4.55% */
export const UT_FLAT_TAX_RATE = 0.0455

/**
 * Taxpayer Tax Credit rate — 6% of (federal deductions + personal exemptions).
 * This effectively provides a "deduction equivalent" as a credit.
 */
export const UT_TAXPAYER_TAX_CREDIT_RATE = 0.06

/**
 * Personal exemption amount per person for UT tax credit calculation.
 * Utah preserved the pre-2018 federal personal exemption amount.
 * $4,150 per person (taxpayer, spouse, dependents).
 */
export const UT_PERSONAL_EXEMPTION = c(4150)

/**
 * Taxpayer Tax Credit phaseout thresholds (2025).
 * The credit begins to phase out when state taxable income exceeds these amounts.
 */
export const UT_CREDIT_PHASEOUT_THRESHOLD: Record<FilingStatus, number> = {
  single: c(15548),
  mfs: c(15548),
  mfj: c(31096),
  hoh: c(23322),
  qw: c(31096),
}

/**
 * Phaseout rate: 1.3 cents per dollar over the threshold.
 * For every $1 of income over the threshold, the credit is reduced by $0.013.
 */
export const UT_CREDIT_PHASEOUT_RATE = 0.013

/** UT Earned Income Tax Credit: 20% of federal EITC */
export const UT_EITC_RATE = 0.20
