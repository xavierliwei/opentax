/**
 * Wisconsin Form 1 constants (Tax Year 2025)
 *
 * Sources:
 *   - WI DOR Form 1 Instructions (2024)
 *   - WI Statutes Chapter 71 (individual income tax)
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: These brackets and deduction amounts are based on
 * 2024 WI tax law. Official 2025 values should be verified when
 * WI DOR publishes final Form 1 instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * WI progressive income tax brackets (2024 values).
 *
 * WI uses a 4-bracket system: 3.50%, 4.40%, 5.30%, 7.65%.
 * Bracket thresholds differ by filing status.
 */
export const WI_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(14320),   rate: 0.0350 },
    { limit: c(28640),   rate: 0.0440 },
    { limit: c(315310),  rate: 0.0530 },
    { limit: Infinity,   rate: 0.0765 },
  ],
  mfj: [
    { limit: c(19090),   rate: 0.0350 },
    { limit: c(38190),   rate: 0.0440 },
    { limit: c(420420),  rate: 0.0530 },
    { limit: Infinity,   rate: 0.0765 },
  ],
  hoh: [
    { limit: c(14320),   rate: 0.0350 },
    { limit: c(28640),   rate: 0.0440 },
    { limit: c(315310),  rate: 0.0530 },
    { limit: Infinity,   rate: 0.0765 },
  ],
  mfs: [
    { limit: c(9545),    rate: 0.0350 },
    { limit: c(19090),   rate: 0.0440 },
    { limit: c(210210),  rate: 0.0530 },
    { limit: Infinity,   rate: 0.0765 },
  ],
  qw: [
    { limit: c(19090),   rate: 0.0350 },
    { limit: c(38190),   rate: 0.0440 },
    { limit: c(420420),  rate: 0.0530 },
    { limit: Infinity,   rate: 0.0765 },
  ],
}

/**
 * WI standard deduction base amounts by filing status (2024).
 *
 * Wisconsin has its own standard deduction amounts that differ from federal.
 * These amounts phase out at higher income levels.
 */
export const WI_STANDARD_DEDUCTION_BASE: Record<FilingStatus, number> = {
  single: c(12760),
  mfj:    c(23620),
  hoh:    c(16990),
  mfs:    c(11330),
  qw:     c(23620),
}

/**
 * WI standard deduction phase-out parameters.
 *
 * The deduction is reduced for higher-income taxpayers.
 * Phase-out starts at 'start' and the deduction is fully eliminated at 'end'.
 * Between start and end, the deduction is reduced proportionally:
 *   reduction = base * (income - start) / (end - start)
 *   deduction = max(0, base - reduction)
 */
export const WI_STANDARD_DEDUCTION_PHASEOUT: Record<FilingStatus, { start: number; end: number }> = {
  single: { start: c(18660), end: c(109560) },
  mfj:    { start: c(25120), end: c(117370) },
  hoh:    { start: c(18660), end: c(109560) },
  mfs:    { start: c(12560), end: c(58685) },
  qw:     { start: c(25120), end: c(117370) },
}

/**
 * WI personal exemption amount per person.
 *
 * $700 per exemption (taxpayer, spouse if MFJ, each dependent).
 * Also phases out at higher income (not yet implemented in initial version).
 */
export const WI_PERSONAL_EXEMPTION = c(700)

/**
 * WI Earned Income Credit — percentage of federal EITC by number of children.
 *
 * 1 child  → 4%  of federal EITC
 * 2 children → 11% of federal EITC
 * 3+ children → 34% of federal EITC
 * 0 children → 0% (WI EITC requires at least 1 qualifying child)
 */
export const WI_EITC_RATES: Record<number, number> = {
  0: 0.00,
  1: 0.04,
  2: 0.11,
  3: 0.34,
}

/**
 * Social Security: WI fully exempts Social Security benefits from state tax
 * for Wisconsin residents.
 */
export const WI_SS_FULLY_EXEMPT = true

/**
 * WI 529 plan contribution subtraction limit per beneficiary (2024).
 * $3,860 per beneficiary.
 */
export const WI_529_SUBTRACTION_PER_BENEFICIARY = c(3860)

/**
 * WI itemized deduction credit rate.
 * Taxpayers who itemize can claim a credit of 5% of their WI itemized deductions.
 */
export const WI_ITEMIZED_DEDUCTION_CREDIT_RATE = 0.05
