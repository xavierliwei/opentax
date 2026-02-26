/**
 * Kentucky Form 740 constants (Tax Year 2025)
 *
 * NOTE: monetary values are represented in cents.
 */

import type { FilingStatus } from '../../../model/types'

const c = (dollars: number): number => Math.round(dollars * 100)

/** KY flat income tax rate (2025) — 4.0% */
export const KY_FLAT_TAX_RATE = 0.04

/**
 * KY standard deduction (2025) — $3,160 for all filing statuses.
 * Unlike the federal standard deduction, Kentucky uses a single amount
 * regardless of filing status. For MFJ, each spouse gets $3,160.
 */
export const KY_STANDARD_DEDUCTION = c(3160)

/**
 * KY personal tax credit — $40 per person (taxpayer + spouse + dependents).
 * Kentucky eliminated personal exemptions when moving to the flat tax,
 * replacing them with a flat $40 credit per person.
 */
export const KY_PERSONAL_TAX_CREDIT = c(40)

/**
 * KY pension/retirement income exclusion — $31,110 per person (2024 value).
 * Applies to pension income, IRA distributions, and other qualified
 * retirement distributions for Kentucky residents.
 */
export const KY_PENSION_EXCLUSION = c(31110)

/**
 * KY military pay exclusion — $31,110 for active duty military pay.
 */
export const KY_MILITARY_PAY_EXCLUSION = c(31110)

/**
 * KY Family Size Tax Credit — percentage of tax liability based on
 * modified gross income and family size.
 *
 * Simplified thresholds for initial implementation:
 * - 100% credit for very low income (below threshold)
 * - Phases down as income rises
 *
 * These thresholds are approximate; the full table has more brackets
 * based on family size. We implement a simplified version here.
 *
 * Family size 1: 100% credit if MGI <= $12,880
 * Family size 2: 100% credit if MGI <= $17,420
 * Family size 3: 100% credit if MGI <= $21,960
 * Family size 4: 100% credit if MGI <= $26,500
 * Each additional family member adds ~$4,540
 *
 * The credit phases to 0% as income exceeds these thresholds.
 * For simplicity, we use the federal poverty guideline base amounts.
 */
export const KY_FSTC_BASE_INCOME_SINGLE = c(12880)
export const KY_FSTC_INCREMENT_PER_PERSON = c(4540)

/**
 * Family Size Tax Credit phase-out table.
 * At each threshold percentage, the credit rate drops.
 * Modified Gross Income as a percentage of the threshold amount:
 *
 * <= 100% → 100% credit
 * 100-133% → phases down (we use linear interpolation)
 * > 133% → 0% credit
 */
export const KY_FSTC_FULL_CREDIT_RATIO = 1.0
export const KY_FSTC_PHASEOUT_END_RATIO = 1.33

/**
 * KY standard deduction for MFJ — $6,320 (both spouses combined).
 * Convenience constant: 2 x $3,160.
 */
export const KY_STANDARD_DEDUCTION_MFJ = c(6320)

/**
 * Helper: get the KY standard deduction for a filing status.
 * For MFJ/QW: $6,320 (both spouses). Otherwise: $3,160.
 */
export function kyStandardDeduction(status: FilingStatus): number {
  switch (status) {
    case 'mfj':
    case 'qw':
      return KY_STANDARD_DEDUCTION_MFJ
    default:
      return KY_STANDARD_DEDUCTION
  }
}
