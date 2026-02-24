/**
 * New York IT-201 constants (Tax Year 2025)
 *
 * Sources:
 *   - NY Tax Law §601 (rate tables)
 *   - NY DTF IT-201 Instructions (2024, projected 2025 with inflation adjustments)
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: These brackets and deduction amounts are based on
 * 2024 NY tax law projected forward to 2025 using historical inflation
 * adjustment patterns. Official 2025 values should be verified when
 * NY DTF publishes final IT-201 instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * NY progressive income tax brackets (2025 projected).
 *
 * NY uses an 8-bracket system ranging from 4% to 10.9%.
 * The top bracket (10.9%) was made permanent in 2023.
 * Bracket thresholds differ by filing status.
 */
export const NY_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(8500),     rate: 0.04 },
    { limit: c(11700),    rate: 0.045 },
    { limit: c(13900),    rate: 0.0525 },
    { limit: c(80650),    rate: 0.0585 },
    { limit: c(215400),   rate: 0.0625 },
    { limit: c(1077550),  rate: 0.0685 },
    { limit: c(5000000),  rate: 0.0965 },
    { limit: c(25000000), rate: 0.103 },
    { limit: Infinity,    rate: 0.109 },
  ],
  mfs: [
    { limit: c(8500),     rate: 0.04 },
    { limit: c(11700),    rate: 0.045 },
    { limit: c(13900),    rate: 0.0525 },
    { limit: c(80650),    rate: 0.0585 },
    { limit: c(215400),   rate: 0.0625 },
    { limit: c(1077550),  rate: 0.0685 },
    { limit: c(5000000),  rate: 0.0965 },
    { limit: c(25000000), rate: 0.103 },
    { limit: Infinity,    rate: 0.109 },
  ],
  mfj: [
    { limit: c(17150),    rate: 0.04 },
    { limit: c(23600),    rate: 0.045 },
    { limit: c(27900),    rate: 0.0525 },
    { limit: c(161550),   rate: 0.0585 },
    { limit: c(323200),   rate: 0.0625 },
    { limit: c(2155350),  rate: 0.0685 },
    { limit: c(5000000),  rate: 0.0965 },
    { limit: c(25000000), rate: 0.103 },
    { limit: Infinity,    rate: 0.109 },
  ],
  hoh: [
    { limit: c(12800),    rate: 0.04 },
    { limit: c(17650),    rate: 0.045 },
    { limit: c(20900),    rate: 0.0525 },
    { limit: c(107650),   rate: 0.0585 },
    { limit: c(269300),   rate: 0.0625 },
    { limit: c(1616450),  rate: 0.0685 },
    { limit: c(5000000),  rate: 0.0965 },
    { limit: c(25000000), rate: 0.103 },
    { limit: Infinity,    rate: 0.109 },
  ],
  qw: [
    { limit: c(17150),    rate: 0.04 },
    { limit: c(23600),    rate: 0.045 },
    { limit: c(27900),    rate: 0.0525 },
    { limit: c(161550),   rate: 0.0585 },
    { limit: c(323200),   rate: 0.0625 },
    { limit: c(2155350),  rate: 0.0685 },
    { limit: c(5000000),  rate: 0.0965 },
    { limit: c(25000000), rate: 0.103 },
    { limit: Infinity,    rate: 0.109 },
  ],
}

/**
 * NY standard deduction by filing status (2025 projected).
 *
 * NY standard deduction amounts are set by statute and do not
 * inflate automatically. These match 2024 values (unchanged since 2018).
 */
export const NY_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(8000),
  mfs: c(8000),
  mfj: c(16050),
  hoh: c(11200),
  qw: c(16050),
}

/**
 * NY dependent exemption amount (2025).
 * Each dependent reduces NY taxable income by $1,000.
 */
export const NY_DEPENDENT_EXEMPTION = c(1000)

/**
 * NY Earned Income Tax Credit (EITC) — percentage of federal EITC.
 * NY allows 30% of the federal earned income credit.
 */
export const NY_EITC_RATE = 0.30

/**
 * NY Child and Dependent Care Credit — percentage of federal credit.
 * For NY AGI up to $25,000: 110% of federal credit.
 * For NY AGI $25,001–$40,000: linear phase from 110% down to 100%.
 * For NY AGI $40,001–$50,000: linear phase from 100% down to 20%.
 * For NY AGI $50,001–$65,000: 20%.
 * For NY AGI over $65,000: decreases further.
 *
 * SCAFFOLD: We implement the simplified version — 20% for AGI > $50K,
 * 100% for AGI $25K–$50K, 110% for AGI ≤ $25K.
 */
export function nyChildCareCredRate(nyAGI: number): number {
  if (nyAGI <= c(25000)) return 1.10
  if (nyAGI <= c(50000)) return 1.00
  return 0.20
}

/**
 * Social Security income: NY fully exempts Social Security benefits
 * from state income tax (NY Tax Law §612(c)(3-a)).
 */
export const NY_SS_FULLY_EXEMPT = true
