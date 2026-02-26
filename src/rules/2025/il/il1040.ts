/**
 * Illinois Form IL-1040 -- Individual Income Tax Return
 *
 * IL starts from federal AGI, applies additions and subtractions,
 * computes a personal exemption allowance, and applies a flat 4.95% rate.
 *
 * Key differences from other flat-tax states:
 * - No standard deduction -- uses personal exemption instead
 * - Additions: federally tax-exempt interest income
 * - Subtractions: US government interest, Social Security, IL tax refund
 * - Credits: IL EIC (20% of federal), property tax credit, child tax credit
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  IL_FLAT_TAX_RATE,
  IL_PERSONAL_EXEMPTION,
  IL_EIC_RATE,
} from './constants'

export interface IL1040Result {
  federalAGI: number

  // Additions (Schedule M, Line 3)
  ilAdditions: number
  taxExemptInterest: number            // federally tax-exempt interest from other states

  // Subtractions (Schedule M, Line 24)
  ilSubtractions: number
  usGovInterest: number                // US government obligation interest
  socialSecuritySubtraction: number    // Social Security benefits included in federal AGI
  ilTaxRefundSubtraction: number       // IL income tax refund included in federal AGI (1099-G box 2)

  // IL base income (federal AGI + additions - subtractions)
  ilBaseIncome: number

  // Exemption allowance
  exemptionCount: number               // taxpayer + spouse + dependents
  exemptionAllowance: number

  // Net income and tax
  ilNetIncome: number                  // base income - exemption allowance
  ilTaxableIncome: number              // same as net income for full-year; apportioned for part-year/NR
  ilTax: number                        // flat 4.95% of taxable income

  // Credits
  ilEIC: number                        // IL earned income credit (20% of federal EITC)
  propertyTaxCredit: number            // 5% of property taxes paid (stub: 0)
  ilChildTaxCredit: number             // $100 per qualifying child (stub: 0 for phaseout)
  totalCredits: number

  taxAfterCredits: number

  // Withholding & payments
  stateWithholding: number
  totalPayments: number

  // Result
  overpaid: number
  amountOwed: number

  // Residency
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  ilSourceIncome?: number
}

export function computeILApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
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

export function computeIL1040(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): IL1040Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeILApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount

  // ── IL Additions (Schedule M) ──────────────────────────────
  // Federally tax-exempt interest (1099-INT box 8 + 1099-DIV box 11)
  // This is interest from municipal bonds of other states that IL taxes
  const taxExemptInterest =
    model.form1099INTs.reduce((sum, f) => sum + f.box8, 0) +
    model.form1099DIVs.reduce((sum, f) => sum + f.box11, 0)

  const ilAdditions = taxExemptInterest

  // ── IL Subtractions (Schedule M) ───────────────────────────
  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  // Social Security benefits: IL fully exempts SS income
  // form1040 line6b is the taxable portion of SS; we subtract it from IL income
  const socialSecuritySubtraction = form1040.line6b.amount

  // IL income tax refund included in federal AGI (1099-G Box 2)
  // Only subtract if taxpayer itemized last year (otherwise refund isn't in federal AGI)
  const ilTaxRefundSubtraction = (model.priorYear?.itemizedLastYear ?? false)
    ? model.form1099Gs.reduce((sum, g) => sum + g.box2, 0)
    : 0

  const ilSubtractions = usGovInterest + socialSecuritySubtraction + ilTaxRefundSubtraction

  // ── IL Base Income ─────────────────────────────────────────
  const ilBaseIncome = Math.max(0, federalAGI + ilAdditions - ilSubtractions)

  // ── Exemption Allowance ────────────────────────────────────
  // $2,625 per person: taxpayer + spouse (if MFJ) + dependents
  let exemptionCount = 1  // taxpayer
  if (model.filingStatus === 'mfj' && model.spouse) {
    exemptionCount += 1   // spouse
  }
  exemptionCount += model.dependents.length

  const exemptionAllowance = exemptionCount * IL_PERSONAL_EXEMPTION

  // ── Net Income ─────────────────────────────────────────────
  const ilNetIncome = Math.max(0, ilBaseIncome - exemptionAllowance)

  // ── Taxable Income (with apportionment for part-year/NR) ──
  const ilTaxableIncome = ratio < 1
    ? Math.round(ilNetIncome * ratio)
    : ilNetIncome

  // ── IL Tax ─────────────────────────────────────────────────
  const ilTax = Math.round(ilTaxableIncome * IL_FLAT_TAX_RATE)

  // ── Credits ────────────────────────────────────────────────

  // IL Earned Income Credit: 20% of federal EITC
  const federalEITC = form1040.earnedIncomeCredit?.creditAmount ?? 0
  const ilEIC = Math.round(federalEITC * IL_EIC_RATE)

  // Property tax credit: stub with 0 (would need property tax input on StateReturnConfig)
  const propertyTaxCredit = 0

  // IL Child Tax Credit: stub with 0 (phaseout logic not implemented)
  const ilChildTaxCredit = 0

  const totalCredits = ilEIC + propertyTaxCredit + ilChildTaxCredit

  // Tax after credits (credits cannot reduce below zero)
  const taxAfterCredits = Math.max(0, ilTax - totalCredits)

  // ── Withholding ────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'IL' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding

  // ── Result ─────────────────────────────────────────────────
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const ilSourceIncome = ratio < 1 ? Math.round(ilNetIncome * ratio) : undefined

  return {
    federalAGI,
    ilAdditions,
    taxExemptInterest,
    ilSubtractions,
    usGovInterest,
    socialSecuritySubtraction,
    ilTaxRefundSubtraction,
    ilBaseIncome,
    exemptionCount,
    exemptionAllowance,
    ilNetIncome,
    ilTaxableIncome,
    ilTax,
    ilEIC,
    propertyTaxCredit,
    ilChildTaxCredit,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    ilSourceIncome,
  }
}
