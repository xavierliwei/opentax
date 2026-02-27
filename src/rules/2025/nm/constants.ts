/**
 * New Mexico Form PIT-1 constants (Tax Year 2025)
 *
 * Sources:
 *   - NM Taxation & Revenue Department PIT-1 Instructions
 *   - HB 252 (2024) restructured NM tax brackets effective 2025
 *
 * NOTE: All dollar amounts are in cents.
 *
 * SCAFFOLD DISCLOSURE: Bracket thresholds are based on the HB 252
 * restructuring. Official 2025 values should be verified when NM TRD
 * publishes final PIT-1 instructions.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/**
 * NM progressive income tax brackets (4 brackets).
 *
 * Single/MFS: 1.7% ($0-$5,500), 3.2% ($5,500-$11,000), 4.7% ($11,000-$16,000), 4.9% ($16,000+)
 * MFJ/QW: 1.7% ($0-$8,000), 3.2% ($8,000-$16,000), 4.7% ($16,000-$24,000), 4.9% ($24,000+)
 * HOH: 1.7% ($0-$6,750), 3.2% ($6,750-$13,500), 4.7% ($13,500-$20,000), 4.9% ($20,000+)
 */
export const NM_TAX_BRACKETS: Record<FilingStatus, { limit: number; rate: number }[]> = {
  single: [
    { limit: c(5500),    rate: 0.017 },
    { limit: c(11000),   rate: 0.032 },
    { limit: c(16000),   rate: 0.047 },
    { limit: Infinity,   rate: 0.049 },
  ],
  mfj: [
    { limit: c(8000),    rate: 0.017 },
    { limit: c(16000),   rate: 0.032 },
    { limit: c(24000),   rate: 0.047 },
    { limit: Infinity,   rate: 0.049 },
  ],
  hoh: [
    { limit: c(6750),    rate: 0.017 },
    { limit: c(13500),   rate: 0.032 },
    { limit: c(20000),   rate: 0.047 },
    { limit: Infinity,   rate: 0.049 },
  ],
  mfs: [
    { limit: c(5500),    rate: 0.017 },
    { limit: c(11000),   rate: 0.032 },
    { limit: c(16000),   rate: 0.047 },
    { limit: Infinity,   rate: 0.049 },
  ],
  qw: [
    { limit: c(8000),    rate: 0.017 },
    { limit: c(16000),   rate: 0.032 },
    { limit: c(24000),   rate: 0.047 },
    { limit: Infinity,   rate: 0.049 },
  ],
}

/**
 * NM standard deduction — conforms to federal.
 */
export const NM_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(15000),
  mfj:    c(30000),
  mfs:    c(15000),
  hoh:    c(22500),
  qw:     c(30000),
}

/**
 * NM personal exemption — $4,150 per person.
 */
export const NM_PERSONAL_EXEMPTION = c(4150)

/**
 * NM Working Families Tax Credit (NM EITC) — 25% of federal EITC.
 * Refundable.
 */
export const NM_EITC_RATE = 0.25
