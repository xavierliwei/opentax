/**
 * Maryland 2025 Tax Year Constants (Form 502)
 *
 * All monetary amounts are in integer cents.
 *
 * Primary sources:
 *   Maryland Tax Rate Schedules — https://www.marylandtaxes.gov/individual/income/tax-info/tax-rates.php
 *   Maryland Form 502 Instructions — https://www.marylandtaxes.gov/forms/current_forms/
 *   Maryland Local Tax Rates — https://www.marylandtaxes.gov/individual/income/tax-info/local-tax-rates.php
 *
 * 2025 changes (Budget Reconciliation and Financing Act / HB350):
 *   - Standard deduction changed to flat amount ($3,350 / $6,700)
 *   - Two new top brackets: 6.25% and 6.50%
 *   - Maximum county tax rate increased from 3.20% to 3.30%
 */

import type { FilingStatus } from '../../../model/types'
import type { TaxBracket } from '../constants'

// ── Helpers ────────────────────────────────────────────────────

/** Convert dollars to cents for readability in this file. */
function c(dollars: number): number {
  return Math.round(dollars * 100)
}

// ── Standard Deduction ─────────────────────────────────────────
// 2025: Flat amounts (changed from previous variable 15%-of-AGI formula)
// Source: HB350 / Maryland Form 502 Instructions 2025

export const MD_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(3350),
  mfj:    c(6700),
  mfs:    c(3350),
  hoh:    c(3350),
  qw:     c(6700),
}

// ── Tax Brackets (10 brackets: 2% – 6.50%) ────────────────────
// Source: Maryland Tax Rate Schedules 2025
//   Single/MFS: same schedule
//   MFJ/QW/HOH: same schedule (wider upper brackets)
// 2025 adds two new top brackets: 6.25% and 6.50%

const SINGLE_BRACKETS: TaxBracket[] = [
  { rate: 0.02,   floor: c(0) },
  { rate: 0.03,   floor: c(1000) },
  { rate: 0.04,   floor: c(2000) },
  { rate: 0.0475, floor: c(3000) },
  { rate: 0.05,   floor: c(100000) },
  { rate: 0.0525, floor: c(125000) },
  { rate: 0.055,  floor: c(150000) },
  { rate: 0.0575, floor: c(250000) },
  { rate: 0.0625, floor: c(500000) },
  { rate: 0.065,  floor: c(1000000) },
]

const MFJ_BRACKETS: TaxBracket[] = [
  { rate: 0.02,   floor: c(0) },
  { rate: 0.03,   floor: c(1000) },
  { rate: 0.04,   floor: c(2000) },
  { rate: 0.0475, floor: c(3000) },
  { rate: 0.05,   floor: c(150000) },
  { rate: 0.0525, floor: c(175000) },
  { rate: 0.055,  floor: c(225000) },
  { rate: 0.0575, floor: c(300000) },
  { rate: 0.0625, floor: c(600000) },
  { rate: 0.065,  floor: c(1200000) },
]

export const MD_TAX_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: SINGLE_BRACKETS,
  mfs:    SINGLE_BRACKETS,
  mfj:    MFJ_BRACKETS,
  hoh:    MFJ_BRACKETS,
  qw:     MFJ_BRACKETS,
}

// ── Personal Exemptions ────────────────────────────────────────
// $3,200 per person with AGI-based stepped phase-down.
// Source: Maryland Form 502 Instructions 2025

export const MD_PERSONAL_EXEMPTION = c(3200)
export const MD_DEPENDENT_EXEMPTION = c(3200)

// Stepped phase-down: Full ($3,200) → Half ($1,600) → Quarter ($800) → None ($0)
export interface ExemptionThreshold {
  full: number     // AGI ≤ this: full exemption
  half: number     // AGI ≤ this: half exemption
  quarter: number  // AGI ≤ this: quarter exemption; above = $0
}

export const MD_EXEMPTION_THRESHOLDS: Record<FilingStatus, ExemptionThreshold> = {
  single:  { full: c(100000), half: c(125000), quarter: c(150000) },
  mfs:     { full: c(100000), half: c(125000), quarter: c(150000) },
  mfj:     { full: c(150000), half: c(175000), quarter: c(200000) },
  qw:      { full: c(150000), half: c(175000), quarter: c(200000) },
  hoh:     { full: c(125000), half: c(150000), quarter: c(175000) },
}

// ── County / City Local Income Tax Rates ───────────────────────
// Source: Maryland Comptroller — Local Tax Rates, Tax Year 2025
// Maximum rate increased from 3.20% to 3.30% effective 2025.

export interface CountyInfo {
  name: string
  rate: number  // decimal, e.g. 0.0320 for 3.20%
}

export const MD_COUNTIES: Record<string, CountyInfo> = {
  allegany:        { name: 'Allegany County',         rate: 0.0305 },
  anneArundel:     { name: 'Anne Arundel County',     rate: 0.0281 },
  baltimoreCity:   { name: 'Baltimore City',           rate: 0.0320 },
  baltimoreCounty: { name: 'Baltimore County',         rate: 0.0320 },
  calvert:         { name: 'Calvert County',           rate: 0.0300 },
  caroline:        { name: 'Caroline County',           rate: 0.0320 },
  carroll:         { name: 'Carroll County',            rate: 0.0305 },
  cecil:           { name: 'Cecil County',              rate: 0.0300 },
  charles:         { name: 'Charles County',            rate: 0.0310 },
  dorchester:      { name: 'Dorchester County',         rate: 0.0320 },
  frederick:       { name: 'Frederick County',          rate: 0.0304 },
  garrett:         { name: 'Garrett County',            rate: 0.0265 },
  harford:         { name: 'Harford County',            rate: 0.0306 },
  howard:          { name: 'Howard County',             rate: 0.0320 },
  kent:            { name: 'Kent County',               rate: 0.0320 },
  montgomery:      { name: 'Montgomery County',         rate: 0.0320 },
  princeGeorges:   { name: "Prince George's County",   rate: 0.0320 },
  queenAnnes:      { name: "Queen Anne's County",      rate: 0.0320 },
  somerset:        { name: 'Somerset County',           rate: 0.0315 },
  stMarys:         { name: "St. Mary's County",        rate: 0.0310 },
  talbot:          { name: 'Talbot County',             rate: 0.0240 },
  washington:      { name: 'Washington County',         rate: 0.0320 },
  wicomico:        { name: 'Wicomico County',           rate: 0.0320 },
  worcester:       { name: 'Worcester County',          rate: 0.0225 },
}

export const MD_DEFAULT_COUNTY = 'montgomery'

// ── Earned Income Credit (EIC) ─────────────────────────────────
// Maryland EIC is a percentage of the federal EIC.
// Source: Maryland Form 502 Instructions, Line 43

export const MD_EIC_RATE_WITH_CHILDREN = 0.45    // 45% of federal EIC
export const MD_EIC_RATE_WITHOUT_CHILDREN = 1.00  // 100% of federal EIC
