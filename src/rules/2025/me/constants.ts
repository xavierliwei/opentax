/**
 * Maine Form 1040ME constants (Tax Year 2025)
 *
 * Sources:
 *   - Maine Revenue Services Form 1040ME Instructions
 *   - 36 M.R.S. 5111 et seq.
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: Bracket thresholds and deduction amounts are based on
 * 2024 ME tax law. Official 2025 values should be verified when ME Revenue
 * Services publishes final 1040ME instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * ME progressive income tax brackets (3 brackets).
 *
 * Single: 5.8% ($0–$26,050), 6.75% ($26,050–$61,600), 7.15% ($61,600+)
 * MFJ/QW: 5.8% ($0–$52,100), 6.75% ($52,100–$123,250), 7.15% ($123,250+)
 * MFS: 5.8% ($0–$26,050), 6.75% ($26,050–$61,600), 7.15% ($61,600+)
 * HOH: 5.8% ($0–$39,100), 6.75% ($39,100–$92,450), 7.15% ($92,450+)
 */
export const ME_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(26050),   rate: 0.058 },
    { limit: c(61600),   rate: 0.0675 },
    { limit: Infinity,   rate: 0.0715 },
  ],
  mfj: [
    { limit: c(52100),   rate: 0.058 },
    { limit: c(123250),  rate: 0.0675 },
    { limit: Infinity,   rate: 0.0715 },
  ],
  hoh: [
    { limit: c(39100),   rate: 0.058 },
    { limit: c(92450),   rate: 0.0675 },
    { limit: Infinity,   rate: 0.0715 },
  ],
  mfs: [
    { limit: c(26050),   rate: 0.058 },
    { limit: c(61600),   rate: 0.0675 },
    { limit: Infinity,   rate: 0.0715 },
  ],
  qw: [
    { limit: c(52100),   rate: 0.058 },
    { limit: c(123250),  rate: 0.0675 },
    { limit: Infinity,   rate: 0.0715 },
  ],
}

/**
 * ME standard deduction — Maine follows federal standard deduction amounts.
 */
export const ME_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(15000),
  mfj:    c(30000),
  mfs:    c(15000),
  hoh:    c(22500),
  qw:     c(30000),
}

/**
 * ME personal exemption — $5,000 per person.
 *
 * Applies to taxpayer, spouse (if MFJ), and each dependent.
 * Subject to phase-out at high incomes (not modeled in initial implementation).
 */
export const ME_PERSONAL_EXEMPTION = c(5000)

/**
 * ME EITC — 25% of federal EITC (refundable).
 *
 * Maine's EITC is one of the more generous state EITCs.
 */
export const ME_EITC_RATE = 0.25

/**
 * ME Child/Dependent Care Credit — 25% of federal credit.
 */
export const ME_DEPENDENT_CARE_CREDIT_RATE = 0.25
