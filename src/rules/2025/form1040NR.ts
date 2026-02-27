/**
 * Form 1040-NR — U.S. Nonresident Alien Income Tax Return
 *
 * Computes tax for nonresident aliens with U.S.-source income.
 *
 * Two categories of income:
 * 1. Effectively Connected Income (ECI) — taxed at graduated rates (same brackets as 1040)
 * 2. FDAP Income (Fixed, Determinable, Annual, Periodic) — taxed at 30% flat rate
 *    or lower treaty rate (Schedule NEC)
 *
 * Key differences from Form 1040:
 * - Filing status: Single or MFS only
 * - Standard deduction: Generally not available (except India treaty students)
 * - Itemized deductions: Limited to state/local taxes and some charitable
 * - No EITC, limited CTC
 * - Treaty benefits can exempt income
 *
 * All amounts are in integer cents.
 */

import type { TaxReturn, FilingStatus } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation, tracedZero } from '../../model/traced'
import { INCOME_TAX_BRACKETS } from './constants'
import { computeBracketTax } from './taxComputation'
import type { Form1040Result } from './form1040'

// ── Result interface ────────────────────────────────────────────

export interface Form1040NRResult {
  // ECI Income (Lines 1a–9)
  eciWages: TracedValue           // Line 1a — Wages from W-2
  eciInterest: TracedValue        // Line 2b — Taxable interest (ECI portion)
  eciDividends: TracedValue       // Line 3b — Ordinary dividends (ECI portion)
  eciCapitalGains: TracedValue    // Line 7 — Capital gains (ECI)
  eciBusinessIncome: TracedValue  // Line 8 — Schedule C / other business income
  eciScholarship: TracedValue     // Taxable scholarship income
  eciOtherIncome: TracedValue     // Other ECI
  totalECI: TracedValue           // Line 9 — Total effectively connected income

  // Adjustments & AGI
  adjustments: TracedValue        // Line 10 — Above-the-line adjustments
  agi: TracedValue                // Line 11 — Adjusted Gross Income

  // Deductions
  deductions: TracedValue         // Line 12 — Itemized deductions (limited)
  taxableIncome: TracedValue      // Line 15 — Taxable income (ECI)

  // ECI Tax
  eciTax: TracedValue             // Line 16 — Tax on ECI (graduated rates)

  // FDAP Income and Tax (Schedule NEC)
  fdapDividends: TracedValue
  fdapInterest: TracedValue
  fdapRoyalties: TracedValue
  fdapOther: TracedValue
  totalFDAP: TracedValue          // Total FDAP income
  fdapTaxRate: number             // decimal (0.30 default)
  fdapTax: TracedValue            // Tax on FDAP income

  // Treaty benefits
  treatyExemption: TracedValue    // Income exempt under treaty

  // Total tax
  totalTax: TracedValue           // Line 24 — Total tax (ECI + FDAP)

  // Payments
  withheld: TracedValue           // Line 25 — Federal income tax withheld
  estimatedPayments: TracedValue  // Line 26 — Estimated tax payments
  totalPayments: TracedValue      // Line 33 — Total payments

  // Result
  refund: TracedValue             // Line 34 — Overpaid (refund)
  amountOwed: TracedValue         // Line 37 — Amount you owe
}

// ── Main computation ────────────────────────────────────────────

export function computeForm1040NR(model: TaxReturn): Form1040NRResult {
  const nra = model.nraInfo
  // NRA filers use single or mfs only
  const filingStatus: FilingStatus =
    model.filingStatus === 'mfs' ? 'mfs' : 'single'

  // ── ECI Income ──────────────────────────────────────────────

  // Line 1a: Wages from W-2
  const wagesTotal = model.w2s.reduce((sum, w) => sum + w.box1, 0)
  const eciWages = tracedFromComputation(
    wagesTotal,
    'form1040nr.eciWages',
    model.w2s.map(w => `w2:${w.id}:box1`),
    'Form 1040-NR — ECI Wages',
  )

  // Interest (ECI — from 1099-INTs, not FDAP)
  // For NRA, interest income on 1099-INT forms is generally ECI if effectively connected
  // For MVP: treat 1099-INT as ECI; FDAP interest is entered separately
  const interestTotal = model.form1099INTs.reduce((sum, f) => sum + f.box1, 0)
  const eciInterest = tracedFromComputation(
    interestTotal,
    'form1040nr.eciInterest',
    model.form1099INTs.map(f => `1099int:${f.id}:box1`),
    'Form 1040-NR — ECI Interest',
  )

  // Dividends (ECI — from 1099-DIVs, not FDAP)
  const dividendsTotal = model.form1099DIVs.reduce((sum, f) => sum + f.box1a, 0)
  const eciDividends = tracedFromComputation(
    dividendsTotal,
    'form1040nr.eciDividends',
    model.form1099DIVs.map(f => `1099div:${f.id}:box1a`),
    'Form 1040-NR — ECI Dividends',
  )

  // Capital gains (ECI)
  const capGainTotal = model.capitalTransactions.reduce((sum, t) => sum + t.gainLoss, 0)
  // Apply $3,000 loss limitation ($1,500 if MFS)
  const capLossLimit = filingStatus === 'mfs' ? 150_000 : 300_000
  const capGainForReturn = capGainTotal < 0 ? Math.max(capGainTotal, -capLossLimit) : capGainTotal
  const eciCapitalGains = tracedFromComputation(
    capGainForReturn,
    'form1040nr.eciCapitalGains',
    [],
    'Form 1040-NR — ECI Capital Gains',
  )

  // Business income (Schedule C)
  const bizIncome = (model.scheduleCBusinesses ?? []).reduce((sum, biz) => {
    const gross = biz.grossReceipts - biz.returns - biz.costOfGoodsSold
    const expenses = biz.advertising + biz.carAndTruck + biz.commissions +
      biz.contractLabor + biz.depreciation + biz.insurance + biz.mortgageInterest +
      biz.otherInterest + biz.legal + biz.officeExpense + biz.rent + biz.repairs +
      biz.supplies + biz.taxes + biz.travel + biz.meals + biz.utilities +
      biz.wages + biz.otherExpenses
    return sum + (gross - expenses)
  }, 0)
  const eciBusinessIncome = tracedFromComputation(
    bizIncome,
    'form1040nr.eciBusinessIncome',
    [],
    'Form 1040-NR — ECI Business Income',
  )

  // Scholarship income
  const scholarshipAmt = nra?.scholarshipIncome ?? 0
  const eciScholarship = tracedFromComputation(
    scholarshipAmt,
    'form1040nr.eciScholarship',
    [],
    'Form 1040-NR — Taxable Scholarship Income',
  )

  // Other ECI: unemployment (1099-G), misc (1099-MISC box 3)
  const unemploymentTotal = model.form1099Gs.reduce((sum, f) => sum + f.box1, 0)
  const miscOtherTotal = model.form1099MISCs.reduce((sum, f) => sum + f.box3, 0)
  const otherECITotal = unemploymentTotal + miscOtherTotal
  const eciOtherIncome = tracedFromComputation(
    otherECITotal,
    'form1040nr.eciOtherIncome',
    [],
    'Form 1040-NR — Other ECI',
  )

  // Treaty exemption
  const treatyExemptAmt = nra?.treatyExemptIncome ?? 0
  const treatyExemption = tracedFromComputation(
    treatyExemptAmt,
    'form1040nr.treatyExemption',
    [],
    'Form 1040-NR — Treaty Exempt Income',
  )

  // Total ECI (before treaty exemption)
  const totalECIBeforeTreaty = wagesTotal + interestTotal + dividendsTotal +
    capGainForReturn + bizIncome + scholarshipAmt + otherECITotal
  const totalECIAfterTreaty = Math.max(0, totalECIBeforeTreaty - treatyExemptAmt)

  const totalECI = tracedFromComputation(
    totalECIAfterTreaty,
    'form1040nr.totalECI',
    ['form1040nr.eciWages', 'form1040nr.eciInterest', 'form1040nr.eciDividends',
     'form1040nr.eciCapitalGains', 'form1040nr.eciBusinessIncome',
     'form1040nr.eciScholarship', 'form1040nr.eciOtherIncome'],
    'Form 1040-NR, Line 9 — Total Effectively Connected Income',
  )

  // ── Adjustments ─────────────────────────────────────────────

  // NRA adjustments: student loan interest, educator expenses (limited set)
  let adjustmentsTotal = 0

  // Student loan interest (limited for NRA but available)
  const studentLoanAmt = Math.min(model.studentLoanInterest ?? 0, 250_000) // $2,500 max
  adjustmentsTotal += studentLoanAmt

  // Educator expenses
  const educatorAmt = Math.min(model.educatorExpenses ?? 0, 30_000) // $300 max
  adjustmentsTotal += educatorAmt

  const adjustments = tracedFromComputation(
    adjustmentsTotal,
    'form1040nr.adjustments',
    [],
    'Form 1040-NR, Line 10 — Adjustments',
  )

  // AGI
  const agiAmt = totalECIAfterTreaty - adjustmentsTotal
  const agi = tracedFromComputation(
    agiAmt,
    'form1040nr.agi',
    ['form1040nr.totalECI', 'form1040nr.adjustments'],
    'Form 1040-NR, Line 11 — AGI',
  )

  // ── Deductions ──────────────────────────────────────────────

  // NRA: Generally NO standard deduction. Itemized only.
  // Limited itemized: state/local taxes, charitable (with treaty)
  let deductionsTotal = 0

  if (model.deductions.itemized) {
    const item = model.deductions.itemized
    // State and local taxes (SALT cap $10,000)
    const salt = Math.min(
      item.stateLocalIncomeTaxes + item.realEstateTaxes + item.personalPropertyTaxes,
      1_000_000, // $10,000 SALT cap in cents
    )
    deductionsTotal += salt

    // Charitable contributions (available for NRA with treaty provision or
    // effectively connected income)
    deductionsTotal += item.charitableCash + item.charitableNoncash
  }

  const deductions = tracedFromComputation(
    deductionsTotal,
    'form1040nr.deductions',
    [],
    'Form 1040-NR, Line 12 — Itemized Deductions (limited)',
  )

  // Taxable income
  const taxableIncomeAmt = Math.max(0, agiAmt - deductionsTotal)
  const taxableIncome = tracedFromComputation(
    taxableIncomeAmt,
    'form1040nr.taxableIncome',
    ['form1040nr.agi', 'form1040nr.deductions'],
    'Form 1040-NR, Line 15 — Taxable Income',
  )

  // ── ECI Tax ─────────────────────────────────────────────────

  // Same graduated brackets as Form 1040
  const brackets = INCOME_TAX_BRACKETS[filingStatus]
  const eciTaxAmt = computeBracketTax(taxableIncomeAmt, brackets)
  const eciTax = tracedFromComputation(
    eciTaxAmt,
    'form1040nr.eciTax',
    ['form1040nr.taxableIncome'],
    'Form 1040-NR, Line 16 — Tax on ECI',
  )

  // ── FDAP Income and Tax (Schedule NEC) ──────────────────────

  const fdapDivAmt = nra?.fdapDividends ?? 0
  const fdapIntAmt = nra?.fdapInterest ?? 0
  const fdapRoyAmt = nra?.fdapRoyalties ?? 0
  const fdapOthAmt = nra?.fdapOtherIncome ?? 0
  const totalFDAPAmt = fdapDivAmt + fdapIntAmt + fdapRoyAmt + fdapOthAmt

  const fdapDividends = tracedFromComputation(fdapDivAmt, 'form1040nr.fdapDividends', [], 'Schedule NEC — Dividends')
  const fdapInterest = tracedFromComputation(fdapIntAmt, 'form1040nr.fdapInterest', [], 'Schedule NEC — Interest')
  const fdapRoyalties = tracedFromComputation(fdapRoyAmt, 'form1040nr.fdapRoyalties', [], 'Schedule NEC — Royalties')
  const fdapOther = tracedFromComputation(fdapOthAmt, 'form1040nr.fdapOther', [], 'Schedule NEC — Other')
  const totalFDAP = tracedFromComputation(
    totalFDAPAmt,
    'form1040nr.totalFDAP',
    ['form1040nr.fdapDividends', 'form1040nr.fdapInterest', 'form1040nr.fdapRoyalties', 'form1040nr.fdapOther'],
    'Schedule NEC — Total FDAP Income',
  )

  // FDAP tax rate: 30% default, or treaty rate
  const fdapRate = nra?.fdapWithholdingRate ?? 0.30
  const fdapTaxAmt = Math.round(totalFDAPAmt * fdapRate)
  const fdapTax = tracedFromComputation(
    fdapTaxAmt,
    'form1040nr.fdapTax',
    ['form1040nr.totalFDAP'],
    `Schedule NEC — Tax on FDAP Income (${(fdapRate * 100).toFixed(0)}%)`,
  )

  // ── Total Tax ───────────────────────────────────────────────

  const totalTaxAmt = eciTaxAmt + fdapTaxAmt
  const totalTax = tracedFromComputation(
    totalTaxAmt,
    'form1040nr.totalTax',
    ['form1040nr.eciTax', 'form1040nr.fdapTax'],
    'Form 1040-NR, Line 24 — Total Tax',
  )

  // ── Payments ────────────────────────────────────────────────

  // Federal withholding from W-2, 1099s
  const w2Withholding = model.w2s.reduce((sum, w) => sum + w.box2, 0)
  const int1099Withholding = model.form1099INTs.reduce((sum, f) => sum + f.box4, 0)
  const div1099Withholding = model.form1099DIVs.reduce((sum, f) => sum + f.box4, 0)
  const misc1099Withholding = model.form1099MISCs.reduce((sum, f) => sum + f.box4, 0)
  const g1099Withholding = model.form1099Gs.reduce((sum, f) => sum + f.box4, 0)
  const b1099Withholding = model.form1099Bs.reduce((sum, f) => sum + f.federalTaxWithheld, 0)
  const nec1099Withholding = model.form1099NECs.reduce((sum, f) => sum + (f.federalTaxWithheld ?? 0), 0)

  const totalWithheld = w2Withholding + int1099Withholding + div1099Withholding +
    misc1099Withholding + g1099Withholding + b1099Withholding + nec1099Withholding

  const withheld = tracedFromComputation(
    totalWithheld,
    'form1040nr.withheld',
    model.w2s.map(w => `w2:${w.id}:box2`),
    'Form 1040-NR, Line 25 — Federal Income Tax Withheld',
  )

  // Estimated tax payments
  const est = model.estimatedTaxPayments
  const estTotal = est ? (est.q1 + est.q2 + est.q3 + est.q4) : 0
  const estimatedPayments = tracedFromComputation(
    estTotal,
    'form1040nr.estimatedPayments',
    [],
    'Form 1040-NR, Line 26 — Estimated Tax Payments',
  )

  // Total payments
  const totalPaymentsAmt = totalWithheld + estTotal
  const totalPayments = tracedFromComputation(
    totalPaymentsAmt,
    'form1040nr.totalPayments',
    ['form1040nr.withheld', 'form1040nr.estimatedPayments'],
    'Form 1040-NR, Line 33 — Total Payments',
  )

  // ── Refund / Amount Owed ────────────────────────────────────

  const refundAmt = totalPaymentsAmt > totalTaxAmt ? totalPaymentsAmt - totalTaxAmt : 0
  const refund = tracedFromComputation(
    refundAmt,
    'form1040nr.refund',
    ['form1040nr.totalPayments', 'form1040nr.totalTax'],
    'Form 1040-NR, Line 34 — Refund',
  )

  const owedAmt = totalTaxAmt > totalPaymentsAmt ? totalTaxAmt - totalPaymentsAmt : 0
  const amountOwed = tracedFromComputation(
    owedAmt,
    'form1040nr.amountOwed',
    ['form1040nr.totalTax', 'form1040nr.totalPayments'],
    'Form 1040-NR, Line 37 — Amount You Owe',
  )

  return {
    eciWages,
    eciInterest,
    eciDividends,
    eciCapitalGains,
    eciBusinessIncome,
    eciScholarship,
    eciOtherIncome,
    totalECI,
    adjustments,
    agi,
    deductions,
    taxableIncome,
    eciTax,
    fdapDividends,
    fdapInterest,
    fdapRoyalties,
    fdapOther,
    totalFDAP,
    fdapTaxRate: fdapRate,
    fdapTax,
    treatyExemption,
    totalTax,
    withheld,
    estimatedPayments,
    totalPayments,
    refund,
    amountOwed,
  }
}

/**
 * Convert a Form1040NRResult to a Form1040Result-compatible shape.
 * This allows the rest of the app (review page, download) to work
 * with minimal changes when the NRA flag is set.
 */
export function form1040NRToForm1040Compat(nrResult: Form1040NRResult): Form1040Result {
  const zero = tracedZero('compat')
  return {
    line1a: nrResult.eciWages,
    line1z: nrResult.eciWages,
    line2a: zero,
    line2b: nrResult.eciInterest,
    line3a: zero,
    line3b: nrResult.eciDividends,
    line4a: zero,
    line4b: zero,
    line5a: zero,
    line5b: zero,
    line6a: zero,
    line6b: zero,
    line7: nrResult.eciCapitalGains,
    line8: tracedFromComputation(
      nrResult.eciBusinessIncome.amount + nrResult.eciScholarship.amount + nrResult.eciOtherIncome.amount,
      'form1040.line8',
      [],
      'Other income (1040-NR compat)',
    ),
    line9: nrResult.totalECI,
    line10: nrResult.adjustments,
    line11: nrResult.agi,
    line12: nrResult.deductions,
    line13: zero,
    line14: nrResult.deductions,
    line15: nrResult.taxableIncome,
    line16: nrResult.eciTax,
    line17: nrResult.fdapTax, // Schedule NEC tax goes here for compatibility
    line18: nrResult.totalTax,
    line19: zero,
    line20: zero,
    line21: zero,
    line22: nrResult.totalTax,
    line23: zero,
    line24: nrResult.totalTax,
    line25: nrResult.withheld,
    line26: nrResult.estimatedPayments,
    line27: zero,
    line28: zero,
    line29: zero,
    line31: zero,
    line32: zero,
    line33: nrResult.totalPayments,
    line34: nrResult.refund,
    line37: nrResult.amountOwed,
    // Sub-results — null for NRA (simplified)
    childTaxCredit: null,
    earnedIncomeCredit: null,
    dependentCareCredit: null,
    saversCredit: null,
    energyCredit: null,
    educationCredit: null,
    iraDeduction: null,
    studentLoanDeduction: null,
    hsaResult: null,
    alimonyReceivedResult: null,
    educatorExpensesResult: null,
    seSepSimpleResult: null,
    seHealthInsuranceResult: null,
    householdEmploymentTaxes: 0,
    amtResult: null,
    earlyWithdrawalPenalty: null,
    niitResult: null,
    additionalMedicareTaxResult: null,
    socialSecurityResult: null,
    seniorDeduction: null,
    refundableCreditsResult: null,
    form8829Results: [],
    scheduleCResult: null,
    scheduleSEResult: null,
    qbiResult: null,
    k1Result: null,
    k1RentalPAL: null,
    foreignTaxCreditResult: null,
    scheduleA: null,
    scheduleD: null,
    schedule1: null,
    scheduleE: null,
    form8582Result: null,
    form8606Result: null,
    validation: null,
  }
}
