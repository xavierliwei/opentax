/**
 * Idaho Form 40 — Individual Income Tax Return
 *
 * Idaho starts from federal taxable income (Form 1040 Line 15), applies
 * additions and subtractions, and applies a flat 5.695% rate.
 *
 * Key features:
 * - Flat 5.695% tax rate (2025 — reduced from 5.8% in 2023)
 * - Starts from federal taxable income (Line 15), NOT AGI
 * - No separate standard deduction — federal deduction already embedded in Line 15
 * - Social Security partial exemption (AGI-based)
 * - Grocery credit: $100/person ($120 if 65+) — refundable
 * - Child tax credit: $205 per qualifying child (new for 2025)
 * - US government obligation interest subtraction
 */

import type { TaxReturn, StateReturnConfig, FilingStatus } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  ID_FLAT_TAX_RATE,
  ID_GROCERY_CREDIT_STANDARD,
  ID_GROCERY_CREDIT_AGE_65,
  ID_CHILD_TAX_CREDIT_PER_CHILD,
  ID_SS_AGI_THRESHOLD_SINGLE,
  ID_SS_AGI_THRESHOLD_MFJ,
  ID_SS_EXEMPTION_MAX_SINGLE,
  ID_SS_EXEMPTION_MAX_MFJ,
} from './constants'

export interface Form40Result {
  /** Federal taxable income (Form 1040 Line 15) — ID starting point */
  federalTaxableIncome: number
  /** Federal AGI (for reference / SS exemption threshold) */
  federalAGI: number

  // ── Additions ──────────────────────────────────────────────────
  idAdditions: number
  stateLocalTaxRefundAddition: number     // State/local tax refund (1099-G Box 2) if itemized

  // ── Subtractions ───────────────────────────────────────────────
  idSubtractions: number
  usGovInterestSubtraction: number        // US government obligation interest
  socialSecuritySubtraction: number       // Idaho SS partial exemption

  // ── Idaho Taxable Income & Tax ─────────────────────────────────
  idTaxableIncome: number
  idTax: number                           // flat 5.695%

  // ── Credits ────────────────────────────────────────────────────
  idChildTaxCredit: number                // $205 per qualifying child (nonrefundable)
  groceryCredit: number                   // $100/person ($120 if 65+) — refundable
  totalNonrefundableCredits: number
  totalRefundableCredits: number
  taxAfterCredits: number

  // ── Withholding & Payments ─────────────────────────────────────
  stateWithholding: number
  totalPayments: number

  // ── Result ─────────────────────────────────────────────────────
  overpaid: number
  amountOwed: number

  // ── Residency / Apportionment ──────────────────────────────────
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  idSourceIncome?: number
}

// ── Apportionment ─────────────────────────────────────────────────

export function computeIDApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

// ── Age helper ──────────────────────────────────────────────────

function ageAtEndOfYear(dateOfBirth: string | undefined, taxYear: number): number {
  if (!dateOfBirth) return 0
  const [y, m, d] = dateOfBirth.split('-').map(Number)
  if (!y || !m || !d) return 0
  const endOfYear = new Date(taxYear, 11, 31)
  const birth = new Date(y, m - 1, d)
  let age = endOfYear.getFullYear() - birth.getFullYear()
  if (
    endOfYear.getMonth() < birth.getMonth() ||
    (endOfYear.getMonth() === birth.getMonth() && endOfYear.getDate() < birth.getDate())
  ) {
    age--
  }
  return age
}

// ── Social Security exemption helper ────────────────────────────

function ssAGIThreshold(filingStatus: FilingStatus): number {
  if (filingStatus === 'mfj' || filingStatus === 'qw') return ID_SS_AGI_THRESHOLD_MFJ
  return ID_SS_AGI_THRESHOLD_SINGLE
}

function ssExemptionMax(filingStatus: FilingStatus): number {
  if (filingStatus === 'mfj' || filingStatus === 'qw') return ID_SS_EXEMPTION_MAX_MFJ
  return ID_SS_EXEMPTION_MAX_SINGLE
}

// ── Main computation ──────────────────────────────────────────────

export function computeForm40(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form40Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeIDApportionmentRatio(config, model.taxYear) : 1

  // ── Starting point: Federal Taxable Income (1040 Line 15) ─────
  const federalTaxableIncome = form1040.line15.amount
  const federalAGI = form1040.line11.amount

  // ── ID Additions ──────────────────────────────────────────────
  // State/local income tax refund (1099-G Box 2) if taxpayer itemized last year
  // This refund is already in federal AGI but since ID starts from Line 15,
  // we only add it back if the deduction was taken federally and passed through
  // In practice this is usually $0 for most filers starting from Line 15.
  // Following the same pattern as SC — only add if itemized last year.
  const stateLocalTaxRefundAddition = (model.priorYear?.itemizedLastYear ?? false)
    ? model.form1099Gs.reduce((sum, g) => sum + g.box2, 0)
    : 0

  const idAdditions = stateLocalTaxRefundAddition

  // ── ID Subtractions ───────────────────────────────────────────

  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterestSubtraction = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Social Security partial exemption
  // Idaho partially exempts Social Security for those under the AGI thresholds.
  // Taxpayers with AGI under $75K (single) / $100K (MFJ) can exempt up to
  // $34,332 (single) / $68,664 (MFJ) of Social Security benefits.
  const taxableSS = form1040.line6b.amount
  let socialSecuritySubtraction = 0
  if (taxableSS > 0) {
    const threshold = ssAGIThreshold(model.filingStatus)
    if (federalAGI <= threshold) {
      const maxExemption = ssExemptionMax(model.filingStatus)
      socialSecuritySubtraction = Math.min(taxableSS, maxExemption)
    }
  }

  const idSubtractions = usGovInterestSubtraction + socialSecuritySubtraction

  // ── Idaho Taxable Income ──────────────────────────────────────
  const idTaxableIncomeBeforeApportion = Math.max(0, federalTaxableIncome + idAdditions - idSubtractions)

  // Apply apportionment for part-year/nonresident
  const idTaxableIncome = ratio < 1
    ? Math.round(idTaxableIncomeBeforeApportion * ratio)
    : idTaxableIncomeBeforeApportion

  // ── Idaho Tax (5.695% flat rate) ──────────────────────────────
  const idTax = Math.round(idTaxableIncome * ID_FLAT_TAX_RATE)

  // ── Credits ───────────────────────────────────────────────────

  // Idaho Child Tax Credit: $205 per qualifying child (nonrefundable)
  const numQualifyingChildren = form1040.childTaxCredit?.numQualifyingChildren ?? 0
  const idChildTaxCredit = numQualifyingChildren * ID_CHILD_TAX_CREDIT_PER_CHILD

  // Nonrefundable credits cannot exceed tax
  const totalNonrefundableCredits = Math.min(idChildTaxCredit, idTax)

  // Tax after nonrefundable credits
  const taxAfterNonrefundable = Math.max(0, idTax - totalNonrefundableCredits)

  // Idaho Grocery Credit (refundable)
  // $100 per person (taxpayer, spouse, dependents)
  // $120 per person aged 65 or older
  const taxpayerAge = ageAtEndOfYear(model.taxpayer.dateOfBirth, model.taxYear)
  const taxpayerGrocery = taxpayerAge >= 65 ? ID_GROCERY_CREDIT_AGE_65 : ID_GROCERY_CREDIT_STANDARD

  let spouseGrocery = 0
  if ((model.filingStatus === 'mfj' || model.filingStatus === 'qw') && model.spouse) {
    const spouseAge = ageAtEndOfYear(model.spouse.dateOfBirth, model.taxYear)
    spouseGrocery = spouseAge >= 65 ? ID_GROCERY_CREDIT_AGE_65 : ID_GROCERY_CREDIT_STANDARD
  }

  const dependentGrocery = model.dependents.length * ID_GROCERY_CREDIT_STANDARD
  const groceryCredit = taxpayerGrocery + spouseGrocery + dependentGrocery

  const totalRefundableCredits = groceryCredit

  // Tax after all credits (nonrefundable already applied; refundable can create refund)
  const taxAfterCredits = taxAfterNonrefundable

  // ── Withholding ───────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'ID' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding + totalRefundableCredits

  // ── Result ────────────────────────────────────────────────────
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const idSourceIncome = ratio < 1 ? Math.round(idTaxableIncomeBeforeApportion * ratio) : undefined

  return {
    federalTaxableIncome,
    federalAGI,

    idAdditions,
    stateLocalTaxRefundAddition,

    idSubtractions,
    usGovInterestSubtraction,
    socialSecuritySubtraction,

    idTaxableIncome,
    idTax,

    idChildTaxCredit,
    groceryCredit,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,

    stateWithholding,
    totalPayments,

    overpaid,
    amountOwed,

    residencyType,
    apportionmentRatio: ratio,
    idSourceIncome,
  }
}
