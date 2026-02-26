/**
 * Kansas Form K-40 constants (Tax Year 2025)
 *
 * Sources:
 *   - Kansas Department of Revenue K-40 Instructions (2024)
 *   - K.S.A. 79-32,110 et seq.
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: Bracket thresholds and deduction amounts are based on
 * 2024 KS tax law. Official 2025 values should be verified when KS DOR
 * publishes final K-40 instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * KS progressive income tax brackets (3 brackets).
 *
 * Single/HOH/MFS: 3.1% ($0-$15K), 5.25% ($15K-$30K), 5.7% ($30K+)
 * MFJ/QW: 3.1% ($0-$30K), 5.25% ($30K-$60K), 5.7% ($60K+)
 */
export const KS_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(15000),   rate: 0.031 },
    { limit: c(30000),   rate: 0.0525 },
    { limit: Infinity,   rate: 0.057 },
  ],
  mfj: [
    { limit: c(30000),   rate: 0.031 },
    { limit: c(60000),   rate: 0.0525 },
    { limit: Infinity,   rate: 0.057 },
  ],
  hoh: [
    { limit: c(15000),   rate: 0.031 },
    { limit: c(30000),   rate: 0.0525 },
    { limit: Infinity,   rate: 0.057 },
  ],
  mfs: [
    { limit: c(15000),   rate: 0.031 },
    { limit: c(30000),   rate: 0.0525 },
    { limit: Infinity,   rate: 0.057 },
  ],
  qw: [
    { limit: c(30000),   rate: 0.031 },
    { limit: c(60000),   rate: 0.0525 },
    { limit: Infinity,   rate: 0.057 },
  ],
}

/**
 * KS standard deduction by filing status.
 *
 * Kansas has its own (lower) standard deduction amounts, separate from federal.
 */
export const KS_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(3500),
  mfj:    c(8000),
  mfs:    c(4000),
  hoh:    c(6000),
  qw:     c(8000),
}

/**
 * KS personal exemption — $2,250 per person.
 *
 * Applies to taxpayer, spouse (if MFJ), and each dependent.
 */
export const KS_PERSONAL_EXEMPTION = c(2250)

/**
 * KS Social Security exemption — AGI threshold.
 *
 * Kansas exempts Social Security benefits from state income tax for
 * taxpayers with federal AGI of $75,000 or less (all filing statuses).
 */
export const KS_SS_EXEMPTION_AGI_LIMIT = c(75000)

/**
 * KS Food Sales Tax Credit — $125 per person.
 *
 * Refundable credit for filers with income under $30,615.
 * "Per person" = taxpayer + spouse (if MFJ) + dependents.
 */
export const KS_FOOD_SALES_TAX_CREDIT_PER_PERSON = c(125)
export const KS_FOOD_SALES_TAX_CREDIT_INCOME_LIMIT = c(30615)

/**
 * KS Child and Dependent Care Credit — 25% of federal credit.
 */
export const KS_DEPENDENT_CARE_CREDIT_RATE = 0.25
