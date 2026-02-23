/**
 * Premium Tax Credit — Form 8962
 *
 * Implements the ACA marketplace premium reconciliation for TY2025.
 * Computes the Premium Tax Credit (PTC) based on Form 1095-A data and
 * reconciles with advance PTC (APTC) payments.
 *
 * Key concepts:
 *   - Household income as % of Federal Poverty Level (FPL) determines
 *     the "applicable figure" (contribution percentage)
 *   - Monthly PTC = max(0, min(enrollment premium, SLCSP − contribution))
 *   - Net PTC = Annual PTC − Total APTC
 *   - Net PTC > 0 → refundable credit (Form 1040, Line 31)
 *   - Net PTC < 0 → excess APTC repayment (Schedule 2, Part I, Line 2),
 *     subject to repayment caps for income < 400% FPL
 *
 * Source: Form 8962 Instructions (2025), IRC §36B
 * Source: Rev. Proc. 2024-40 (applicable percentage table)
 * Source: IRA §13601 (enhanced subsidies extended through 2025)
 */

import type { Form1095A, FilingStatus } from '../../model/types'

// ── Federal Poverty Level (2024 guidelines, used for TY2025 coverage) ──
// Source: HHS 2024 Federal Poverty Level Guidelines (48 contiguous states + DC)

const FPL_BASE = 1_506_000        // $15,060 — 1-person household (cents)
const FPL_PER_ADDITIONAL = 538_000 // $5,380 per additional person (cents)

/** FPL amount for a given household size (cents). */
export function federalPovertyLevel(householdSize: number): number {
  if (householdSize < 1) return FPL_BASE
  return FPL_BASE + FPL_PER_ADDITIONAL * (householdSize - 1)
}

// ── Applicable Percentage Table (TY2025, IRA-enhanced) ──────────
// Under IRA §13601, the enhanced premium subsidies apply through 2025:
//   ≤ 150% FPL: 0.00%
//   150%–200%:  0.00% → 2.00% (linear)
//   200%–250%:  2.00% → 4.00% (linear)
//   250%–300%:  4.00% → 6.00% (linear)
//   300%–400%:  6.00% → 8.50% (linear)
//   > 400%:     8.50% (no cliff under IRA)
//
// Source: IRC §36B(b)(3)(A), as modified by IRA

interface ApplicableBand {
  minFplPct: number   // inclusive
  maxFplPct: number   // exclusive (except last)
  initialPct: number  // applicable % at start of band
  finalPct: number    // applicable % at end of band
}

const APPLICABLE_BANDS: ApplicableBand[] = [
  { minFplPct: 0,   maxFplPct: 150, initialPct: 0.0000, finalPct: 0.0000 },
  { minFplPct: 150, maxFplPct: 200, initialPct: 0.0000, finalPct: 0.0200 },
  { minFplPct: 200, maxFplPct: 250, initialPct: 0.0200, finalPct: 0.0400 },
  { minFplPct: 250, maxFplPct: 300, initialPct: 0.0400, finalPct: 0.0600 },
  { minFplPct: 300, maxFplPct: 400, initialPct: 0.0600, finalPct: 0.0850 },
]

const MAX_APPLICABLE_PCT = 0.0850  // 8.5% cap for > 400% FPL

/**
 * Compute the applicable percentage (contribution rate) based on
 * household income as a percentage of FPL.
 *
 * Linear interpolation within each band per IRC §36B(b)(3)(A).
 */
export function computeApplicablePercentage(fplPercent: number): number {
  if (fplPercent <= 0) return 0

  for (const band of APPLICABLE_BANDS) {
    if (fplPercent < band.maxFplPct) {
      if (fplPercent <= band.minFplPct) return band.initialPct
      // Linear interpolation within band
      const progress = (fplPercent - band.minFplPct) / (band.maxFplPct - band.minFplPct)
      return band.initialPct + progress * (band.finalPct - band.initialPct)
    }
  }

  return MAX_APPLICABLE_PCT  // > 400% FPL
}

// ── Excess APTC Repayment Caps (TY2025) ─────────────────────────
// IRC §36B(f)(2)(B) — indexed amounts for 2025
// Source: Rev. Proc. 2024-40 §3.44
//
// Filing single/other vs. other filing statuses:

interface RepaymentCap {
  minFplPct: number
  maxFplPct: number
  singleCap: number     // cents
  otherCap: number      // cents (MFJ, HOH, QW)
}

const REPAYMENT_CAPS: RepaymentCap[] = [
  { minFplPct: 0,   maxFplPct: 200, singleCap: 40_000,  otherCap: 80_000 },   // $400 / $800
  { minFplPct: 200, maxFplPct: 300, singleCap: 105_000, otherCap: 210_000 },  // $1,050 / $2,100
  { minFplPct: 300, maxFplPct: 400, singleCap: 175_000, otherCap: 350_000 },  // $1,750 / $3,500
]

/**
 * Get the excess APTC repayment cap for a given FPL% and filing status.
 * Returns Infinity if > 400% FPL (no cap — full repayment required).
 */
export function getRepaymentCap(fplPercent: number, filingStatus: FilingStatus): number {
  if (fplPercent >= 400) return Infinity

  const isSingle = filingStatus === 'single' || filingStatus === 'mfs'

  for (const cap of REPAYMENT_CAPS) {
    if (fplPercent < cap.maxFplPct) {
      return isSingle ? cap.singleCap : cap.otherCap
    }
  }

  return Infinity
}

// ── Result Types ─────────────────────────────────────────────────

export interface PremiumTaxCreditMonthly {
  month: number
  enrollmentPremium: number   // cents
  slcspPremium: number        // cents
  contribution: number        // cents — taxpayer's expected contribution
  ptcAmount: number           // cents — max(0, min(enrollment, SLCSP − contribution))
  advancePTC: number          // cents — APTC paid
}

export interface PremiumTaxCreditResult {
  householdSize: number
  householdIncome: number       // cents — modified AGI
  fplAmount: number             // cents — FPL for household size
  fplPercent: number            // household income as % of FPL (e.g., 250 = 250%)
  applicablePercentage: number  // contribution rate (e.g., 0.04 = 4%)
  monthlyDetails: PremiumTaxCreditMonthly[]
  annualPTC: number             // cents — total PTC across all months
  totalAPTC: number             // cents — total advance PTC received
  netPTC: number                // cents — annualPTC − totalAPTC (positive = credit)
  excessAPTC: number            // cents — amount to repay (positive, capped)
  repaymentCap: number          // cents — Infinity if no cap
  creditAmount: number          // cents — refundable credit for Line 31 (≥ 0)
  repaymentAmount: number       // cents — excess APTC for Schedule 2 (≥ 0)
  eligible: boolean             // false if income > 400% FPL with no APTC to reconcile
}

// ── Computation ──────────────────────────────────────────────────

/**
 * Compute the Premium Tax Credit (Form 8962) reconciliation.
 *
 * @param form1095As   Array of Form 1095-A marketplace statements
 * @param householdIncome  Modified AGI (Form 8962 Line 2+3) in cents
 * @param filingStatus Filing status
 * @param numDependents Number of dependents (for household size)
 * @param hasSpouse    Whether filing MFJ (affects household size)
 */
export function computePremiumTaxCredit(
  form1095As: Form1095A[],
  householdIncome: number,
  filingStatus: FilingStatus,
  numDependents: number,
  hasSpouse: boolean,
): PremiumTaxCreditResult {
  // Household size: taxpayer + spouse (if MFJ) + dependents
  const householdSize = 1 + (hasSpouse ? 1 : 0) + numDependents

  const fplAmount = federalPovertyLevel(householdSize)
  const fplPercent = fplAmount > 0 ? (householdIncome / fplAmount) * 100 : 9999
  const applicablePercentage = computeApplicablePercentage(fplPercent)

  // Annual expected contribution = applicable_percentage × household_income
  const annualContribution = Math.round(householdIncome * applicablePercentage)
  // Monthly contribution
  const monthlyContribution = Math.round(annualContribution / 12)

  // Consolidate all monthly rows across all 1095-As
  // (taxpayer could have multiple marketplace policies)
  const monthMap = new Map<number, {
    enrollmentPremium: number
    slcspPremium: number
    advancePTC: number
  }>()

  for (const form of form1095As) {
    for (const row of form.rows) {
      const existing = monthMap.get(row.month)
      if (existing) {
        existing.enrollmentPremium += row.enrollmentPremium
        existing.slcspPremium = Math.max(existing.slcspPremium, row.slcspPremium) // SLCSP doesn't stack
        existing.advancePTC += row.advancePTC
      } else {
        monthMap.set(row.month, {
          enrollmentPremium: row.enrollmentPremium,
          slcspPremium: row.slcspPremium,
          advancePTC: row.advancePTC,
        })
      }
    }
  }

  const monthlyDetails: PremiumTaxCreditMonthly[] = []
  let annualPTC = 0
  let totalAPTC = 0

  for (let m = 1; m <= 12; m++) {
    const data = monthMap.get(m)
    if (!data) continue

    // PTC = max(0, min(enrollment premium, SLCSP − contribution))
    const ptcAmount = Math.max(0, Math.min(
      data.enrollmentPremium,
      data.slcspPremium - monthlyContribution,
    ))

    monthlyDetails.push({
      month: m,
      enrollmentPremium: data.enrollmentPremium,
      slcspPremium: data.slcspPremium,
      contribution: monthlyContribution,
      ptcAmount,
      advancePTC: data.advancePTC,
    })

    annualPTC += ptcAmount
    totalAPTC += data.advancePTC
  }

  // Net PTC = annual PTC − total APTC
  const netPTC = annualPTC - totalAPTC

  // Repayment cap
  const repaymentCap = getRepaymentCap(fplPercent, filingStatus)

  let creditAmount = 0
  let repaymentAmount = 0

  if (netPTC >= 0) {
    // Taxpayer gets a refundable credit
    creditAmount = netPTC
  } else {
    // Taxpayer must repay excess APTC, subject to cap
    const excessAmount = Math.abs(netPTC)
    repaymentAmount = Math.min(excessAmount, repaymentCap === Infinity ? excessAmount : repaymentCap)
  }

  const excessAPTC = netPTC < 0 ? Math.abs(netPTC) : 0

  // Eligibility: income must be ≥ 100% FPL (generally) or have APTC to reconcile
  // For simplicity, if they have 1095-A data, they must file Form 8962
  const eligible = form1095As.length > 0

  return {
    householdSize,
    householdIncome,
    fplAmount,
    fplPercent,
    applicablePercentage,
    monthlyDetails,
    annualPTC,
    totalAPTC,
    netPTC,
    excessAPTC,
    repaymentCap,
    creditAmount,
    repaymentAmount,
    eligible,
  }
}
