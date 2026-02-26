/**
 * Form 1040 — U.S. Individual Income Tax Return
 *
 * Lines 1–9:  Income
 * Lines 10–15: AGI and deductions
 * Line 16:    Tax (ordinary or QDCG worksheet)
 * Lines 24–37: Total tax, payments, refund/owed
 *
 * Each line function returns a TracedValue. All amounts are in integer cents.
 *
 * Source: 2025 Form 1040 instructions
 * https://www.irs.gov/instructions/i1040gi
 */

import type { TaxReturn, FilingStatus } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation, tracedZero } from '../../model/traced'
import {
  STANDARD_DEDUCTION,
  ADDITIONAL_STANDARD_DEDUCTION,
  DEPENDENT_FILER_MIN_DEDUCTION,
  DEPENDENT_FILER_EARNED_INCOME_ADDON,
} from './constants'
import { computeScheduleA } from './scheduleA'
import type { ScheduleAResult } from './scheduleA'
import { computeScheduleD } from './scheduleD'
import type { ScheduleDResult } from './scheduleD'
import { computeOrdinaryTax, computeQDCGTax, netCapGainForQDCG } from './taxComputation'
import { computeAMT } from './amt'
import type { AMTResult } from './amt'
import { computeChildTaxCredit } from './childTaxCredit'
import type { ChildTaxCreditResult } from './childTaxCredit'
import { computeEarnedIncomeCredit } from './earnedIncomeCredit'
import type { EarnedIncomeCreditResult } from './earnedIncomeCredit'
import { computeDependentCareCredit } from './dependentCareCredit'
import type { DependentCareCreditResult } from './dependentCareCredit'
import { computeSaversCredit } from './saversCredit'
import type { SaversCreditResult } from './saversCredit'
import { computeEnergyCredit } from './energyCredit'
import type { EnergyCreditResult } from './energyCredit'
import { computeEducationCredit } from './educationCredit'
import type { EducationCreditResult } from './educationCredit'
import {
  TAX_YEAR,
  NIIT_RATE,
  NIIT_THRESHOLD,
  ADDITIONAL_MEDICARE_RATE,
  ADDITIONAL_MEDICARE_THRESHOLD,
  MEDICARE_TAX_RATE,
} from './constants'
import { computeIRADeduction } from './iraDeduction'
import type { IRADeductionResult } from './iraDeduction'
import { computeHSADeduction } from './hsaDeduction'
import type { HSAResult } from './hsaDeduction'
import { computeStudentLoanDeduction } from './studentLoanDeduction'
import type { StudentLoanDeductionResult } from './studentLoanDeduction'
import { computeSchedule1 } from './schedule1'
import type { Schedule1Result } from './schedule1'
import { computeScheduleE } from './scheduleE'
import type { ScheduleEResult } from './scheduleE'
import { computeAllScheduleC } from './scheduleC'
import type { ScheduleCAggregateResult } from './scheduleC'
import { computeScheduleSE } from './scheduleSE'
import type { ScheduleSEResult } from './scheduleSE'
import { computeQBIDeduction } from './qbiDeduction'
import type { QBIDeductionResult, QBIBusinessInput } from './qbiDeduction'
import { computeTaxableSocialSecurity } from './socialSecurityBenefits'
import type { SocialSecurityBenefitsResult } from './socialSecurityBenefits'
import { computeSeniorDeduction } from './seniorDeduction'
import type { SeniorDeductionResult } from './seniorDeduction'
import { computeRefundableCredits } from './refundableCredits'
import type { RefundableCreditsResult } from './refundableCredits'
import { computeForeignTaxCredit } from './foreignTaxCredit'
import type { ForeignTaxCreditResult } from './foreignTaxCredit'
import { validateFederalReturn } from './federalValidation'
import type { FederalValidationResult } from './federalValidation'
import { computeK1Aggregate, computeK1RentalPAL } from './scheduleK1'
import type { K1AggregateResult, K1RentalPALResult } from './scheduleK1'
import {
  computeAlimonyReceived,
  computeEducatorExpenses,
  computeSEHealthInsurance,
  computeSESepSimple,
} from './schedule1Adjustments'
import type {
  AlimonyReceivedResult,
  EducatorExpensesResult,
  SEHealthInsuranceResult,
  SESepSimpleResult,
} from './schedule1Adjustments'
import { computeForm8582 } from './form8582'
import type { Form8582Result } from './form8582'
import { computeForm8606 } from './form8606'
import type { Form8606Result } from './form8606'

// ── Line 1a — Wages, salaries, tips ────────────────────────────
// Sum of all W-2 Box 1 values.

export function computeLine1a(model: TaxReturn): TracedValue {
  const inputIds = model.w2s.map(w => `w2:${w.id}:box1`)
  const total = model.w2s.reduce((sum, w) => sum + w.box1, 0)

  return tracedFromComputation(
    total,
    'form1040.line1a',
    inputIds,
    'Form 1040, Line 1a',
  )
}

// ── Line 1z — Total from Lines 1a through 1i ───────────────────
// Sum of all Line 1 sub-components.
// Currently: 1a (wages). Future sub-components (1b–1i) will be added here.

export function computeLine1z(line1a: TracedValue): TracedValue {
  // When we add 1b–1i, sum them here. For now, 1z = 1a.
  const inputs: string[] = ['form1040.line1a']
  return tracedFromComputation(
    line1a.amount,
    'form1040.line1z',
    inputs,
    'Form 1040, Line 1z',
  )
}

// ── Line 2a — Tax-exempt interest ──────────────────────────────
// Sum of all 1099-INT Box 8 values.
// MVP: supported via 1099-INT box8 field.

export function computeLine2a(model: TaxReturn): TracedValue {
  const inputIds = model.form1099INTs.map(f => `1099int:${f.id}:box8`)
  const total = model.form1099INTs.reduce((sum, f) => sum + f.box8, 0)

  return tracedFromComputation(
    total,
    'form1040.line2a',
    inputIds,
    'Form 1040, Line 2a',
  )
}

// ── Line 2b — Taxable interest ─────────────────────────────────
// Sum of all 1099-INT Box 1 values + K-1 interest income.

export function computeLine2b(model: TaxReturn, k1Interest: number = 0): TracedValue {
  const inputIds = model.form1099INTs.map(f => `1099int:${f.id}:box1`)
  let total = model.form1099INTs.reduce((sum, f) => sum + f.box1, 0)

  if (k1Interest !== 0) {
    total += k1Interest
    inputIds.push('k1.totalInterest')
  }

  return tracedFromComputation(
    total,
    'form1040.line2b',
    inputIds,
    'Form 1040, Line 2b',
  )
}

// ── Line 3a — Qualified dividends ──────────────────────────────
// Sum of all 1099-DIV Box 1b values.
// (Informational — used in QDCG worksheet, not added to total income.)
// Note: K-1 dividends are NOT added here because the K-1 data model does
// not yet capture the qualified/ordinary dividend breakdown. All K-1
// dividends flow to Line 3b as ordinary dividends (conservative).

export function computeLine3a(model: TaxReturn): TracedValue {
  const inputIds = model.form1099DIVs.map(f => `1099div:${f.id}:box1b`)
  const total = model.form1099DIVs.reduce((sum, f) => sum + f.box1b, 0)

  return tracedFromComputation(
    total,
    'form1040.line3a',
    inputIds,
    'Form 1040, Line 3a',
  )
}

// ── Line 3b — Ordinary dividends ───────────────────────────────
// Sum of all 1099-DIV Box 1a values + K-1 dividend income.

export function computeLine3b(model: TaxReturn, k1Dividends: number = 0): TracedValue {
  const inputIds = model.form1099DIVs.map(f => `1099div:${f.id}:box1a`)
  let total = model.form1099DIVs.reduce((sum, f) => sum + f.box1a, 0)

  if (k1Dividends !== 0) {
    total += k1Dividends
    inputIds.push('k1.totalDividends')
  }

  return tracedFromComputation(
    total,
    'form1040.line3b',
    inputIds,
    'Form 1040, Line 3b',
  )
}

// ── Line 4a — IRA distributions (gross) ─────────────────────────
// Sum of Box 1 from all 1099-R forms where IRA/SEP/SIMPLE is checked.
// When Form 8606 is present, also includes the Roth conversion amount
// (which may not appear on a 1099-R if it's a same-custodian transfer).

export function computeLine4a(model: TaxReturn, form8606Result?: Form8606Result | null): TracedValue {
  const iraForms = (model.form1099Rs ?? []).filter(f => f.iraOrSep)
  const inputIds = iraForms.map(f => `1099r:${f.id}:box1`)
  let total = iraForms.reduce((sum, f) => sum + f.box1, 0)

  // When Form 8606 computes a totalGrossIRA, use the larger of
  // the 1099-R gross or the Form 8606 computed gross.
  // This handles cases where the Roth conversion shows as a separate
  // transaction not captured in a standard IRA 1099-R.
  if (form8606Result && form8606Result.totalGrossIRA > total) {
    total = form8606Result.totalGrossIRA
    inputIds.push('form8606.totalGrossIRA')
  }

  return total > 0
    ? tracedFromComputation(total, 'form1040.line4a', inputIds, 'Form 1040, Line 4a')
    : tracedZero('form1040.line4a', 'Form 1040, Line 4a')
}

// ── Line 4b — IRA distributions (taxable) ───────────────────────
// Sum of Box 2a from IRA/SEP/SIMPLE 1099-Rs.
// Code G (direct rollover) and Code H (Roth rollover) → taxable = 0.
// When Form 8606 is present, use the Form 8606 pro-rata computation
// instead of raw 1099-R Box 2a values.

const NON_TAXABLE_CODES = new Set(['G', 'H'])

function is1099RNonTaxable(f: { box7: string }): boolean {
  return f.box7.split('').some(c => NON_TAXABLE_CODES.has(c))
}

export function computeLine4b(model: TaxReturn, form8606Result?: Form8606Result | null): TracedValue {
  // When Form 8606 is present, it computes the taxable amount using the pro-rata rule
  // This overrides the simple 1099-R Box 2a approach
  if (form8606Result) {
    const total = form8606Result.totalTaxableIRA
    return total > 0
      ? tracedFromComputation(total, 'form1040.line4b', ['form8606.totalTaxableIRA'], 'Form 1040, Line 4b')
      : tracedZero('form1040.line4b', 'Form 1040, Line 4b')
  }

  // Fallback: no Form 8606 → use 1099-R Box 2a
  const iraForms = (model.form1099Rs ?? []).filter(f => f.iraOrSep)
  const inputIds: string[] = []
  let total = 0

  for (const f of iraForms) {
    if (is1099RNonTaxable(f)) continue // rollover — not taxable
    total += f.box2a
    inputIds.push(`1099r:${f.id}:box2a`)
  }

  return total > 0
    ? tracedFromComputation(total, 'form1040.line4b', inputIds, 'Form 1040, Line 4b')
    : tracedZero('form1040.line4b', 'Form 1040, Line 4b')
}

// ── Line 5a — Pensions and annuities (gross) ───────────────────
// Sum of Box 1 from non-IRA 1099-Rs (401k, pension, annuity).

export function computeLine5a(model: TaxReturn): TracedValue {
  const pensionForms = (model.form1099Rs ?? []).filter(f => !f.iraOrSep)
  const inputIds = pensionForms.map(f => `1099r:${f.id}:box1`)
  const total = pensionForms.reduce((sum, f) => sum + f.box1, 0)

  return total > 0
    ? tracedFromComputation(total, 'form1040.line5a', inputIds, 'Form 1040, Line 5a')
    : tracedZero('form1040.line5a', 'Form 1040, Line 5a')
}

// ── Line 5b — Pensions and annuities (taxable) ─────────────────
// Sum of Box 2a from non-IRA 1099-Rs. Code G/H rollovers excluded.

export function computeLine5b(model: TaxReturn): TracedValue {
  const pensionForms = (model.form1099Rs ?? []).filter(f => !f.iraOrSep)
  const inputIds: string[] = []
  let total = 0

  for (const f of pensionForms) {
    if (is1099RNonTaxable(f)) continue
    total += f.box2a
    inputIds.push(`1099r:${f.id}:box2a`)
  }

  return total > 0
    ? tracedFromComputation(total, 'form1040.line5b', inputIds, 'Form 1040, Line 5b')
    : tracedZero('form1040.line5b', 'Form 1040, Line 5b')
}

// ── Line 6a — Social security benefits (gross) ─────────────────
// Sum of all SSA-1099 Box 5 (net benefits) values.
// Source: Form 1040, Line 6a

export function computeLine6a(model: TaxReturn): TracedValue {
  const ssaForms = model.formSSA1099s ?? []
  if (ssaForms.length === 0) {
    return tracedZero('form1040.line6a', 'Form 1040, Line 6a')
  }
  const inputIds = ssaForms.map(f => `ssa1099:${f.id}:box5`)
  const total = ssaForms.reduce((sum, f) => sum + f.box5, 0)

  return total !== 0
    ? tracedFromComputation(total, 'form1040.line6a', inputIds, 'Form 1040, Line 6a')
    : tracedZero('form1040.line6a', 'Form 1040, Line 6a')
}

// ── Line 6b — Social security benefits (taxable) ───────────────
// Computed via IRS Publication 915 worksheet.
// Requires "other income" (all income excluding SS benefits) to determine
// combined income and the applicable tier.
// This is a two-pass computation: we need a preliminary AGI without SS to
// compute the taxable SS amount, then include it in the final totals.

export function computeLine6b(
  ssResult: SocialSecurityBenefitsResult,
): TracedValue {
  if (ssResult.taxableBenefits <= 0) {
    return tracedZero('form1040.line6b', 'Form 1040, Line 6b')
  }
  return tracedFromComputation(
    ssResult.taxableBenefits,
    'form1040.line6b',
    ['form1040.line6a'],
    'Form 1040, Line 6b',
  )
}

// ── Line 7 — Capital gain or (loss) ───────────────────────────
// Reads from Schedule D Line 21 (or Line 16 if no 28%/unrecaptured gains).
// Accepts the Schedule D result as a parameter; returns $0 if not provided.
// The full implementation lives in scheduleD.ts (Step 6).

export function computeLine7(scheduleDResult?: TracedValue): TracedValue {
  if (scheduleDResult) {
    return tracedFromComputation(
      scheduleDResult.amount,
      'form1040.line7',
      ['scheduleD.line21'],
      'Form 1040, Line 7',
    )
  }
  return tracedZero('form1040.line7', 'Form 1040, Line 7')
}

// ── Line 8 — Other income from Schedule 1 ──────────────────────
// Schedule 1 Part I, Line 10 (additional income: rents, royalties, other)
// plus taxable HSA distributions.

export function computeLine8(schedule1?: Schedule1Result, hsaDeduction?: HSAResult | null): TracedValue {
  const schedule1Amount = schedule1?.line10.amount ?? 0
  const hsaTaxable = hsaDeduction?.taxableDistributions ?? 0
  const total = schedule1Amount + hsaTaxable

  if (total !== 0) {
    const inputs: string[] = []
    if (schedule1Amount !== 0) inputs.push('schedule1.line10')
    if (hsaTaxable > 0) inputs.push('hsa.taxableDistributions')
    return tracedFromComputation(total, 'form1040.line8', inputs, 'Form 1040, Line 8')
  }
  return tracedZero('form1040.line8', 'Form 1040, Line 8')
}

// ── Line 9 — Total income ─────────────────────────────────────
// Line 1z + Line 2b + Line 3b + Line 7 + Line 8
//
// Note: Line 3a (qualified dividends) is informational only —
// it's used in the QDCG worksheet but NOT added to total income.
// Ordinary dividends (Line 3b) includes qualified dividends as a subset.

export function computeLine9(
  model: TaxReturn,
  scheduleDResult?: TracedValue,
  schedule1Result?: Schedule1Result,
): TracedValue {
  const line1a = computeLine1a(model)
  const line1z = computeLine1z(line1a)
  const line2b = computeLine2b(model)
  const line3b = computeLine3b(model)
  const line7 = computeLine7(scheduleDResult)
  const line8 = computeLine8(schedule1Result)

  const total = line1z.amount + line2b.amount + line3b.amount + line7.amount + line8.amount

  return tracedFromComputation(
    total,
    'form1040.line9',
    [
      'form1040.line1z',
      'form1040.line2b',
      'form1040.line3b',
      'form1040.line7',
      'form1040.line8',
    ],
    'Form 1040, Line 9',
  )
}

// ── Line 10 — Adjustments to income ─────────────────────────────
// Schedule 1 Part II adjustments (IRA deduction, HSA deduction, etc.)

export function computeLine10(
  iraDeduction: IRADeductionResult | null,
  hsaDeduction: HSAResult | null,
  studentLoanDeduction: StudentLoanDeductionResult | null,
  seDeductibleHalf: number = 0,
  educatorExpenses: EducatorExpensesResult | null = null,
  seSepSimple: SESepSimpleResult | null = null,
  seHealthInsurance: SEHealthInsuranceResult | null = null,
): TracedValue {
  const ira = iraDeduction?.deductibleAmount ?? 0
  const hsa = hsaDeduction?.deductibleAmount ?? 0
  const studentLoan = studentLoanDeduction?.deductibleAmount ?? 0
  const educator = educatorExpenses?.totalDeduction ?? 0
  const sep = seSepSimple?.deductibleAmount ?? 0
  const seHealth = seHealthInsurance?.deductibleAmount ?? 0
  const amount = ira + hsa + studentLoan + seDeductibleHalf + educator + sep + seHealth
  const inputs: string[] = []
  if (educator > 0) inputs.push('adjustments.educatorExpenses')
  if (seDeductibleHalf > 0) inputs.push('adjustments.seDeductibleHalf')
  if (sep > 0) inputs.push('adjustments.seSepSimple')
  if (seHealth > 0) inputs.push('adjustments.seHealthInsurance')
  if (ira > 0) inputs.push('adjustments.ira')
  if (hsa > 0) inputs.push('adjustments.hsa')
  if (studentLoan > 0) inputs.push('adjustments.studentLoan')
  return amount > 0
    ? tracedFromComputation(amount, 'form1040.line10', inputs, 'Form 1040, Line 10')
    : tracedZero('form1040.line10', 'Form 1040, Line 10')
}

// ── Line 11 — Adjusted Gross Income ────────────────────────────
// Line 9 − Line 10

export function computeLine11(line9: TracedValue, line10: TracedValue): TracedValue {
  return tracedFromComputation(
    line9.amount - line10.amount,
    'form1040.line11',
    ['form1040.line9', 'form1040.line10'],
    'Form 1040, Line 11',
  )
}

// ── Line 12 — Deductions ────────────────────────────────────────
// Standard deduction or itemized deductions (Schedule A) — whichever is higher.
// If the model says 'standard', use the standard deduction.
// If 'itemized', compute Schedule A (applying medical floor, SALT cap, etc.)
// and use the larger of Schedule A total and standard deduction
// (higher-of logic protects the taxpayer).

export function computeLine12(
  model: TaxReturn,
  agi: number,
  netInvestmentIncome: number,
  earnedIncome: number,
  seniorDeduction?: SeniorDeductionResult | null,
): { deduction: TracedValue; scheduleA: ScheduleAResult | null; seniorDeduction: SeniorDeductionResult | null } {
  // Use OBBBA-enhanced senior deduction if computed, otherwise fallback to pre-OBBBA
  const additionalAmount = seniorDeduction
    ? seniorDeduction.totalAdditional
    : (() => {
        const additionalPer = ADDITIONAL_STANDARD_DEDUCTION[model.filingStatus]
        let count = 0
        if (model.deductions.taxpayerAge65) count++
        if (model.deductions.taxpayerBlind) count++
        if (model.filingStatus === 'mfj' || model.filingStatus === 'mfs') {
          if (model.deductions.spouseAge65) count++
          if (model.deductions.spouseBlind) count++
        }
        return additionalPer * count
      })()

  let standardAmount = STANDARD_DEDUCTION[model.filingStatus] + additionalAmount

  // Dependent filer limitation — IRC §63(c)(5)
  // Standard deduction limited to greater of $1,350 or earned income + $450,
  // but not more than the normal standard deduction. Additional deductions
  // for age 65+ / blind are added on top of the limited amount.
  if (model.canBeClaimedAsDependent) {
    const baseStandard = STANDARD_DEDUCTION[model.filingStatus]
    const limitedBase = Math.min(
      baseStandard,
      Math.max(DEPENDENT_FILER_MIN_DEDUCTION, earnedIncome + DEPENDENT_FILER_EARNED_INCOME_ADDON),
    )
    standardAmount = limitedBase + additionalAmount
  }

  if (model.deductions.method === 'itemized' && model.deductions.itemized) {
    const scheduleA = computeScheduleA(model, agi, netInvestmentIncome)
    const itemizedTotal = scheduleA.line17.amount

    if (itemizedTotal > standardAmount) {
      return {
        deduction: tracedFromComputation(
          itemizedTotal,
          'form1040.line12',
          ['scheduleA.line17'],
          'Form 1040, Line 12',
        ),
        scheduleA,
        seniorDeduction: seniorDeduction ?? null,
      }
    }

    // Itemized ≤ standard — fall back to standard but still return Schedule A
    // (so the user can see why standard was chosen)
    return {
      deduction: tracedFromComputation(
        standardAmount,
        'form1040.line12',
        ['standardDeduction'],
        'Form 1040, Line 12',
      ),
      scheduleA,
      seniorDeduction: seniorDeduction ?? null,
    }
  }

  return {
    deduction: tracedFromComputation(
      standardAmount,
      'form1040.line12',
      ['standardDeduction'],
      'Form 1040, Line 12',
    ),
    scheduleA: null,
    seniorDeduction: seniorDeduction ?? null,
  }
}

// ── Line 13 — Qualified business income deduction ───────────────
// IRC §199A — QBI deduction from Form 8995 (simplified) or Form 8995-A.

export function computeLine13(qbiResult?: QBIDeductionResult | null): TracedValue {
  if (qbiResult && qbiResult.deductionAmount > 0) {
    return qbiResult.line13
  }
  return tracedZero('form1040.line13', 'Form 1040, Line 13')
}

// ── Line 14 — Total deductions ──────────────────────────────────
// Line 12 + Line 13

export function computeLine14(line12: TracedValue, line13: TracedValue): TracedValue {
  return tracedFromComputation(
    line12.amount + line13.amount,
    'form1040.line14',
    ['form1040.line12', 'form1040.line13'],
    'Form 1040, Line 14',
  )
}

// ── Line 15 — Taxable income ───────────────────────────────────
// max(0, Line 11 − Line 14)

export function computeLine15(line11: TracedValue, line14: TracedValue): TracedValue {
  return tracedFromComputation(
    Math.max(0, line11.amount - line14.amount),
    'form1040.line15',
    ['form1040.line11', 'form1040.line14'],
    'Form 1040, Line 15',
  )
}

// ── Line 16 — Tax ──────────────────────────────────────────────
// If qualified dividends or net LTCG exist → QDCG worksheet.
// Otherwise → ordinary bracket computation.

export function computeLine16(
  taxableIncome: number,
  qualifiedDividends: number,
  scheduleD: ScheduleDResult | null,
  filingStatus: FilingStatus,
): TracedValue {
  let tax: number

  // Determine if QDCG worksheet applies
  const netCG = scheduleD
    ? netCapGainForQDCG(scheduleD.line15.amount, scheduleD.line16.amount)
    : 0
  const hasPreferential = qualifiedDividends > 0 || netCG > 0

  if (hasPreferential) {
    tax = computeQDCGTax(taxableIncome, qualifiedDividends, netCG, filingStatus)
  } else {
    tax = computeOrdinaryTax(taxableIncome, filingStatus)
  }

  return tracedFromComputation(
    tax,
    'form1040.line16',
    ['form1040.line15'],
    'Form 1040, Line 16',
  )
}

// ── Line 17 — Amount from Schedule 2, Part I, line 4 ──────────
// Schedule 2, Part I includes:
//   Line 1: Alternative Minimum Tax (Form 6251)
//   Line 2: Excess advance PTC repayment (Form 8962)
//   Line 3: Sum (→ Form 1040, Line 17)

export function computeLine17(
  taxableIncome: number,
  regularTax: number,
  filingStatus: FilingStatus,
  saltDeduction: number,
  isoExercises: TaxReturn['isoExercises'],
  qualifiedDividends: number,
  netLTCG: number,
  excessAPTCRepayment: number = 0,
): { traced: TracedValue; amtResult: AMTResult } {
  const amtResult = computeAMT(
    taxableIncome, regularTax, filingStatus,
    saltDeduction, isoExercises, 0,
    qualifiedDividends, netLTCG,
  )

  const total = amtResult.amt + excessAPTCRepayment
  const inputs: string[] = []
  if (amtResult.amt > 0) inputs.push('amt.amt')
  if (excessAPTCRepayment > 0) inputs.push('ptc.excessAPTCRepayment')

  const traced = total > 0
    ? tracedFromComputation(total, 'form1040.line17', inputs, 'Form 1040, Line 17')
    : tracedZero('form1040.line17', 'Form 1040, Line 17')

  return { traced, amtResult }
}

// ── Line 18 — Tax + Schedule 2 ─────────────────────────────────
// Line 16 + Line 17

export function computeLine18(line16: TracedValue, line17: TracedValue): TracedValue {
  return tracedFromComputation(
    line16.amount + line17.amount,
    'form1040.line18',
    ['form1040.line16', 'form1040.line17'],
    'Form 1040, Line 18',
  )
}

// ── Line 19 — Child tax credit (non-refundable) ───────────────
// Computed by childTaxCredit module; set externally in orchestrator.

// ── Line 20 — Other non-refundable credits ─────────────────────
// Computed in orchestrator from dependent care, saver's, and energy credits.

// ── Line 21 — Total credits (Line 19 + Line 20) ───────────────

export function computeLine21(line19: TracedValue, line20: TracedValue): TracedValue {
  return tracedFromComputation(
    line19.amount + line20.amount,
    'form1040.line21',
    ['form1040.line19', 'form1040.line20'],
    'Form 1040, Line 21',
  )
}

// ── Line 22 — Tax after credits ────────────────────────────────
// max(0, Line 18 − Line 21)

export function computeLine22(line18: TracedValue, line21: TracedValue): TracedValue {
  return tracedFromComputation(
    Math.max(0, line18.amount - line21.amount),
    'form1040.line22',
    ['form1040.line18', 'form1040.line21'],
    'Form 1040, Line 22',
  )
}

// ── Early withdrawal penalty (Form 5329, Part I) ────────────────
// 10% additional tax on early distributions from retirement plans.
// Applies when distribution code is "1" (early, no known exception).
// Exception codes (2, 3, 4, 7, G, H, T, etc.) are exempt.

const PENALTY_EXEMPT_CODES = new Set(['2', '3', '4', '5', '7', '8', '9', 'A', 'B', 'D', 'E', 'F', 'G', 'H', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'W'])

export interface EarlyWithdrawalPenaltyResult {
  penaltyAmount: number   // cents — 10% of taxable early distributions
  applicableForms: string[] // IDs of 1099-Rs that triggered the penalty
}

export function computeEarlyWithdrawalPenalty(model: TaxReturn): EarlyWithdrawalPenaltyResult {
  let penaltyBase = 0
  const applicableForms: string[] = []

  for (const f of (model.form1099Rs ?? [])) {
    // Check each character in box7 — code "1" triggers penalty
    const codes = f.box7.toUpperCase().split('')
    const hasPenaltyCode = codes.includes('1')
    const hasExemption = codes.some(c => PENALTY_EXEMPT_CODES.has(c))

    if (hasPenaltyCode && !hasExemption && f.box2a > 0) {
      penaltyBase += f.box2a
      applicableForms.push(f.id)
    }
  }

  return {
    penaltyAmount: Math.round(penaltyBase * 0.10),
    applicableForms,
  }
}

// ── Net Investment Income Tax (Form 8960) ──────────────────────
// IRC §1411: 3.8% tax on the lesser of:
//   (a) Net Investment Income (NII), or
//   (b) MAGI minus the filing-status threshold
//
// NII = taxable interest + ordinary dividends + net capital gain
//       + rental/royalty income + other investment income
//       (minus investment expenses — not modeled yet)
//
// For most individuals, MAGI = AGI.

export interface NIITResult {
  nii: number            // Net Investment Income (cents)
  magiExcess: number     // MAGI minus threshold (cents, floored to 0)
  niitAmount: number     // 3.8% * min(nii, magiExcess) (cents)
}

export function computeNIIT(
  model: TaxReturn,
  agi: number,
  netCapitalGain: number,
  scheduleEIncome: number,
  k1Result?: K1AggregateResult | null,
): NIITResult {
  const threshold = NIIT_THRESHOLD[model.filingStatus]
  const magiExcess = Math.max(0, agi - threshold)

  if (magiExcess === 0) {
    return { nii: 0, magiExcess: 0, niitAmount: 0 }
  }

  // Taxable interest (sum of 1099-INT box 1 + K-1 interest)
  const taxableInterest = model.form1099INTs.reduce((s, f) => s + f.box1, 0)
    + (k1Result?.totalInterest ?? 0)

  // Ordinary dividends (sum of 1099-DIV box 1a + K-1 dividends)
  const ordinaryDividends = model.form1099DIVs.reduce((s, f) => s + f.box1a, 0)
    + (k1Result?.totalDividends ?? 0)

  // Net capital gain (from Schedule D line 21, already includes K-1 cap gains)
  const capGain = Math.max(0, netCapitalGain)

  // Rental/royalty income from Schedule E + K-1 rental income (net, can be negative)
  const rentalIncome = Math.max(0, scheduleEIncome + (k1Result?.totalRentalIncome ?? 0))

  // Other investment income from 1099-MISC (rents box 1, royalties box 2)
  const miscInvestmentIncome = (model.form1099MISCs ?? []).reduce(
    (s, f) => s + f.box1 + f.box2, 0,
  )

  const nii = Math.max(0, taxableInterest + ordinaryDividends + capGain + rentalIncome + miscInvestmentIncome)

  const taxBase = Math.min(nii, magiExcess)
  const niitAmount = Math.round(taxBase * NIIT_RATE)

  return { nii, magiExcess, niitAmount }
}

// ── Additional Medicare Tax (Form 8959) ────────────────────────
// IRC §3101(b)(2): 0.9% additional tax on Medicare wages exceeding
// the filing-status threshold ($200K single, $250K MFJ, $125K MFS).
//
// Employers withhold regular Medicare tax (1.45%) but do NOT
// withhold the additional 0.9% based on filing status. They only
// withhold it on wages over $200K regardless of filing status.
//
// The employee reconciles on Form 8959:
//   Tax: 0.9% * max(0, totalMedicareWages - threshold)
//   Withholding credit: max(0, totalMedicareWithheld - 1.45% * totalMedicareWages)
//   (credit flows to Schedule 3 Line 11 → Form 1040 Line 31)

export interface AdditionalMedicareTaxResult {
  medicareWages: number        // Total Medicare wages (cents, sum of W-2 box 5)
  threshold: number            // Filing status threshold (cents)
  excessWages: number          // Medicare wages above threshold (cents)
  additionalTax: number        // 0.9% * excessWages (cents)
  withholdingCredit: number    // Excess Medicare withholding credit (cents)
}

export function computeAdditionalMedicareTax(model: TaxReturn): AdditionalMedicareTaxResult {
  const threshold = ADDITIONAL_MEDICARE_THRESHOLD[model.filingStatus]

  // Sum of W-2 box 5 (Medicare wages) across all W-2s
  const medicareWages = model.w2s.reduce((s, w) => s + w.box5, 0)

  // Sum of W-2 box 6 (Medicare tax withheld) — includes regular + any additional
  const medicareWithheld = model.w2s.reduce((s, w) => s + w.box6, 0)

  const excessWages = Math.max(0, medicareWages - threshold)
  const additionalTax = Math.round(excessWages * ADDITIONAL_MEDICARE_RATE)

  // Withholding credit: employer withheld more than the regular 1.45% rate
  const regularMedicareTax = Math.round(medicareWages * MEDICARE_TAX_RATE)
  const withholdingCredit = Math.max(0, medicareWithheld - regularMedicareTax)

  return { medicareWages, threshold, excessWages, additionalTax, withholdingCredit }
}

// ── Line 23 — Other taxes (Schedule 2, Part II) ────────────────
// Includes: HSA penalties, early withdrawal penalty (Form 5329),
// NIIT (Form 8960), and Additional Medicare Tax (Form 8959).

export function computeLine23(
  hsaDeduction: HSAResult | null | undefined,
  earlyWithdrawal: EarlyWithdrawalPenaltyResult | null,
  niit: NIITResult | null,
  additionalMedicare: AdditionalMedicareTaxResult | null,
  selfEmploymentTax: number = 0,
  householdEmploymentTaxes: number = 0,
): TracedValue {
  const hsaDistPenalty = hsaDeduction?.distributionPenalty ?? 0
  const hsaExcessPenalty = hsaDeduction?.excessPenalty ?? 0
  const hsaPenalties = hsaDistPenalty + hsaExcessPenalty
  const earlyPenalty = earlyWithdrawal?.penaltyAmount ?? 0
  const niitAmount = niit?.niitAmount ?? 0
  const additionalMedicareAmount = additionalMedicare?.additionalTax ?? 0
  const total = hsaPenalties + earlyPenalty + niitAmount + additionalMedicareAmount + selfEmploymentTax + householdEmploymentTaxes

  if (total > 0) {
    const inputs: string[] = []
    if (selfEmploymentTax > 0) inputs.push('scheduleSE.line6')
    if (householdEmploymentTaxes > 0) inputs.push('scheduleH.totalTax')
    if (hsaPenalties > 0) inputs.push('hsa.penalties')
    if (earlyPenalty > 0) inputs.push('form5329.earlyWithdrawalPenalty')
    if (niitAmount > 0) inputs.push('form8960.niit')
    if (additionalMedicareAmount > 0) inputs.push('form8959.additionalMedicareTax')
    return tracedFromComputation(total, 'form1040.line23', inputs, 'Form 1040, Line 23')
  }
  return tracedZero('form1040.line23', 'Form 1040, Line 23')
}

// ── Line 24 — Total tax ────────────────────────────────────────
// Line 22 + Line 23

export function computeLine24(line22: TracedValue, line23: TracedValue): TracedValue {
  return tracedFromComputation(
    line22.amount + line23.amount,
    'form1040.line24',
    ['form1040.line22', 'form1040.line23'],
    'Form 1040, Line 24',
  )
}

// ── Line 25 — Federal income tax withheld ──────────────────────
// Sum of W-2 Box 2 + 1099-INT Box 4 + 1099-DIV Box 4 + 1099-MISC Box 4 + 1099-NEC Box 4 + 1099-G Box 4 + 1099-B withholding.

export function computeLine25(model: TaxReturn): TracedValue {
  const inputIds: string[] = []
  let total = 0

  for (const w2 of model.w2s) {
    total += w2.box2
    inputIds.push(`w2:${w2.id}:box2`)
  }

  for (const f of model.form1099INTs) {
    if (f.box4 > 0) {
      total += f.box4
      inputIds.push(`1099int:${f.id}:box4`)
    }
  }

  for (const f of model.form1099DIVs) {
    if (f.box4 > 0) {
      total += f.box4
      inputIds.push(`1099div:${f.id}:box4`)
    }
  }

  for (const f of (model.form1099MISCs ?? [])) {
    if (f.box4 > 0) {
      total += f.box4
      inputIds.push(`1099misc:${f.id}:box4`)
    }
  }

  for (const f of (model.form1099Rs ?? [])) {
    if (f.box4 > 0) {
      total += f.box4
      inputIds.push(`1099r:${f.id}:box4`)
    }
  }

  for (const f of (model.form1099Gs ?? [])) {
    if (f.box4 > 0) {
      total += f.box4
      inputIds.push(`1099g:${f.id}:box4`)
    }
  }

  for (const f of model.form1099Bs) {
    if (f.federalTaxWithheld > 0) {
      total += f.federalTaxWithheld
      inputIds.push(`1099b:${f.id}:federalTaxWithheld`)
    }
  }

  // 1099-NEC Box 4 — federal income tax withheld (backup withholding)
  for (const f of (model.form1099NECs ?? [])) {
    if ((f.federalTaxWithheld ?? 0) > 0) {
      total += f.federalTaxWithheld!
      inputIds.push(`1099nec:${f.id}:box4`)
    }
  }

  // SSA-1099 Box 6 — voluntary federal income tax withheld
  for (const f of (model.formSSA1099s ?? [])) {
    if (f.box6 > 0) {
      total += f.box6
      inputIds.push(`ssa1099:${f.id}:box6`)
    }
  }

  return tracedFromComputation(
    total,
    'form1040.line25',
    inputIds,
    'Form 1040, Line 25',
  )
}

// ── Line 26 — Estimated tax payments ────────────────────────────
// Sum of quarterly Form 1040-ES payments.

export function computeLine26(model: TaxReturn): TracedValue {
  const payments = model.estimatedTaxPayments
  if (!payments) return tracedZero('form1040.line26', 'Form 1040, Line 26')

  const total = (payments.q1 ?? 0) + (payments.q2 ?? 0) + (payments.q3 ?? 0) + (payments.q4 ?? 0)
  if (total <= 0) return tracedZero('form1040.line26', 'Form 1040, Line 26')

  return tracedFromComputation(
    total,
    'form1040.line26',
    ['estimatedTax.q1', 'estimatedTax.q2', 'estimatedTax.q3', 'estimatedTax.q4'],
    'Form 1040, Line 26',
  )
}

// ── Line 27 — Earned income credit ─────────────────────────────
// Computed by earnedIncomeCredit module; set externally in orchestrator.

// ── Line 28 — Additional child tax credit (refundable) ────────
// Computed by childTaxCredit module; set externally in orchestrator.

// ── Line 29 — American opportunity credit (refundable) ────────
// 40% of AOTC is refundable (max $1,000 per student).

export function computeLine29(educationCredit: EducationCreditResult | null): TracedValue {
  const amount = educationCredit?.totalRefundable ?? 0
  return amount > 0
    ? tracedFromComputation(amount, 'form1040.line29', ['credits.aotcRefundable'], 'Form 1040, Line 29')
    : tracedZero('form1040.line29', 'Form 1040, Line 29')
}

// ── Line 31 — Other refundable credits ─────────────────────────
// Computed via the refundable credits framework (excess SS withholding, etc.)

export function computeLine31(refundableCredits?: RefundableCreditsResult | null): TracedValue {
  const amount = refundableCredits?.totalLine31 ?? 0
  if (amount <= 0) {
    return tracedZero('form1040.line31', 'Form 1040, Line 31')
  }
  const inputs = (refundableCredits?.items ?? []).map(item => `refundableCredit.${item.creditId}`)
  return tracedFromComputation(amount, 'form1040.line31', inputs, 'Form 1040, Line 31')
}

// ── Line 32 — Total other payments and refundable credits ──────
// Line 27 + Line 28 + Line 29 + Line 31

export function computeLine32(
  line27: TracedValue,
  line28: TracedValue,
  line29: TracedValue,
  line31: TracedValue,
): TracedValue {
  return tracedFromComputation(
    line27.amount + line28.amount + line29.amount + line31.amount,
    'form1040.line32',
    ['form1040.line27', 'form1040.line28', 'form1040.line29', 'form1040.line31'],
    'Form 1040, Line 32',
  )
}

// ── Line 33 — Total payments ───────────────────────────────────
// Line 25 + Line 26 + Line 32

export function computeLine33(line25: TracedValue, line26: TracedValue, line32: TracedValue): TracedValue {
  const inputs = ['form1040.line25']
  if (line26.amount > 0) inputs.push('form1040.line26')
  inputs.push('form1040.line32')
  return tracedFromComputation(
    line25.amount + line26.amount + line32.amount,
    'form1040.line33',
    inputs,
    'Form 1040, Line 33',
  )
}

// ── Line 34 — Overpayment (refund) ─────────────────────────────
// If Line 33 > Line 24 → refund amount. Otherwise $0.

export function computeLine34(line33: TracedValue, line24: TracedValue): TracedValue {
  const overpayment = line33.amount > line24.amount
    ? line33.amount - line24.amount
    : 0

  return tracedFromComputation(
    overpayment,
    'form1040.line34',
    ['form1040.line33', 'form1040.line24'],
    'Form 1040, Line 34',
  )
}

// ── Line 37 — Amount you owe ───────────────────────────────────
// If Line 24 > Line 33 → amount owed. Otherwise $0.

export function computeLine37(line24: TracedValue, line33: TracedValue): TracedValue {
  const owed = line24.amount > line33.amount
    ? line24.amount - line33.amount
    : 0

  return tracedFromComputation(
    owed,
    'form1040.line37',
    ['form1040.line24', 'form1040.line33'],
    'Form 1040, Line 37',
  )
}

// ── Full Form 1040 result ──────────────────────────────────────

export interface Form1040Result {
  // Income (Lines 1–9)
  line1a: TracedValue
  line1z: TracedValue
  line2a: TracedValue
  line2b: TracedValue
  line3a: TracedValue
  line3b: TracedValue
  line4a: TracedValue
  line4b: TracedValue
  line5a: TracedValue
  line5b: TracedValue
  line6a: TracedValue
  line6b: TracedValue
  line7: TracedValue
  line8: TracedValue
  line9: TracedValue

  // Adjustments & AGI (Lines 10–11)
  line10: TracedValue
  line11: TracedValue

  // Deductions (Lines 12–15)
  line12: TracedValue
  line13: TracedValue
  line14: TracedValue
  line15: TracedValue

  // Tax & Credits (Lines 16–24)
  line16: TracedValue
  line17: TracedValue
  line18: TracedValue
  line19: TracedValue
  line20: TracedValue
  line21: TracedValue
  line22: TracedValue
  line23: TracedValue
  line24: TracedValue

  // Payments & Refundable Credits (Lines 25–33)
  line25: TracedValue
  line26: TracedValue
  line27: TracedValue
  line28: TracedValue
  line29: TracedValue
  line31: TracedValue
  line32: TracedValue
  line33: TracedValue

  // Refund or amount owed (Lines 34, 37)
  line34: TracedValue
  line37: TracedValue

  // Child Tax Credit detail (null if no dependents)
  childTaxCredit: ChildTaxCreditResult | null

  // Earned Income Credit detail
  earnedIncomeCredit: EarnedIncomeCreditResult | null

  // Other credits detail (Line 20 components)
  dependentCareCredit: DependentCareCreditResult | null
  saversCredit: SaversCreditResult | null
  energyCredit: EnergyCreditResult | null
  educationCredit: EducationCreditResult | null

  // IRA deduction detail (Schedule 1, Line 20)
  iraDeduction: IRADeductionResult | null

  // Student loan interest deduction (Schedule 1, Line 21)
  studentLoanDeduction: StudentLoanDeductionResult | null

  // HSA deduction detail (Form 8889)
  hsaResult: HSAResult | null

  // Schedule 1 additional adjustments
  alimonyReceivedResult: AlimonyReceivedResult | null
  educatorExpensesResult: EducatorExpensesResult | null
  seSepSimpleResult: SESepSimpleResult | null
  seHealthInsuranceResult: SEHealthInsuranceResult | null
  householdEmploymentTaxes: number  // cents (Schedule H → Schedule 2 Line 9)

  // AMT detail (Form 6251)
  amtResult: AMTResult | null

  // Early withdrawal penalty (Form 5329)
  earlyWithdrawalPenalty: EarlyWithdrawalPenaltyResult | null

  // Net Investment Income Tax (Form 8960)
  niitResult: NIITResult | null

  // Additional Medicare Tax (Form 8959)
  additionalMedicareTaxResult: AdditionalMedicareTaxResult | null

  // Social Security benefits detail (Lines 6a/6b)
  socialSecurityResult: SocialSecurityBenefitsResult | null

  // OBBBA senior deduction detail (§70104)
  seniorDeduction: SeniorDeductionResult | null

  // Line 31 refundable credits detail
  refundableCreditsResult: RefundableCreditsResult | null

  // Schedule C detail (sole proprietorship)
  scheduleCResult: ScheduleCAggregateResult | null

  // Schedule SE detail (self-employment tax)
  scheduleSEResult: ScheduleSEResult | null

  // QBI deduction detail (IRC §199A)
  qbiResult: QBIDeductionResult | null

  // K-1 aggregate result (passthrough entity income)
  k1Result: K1AggregateResult | null

  // K-1 rental PAL guardrail result (null if no K-1 rental losses)
  k1RentalPAL: K1RentalPALResult | null

  // Foreign Tax Credit detail (Form 1116)
  foreignTaxCreditResult: ForeignTaxCreditResult | null

  // Form 8606 detail (Nondeductible IRAs / Roth Conversions)
  form8606Result: Form8606Result | null

  // Federal validation warnings
  validation: FederalValidationResult | null

  // Form 8582 — Passive Activity Loss Limitations
  form8582Result: Form8582Result | null

  // Attached schedules
  schedule1: Schedule1Result | null
  scheduleA: ScheduleAResult | null
  scheduleD: ScheduleDResult | null
  scheduleE: ScheduleEResult | null
}

// ── Full orchestrator ──────────────────────────────────────────

/**
 * Compute the entire Form 1040 for a tax return.
 *
 * Orchestrates all income, deduction, tax, payment, and result lines.
 * Automatically computes Schedule D when capital activity exists.
 */
export function computeForm1040(model: TaxReturn): Form1040Result {
  // K-1 aggregate (compute if there are K-1 forms)
  const k1s = model.scheduleK1s ?? []
  const hasK1 = k1s.length > 0
  const k1Result = hasK1 ? computeK1Aggregate(k1s) : null

  // Schedule D (compute if there are capital transactions, cap gain distributions, or K-1 cap gains)
  const hasCapitalActivity =
    model.capitalTransactions.length > 0 ||
    model.form1099DIVs.some(f => f.box2a > 0) ||
    (k1Result !== null && (k1Result.totalSTCapitalGain !== 0 || k1Result.totalLTCapitalGain !== 0))
  const scheduleD = hasCapitalActivity
    ? computeScheduleD(
        model,
        k1Result?.totalSTCapitalGain ?? 0,
        k1Result?.totalLTCapitalGain ?? 0,
      )
    : null

  // Schedule C (compute if there are sole proprietorship businesses)
  const hasScheduleC = (model.scheduleCBusinesses ?? []).length > 0
  const scheduleCResult = hasScheduleC
    ? computeAllScheduleC(model.scheduleCBusinesses)
    : null

  // 1099-NEC: aggregate Box 1 amounts as self-employment income
  // This flows to Schedule C gross receipts / Schedule 1 Line 3 and triggers SE tax
  const nec1099Total = (model.form1099NECs ?? []).reduce(
    (sum, f) => sum + (f.nonemployeeCompensation ?? 0), 0,
  )
  const has1099NEC = nec1099Total > 0

  // Schedule SE (compute if there is SE income from Schedule C, 1099-NEC, or K-1 Box 14)
  const w2SSWages = model.w2s.reduce((sum, w) => sum + w.box3, 0)
  const scheduleCNetProfit = (scheduleCResult?.totalNetProfitCents ?? 0) + nec1099Total
  const k1SEEarnings = k1Result?.totalSEEarnings ?? 0
  const k1GuaranteedPayments = k1Result?.totalGuaranteedPayments ?? 0
  // Guaranteed payments are always subject to SE tax (IRC §1402(a))
  const totalK1SE = k1SEEarnings + k1GuaranteedPayments
  const hasSEIncome = scheduleCNetProfit > 0 || totalK1SE > 0
  const scheduleSEResult = hasSEIncome
    ? computeScheduleSE(scheduleCNetProfit, w2SSWages, model.filingStatus, totalK1SE)
    : null

  // Schedule E (compute if there are rental properties)
  const hasScheduleEProperties = (model.scheduleEProperties ?? []).length > 0
  // Compute a preliminary AGI for PAL phase-out: total income minus adjustments,
  // but without Schedule E itself (to avoid circular dependency).
  // We'll use line9 without Schedule E contribution as a proxy.
  let scheduleE: ScheduleEResult | null = null
  if (hasScheduleEProperties) {
    // Preliminary AGI: wages + interest + dividends + cap gains + Schedule C + K-1 (no Schedule E yet)
    const prelimLine1a = computeLine1a(model)
    const prelimLine2b = computeLine2b(model, k1Result?.totalInterest ?? 0)
    const prelimLine3b = computeLine3b(model, k1Result?.totalDividends ?? 0)
    const prelimLine7 = computeLine7(scheduleD?.line21)
    const schedCIncome = (scheduleCResult?.totalNetProfitCents ?? 0) + nec1099Total
    const k1PassthroughIncome = k1Result?.totalPassthroughIncome ?? 0
    const prelimAGI = prelimLine1a.amount + prelimLine2b.amount + prelimLine3b.amount + prelimLine7.amount + schedCIncome + k1PassthroughIncome
    scheduleE = computeScheduleE(model.scheduleEProperties, model.filingStatus, prelimAGI)
  }

  // Form 8582 — Passive Activity Loss Limitations
  const mfsLivedApart = model.deductions.mfsLivedApartAllYear ?? false
  let form8582Result: Form8582Result | null = null
  if (scheduleE) {
    // Use the same preliminary AGI that was used for the Schedule E PAL computation
    const prelimLine1a = computeLine1a(model)
    const prelimLine2b = computeLine2b(model, k1Result?.totalInterest ?? 0)
    const prelimLine3b = computeLine3b(model, k1Result?.totalDividends ?? 0)
    const prelimLine7 = computeLine7(scheduleD?.line21)
    const schedCIncome = scheduleCResult?.totalNetProfitCents ?? 0
    const k1PassthroughIncome = k1Result?.totalPassthroughIncome ?? 0
    const form8582AGI = prelimLine1a.amount + prelimLine2b.amount + prelimLine3b.amount + prelimLine7.amount + schedCIncome + k1PassthroughIncome
    form8582Result = computeForm8582(scheduleE, form8582AGI, model.filingStatus, mfsLivedApart)
  }

  // K-1 Rental PAL guardrail — apply after Schedule E so we can coordinate the shared $25K allowance
  let k1RentalPAL: K1RentalPALResult | null = null
  let k1ResultForSchedule1 = k1Result
  if (k1Result && k1Result.totalRentalIncome < 0) {
    // Compute PAL-limited K-1 rental income, sharing the $25K allowance with Schedule E
    const scheduleEPALUsed = scheduleE
      ? Math.abs(Math.min(0, scheduleE.line25.amount))  // how much of the $25K Schedule E consumed
      : 0
    // Preliminary AGI for K-1 PAL (same proxy as Schedule E uses)
    const prelimLine1a = hasScheduleEProperties ? 0 : computeLine1a(model).amount  // avoid recomputing if already done
    const palAGI = hasScheduleEProperties
      ? (computeLine1a(model).amount + computeLine2b(model, k1Result.totalInterest).amount +
         computeLine3b(model, k1Result.totalDividends).amount +
         computeLine7(scheduleD?.line21).amount + (scheduleCResult?.totalNetProfitCents ?? 0) + nec1099Total +
         k1Result.totalPassthroughIncome)
      : (prelimLine1a + computeLine2b(model, k1Result.totalInterest).amount +
         computeLine3b(model, k1Result.totalDividends).amount +
         computeLine7(scheduleD?.line21).amount + (scheduleCResult?.totalNetProfitCents ?? 0) + nec1099Total +
         k1Result.totalPassthroughIncome)
    k1RentalPAL = computeK1RentalPAL(
      k1Result.totalRentalIncome,
      palAGI,
      model.filingStatus,
      scheduleEPALUsed,
    )
    // Create an adjusted K-1 result with PAL-limited rental income for Schedule 1
    k1ResultForSchedule1 = {
      ...k1Result,
      totalRentalIncome: k1RentalPAL.allowedRentalIncome,
      totalPassthroughIncome: k1Result.totalOrdinaryIncome + k1RentalPAL.allowedRentalIncome + k1Result.totalGuaranteedPayments,
    }
  }

  // ── Schedule 1 additional adjustments (no income dependency) ──────
  const alimonyReceivedResult = computeAlimonyReceived(model)
  const educatorExpensesResult = computeEducatorExpenses(model)
  const seSepSimpleResult = computeSESepSimple(model)
  const seHealthInsuranceResult = computeSEHealthInsurance(model, scheduleCNetProfit)
  const householdEmploymentTaxes = model.householdEmploymentTaxes ?? 0

  // Schedule 1 (compute if there is 1099-MISC income, 1099-G income, Schedule E, Schedule C, K-1, or alimony)
  const has1099MISCIncome = (model.form1099MISCs ?? []).some(
    f => f.box1 > 0 || f.box2 > 0 || f.box3 > 0,
  )
  const has1099GIncome = (model.form1099Gs ?? []).some(
    f => f.box1 > 0 || f.box2 > 0,
  )
  const hasK1Passthrough = (k1ResultForSchedule1?.totalPassthroughIncome ?? 0) !== 0
  const hasAlimony = alimonyReceivedResult !== null
  const needSchedule1 = has1099MISCIncome || has1099GIncome || has1099NEC || hasScheduleEProperties || hasScheduleC || hasK1Passthrough || hasSEIncome || hasAlimony
  const schedule1 = needSchedule1
    ? computeSchedule1(model, scheduleE ?? undefined, scheduleCResult ?? undefined, scheduleSEResult ?? undefined, k1ResultForSchedule1 ?? undefined, alimonyReceivedResult)
    : null

  // ── HSA (computed early — no dependency on Line 9) ──────
  const hsaResult = computeHSADeduction(model)

  // ── Form 8606 (Nondeductible IRAs / Roth Conversions) ──────
  const form8606Result = computeForm8606(model)

  // ── Income ──────────────────────────────────────────────
  const line1a = computeLine1a(model)
  const line1z = computeLine1z(line1a)
  const line2a = computeLine2a(model)
  const line2b = computeLine2b(model, k1Result?.totalInterest ?? 0)
  const line3a = computeLine3a(model)
  const line3b = computeLine3b(model, k1Result?.totalDividends ?? 0)
  const line4a = computeLine4a(model, form8606Result)
  const line4b = computeLine4b(model, form8606Result)
  const line5a = computeLine5a(model)
  const line5b = computeLine5b(model)
  const line6a = computeLine6a(model)
  const line7 = computeLine7(scheduleD?.line21)
  const line8 = computeLine8(schedule1 ?? undefined, hsaResult)

  // SS taxable benefits require "other income" (all income minus SS).
  // We compute preliminary other income first, then determine the taxable SS amount.
  const otherIncomeExclSS =
    line1z.amount + line2b.amount + line3b.amount + line4b.amount + line5b.amount +
    line7.amount + line8.amount
  const taxExemptInterest = line2a.amount

  const ssaForms = model.formSSA1099s ?? []
  const grossSSBenefits = ssaForms.reduce((sum, f) => sum + f.box5, 0)
  const ssaFederalWithheld = ssaForms.reduce((sum, f) => sum + f.box6, 0)

  let socialSecurityResult: SocialSecurityBenefitsResult | null = null
  let line6b: TracedValue

  if (grossSSBenefits > 0) {
    const mfsLivedApart = model.deductions.mfsLivedApartAllYear ?? false
    socialSecurityResult = computeTaxableSocialSecurity(
      grossSSBenefits,
      otherIncomeExclSS,
      taxExemptInterest,
      model.filingStatus,
      ssaFederalWithheld,
      mfsLivedApart,
    )
    line6b = computeLine6b(socialSecurityResult)
  } else {
    line6b = tracedZero('form1040.line6b', 'Form 1040, Line 6b')
  }

  const line9Inputs = [
    'form1040.line1z', 'form1040.line2b', 'form1040.line3b',
    'form1040.line4b', 'form1040.line5b', 'form1040.line6b',
    'form1040.line7', 'form1040.line8',
  ]
  const line9 = tracedFromComputation(
    line1z.amount + line2b.amount + line3b.amount + line4b.amount + line5b.amount +
    line6b.amount + line7.amount + line8.amount,
    'form1040.line9',
    line9Inputs,
    'Form 1040, Line 9',
  )

  // ── Adjustments & AGI ───────────────────────────────────
  // MAGI for IRA deduction = Line 9 (total income), per IRC §219(g)(3)(A)(ii)
  const iraDeduction = computeIRADeduction(model, line9.amount)

  // MAGI for student loan = Line 9 - IRA deduction - HSA deduction
  // (all other adjustments subtracted, but not student loan itself)
  const studentLoanMAGI = line9.amount
    - (iraDeduction?.deductibleAmount ?? 0)
    - (hsaResult?.deductibleAmount ?? 0)
  const studentLoanDeduction = computeStudentLoanDeduction(model, studentLoanMAGI)

  const seDeductibleHalf = scheduleSEResult?.deductibleHalfCents ?? 0
  const line10 = computeLine10(
    iraDeduction, hsaResult, studentLoanDeduction, seDeductibleHalf,
    educatorExpensesResult, seSepSimpleResult, seHealthInsuranceResult,
  )
  const line11 = computeLine11(line9, line10)

  // ── Deductions ──────────────────────────────────────────
  // Earned income = sum of W-2 Box 1 + net SE earnings (used for dependent filer deduction limit and credits)
  const w2Wages = model.w2s.reduce((sum, w) => sum + w.box1, 0)
  const netSEEarnings = scheduleSEResult?.netSEEarnings ?? 0
  const earnedIncome = w2Wages + Math.max(0, netSEEarnings)

  // Net investment income for Form 4952 investment interest limit.
  // Includes: taxable interest + non-qualified dividends + net ST capital gains.
  const nonQualifiedDivs = Math.max(0, line3b.amount - line3a.amount)
  const netSTGain = Math.max(0, scheduleD?.line7.amount ?? 0)
  const netInvestmentIncome = line2b.amount + nonQualifiedDivs + netSTGain

  // OBBBA senior deduction — compute enhanced additional standard deduction
  const seniorDeductionResult = computeSeniorDeduction(
    model.filingStatus,
    model.deductions.taxpayerAge65,
    model.deductions.taxpayerBlind,
    model.deductions.spouseAge65,
    model.deductions.spouseBlind,
  )

  const { deduction: line12, scheduleA } = computeLine12(model, line11.amount, netInvestmentIncome, earnedIncome, seniorDeductionResult)

  // QBI deduction (IRC §199A) — compute if there is QBI from Schedule C, 1099-NEC, or K-1
  const scheduleCQBI = (scheduleCResult?.totalNetProfitCents ?? 0) + nec1099Total
  const k1QBI = (model.scheduleK1s ?? []).reduce((sum, k) => sum + k.section199AQBI, 0)
  const taxableIncomeBeforeQBI = Math.max(0, line11.amount - line12.amount)
  let qbiResult: QBIDeductionResult | null = null
  if (scheduleCQBI !== 0 || k1QBI !== 0) {
    // Build per-business QBI inputs for Form 8995-A (above-threshold path)
    const qbiBusinesses: QBIBusinessInput[] = []
    if (scheduleCResult) {
      for (const biz of scheduleCResult.businesses) {
        const schedC = (model.scheduleCBusinesses ?? []).find(c => c.id === biz.businessId)
        qbiBusinesses.push({
          id: biz.businessId,
          name: biz.businessName,
          qbi: biz.line31.amount,
          w2Wages: schedC?.qbiW2Wages ?? 0,
          ubia: schedC?.qbiUBIA ?? 0,
          isSSTB: schedC?.isSSTB ?? false,
        })
      }
    }
    for (const k1 of (model.scheduleK1s ?? [])) {
      if (k1.section199AQBI !== 0) {
        qbiBusinesses.push({
          id: k1.id,
          name: k1.entityName,
          qbi: k1.section199AQBI,
          w2Wages: k1.section199AW2Wages ?? 0,
          ubia: k1.section199AUBIA ?? 0,
          isSSTB: k1.isSSTB ?? false,
        })
      }
    }
    qbiResult = computeQBIDeduction(scheduleCQBI, k1QBI, taxableIncomeBeforeQBI, model.filingStatus, qbiBusinesses)
  }
  const line13 = computeLine13(qbiResult)
  const line14 = computeLine14(line12, line13)
  const line15 = computeLine15(line11, line14)

  // ── Refundable credits (early — PTC needs AGI, excess APTC flows to Line 17) ──
  const refundableCreditsResult = computeRefundableCredits(model, line11.amount)
  const excessAPTCRepayment = refundableCreditsResult.excessAPTCRepayment

  // ── Tax ─────────────────────────────────────────────────
  const line16 = computeLine16(line15.amount, line3a.amount, scheduleD, model.filingStatus)

  const saltDeduction = scheduleA?.line7.amount ?? 0
  const netLTCG = Math.max(0, scheduleD?.line15.amount ?? 0)
  const { traced: line17, amtResult } = computeLine17(
    line15.amount, line16.amount, model.filingStatus,
    saltDeduction, model.isoExercises ?? [],
    line3a.amount, netLTCG,
    excessAPTCRepayment,
  )

  const line18 = computeLine18(line16, line17)

  // ── Credits ────────────────────────────────────────────
  const childTaxCredit = model.dependents.length > 0
    ? computeChildTaxCredit(model.dependents, model.filingStatus, line11.amount, line18.amount, earnedIncome)
    : null

  const line19 = childTaxCredit
    ? tracedFromComputation(
        childTaxCredit.nonRefundableCredit,
        'form1040.line19',
        ['ctc.creditAfterPhaseOut'],
        'Form 1040, Line 19',
      )
    : tracedZero('form1040.line19', 'Form 1040, Line 19')

  // ── Other non-refundable credits (Line 20) ────────────────
  // Foreign Tax Credit (Form 1116) — Schedule 3, Part I, Line 1
  const foreignTaxCreditResult = computeForeignTaxCredit(model, line15.amount, line16.amount)

  const dependentCareCredit = model.dependentCare
    ? computeDependentCareCredit(model.dependentCare, model.dependents, line11.amount, earnedIncome)
    : null

  const saversCredit = model.retirementContributions
    ? computeSaversCredit(model.retirementContributions, model.w2s, model.filingStatus, line11.amount)
    : null

  const energyCreditResult = model.energyCredits
    ? computeEnergyCredit(model.energyCredits)
    : null

  const educationCredit = model.educationExpenses?.students.length
    ? computeEducationCredit(model.educationExpenses, model.filingStatus, line11.amount)
    : null

  const line20amount =
    (foreignTaxCreditResult.creditAmount) +
    (dependentCareCredit?.creditAmount ?? 0) +
    (saversCredit?.creditAmount ?? 0) +
    (energyCreditResult?.totalCredit ?? 0) +
    (educationCredit?.totalNonRefundable ?? 0)

  const line20inputs: string[] = []
  if (foreignTaxCreditResult.creditAmount > 0) line20inputs.push('credits.foreignTaxCredit')
  if (dependentCareCredit && dependentCareCredit.creditAmount > 0) line20inputs.push('credits.dependentCare')
  if (saversCredit && saversCredit.creditAmount > 0) line20inputs.push('credits.savers')
  if (energyCreditResult && energyCreditResult.totalCredit > 0) line20inputs.push('credits.energy')
  if (educationCredit && educationCredit.totalNonRefundable > 0) line20inputs.push('credits.education')

  const line20 = line20amount > 0
    ? tracedFromComputation(line20amount, 'form1040.line20', line20inputs, 'Form 1040, Line 20')
    : tracedZero('form1040.line20', 'Form 1040, Line 20')

  const line21 = computeLine21(line19, line20)
  const line22 = computeLine22(line18, line21)
  const earlyWithdrawalPenalty = computeEarlyWithdrawalPenalty(model)

  // NIIT (Form 8960): 3.8% on lesser of NII or MAGI excess
  const netCapitalGain = scheduleD?.line21.amount ?? line7.amount
  const scheduleENetIncome = scheduleE?.line26.amount ?? 0
  const niitResult = computeNIIT(model, line11.amount, netCapitalGain, scheduleENetIncome, k1Result)

  // Additional Medicare Tax (Form 8959): 0.9% on wages above threshold
  const additionalMedicareTaxResult = computeAdditionalMedicareTax(model)

  const selfEmploymentTax = scheduleSEResult?.totalSETax ?? 0
  const line23 = computeLine23(hsaResult, earlyWithdrawalPenalty, niitResult, additionalMedicareTaxResult, selfEmploymentTax, householdEmploymentTaxes)
  const line24 = computeLine24(line22, line23)

  // ── Payments & refundable credits ──────────────────────
  const line25 = computeLine25(model)
  const line26 = computeLine26(model)

  // Earned Income Credit
  const eicInvestmentIncome = line2a.amount + line2b.amount + line3b.amount + Math.max(0, line7.amount)
  let filerAge: number | null = null
  if (model.taxpayer.dateOfBirth) {
    const dobParts = model.taxpayer.dateOfBirth.split('-')
    if (dobParts.length === 3) {
      const birthYear = parseInt(dobParts[0], 10)
      if (!isNaN(birthYear)) {
        filerAge = TAX_YEAR - birthYear
      }
    }
  }
  const earnedIncomeCredit = computeEarnedIncomeCredit(
    model.dependents,
    model.filingStatus,
    earnedIncome,
    line11.amount,
    eicInvestmentIncome,
    filerAge,
  )
  const line27 = earnedIncomeCredit.eligible && earnedIncomeCredit.creditAmount > 0
    ? tracedFromComputation(
        earnedIncomeCredit.creditAmount,
        'form1040.line27',
        ['eic.creditAmount'],
        'Form 1040, Line 27',
      )
    : tracedZero('form1040.line27', 'Form 1040, Line 27')

  const line28 = childTaxCredit
    ? tracedFromComputation(
        childTaxCredit.additionalCTC,
        'form1040.line28',
        ['ctc.creditAfterPhaseOut'],
        'Form 1040, Line 28',
      )
    : tracedZero('form1040.line28', 'Form 1040, Line 28')

  const line29 = computeLine29(educationCredit)

  // Line 31 — Other refundable credits (excess SS withholding, PTC, etc.)
  // (refundableCreditsResult already computed above, before Line 17)
  const line31 = computeLine31(refundableCreditsResult)
  const line32 = computeLine32(line27, line28, line29, line31)
  const line33 = computeLine33(line25, line26, line32)

  // ── Result ──────────────────────────────────────────────
  const line34 = computeLine34(line33, line24)
  const line37 = computeLine37(line24, line33)

  // ── Validation ─────────────────────────────────────────────
  const validation = validateFederalReturn(model)

  return {
    line1a, line1z, line2a, line2b, line3a, line3b, line4a, line4b, line5a, line5b,
    line6a, line6b,
    line7, line8, line9,
    line10, line11,
    line12, line13, line14, line15,
    line16, line17, line18, line19, line20, line21, line22, line23, line24,
    line25, line26, line27, line28, line29, line31, line32, line33,
    line34, line37,
    childTaxCredit,
    earnedIncomeCredit,
    dependentCareCredit,
    saversCredit,
    energyCredit: energyCreditResult,
    educationCredit,
    iraDeduction,
    studentLoanDeduction,
    hsaResult,
    alimonyReceivedResult,
    educatorExpensesResult,
    seSepSimpleResult,
    seHealthInsuranceResult,
    householdEmploymentTaxes,
    amtResult,
    earlyWithdrawalPenalty,
    niitResult,
    additionalMedicareTaxResult,
    socialSecurityResult,
    seniorDeduction: seniorDeductionResult,
    refundableCreditsResult,
    scheduleCResult,
    scheduleSEResult,
    qbiResult,
    k1Result,
    k1RentalPAL,
    foreignTaxCreditResult: foreignTaxCreditResult.applicable ? foreignTaxCreditResult : null,
    form8606Result,
    validation,
    form8582Result,
    schedule1, scheduleA, scheduleD, scheduleE,
  }
}
