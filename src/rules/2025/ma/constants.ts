/**
 * Massachusetts 2025 Tax Year Constants (Form 1)
 *
 * All monetary amounts are in integer cents.
 *
 * Primary sources:
 *   MA DOR 2025 Form 1 Instructions — https://www.mass.gov/doc/2025-form-1-instructions
 *   MA DOR Tax Rates — https://www.mass.gov/info-details/massachusetts-tax-rates
 *   MA Fair Share Amendment (Article XLIV) — 4% surtax on income > $1M
 */

import type { FilingStatus } from '../../../model/types'

// ── Helpers ────────────────────────────────────────────────────

/** Convert dollars to cents for readability in this file. */
function c(dollars: number): number {
  return Math.round(dollars * 100)
}

// ── Income Tax Rate ─────────────────────────────────────────────
// MA uses a flat 5.00% rate on all taxable income (Part A, B, and C
// rates unified at 5.0% since 2012).
// Source: MGL ch. 62, §4

export const MA_TAX_RATE = 0.05

// ── Millionaire's Surtax (Fair Share Amendment) ─────────────────
// Additional 4% surtax on taxable income over $1,000,000.
// Threshold indexed to CPI starting 2024; $1,000,000 for 2025.
// Source: MA Constitution Article XLIV (approved Nov 2022)

export const MA_SURTAX_THRESHOLD = c(1000000)
export const MA_SURTAX_RATE = 0.04

// ── Personal Exemptions ─────────────────────────────────────────
// MA does not use a standard deduction. Instead, it provides
// personal exemptions that reduce taxable income.
// Source: MGL ch. 62, §3(B)(b); 2025 Form 1 instructions

export const MA_PERSONAL_EXEMPTION: Record<FilingStatus, number> = {
  single: c(4400),
  mfj:    c(8800),
  mfs:    c(4400),
  hoh:    c(6800),
  qw:     c(4400),
}

// ── Dependent Exemption ─────────────────────────────────────────
// $1,000 per dependent (no phase-out)
// Source: MGL ch. 62, §3(B)(b)(3)

export const MA_DEPENDENT_EXEMPTION = c(1000)

// ── Blind Exemption ─────────────────────────────────────────────
// $2,200 additional exemption per legally blind person
// Source: MGL ch. 62, §3(B)(b)(2)

export const MA_BLIND_EXEMPTION = c(2200)

// ── Age 65+ Exemption ───────────────────────────────────────────
// $700 additional exemption per person age 65 or older
// Source: MGL ch. 62, §3(B)(b)(2)

export const MA_AGE65_EXEMPTION = c(700)

// ── Medical/Dental Deduction ────────────────────────────────────
// MA allows deduction for medical/dental expenses exceeding 7.5%
// of MA AGI (same floor as federal).
// Source: MGL ch. 62, §3(B)(a)(8)

export const MA_MEDICAL_FLOOR_RATE = 0.075

// ── Rent Deduction ──────────────────────────────────────────────
// 50% of rent paid for principal residence in MA, capped at $4,000
// ($2,000 for MFS).
// Source: MGL ch. 62, §3(B)(a)(9); 2025 Form 1, Line 14

export const MA_RENT_DEDUCTION_RATE = 0.50

export const MA_RENT_DEDUCTION_CAP: Record<FilingStatus, number> = {
  single: c(4000),
  mfj:    c(4000),
  mfs:    c(2000),
  hoh:    c(4000),
  qw:     c(4000),
}
