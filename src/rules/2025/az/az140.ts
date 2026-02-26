/**
 * Arizona Form 140 — Resident Personal Income Tax Return
 *
 * Arizona imposes a flat 2.5% tax on Arizona taxable income.
 * Starting point is federal AGI, with Arizona-specific additions
 * and subtractions to arrive at Arizona AGI.
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  AZ_FLAT_TAX_RATE,
  AZ_STANDARD_DEDUCTION,
  AZ_DEPENDENT_EXEMPTION,
  AZ_FAMILY_TAX_CREDIT_AGI_LIMIT,
  AZ_FAMILY_TAX_CREDIT,
} from './constants'

export interface Form140Result {
  federalAGI: number

  // Additions to federal AGI
  additions: number
  nonAZMunicipalInterest: number
  previouslyDeductedAZTaxes: number

  // Subtractions from federal AGI
  subtractions: number
  usGovInterest: number
  azStateRefundIncluded: number
  socialSecurityExemption: number

  // Arizona AGI
  azAGI: number

  // Deductions
  standardDeduction: number
  dependentExemption: number
  azTaxableIncome: number

  // Tax
  azTax: number

  // Credits
  familyTaxCredit: number
  totalCredits: number
  taxAfterCredits: number

  // Payments
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number

  // Part-year/nonresident
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  azSourceIncome?: number
}

// ── Apportionment ratio ─────────────────────────────────────────

export function computeAZApportionmentRatio(
  config: StateReturnConfig,
  taxYear: number,
): number {
  if (config.residencyType === 'full-year') return 1.0
  if (config.residencyType === 'nonresident') return 0.0

  // part-year: compute from move-in / move-out dates
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

  // Clamp to tax year boundaries
  if (startMs < yearStartMs) startMs = yearStartMs
  if (endMs > yearEndMs) endMs = yearEndMs

  if (endMs < startMs) return 0

  // +1 because both start and end dates are inclusive
  const daysInState = Math.round((endMs - startMs) / MS_PER_DAY) + 1

  return Math.min(1.0, Math.max(0, daysInState / daysInYear))
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// ── Main computation ─────────────────────────────────────────────

export function computeForm140(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form140Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeAZApportionmentRatio(config, model.taxYear)
    : 1.0

  const federalAGI = form1040.line11.amount

  // ── AZ Additions ──────────────────────────────────────────────
  // Non-Arizona municipal bond interest (tax-exempt for federal but
  // Arizona only exempts AZ municipal interest)
  // We approximate by treating all tax-exempt interest as non-AZ
  // (user would need to manually exclude AZ muni bonds — most won't have any)
  const nonAZMunicipalInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box8, 0,
  )

  // Previously deducted AZ income taxes: if filer itemized federally
  // and deducted state/local income taxes, AZ requires an add-back
  const previouslyDeductedAZTaxes = model.deductions.method === 'itemized'
    ? (model.deductions.itemized?.stateLocalIncomeTaxes ?? 0)
    : 0

  const additions = nonAZMunicipalInterest + previouslyDeductedAZTaxes

  // ── AZ Subtractions ───────────────────────────────────────────
  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // AZ state tax refund included in federal AGI (Form 1099-G Box 2)
  const azStateRefundIncluded = model.form1099Gs.reduce(
    (sum, g) => sum + g.box2, 0,
  )

  // Social Security benefits — fully exempt in Arizona
  const socialSecurityExemption = form1040.line6b.amount

  const subtractions = usGovInterest + azStateRefundIncluded + socialSecurityExemption

  // ── Arizona AGI ───────────────────────────────────────────────
  const azAGI = federalAGI + additions - subtractions

  // ── Deductions ────────────────────────────────────────────────
  const standardDeduction = AZ_STANDARD_DEDUCTION[model.filingStatus]
  const dependentExemption = model.dependents.length * AZ_DEPENDENT_EXEMPTION

  const azTaxableIncome = Math.max(0, azAGI - standardDeduction - dependentExemption)

  // ── Tax ───────────────────────────────────────────────────────
  const fullYearTax = Math.round(azTaxableIncome * AZ_FLAT_TAX_RATE)
  const azTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits ───────────────────────────────────────────────────
  // Family Tax Credit: available for low-income filers (under $50K AGI)
  const familyTaxCredit =
    !model.canBeClaimedAsDependent &&
    federalAGI < AZ_FAMILY_TAX_CREDIT_AGI_LIMIT
      ? AZ_FAMILY_TAX_CREDIT[model.filingStatus]
      : 0

  const totalCredits = familyTaxCredit
  const taxAfterCredits = Math.max(0, azTax - totalCredits)

  // ── Payments ──────────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => {
    if (w2.box15State === 'AZ') return sum + (w2.box17StateIncomeTax ?? 0)
    return sum
  }, 0)

  const totalPayments = stateWithholding

  const overpaid = totalPayments > taxAfterCredits
    ? totalPayments - taxAfterCredits
    : 0
  const amountOwed = taxAfterCredits > totalPayments
    ? taxAfterCredits - totalPayments
    : 0

  const azSourceIncome = ratio < 1.0
    ? Math.round(azAGI * ratio)
    : undefined

  return {
    federalAGI,
    additions,
    nonAZMunicipalInterest,
    previouslyDeductedAZTaxes,
    subtractions,
    usGovInterest,
    azStateRefundIncluded,
    socialSecurityExemption,
    azAGI,
    standardDeduction,
    dependentExemption,
    azTaxableIncome,
    azTax,
    familyTaxCredit,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    azSourceIncome,
  }
}
