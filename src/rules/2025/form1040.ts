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

// ── Line 8 — Other income ──────────────────────────────────────
// Placeholder $0 for MVP. Would include Schedule 1 items in the future.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function computeLine8(_model: TaxReturn): TracedValue {
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
): TracedValue {
  const line1a = computeLine1a(model)
  const line2b = computeLine2b(model)
  const line3b = computeLine3b(model)
  const line7 = computeLine7(scheduleDResult)
  const line8 = computeLine8(model)

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
// Placeholder $0 for MVP. Would include Schedule 1 (IRA, student loan, etc.)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function computeLine10(_model: TaxReturn): TracedValue {
  return tracedZero('form1040.line10', 'Form 1040, Line 10')
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
): { deduction: TracedValue; scheduleA: ScheduleAResult | null } {
  const standardAmount = STANDARD_DEDUCTION[model.filingStatus]

  if (model.deductions.method === 'itemized' && model.deductions.itemized) {
    const scheduleA = computeScheduleA(model, agi)
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

// ── Line 24 — Total tax ────────────────────────────────────────
// Line 16 + SE tax + AMT + etc. — all $0 for MVP, so Line 24 = Line 16.

export function computeLine24(line16: TracedValue): TracedValue {
  return tracedFromComputation(
    line16.amount,
    'form1040.line24',
    ['form1040.line16'],
    'Form 1040, Line 24',
  )
}

// ── Line 25 — Federal income tax withheld ──────────────────────
// Sum of W-2 Box 2 + 1099-INT Box 4 + 1099-DIV Box 4 + 1099-B withholding.

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

// ── Line 33 — Total payments ───────────────────────────────────
// Line 25 + estimated tax payments (0 for MVP).

export function computeLine33(line25: TracedValue): TracedValue {
  return tracedFromComputation(
    line25.amount,
    'form1040.line33',
    ['form1040.line25'],
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

  // Tax (Lines 16, 24)
  line16: TracedValue
  line24: TracedValue

  // Payments (Lines 25, 33)
  line25: TracedValue
  line33: TracedValue

  // Refund or amount owed (Lines 34, 37)
  line34: TracedValue
  line37: TracedValue

  // Attached schedules
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

  // ── Income ──────────────────────────────────────────────
  const line1a = computeLine1a(model)
  const line2a = computeLine2a(model)
  const line2b = computeLine2b(model)
  const line3a = computeLine3a(model)
  const line3b = computeLine3b(model)
  const line7 = computeLine7(scheduleD?.line21)
  const line8 = computeLine8(model)

  const line9 = tracedFromComputation(
    line1a.amount + line2b.amount + line3b.amount + line7.amount + line8.amount,
    'form1040.line9',
    ['form1040.line1a', 'form1040.line2b', 'form1040.line3b', 'form1040.line7', 'form1040.line8'],
    'Form 1040, Line 9',
  )

  // ── Adjustments & AGI ───────────────────────────────────
  const line10 = computeLine10(model)
  const line11 = computeLine11(line9, line10)

  // ── Deductions ──────────────────────────────────────────
  const { deduction: line12, scheduleA } = computeLine12(model, line11.amount)
  const line13 = computeLine13()
  const line14 = computeLine14(line12, line13)
  const line15 = computeLine15(line11, line14)

  // ── Tax ─────────────────────────────────────────────────
  const line16 = computeLine16(line15.amount, line3a.amount, scheduleD, model.filingStatus)
  const line24 = computeLine24(line16)

  // ── Payments ────────────────────────────────────────────
  const line25 = computeLine25(model)
  const line33 = computeLine33(line25)

  // ── Result ──────────────────────────────────────────────
  const line34 = computeLine34(line33, line24)
  const line37 = computeLine37(line24, line33)

  return {
    line1a, line2a, line2b, line3a, line3b, line7, line8, line9,
    line10, line11,
    line12, line13, line14, line15,
    line16, line24,
    line25, line33,
    line34, line37,
    scheduleA, scheduleD,
  }
}
