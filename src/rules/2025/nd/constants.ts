/**
 * North Dakota Form ND-1 constants (Tax Year 2025)
 *
 * Sources:
 *   - ND Tax Department Form ND-1 Instructions
 *   - ND Century Code 57-38-30.3 (2025 reform)
 *
 * NOTE: All dollar amounts are in cents.
 *
 * ND starts from federal TAXABLE income (Form 1040 Line 15), NOT AGI.
 * There is no state standard deduction or personal exemption since those
 * are already embedded in federal taxable income.
 *
 * Post-2025 reform: simplified to 2 brackets with the lowest rates
 * of any graduated-tax state.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * ND progressive income tax brackets (2 brackets).
 *
 * Same brackets for ALL filing statuses:
 *   1.95% on $0–$51,650
 *   2.50% on $51,650+
 */
const ND_BRACKETS: { limit: number; rate: number }[] = [
  { limit: c(51650),   rate: 0.0195 },
  { limit: Infinity,   rate: 0.025 },
]

export const ND_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: ND_BRACKETS,
  mfj:    ND_BRACKETS,
  mfs:    ND_BRACKETS,
  hoh:    ND_BRACKETS,
  qw:     ND_BRACKETS,
}
