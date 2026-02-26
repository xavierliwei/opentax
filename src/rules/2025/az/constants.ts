/**
 * Arizona Form 140 constants (Tax Year 2025)
 *
 * NOTE: values are represented in cents.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/** AZ flat income tax rate (2025) — one of the lowest in the US */
export const AZ_FLAT_TAX_RATE = 0.025

/**
 * AZ standard deduction by filing status (2025).
 * Arizona conforms to federal standard deduction amounts.
 */
export const AZ_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(14600),
  mfs: c(14600),
  mfj: c(29200),
  hoh: c(21900),
  qw: c(29200),
}

/** AZ dependent exemption: $100 per dependent */
export const AZ_DEPENDENT_EXEMPTION = c(100)

/**
 * AZ Family Tax Credit — available to low-income filers (under $50K AGI).
 * Single/HOH: $40, MFJ/QSS: $60, MFS: $40
 */
export const AZ_FAMILY_TAX_CREDIT_AGI_LIMIT = c(50000)
export const AZ_FAMILY_TAX_CREDIT: Record<FilingStatus, number> = {
  single: c(40),
  mfs: c(40),
  mfj: c(60),
  hoh: c(40),
  qw: c(60),
}
