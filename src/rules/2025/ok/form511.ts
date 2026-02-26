/**
 * Oklahoma Form 511 — Individual Income Tax Return (TY 2025)
 *
 * Computes OK state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * OK-specific additions, subtractions, exemptions, and deductions.
 *
 * Reference: Oklahoma Tax Commission Form 511 Instructions
 *            Oklahoma Statutes Title 68, Article 23
 *
 * SCAFFOLD NOTES:
 *   - OK additions: currently handles non-OK municipal bond interest
 *     (placeholder). Other additions not yet implemented.
 *   - OK subtractions: Social Security exemption (full), US government
 *     obligation interest, military retirement (full exemption).
 *   - OK uses federal standard deduction amounts.
 *   - Personal exemption: $1,000 per person.
 *   - Credits: OK EITC (5% of federal EITC, nonrefundable),
 *     OK child tax credit ($100/child).
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  OK_TAX_BRACKETS,
  OK_STANDARD_DEDUCTION,
  OK_PERSONAL_EXEMPTION,
  OK_EITC_RATE,
  OK_CHILD_TAX_CREDIT_PER_CHILD,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface Form511Result {
  // Income
  federalAGI: number
  okAdditions: number
  okSubtractions: number
  okAGI: number

  // Subtraction detail
  ssExemption: number
  usGovInterest: number
  militaryRetirement: number

  // Deductions & exemptions
  standardDeduction: number
  okItemizedDeduction: number
  deductionUsed: number
  deductionMethod: 'standard' | 'itemized'
  personalExemptions: number
  personalExemptionCount: number

  // Tax
  okTaxableIncome: number
  okTax: number

  // Credits
  okEITC: number
  okChildTaxCredit: number
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
  okSourceIncome?: number
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

function computeOKApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

// ── OK Itemized deduction computation ───────────────────────────

function computeOKItemized(
  model: TaxReturn,
  federal: Form1040Result,
): number {
  // If the taxpayer didn't itemize federally, no OK itemized deduction
  if (!federal.scheduleA || model.deductions.method !== 'itemized') return 0

  // OK follows federal Schedule A (including the $10K SALT cap for state purposes)
  return federal.scheduleA.line17.amount
}

// ── Military retirement detection ───────────────────────────────

function computeMilitaryRetirement(_model: TaxReturn): number {
  // 1099-R with distribution code 7 (normal distribution) from military sources
  // Simplified: look for 1099-Rs that are pensions/annuities (not IRA)
  // with certain payer names indicating military. For now, this is a
  // placeholder — users will need to flag military retirement specifically.
  // Oklahoma exempts all military retirement from state tax.
  return 0
}

// ── Main computation ────────────────────────────────────────────

export function computeForm511(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form511Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeOKApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── OK Additions ────────────────────────────────────────────
  // Non-OK municipal bond interest (tax-exempt interest from non-OK bonds)
  // Currently no common additions implemented for typical filers.
  const okAdditions = 0

  // ── OK Subtractions ─────────────────────────────────────────
  // Social Security: OK fully exempts SS benefits from state tax
  // line6b = taxable portion of SS included in federal AGI
  const ssExemption = form1040.line6b.amount

  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Military retirement (full exemption — placeholder)
  const militaryRetirement = computeMilitaryRetirement(model)

  const okSubtractions = ssExemption + usGovInterest + militaryRetirement
  const okAGI = federalAGI + okAdditions - okSubtractions

  // ── Deductions ─────────────────────────────────────────────
  // OK uses federal standard deduction amounts
  const standardDeduction = OK_STANDARD_DEDUCTION[model.filingStatus]
  const okItemizedDeduction = computeOKItemized(model, form1040)

  const deductionMethod: 'standard' | 'itemized' =
    okItemizedDeduction > standardDeduction ? 'itemized' : 'standard'
  const deductionUsed = Math.max(standardDeduction, okItemizedDeduction)

  // ── Personal exemptions ─────────────────────────────────────
  // $1,000 per person: taxpayer + spouse (if MFJ) + each dependent
  let personalExemptionCount = 1 // taxpayer
  if (model.filingStatus === 'mfj' && model.spouse) {
    personalExemptionCount += 1 // spouse
  }
  personalExemptionCount += model.dependents.length
  const personalExemptions = personalExemptionCount * OK_PERSONAL_EXEMPTION

  // ── Taxable income ─────────────────────────────────────────
  const okTaxableIncome = Math.max(0, okAGI - deductionUsed - personalExemptions)

  // ── Tax computation ────────────────────────────────────────
  const brackets = OK_TAX_BRACKETS[model.filingStatus]
  const fullYearTax = computeBracketTax(okTaxableIncome, brackets)
  const okTax = ratio < 1 ? Math.round(fullYearTax * ratio) : fullYearTax

  // ── Credits ────────────────────────────────────────────────
  // OK EITC: 5% of federal EITC (nonrefundable)
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const okEITCRaw = Math.round(federalEITC * OK_EITC_RATE)
  // Nonrefundable: cannot exceed tax
  const okEITC = Math.min(okEITCRaw, okTax)

  // OK child tax credit: $100 per qualifying child under age 17
  const taxYearEnd = new Date(model.taxYear, 11, 31)
  const qualifyingChildren = model.dependents.filter(dep => {
    if (!dep.dateOfBirth) return false
    const dob = new Date(dep.dateOfBirth)
    const age = taxYearEnd.getFullYear() - dob.getFullYear() -
      (taxYearEnd < new Date(taxYearEnd.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
    return age < 17
  }).length
  const okChildTaxCreditRaw = qualifyingChildren * OK_CHILD_TAX_CREDIT_PER_CHILD
  // Nonrefundable: cannot exceed remaining tax after EITC
  const remainingTaxAfterEITC = Math.max(0, okTax - okEITC)
  const okChildTaxCredit = Math.min(okChildTaxCreditRaw, remainingTaxAfterEITC)

  const totalCredits = okEITC + okChildTaxCredit

  // ── Tax after credits ──────────────────────────────────────
  const taxAfterCredits = Math.max(0, okTax - totalCredits)

  // ── Payments ───────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'OK' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const okSourceIncome = ratio < 1 ? Math.round(okAGI * ratio) : undefined

  return {
    federalAGI,
    okAdditions,
    okSubtractions,
    okAGI,
    ssExemption,
    usGovInterest,
    militaryRetirement,
    standardDeduction,
    okItemizedDeduction,
    deductionUsed,
    deductionMethod,
    personalExemptions,
    personalExemptionCount,
    okTaxableIncome,
    okTax,
    okEITC,
    okChildTaxCredit,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    okSourceIncome,
  }
}
