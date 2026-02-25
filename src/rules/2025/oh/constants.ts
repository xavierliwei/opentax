/**
 * Ohio IT 1040 constants (Tax Year 2025)
 *
 * NOTE: values are represented in cents.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * Ohio progressive income tax brackets (2025).
 * Each entry: { lower bound (cents), upper bound (cents), rate }.
 * The first bracket is a zero-bracket amount (0% rate).
 */
export const OH_TAX_BRACKETS: { lower: number; upper: number; rate: number }[] = [
  { lower: c(0),       upper: c(26_050),  rate: 0 },
  { lower: c(26_050),  upper: c(100_000), rate: 0.0275 },
  { lower: c(100_000), upper: Infinity,   rate: 0.035 },
]

/**
 * Ohio personal exemption credit per exemption (taxpayer, spouse for MFJ).
 * Phased out based on Ohio AGI.
 */
export const OH_PERSONAL_EXEMPTION_CREDIT = c(2_400)

/** Ohio AGI threshold: full exemption credit available at or below this amount */
export const OH_EXEMPTION_FULL_THRESHOLD = c(40_000)

/** Ohio AGI threshold: exemption fully phased out above this amount */
export const OH_EXEMPTION_PHASEOUT_THRESHOLD = c(80_000)

/**
 * Joint Filing Credit (MFJ only): lesser of this amount or the tax liability.
 */
export const OH_JOINT_FILING_CREDIT = c(650)

/**
 * Number of personal exemptions by filing status.
 * Ohio allows one exemption for single/HOH/MFS/QW and two for MFJ
 * (one for taxpayer, one for spouse).
 */
export const OH_EXEMPTION_COUNT: Record<FilingStatus, number> = {
  single: 1,
  mfs: 1,
  mfj: 2,
  hoh: 1,
  qw: 1,
}
