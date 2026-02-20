/**
 * California Form 540 — Resident Income Tax Return
 *
 * Main orchestrator for CA state tax computation.
 * Sits downstream of federal Form 1040 — consumes Form1040Result.
 *
 * Source: FTB 2025 Form 540 Instructions
 */

import type { TaxReturn, FilingStatus } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { ScheduleAResult } from '../scheduleA'
import { computeBracketTax } from '../taxComputation'
import { MEDICAL_AGI_FLOOR_RATE } from '../constants'
import {
  CA_STANDARD_DEDUCTION,
  CA_TAX_BRACKETS,
  CA_MENTAL_HEALTH_THRESHOLD,
  CA_MENTAL_HEALTH_RATE,
  CA_PERSONAL_EXEMPTION_CREDIT,
  CA_DEPENDENT_EXEMPTION_CREDIT,
  CA_EXEMPTION_PHASEOUT,
  CA_RENTERS_CREDIT,
  CA_MORTGAGE_LIMIT,
  CA_HOME_EQUITY_LIMIT,
} from './constants'
import { computeScheduleCA, type ScheduleCAResult } from './scheduleCA'

// ── Result type ──────────────────────────────────────────────────

export interface Form540Result {
  // Income
  federalAGI: number                // Line 13 — from Form 1040 Line 11
  caAdjustments: ScheduleCAResult   // Schedule CA
  caAGI: number                     // Line 17

  // Deductions
  caStandardDeduction: number       // standard deduction amount
  caItemizedDeduction: number       // CA-adjusted itemized (0 if standard used)
  deductionUsed: number             // max(standard, itemized)
  deductionMethod: 'standard' | 'itemized'

  // Tax
  caTaxableIncome: number           // Line 19 = max(0, caAGI - deduction)
  caTax: number                     // Line 31 — from bracket computation
  mentalHealthTax: number           // Line 36 — 1% on income > $1M

  // Credits
  personalExemptionCredit: number   // base amount before phase-out
  dependentExemptionCredit: number  // base amount before phase-out
  exemptionPhaseOutReduction: number
  totalExemptionCredits: number     // Line 32 after phase-out
  rentersCredit: number             // Line 46

  // Tax after credits
  taxAfterCredits: number           // Line 48

  // Payments
  stateWithholding: number          // Line 71 — sum of W-2 Box 17
  totalPayments: number             // Line 77

  // Result
  overpaid: number                  // Line 93 (refund)
  amountOwed: number                // Line 97
}

// ── CA Itemized Deductions ──────────────────────────────────────
// Adjusts federal Schedule A for CA differences:
// - Remove state income tax from SALT (can't deduct CA tax from CA return)
// - No SALT cap (CA didn't conform to TCJA/OBBBA)
// - Mortgage limit $1M (CA didn't conform to TCJA $750K)
// - Medical floor uses CA AGI (not federal AGI)

function computeCAItemized(
  model: TaxReturn,
  scheduleA: ScheduleAResult,
  caAGI: number,
  filingStatus: FilingStatus,
): number {
  const d = model.deductions.itemized
  if (!d) return 0

  // Medical: recalculate with CA AGI floor
  const medicalFloor = Math.round(caAGI * MEDICAL_AGI_FLOOR_RATE)
  const medicalDeduction = Math.max(0, d.medicalExpenses - medicalFloor)

  // SALT: remove state/local income taxes, keep RE + PP + sales tax, no cap
  // CA allows: real estate taxes + personal property taxes + sales taxes
  // CA disallows: state income tax, SDI
  const caSALT = d.realEstateTaxes + d.personalPropertyTaxes + d.stateLocalSalesTaxes

  // Mortgage: CA uses $1M limit (didn't conform to TCJA $750K)
  const mortgageLimit = CA_MORTGAGE_LIMIT[filingStatus]
  let mortgageDeduction: number
  if (d.mortgagePrincipal <= 0 || d.mortgagePrincipal <= mortgageLimit) {
    mortgageDeduction = d.mortgageInterest
  } else {
    // Proportional limitation
    mortgageDeduction = Math.round(d.mortgageInterest * mortgageLimit / d.mortgagePrincipal)
  }

  // Home equity interest: CA still allows deduction (TCJA suspended it federally)
  // Limited to $100K ($50K MFS) in home equity debt
  let homeEquityDeduction = 0
  const heInterest = d.homeEquityInterest ?? 0
  const hePrincipal = d.homeEquityPrincipal ?? 0
  if (heInterest > 0) {
    const heLimit = CA_HOME_EQUITY_LIMIT[filingStatus]
    if (hePrincipal <= 0 || hePrincipal <= heLimit) {
      homeEquityDeduction = heInterest
    } else {
      homeEquityDeduction = Math.round(heInterest * heLimit / hePrincipal)
    }
  }

  // Investment interest: same as federal (use federal Schedule A computation)
  const investmentInterest = scheduleA.line9.amount

  // Charitable: same as federal (use federal Schedule A computation)
  const charitable = scheduleA.line14.amount

  // Other deductions: same as federal
  const other = scheduleA.line16.amount

  return medicalDeduction + caSALT + mortgageDeduction + homeEquityDeduction + investmentInterest + charitable + other
}

// ── Exemption Credits ───────────────────────────────────────────

function computeExemptionCredits(
  filingStatus: FilingStatus,
  numDependents: number,
  caAGI: number,
): {
  personalCredit: number
  dependentCredit: number
  phaseOutReduction: number
  total: number
} {
  // Personal exemption: $153 per person
  const numPersonal = (filingStatus === 'mfj' || filingStatus === 'mfs') ? 2 : 1
  const personalCredit = numPersonal * CA_PERSONAL_EXEMPTION_CREDIT

  // Dependent exemption: $475 per dependent
  const dependentCredit = numDependents * CA_DEPENDENT_EXEMPTION_CREDIT

  const totalBefore = personalCredit + dependentCredit

  // Phase-out: for CA AGI above threshold, reduce exemption credits
  // Phase-out rule: reduce by 6% for each $2,500 (or fraction) of AGI above threshold
  const threshold = CA_EXEMPTION_PHASEOUT[filingStatus]
  let phaseOutReduction = 0

  if (caAGI > threshold) {
    const excess = caAGI - threshold
    const increments = Math.ceil(excess / 250000) // $2,500 in cents
    const reductionRate = increments * 0.06
    phaseOutReduction = Math.min(
      Math.round(totalBefore * reductionRate),
      totalBefore,
    )
  }

  return {
    personalCredit,
    dependentCredit,
    phaseOutReduction,
    total: Math.max(0, totalBefore - phaseOutReduction),
  }
}

// ── Renter's Credit ─────────────────────────────────────────────

function computeRentersCredit(
  filingStatus: FilingStatus,
  caAGI: number,
  rentPaidInCA: boolean,
): number {
  if (!rentPaidInCA) return 0

  const category = (filingStatus === 'single' || filingStatus === 'mfs')
    ? 'single_mfs'
    : 'other'

  const { credit, agiLimit } = CA_RENTERS_CREDIT[category]
  return caAGI <= agiLimit ? credit : 0
}

// ── Main orchestrator ───────────────────────────────────────────

export function computeForm540(
  model: TaxReturn,
  form1040: Form1040Result,
): Form540Result {
  const filingStatus = model.filingStatus

  // ── Income (Lines 13–17) ──────────────────────────────────
  const scheduleCA = computeScheduleCA(form1040)
  const federalAGI = scheduleCA.federalAGI
  const caAGI = scheduleCA.caAGI

  // ── Deductions (Line 18) ──────────────────────────────────
  const caStandardDeduction = CA_STANDARD_DEDUCTION[filingStatus]

  let caItemizedDeduction = 0
  if (model.deductions.method === 'itemized' && form1040.scheduleA) {
    caItemizedDeduction = computeCAItemized(model, form1040.scheduleA, caAGI, filingStatus)
  }

  const useItemized = caItemizedDeduction > caStandardDeduction
  const deductionUsed = useItemized ? caItemizedDeduction : caStandardDeduction
  const deductionMethod = useItemized ? 'itemized' as const : 'standard' as const

  // ── Taxable Income (Line 19) ──────────────────────────────
  const caTaxableIncome = Math.max(0, caAGI - deductionUsed)

  // ── Tax (Line 31) ────────────────────────────────────────
  const caTax = computeBracketTax(caTaxableIncome, CA_TAX_BRACKETS[filingStatus])

  // ── Exemption Credits (Line 32) ──────────────────────────
  const exemptions = computeExemptionCredits(filingStatus, model.dependents.length, caAGI)

  // ── Tax minus exemption credits (Line 33) ────────────────
  const taxMinusExemptions = Math.max(0, caTax - exemptions.total)

  // ── Mental Health Services Tax (Line 36) ──────────────────
  const mentalHealthTax = caTaxableIncome > CA_MENTAL_HEALTH_THRESHOLD
    ? Math.round((caTaxableIncome - CA_MENTAL_HEALTH_THRESHOLD) * CA_MENTAL_HEALTH_RATE)
    : 0

  // ── Net tax before credits (Line 35 + Line 36) ──────────
  const netTaxBeforeCredits = taxMinusExemptions + mentalHealthTax

  // ── Other credits ────────────────────────────────────────
  const rentersCredit = computeRentersCredit(filingStatus, caAGI, model.rentPaidInCA ?? false)

  // ── Tax after credits (Line 48) ──────────────────────────
  const taxAfterCredits = Math.max(0, netTaxBeforeCredits - rentersCredit)

  // ── Payments (Line 71) ───────────────────────────────────
  // Sum of W-2 Box 17 (state income tax withheld) for CA
  const stateWithholding = model.w2s.reduce((sum, w) => {
    if (w.box15State === 'CA' || !w.box15State) {
      return sum + (w.box17StateIncomeTax ?? 0)
    }
    return sum
  }, 0)

  const totalPayments = stateWithholding

  // ── Refund or amount owed ────────────────────────────────
  const overpaid = totalPayments > taxAfterCredits
    ? totalPayments - taxAfterCredits
    : 0
  const amountOwed = taxAfterCredits > totalPayments
    ? taxAfterCredits - totalPayments
    : 0

  return {
    federalAGI,
    caAdjustments: scheduleCA,
    caAGI,

    caStandardDeduction,
    caItemizedDeduction,
    deductionUsed,
    deductionMethod,

    caTaxableIncome,
    caTax,
    mentalHealthTax,

    personalExemptionCredit: exemptions.personalCredit,
    dependentExemptionCredit: exemptions.dependentCredit,
    exemptionPhaseOutReduction: exemptions.phaseOutReduction,
    totalExemptionCredits: exemptions.total,
    rentersCredit,

    taxAfterCredits,

    stateWithholding,
    totalPayments,

    overpaid,
    amountOwed,
  }
}
