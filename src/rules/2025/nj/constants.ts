/**
 * NJ 2025 Tax Year Constants
 *
 * All monetary amounts are in integer cents.
 * Source: NJ Division of Taxation, 2025 NJ-1040 instructions
 */

import type { FilingStatus } from '../../../model/types'
import type { TaxBracket } from '../constants'

function c(dollars: number): number {
  return Math.round(dollars * 100)
}

// ── Tax Brackets ──────────────────────────────────────────────

const SINGLE_BRACKETS: TaxBracket[] = [
  { rate: 0.014,   floor: c(0) },
  { rate: 0.0175,  floor: c(20_000) },
  { rate: 0.035,   floor: c(35_000) },
  { rate: 0.05525, floor: c(40_000) },
  { rate: 0.0637,  floor: c(75_000) },
  { rate: 0.0897,  floor: c(500_000) },
  { rate: 0.1075,  floor: c(1_000_000) },
]

const MFJ_BRACKETS: TaxBracket[] = [
  { rate: 0.014,   floor: c(0) },
  { rate: 0.0175,  floor: c(20_000) },
  { rate: 0.0245,  floor: c(50_000) },
  { rate: 0.035,   floor: c(70_000) },
  { rate: 0.05525, floor: c(80_000) },
  { rate: 0.0637,  floor: c(150_000) },
  { rate: 0.0897,  floor: c(500_000) },
  { rate: 0.1075,  floor: c(1_000_000) },
]

// HOH uses the MFJ bracket schedule per NJ instructions
export const NJ_TAX_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: SINGLE_BRACKETS,
  mfs:    SINGLE_BRACKETS,
  mfj:    MFJ_BRACKETS,
  qw:     MFJ_BRACKETS,
  hoh:    MFJ_BRACKETS,
}

// ── Exemptions ────────────────────────────────────────────────

export const NJ_EXEMPTION_REGULAR          = c(1_000)   // per person (self, spouse)
export const NJ_EXEMPTION_AGE_65           = c(1_000)   // additional per person
export const NJ_EXEMPTION_BLIND_DISABLED   = c(1_000)   // additional per person
export const NJ_EXEMPTION_VETERAN          = c(6_000)   // additional per person
export const NJ_EXEMPTION_DEPENDENT_CHILD  = c(1_500)   // per dependent
export const NJ_EXEMPTION_DEPENDENT_OTHER  = c(1_500)   // per dependent
export const NJ_EXEMPTION_COLLEGE_STUDENT  = c(1_000)   // additional per student

// ── Filing Thresholds ─────────────────────────────────────────

export const NJ_FILING_THRESHOLD: Record<FilingStatus, number> = {
  single: c(10_000),
  mfs:    c(10_000),
  mfj:    c(20_000),
  hoh:    c(20_000),
  qw:     c(20_000),
}

// ── Pension / Retirement Exclusion ────────────────────────────

export const NJ_PENSION_EXCLUSION: Record<FilingStatus, number> = {
  single: c(75_000),
  mfs:    c(50_000),
  mfj:    c(100_000),
  hoh:    c(75_000),
  qw:     c(100_000),
}

/** NJ gross income limit for pension exclusion eligibility */
export const NJ_PENSION_EXCLUSION_INCOME_LIMIT: Record<FilingStatus, number> = {
  single: c(100_000),
  mfs:    c(100_000),
  mfj:    c(150_000),
  hoh:    c(100_000),
  qw:     c(150_000),
}

// ── Property Tax ──────────────────────────────────────────────

export const NJ_PROPERTY_TAX_DEDUCTION_MAX = c(15_000)
export const NJ_PROPERTY_TAX_CREDIT        = c(50)      // flat refundable credit
export const NJ_RENT_PROPERTY_TAX_RATIO    = 0.18       // 18% of rent = deemed property tax

// ── Medical Expense ───────────────────────────────────────────

export const NJ_MEDICAL_EXPENSE_FLOOR_RATE = 0.02       // 2% of NJ gross income

// ── Credits ───────────────────────────────────────────────────

export const NJ_EITC_RATE                  = 0.40       // 40% of federal EITC
export const NJ_CHILD_TAX_CREDIT_MAX       = c(1_000)   // per child age ≤ 5
export const NJ_CHILD_TAX_CREDIT_INCOME_CAP = c(80_000) // NJ gross income cap
