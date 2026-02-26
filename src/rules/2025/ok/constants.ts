/**
 * Oklahoma Form 511 constants (Tax Year 2025)
 *
 * Sources:
 *   - Oklahoma Tax Commission Form 511 Instructions (2024)
 *   - Oklahoma Statutes Title 68, Article 23
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: These brackets and exemption amounts are based on
 * 2024 OK tax law. Official 2025 values should be verified when the
 * Oklahoma Tax Commission publishes final Form 511 instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * Oklahoma progressive income tax brackets (2024 values).
 *
 * OK uses a 6-bracket system: 0.25%, 0.75%, 1.75%, 2.75%, 3.75%, 4.75%.
 * Bracket widths differ by filing status (single vs. MFJ/QW, MFS, HOH).
 *
 * The "limit" values are cumulative upper bounds of taxable income.
 */
export const OK_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(1000),   rate: 0.0025 },
    { limit: c(2500),   rate: 0.0075 },
    { limit: c(3750),   rate: 0.0175 },
    { limit: c(4900),   rate: 0.0275 },
    { limit: c(7200),   rate: 0.0375 },
    { limit: Infinity,  rate: 0.0475 },
  ],
  mfj: [
    { limit: c(2000),   rate: 0.0025 },
    { limit: c(5000),   rate: 0.0075 },
    { limit: c(7500),   rate: 0.0175 },
    { limit: c(9800),   rate: 0.0275 },
    { limit: c(12200),  rate: 0.0375 },
    { limit: Infinity,  rate: 0.0475 },
  ],
  mfs: [
    { limit: c(1000),   rate: 0.0025 },
    { limit: c(2500),   rate: 0.0075 },
    { limit: c(3750),   rate: 0.0175 },
    { limit: c(4900),   rate: 0.0275 },
    { limit: c(7200),   rate: 0.0375 },
    { limit: Infinity,  rate: 0.0475 },
  ],
  hoh: [
    { limit: c(2000),   rate: 0.0025 },
    { limit: c(5000),   rate: 0.0075 },
    { limit: c(7500),   rate: 0.0175 },
    { limit: c(9800),   rate: 0.0275 },
    { limit: c(12200),  rate: 0.0375 },
    { limit: Infinity,  rate: 0.0475 },
  ],
  qw: [
    { limit: c(2000),   rate: 0.0025 },
    { limit: c(5000),   rate: 0.0075 },
    { limit: c(7500),   rate: 0.0175 },
    { limit: c(9800),   rate: 0.0275 },
    { limit: c(12200),  rate: 0.0375 },
    { limit: Infinity,  rate: 0.0475 },
  ],
}

/**
 * Oklahoma uses the federal standard deduction amounts.
 * Same amounts as IRS standard deduction for TY 2025.
 */
export const OK_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(15000),
  mfs:    c(15000),
  mfj:    c(30000),
  hoh:    c(22500),
  qw:     c(30000),
}

/**
 * Oklahoma personal exemption: $1,000 per person
 * (taxpayer, spouse if MFJ, each dependent).
 */
export const OK_PERSONAL_EXEMPTION = c(1000)

/**
 * Oklahoma EITC: 5% of federal EITC (nonrefundable).
 */
export const OK_EITC_RATE = 0.05

/**
 * Oklahoma child tax credit: $100 per qualifying child
 * (for low-income filers — simplified: applied to all qualifying children).
 */
export const OK_CHILD_TAX_CREDIT_PER_CHILD = c(100)

/**
 * Oklahoma 529 plan contribution deduction limits.
 * Single: $10,000; MFJ: $20,000
 */
export const OK_529_DEDUCTION_LIMIT: Record<FilingStatus, number> = {
  single: c(10000),
  mfs:    c(10000),
  mfj:    c(20000),
  hoh:    c(10000),
  qw:     c(20000),
}
