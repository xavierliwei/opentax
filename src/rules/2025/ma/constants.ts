import type { FilingStatus } from '../../../model/types'

/** Massachusetts 2025 flat income tax rate */
export const MA_FLAT_TAX_RATE = 0.05

/**
 * Massachusetts personal exemptions (simplified baseline).
 * Using 2024 values until final 2025 release is published.
 */
export const MA_PERSONAL_EXEMPTION: Record<FilingStatus, number> = {
  single: 440000,
  mfj: 880000,
  mfs: 440000,
  hoh: 680000,
  qw: 880000,
}
