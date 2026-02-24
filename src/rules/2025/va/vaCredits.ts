/**
 * Virginia Credits — Schedule CR
 *
 * Phase 1: Low-income credit only.
 *
 * Source: VA Schedule CR Instructions
 */

import { VA_POVERTY_GUIDELINES } from './constants'

/**
 * Compute the Virginia low-income credit (nonrefundable).
 *
 * If VA taxable income ≤ poverty level for the filer's family size:
 *   Credit = VA tax × (poverty level − VA taxable income) / poverty level
 *
 * This is a sliding-scale reduction that approaches the full tax amount
 * as taxable income approaches zero.
 *
 * @param vaTaxableIncome - Virginia taxable income in cents
 * @param vaTax - Virginia income tax in cents
 * @param familySize - Number of persons (filers + dependents)
 * @returns Low-income credit in cents
 */
export function computeLowIncomeCredit(
  vaTaxableIncome: number,
  vaTax: number,
  familySize: number,
): number {
  if (vaTax <= 0 || vaTaxableIncome <= 0) return 0

  // Clamp family size to valid range
  const clampedSize = Math.max(1, Math.min(familySize, 8))
  const povertyLevel = VA_POVERTY_GUIDELINES[clampedSize]
  if (!povertyLevel) return 0

  if (vaTaxableIncome > povertyLevel) return 0

  // Sliding-scale credit
  const credit = Math.round(vaTax * (povertyLevel - vaTaxableIncome) / povertyLevel)
  // Nonrefundable: can't exceed tax
  return Math.min(credit, vaTax)
}
