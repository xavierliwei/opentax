/**
 * North Carolina D-400 constants (Tax Year 2025)
 *
 * NOTE: values are represented in cents.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/** NC flat income tax rate (2025) */
export const NC_FLAT_TAX_RATE = 0.0425

/** NC standard deduction by filing status (2025) */
export const NC_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(12750),
  mfs: c(12750),
  mfj: c(25500),
  hoh: c(19125),
  qw: c(25500),
}
