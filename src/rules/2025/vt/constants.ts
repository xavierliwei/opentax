/**
 * Vermont Form IN-111 constants (Tax Year 2025)
 *
 * Sources:
 *   - Vermont Department of Taxes Form IN-111 Instructions
 *   - 32 V.S.A. 5822 et seq.
 *
 * NOTE: All dollar amounts are in cents.
 *
 * Vermont starts from federal TAXABLE income (Form 1040 Line 15), NOT
 * federal AGI. There is no state standard deduction or personal exemption
 * because those are already embedded in federal taxable income.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * VT progressive income tax brackets (4 brackets).
 *
 * Single: 3.35% ($0-$45,400), 6.60% ($45,400-$110,050), 7.60% ($110,050-$229,550), 8.75% ($229,550+)
 * MFJ/QW: 3.35% ($0-$75,850), 6.60% ($75,850-$183,400), 7.60% ($183,400-$279,450), 8.75% ($279,450+)
 * MFS: 3.35% ($0-$37,925), 6.60% ($37,925-$91,700), 7.60% ($91,700-$139,725), 8.75% ($139,725+)
 * HOH: 3.35% ($0-$60,650), 6.60% ($60,650-$146,750), 7.60% ($146,750-$254,500), 8.75% ($254,500+)
 */
export const VT_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(45400),    rate: 0.0335 },
    { limit: c(110050),   rate: 0.066 },
    { limit: c(229550),   rate: 0.076 },
    { limit: Infinity,    rate: 0.0875 },
  ],
  mfj: [
    { limit: c(75850),    rate: 0.0335 },
    { limit: c(183400),   rate: 0.066 },
    { limit: c(279450),   rate: 0.076 },
    { limit: Infinity,    rate: 0.0875 },
  ],
  hoh: [
    { limit: c(60650),    rate: 0.0335 },
    { limit: c(146750),   rate: 0.066 },
    { limit: c(254500),   rate: 0.076 },
    { limit: Infinity,    rate: 0.0875 },
  ],
  mfs: [
    { limit: c(37925),    rate: 0.0335 },
    { limit: c(91700),    rate: 0.066 },
    { limit: c(139725),   rate: 0.076 },
    { limit: Infinity,    rate: 0.0875 },
  ],
  qw: [
    { limit: c(75850),    rate: 0.0335 },
    { limit: c(183400),   rate: 0.066 },
    { limit: c(279450),   rate: 0.076 },
    { limit: Infinity,    rate: 0.0875 },
  ],
}

/**
 * VT EITC — 38% of federal EITC (refundable).
 *
 * Vermont's EITC is one of the highest state EITCs in the country.
 */
export const VT_EITC_RATE = 0.38

/**
 * VT Child and Dependent Care Credit — 24% of federal credit.
 *
 * Vermont allows 72% for low income and 24% for others. Simplified to
 * 24% of the federal child and dependent care credit (nonrefundable).
 */
export const VT_DEPENDENT_CARE_CREDIT_RATE = 0.24
