/**
 * Massachusetts Form 1 — Resident Income Tax Return
 *
 * Main orchestrator for MA state tax computation.
 * Sits downstream of federal Form 1040 — consumes Form1040Result.
 *
 * MA uses a flat 5% rate on taxable income plus a 4% surtax on
 * income over $1M (Fair Share Amendment, effective 2023).
 *
 * Key differences from federal:
 * - No standard/itemized deduction choice — uses personal exemptions
 * - Flat rate instead of progressive brackets
 * - HSA deduction not recognized (added back)
 * - Social Security fully exempt
 * - Rent deduction (50% of rent, capped at $4,000)
 *
 * Source: MA DOR 2025 Form 1 Instructions
 */

import type { TaxReturn, FilingStatus, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import {
  MA_TAX_RATE,
  MA_SURTAX_THRESHOLD,
  MA_SURTAX_RATE,
  MA_PERSONAL_EXEMPTION,
  MA_DEPENDENT_EXEMPTION,
  MA_BLIND_EXEMPTION,
  MA_AGE65_EXEMPTION,
  MA_RENT_DEDUCTION_RATE,
  MA_RENT_DEDUCTION_CAP,
  MA_EITC_RATE,
} from './constants'
import { computeMAAdjustments, type MAAdjustmentsResult } from './adjustments'

// ── Result type ──────────────────────────────────────────────────

export interface Form1Result {
  // Income
  federalAGI: number                  // from Form 1040 Line 11
  maAdjustments: MAAdjustmentsResult  // Schedule Y additions/subtractions
  maAGI: number                       // MA adjusted gross income

  // Exemptions
  personalExemption: number           // based on filing status
  dependentExemption: number          // $1,000 per dependent
  age65Exemption: number              // $700 per 65+ person
  blindExemption: number              // $2,200 per blind person
  totalExemptions: number             // sum of all exemptions

  // Deductions
  rentDeduction: number               // 50% of rent, capped

  // Tax
  maTaxableIncome: number             // max(0, maAGI - exemptions - deductions)
  maBaseTax: number                   // 5% flat rate
  maSurtax: number                    // 4% on income > $1M
  maIncomeTax: number                 // baseTax + surtax

  // Credits
  maEITC: number                    // 30% of federal EITC (refundable)
  totalCredits: number

  // Tax after credits
  taxAfterCredits: number

  // Payments
  stateWithholding: number            // sum of W-2 Box 17 for MA
  totalPayments: number

  // Result
  overpaid: number                    // refund
  amountOwed: number

  // Part-year / nonresident apportionment
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number          // 1.0 for full-year
  maSourceIncome?: number             // apportioned income for part-year
}

// ── Exemptions ───────────────────────────────────────────────────

function computeExemptions(
  filingStatus: FilingStatus,
  numDependents: number,
  taxpayerAge65: boolean,
  taxpayerBlind: boolean,
  spouseAge65: boolean,
  spouseBlind: boolean,
): {
  personal: number
  dependent: number
  age65: number
  blind: number
  total: number
} {
  const personal = MA_PERSONAL_EXEMPTION[filingStatus]
  const dependent = numDependents * MA_DEPENDENT_EXEMPTION

  // Age 65+ exemption: $700 per qualifying person
  let age65 = 0
  if (taxpayerAge65) age65 += MA_AGE65_EXEMPTION
  if (spouseAge65 && (filingStatus === 'mfj' || filingStatus === 'mfs')) {
    age65 += MA_AGE65_EXEMPTION
  }

  // Blind exemption: $2,200 per legally blind person
  let blind = 0
  if (taxpayerBlind) blind += MA_BLIND_EXEMPTION
  if (spouseBlind && (filingStatus === 'mfj' || filingStatus === 'mfs')) {
    blind += MA_BLIND_EXEMPTION
  }

  return {
    personal,
    dependent,
    age65,
    blind,
    total: personal + dependent + age65 + blind,
  }
}

// ── Rent Deduction ───────────────────────────────────────────────

function computeRentDeduction(
  filingStatus: FilingStatus,
  rentPaid: number,
): number {
  if (rentPaid <= 0) return 0

  const deduction = Math.round(rentPaid * MA_RENT_DEDUCTION_RATE)
  const cap = MA_RENT_DEDUCTION_CAP[filingStatus]
  return Math.min(deduction, cap)
}

// ── Apportionment ────────────────────────────────────────────────

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function computeApportionmentRatio(
  config: StateReturnConfig,
  taxYear: number,
): number {
  if (config.residencyType === 'full-year') return 1.0
  if (config.residencyType === 'nonresident') return 0.0

  const daysInYear = isLeapYear(taxYear) ? 366 : 365
  const MS_PER_DAY = 86400000
  const yearStartMs = Date.UTC(taxYear, 0, 1)
  const yearEndMs = Date.UTC(taxYear, 11, 31)

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

// ── Main orchestrator ────────────────────────────────────────────

export function computeForm1(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form1Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  // ── Income (Federal AGI → MA AGI) ─────────────────────────
  const maAdj = computeMAAdjustments(model, form1040)
  const federalAGI = maAdj.federalAGI
  const maAGI = maAdj.maAGI

  // ── Exemptions ─────────────────────────────────────────────
  const exemptions = computeExemptions(
    filingStatus,
    model.dependents.length,
    model.deductions.taxpayerAge65,
    model.deductions.taxpayerBlind,
    model.deductions.spouseAge65,
    model.deductions.spouseBlind,
  )

  // Part-year: prorate exemptions
  const totalExemptions = ratio < 1.0
    ? Math.round(exemptions.total * ratio)
    : exemptions.total

  // ── Deductions (Schedule Y) ────────────────────────────────
  // Rent deduction: 50% of rent, capped at $4,000 ($2,000 MFS)
  const rentPaid = config?.rentAmount ?? 0
  const baseRentDeduction = computeRentDeduction(filingStatus, rentPaid)
  // Part-year: prorate rent deduction
  const rentDeduction = ratio < 1.0
    ? Math.round(baseRentDeduction * ratio)
    : baseRentDeduction

  // ── Taxable Income ─────────────────────────────────────────
  // For part-year: apportion income first, then subtract prorated exemptions
  const maSourceIncome = ratio < 1.0
    ? Math.round(maAGI * ratio)
    : undefined
  const incomeBase = maSourceIncome ?? maAGI
  const maTaxableIncome = Math.max(0, incomeBase - totalExemptions - rentDeduction)

  // ── Tax ────────────────────────────────────────────────────
  // Flat 5% rate on all taxable income
  const maBaseTax = Math.round(maTaxableIncome * MA_TAX_RATE)

  // 4% surtax on taxable income over $1M (not doubled for MFJ)
  const maSurtax = maTaxableIncome > MA_SURTAX_THRESHOLD
    ? Math.round((maTaxableIncome - MA_SURTAX_THRESHOLD) * MA_SURTAX_RATE)
    : 0

  const maIncomeTax = maBaseTax + maSurtax

  // ── Credits ──────────────────────────────────────────────────
  // MA EITC: 30% of federal EITC (refundable)
  const federalEITC = form1040.line27.amount
  const maEITC = federalEITC > 0 ? Math.round(federalEITC * MA_EITC_RATE) : 0
  const totalCredits = maEITC

  // ── Tax after credits ──────────────────────────────────────
  const taxAfterCredits = Math.max(0, maIncomeTax - totalCredits)

  // ── Payments ───────────────────────────────────────────────
  // Sum of W-2 Box 17 where Box 15 state is MA
  const stateWithholding = model.w2s.reduce((sum, w) => {
    if (w.box15State === 'MA') {
      return sum + (w.box17StateIncomeTax ?? 0)
    }
    return sum
  }, 0)

  // MA EITC is refundable — applied as a payment
  const totalPayments = stateWithholding + maEITC

  // ── Refund or amount owed ──────────────────────────────────
  const overpaid = totalPayments > taxAfterCredits
    ? totalPayments - taxAfterCredits
    : 0
  const amountOwed = taxAfterCredits > totalPayments
    ? taxAfterCredits - totalPayments
    : 0

  return {
    federalAGI,
    maAdjustments: maAdj,
    maAGI,

    personalExemption: exemptions.personal,
    dependentExemption: exemptions.dependent,
    age65Exemption: exemptions.age65,
    blindExemption: exemptions.blind,
    totalExemptions,

    rentDeduction,

    maTaxableIncome,
    maBaseTax,
    maSurtax,
    maIncomeTax,

    maEITC,
    totalCredits,
    taxAfterCredits,

    stateWithholding,
    totalPayments,

    overpaid,
    amountOwed,

    residencyType,
    apportionmentRatio: ratio,
    maSourceIncome,
  }
}
