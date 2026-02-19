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

// ── Child Tax Credit ─────────────────────────────────────────
// Source: IRC §24, as modified by Tax Cuts and Jobs Act (2017)
// One Big Beautiful Bill Act extended CTC provisions through 2028

export const CTC_PER_QUALIFYING_CHILD    = c(2000)   // $2,000 per child under 17
export const CTC_PER_OTHER_DEPENDENT     = c(500)    // $500 per other dependent
export const CTC_REFUNDABLE_MAX_PER_CHILD = c(1700)  // Max refundable per child (Form 8812)
export const CTC_EARNED_INCOME_THRESHOLD = c(2500)   // Earned income floor for refundable calc
export const CTC_REFUNDABLE_RATE         = 0.15      // 15% of earned income above threshold

export const CTC_PHASEOUT_THRESHOLD: Record<FilingStatus, number> = {
  single: c(200000),
  mfj:    c(400000),
  mfs:    c(200000),
  hoh:    c(200000),
  qw:     c(400000),
}

export const CTC_PHASEOUT_RATE_PER_1000 = c(50)      // $50 per $1K of AGI over threshold

// ── Earned Income Credit ──────────────────────────────────────
// Source: IRS Rev. Proc. 2024-40, §3.07
// Piecewise linear schedule indexed by number of qualifying children (0–3+)

export interface EICSchedule {
  phaseInRate: number
  phaseOutRate: number
  earnedIncomeAmount: number   // cents — phase-in end (plateau begins)
  maxCredit: number            // cents
  phaseOutStartSingle: number  // cents — Single/HOH/QW
  phaseOutStartMFJ: number     // cents — MFJ
}

export const EIC_SCHEDULES: EICSchedule[] = [
  // 0 qualifying children
  { phaseInRate: 0.0765, phaseOutRate: 0.0765, earnedIncomeAmount: c(8490),  maxCredit: c(649),  phaseOutStartSingle: c(10620), phaseOutStartMFJ: c(17730) },
  // 1 qualifying child
  { phaseInRate: 0.34,   phaseOutRate: 0.1598, earnedIncomeAmount: c(12730), maxCredit: c(4328), phaseOutStartSingle: c(23350), phaseOutStartMFJ: c(30470) },
  // 2 qualifying children
  { phaseInRate: 0.40,   phaseOutRate: 0.2106, earnedIncomeAmount: c(17880), maxCredit: c(7152), phaseOutStartSingle: c(23350), phaseOutStartMFJ: c(30470) },
  // 3+ qualifying children
  { phaseInRate: 0.45,   phaseOutRate: 0.2106, earnedIncomeAmount: c(17880), maxCredit: c(8046), phaseOutStartSingle: c(23350), phaseOutStartMFJ: c(30470) },
]

export const EIC_INVESTMENT_INCOME_LIMIT = c(11950)
export const EIC_MIN_AGE_NO_CHILDREN = 25
export const EIC_MAX_AGE_NO_CHILDREN = 64

// ── Dependent Care Credit (Form 2441) ──────────────────────────
// Source: IRC §21

export const DEPENDENT_CARE_MAX_ONE = c(3000)    // 1 qualifying person
export const DEPENDENT_CARE_MAX_TWO = c(6000)    // 2+ qualifying persons
export const DEPENDENT_CARE_BASE_RATE = 0.35     // 35% starting rate
export const DEPENDENT_CARE_MIN_RATE = 0.20      // 20% floor
export const DEPENDENT_CARE_AGI_STEP = c(2000)   // rate drops 1% per $2K
export const DEPENDENT_CARE_AGI_FLOOR = c(15000) // rate starts declining above this

// ── Saver's Credit (Form 8880) ──────────────────────────────────
// Source: Rev. Proc. 2024-40 §3.10

export interface SaversCreditThreshold {
  rate50: number  // cents — AGI up to this → 50% rate
  rate20: number  // cents — AGI up to this → 20% rate
  rate10: number  // cents — AGI up to this → 10% rate; above → 0%
}

export const SAVERS_CREDIT_THRESHOLDS: Record<FilingStatus, SaversCreditThreshold> = {
  single: { rate50: c(23750),  rate20: c(25500),  rate10: c(39000) },
  mfs:    { rate50: c(23750),  rate20: c(25500),  rate10: c(39000) },
  hoh:    { rate50: c(35625),  rate20: c(38250),  rate10: c(58500) },
  mfj:    { rate50: c(47500),  rate20: c(51000),  rate10: c(78000) },
  qw:     { rate50: c(47500),  rate20: c(51000),  rate10: c(78000) },
}

export const SAVERS_CREDIT_MAX_CONTRIBUTION = c(2000)  // per person

// ── Education Credits (Form 8863, IRC §25A) ───────────────────
export const AOTC_FIRST_TIER = c(2000)          // 100% of first $2,000
export const AOTC_SECOND_TIER = c(2000)          // 25% of next $2,000
export const AOTC_MAX_CREDIT = c(2500)           // per student
export const AOTC_REFUNDABLE_RATE = 0.40         // 40% refundable (max $1,000)
export const AOTC_MAX_YEARS = 4

export const LLC_EXPENSE_LIMIT = c(10000)        // per return (not per student)
export const LLC_CREDIT_RATE = 0.20              // 20%
export const LLC_MAX_CREDIT = c(2000)            // per return

// Phase-out ranges (same for both AOTC and LLC in 2025)
export const EDUCATION_CREDIT_PHASEOUT: Record<FilingStatus, { start: number; end: number }> = {
  single: { start: c(80000),  end: c(90000) },
  hoh:    { start: c(80000),  end: c(90000) },
  mfj:    { start: c(160000), end: c(180000) },
  mfs:    { start: c(0),      end: c(0) },        // MFS ineligible
  qw:     { start: c(160000), end: c(180000) },
}

// ── Energy Credit (Form 5695) ───────────────────────────────────
// Source: IRC §25C, §25D (IRA 2022)

export const ENERGY_CLEAN_RATE = 0.30                 // Part I — 30%, no cap
export const ENERGY_IMPROVEMENT_RATE = 0.30           // Part II — 30%, capped
export const ENERGY_IMPROVEMENT_ANNUAL_CAP = c(1200)  // general annual cap
export const ENERGY_HEAT_PUMP_CAP = c(2000)           // separate from $1,200
export const ENERGY_WINDOWS_CAP = c(600)
export const ENERGY_DOORS_CAP = c(500)
export const ENERGY_AUDIT_CAP = c(150)

// ── Alternative Minimum Tax (Form 6251) ───────────────────────
// Source: Rev. Proc. 2024-40, §3.02

export const AMT_EXEMPTION: Record<FilingStatus, number> = {
  single: c(88100),
  mfj:    c(137000),
  mfs:    c(68500),
  hoh:    c(88100),
  qw:     c(137000),
}

export const AMT_PHASEOUT_THRESHOLD: Record<FilingStatus, number> = {
  single: c(626350),
  mfj:    c(1252700),
  mfs:    c(626350),
  hoh:    c(626350),
  qw:     c(1252700),
}

export const AMT_PHASEOUT_RATE = 0.25  // exemption reduced by 25¢ per $1 over threshold

export const AMT_28_PERCENT_THRESHOLD: Record<FilingStatus, number> = {
  single: c(248300),
  mfj:    c(248300),
  mfs:    c(124150),
  hoh:    c(248300),
  qw:     c(248300),
}

// ── IRA Deduction (Schedule 1, Line 20) ────────────────────────
// Source: Rev. Proc. 2024-40, IRC §219

export const IRA_CONTRIBUTION_LIMIT = c(7000)   // under age 50
export const IRA_CATCHUP_LIMIT = c(8000)         // age 50+
export const IRA_CATCHUP_AGE = 50

// Phase-out ranges when taxpayer IS covered by employer retirement plan
export const IRA_PHASEOUT_COVERED: Record<FilingStatus, { start: number; end: number }> = {
  single: { start: c(79000),  end: c(89000) },
  hoh:    { start: c(79000),  end: c(89000) },
  mfj:    { start: c(126000), end: c(146000) },
  mfs:    { start: c(0),      end: c(10000) },
  qw:     { start: c(126000), end: c(146000) },
}

// Phase-out when taxpayer NOT covered but spouse IS covered (MFJ only)
export const IRA_PHASEOUT_SPOUSE_COVERED = { start: c(236000), end: c(246000) }

// ── HSA (Form 8889) ──────────────────────────────────────────────
// Source: Rev. Proc. 2024-25

export const HSA_LIMIT_SELF_ONLY = c(4300)
export const HSA_LIMIT_FAMILY = c(8550)
export const HSA_CATCHUP_AMOUNT = c(1000)
export const HSA_CATCHUP_AGE = 55
export const HSA_EXCESS_PENALTY_RATE = 0.06
export const HSA_DISTRIBUTION_PENALTY_RATE = 0.20

// ── Student Loan Interest (Schedule 1, Line 21) ─────────────────
// Source: Rev. Proc. 2024-40, IRC §221

export const STUDENT_LOAN_DEDUCTION_MAX = c(2500)

export const STUDENT_LOAN_PHASEOUT: Record<FilingStatus, { start: number; end: number } | null> = {
  single: { start: c(85000),  end: c(100000) },
  hoh:    { start: c(85000),  end: c(100000) },
  mfj:    { start: c(170000), end: c(200000) },
  qw:     { start: c(170000), end: c(200000) },
  mfs:    null,  // not eligible
}

// ── Tax Year ───────────────────────────────────────────────────

export const TAX_YEAR = 2025
