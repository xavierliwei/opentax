/**
 * Oregon Form OR-40 constants (Tax Year 2025)
 *
 * Sources:
 *   - Oregon Department of Revenue Form OR-40 Instructions (2024)
 *   - ORS Chapter 316 (Oregon Personal Income Tax)
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: These brackets and deduction amounts are based on
 * 2024 Oregon tax law. Official 2025 values should be verified when
 * OR DOR publishes final OR-40 instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * Oregon progressive income tax brackets (2024 values).
 *
 * Oregon uses a 4-bracket system: 4.75%, 6.75%, 8.75%, 9.9%.
 * Bracket thresholds differ by filing status.
 */
export const OR_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(4050),    rate: 0.0475 },
    { limit: c(10200),   rate: 0.0675 },
    { limit: c(125000),  rate: 0.0875 },
    { limit: Infinity,   rate: 0.099  },
  ],
  mfj: [
    { limit: c(8100),    rate: 0.0475 },
    { limit: c(20400),   rate: 0.0675 },
    { limit: c(250000),  rate: 0.0875 },
    { limit: Infinity,   rate: 0.099  },
  ],
  hoh: [
    { limit: c(6500),    rate: 0.0475 },
    { limit: c(16350),   rate: 0.0675 },
    { limit: c(200000),  rate: 0.0875 },
    { limit: Infinity,   rate: 0.099  },
  ],
  mfs: [
    { limit: c(4050),    rate: 0.0475 },
    { limit: c(10200),   rate: 0.0675 },
    { limit: c(125000),  rate: 0.0875 },
    { limit: Infinity,   rate: 0.099  },
  ],
  qw: [
    { limit: c(8100),    rate: 0.0475 },
    { limit: c(20400),   rate: 0.0675 },
    { limit: c(250000),  rate: 0.0875 },
    { limit: Infinity,   rate: 0.099  },
  ],
}

/**
 * Oregon standard deduction by filing status (2024 values).
 *
 * Oregon has its own standard deduction amounts, much lower than federal.
 */
export const OR_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(2745),
  mfs:    c(2745),
  mfj:    c(5495),
  hoh:    c(4420),
  qw:     c(5495),
}

/**
 * Oregon personal exemption credit (2024 value).
 *
 * $236 per exemption (taxpayer, spouse, dependents).
 * This is a credit, not a deduction, applied against tax liability.
 */
export const OR_PERSONAL_EXEMPTION_CREDIT = c(236)

/**
 * Oregon personal exemption credit phaseout thresholds (2024 values).
 *
 * The credit phases out at higher AGI levels:
 *   - Single/MFS/HOH: $100,000
 *   - MFJ/QW: $200,000
 *
 * The credit reduces by $1 for each $2,500 (or fraction) of AGI
 * over the threshold, but we simplify: fully phase out above these limits.
 */
export const OR_EXEMPTION_PHASEOUT: Record<FilingStatus, number> = {
  single: c(100000),
  mfs:    c(100000),
  mfj:    c(200000),
  hoh:    c(100000),
  qw:     c(200000),
}

/**
 * Oregon Earned Income Credit — percentage of federal EITC.
 *
 * - 12% of federal EITC for filers WITH qualifying children
 * - 9% of federal EITC for filers WITHOUT qualifying children
 */
export const OR_EITC_RATE_WITH_CHILDREN = 0.12
export const OR_EITC_RATE_WITHOUT_CHILDREN = 0.09

/**
 * Oregon Kicker credit — percentage of prior-year tax liability.
 *
 * When state revenue exceeds projections by 2%+, taxpayers receive a
 * "kicker" credit. For 2025 filing (based on 2024 returns), this was
 * approximately 44.28% of 2023 tax liability.
 *
 * Stubbed at 0 for initial implementation since we don't have prior-year
 * OR tax liability data.
 */
export const OR_KICKER_RATE = 0
