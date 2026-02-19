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
import { STANDARD_DEDUCTION } from './constants'
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
import { TAX_YEAR } from './constants'
import { computeIRADeduction } from './iraDeduction'
import type { IRADeductionResult } from './iraDeduction'
import { computeHSADeduction } from './hsaDeduction'
import type { HSAResult } from './hsaDeduction'
import { computeStudentLoanDeduction } from './studentLoanDeduction'
import type { StudentLoanDeductionResult } from './studentLoanDeduction'
import { computeSchedule1 } from './schedule1'
import type { Schedule1Result } from './schedule1'

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
// Sum of all 1099-INT Box 1 values.

export function computeLine2b(model: TaxReturn): TracedValue {
  const inputIds = model.form1099INTs.map(f => `1099int:${f.id}:box1`)
  const total = model.form1099INTs.reduce((sum, f) => sum + f.box1, 0)

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
// Sum of all 1099-DIV Box 1a values.

export function computeLine3b(model: TaxReturn): TracedValue {
  const inputIds = model.form1099DIVs.map(f => `1099div:${f.id}:box1a`)
  const total = model.form1099DIVs.reduce((sum, f) => sum + f.box1a, 0)

  return tracedFromComputation(
    total,
    'form1040.line3b',
    inputIds,
    'Form 1040, Line 3b',
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

  if (total > 0) {
    const inputs: string[] = []
    if (schedule1Amount > 0) inputs.push('schedule1.line10')
    if (hsaTaxable > 0) inputs.push('hsa.taxableDistributions')
    return tracedFromComputation(total, 'form1040.line8', inputs, 'Form 1040, Line 8')
  }
  return tracedZero('form1040.line8', 'Form 1040, Line 8')
}

// ── Line 9 — Total income ─────────────────────────────────────
// Line 1a + Line 2b + Line 3b + Line 7 + Line 8
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
  const line2b = computeLine2b(model)
  const line3b = computeLine3b(model)
  const line7 = computeLine7(scheduleDResult)
  const line8 = computeLine8(schedule1Result)

  const total = line1a.amount + line2b.amount + line3b.amount + line7.amount + line8.amount

  return tracedFromComputation(
    total,
    'form1040.line9',
    [
      'form1040.line1a',
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
): TracedValue {
  const ira = iraDeduction?.deductibleAmount ?? 0
  const hsa = hsaDeduction?.deductibleAmount ?? 0
  const studentLoan = studentLoanDeduction?.deductibleAmount ?? 0
  const amount = ira + hsa + studentLoan
  const inputs: string[] = []
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
): { deduction: TracedValue; scheduleA: ScheduleAResult | null } {
  const standardAmount = STANDARD_DEDUCTION[model.filingStatus]

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
  }
}

// ── Line 13 — Qualified business income deduction ───────────────
// Placeholder $0 for MVP.

export function computeLine13(): TracedValue {
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
// Alternative Minimum Tax (Form 6251)

export function computeLine17(
  taxableIncome: number,
  regularTax: number,
  filingStatus: FilingStatus,
  saltDeduction: number,
  isoExercises: TaxReturn['isoExercises'],
  qualifiedDividends: number,
  netLTCG: number,
): { traced: TracedValue; amtResult: AMTResult } {
  const amtResult = computeAMT(
    taxableIncome, regularTax, filingStatus,
    saltDeduction, isoExercises, 0,
    qualifiedDividends, netLTCG,
  )

  const traced = amtResult.amt > 0
    ? tracedFromComputation(amtResult.amt, 'form1040.line17', ['amt.amt'], 'Form 1040, Line 17')
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

// ── Line 23 — Other taxes (Schedule 2, Part II) ────────────────
// Includes HSA penalties (distribution 20% + excess 6%).

export function computeLine23(hsaDeduction?: HSAResult | null): TracedValue {
  const distributionPenalty = hsaDeduction?.distributionPenalty ?? 0
  const excessPenalty = hsaDeduction?.excessPenalty ?? 0
  const total = distributionPenalty + excessPenalty

  if (total > 0) {
    return tracedFromComputation(total, 'form1040.line23', ['hsa.penalties'], 'Form 1040, Line 23')
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
// Sum of W-2 Box 2 + 1099-INT Box 4 + 1099-DIV Box 4 + 1099-MISC Box 4 + 1099-B withholding.

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

  for (const f of model.form1099Bs) {
    if (f.federalTaxWithheld > 0) {
      total += f.federalTaxWithheld
      inputIds.push(`1099b:${f.id}:federalTaxWithheld`)
    }
  }

  return tracedFromComputation(
    total,
    'form1040.line25',
    inputIds,
    'Form 1040, Line 25',
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
// Placeholder $0.

export function computeLine31(): TracedValue {
  return tracedZero('form1040.line31', 'Form 1040, Line 31')
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
// Line 25 + Line 32

export function computeLine33(line25: TracedValue, line32: TracedValue): TracedValue {
  return tracedFromComputation(
    line25.amount + line32.amount,
    'form1040.line33',
    ['form1040.line25', 'form1040.line32'],
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
  line2a: TracedValue
  line2b: TracedValue
  line3a: TracedValue
  line3b: TracedValue
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

  // AMT detail (Form 6251)
  amtResult: AMTResult | null

  // Attached schedules
  schedule1: Schedule1Result | null
  scheduleA: ScheduleAResult | null
  scheduleD: ScheduleDResult | null
}

// ── Full orchestrator ──────────────────────────────────────────

/**
 * Compute the entire Form 1040 for a tax return.
 *
 * Orchestrates all income, deduction, tax, payment, and result lines.
 * Automatically computes Schedule D when capital activity exists.
 */
export function computeForm1040(model: TaxReturn): Form1040Result {
  // Schedule D (compute if there are capital transactions or cap gain distributions)
  const hasCapitalActivity =
    model.capitalTransactions.length > 0 ||
    model.form1099DIVs.some(f => f.box2a > 0)
  const scheduleD = hasCapitalActivity ? computeScheduleD(model) : null

  // Schedule 1 (compute if there is 1099-MISC income)
  const has1099MISCIncome = (model.form1099MISCs ?? []).some(
    f => f.box1 > 0 || f.box2 > 0 || f.box3 > 0,
  )
  const schedule1 = has1099MISCIncome ? computeSchedule1(model) : null

  // ── HSA (computed early — no dependency on Line 9) ──────
  const hsaResult = computeHSADeduction(model)

  // ── Income ──────────────────────────────────────────────
  const line1a = computeLine1a(model)
  const line2a = computeLine2a(model)
  const line2b = computeLine2b(model)
  const line3a = computeLine3a(model)
  const line3b = computeLine3b(model)
  const line7 = computeLine7(scheduleD?.line21)
  const line8 = computeLine8(schedule1 ?? undefined, hsaResult)

  const line9 = tracedFromComputation(
    line1a.amount + line2b.amount + line3b.amount + line7.amount + line8.amount,
    'form1040.line9',
    ['form1040.line1a', 'form1040.line2b', 'form1040.line3b', 'form1040.line7', 'form1040.line8'],
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

  const line10 = computeLine10(iraDeduction, hsaResult, studentLoanDeduction)
  const line11 = computeLine11(line9, line10)

  // ── Deductions ──────────────────────────────────────────
  // Net investment income for Form 4952 investment interest limit.
  // Includes: taxable interest + non-qualified dividends + net ST capital gains.
  const nonQualifiedDivs = Math.max(0, line3b.amount - line3a.amount)
  const netSTGain = Math.max(0, scheduleD?.line7.amount ?? 0)
  const netInvestmentIncome = line2b.amount + nonQualifiedDivs + netSTGain

  const { deduction: line12, scheduleA } = computeLine12(model, line11.amount, netInvestmentIncome)
  const line13 = computeLine13()
  const line14 = computeLine14(line12, line13)
  const line15 = computeLine15(line11, line14)

  // ── Tax ─────────────────────────────────────────────────
  const line16 = computeLine16(line15.amount, line3a.amount, scheduleD, model.filingStatus)

  const saltDeduction = scheduleA?.line7.amount ?? 0
  const netLTCG = Math.max(0, scheduleD?.line15.amount ?? 0)
  const { traced: line17, amtResult } = computeLine17(
    line15.amount, line16.amount, model.filingStatus,
    saltDeduction, model.isoExercises ?? [],
    line3a.amount, netLTCG,
  )

  const line18 = computeLine18(line16, line17)

  // ── Credits ────────────────────────────────────────────
  // Earned income for refundable CTC = sum of W-2 Box 1
  const earnedIncome = model.w2s.reduce((sum, w) => sum + w.box1, 0)

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
    (dependentCareCredit?.creditAmount ?? 0) +
    (saversCredit?.creditAmount ?? 0) +
    (energyCreditResult?.totalCredit ?? 0) +
    (educationCredit?.totalNonRefundable ?? 0)

  const line20inputs: string[] = []
  if (dependentCareCredit && dependentCareCredit.creditAmount > 0) line20inputs.push('credits.dependentCare')
  if (saversCredit && saversCredit.creditAmount > 0) line20inputs.push('credits.savers')
  if (energyCreditResult && energyCreditResult.totalCredit > 0) line20inputs.push('credits.energy')
  if (educationCredit && educationCredit.totalNonRefundable > 0) line20inputs.push('credits.education')

  const line20 = line20amount > 0
    ? tracedFromComputation(line20amount, 'form1040.line20', line20inputs, 'Form 1040, Line 20')
    : tracedZero('form1040.line20', 'Form 1040, Line 20')

  const line21 = computeLine21(line19, line20)
  const line22 = computeLine22(line18, line21)
  const line23 = computeLine23(hsaResult)
  const line24 = computeLine24(line22, line23)

  // ── Payments & refundable credits ──────────────────────
  const line25 = computeLine25(model)

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
  const line31 = computeLine31()
  const line32 = computeLine32(line27, line28, line29, line31)
  const line33 = computeLine33(line25, line32)

  // ── Result ──────────────────────────────────────────────
  const line34 = computeLine34(line33, line24)
  const line37 = computeLine37(line24, line33)

  return {
    line1a, line2a, line2b, line3a, line3b, line7, line8, line9,
    line10, line11,
    line12, line13, line14, line15,
    line16, line17, line18, line19, line20, line21, line22, line23, line24,
    line25, line27, line28, line29, line31, line32, line33,
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
    amtResult,
    schedule1, scheduleA, scheduleD,
  }
}
