/**
 * California 2025 Tax Year Constants (Form 540)
 *
 * All monetary amounts are in integer cents.
 *
 * Primary sources:
 *   FTB 2025 Tax Rate Schedules — https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf
 *   FTB 2025 Form 540 Instructions — https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html
 *   FTB Nonrefundable Renter's Credit — https://www.ftb.ca.gov/file/personal/credits/nonrefundable-renters-credit.html
 */

import type { FilingStatus } from '../../../model/types'
import type { TaxBracket } from '../constants'

// ── Helpers ────────────────────────────────────────────────────

/** Convert dollars to cents for readability in this file. */
function c(dollars: number): number {
  return Math.round(dollars * 100)
}

// ── Standard Deduction ─────────────────────────────────────────
// Source: FTB 2025 Form 540, Line 18 instructions

export const CA_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(5706),
  mfj:    c(11412),
  mfs:    c(5706),
  hoh:    c(11412),
  qw:     c(11412),
}

// ── Tax Brackets (9 brackets: 1% – 12.3%) ─────────────────────
// Source: FTB 2025 Tax Rate Schedules
//   Schedule X: Single / MFS
//   Schedule Y: MFJ / QW
//   Schedule Z: HOH

const SINGLE_BRACKETS: TaxBracket[] = [
  { rate: 0.01,  floor: c(0) },
  { rate: 0.02,  floor: c(11079) },
  { rate: 0.04,  floor: c(26264) },
  { rate: 0.06,  floor: c(41452) },
  { rate: 0.08,  floor: c(57542) },
  { rate: 0.093, floor: c(72724) },
  { rate: 0.103, floor: c(371479) },
  { rate: 0.113, floor: c(445771) },
  { rate: 0.123, floor: c(742953) },
]

const MFJ_BRACKETS: TaxBracket[] = [
  { rate: 0.01,  floor: c(0) },
  { rate: 0.02,  floor: c(22158) },
  { rate: 0.04,  floor: c(52528) },
  { rate: 0.06,  floor: c(82904) },
  { rate: 0.08,  floor: c(115084) },
  { rate: 0.093, floor: c(145448) },
  { rate: 0.103, floor: c(742958) },
  { rate: 0.113, floor: c(891542) },
  { rate: 0.123, floor: c(1485906) },
]

const HOH_BRACKETS: TaxBracket[] = [
  { rate: 0.01,  floor: c(0) },
  { rate: 0.02,  floor: c(22173) },
  { rate: 0.04,  floor: c(52530) },
  { rate: 0.06,  floor: c(67716) },
  { rate: 0.08,  floor: c(83805) },
  { rate: 0.093, floor: c(98990) },
  { rate: 0.103, floor: c(505208) },
  { rate: 0.113, floor: c(606251) },
  { rate: 0.123, floor: c(1010417) },
]

export const CA_TAX_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: SINGLE_BRACKETS,
  mfs:    SINGLE_BRACKETS,
  mfj:    MFJ_BRACKETS,
  qw:     MFJ_BRACKETS,
  hoh:    HOH_BRACKETS,
}

// ── Mental Health Services Tax ─────────────────────────────────
// 1% surcharge on taxable income > $1M (all filing statuses, not doubled for MFJ)
// Source: Revenue & Taxation Code §17043(a)

export const CA_MENTAL_HEALTH_THRESHOLD = c(1000000)
export const CA_MENTAL_HEALTH_RATE = 0.01

// ── Personal Exemption Credits ─────────────────────────────────
// Source: FTB 2025 Form 540 Instructions, Line 32–34
// Unlike federal exemptions (eliminated by TCJA), CA still uses exemption credits.

export const CA_PERSONAL_EXEMPTION_CREDIT = c(153)    // per person (single=1, MFJ=2)
export const CA_DEPENDENT_EXEMPTION_CREDIT = c(475)   // per dependent

// Exemption credit phase-out: for CA AGI above these thresholds,
// credits are reduced. Full phase-out at threshold + 2× credit amount / rate.
// Source: FTB 2025 Form 540, Line 32 worksheet

export const CA_EXEMPTION_PHASEOUT: Record<FilingStatus, number> = {
  single: c(252203),
  mfs:    c(252203),
  mfj:    c(504411),
  qw:     c(504411),
  hoh:    c(378310),
}

// ── Renter's Credit ────────────────────────────────────────────
// Nonrefundable credit for CA renters below AGI limit.
// Source: FTB Nonrefundable Renter's Credit page

export const CA_RENTERS_CREDIT: Record<'single_mfs' | 'other', {
  credit: number; agiLimit: number
}> = {
  single_mfs: { credit: c(60),  agiLimit: c(53994) },
  other:      { credit: c(120), agiLimit: c(107987) },
}

// ── CA Mortgage Interest Limit ─────────────────────────────────
// CA did NOT conform to TCJA $750K limit. CA uses pre-TCJA $1M limit.
// Home equity interest also still deductible (up to $100K).
// Source: R&TC §17220, FTB Schedule CA instructions

export const CA_MORTGAGE_LIMIT: Record<FilingStatus, number> = {
  single: c(1000000),
  mfj:    c(1000000),
  mfs:    c(500000),
  hoh:    c(1000000),
  qw:     c(1000000),
}

export const CA_HOME_EQUITY_LIMIT: Record<FilingStatus, number> = {
  single: c(100000),
  mfj:    c(100000),
  mfs:    c(50000),
  hoh:    c(100000),
  qw:     c(100000),
}
