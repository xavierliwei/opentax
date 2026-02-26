/**
 * Michigan MI-1040 constants (Tax Year 2025)
 *
 * NOTE: monetary values are represented in cents.
 *
 * Sources:
 * - 2024 MI-1040 instructions
 * - MCL 206.30 (flat rate)
 * - MCL 206.30(1) (personal exemption)
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/** Michigan flat income tax rate (4.25%) */
export const MI_FLAT_TAX_RATE = 0.0425

/**
 * Michigan personal exemption amount per person (2024 value; used for TY 2025).
 * Applies to taxpayer, spouse, and each dependent.
 */
export const MI_PERSONAL_EXEMPTION = c(5600)

/**
 * Michigan special personal exemptions:
 * - Age 67+
 * - Blind
 * - Disabled veteran (100% disabled)
 * - Deaf
 * Each qualifies for an additional exemption of $3,200.
 */
export const MI_SPECIAL_EXEMPTION = c(3200)

/**
 * Michigan EITC = 30% of federal EITC (MCL 206.272)
 * Increased from 6% to 30% beginning TY 2023.
 */
export const MI_EITC_RATE = 0.30

/**
 * Retirement/pension income subtraction limits by birth year tier.
 * Michigan has a three-tier system based on the taxpayer's date of birth.
 *
 * Tier 1: Born before 1946 — generous subtraction
 * Tier 2: Born 1946–1952 — moderate subtraction (after reaching age 67)
 * Tier 3: Born after 1952 — no special subtraction (standard exemption only)
 *
 * For TY 2024, Tier 1 limits (born before 1946):
 */
export const MI_RETIREMENT_SUBTRACTION_TIER1: Record<FilingStatus, number> = {
  single: c(56961),
  mfs: c(56961),
  mfj: c(113922),
  hoh: c(56961),
  qw: c(113922),
}

/**
 * Tier 2 subtraction limit (born 1946–1952, age 67+ only):
 * Reduced by the amount of the personal exemption already claimed.
 * Effective limit = standard deduction equivalent for that tier.
 */
export const MI_RETIREMENT_SUBTRACTION_TIER2: Record<FilingStatus, number> = {
  single: c(20000),
  mfs: c(20000),
  mfj: c(40000),
  hoh: c(20000),
  qw: c(40000),
}
