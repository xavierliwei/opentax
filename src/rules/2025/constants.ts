/**
 * 2025 Tax Year Constants
 *
 * Single source of truth for all tax year 2025 numbers (returns filed in 2026).
 * All monetary amounts are in integer cents.
 *
 * Primary source: IRS Revenue Procedure 2024-40
 * https://www.irs.gov/pub/irs-drop/rp-24-40.pdf
 *
 * Bracket source: https://www.irs.gov/filing/federal-income-tax-rates-and-brackets
 */

import type { FilingStatus } from '../../model/types'

// ── Helpers ────────────────────────────────────────────────────

/** Convert dollars to cents for readability in this file. */
function c(dollars: number): number {
  return Math.round(dollars * 100)
}

// ── Standard Deduction ─────────────────────────────────────────
// Source: Rev. Proc. 2024-40, §3.01

export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(15000),
  mfj:    c(30000),
  mfs:    c(15000),
  hoh:    c(22500),
  qw:     c(30000),
}

// ── Ordinary Income Tax Brackets ───────────────────────────────
// Source: IRS.gov "Federal income tax rates and brackets" (2025)
// Rev. Proc. 2024-40, §3.01
//
// Each bracket is { rate, floor (cents) }.
// The ceiling of each bracket is the floor of the next bracket.
// Tax = sum of (rate × (min(income, nextFloor) - floor)) for applicable brackets.

export interface TaxBracket {
  rate: number   // decimal, e.g., 0.10 for 10%
  floor: number  // cents — income above this amount is taxed at this rate
}

export const INCOME_TAX_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { rate: 0.10, floor: c(0) },
    { rate: 0.12, floor: c(11925) },
    { rate: 0.22, floor: c(48475) },
    { rate: 0.24, floor: c(103350) },
    { rate: 0.32, floor: c(197300) },
    { rate: 0.35, floor: c(250525) },
    { rate: 0.37, floor: c(626350) },
  ],
  mfj: [
    { rate: 0.10, floor: c(0) },
    { rate: 0.12, floor: c(23850) },
    { rate: 0.22, floor: c(96950) },
    { rate: 0.24, floor: c(206700) },
    { rate: 0.32, floor: c(394600) },
    { rate: 0.35, floor: c(501050) },
    { rate: 0.37, floor: c(751600) },
  ],
  mfs: [
    { rate: 0.10, floor: c(0) },
    { rate: 0.12, floor: c(11925) },
    { rate: 0.22, floor: c(48475) },
    { rate: 0.24, floor: c(103350) },
    { rate: 0.32, floor: c(197300) },
    { rate: 0.35, floor: c(250525) },
    { rate: 0.37, floor: c(375800) },
  ],
  hoh: [
    { rate: 0.10, floor: c(0) },
    { rate: 0.12, floor: c(17000) },
    { rate: 0.22, floor: c(64850) },
    { rate: 0.24, floor: c(103350) },
    { rate: 0.32, floor: c(197300) },
    { rate: 0.35, floor: c(250500) },
    { rate: 0.37, floor: c(626350) },
  ],
  qw: [
    // Qualifying surviving spouse uses MFJ brackets
    { rate: 0.10, floor: c(0) },
    { rate: 0.12, floor: c(23850) },
    { rate: 0.22, floor: c(96950) },
    { rate: 0.24, floor: c(206700) },
    { rate: 0.32, floor: c(394600) },
    { rate: 0.35, floor: c(501050) },
    { rate: 0.37, floor: c(751600) },
  ],
}

// ── Long-Term Capital Gains Rate Thresholds ────────────────────
// Source: Rev. Proc. 2024-40, §3.03
//
// Same structure as income brackets: { rate, floor }.
// Applies to net long-term capital gains and qualified dividends.

export const LTCG_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { rate: 0.00, floor: c(0) },
    { rate: 0.15, floor: c(48350) },
    { rate: 0.20, floor: c(533400) },
  ],
  mfj: [
    { rate: 0.00, floor: c(0) },
    { rate: 0.15, floor: c(96700) },
    { rate: 0.20, floor: c(600050) },
  ],
  mfs: [
    // Half of MFJ thresholds
    { rate: 0.00, floor: c(0) },
    { rate: 0.15, floor: c(48350) },
    { rate: 0.20, floor: c(300025) },
  ],
  hoh: [
    { rate: 0.00, floor: c(0) },
    { rate: 0.15, floor: c(64750) },
    { rate: 0.20, floor: c(566700) },
  ],
  qw: [
    // Same as MFJ
    { rate: 0.00, floor: c(0) },
    { rate: 0.15, floor: c(96700) },
    { rate: 0.20, floor: c(600050) },
  ],
}

// ── Net Investment Income Tax (NIIT) ───────────────────────────
// Source: IRC §1411

export const NIIT_RATE = 0.038  // 3.8%
export const NIIT_THRESHOLD: Record<FilingStatus, number> = {
  single: c(200000),
  mfj:    c(250000),
  mfs:    c(125000),
  hoh:    c(200000),
  qw:     c(250000),
}

// ── Social Security ────────────────────────────────────────────
// Source: SSA announcement, October 2024

export const SS_WAGE_BASE = c(176100)        // Maximum earnings subject to SS tax
export const SS_TAX_RATE = 0.062             // 6.2% employee share
export const MEDICARE_TAX_RATE = 0.0145      // 1.45%
export const ADDITIONAL_MEDICARE_RATE = 0.009 // 0.9% on wages above threshold
export const ADDITIONAL_MEDICARE_THRESHOLD: Record<FilingStatus, number> = {
  single: c(200000),
  mfj:    c(250000),
  mfs:    c(125000),
  hoh:    c(200000),
  qw:     c(250000),
}

// ── Schedule B Threshold ───────────────────────────────────────
// Source: 2025 Schedule B instructions

export const SCHEDULE_B_THRESHOLD = c(1500)  // File Schedule B if interest or dividends exceed this

// ── Schedule A — Itemized Deduction Limits ───────────────────
// Source: IRC §213(a) (medical)
// Source: IRC §164(b)(6) as amended by One Big Beautiful Bill Act §70120
//   (signed 2025-07-04, effective tax years beginning after 2024)

export const MEDICAL_AGI_FLOOR_RATE = 0.075  // 7.5% of AGI

// SALT cap — One Big Beautiful Bill Act raised from $10K to $40K for 2025–2029,
// with a 30% phase-out above MAGI threshold, floored at old $10K/$5K.
export const SALT_BASE_CAP: Record<FilingStatus, number> = {
  single: c(40000),
  mfj:    c(40000),
  mfs:    c(20000),
  hoh:    c(40000),
  qw:     c(40000),
}

export const SALT_PHASEOUT_THRESHOLD: Record<FilingStatus, number> = {
  single: c(500000),
  mfj:    c(500000),
  mfs:    c(250000),
  hoh:    c(500000),
  qw:     c(500000),
}

export const SALT_PHASEOUT_RATE = 0.30  // 30% of MAGI exceeding threshold

export const SALT_FLOOR: Record<FilingStatus, number> = {
  single: c(10000),
  mfj:    c(10000),
  mfs:    c(5000),
  hoh:    c(10000),
  qw:     c(10000),
}

// ── Home Mortgage Interest Limit — IRC §163(h)(3) ──────────────
// Loans originating after Dec 15, 2017 (post-TCJA): $750K limit ($375K MFS)
// Grandfathered loans from Dec 15, 2017 or earlier: $1M limit ($500K MFS)

export const MORTGAGE_LIMIT_POST_TCJA: Record<FilingStatus, number> = {
  single: c(750_000),
  mfj:    c(750_000),
  mfs:    c(375_000),
  hoh:    c(750_000),
  qw:     c(750_000),
}

export const MORTGAGE_LIMIT_PRE_TCJA: Record<FilingStatus, number> = {
  single: c(1_000_000),
  mfj:    c(1_000_000),
  mfs:    c(500_000),
  hoh:    c(1_000_000),
  qw:     c(1_000_000),
}

// ── Charitable Contribution AGI Limits — IRC §170(b) ───────────

export const CHARITABLE_CASH_AGI_LIMIT    = 0.60  // 60% of AGI (cash to 50% orgs)
export const CHARITABLE_NONCASH_AGI_LIMIT = 0.30  // 30% of AGI (capital gain property)

// ── Capital Loss Deduction Limit ───────────────────────────────
// Source: IRC §1211(b)

export const CAPITAL_LOSS_LIMIT: Record<FilingStatus, number> = {
  single: c(3000),
  mfj:    c(3000),
  mfs:    c(1500),
  hoh:    c(3000),
  qw:     c(3000),
}

// ── Tax Year ───────────────────────────────────────────────────

export const TAX_YEAR = 2025
