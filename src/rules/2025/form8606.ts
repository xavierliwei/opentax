/**
 * Form 8606 — Nondeductible IRAs / Roth Conversions
 *
 * Part I:  Nondeductible Contributions to Traditional IRAs (pro-rata rule)
 * Part II: Conversions from Traditional, SEP, or SIMPLE IRAs to Roth
 *
 * The core complexity is the pro-rata rule: when a taxpayer has both
 * deductible and nondeductible contributions in their traditional IRA,
 * distributions and conversions are pro-rated between taxable and
 * nontaxable portions based on the ratio of basis to total IRA value.
 *
 * All amounts are in integer cents.
 *
 * Source: 2025 Form 8606 instructions
 * https://www.irs.gov/instructions/i8606
 */

import type { TaxReturn } from '../../model/types'

// ── Result type ──────────────────────────────────────────────────

export interface Form8606Result {
  // Part I — Nondeductible Contributions
  line1: number   // Current year nondeductible contributions (cents)
  line2: number   // Prior year basis (cents)
  line3: number   // Total basis (line1 + line2)
  line4: number   // Contributions withdrawn before due date (0 for simplicity)
  line5: number   // Basis for pro-rata (line3 - line4)
  line6: number   // Year-end value of ALL traditional/SEP/SIMPLE IRAs
  line7: number   // Distributions from traditional IRAs
  line8: number   // Net amount converted to Roth
  line9: number   // Total IRA value for pro-rata (line6 + line7 + line8)
  line10: number  // Pro-rata ratio (basis / total), stored as ratio * 1_000_000 for precision
  line11: number  // Nontaxable portion of conversion (line8 * ratio)
  line12: number  // Nontaxable portion of distributions (line7 * ratio)
  line13: number  // Total nontaxable (line11 + line12)
  line14: number  // Remaining basis carried forward (line3 - line13)

  // Part II — Conversions to Roth
  line16: number  // Amount converted (= line8)
  line17: number  // Nontaxable portion (= line11)
  line18: number  // TAXABLE amount of conversion (line16 - line17)

  // Summary
  taxableConversion: number       // Same as line18 — taxable Roth conversion amount
  taxableDistributions: number    // Taxable portion of traditional IRA distributions (line7 - line12)
  totalTaxableIRA: number         // line18 + taxableDistributions → goes to Form 1040 Line 4b
  totalGrossIRA: number           // line7 + line8 → goes to Form 1040 Line 4a
  remainingBasis: number          // Same as line14 — for next year's Line 2

  // Flags
  hasNondeductibleContributions: boolean
  hasConversion: boolean
  hasDistributions: boolean
}

// ── Main computation ─────────────────────────────────────────────

/**
 * Compute Form 8606 (Nondeductible IRAs / Roth Conversions).
 *
 * @param model - The tax return (uses form8606 data entered by user)
 * @returns Form8606Result or null if no Form 8606 data
 */
export function computeForm8606(
  model: TaxReturn,
): Form8606Result | null {
  const data = model.form8606

  // If no Form 8606 data entered, nothing to compute
  if (!data) return null

  const nondeductibleContrib = data.nondeductibleContributions ?? 0
  const priorBasis = data.priorYearBasis ?? 0
  const yearEndValue = data.traditionalIRAValueYearEnd ?? 0
  const distributions = data.distributionsInYear ?? 0
  const conversionAmount = data.rothConversionAmount ?? 0

  // Check if Form 8606 is needed
  const hasNondeductibleContrib = nondeductibleContrib > 0 || priorBasis > 0
  const hasConversion = conversionAmount > 0
  const hasDistributions = distributions > 0

  // Form 8606 is needed if there are nondeductible contributions, prior basis,
  // conversions, or distributions with basis
  if (!hasNondeductibleContrib && !hasConversion && !hasDistributions) {
    return null
  }

  // Part I — Nondeductible Contributions

  // Line 1: Current year nondeductible contributions
  const line1 = nondeductibleContrib

  // Line 2: Prior year basis
  const line2 = priorBasis

  // Line 3: Total basis (line1 + line2)
  const line3 = line1 + line2

  // Line 4: Contributions withdrawn before due date (skip for simplicity)
  const line4 = 0

  // Line 5: Basis for pro-rata (line3 - line4)
  const line5 = line3 - line4

  // Line 6: Year-end value of ALL traditional/SEP/SIMPLE IRAs
  const line6 = yearEndValue

  // Line 7: Distributions from traditional IRAs
  const line7 = distributions

  // Line 8: Net amount converted to Roth
  const line8 = conversionAmount

  // Line 9: Total IRA value for pro-rata (line6 + line7 + line8)
  const line9 = line6 + line7 + line8

  // Line 10: Pro-rata ratio (basis / total)
  // Stored as ratio * 1,000,000 for integer precision
  // If line9 is 0, ratio is 0 (no IRA value → no basis to apportion)
  // Capped at 1.000000 (100%) per IRS instructions
  let line10 = 0
  if (line9 > 0 && line5 > 0) {
    // Use high precision: (line5 * 1_000_000) / line9
    line10 = Math.min(1_000_000, Math.floor((line5 * 1_000_000) / line9))
  }

  // Line 11: Nontaxable portion of conversion (line8 * ratio)
  // Round to nearest cent: (line8 * line10) / 1_000_000
  const line11 = line9 > 0 ? Math.round((line8 * line10) / 1_000_000) : 0

  // Line 12: Nontaxable portion of distributions (line7 * ratio)
  const line12 = line9 > 0 ? Math.round((line7 * line10) / 1_000_000) : 0

  // Line 13: Total nontaxable (line11 + line12)
  const line13 = line11 + line12

  // Line 14: Remaining basis carried forward
  // This is the basis that carries to next year's Form 8606 Line 2
  // line3 - line13, but ensure it doesn't go negative
  const line14 = Math.max(0, line3 - line13)

  // Part II — Conversions to Roth

  // Line 16: Amount converted (same as line8)
  const line16 = line8

  // Line 17: Nontaxable portion of conversion (same as line11)
  const line17 = line11

  // Line 18: Taxable amount of conversion
  const line18 = line16 - line17

  // Summary computations
  const taxableConversion = line18
  const taxableDistributions = line7 - line12  // taxable portion of non-conversion distributions
  const totalTaxableIRA = taxableConversion + taxableDistributions
  const totalGrossIRA = line7 + line8

  return {
    line1,
    line2,
    line3,
    line4,
    line5,
    line6,
    line7,
    line8,
    line9,
    line10,
    line11,
    line12,
    line13,
    line14,
    line16,
    line17,
    line18,
    taxableConversion,
    taxableDistributions,
    totalTaxableIRA,
    totalGrossIRA,
    remainingBasis: line14,
    hasNondeductibleContributions: hasNondeductibleContrib,
    hasConversion,
    hasDistributions,
  }
}
