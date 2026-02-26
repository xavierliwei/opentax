/**
 * Iowa IA 1040 constants (Tax Year 2025)
 *
 * Iowa completed its multi-year tax reform in 2025, moving to a flat tax rate.
 * The federal income tax deduction was eliminated starting 2025.
 * Social Security benefits are fully exempt starting 2023.
 *
 * NOTE: monetary values are represented in cents.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/** IA flat income tax rate (2025) — Iowa's new simplified flat rate */
export const IA_FLAT_TAX_RATE = 0.038

/**
 * IA standard deduction by filing status (2025)
 * Iowa has its own small standard deduction amounts (much lower than federal).
 */
export const IA_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(2210),
  mfs:    c(2210),
  mfj:    c(5450),
  hoh:    c(5450),
  qw:     c(5450),
}

/** IA personal exemption credit per person (2025) — $40 per person */
export const IA_PERSONAL_EXEMPTION_CREDIT = c(40)

/** IA Earned Income Credit: 15% of federal EITC (2025) */
export const IA_EIC_RATE = 0.15
