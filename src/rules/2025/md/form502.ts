/**
 * Maryland Form 502 — Resident Income Tax Return
 *
 * Main orchestrator for MD state tax computation.
 * Sits downstream of federal Form 1040 — consumes Form1040Result.
 *
 * Key MD differences from federal:
 * - Social Security benefits are fully exempt from MD tax
 * - State/local income taxes cannot be deducted on MD return
 * - 10-bracket progressive rate schedule (2% to 6.50%)
 * - County/city local income tax (2.25% to 3.20%)
 * - $3,200 personal/dependent exemptions with stepped phase-down
 * - MD EIC = 45% of federal EIC (with children) or 100% (without)
 *
 * Source: Maryland Form 502 Instructions 2025
 */

import type { TaxReturn, FilingStatus, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { ScheduleAResult } from '../scheduleA'
import { computeBracketTax } from '../taxComputation'
import {
  MD_STANDARD_DEDUCTION,
  MD_TAX_BRACKETS,
  MD_PERSONAL_EXEMPTION,
  MD_EXEMPTION_THRESHOLDS,
  MD_COUNTIES,
  MD_DEFAULT_COUNTY,
  MD_EIC_RATE_WITH_CHILDREN,
  MD_EIC_RATE_WITHOUT_CHILDREN,
} from './constants'

// ── Result type ──────────────────────────────────────────────────

export interface Form502Result {
  // Income
  federalAGI: number                // from Form 1040 Line 11
  ssSubtraction: number             // Social Security subtraction (Line 6b)
  mdAGI: number                     // MD AGI = federal AGI - SS subtraction

  // Deductions
  standardDeduction: number
  itemizedDeduction: number         // MD-adjusted itemized (0 if standard used)
  deductionUsed: number             // max(standard, itemized)
  deductionMethod: 'standard' | 'itemized'

  // Exemptions
  personalExemption: number         // before phase-down
  dependentExemption: number        // before phase-down
  exemptionPerPerson: number        // after phase-down (per-person amount)
  totalExemptions: number           // after phase-down, apportioned

  // Tax
  mdTaxableIncome: number
  mdStateTax: number                // from bracket computation
  countyCode: string                // county used for local tax
  countyRate: number                // local tax rate
  mdLocalTax: number                // county/city local income tax

  // Credits
  mdEIC: number                     // Maryland earned income credit

  // Tax after credits
  taxAfterCredits: number           // state tax + local tax - credits

  // Payments
  stateWithholding: number          // W-2 Box 17 for MD
  totalPayments: number

  // Result
  overpaid: number                  // refund
  amountOwed: number

  // Residency
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  mdSourceIncome?: number           // apportioned AGI for part-year display
}

// ── MD Itemized Deductions ──────────────────────────────────────
// Adjusts federal Schedule A for MD differences:
// - Remove state/local income taxes (can't deduct MD tax from MD return)
// - Keep everything else from federal Schedule A

function computeMDItemized(
  scheduleA: ScheduleAResult,
  model: TaxReturn,
): number {
  const d = model.deductions.itemized
  if (!d) return 0

  // Medical: use federal computation
  const medical = scheduleA.line4.amount

  // Taxes: real estate + personal property only (no state income tax, no sales tax)
  const mdTaxes = d.realEstateTaxes + d.personalPropertyTaxes

  // Mortgage interest: use federal computation (MD conforms to TCJA $750K limit)
  const mortgageInterest = scheduleA.line10.amount

  // Investment interest: use federal computation
  const investmentInterest = scheduleA.line9.amount

  // Charitable: use federal computation
  const charitable = scheduleA.line14.amount

  // Other deductions: use federal computation
  const other = scheduleA.line16.amount

  return medical + mdTaxes + mortgageInterest + investmentInterest + charitable + other
}

// ── Exemption Phase-Down ────────────────────────────────────────
// Maryland uses a stepped phase-down (not proportional):
// AGI ≤ full threshold:    $3,200 per exemption
// AGI ≤ half threshold:    $1,600 per exemption
// AGI ≤ quarter threshold: $800 per exemption
// AGI > quarter threshold: $0

function computeExemptionPerPerson(
  filingStatus: FilingStatus,
  mdAGI: number,
): number {
  const thresholds = MD_EXEMPTION_THRESHOLDS[filingStatus]

  if (mdAGI <= thresholds.full) return MD_PERSONAL_EXEMPTION
  if (mdAGI <= thresholds.half) return Math.round(MD_PERSONAL_EXEMPTION / 2)
  if (mdAGI <= thresholds.quarter) return Math.round(MD_PERSONAL_EXEMPTION / 4)
  return 0
}

function computeExemptions(
  filingStatus: FilingStatus,
  numDependents: number,
  mdAGI: number,
): {
  personal: number
  dependent: number
  perPerson: number
  total: number
} {
  const perPerson = computeExemptionPerPerson(filingStatus, mdAGI)

  const numPersonal = filingStatus === 'mfj' ? 2 : 1
  const personal = numPersonal * perPerson
  const dependent = numDependents * perPerson

  return {
    personal,
    dependent,
    perPerson,
    total: personal + dependent,
  }
}

// ── County Tax ──────────────────────────────────────────────────

function getCountyRate(countyCode?: string): { code: string; rate: number } {
  const code = countyCode ?? MD_DEFAULT_COUNTY
  const county = MD_COUNTIES[code]
  if (county) return { code, rate: county.rate }
  return { code: MD_DEFAULT_COUNTY, rate: MD_COUNTIES[MD_DEFAULT_COUNTY].rate }
}

// ── MD EIC ──────────────────────────────────────────────────────

function computeMDEIC(form1040: Form1040Result): number {
  const eic = form1040.earnedIncomeCredit
  if (!eic || !eic.eligible || eic.creditAmount <= 0) return 0

  const rate = eic.numQualifyingChildren > 0
    ? MD_EIC_RATE_WITH_CHILDREN
    : MD_EIC_RATE_WITHOUT_CHILDREN

  return Math.round(eic.creditAmount * rate)
}

// ── Apportionment ───────────────────────────────────────────────

export function computeApportionmentRatio(
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

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// ── Main orchestrator ───────────────────────────────────────────

export function computeForm502(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form502Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  // ── Income ─────────────────────────────────────────────────
  const federalAGI = form1040.line11.amount

  // MD subtracts taxable Social Security (line 6b) — MD does not tax SS
  const ssSubtraction = form1040.line6b.amount
  const mdAGI = federalAGI - ssSubtraction

  // ── Deductions ─────────────────────────────────────────────
  const standardDeduction = MD_STANDARD_DEDUCTION[filingStatus]

  let itemizedDeduction = 0
  if (model.deductions.method === 'itemized' && form1040.scheduleA) {
    itemizedDeduction = computeMDItemized(form1040.scheduleA, model)
  }

  const useItemized = itemizedDeduction > standardDeduction
  const deductionUsed = useItemized ? itemizedDeduction : standardDeduction
  const deductionMethod = useItemized ? 'itemized' as const : 'standard' as const

  // ── Exemptions ─────────────────────────────────────────────
  const exemptions = computeExemptions(filingStatus, model.dependents.length, mdAGI)

  // ── Apportionment for part-year ────────────────────────────
  const apportionedAGI = ratio < 1.0 ? Math.round(mdAGI * ratio) : mdAGI
  const apportionedDeduction = ratio < 1.0 ? Math.round(deductionUsed * ratio) : deductionUsed
  const apportionedExemptions = ratio < 1.0 ? Math.round(exemptions.total * ratio) : exemptions.total

  // ── Taxable Income ─────────────────────────────────────────
  const mdTaxableIncome = Math.max(0, apportionedAGI - apportionedDeduction - apportionedExemptions)

  // ── State Tax ──────────────────────────────────────────────
  const mdStateTax = computeBracketTax(mdTaxableIncome, MD_TAX_BRACKETS[filingStatus])

  // ── County/Local Tax ───────────────────────────────────────
  const { code: countyCode, rate: countyRate } = getCountyRate(config?.county)
  const mdLocalTax = Math.round(mdTaxableIncome * countyRate)

  // ── Credits ────────────────────────────────────────────────
  const mdEIC = computeMDEIC(form1040)

  // ── Tax After Credits ──────────────────────────────────────
  const taxAfterCredits = Math.max(0, mdStateTax + mdLocalTax - mdEIC)

  // ── Payments ───────────────────────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w) => {
    if (w.box15State === 'MD') {
      return sum + (w.box17StateIncomeTax ?? 0)
    }
    return sum
  }, 0)

  const totalPayments = stateWithholding

  // ── Refund or amount owed ──────────────────────────────────
  const overpaid = totalPayments > taxAfterCredits
    ? totalPayments - taxAfterCredits
    : 0
  const amountOwed = taxAfterCredits > totalPayments
    ? taxAfterCredits - totalPayments
    : 0

  const mdSourceIncome = ratio < 1.0
    ? apportionedAGI
    : undefined

  return {
    federalAGI,
    ssSubtraction,
    mdAGI,

    standardDeduction,
    itemizedDeduction,
    deductionUsed,
    deductionMethod,

    personalExemption: exemptions.personal,
    dependentExemption: exemptions.dependent,
    exemptionPerPerson: exemptions.perPerson,
    totalExemptions: apportionedExemptions,

    mdTaxableIncome,
    mdStateTax,
    countyCode,
    countyRate,
    mdLocalTax,

    mdEIC,

    taxAfterCredits,

    stateWithholding,
    totalPayments,

    overpaid,
    amountOwed,

    residencyType,
    apportionmentRatio: ratio,
    mdSourceIncome,
  }
}
