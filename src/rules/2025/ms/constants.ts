/**
 * Mississippi Form 80-105 constants (Tax Year 2025)
 *
 * Mississippi has been transitioning to a flat tax. For 2025 the rate is 4.4%
 * on Mississippi taxable income exceeding $10,000 (the first $10,000 is exempt,
 * a remnant of the old 0% bracket).
 *
 * NOTE: monetary values are represented in cents.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/** MS flat income tax rate (2025) — 4.4% */
export const MS_FLAT_TAX_RATE = 0.044

/** MS exempt amount — first $10,000 of taxable income is exempt (2025) */
export const MS_EXEMPT_AMOUNT = c(10000)

/** MS standard deduction by filing status (2025) */
export const MS_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(2300),
  mfs:    c(2300),
  mfj:    c(4600),
  hoh:    c(3400),
  qw:     c(4600),
}

/** MS personal exemption by filing status (2025) */
export const MS_PERSONAL_EXEMPTION: Record<FilingStatus, number> = {
  single: c(6000),
  mfs:    c(6000),
  mfj:    c(12000),
  hoh:    c(8000),
  qw:     c(12000),
}

/** MS dependent exemption — $1,500 per dependent (2025) */
export const MS_DEPENDENT_EXEMPTION = c(1500)
