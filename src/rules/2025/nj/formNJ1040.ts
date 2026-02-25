/**
 * NJ-1040 — New Jersey Resident Income Tax Return
 *
 * Full-year resident computation, tax year 2025.
 * NJ computes gross income from source documents — NOT from federal AGI.
 *
 * Source: NJ Division of Taxation, NJ-1040 Instructions (2025)
 */

import type { FilingStatus, StateReturnConfig, TaxReturn } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeBracketTax } from '../taxComputation'
import {
  NJ_TAX_BRACKETS,
  NJ_EXEMPTION_REGULAR,
  NJ_EXEMPTION_AGE_65,
  NJ_EXEMPTION_BLIND_DISABLED,
  NJ_EXEMPTION_VETERAN,
  NJ_EXEMPTION_DEPENDENT_CHILD,
  NJ_EXEMPTION_COLLEGE_STUDENT,
  NJ_PENSION_EXCLUSION,
  NJ_PENSION_EXCLUSION_INCOME_LIMIT,
  NJ_PROPERTY_TAX_DEDUCTION_MAX,
  NJ_PROPERTY_TAX_CREDIT,
  NJ_RENT_PROPERTY_TAX_RATIO,
  NJ_MEDICAL_EXPENSE_FLOOR_RATE,
  NJ_EITC_RATE,
  NJ_CHILD_TAX_CREDIT_MAX,
  NJ_CHILD_TAX_CREDIT_INCOME_CAP,
} from './constants'

// ── Result interface ──────────────────────────────────────────

export interface NJ1040Result {
  residencyType: StateReturnConfig['residencyType']
  filingStatus: FilingStatus

  // Income (Lines 15–29)
  line15_wages: number
  line16a_taxableInterest: number
  line17_dividends: number
  line18_businessIncome: number
  line19_capitalGains: number
  line20a_pensions: number
  line20b_pensionExclusion: number
  line21_partnershipIncome: number
  line22_rentalIncome: number
  line25_otherIncome: number
  line27_totalIncome: number
  line28c_totalExclusions: number
  line29_njGrossIncome: number

  // Deductions & Exemptions (Lines 30–38)
  line30_propertyTaxDeduction: number
  line31_medicalExpenses: number
  line36_totalDeductions: number
  line37_exemptions: number
  line38_njTaxableIncome: number

  // Tax (Line 39)
  line39_njTax: number

  // Credits (Lines 40–48)
  line43_propertyTaxCredit: number
  line44_njEITC: number
  line45_njChildTaxCredit: number
  line48_totalCredits: number
  nonrefundableCredits: number
  refundableCredits: number

  // Balance (Lines 49–57)
  line49_taxAfterCredits: number
  line51_totalTaxDue: number
  line52_njWithholding: number
  line55_totalPayments: number
  line56_overpaid: number
  line57_amountOwed: number

  // Property tax strategy
  usedPropertyTaxDeduction: boolean
}

// ── NJ Gross Income ───────────────────────────────────────────

function computeNJGrossIncome(model: TaxReturn, federal: Form1040Result) {
  // Line 15 — Wages: prefer W-2 Box 16 (NJ state wages), fallback to Box 1
  const line15_wages = model.w2s.reduce((sum, w2) => {
    const isNJ = (w2.box15State ?? '').toUpperCase() === 'NJ'
    if (isNJ && w2.box16StateWages && w2.box16StateWages > 0) {
      return sum + w2.box16StateWages
    }
    // Fallback: use Box 1 for NJ W-2s with missing Box 16, or all W-2s if none tagged NJ
    if (isNJ || !w2.box15State) {
      return sum + w2.box1
    }
    return sum
  }, 0)

  // Line 16a — Taxable interest
  const line16a_taxableInterest = model.form1099INTs.reduce((sum, f) => sum + f.box1, 0)

  // Line 17 — Dividends (total ordinary — NJ doesn't distinguish qualified)
  const line17_dividends = model.form1099DIVs.reduce((sum, f) => sum + f.box1a, 0)

  // Line 18 — Business income (from Schedule C net profit, same as federal in Phase 1)
  const line18_businessIncome = federal.scheduleCResult
    ? federal.scheduleCResult.totalNetProfitCents
    : 0

  // Line 19 — Capital gains (from Schedule D, same as federal in Phase 1)
  // NJ taxes all capital gains as ordinary income
  const line19_capitalGains = federal.scheduleD
    ? federal.scheduleD.line16.amount
    : model.form1099DIVs.reduce((sum, f) => sum + f.box2a, 0)

  // Line 20a — Pensions (1099-R Box 2a taxable amount, exclude rollovers code G)
  const line20a_pensions = model.form1099Rs.reduce((sum, f) => {
    if (f.box7.includes('G')) return sum // rollover — exclude
    return sum + f.box2a
  }, 0)

  // Line 21 — Partnership/S-corp income (K-1 ordinary income)
  const line21_partnershipIncome = model.scheduleK1s.reduce(
    (sum, k1) => sum + k1.ordinaryIncome, 0,
  )

  // Line 22 — Rental income (Schedule E net, via Schedule 1 Line 5)
  const line22_rentalIncome = federal.schedule1
    ? federal.schedule1.line5.amount
    : 0

  // Line 25 — Other income (1099-MISC Box 3)
  const line25_otherIncome = model.form1099MISCs.reduce((sum, f) => sum + f.box3, 0)

  // Lines 23, 24, 26: not modeled in Phase 1, zero
  const line27_totalIncome = line15_wages + line16a_taxableInterest + line17_dividends
    + line18_businessIncome + line19_capitalGains + line20a_pensions
    + line21_partnershipIncome + line22_rentalIncome + line25_otherIncome

  return {
    line15_wages,
    line16a_taxableInterest,
    line17_dividends,
    line18_businessIncome,
    line19_capitalGains,
    line20a_pensions,
    line21_partnershipIncome,
    line22_rentalIncome,
    line25_otherIncome,
    line27_totalIncome,
  }
}

// ── Pension Exclusion ────────────────────────────────────────

function computePensionExclusion(
  pensionIncome: number,
  njGrossIncomePreExclusion: number,
  filingStatus: FilingStatus,
): number {
  if (pensionIncome <= 0) return 0
  // Income eligibility check
  if (njGrossIncomePreExclusion > NJ_PENSION_EXCLUSION_INCOME_LIMIT[filingStatus]) return 0
  return Math.min(pensionIncome, NJ_PENSION_EXCLUSION[filingStatus])
}

// ── Deductions ───────────────────────────────────────────────

function computePropertyTaxAmount(config: StateReturnConfig): number {
  if (config.njIsHomeowner && config.njPropertyTaxPaid && config.njPropertyTaxPaid > 0) {
    return Math.min(config.njPropertyTaxPaid, NJ_PROPERTY_TAX_DEDUCTION_MAX)
  }
  if (!config.njIsHomeowner && config.njRentPaid && config.njRentPaid > 0) {
    const deemedTax = Math.round(config.njRentPaid * NJ_RENT_PROPERTY_TAX_RATIO)
    return Math.min(deemedTax, NJ_PROPERTY_TAX_DEDUCTION_MAX)
  }
  return 0
}

function computeMedicalExpenseDeduction(model: TaxReturn, njGrossIncome: number): number {
  const medical = model.deductions.itemized?.medicalExpenses ?? 0
  if (medical <= 0) return 0
  const floor = Math.round(njGrossIncome * NJ_MEDICAL_EXPENSE_FLOOR_RATE)
  return Math.max(0, medical - floor)
}

// ── Exemptions ───────────────────────────────────────────────

function computeExemptions(
  model: TaxReturn,
  filingStatus: FilingStatus,
  config: StateReturnConfig,
): number {
  let total = 0

  // Self exemption
  total += NJ_EXEMPTION_REGULAR

  // Spouse exemption (MFJ)
  if (filingStatus === 'mfj') total += NJ_EXEMPTION_REGULAR

  // Age 65+ (taxpayer)
  if (model.deductions.taxpayerAge65) total += NJ_EXEMPTION_AGE_65

  // Age 65+ (spouse, MFJ)
  if (filingStatus === 'mfj' && model.deductions.spouseAge65) total += NJ_EXEMPTION_AGE_65

  // Blind/disabled (taxpayer)
  if (config.njTaxpayerBlindDisabled) total += NJ_EXEMPTION_BLIND_DISABLED

  // Blind/disabled (spouse)
  if (config.njSpouseBlindDisabled) total += NJ_EXEMPTION_BLIND_DISABLED

  // Veteran (taxpayer)
  if (config.njTaxpayerVeteran) total += NJ_EXEMPTION_VETERAN

  // Veteran (spouse)
  if (config.njSpouseVeteran) total += NJ_EXEMPTION_VETERAN

  // Dependents
  total += model.dependents.length * NJ_EXEMPTION_DEPENDENT_CHILD

  // College student dependents (additional $1,000 each)
  // Prefer per-dependent checkbox IDs; fall back to manual numeric count
  const collegeStudentIds = config.njDependentCollegeStudents ?? []
  const collegeStudentCount = collegeStudentIds.length > 0
    ? collegeStudentIds.length
    : (config.njCollegeStudentDependentCount ?? 0)
  total += collegeStudentCount * NJ_EXEMPTION_COLLEGE_STUDENT

  return total
}

// ── Credits ──────────────────────────────────────────────────

function computeNJEITC(federal: Form1040Result): number {
  if (!federal.earnedIncomeCredit) return 0
  const federalEITC = federal.earnedIncomeCredit.creditAmount
  if (federalEITC <= 0) return 0
  return Math.round(federalEITC * NJ_EITC_RATE)
}

function computeNJChildTaxCredit(
  model: TaxReturn,
  njGrossIncome: number,
): number {
  if (njGrossIncome > NJ_CHILD_TAX_CREDIT_INCOME_CAP) return 0

  const taxYear = model.taxYear
  let qualifyingChildren = 0
  for (const dep of model.dependents) {
    if (!dep.dateOfBirth) continue
    const birthYear = parseInt(dep.dateOfBirth.split('-')[0], 10)
    if (isNaN(birthYear)) continue
    const age = taxYear - birthYear
    if (age <= 5) qualifyingChildren++
  }

  return qualifyingChildren * NJ_CHILD_TAX_CREDIT_MAX
}

// ── NJ Withholding ───────────────────────────────────────────

function computeStateWithholding(model: TaxReturn): number {
  return model.w2s.reduce((sum, w2) => {
    if ((w2.box15State ?? '').toUpperCase() === 'NJ') {
      return sum + (w2.box17StateIncomeTax ?? 0)
    }
    return sum
  }, 0)
}

// ── Main Orchestrator ────────────────────────────────────────

export function computeNJ1040(
  model: TaxReturn,
  federal: Form1040Result,
  config: StateReturnConfig,
): NJ1040Result {
  const filingStatus = model.filingStatus

  // ── Income (Lines 15–29) ──────────────────────────────────
  const income = computeNJGrossIncome(model, federal)

  // Pension exclusion (Line 20b)
  const line20b_pensionExclusion = computePensionExclusion(
    income.line20a_pensions,
    income.line27_totalIncome,
    filingStatus,
  )

  // Total exclusions (Line 28c): pension exclusion only in Phase 1
  // Social Security is fully exempt — never enters Line 27
  const line28c_totalExclusions = line20b_pensionExclusion

  // NJ Gross Income (Line 29)
  const line29_njGrossIncome = Math.max(0, income.line27_totalIncome - line28c_totalExclusions)

  // ── Deductions (Lines 30–36) ──────────────────────────────
  const propertyTaxAmount = computePropertyTaxAmount(config)

  // Auto-optimize: compare deduction benefit vs $50 credit
  // Deduction benefit ≈ marginal rate × deduction amount
  // For simplicity: use deduction if property tax > ~$800 (breakeven at ~6.37% rate)
  // More precisely: use deduction if it's worth more than $50
  const usedPropertyTaxDeduction = propertyTaxAmount > 0 && propertyTaxAmount >= NJ_PROPERTY_TAX_CREDIT

  const line30_propertyTaxDeduction = usedPropertyTaxDeduction ? propertyTaxAmount : 0
  const line31_medicalExpenses = computeMedicalExpenseDeduction(model, line29_njGrossIncome)

  const line36_totalDeductions = line30_propertyTaxDeduction + line31_medicalExpenses

  // ── Exemptions (Line 37) ──────────────────────────────────
  const line37_exemptions = computeExemptions(model, filingStatus, config)

  // ── Taxable Income (Line 38) ──────────────────────────────
  const line38_njTaxableIncome = Math.max(0, line29_njGrossIncome - line36_totalDeductions - line37_exemptions)

  // ── Tax (Line 39) ─────────────────────────────────────────
  const line39_njTax = computeBracketTax(line38_njTaxableIncome, NJ_TAX_BRACKETS[filingStatus])

  // ── Credits (Lines 40–48) ─────────────────────────────────
  // Nonrefundable credits (capped at line 39)
  // Line 40: credit for other jurisdictions — Phase 1: zero
  const nonrefundableCredits = 0

  // Refundable credits
  const line43_propertyTaxCredit = !usedPropertyTaxDeduction && propertyTaxAmount > 0
    ? NJ_PROPERTY_TAX_CREDIT
    : 0
  const line44_njEITC = computeNJEITC(federal)
  const line45_njChildTaxCredit = computeNJChildTaxCredit(model, line29_njGrossIncome)
  const refundableCredits = line43_propertyTaxCredit + line44_njEITC + line45_njChildTaxCredit

  const line48_totalCredits = nonrefundableCredits + refundableCredits

  // ── Balance (Lines 49–57) ─────────────────────────────────
  const line49_taxAfterCredits = Math.max(0, line39_njTax - nonrefundableCredits)
  const line51_totalTaxDue = line49_taxAfterCredits
  const line52_njWithholding = computeStateWithholding(model)
  const line55_totalPayments = line52_njWithholding + refundableCredits
  const line56_overpaid = Math.max(0, line55_totalPayments - line51_totalTaxDue)
  const line57_amountOwed = Math.max(0, line51_totalTaxDue - line55_totalPayments)

  return {
    residencyType: config.residencyType,
    filingStatus,

    line15_wages: income.line15_wages,
    line16a_taxableInterest: income.line16a_taxableInterest,
    line17_dividends: income.line17_dividends,
    line18_businessIncome: income.line18_businessIncome,
    line19_capitalGains: income.line19_capitalGains,
    line20a_pensions: income.line20a_pensions,
    line20b_pensionExclusion,
    line21_partnershipIncome: income.line21_partnershipIncome,
    line22_rentalIncome: income.line22_rentalIncome,
    line25_otherIncome: income.line25_otherIncome,
    line27_totalIncome: income.line27_totalIncome,
    line28c_totalExclusions,
    line29_njGrossIncome,

    line30_propertyTaxDeduction,
    line31_medicalExpenses,
    line36_totalDeductions,
    line37_exemptions,
    line38_njTaxableIncome,

    line39_njTax,

    line43_propertyTaxCredit,
    line44_njEITC,
    line45_njChildTaxCredit,
    line48_totalCredits,
    nonrefundableCredits,
    refundableCredits,

    line49_taxAfterCredits,
    line51_totalTaxDue,
    line52_njWithholding,
    line55_totalPayments,
    line56_overpaid,
    line57_amountOwed,

    usedPropertyTaxDeduction,
  }
}
