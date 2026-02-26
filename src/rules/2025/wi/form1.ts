/**
 * Wisconsin Form 1 — Individual Income Tax Return (TY 2025)
 *
 * Computes WI state income tax for full-year residents, part-year
 * residents, and nonresidents. Starts from federal AGI and applies
 * WI-specific additions, subtractions, deductions, exemptions, and credits.
 *
 * Reference: WI DOR Form 1 Instructions, WI Statutes Chapter 71
 *
 * SCAFFOLD NOTES:
 *   - WI additions: not yet implemented (non-WI state/local bond
 *     interest, etc.).
 *   - WI subtractions: Social Security exemption (full), US government
 *     obligation interest.
 *   - WI standard deduction with income-based phase-out.
 *   - Personal exemptions ($700/person).
 *   - Credits: WI EITC (4%/11%/34% by # children of federal EITC),
 *     itemized deduction credit (5% of WI itemized deductions).
 *   - Part-year/nonresident apportionment by days in state.
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  WI_TAX_BRACKETS,
  WI_STANDARD_DEDUCTION_BASE,
  WI_STANDARD_DEDUCTION_PHASEOUT,
  WI_PERSONAL_EXEMPTION,
  WI_EITC_RATES,
  WI_ITEMIZED_DEDUCTION_CREDIT_RATE,
} from './constants'

// ── Result types ────────────────────────────────────────────────

export interface WIForm1Result {
  // Income
  federalAGI: number
  wiAdditions: number
  wiSubtractions: number
  wiAGI: number

  // Subtraction detail
  ssExemption: number
  usGovInterest: number

  // Deductions & Exemptions
  standardDeduction: number
  wiItemizedDeduction: number
  deductionUsed: number
  deductionMethod: 'standard' | 'itemized'
  personalExemptions: number
  numExemptions: number

  // Tax
  wiTaxableIncome: number
  wiTax: number

  // Credits
  wiEITC: number
  wiItemizedDeductionCredit: number
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
  wiSourceIncome?: number
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

// ── WI Standard Deduction with phase-out ────────────────────────

function computeWIStandardDeduction(
  filingStatus: TaxReturn['filingStatus'],
  wiAGI: number,
): number {
  const base = WI_STANDARD_DEDUCTION_BASE[filingStatus]
  const phaseout = WI_STANDARD_DEDUCTION_PHASEOUT[filingStatus]

  if (wiAGI <= phaseout.start) return base
  if (wiAGI >= phaseout.end) return 0

  // Linear phase-out: reduce proportionally between start and end
  const excessIncome = wiAGI - phaseout.start
  const phaseoutRange = phaseout.end - phaseout.start
  const reductionRatio = excessIncome / phaseoutRange
  const reduction = Math.round(base * reductionRatio)

  return Math.max(0, base - reduction)
}

// ── Apportionment ratio for part-year/nonresident ─────────────

function computeWIApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

// ── WI Itemized deduction computation ───────────────────────────

function computeWIItemized(
  model: TaxReturn,
  federal: Form1040Result,
): number {
  // If the taxpayer didn't itemize federally, no WI itemized deduction
  if (!federal.scheduleA || model.deductions.method !== 'itemized') return 0

  const itemized = model.deductions.itemized
  if (!itemized) return 0

  // WI allows the full SALT deduction (no federal $10K cap).
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

// ── Personal exemption count ────────────────────────────────────

function computeExemptionCount(model: TaxReturn): number {
  let count = 1 // taxpayer
  if (model.filingStatus === 'mfj' && model.spouse) {
    count += 1 // spouse
  }
  count += model.dependents.length
  return count
}

// ── Main computation ────────────────────────────────────────────

export function computeWIForm1(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): WIForm1Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeWIApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── WI Additions (Schedule I) ──────────────────────────────
  // Currently no common additions implemented for typical W-2 filers.
  // Future: non-WI state/local bond interest, certain federal
  // deductions WI doesn't conform to
  const wiAdditions = 0

  // ── WI Subtractions (Schedule I) ───────────────────────────
  // Social Security: WI fully exempts SS benefits for residents
  const ssExemption = form1040.line6b.amount

  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const wiSubtractions = ssExemption + usGovInterest
  const wiAGI = federalAGI + wiAdditions - wiSubtractions

  // ── Deductions ─────────────────────────────────────────────
  const standardDeduction = computeWIStandardDeduction(model.filingStatus, wiAGI)
  const wiItemizedDeduction = computeWIItemized(model, form1040)

  const deductionMethod: 'standard' | 'itemized' =
    wiItemizedDeduction > standardDeduction ? 'itemized' : 'standard'
  const deductionUsed = Math.max(standardDeduction, wiItemizedDeduction)

  // ── Personal Exemptions ────────────────────────────────────
  const numExemptions = computeExemptionCount(model)
  const personalExemptions = numExemptions * WI_PERSONAL_EXEMPTION

  // ── Taxable income ─────────────────────────────────────────
  const wiTaxableIncome = Math.max(0, wiAGI - deductionUsed - personalExemptions)

  // ── Tax computation ────────────────────────────────────────
  const brackets = WI_TAX_BRACKETS[model.filingStatus]
  const fullYearTax = computeBracketTax(wiTaxableIncome, brackets)
  const wiTax = ratio < 1 ? Math.round(fullYearTax * ratio) : fullYearTax

  // ── Credits ────────────────────────────────────────────────

  // WI EITC: percentage of federal EITC based on # qualifying children
  const eicResult = form1040.earnedIncomeCredit
  let wiEITC = 0
  if (eicResult && eicResult.eligible && eicResult.creditAmount > 0) {
    const numChildren = eicResult.numQualifyingChildren
    // 0 children = no WI EITC; 1 child = 4%; 2 = 11%; 3+ = 34%
    const rateKey = Math.min(numChildren, 3)
    const rate = WI_EITC_RATES[rateKey] ?? 0
    wiEITC = Math.round(eicResult.creditAmount * rate)
  }

  // WI Itemized deduction credit: 5% of WI itemized deductions
  let wiItemizedDeductionCredit = 0
  if (deductionMethod === 'itemized' && wiItemizedDeduction > 0) {
    wiItemizedDeductionCredit = Math.round(wiItemizedDeduction * WI_ITEMIZED_DEDUCTION_CREDIT_RATE)
  }

  // Total credits (WI EITC is refundable; itemized deduction credit is nonrefundable)
  const totalCredits = wiEITC + wiItemizedDeductionCredit

  // ── Tax after credits ──────────────────────────────────────
  // Nonrefundable credits reduce tax to zero, refundable credits can produce a refund
  const nonrefundableCredits = wiItemizedDeductionCredit
  const refundableCredits = wiEITC

  const taxAfterNonrefundable = Math.max(0, wiTax - nonrefundableCredits)
  const taxAfterCredits = Math.max(0, taxAfterNonrefundable - refundableCredits)
  const refundableExcess = Math.max(0, refundableCredits - taxAfterNonrefundable)

  // ── Payments ───────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'WI' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + refundableExcess
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const wiSourceIncome = ratio < 1 ? Math.round(wiAGI * ratio) : undefined

  return {
    federalAGI,
    wiAdditions,
    wiSubtractions,
    wiAGI,
    ssExemption,
    usGovInterest,
    standardDeduction,
    wiItemizedDeduction,
    deductionUsed,
    deductionMethod,
    personalExemptions,
    numExemptions,
    wiTaxableIncome,
    wiTax,
    wiEITC,
    wiItemizedDeductionCredit,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    wiSourceIncome,
  }
}
