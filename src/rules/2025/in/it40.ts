/**
 * Indiana Form IT-40 — Individual Income Tax Return
 *
 * Main computation for Indiana state income tax.
 * Indiana uses a flat 3.05% rate on Indiana AGI after exemptions.
 * Unique feature: county income taxes are filed on the state IT-40.
 *
 * Source: 2025 IT-40 Instructions (Indiana Department of Revenue)
 * All amounts in integer cents.
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  IN_TAX_RATE,
  IN_PERSONAL_EXEMPTION,
  IN_DEPENDENT_EXEMPTION,
  IN_AGE65_EXEMPTION,
  IN_BLIND_EXEMPTION,
  IN_EITC_RATE,
  IN_529_DEDUCTION_MAX,
  IN_ELDERLY_CREDIT_SINGLE,
  IN_ELDERLY_CREDIT_MFJ,
  IN_ELDERLY_CREDIT_AGI_LIMIT,
  IN_COUNTY_TAX_RATE_DEFAULT,
} from './constants'

// ── Result type ──────────────────────────────────────────────

export interface IT40Result {
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number

  // Income
  federalAGI: number

  // Additions to income
  stateLocalTaxAddBack: number   // SALT add-back (if itemized federally)
  totalAdditions: number

  // Indiana AGI
  inAGI: number

  // Subtractions / Exemptions
  ssExemption: number            // Social Security exemption
  usGovInterest: number          // US government bond interest
  rentersDeduction: number       // Renter's deduction ($3,000 max)
  contributions529: number       // IN 529 plan deduction ($5,000 max)
  personalExemptions: number     // $1,000 per person
  dependentExemptions: number    // $1,500 per dependent
  age65Exemptions: number        // Additional $1,000 for age 65+
  blindExemptions: number        // Additional $1,000 for blind
  totalExemptions: number
  totalSubtractions: number

  // Tax computation
  inTaxableIncome: number
  inTax: number                  // State tax at 3.05%

  // County tax (stub)
  countyTaxableIncome: number
  countyTaxRate: number
  countyTax: number

  // Credits
  inEITC: number                 // 10% of federal EITC
  elderlyCreditAmount: number    // Unified tax credit for elderly
  otherStateCredit: number       // Credit for taxes paid to other states
  totalCredits: number
  taxAfterCredits: number

  // Payments
  stateWithholding: number
  countyWithholding: number
  totalPayments: number

  // Result
  overpaid: number
  amountOwed: number

  // Part-year / nonresident
  inSourceIncome?: number
}

// ── Helpers ──────────────────────────────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Compute part-year apportionment ratio (days in IN / days in year).
 * Returns 1.0 for full-year, 0.0 for nonresident (nonresidents use
 * actual IN-source income instead).
 */
export function computeINApportionmentRatio(
  config: StateReturnConfig,
  taxYear: number,
): number {
  if (config.residencyType === 'full-year') return 1.0
  if (config.residencyType === 'nonresident') return 0.0

  const daysInYear = isLeapYear(taxYear) ? 366 : 365
  const yearStartMs = Date.UTC(taxYear, 0, 1)
  const yearEndMs = Date.UTC(taxYear, 11, 31)
  const MS_PER_DAY = 86400000

  let startMs = yearStartMs
  let endMs = yearEndMs

  if (config.moveInDate) {
    const parts = config.moveInDate.split('-').map(Number)
    if (parts.length === 3) {
      const ms = Date.UTC(parts[0], parts[1] - 1, parts[2])
      if (!isNaN(ms)) startMs = ms
    }
  }
  if (config.moveOutDate) {
    const parts = config.moveOutDate.split('-').map(Number)
    if (parts.length === 3) {
      const ms = Date.UTC(parts[0], parts[1] - 1, parts[2])
      if (!isNaN(ms)) endMs = ms
    }
  }

  if (startMs < yearStartMs) startMs = yearStartMs
  if (endMs > yearEndMs) endMs = yearEndMs
  if (endMs < startMs) return 0

  const daysInState = Math.round((endMs - startMs) / MS_PER_DAY) + 1
  return Math.min(1.0, Math.max(0, daysInState / daysInYear))
}

/**
 * Count personal exemptions: $1,000 per taxpayer (+ spouse for MFJ).
 */
function computePersonalExemptions(model: TaxReturn): number {
  let count = 1  // taxpayer
  if (model.filingStatus === 'mfj' && model.spouse) {
    count += 1   // spouse
  }
  return count * IN_PERSONAL_EXEMPTION
}

/**
 * Count dependent exemptions: $1,500 per dependent.
 */
function computeDependentExemptions(model: TaxReturn): number {
  return model.dependents.length * IN_DEPENDENT_EXEMPTION
}

/**
 * Additional age 65+ exemptions: $1,000 each for taxpayer/spouse.
 */
function computeAge65Exemptions(model: TaxReturn): number {
  let amount = 0
  if (model.deductions.taxpayerAge65) amount += IN_AGE65_EXEMPTION
  if (model.filingStatus === 'mfj' && model.deductions.spouseAge65) {
    amount += IN_AGE65_EXEMPTION
  }
  return amount
}

/**
 * Additional blind exemptions: $1,000 each for taxpayer/spouse.
 */
function computeBlindExemptions(model: TaxReturn): number {
  let amount = 0
  if (model.deductions.taxpayerBlind) amount += IN_BLIND_EXEMPTION
  if (model.filingStatus === 'mfj' && model.deductions.spouseBlind) {
    amount += IN_BLIND_EXEMPTION
  }
  return amount
}

/**
 * Sum IN withholding from all W-2s where Box 15 = "IN".
 */
function sumINWithholding(model: TaxReturn): number {
  return model.w2s.reduce((sum, w) => {
    if (w.box15State === 'IN') return sum + (w.box17StateIncomeTax ?? 0)
    return sum
  }, 0)
}

/**
 * Sum county withholding from W-2s (Box 19 local income tax when Box 15 = "IN").
 */
function sumCountyWithholding(model: TaxReturn): number {
  return model.w2s.reduce((sum, w) => {
    if (w.box15State === 'IN') return sum + (w.box19LocalIncomeTax ?? 0)
    return sum
  }, 0)
}

/**
 * Compute IN EITC: 10% of federal EITC.
 */
function computeINEITC(federal: Form1040Result): number {
  if (!federal.earnedIncomeCredit || !federal.earnedIncomeCredit.eligible) return 0
  return Math.round(federal.earnedIncomeCredit.creditAmount * IN_EITC_RATE)
}

/**
 * Unified tax credit for the elderly.
 * $100 single / $200 MFJ if AGI <= $10,000 and age 65+.
 */
function computeElderlyCredit(
  model: TaxReturn,
  inAGI: number,
): number {
  if (inAGI > IN_ELDERLY_CREDIT_AGI_LIMIT) return 0

  const taxpayerAge65 = model.deductions.taxpayerAge65
  const spouseAge65 = model.filingStatus === 'mfj' && model.deductions.spouseAge65

  if (!taxpayerAge65 && !spouseAge65) return 0

  if (model.filingStatus === 'mfj') {
    return IN_ELDERLY_CREDIT_MFJ
  }
  return IN_ELDERLY_CREDIT_SINGLE
}

/**
 * Renter's deduction: lesser of rent paid or $3,000.
 * Indiana allows renters to deduct up to $3,000 of rent paid on their
 * principal place of residence in Indiana.
 */
function computeRentersDeduction(config: StateReturnConfig): number {
  // Renter's deduction is not yet modeled in StateReturnConfig for IN.
  // Return 0 until the UI is extended with an IN-specific rent field.
  // When added, it would be: Math.min(config.inRentPaid ?? 0, IN_RENTER_DEDUCTION_MAX)
  void config
  return 0
}

/**
 * Indiana 529 plan deduction: up to $5,000 per contributor.
 */
function compute529Deduction(config: StateReturnConfig): number {
  const contributed = config.contributions529 ?? 0
  if (contributed <= 0) return 0
  return Math.min(contributed, IN_529_DEDUCTION_MAX)
}

// ── Main computation ────────────────────────────────────────

export function computeIT40(
  model: TaxReturn,
  federal: Form1040Result,
  config: StateReturnConfig,
): IT40Result {
  const residencyType = config.residencyType
  const ratio = computeINApportionmentRatio(config, model.taxYear)

  // ── Step 1: Start from federal AGI ─────────────────────────
  const federalAGI = federal.line11.amount

  // ── Step 2: Additions to income ────────────────────────────
  // Add back state/local income tax deduction if itemized federally
  const stateLocalTaxAddBack = model.deductions.method === 'itemized'
    ? (model.deductions.itemized?.stateLocalIncomeTaxes ?? 0)
    : 0

  const totalAdditions = stateLocalTaxAddBack

  // ── Step 3: Indiana AGI ────────────────────────────────────
  const inAGI = federalAGI + totalAdditions

  // ── Step 4: Subtractions & Exemptions ──────────────────────
  // Social Security exemption: IN fully exempts SS income
  const ssExemption = federal.line6b.amount

  // US government obligation interest (Treasury bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Renter's deduction
  const rentersDeduction = computeRentersDeduction(config)

  // 529 deduction
  const contributions529 = compute529Deduction(config)

  // Personal exemptions
  const personalExemptions = computePersonalExemptions(model)
  const dependentExemptions = computeDependentExemptions(model)
  const age65Exemptions = computeAge65Exemptions(model)
  const blindExemptions = computeBlindExemptions(model)
  const totalExemptions = personalExemptions + dependentExemptions + age65Exemptions + blindExemptions

  const totalSubtractions = ssExemption + usGovInterest + rentersDeduction + contributions529 + totalExemptions

  // ── Step 5: Taxable income ─────────────────────────────────
  const inTaxableIncome = Math.max(0, inAGI - totalSubtractions)

  // ── Step 6: State tax ──────────────────────────────────────
  let inTax = Math.round(inTaxableIncome * IN_TAX_RATE)

  // Part-year apportionment
  if (residencyType === 'part-year') {
    inTax = Math.round(inTax * ratio)
  }

  // ── Step 7: County tax (stub) ──────────────────────────────
  const countyTaxableIncome = inTaxableIncome
  const countyTaxRate = IN_COUNTY_TAX_RATE_DEFAULT
  let countyTax = Math.round(countyTaxableIncome * countyTaxRate)
  if (residencyType === 'part-year') {
    countyTax = Math.round(countyTax * ratio)
  }

  // ── Step 8: Credits ────────────────────────────────────────
  const inEITC = computeINEITC(federal)
  const elderlyCreditAmount = computeElderlyCredit(model, inAGI)
  const otherStateCredit = 0  // Stub — credit for taxes paid to other states

  const totalCredits = inEITC + elderlyCreditAmount + otherStateCredit

  // IN EITC is refundable, elderly credit is nonrefundable
  // For simplicity in this initial version, apply all credits against tax
  const taxAfterCredits = Math.max(0, inTax + countyTax - totalCredits)

  // ── Step 9: Withholding & payments ─────────────────────────
  const stateWithholding = sumINWithholding(model)
  const countyWithholding = sumCountyWithholding(model)
  const totalPayments = stateWithholding + countyWithholding

  // ── Step 10: Refund or owed ────────────────────────────────
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const inSourceIncome = ratio < 1 ? Math.round(inAGI * ratio) : undefined

  return {
    residencyType,
    apportionmentRatio: ratio,
    federalAGI,
    stateLocalTaxAddBack,
    totalAdditions,
    inAGI,
    ssExemption,
    usGovInterest,
    rentersDeduction,
    contributions529,
    personalExemptions,
    dependentExemptions,
    age65Exemptions,
    blindExemptions,
    totalExemptions,
    totalSubtractions,
    inTaxableIncome,
    inTax,
    countyTaxableIncome,
    countyTaxRate,
    countyTax,
    inEITC,
    elderlyCreditAmount,
    otherStateCredit,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    countyWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    inSourceIncome,
  }
}
