/**
 * Minnesota Form M1 constants (Tax Year 2025)
 *
 * Sources:
 *   - MN Revenue M1 Instructions (2024)
 *   - MN Statutes Chapter 290 (individual income tax)
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: These brackets and deduction amounts are based on
 * 2024 MN tax law. Official 2025 values should be verified when
 * MN DOR publishes final M1 instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * MN progressive income tax brackets (2024 values, projected for 2025).
 *
 * MN uses a 4-bracket system: 5.35%, 6.80%, 7.85%, 9.85%.
 * Bracket thresholds differ by filing status.
 */
export const MN_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(31690),   rate: 0.0535 },
    { limit: c(104090),  rate: 0.0680 },
    { limit: c(193240),  rate: 0.0785 },
    { limit: Infinity,   rate: 0.0985 },
  ],
  mfj: [
    { limit: c(46330),   rate: 0.0535 },
    { limit: c(184040),  rate: 0.0680 },
    { limit: c(321450),  rate: 0.0785 },
    { limit: Infinity,   rate: 0.0985 },
  ],
  hoh: [
    { limit: c(38770),   rate: 0.0535 },
    { limit: c(155000),  rate: 0.0680 },
    { limit: c(256550),  rate: 0.0785 },
    { limit: Infinity,   rate: 0.0985 },
  ],
  mfs: [
    { limit: c(23165),   rate: 0.0535 },
    { limit: c(92020),   rate: 0.0680 },
    { limit: c(160725),  rate: 0.0785 },
    { limit: Infinity,   rate: 0.0985 },
  ],
  qw: [
    { limit: c(46330),   rate: 0.0535 },
    { limit: c(184040),  rate: 0.0680 },
    { limit: c(321450),  rate: 0.0785 },
    { limit: Infinity,   rate: 0.0985 },
  ],
}

/**
 * MN standard deduction by filing status (2024 values).
 *
 * Minnesota follows the federal standard deduction amounts.
 */
export const MN_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(14600),
  mfs:    c(14600),
  mfj:    c(29200),
  hoh:    c(21900),
  qw:     c(29200),
}

/**
 * MN Working Family Credit (state EITC) — percentage of federal EITC.
 *
 * Simplified rate: approximately 25% of federal EITC.
 * The actual MN WFC has its own computation with different phase-out ranges,
 * but for initial implementation we use 25% of federal EITC as specified.
 */
export const MN_WORKING_FAMILY_CREDIT_RATE = 0.25

/**
 * MN Child Tax Credit — $1,750 per qualifying child (2024).
 *
 * One of the largest state-level child tax credits in the nation.
 * Income phase-out applies but is not yet implemented.
 */
export const MN_CHILD_TAX_CREDIT_PER_CHILD = c(1750)

/**
 * Social Security: MN has its own Social Security subtraction
 * that exempts a portion of SS benefits from state tax.
 * For simplicity, we fully exempt SS benefits (MN moved toward
 * full exemption in recent years).
 */
export const MN_SS_FULLY_EXEMPT = true
