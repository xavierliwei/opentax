/**
 * Oregon Form OR-40 — Individual Income Tax Return (TY 2025)
 *
 * Computes OR state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * OR-specific additions, subtractions, deductions, and credits.
 *
 * Reference: Oregon DOR Form OR-40 Instructions, ORS Chapter 316
 *
 * SCAFFOLD NOTES:
 *   - OR additions: currently handles non-OR bond interest (placeholder).
 *   - OR subtractions: US government obligation interest.
 *   - OR does not exempt Social Security beyond the federal exclusion
 *     (it uses the same federal taxable SS amount).
 *   - Credits: Personal exemption credit ($236/person with phaseout),
 *     OR EITC (12%/9% of federal EITC).
 *   - Oregon has no SALT cap removal for itemized deductions (since
 *     Oregon has no sales tax, SALT mostly means OR income tax +
 *     property tax; OR allows federal itemized with modifications).
 *   - Kicker credit stubbed at $0 for initial implementation.
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  OR_TAX_BRACKETS,
  OR_STANDARD_DEDUCTION,
  OR_PERSONAL_EXEMPTION_CREDIT,
  OR_EXEMPTION_PHASEOUT,
  OR_EITC_RATE_WITH_CHILDREN,
  OR_EITC_RATE_WITHOUT_CHILDREN,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface FormOR40Result {
  // Income
  federalAGI: number
  orAdditions: number
  orSubtractions: number
  orAGI: number

  // Subtraction detail
  usGovInterest: number

  // Deductions
  standardDeduction: number
  orItemizedDeduction: number
  deductionUsed: number
  deductionMethod: 'standard' | 'itemized'

  // Tax
  orTaxableIncome: number
  orTax: number

  // Credits
  personalExemptionCredit: number
  personalExemptionCount: number
  orEITC: number
  kickerCredit: number
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
  orSourceIncome?: number
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

// ── Apportionment ratio for part-year/nonresident ───────────────

function computeORApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

// ── OR Itemized deduction computation ───────────────────────────

function computeORItemized(
  model: TaxReturn,
  federal: Form1040Result,
  _orAGI: number,
): number {
  // If the taxpayer didn't itemize federally, no OR itemized deduction
  if (!federal.scheduleA || model.deductions.method !== 'itemized') return 0

  const itemized = model.deductions.itemized
  if (!itemized) return 0

  // Oregon generally follows federal itemized deductions with some modifications.
  // Key differences:
  //   - Oregon allows deduction of state income taxes (no SALT cap for state purposes)
  //   - Oregon has no sales tax, so SALT is mainly income tax + property tax
  //
  // For initial implementation, we take the federal Schedule A total and
  // add back the SALT cap difference (same approach as MN).
  const actualSALT =
    (itemized.stateLocalIncomeTaxes ?? 0) +
    (itemized.stateLocalSalesTaxes ?? 0) +
    (itemized.realEstateTaxes ?? 0) +
    (itemized.personalPropertyTaxes ?? 0)

  const federalCappedSALT = federal.scheduleA.line7.amount
  const saltAddBack = Math.max(0, actualSALT - federalCappedSALT)

  return federal.scheduleA.line17.amount + saltAddBack
}

// ── Personal exemption credit computation ───────────────────────

function computePersonalExemptionCredit(
  model: TaxReturn,
  orAGI: number,
): { credit: number; count: number } {
  // Count exemptions: taxpayer + spouse (if MFJ) + dependents
  let count = 1
  if (model.filingStatus === 'mfj' || model.filingStatus === 'qw') {
    count += 1 // spouse
  }
  count += model.dependents.length

  const phaseoutThreshold = OR_EXEMPTION_PHASEOUT[model.filingStatus]

  // If AGI exceeds the phaseout threshold, reduce credit.
  // Simplified: the credit phases out by $1 per $2,500 (or fraction) over threshold.
  // Each exemption credit is $236, so full phaseout is at threshold + count * $236 * $2,500.
  // For simplicity in initial implementation: no credit if AGI > threshold.
  if (orAGI > phaseoutThreshold) {
    return { credit: 0, count }
  }

  const credit = count * OR_PERSONAL_EXEMPTION_CREDIT
  return { credit, count }
}

// ── Main computation ────────────────────────────────────────────

export function computeFormOR40(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormOR40Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeORApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── OR Additions ────────────────────────────────────────────
  // Currently no common additions implemented for typical W-2 filers.
  // Future: non-OR state/local bond interest, federal tax-exempt income
  //         taxable in OR
  const orAdditions = 0

  // ── OR Subtractions ─────────────────────────────────────────
  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Oregon taxes Social Security the same as federal — the federal
  // exclusion is already applied in form1040.line6b. No additional
  // state SS exemption.

  const orSubtractions = usGovInterest
  const orAGI = federalAGI + orAdditions - orSubtractions

  // ── Deductions ─────────────────────────────────────────────
  const standardDeduction = OR_STANDARD_DEDUCTION[model.filingStatus]
  const orItemizedDeduction = computeORItemized(model, form1040, orAGI)

  const deductionMethod: 'standard' | 'itemized' =
    orItemizedDeduction > standardDeduction ? 'itemized' : 'standard'
  const deductionUsed = Math.max(standardDeduction, orItemizedDeduction)

  // ── Taxable income ─────────────────────────────────────────
  const orTaxableIncome = Math.max(0, orAGI - deductionUsed)

  // ── Tax computation ────────────────────────────────────────
  const brackets = OR_TAX_BRACKETS[model.filingStatus]
  const fullYearTax = computeBracketTax(orTaxableIncome, brackets)
  const orTax = ratio < 1 ? Math.round(fullYearTax * ratio) : fullYearTax

  // ── Credits ────────────────────────────────────────────────
  // Personal exemption credit
  const { credit: personalExemptionCredit, count: personalExemptionCount } =
    computePersonalExemptionCredit(model, orAGI)

  // Oregon EITC: 12% of federal EITC (with children) or 9% (without)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const hasQualifyingChildren = (form1040.earnedIncomeCredit?.numQualifyingChildren ?? 0) > 0
  const eitcRate = hasQualifyingChildren
    ? OR_EITC_RATE_WITH_CHILDREN
    : OR_EITC_RATE_WITHOUT_CHILDREN
  const orEITC = Math.round(federalEITC * eitcRate)

  // Kicker credit (stubbed at $0)
  const kickerCredit = 0

  // OR EITC is refundable; personal exemption credit and kicker are non-refundable
  // For simplicity: personal exemption credit reduces tax; EITC is refundable
  const nonrefundableCredits = personalExemptionCredit + kickerCredit
  const refundableCredits = orEITC
  const totalCredits = nonrefundableCredits + refundableCredits

  // ── Tax after credits ──────────────────────────────────────
  const taxAfterNonrefundable = Math.max(0, orTax - nonrefundableCredits)
  const taxAfterCredits = taxAfterNonrefundable

  // ── Payments ───────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'OR' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + refundableCredits
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const orSourceIncome = ratio < 1 ? Math.round(orAGI * ratio) : undefined

  return {
    federalAGI,
    orAdditions,
    orSubtractions,
    orAGI,
    usGovInterest,
    standardDeduction,
    orItemizedDeduction,
    deductionUsed,
    deductionMethod,
    orTaxableIncome,
    orTax,
    personalExemptionCredit,
    personalExemptionCount,
    orEITC,
    kickerCredit,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    orSourceIncome,
  }
}
