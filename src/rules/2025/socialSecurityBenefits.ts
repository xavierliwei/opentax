/**
 * Social Security Benefits — Taxable Amount Computation
 *
 * Implements the IRS worksheet from Publication 915 to determine
 * the taxable portion of Social Security benefits (Form 1040 Lines 6a/6b).
 *
 * Three-tier system:
 *   Tier 0: Combined income ≤ base amount → $0 taxable
 *   Tier 1: Base < combined income ≤ additional amount → up to 50% taxable
 *   Tier 2: Combined income > additional amount → up to 85% taxable
 *
 * Combined income = Modified AGI + ½ × gross SS benefits
 * Modified AGI = AGI (excluding SS benefits) + tax-exempt interest
 *
 * Source: IRS Publication 915, Worksheet 1
 * Source: IRC §86
 */

import type { FilingStatus } from '../../model/types'

// ── Thresholds (in integer cents) ─────────────────────────────

/** Base amount — below this, no SS benefits are taxable (IRC §86(c)(1)) */
export const SS_BASE_AMOUNT: Record<FilingStatus, number> = {
  single: 2_500_000,   // $25,000
  hoh:    2_500_000,   // $25,000
  mfj:    3_200_000,   // $32,000
  mfs:    0,           // $0 if lived with spouse (worst case)
  qw:     2_500_000,   // $25,000
}

/**
 * Additional amount — above this, up to 85% is taxable (IRC §86(c)(2)).
 * Between base and additional, up to 50% is taxable.
 */
export const SS_ADDITIONAL_AMOUNT: Record<FilingStatus, number> = {
  single: 3_400_000,   // $34,000
  hoh:    3_400_000,   // $34,000
  mfj:    4_400_000,   // $44,000
  mfs:    0,           // $0 if lived with spouse
  qw:     3_400_000,   // $34,000
}

/**
 * MFS lived-apart thresholds — IRC §86(c)(1)(C)(ii)
 * If filing MFS and lived apart from spouse for the ENTIRE year,
 * the taxpayer uses these thresholds instead of $0/$0.
 * These are the same as the single filer amounts.
 */
export const SS_MFS_LIVED_APART_BASE = 2_500_000       // $25,000
export const SS_MFS_LIVED_APART_ADDITIONAL = 3_400_000  // $34,000

// ── Result ─────────────────────────────────────────────────────

export interface SocialSecurityBenefitsResult {
  grossBenefits: number           // Line 6a: total SSA-1099 Box 5 (cents)
  halfBenefits: number            // 50% of gross benefits (cents)
  modifiedAGI: number             // AGI (excl. SS) + tax-exempt interest (cents)
  combinedIncome: number          // MAGI + half benefits (cents)
  baseAmount: number              // Tier 1 threshold (cents)
  additionalAmount: number        // Tier 2 threshold (cents)
  taxableBenefits: number         // Line 6b: taxable amount (cents)
  tier: 0 | 1 | 2                // Which tier applied
  federalWithheld: number         // SSA-1099 Box 6 total (cents) — for Line 25
  mfsLivedApart?: boolean         // If true, MFS used lived-apart thresholds
}

// ── Computation ────────────────────────────────────────────────

/**
 * Compute taxable Social Security benefits per IRS Publication 915 worksheet.
 *
 * @param grossBenefits  Sum of all SSA-1099 Box 5 (net benefits) in cents
 * @param otherIncome    AGI excluding SS benefits (all other income minus above-the-line adjustments) in cents
 * @param taxExemptInterest  Sum of 1099-INT Box 8 (tax-exempt interest) in cents
 * @param filingStatus   Filing status
 * @param federalWithheld Sum of SSA-1099 Box 6 (voluntary withholding) in cents
 * @param mfsLivedApart  If true and MFS, use lived-apart thresholds (IRC §86(c)(1)(C)(ii))
 */
export function computeTaxableSocialSecurity(
  grossBenefits: number,
  otherIncome: number,
  taxExemptInterest: number,
  filingStatus: FilingStatus,
  federalWithheld: number = 0,
  mfsLivedApart: boolean = false,
): SocialSecurityBenefitsResult {
  // Determine effective thresholds — MFS lived-apart uses single-like thresholds
  const effectiveMfsLivedApart = filingStatus === 'mfs' && mfsLivedApart

  if (grossBenefits <= 0) {
    const baseAmount = effectiveMfsLivedApart ? SS_MFS_LIVED_APART_BASE : SS_BASE_AMOUNT[filingStatus]
    const additionalAmount = effectiveMfsLivedApart ? SS_MFS_LIVED_APART_ADDITIONAL : SS_ADDITIONAL_AMOUNT[filingStatus]
    return {
      grossBenefits: 0,
      halfBenefits: 0,
      modifiedAGI: 0,
      combinedIncome: 0,
      baseAmount,
      additionalAmount,
      taxableBenefits: 0,
      tier: 0,
      federalWithheld,
      mfsLivedApart: effectiveMfsLivedApart,
    }
  }

  const halfBenefits = Math.round(grossBenefits / 2)
  const modifiedAGI = otherIncome + taxExemptInterest
  const combinedIncome = modifiedAGI + halfBenefits

  const baseAmount = effectiveMfsLivedApart ? SS_MFS_LIVED_APART_BASE : SS_BASE_AMOUNT[filingStatus]
  const additionalAmount = effectiveMfsLivedApart ? SS_MFS_LIVED_APART_ADDITIONAL : SS_ADDITIONAL_AMOUNT[filingStatus]

  // Tier 0: combined income ≤ base amount → nothing taxable
  if (combinedIncome <= baseAmount) {
    return {
      grossBenefits,
      halfBenefits,
      modifiedAGI,
      combinedIncome,
      baseAmount,
      additionalAmount,
      taxableBenefits: 0,
      tier: 0,
      federalWithheld,
      mfsLivedApart: effectiveMfsLivedApart,
    }
  }

  const excessOverBase = combinedIncome - baseAmount
  const tierRange = additionalAmount - baseAmount  // $9K single, $12K MFJ

  // Tier 1: base < combined income ≤ additional amount
  // Taxable = min(50% × excess over base, 50% × gross benefits)
  if (combinedIncome <= additionalAmount) {
    const taxableBenefits = Math.min(
      Math.round(excessOverBase * 0.50),
      Math.round(grossBenefits * 0.50),
    )
    return {
      grossBenefits,
      halfBenefits,
      modifiedAGI,
      combinedIncome,
      baseAmount,
      additionalAmount,
      taxableBenefits,
      tier: 1,
      federalWithheld,
      mfsLivedApart: effectiveMfsLivedApart,
    }
  }

  // Tier 2: combined income > additional amount
  // tier1Max = min(50% × tier range, 50% × gross benefits)
  // Taxable = min(85% × excess over additional + tier1Max, 85% × gross benefits)
  const excessOverAdditional = combinedIncome - additionalAmount
  const tier1Max = Math.min(
    Math.round(tierRange * 0.50),
    Math.round(grossBenefits * 0.50),
  )
  const taxableBenefits = Math.min(
    Math.round(excessOverAdditional * 0.85) + tier1Max,
    Math.round(grossBenefits * 0.85),
  )

  return {
    grossBenefits,
    halfBenefits,
    modifiedAGI,
    combinedIncome,
    baseAmount,
    additionalAmount,
    taxableBenefits,
    tier: 2,
    federalWithheld,
    mfsLivedApart: effectiveMfsLivedApart,
  }
}
