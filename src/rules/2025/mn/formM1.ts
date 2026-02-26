/**
 * Minnesota Form M1 — Individual Income Tax Return (TY 2025)
 *
 * Computes MN state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * MN-specific additions, subtractions, and deductions.
 *
 * Reference: MN Revenue Form M1 Instructions, MN Statutes Chapter 290
 *
 * SCAFFOLD NOTES:
 *   - MN additions: currently handles bond interest from non-MN states
 *     (placeholder). Other additions (e.g. net operating loss
 *     differences) are not yet implemented.
 *   - MN subtractions: Social Security exemption, US government
 *     obligation interest.
 *   - Credits: MN Working Family Credit (25% of federal EITC),
 *     MN Child Tax Credit ($1,750/child).
 *   - Itemized deductions: defers to federal Schedule A with MN SALT
 *     modification (no $10K cap for state purposes).
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  MN_TAX_BRACKETS,
  MN_STANDARD_DEDUCTION,
  MN_WORKING_FAMILY_CREDIT_RATE,
  MN_CHILD_TAX_CREDIT_PER_CHILD,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface FormM1Result {
  // Income
  federalAGI: number
  mnAdditions: number
  mnSubtractions: number
  mnAGI: number

  // Subtraction detail
  ssExemption: number
  usGovInterest: number

  // Deductions
  standardDeduction: number
  mnItemizedDeduction: number
  deductionUsed: number
  deductionMethod: 'standard' | 'itemized'

  // Tax
  mnTaxableIncome: number
  mnTax: number

  // Credits
  mnWorkingFamilyCredit: number
  mnChildTaxCredit: number
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
  mnSourceIncome?: number
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

function computeMNApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

// ── MN Itemized deduction computation ───────────────────────────

function computeMNItemized(
  model: TaxReturn,
  federal: Form1040Result,
  _mnAGI: number,
): number {
  // If the taxpayer didn't itemize federally, no MN itemized deduction
  if (!federal.scheduleA || model.deductions.method !== 'itemized') return 0

  const itemized = model.deductions.itemized
  if (!itemized) return 0

  // MN allows the full SALT deduction (no federal $10K cap).
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

export function computeFormM1(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormM1Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeMNApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── MN Additions (Schedule M1M, Part A) ────────────────────
  // Currently no common additions implemented for typical W-2 filers.
  // Future: state/local bond interest from non-MN states,
  //         net operating loss differences
  const mnAdditions = 0

  // ── MN Subtractions (Schedule M1M, Part B) ─────────────────
  // Social Security: MN exempts SS benefits
  const ssExemption = form1040.line6b.amount

  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const mnSubtractions = ssExemption + usGovInterest
  const mnAGI = federalAGI + mnAdditions - mnSubtractions

  // ── Deductions ─────────────────────────────────────────────
  const standardDeduction = MN_STANDARD_DEDUCTION[model.filingStatus]
  const mnItemizedDeduction = computeMNItemized(model, form1040, mnAGI)

  const deductionMethod: 'standard' | 'itemized' =
    mnItemizedDeduction > standardDeduction ? 'itemized' : 'standard'
  const deductionUsed = Math.max(standardDeduction, mnItemizedDeduction)

  // ── Taxable income ─────────────────────────────────────────
  const mnTaxableIncome = Math.max(0, mnAGI - deductionUsed)

  // ── Tax computation ────────────────────────────────────────
  const brackets = MN_TAX_BRACKETS[model.filingStatus]
  const fullYearTax = computeBracketTax(mnTaxableIncome, brackets)
  const mnTax = ratio < 1 ? Math.round(fullYearTax * ratio) : fullYearTax

  // ── Credits ────────────────────────────────────────────────
  // MN Working Family Credit: 25% of federal EITC (simplified)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const mnWorkingFamilyCredit = Math.round(federalEITC * MN_WORKING_FAMILY_CREDIT_RATE)

  // MN Child Tax Credit: $1,750 per qualifying child
  // Qualifying children: dependents under age 17 at end of tax year
  const taxYearEnd = new Date(model.taxYear, 11, 31)
  const qualifyingChildren = model.dependents.filter(dep => {
    if (!dep.dateOfBirth) return false
    const dob = new Date(dep.dateOfBirth)
    const age = taxYearEnd.getFullYear() - dob.getFullYear() -
      (taxYearEnd < new Date(taxYearEnd.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
    return age < 17
  }).length
  const mnChildTaxCredit = qualifyingChildren * MN_CHILD_TAX_CREDIT_PER_CHILD

  // Working family credit is refundable, child tax credit is refundable.
  // For simplicity, we apply both against tax (refundable credits
  // are handled as negative tax in the result).
  const totalCredits = mnWorkingFamilyCredit + mnChildTaxCredit

  // ── Tax after credits ──────────────────────────────────────
  // Both MN WFC and CTC are refundable, so taxAfterCredits can go negative
  // but we only let it reduce to zero here; refundable portion is
  // captured in overpaid below.
  const nonrefundablePortion = Math.max(0, mnTax - totalCredits)
  const refundableExcess = Math.max(0, totalCredits - mnTax)
  const taxAfterCredits = nonrefundablePortion

  // ── Payments ───────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'MN' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + refundableExcess
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const mnSourceIncome = ratio < 1 ? Math.round(mnAGI * ratio) : undefined

  return {
    federalAGI,
    mnAdditions,
    mnSubtractions,
    mnAGI,
    ssExemption,
    usGovInterest,
    standardDeduction,
    mnItemizedDeduction,
    deductionUsed,
    deductionMethod,
    mnTaxableIncome,
    mnTax,
    mnWorkingFamilyCredit,
    mnChildTaxCredit,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    mnSourceIncome,
  }
}
