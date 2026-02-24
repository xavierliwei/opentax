/**
 * New York Form IT-201 — Resident Income Tax Return (TY 2025)
 *
 * Computes NY state income tax for full-year and part-year residents.
 * Starts from federal AGI and applies NY-specific adjustments.
 *
 * Reference: NY DTF IT-201 Instructions, NY Tax Law §§601–620
 *
 * SCAFFOLD NOTES:
 *   - NY additions: currently handles bond interest and municipal bond
 *     add-backs. Other additions (e.g. IRC §168(k) bonus depreciation
 *     add-back) are not yet implemented.
 *   - NY subtractions: Social Security exemption, US government
 *     obligation interest, and pension/annuity exclusion (up to $20K
 *     for filers age 59½+).
 *   - Credits: NY EITC (30% of federal). Child & dependent care credit
 *     and NYC resident tax are not yet implemented.
 *   - Itemized deductions: defers to federal Schedule A with NY SALT
 *     modification (no $10K cap for state purposes).
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  NY_TAX_BRACKETS,
  NY_STANDARD_DEDUCTION,
  NY_DEPENDENT_EXEMPTION,
  NY_EITC_RATE,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface FormIT201Result {
  // Income
  federalAGI: number
  nyAdditions: number
  nySubtractions: number
  nyAGI: number

  // Addition/subtraction detail
  ssExemption: number
  usGovInterest: number
  pensionExclusion: number

  // Deductions
  standardDeduction: number
  nyItemizedDeduction: number
  deductionUsed: number
  deductionMethod: 'standard' | 'itemized'
  dependentExemption: number

  // Tax
  nyTaxableIncome: number
  nyTax: number

  // Credits
  nyEITC: number
  totalCredits: number

  // Result
  taxAfterCredits: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number

  // Residency
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
}

// ── Bracket tax computation ─────────────────────────────────────

function computeBracketTax(
  taxableIncome: number,
  brackets: { limit: number; rate: number }[],
): number {
  let remaining = taxableIncome
  let tax = 0
  let prevLimit = 0
  for (const bracket of brackets) {
    const width = bracket.limit === Infinity
      ? remaining
      : Math.min(remaining, bracket.limit - prevLimit)
    if (width <= 0) break
    tax += width * bracket.rate
    remaining -= width
    prevLimit = bracket.limit
  }
  return Math.round(tax)
}

// ── Apportionment ratio for part-year ───────────────────────────

function computeNYApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
  if (config.residencyType === 'full-year') return 1
  if (config.residencyType === 'nonresident') return 0

  const daysInYear = isLeapYear(taxYear) ? 366 : 365
  const yearStart = Date.UTC(taxYear, 0, 1)
  const yearEnd = Date.UTC(taxYear, 11, 31)
  const dayMs = 86400000

  let start = yearStart
  let end = yearEnd

  if (config.moveInDate) {
    const [y, m, d] = config.moveInDate.split('-').map(Number)
    const parsed = Date.UTC(y, m - 1, d)
    if (!Number.isNaN(parsed)) start = parsed
  }

  if (config.moveOutDate) {
    const [y, m, d] = config.moveOutDate.split('-').map(Number)
    const parsed = Date.UTC(y, m - 1, d)
    if (!Number.isNaN(parsed)) end = parsed
  }

  if (start < yearStart) start = yearStart
  if (end > yearEnd) end = yearEnd
  if (end < start) return 0

  const daysInState = Math.round((end - start) / dayMs) + 1
  return Math.min(1, Math.max(0, daysInState / daysInYear))
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// ── NY Itemized deduction computation ───────────────────────────

function computeNYItemized(
  model: TaxReturn,
  federal: Form1040Result,
  _nyAGI: number,
): number {
  // If the taxpayer didn't itemize federally, no NY itemized deduction
  if (!federal.scheduleA || model.deductions.method !== 'itemized') return 0

  const itemized = model.deductions.itemized
  if (!itemized) return 0

  // NY allows the full SALT deduction (no federal cap).
  // Federal Schedule A Line 7 = SALT after federal cap.
  // We add back the difference between uncapped actual SALT and the capped amount.
  const actualSALT =
    (itemized.stateLocalIncomeTaxes ?? 0) +
    (itemized.stateLocalSalesTaxes ?? 0) +
    (itemized.realEstateTaxes ?? 0) +
    (itemized.personalPropertyTaxes ?? 0)

  const federalCappedSALT = federal.scheduleA.line7.amount
  const saltAddBack = Math.max(0, actualSALT - federalCappedSALT)

  return federal.scheduleA.line17.amount + saltAddBack
}

// ── Main computation ────────────────────────────────────────────

export function computeFormIT201(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormIT201Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeNYApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── NY Additions ─────────────────────────────────────────────
  // Currently no common additions implemented for typical W-2 filers.
  // Future: IRC §168(k) bonus depreciation add-back, other non-conformity items
  const nyAdditions = 0

  // ── NY Subtractions ──────────────────────────────────────────
  // Social Security: NY fully exempts SS benefits
  const ssExemption = form1040.line6b.amount

  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Pension/annuity exclusion: up to $20,000 for qualifying filers (age 59½+)
  // SCAFFOLD: Not yet implemented — would require age check and 1099-R data
  const pensionExclusion = 0

  const nySubtractions = ssExemption + usGovInterest + pensionExclusion
  const nyAGI = federalAGI + nyAdditions - nySubtractions

  // ── Deductions ───────────────────────────────────────────────
  const standardDeduction = NY_STANDARD_DEDUCTION[model.filingStatus]
  const nyItemizedDeduction = computeNYItemized(model, form1040, nyAGI)

  const deductionMethod: 'standard' | 'itemized' =
    nyItemizedDeduction > standardDeduction ? 'itemized' : 'standard'
  const deductionUsed = Math.max(standardDeduction, nyItemizedDeduction)

  // Dependent exemption
  const dependentExemption = model.dependents.length * NY_DEPENDENT_EXEMPTION

  // ── Taxable income ───────────────────────────────────────────
  const nyTaxableIncome = Math.max(0, nyAGI - deductionUsed - dependentExemption)

  // ── Tax computation ──────────────────────────────────────────
  const brackets = NY_TAX_BRACKETS[model.filingStatus]
  const fullYearTax = computeBracketTax(nyTaxableIncome, brackets)
  const nyTax = ratio < 1 ? Math.round(fullYearTax * ratio) : fullYearTax

  // ── Credits ──────────────────────────────────────────────────
  // NY EITC: 30% of federal EITC
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const nyEITC = Math.round(federalEITC * NY_EITC_RATE)

  const totalCredits = nyEITC

  // ── Tax after credits ────────────────────────────────────────
  const taxAfterCredits = Math.max(0, nyTax - totalCredits)

  // ── Payments ─────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'NY' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  return {
    federalAGI,
    nyAdditions,
    nySubtractions,
    nyAGI,
    ssExemption,
    usGovInterest,
    pensionExclusion,
    standardDeduction,
    nyItemizedDeduction,
    deductionUsed,
    deductionMethod,
    dependentExemption,
    nyTaxableIncome,
    nyTax,
    nyEITC,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
  }
}
