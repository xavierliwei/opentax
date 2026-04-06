/**
 * West Virginia Form IT-140 constants (Tax Year 2025)
 *
 * Sources:
 *   - West Virginia State Tax Department Form IT-140 Instructions
 *   - W. Va. Code 11-21-1 et seq.
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: Bracket thresholds and rates are based on
 * 2024 WV tax law (post-reform with phased rate reductions). Official
 * 2025 values should be verified when WV STD publishes final IT-140
 * instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * WV progressive income tax brackets (3 brackets after recent reform).
 *
 * WV uses the same brackets for all filing statuses.
 *
 * 2.36% ($0–$10,000), 3.15% ($10,000–$25,000), 5.12% ($25,000+)
 *
 * Note: WV recently simplified from 5 to 3 brackets with phased rate
 * reductions. These are the projected 2025 rates.
 */
export const WV_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(10000),   rate: 0.0236 },
    { limit: c(25000),   rate: 0.0315 },
    { limit: Infinity,   rate: 0.0512 },
  ],
  mfj: [
    { limit: c(10000),   rate: 0.0236 },
    { limit: c(25000),   rate: 0.0315 },
    { limit: Infinity,   rate: 0.0512 },
  ],
  hoh: [
    { limit: c(10000),   rate: 0.0236 },
    { limit: c(25000),   rate: 0.0315 },
    { limit: Infinity,   rate: 0.0512 },
  ],
  mfs: [
    { limit: c(10000),   rate: 0.0236 },
    { limit: c(25000),   rate: 0.0315 },
    { limit: Infinity,   rate: 0.0512 },
  ],
  qw: [
    { limit: c(10000),   rate: 0.0236 },
    { limit: c(25000),   rate: 0.0315 },
    { limit: Infinity,   rate: 0.0512 },
  ],
}

/**
 * WV follows the federal standard/itemized deduction.
 * West Virginia taxable income starts from federal taxable income
 * with modifications, but for simplicity we model it as starting
 * from federal AGI minus federal-equivalent deductions.
 */
export const WV_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(15000),
  mfj:    c(30000),
  mfs:    c(15000),
  hoh:    c(22500),
  qw:     c(30000),
}

/**
 * WV personal exemption — $2,000 per person.
 *
 * Applies to taxpayer, spouse (if MFJ), and each dependent.
 */
export const WV_PERSONAL_EXEMPTION = c(2000)

/**
 * WV Social Security exemption — WV exempts Social Security from
 * state income tax (fully exempt effective 2024+).
 */
export const WV_SS_FULL_EXEMPTION = true

/**
 * WV Senior Citizen Tax Credit — nonrefundable credit for taxpayers
 * aged 65+ with low income. $1 per $1 of tax, limited to $50.
 * AGI threshold: $20,000 single, $25,000 MFJ.
 */
export const WV_SENIOR_CREDIT_MAX = c(50)
export const WV_SENIOR_CREDIT_AGI_LIMIT: Record<FilingStatus, number> = {
  single: c(20000),
  mfj:    c(25000),
  mfs:    c(20000),
  hoh:    c(20000),
  qw:     c(25000),
}
