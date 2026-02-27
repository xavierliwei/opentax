/**
 * Nebraska Form 1040N constants (Tax Year 2025)
 *
 * Sources:
 *   - Nebraska Department of Revenue Form 1040N Instructions
 *   - Neb. Rev. Stat. 77-2715 et seq.
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: Bracket thresholds and deduction amounts are based on
 * 2024 NE tax law. Official 2025 values should be verified when NE DOR
 * publishes final 1040N instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * NE progressive income tax brackets (3 brackets after 2024 reform).
 *
 * Single: 2.46% ($0–$3,700), 3.51% ($3,700–$22,170), 5.84% ($22,170+)
 * MFJ/QW: 2.46% ($0–$7,390), 3.51% ($7,390–$44,350), 5.84% ($44,350+)
 * MFS: 2.46% ($0–$3,700), 3.51% ($3,700–$22,170), 5.84% ($22,170+)
 * HOH: 2.46% ($0–$5,550), 3.51% ($5,550–$28,600), 5.84% ($28,600+)
 */
export const NE_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(3700),    rate: 0.0246 },
    { limit: c(22170),   rate: 0.0351 },
    { limit: Infinity,   rate: 0.0584 },
  ],
  mfj: [
    { limit: c(7390),    rate: 0.0246 },
    { limit: c(44350),   rate: 0.0351 },
    { limit: Infinity,   rate: 0.0584 },
  ],
  hoh: [
    { limit: c(5550),    rate: 0.0246 },
    { limit: c(28600),   rate: 0.0351 },
    { limit: Infinity,   rate: 0.0584 },
  ],
  mfs: [
    { limit: c(3700),    rate: 0.0246 },
    { limit: c(22170),   rate: 0.0351 },
    { limit: Infinity,   rate: 0.0584 },
  ],
  qw: [
    { limit: c(7390),    rate: 0.0246 },
    { limit: c(44350),   rate: 0.0351 },
    { limit: Infinity,   rate: 0.0584 },
  ],
}

/**
 * NE standard deduction — Nebraska follows federal standard deduction amounts.
 * The state uses the same standard deduction as the federal return.
 */
export const NE_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(15000),
  mfj:    c(30000),
  mfs:    c(15000),
  hoh:    c(22500),
  qw:     c(30000),
}

/**
 * NE personal exemption credit — $157 per exemption.
 *
 * Applies to taxpayer, spouse (if MFJ), and each dependent.
 */
export const NE_PERSONAL_EXEMPTION_CREDIT = c(157)

/**
 * NE Social Security exemption — NE fully exempts Social Security from
 * state income tax for all filers (effective 2025).
 */
export const NE_SS_FULL_EXEMPTION = true

/**
 * NE Child/Dependent Care Credit — 25% of federal credit.
 */
export const NE_DEPENDENT_CARE_CREDIT_RATE = 0.25

/**
 * NE EITC — 10% of federal EITC (refundable).
 */
export const NE_EITC_RATE = 0.10
