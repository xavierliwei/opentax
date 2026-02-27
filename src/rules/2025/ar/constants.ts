/**
 * Arkansas Form AR1000F constants (Tax Year 2025)
 *
 * Sources:
 *   - Arkansas Department of Finance and Administration AR1000F Instructions
 *   - Ark. Code Ann. 26-51-201 et seq.
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: Bracket thresholds and deduction amounts are based on
 * 2024 AR tax law (post-reform). Official 2025 values should be verified
 * when AR DFA publishes final AR1000F instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * AR progressive income tax brackets (3 brackets after recent reform).
 *
 * Arkansas uses the same brackets for all filing statuses (no married
 * joint vs single distinction in the rate schedule).
 *
 * 2% ($0–$4,400), 4% ($4,400–$8,800), 4.4% ($8,800+)
 *
 * Note: Arkansas recently consolidated from 6 to 3 brackets as part of
 * tax reform. The top rate has been reduced to 4.4% effective 2025.
 */
export const AR_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(4400),    rate: 0.02 },
    { limit: c(8800),    rate: 0.04 },
    { limit: Infinity,   rate: 0.044 },
  ],
  mfj: [
    { limit: c(4400),    rate: 0.02 },
    { limit: c(8800),    rate: 0.04 },
    { limit: Infinity,   rate: 0.044 },
  ],
  hoh: [
    { limit: c(4400),    rate: 0.02 },
    { limit: c(8800),    rate: 0.04 },
    { limit: Infinity,   rate: 0.044 },
  ],
  mfs: [
    { limit: c(4400),    rate: 0.02 },
    { limit: c(8800),    rate: 0.04 },
    { limit: Infinity,   rate: 0.044 },
  ],
  qw: [
    { limit: c(4400),    rate: 0.02 },
    { limit: c(8800),    rate: 0.04 },
    { limit: Infinity,   rate: 0.044 },
  ],
}

/**
 * AR standard deduction — $2,340 for all filing statuses.
 *
 * Arkansas uses a flat standard deduction amount regardless of filing status.
 */
export const AR_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(2340),
  mfj:    c(4680),
  mfs:    c(2340),
  hoh:    c(2340),
  qw:     c(4680),
}

/**
 * AR personal tax credit — $29 per exemption.
 *
 * Applies to taxpayer, spouse (if MFJ), and each dependent.
 */
export const AR_PERSONAL_TAX_CREDIT = c(29)

/**
 * AR low-income tax credit table.
 *
 * Single filers with AR net income <= $23,600 get a credit on a sliding scale.
 * MFJ filers with AR net income <= $23,600 also qualify.
 * For simplicity, we approximate: full credit = AR_TAX when income <= threshold.
 */
export const AR_LOW_INCOME_THRESHOLD: Record<FilingStatus, number> = {
  single: c(23600),
  mfj:    c(23600),
  mfs:    c(23600),
  hoh:    c(23600),
  qw:     c(23600),
}

/**
 * AR EITC — 20% of federal EITC (nonrefundable).
 */
export const AR_EITC_RATE = 0.20
