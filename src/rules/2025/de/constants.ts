/**
 * Delaware Form 200-01 constants (Tax Year 2025)
 *
 * Sources:
 *   - Delaware Division of Revenue Form 200-01 Instructions
 *   - 30 Del. C. § 1102 (personal income tax rates)
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: Bracket thresholds and deduction amounts are based on
 * 2024 DE tax law. Official 2025 values should be verified when Delaware DOR
 * publishes final Form 200-01 instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * DE graduated income tax brackets (7 brackets).
 *
 * Delaware uses the SAME brackets for ALL filing statuses:
 *   0% on $0–$2,000
 *   2.2% on $2,000–$5,000
 *   3.9% on $5,000–$10,000
 *   4.8% on $10,000–$20,000
 *   5.2% on $20,000–$25,000
 *   5.55% on $25,000–$60,000
 *   6.6% on $60,000+
 */
const DE_BRACKETS: { limit: number; rate: number }[] = [
  { limit: c(2000),    rate: 0.0 },
  { limit: c(5000),    rate: 0.022 },
  { limit: c(10000),   rate: 0.039 },
  { limit: c(20000),   rate: 0.048 },
  { limit: c(25000),   rate: 0.052 },
  { limit: c(60000),   rate: 0.0555 },
  { limit: Infinity,   rate: 0.066 },
]

export const DE_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: DE_BRACKETS,
  mfj:    DE_BRACKETS,
  mfs:    DE_BRACKETS,
  hoh:    DE_BRACKETS,
  qw:     DE_BRACKETS,
}

/**
 * DE standard deduction by filing status.
 *
 * Single: $3,250  MFJ: $6,500  MFS: $3,250  HOH: $3,250  QW: $6,500
 */
export const DE_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(3250),
  mfj:    c(6500),
  mfs:    c(3250),
  hoh:    c(3250),
  qw:     c(6500),
}

/**
 * DE personal credit — $110 per person.
 *
 * Applies to taxpayer, spouse (if MFJ), and each dependent.
 * This is a nonrefundable credit (limited to tax liability).
 */
export const DE_PERSONAL_CREDIT = c(110)
