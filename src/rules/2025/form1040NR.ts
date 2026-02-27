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

// ── Treaty rate tables ────────────────────────────────────────────

/** Gap 7: Treaty dividend rates for common countries (used as blended FDAP rate for MVP). */
export const TREATY_DIVIDEND_RATES: Record<string, number> = {
  Australia: 0.15,
  Austria: 0.15,
  Belgium: 0.15,
  Canada: 0.15,
  China: 0.10,
  France: 0.15,
  Germany: 0.15,
  India: 0.25,
  Ireland: 0.15,
  Israel: 0.25,
  Italy: 0.15,
  Japan: 0.10,
  'Korea (South)': 0.15,
  Mexico: 0.10,
  Netherlands: 0.15,
  Switzerland: 0.15,
  'United Kingdom': 0.15,
}

/** Gap 3: Countries whose tax treaties exempt Social Security benefits. */
export const SS_TREATY_EXEMPT_COUNTRIES: string[] = [
  'Australia', 'Austria', 'Belgium', 'Canada', 'Czech Republic', 'Denmark',
  'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy',
  'Japan', 'Korea (South)', 'Luxembourg', 'Netherlands', 'Norway', 'Poland',
  'Portugal', 'Slovakia', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom',
]

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
  eciRetirement: TracedValue      // 1099-R pension income (ECI)
  eciRentalIncome: TracedValue    // Schedule E rental (when §871(d) elected)
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
  fdapRetirement: TracedValue     // 1099-R IRA/SEP (FDAP)
  fdapRentalIncome: TracedValue   // Gross rental (when not electing ECI)
  fdapSocialSecurity: TracedValue // 85% of SS benefits (FDAP)
  ssaBenefits: TracedValue        // Gross SS benefits
  totalFDAP: TracedValue          // Total FDAP income
  fdapTaxRate: number             // decimal (0.30 default)
  fdapTax: TracedValue            // Tax on FDAP income

  // Treaty benefits
  treatyExemption: TracedValue    // Income exempt under treaty

  // Credits
  foreignTaxCredit: TracedValue
  childTaxCredit: TracedValue
  creditTotal: TracedValue        // sum of all credits (limited to eciTax)

  // Total tax
  totalTax: TracedValue           // Line 24 — Total tax (ECI + FDAP - credits)

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

  // Determine if user has a Schedule C business (for Gap 1 ECI vs FDAP classification)
  const hasScheduleC = (model.scheduleCBusinesses ?? []).length > 0

  // ── ECI Income ──────────────────────────────────────────────

  // Line 1a: Wages from W-2
  const wagesTotal = model.w2s.reduce((sum, w) => sum + w.box1, 0)
  const eciWages = tracedFromComputation(
    wagesTotal,
    'form1040nr.eciWages',
    model.w2s.map(w => `w2:${w.id}:box1`),
    'Form 1040-NR — ECI Wages',
  )

  // ── Gap 1: Auto FDAP Classification for 1099-INT/DIV ──────
  // If user has Schedule C business, treat interest/dividends as ECI (effectively connected).
  // Otherwise, classify as FDAP (30% / treaty rate).
  const rawInterestTotal = model.form1099INTs.reduce((sum, f) => sum + f.box1, 0)
  const rawDividendsTotal = model.form1099DIVs.reduce((sum, f) => sum + f.box1a, 0)

  let eciInterestAmt: number
  let eciDividendsAmt: number
  let autoFdapInterestAmt: number
  let autoFdapDividendsAmt: number

  if (hasScheduleC) {
    // Effectively connected with U.S. trade/business — treat as ECI
    eciInterestAmt = rawInterestTotal
    eciDividendsAmt = rawDividendsTotal
    autoFdapInterestAmt = 0
    autoFdapDividendsAmt = 0
  } else {
    // No U.S. business — classify 1099-INT/DIV as FDAP
    eciInterestAmt = 0
    eciDividendsAmt = 0
    autoFdapInterestAmt = rawInterestTotal
    autoFdapDividendsAmt = rawDividendsTotal
  }

  const eciInterest = tracedFromComputation(
    eciInterestAmt,
    'form1040nr.eciInterest',
    hasScheduleC ? model.form1099INTs.map(f => `1099int:${f.id}:box1`) : [],
    'Form 1040-NR — ECI Interest',
  )

  const eciDividends = tracedFromComputation(
    eciDividendsAmt,
    'form1040nr.eciDividends',
    hasScheduleC ? model.form1099DIVs.map(f => `1099div:${f.id}:box1a`) : [],
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

  // ── Gap 2: 1099-R Retirement Income for NRA ───────────────
  let eciRetirementAmt = 0
  let fdapRetirementAmt = 0
  for (const r of model.form1099Rs) {
    const taxableAmt = r.box2a
    if (r.iraOrSep) {
      // IRA/SEP distributions → generally FDAP
      fdapRetirementAmt += taxableAmt
    } else {
      // Pension (distribution code 7 or non-IRA/SEP) → generally ECI
      eciRetirementAmt += taxableAmt
    }
  }

  const eciRetirement = tracedFromComputation(
    eciRetirementAmt,
    'form1040nr.eciRetirement',
    model.form1099Rs.filter(r => !r.iraOrSep).map(r => `1099r:${r.id}:box2a`),
    'Form 1040-NR — ECI Retirement (Pension)',
  )

  const fdapRetirement = tracedFromComputation(
    fdapRetirementAmt,
    'form1040nr.fdapRetirement',
    model.form1099Rs.filter(r => r.iraOrSep).map(r => `1099r:${r.id}:box2a`),
    'Schedule NEC — FDAP Retirement (IRA/SEP)',
  )

  // ── Gap 3: SSA-1099 Social Security for NRA ───────────────
  const ssaGrossAmt = model.formSSA1099s.reduce((sum, f) => sum + f.box5, 0)
  const ssaBenefits = tracedFromComputation(
    ssaGrossAmt,
    'form1040nr.ssaBenefits',
    model.formSSA1099s.map(f => `ssa1099:${f.id}:box5`),
    'Form 1040-NR — Gross Social Security Benefits',
  )

  // Determine SS treaty exemption: auto-detect from treaty country, allow override
  const treatyCountry = nra?.treatyCountry ?? ''
  const ssExemptByTreaty = nra?.socialSecurityTreatyExempt ??
    SS_TREATY_EXEMPT_COUNTRIES.includes(treatyCountry)

  // For NRA, SS benefits taxed at 85% × flat rate per IRC §871(a)(3), unless treaty-exempt
  const fdapSSAmt = ssExemptByTreaty ? 0 : Math.round(ssaGrossAmt * 0.85)
  const fdapSocialSecurity = tracedFromComputation(
    fdapSSAmt,
    'form1040nr.fdapSocialSecurity',
    ssaGrossAmt > 0 ? ['form1040nr.ssaBenefits'] : [],
    ssExemptByTreaty
      ? 'Schedule NEC — Social Security (treaty-exempt)'
      : 'Schedule NEC — Social Security (85% of benefits)',
  )

  // ── Gap 4: Schedule E Rental Income for NRA ───────────────
  const rentalElectECI = nra?.rentalElectECI ?? false
  let eciRentalAmt = 0
  let fdapRentalAmt = 0

  if (rentalElectECI) {
    // IRC §871(d) election: treat as ECI — compute net rental income with deductions
    for (const prop of model.scheduleEProperties) {
      const grossIncome = (prop.rentsReceived ?? 0) + (prop.royaltiesReceived ?? 0)
      const totalExpenses =
        (prop.advertising ?? 0) + (prop.auto ?? 0) + (prop.cleaning ?? 0) +
        (prop.commissions ?? 0) + (prop.insurance ?? 0) + (prop.legal ?? 0) +
        (prop.management ?? 0) + (prop.mortgageInterest ?? 0) + (prop.otherInterest ?? 0) +
        (prop.repairs ?? 0) + (prop.supplies ?? 0) + (prop.taxes ?? 0) +
        (prop.utilities ?? 0) + (prop.depreciation ?? 0) + (prop.other ?? 0)
      eciRentalAmt += grossIncome - totalExpenses
    }
  } else {
    // Default: gross rents as FDAP
    for (const prop of model.scheduleEProperties) {
      fdapRentalAmt += (prop.rentsReceived ?? 0) + (prop.royaltiesReceived ?? 0)
    }
  }

  const eciRentalIncome = tracedFromComputation(
    eciRentalAmt,
    'form1040nr.eciRentalIncome',
    [],
    'Form 1040-NR — ECI Rental Income (§871(d) election)',
  )

  const fdapRentalIncome = tracedFromComputation(
    fdapRentalAmt,
    'form1040nr.fdapRentalIncome',
    [],
    'Schedule NEC — FDAP Rental Income (gross rents)',
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
  const totalECIBeforeTreaty = wagesTotal + eciInterestAmt + eciDividendsAmt +
    capGainForReturn + bizIncome + scholarshipAmt + otherECITotal +
    eciRetirementAmt + eciRentalAmt
  const totalECIAfterTreaty = Math.max(0, totalECIBeforeTreaty - treatyExemptAmt)

  const totalECIInputs = [
    'form1040nr.eciWages', 'form1040nr.eciInterest', 'form1040nr.eciDividends',
    'form1040nr.eciCapitalGains', 'form1040nr.eciBusinessIncome',
    'form1040nr.eciScholarship', 'form1040nr.eciOtherIncome',
    'form1040nr.eciRetirement', 'form1040nr.eciRentalIncome',
  ]
  const totalECI = tracedFromComputation(
    totalECIAfterTreaty,
    'form1040nr.totalECI',
    totalECIInputs,
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

  // Combine manually entered FDAP amounts with auto-classified amounts from Gap 1
  const fdapDivAmt = (nra?.fdapDividends ?? 0) + autoFdapDividendsAmt
  const fdapIntAmt = (nra?.fdapInterest ?? 0) + autoFdapInterestAmt
  const fdapRoyAmt = nra?.fdapRoyalties ?? 0
  const fdapOthAmt = nra?.fdapOtherIncome ?? 0
  const totalFDAPAmt = fdapDivAmt + fdapIntAmt + fdapRoyAmt + fdapOthAmt +
    fdapRetirementAmt + fdapRentalAmt + fdapSSAmt

  const fdapDividends = tracedFromComputation(fdapDivAmt, 'form1040nr.fdapDividends', [], 'Schedule NEC — Dividends')
  const fdapInterest = tracedFromComputation(fdapIntAmt, 'form1040nr.fdapInterest', [], 'Schedule NEC — Interest')
  const fdapRoyalties = tracedFromComputation(fdapRoyAmt, 'form1040nr.fdapRoyalties', [], 'Schedule NEC — Royalties')
  const fdapOther = tracedFromComputation(fdapOthAmt, 'form1040nr.fdapOther', [], 'Schedule NEC — Other')
  const totalFDAP = tracedFromComputation(
    totalFDAPAmt,
    'form1040nr.totalFDAP',
    ['form1040nr.fdapDividends', 'form1040nr.fdapInterest', 'form1040nr.fdapRoyalties',
     'form1040nr.fdapOther', 'form1040nr.fdapRetirement', 'form1040nr.fdapRentalIncome',
     'form1040nr.fdapSocialSecurity'],
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

  // ── Gap 5: Foreign Tax Credit for NRA ─────────────────────

  const foreignTaxPaid =
    model.form1099INTs.reduce((sum, f) => sum + (f.box6 ?? 0), 0) +
    model.form1099DIVs.reduce((sum, f) => sum + (f.box7 ?? 0), 0)

  // FTC = min(foreign tax paid, eciTax) — simple direct credit election for MVP
  const ftcAmt = Math.min(foreignTaxPaid, eciTaxAmt)
  const foreignTaxCredit = tracedFromComputation(
    ftcAmt,
    'form1040nr.foreignTaxCredit',
    ['form1040nr.eciTax'],
    'Form 1040-NR — Foreign Tax Credit',
  )

  // ── Gap 6: Child Tax Credit for NRA ───────────────────────

  const CTC_AMOUNT = 220_000 // $2,200 per qualifying child for 2025
  const taxYearEnd = new Date(model.taxYear, 11, 31) // December 31 of tax year
  let qualifyingChildCount = 0
  for (const dep of model.dependents) {
    if (!dep.dateOfBirth) continue
    const dob = new Date(dep.dateOfBirth)
    // Child must be under 17 at end of tax year
    const ageAtYearEnd = taxYearEnd.getFullYear() - dob.getFullYear() -
      (taxYearEnd < new Date(taxYearEnd.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0)
    if (ageAtYearEnd < 17 && ageAtYearEnd >= 0) {
      qualifyingChildCount++
    }
  }

  const grossCTC = qualifyingChildCount * CTC_AMOUNT
  // Non-refundable: limited to eciTax after FTC
  const eciTaxAfterFTC = Math.max(0, eciTaxAmt - ftcAmt)
  const ctcAmt = Math.min(grossCTC, eciTaxAfterFTC)
  const childTaxCredit = tracedFromComputation(
    ctcAmt,
    'form1040nr.childTaxCredit',
    ['form1040nr.eciTax', 'form1040nr.foreignTaxCredit'],
    `Form 1040-NR — Child Tax Credit (${qualifyingChildCount} qualifying child${qualifyingChildCount !== 1 ? 'ren' : ''})`,
  )

  // ── Credits total ─────────────────────────────────────────

  const creditTotalAmt = ftcAmt + ctcAmt
  const creditTotal = tracedFromComputation(
    creditTotalAmt,
    'form1040nr.creditTotal',
    ['form1040nr.foreignTaxCredit', 'form1040nr.childTaxCredit'],
    'Form 1040-NR — Total Credits',
  )

  // ── Total Tax ───────────────────────────────────────────────

  const totalTaxAmt = Math.max(0, eciTaxAmt - creditTotalAmt) + fdapTaxAmt
  const totalTax = tracedFromComputation(
    totalTaxAmt,
    'form1040nr.totalTax',
    ['form1040nr.eciTax', 'form1040nr.fdapTax', 'form1040nr.creditTotal'],
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
  // Gap 2: Include 1099-R box4 in withholding
  const r1099Withholding = model.form1099Rs.reduce((sum, f) => sum + f.box4, 0)
  // Gap 3: Include SSA-1099 box6 in withholding
  const ssaWithholding = model.formSSA1099s.reduce((sum, f) => sum + f.box6, 0)

  const totalWithheld = w2Withholding + int1099Withholding + div1099Withholding +
    misc1099Withholding + g1099Withholding + b1099Withholding + nec1099Withholding +
    r1099Withholding + ssaWithholding

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
    eciRetirement,
    eciRentalIncome,
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
    fdapRetirement,
    fdapRentalIncome,
    fdapSocialSecurity,
    ssaBenefits,
    totalFDAP,
    fdapTaxRate: fdapRate,
    fdapTax,
    treatyExemption,
    foreignTaxCredit,
    childTaxCredit,
    creditTotal,
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

  // Line 22: tax after credits = eciTax - creditTotal (floor 0) + fdapTax
  const taxAfterCredits = Math.max(0, nrResult.eciTax.amount - nrResult.creditTotal.amount) + nrResult.fdapTax.amount

  return {
    line1a: nrResult.eciWages,
    line1z: nrResult.eciWages,
    line2a: zero,
    line2b: nrResult.eciInterest,
    line3a: zero,
    line3b: nrResult.eciDividends,
    line4a: zero,
    line4b: nrResult.eciRetirement, // Map pension income to line 4b
    line5a: zero,
    line5b: zero,
    line6a: zero,
    line6b: zero,
    line7: nrResult.eciCapitalGains,
    line8: tracedFromComputation(
      nrResult.eciBusinessIncome.amount + nrResult.eciScholarship.amount +
        nrResult.eciOtherIncome.amount + nrResult.eciRentalIncome.amount,
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
    line18: tracedFromComputation(
      nrResult.eciTax.amount + nrResult.fdapTax.amount,
      'form1040.line18',
      ['form1040nr.eciTax', 'form1040nr.fdapTax'],
      'Tax + Schedule NEC (1040-NR compat)',
    ),
    line19: nrResult.childTaxCredit,
    line20: nrResult.foreignTaxCredit,
    line21: nrResult.creditTotal,
    line22: tracedFromComputation(
      taxAfterCredits,
      'form1040.line22',
      ['form1040nr.eciTax', 'form1040nr.fdapTax', 'form1040nr.creditTotal'],
      'Tax after credits (1040-NR compat)',
    ),
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
