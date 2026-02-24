/**
 * Virginia Form 760 — Resident Income Tax Return
 *
 * Main orchestrator for VA state tax computation.
 * Sits downstream of federal Form 1040 — consumes Form1040Result.
 *
 * Source: Virginia Dept. of Taxation — 2025 Form 760 Instructions
 */

import type { TaxReturn, FilingStatus, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { ScheduleAResult } from '../scheduleA'
import { computeBracketTax } from '../taxComputation'
import { MEDICAL_AGI_FLOOR_RATE } from '../constants'
import {
  VA_STANDARD_DEDUCTION,
  VA_TAX_BRACKETS,
  VA_PERSONAL_EXEMPTION,
  VA_DEPENDENT_EXEMPTION,
  VA_AGE65_EXTRA_EXEMPTION,
  VA_BLIND_EXTRA_EXEMPTION,
} from './constants'
import { computeScheduleADJ, type ScheduleADJResult } from './scheduleADJ'
import { computeLowIncomeCredit } from './vaCredits'
import { computeApportionmentRatio } from '../ca/form540'

// ── Result type ──────────────────────────────────────────────────

export interface Form760Result {
  // Residency
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number       // 1.0 for full-year residents

  // Income
  federalAGI: number               // Line 1 — from Form 1040 Line 11
  vaAdjustments: ScheduleADJResult // Schedule ADJ
  vaAGI: number                    // Line 5 — FAGI with ADJ adjustments

  // Deductions & Exemptions
  vaStandardDeduction: number      // standard deduction amount
  vaItemizedDeduction: number      // VA-adjusted itemized (0 if standard used)
  deductionUsed: number            // max(standard, itemized)
  deductionMethod: 'standard' | 'itemized'
  personalExemptions: number       // $930 × filers
  dependentExemptions: number      // $930 × dependents
  age65Exemptions: number          // $800 × qualifying filers
  blindExemptions: number          // $800 × qualifying filers
  totalExemptions: number          // Line 7 total

  // Taxable income
  vaTaxableIncome: number          // Line 9 = vaAGI - deductions - exemptions

  // Tax
  vaTax: number                    // Line 10 — from 4-bracket computation

  // Credits
  lowIncomeCredit: number          // Schedule CR credit
  totalCredits: number

  // Part-year apportioned
  vaSourceIncome?: number          // For part-year/nonresident
  apportionedTax?: number          // Tax × apportionmentRatio

  // Payments
  stateWithholding: number         // Line 18 — sum of W-2 Box 17 (VA)
  estimatedPayments: number        // Line 19
  totalPayments: number            // Line 25

  // Result
  taxAfterCredits: number          // Line 13
  overpaid: number                 // Refund
  amountOwed: number               // Balance due
}

// ── VA Itemized Deductions ──────────────────────────────────────

function computeVAItemized(
  model: TaxReturn,
  scheduleA: ScheduleAResult,
  vaAGI: number,
): number {
  const d = model.deductions.itemized
  if (!d) return 0

  // Medical: recalculate with VA AGI floor
  const medicalFloor = Math.round(vaAGI * MEDICAL_AGI_FLOOR_RATE)
  const medicalDeduction = Math.max(0, d.medicalExpenses - medicalFloor)

  // SALT: remove state/local income taxes, keep RE + PP + sales tax, no cap
  const vaSALT = d.realEstateTaxes + d.personalPropertyTaxes + d.stateLocalSalesTaxes

  // Mortgage: VA conforms to federal TCJA $750K limit — use federal computation
  const mortgageDeduction = scheduleA.line8a.amount

  // Investment interest: same as federal
  const investmentInterest = scheduleA.line9.amount

  // Charitable: same as federal
  const charitable = scheduleA.line14.amount

  // Other deductions: same as federal
  const other = scheduleA.line16.amount

  return medicalDeduction + vaSALT + mortgageDeduction + investmentInterest + charitable + other
}

// ── Exemptions ──────────────────────────────────────────────────

function computeExemptions(
  filingStatus: FilingStatus,
  numDependents: number,
  taxpayerAge65: boolean,
  spouseAge65: boolean,
  taxpayerBlind: boolean,
  spouseBlind: boolean,
): {
  personal: number
  dependent: number
  age65: number
  blind: number
  total: number
} {
  const numPersonal = (filingStatus === 'mfj' || filingStatus === 'mfs') ? 2 : 1
  const personal = numPersonal * VA_PERSONAL_EXEMPTION
  const dependent = numDependents * VA_DEPENDENT_EXEMPTION

  let age65 = 0
  if (taxpayerAge65) age65 += VA_AGE65_EXTRA_EXEMPTION
  if (spouseAge65 && (filingStatus === 'mfj' || filingStatus === 'mfs')) {
    age65 += VA_AGE65_EXTRA_EXEMPTION
  }

  let blind = 0
  if (taxpayerBlind) blind += VA_BLIND_EXTRA_EXEMPTION
  if (spouseBlind && (filingStatus === 'mfj' || filingStatus === 'mfs')) {
    blind += VA_BLIND_EXTRA_EXEMPTION
  }

  return {
    personal,
    dependent,
    age65,
    blind,
    total: personal + dependent + age65 + blind,
  }
}

// ── Main orchestrator ───────────────────────────────────────────

export function computeForm760(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form760Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  // ── Income (Lines 1–5) ──────────────────────────────────
  const stateConfig: StateReturnConfig = config ?? {
    stateCode: 'VA',
    residencyType: 'full-year',
  }
  const scheduleADJ = computeScheduleADJ(form1040, model, stateConfig)
  const federalAGI = scheduleADJ.federalAGI
  const vaAGI = scheduleADJ.vaAGI

  // ── Deductions (Line 6) ─────────────────────────────────
  const vaStandardDeduction = VA_STANDARD_DEDUCTION[filingStatus]

  let vaItemizedDeduction = 0
  if (model.deductions.method === 'itemized' && form1040.scheduleA) {
    vaItemizedDeduction = computeVAItemized(model, form1040.scheduleA, vaAGI)
  }

  const useItemized = vaItemizedDeduction > vaStandardDeduction
  const deductionUsed = useItemized ? vaItemizedDeduction : vaStandardDeduction
  const deductionMethod = useItemized ? 'itemized' as const : 'standard' as const

  // ── Exemptions (Line 7) ─────────────────────────────────
  const exemptions = computeExemptions(
    filingStatus,
    model.dependents.length,
    model.deductions.taxpayerAge65 ?? false,
    model.deductions.spouseAge65 ?? false,
    model.deductions.taxpayerBlind ?? false,
    model.deductions.spouseBlind ?? false,
  )

  // ── Taxable Income (Line 9) ─────────────────────────────
  const vaTaxableIncome = Math.max(0, vaAGI - deductionUsed - exemptions.total)

  // ── Tax (Line 10) ──────────────────────────────────────
  const fullYearTax = computeBracketTax(vaTaxableIncome, VA_TAX_BRACKETS)
  const vaTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  // ── Credits (Line 12) ──────────────────────────────────
  const familySize = (filingStatus === 'mfj' || filingStatus === 'mfs' ? 2 : 1) + model.dependents.length
  const lowIncomeCredit = computeLowIncomeCredit(vaTaxableIncome, vaTax, familySize)
  const totalCredits = lowIncomeCredit

  // ── Tax after credits (Line 13) ────────────────────────
  const taxAfterCredits = Math.max(0, vaTax - totalCredits)

  // ── Payments (Lines 18–25) ─────────────────────────────
  const stateWithholding = model.w2s.reduce((sum, w) => {
    if (w.box15State === 'VA') {
      return sum + (w.box17StateIncomeTax ?? 0)
    }
    return sum
  }, 0)

  const estimatedPayments = 0
  const totalPayments = stateWithholding + estimatedPayments

  // ── Refund or amount owed ──────────────────────────────
  const overpaid = totalPayments > taxAfterCredits
    ? totalPayments - taxAfterCredits
    : 0
  const amountOwed = taxAfterCredits > totalPayments
    ? taxAfterCredits - totalPayments
    : 0

  const vaSourceIncome = ratio < 1.0
    ? Math.round(vaAGI * ratio)
    : undefined
  const apportionedTax = ratio < 1.0
    ? vaTax
    : undefined

  return {
    residencyType,
    apportionmentRatio: ratio,

    federalAGI,
    vaAdjustments: scheduleADJ,
    vaAGI,

    vaStandardDeduction,
    vaItemizedDeduction,
    deductionUsed,
    deductionMethod,
    personalExemptions: exemptions.personal,
    dependentExemptions: exemptions.dependent,
    age65Exemptions: exemptions.age65,
    blindExemptions: exemptions.blind,
    totalExemptions: exemptions.total,

    vaTaxableIncome,
    vaTax,

    lowIncomeCredit,
    totalCredits,

    vaSourceIncome,
    apportionedTax,

    stateWithholding,
    estimatedPayments,
    totalPayments,

    taxAfterCredits,
    overpaid,
    amountOwed,
  }
}
