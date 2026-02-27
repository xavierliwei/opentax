/**
 * Montana Form 2 constants (Tax Year 2025)
 *
 * Sources:
 *   - Montana Department of Revenue Form 2 Instructions
 *   - 15-30-2101 et seq., MCA
 *
 * NOTE: All dollar amounts are in cents.
 *
 * Montana reformed its income tax to a simple 2-bracket system
 * effective 2024. The same brackets apply to ALL filing statuses.
 *
 * Montana uses a percentage-of-AGI standard deduction (20% of AGI)
 * capped at a dollar amount that varies by filing status. Montana
 * does NOT conform to federal standard deduction amounts.
 *
 * SCAFFOLD DISCLOSURE: Bracket thresholds and deduction caps are based on
 * 2024 MT tax law. Official 2025 values should be verified when MT
 * Department of Revenue publishes final Form 2 instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * MT graduated income tax brackets (2 brackets, same for ALL filing statuses).
 *
 * 4.7% on $0 - $20,500
 * 5.9% on $20,500+
 */
export const MT_TAX_BRACKETS: { limit: number; rate: number }[] = [
  { limit: c(20500), rate: 0.047 },
  { limit: Infinity, rate: 0.059 },
]

/**
 * MT standard deduction rate: 20% of Montana AGI.
 */
export const MT_STANDARD_DEDUCTION_RATE = 0.20

/**
 * MT standard deduction cap by filing status.
 *
 * Single: $5,540
 * MFJ:    $11,080
 * MFS:    $5,540
 * HOH:    $5,540
 * QW:     $11,080
 */
export const MT_STANDARD_DEDUCTION_CAP: Record<FilingStatus, number> = {
  single: c(5540),
  mfj:    c(11080),
  mfs:    c(5540),
  hoh:    c(5540),
  qw:     c(11080),
}

/**
 * MT personal exemption: $3,000 per person.
 *
 * Applies to taxpayer, spouse (if MFJ), and each dependent.
 */
export const MT_PERSONAL_EXEMPTION = c(3000)
