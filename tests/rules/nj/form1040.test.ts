/**
 * Tests for New Jersey Form NJ-1040 — Resident Income Tax Return
 *
 * Covers: NJ income computation, tax brackets, exemptions, deductions,
 * pension exclusion, property tax deduction/credit, NJ EITC, NJ CTC,
 * state withholding, and refund/owed computation.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, StateReturnConfig, FilingStatus } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeNJ1040 } from '../../../src/rules/2025/nj/formNJ1040'
import { computeBracketTax } from '../../../src/rules/2025/taxComputation'
import { NJ_TAX_BRACKETS } from '../../../src/rules/2025/nj/constants'
import { makeW2, make1099INT, make1099DIV } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function makeNJConfig(overrides: Partial<StateReturnConfig> = {}): StateReturnConfig {
  return {
    stateCode: 'NJ',
    residencyType: 'full-year',
    ...overrides,
  }
}

function computeNJ(overrides: Partial<TaxReturn> = {}, configOverrides: Partial<StateReturnConfig> = {}) {
  const model: TaxReturn = {
    ...emptyTaxReturn(2025),
    ...overrides,
  }
  const federal = computeForm1040(model)
  const config = makeNJConfig(configOverrides)
  return computeNJ1040(model, federal, config)
}

// ── Basic Income ─────────────────────────────────────────────────

describe('NJ-1040 — gross income computation', () => {
  it('wages from W-2 Box 16 (NJ state wages)', () => {
    const result = computeNJ({
      w2s: [makeW2({
        id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000),
        box15State: 'NJ', box16StateWages: cents(70000), box17StateIncomeTax: cents(3000),
      })],
    })

    expect(result.line15_wages).toBe(cents(70000)) // Box 16, not Box 1
    expect(result.line29_njGrossIncome).toBe(cents(70000))
  })

  it('wages fall back to Box 1 when Box 16 is missing', () => {
    const result = computeNJ({
      w2s: [makeW2({
        id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000),
        box15State: 'NJ',
      })],
    })

    expect(result.line15_wages).toBe(cents(75000))
  })

  it('wages fall back to Box 1 when no state is specified', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
    })

    expect(result.line15_wages).toBe(cents(50000))
  })

  it('excludes non-NJ W-2s', () => {
    const result = computeNJ({
      w2s: [
        makeW2({ id: 'w1', employerName: 'NJ Co', box1: cents(60000), box2: cents(7000),
          box15State: 'NJ', box16StateWages: cents(60000), box17StateIncomeTax: cents(3000) }),
        makeW2({ id: 'w2', employerName: 'NY Co', box1: cents(40000), box2: cents(4000),
          box15State: 'NY', box17StateIncomeTax: cents(2000) }),
      ],
    })

    expect(result.line15_wages).toBe(cents(60000)) // only NJ
    expect(result.line52_njWithholding).toBe(cents(3000)) // only NJ
  })

  it('interest income from 1099-INTs', () => {
    const result = computeNJ({
      form1099INTs: [
        make1099INT({ id: 'i1', payerName: 'Bank A', box1: cents(500) }),
        make1099INT({ id: 'i2', payerName: 'Bank B', box1: cents(300) }),
      ],
    })

    expect(result.line16a_taxableInterest).toBe(cents(800))
  })

  it('dividends from 1099-DIVs (total ordinary)', () => {
    const result = computeNJ({
      form1099DIVs: [
        make1099DIV({ id: 'd1', payerName: 'Fund', box1a: cents(2000), box1b: cents(1000), box2a: cents(500) }),
      ],
    })

    expect(result.line17_dividends).toBe(cents(2000)) // box1a total, not qualified
    expect(result.line19_capitalGains).toBe(cents(500)) // box2a capital gain distributions
  })

  it('total income sums all categories', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000), box15State: 'NJ' })],
      form1099INTs: [make1099INT({ id: 'i', payerName: 'Bank', box1: cents(1000) })],
      form1099DIVs: [make1099DIV({ id: 'd', payerName: 'Fund', box1a: cents(2000) })],
    })

    expect(result.line27_totalIncome).toBe(cents(50000) + cents(1000) + cents(2000))
  })

  it('zero income produces zero throughout', () => {
    const result = computeNJ()

    expect(result.line27_totalIncome).toBe(0)
    expect(result.line29_njGrossIncome).toBe(0)
    expect(result.line38_njTaxableIncome).toBe(0)
    expect(result.line39_njTax).toBe(0)
    expect(result.line56_overpaid).toBe(0)
    expect(result.line57_amountOwed).toBe(0)
  })
})

// ── Tax Brackets ─────────────────────────────────────────────────

describe('NJ-1040 — tax brackets', () => {
  it('single $50K taxable income → correct bracket tax', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(52000), box2: cents(5000), box15State: 'NJ' })],
    })

    // After exemption ($1,000), taxable ≈ $51,000
    const expected = computeBracketTax(result.line38_njTaxableIncome, NJ_TAX_BRACKETS.single)
    expect(result.line39_njTax).toBe(expected)
    expect(result.line39_njTax).toBeGreaterThan(0)
  })

  it('MFJ uses wider brackets', () => {
    const result = computeNJ({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(10000), box15State: 'NJ' })],
    })

    const expected = computeBracketTax(result.line38_njTaxableIncome, NJ_TAX_BRACKETS.mfj)
    expect(result.line39_njTax).toBe(expected)
  })

  it('HOH uses MFJ brackets', () => {
    const result = computeNJ({
      filingStatus: 'hoh',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
      dependents: [{ firstName: 'Child', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2015-01-01' }],
    })

    const expected = computeBracketTax(result.line38_njTaxableIncome, NJ_TAX_BRACKETS.hoh)
    expect(result.line39_njTax).toBe(expected)
  })

  it('MFS uses single brackets', () => {
    const result = computeNJ({
      filingStatus: 'mfs',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
    })

    const expected = computeBracketTax(result.line38_njTaxableIncome, NJ_TAX_BRACKETS.mfs)
    expect(result.line39_njTax).toBe(expected)
    // MFS uses single brackets
    expect(NJ_TAX_BRACKETS.mfs).toBe(NJ_TAX_BRACKETS.single)
  })

  it('QW uses MFJ brackets', () => {
    const result = computeNJ({
      filingStatus: 'qw',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(10000), box15State: 'NJ' })],
    })

    const expected = computeBracketTax(result.line38_njTaxableIncome, NJ_TAX_BRACKETS.qw)
    expect(result.line39_njTax).toBe(expected)
    // QW uses MFJ brackets
    expect(NJ_TAX_BRACKETS.qw).toBe(NJ_TAX_BRACKETS.mfj)
  })

  it('income in first bracket (1.4%)', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(15000), box2: cents(0), box15State: 'NJ' })],
    })

    // After $1K exemption → $14K taxable, all in 1.4% bracket
    expect(result.line38_njTaxableIncome).toBe(cents(14000))
    expect(result.line39_njTax).toBe(Math.round(cents(14000) * 0.014)) // $196
  })
})

// ── Exemptions ──────────────────────────────────────────────────

describe('NJ-1040 — exemptions', () => {
  it('single → $1,000 self exemption', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000), box15State: 'NJ' })],
    })

    expect(result.line37_exemptions).toBe(cents(1000))
  })

  it('MFJ → $2,000 (self + spouse)', () => {
    const result = computeNJ({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
    })

    expect(result.line37_exemptions).toBe(cents(2000))
  })

  it('dependents add $1,500 each', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
      dependents: [
        { firstName: 'A', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2015-01-01' },
        { firstName: 'B', lastName: 'D', ssn: '222222222', relationship: 'daughter', monthsLived: 12, dateOfBirth: '2018-01-01' },
      ],
    })

    // $1K self + $1.5K × 2 dependents = $4,000
    expect(result.line37_exemptions).toBe(cents(4000))
  })

  it('veteran exemption adds $6,000', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000), box15State: 'NJ' })],
    }, { njTaxpayerVeteran: true })

    // $1K self + $6K veteran = $7,000
    expect(result.line37_exemptions).toBe(cents(7000))
  })

  it('age 65+ adds $1,000', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000), box15State: 'NJ' })],
      deductions: {
        method: 'standard',
        taxpayerAge65: true,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    // $1K self + $1K age 65 = $2,000
    expect(result.line37_exemptions).toBe(cents(2000))
  })

  it('blind/disabled adds $1,000', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000), box15State: 'NJ' })],
    }, { njTaxpayerBlindDisabled: true })

    // $1K self + $1K blind/disabled = $2,000
    expect(result.line37_exemptions).toBe(cents(2000))
  })

  it('MFJ with spouse veteran and age 65+', () => {
    const result = computeNJ({
      filingStatus: 'mfj',
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
      deductions: {
        method: 'standard',
        taxpayerAge65: true,
        taxpayerBlind: false,
        spouseAge65: true,
        spouseBlind: false,
      },
    }, { njSpouseVeteran: true })

    // $1K self + $1K spouse + $1K self-age65 + $1K spouse-age65 + $6K spouse-veteran = $10,000
    expect(result.line37_exemptions).toBe(cents(10000))
  })

  it('college student dependents add additional $1,000 each', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
      dependents: [
        { firstName: 'A', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2005-01-01' },
        { firstName: 'B', lastName: 'D', ssn: '222222222', relationship: 'daughter', monthsLived: 12, dateOfBirth: '2018-01-01' },
      ],
    }, { njDependentCollegeStudents: ['111111111'] })

    // $1K self + $1.5K × 2 deps + $1K × 1 college = $5,000
    expect(result.line37_exemptions).toBe(cents(5000))
  })

  it('college student numeric count used when checkbox IDs are empty', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
      dependents: [
        { firstName: 'A', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '' },
        { firstName: 'B', lastName: 'D', ssn: '222222222', relationship: 'daughter', monthsLived: 12, dateOfBirth: '' },
      ],
    }, { njCollegeStudentDependentCount: 2 })

    // $1K self + $1.5K × 2 deps + $1K × 2 college = $6,000
    expect(result.line37_exemptions).toBe(cents(6000))
  })

  it('checkbox IDs take precedence over numeric count', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
      dependents: [
        { firstName: 'A', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2005-01-01' },
        { firstName: 'B', lastName: 'D', ssn: '222222222', relationship: 'daughter', monthsLived: 12, dateOfBirth: '2018-01-01' },
      ],
    }, { njDependentCollegeStudents: ['111111111'], njCollegeStudentDependentCount: 5 })

    // Checkbox IDs win: $1K self + $1.5K × 2 deps + $1K × 1 college = $5,000
    // (numeric count of 5 is ignored because checkbox IDs are present)
    expect(result.line37_exemptions).toBe(cents(5000))
  })
})

// ── Property Tax Deduction / Credit ─────────────────────────────

describe('NJ-1040 — property tax', () => {
  it('homeowner: property tax deducted up to $15,000', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
    }, { njIsHomeowner: true, njPropertyTaxPaid: cents(10000) })

    expect(result.line30_propertyTaxDeduction).toBe(cents(10000))
    expect(result.usedPropertyTaxDeduction).toBe(true)
    expect(result.line43_propertyTaxCredit).toBe(0) // used deduction instead
  })

  it('homeowner: capped at $15,000', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(200000), box2: cents(25000), box15State: 'NJ' })],
    }, { njIsHomeowner: true, njPropertyTaxPaid: cents(20000) })

    expect(result.line30_propertyTaxDeduction).toBe(cents(15000))
  })

  it('renter: 18% of rent as deemed property tax', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(60000), box2: cents(6000), box15State: 'NJ' })],
    }, { njIsHomeowner: false, njRentPaid: cents(24000) })

    // 18% of $24,000 = $4,320
    expect(result.line30_propertyTaxDeduction).toBe(cents(4320))
    expect(result.usedPropertyTaxDeduction).toBe(true)
  })

  it('small property tax → uses $50 credit instead of deduction', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000), box15State: 'NJ' })],
    }, { njIsHomeowner: true, njPropertyTaxPaid: cents(40) })

    // $40 < $50 → credit is more beneficial
    expect(result.usedPropertyTaxDeduction).toBe(false)
    expect(result.line30_propertyTaxDeduction).toBe(0)
    expect(result.line43_propertyTaxCredit).toBe(cents(50))
  })

  it('no housing info → no deduction or credit', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000), box15State: 'NJ' })],
    })

    expect(result.line30_propertyTaxDeduction).toBe(0)
    expect(result.line43_propertyTaxCredit).toBe(0)
    expect(result.usedPropertyTaxDeduction).toBe(false)
  })
})

// ── Medical Expense Deduction ────────────────────────────────────

describe('NJ-1040 — medical expense deduction', () => {
  it('medical above 2% floor is deductible', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: cents(5000),
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: 0,
          personalPropertyTaxes: 0,
          mortgageInterest: 0,
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: 0,
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
        taxpayerAge65: false,
        taxpayerBlind: false,
        spouseAge65: false,
        spouseBlind: false,
      },
    })

    // NJ gross = $80K, floor = 2% × $80K = $1,600
    // Medical deduction = $5,000 - $1,600 = $3,400
    expect(result.line31_medicalExpenses).toBe(cents(3400))
  })

  it('no medical expenses → no deduction', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
    })

    expect(result.line31_medicalExpenses).toBe(0)
  })
})

// ── Pension Exclusion ────────────────────────────────────────────

describe('NJ-1040 — pension exclusion', () => {
  it('pension income under exclusion limit and income eligible', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(30000), box2: cents(3000), box15State: 'NJ' })],
      form1099Rs: [{
        id: 'r1', payerName: 'Pension', payerTin: '00-0000000',
        box1: cents(40000), box2a: cents(40000), box2b: false,
        box4: 0, box7: '7', box12: 0,
      }],
    })

    // Single: exclusion up to $75K, income limit $100K
    // Total income = $30K + $40K = $70K < $100K → eligible
    expect(result.line20a_pensions).toBe(cents(40000))
    expect(result.line20b_pensionExclusion).toBe(cents(40000)) // full pension excluded
    expect(result.line28c_totalExclusions).toBe(cents(40000))
  })

  it('pension capped at exclusion max', () => {
    const result = computeNJ({
      form1099Rs: [{
        id: 'r1', payerName: 'Pension', payerTin: '00-0000000',
        box1: cents(90000), box2a: cents(90000), box2b: false,
        box4: 0, box7: '7', box12: 0,
      }],
    })

    // Single: max exclusion = $75K
    expect(result.line20b_pensionExclusion).toBe(cents(75000))
  })

  it('income over limit → no pension exclusion', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(8000), box15State: 'NJ' })],
      form1099Rs: [{
        id: 'r1', payerName: 'Pension', payerTin: '00-0000000',
        box1: cents(25000), box2a: cents(25000), box2b: false,
        box4: 0, box7: '7', box12: 0,
      }],
    })

    // Total income = $80K + $25K = $105K > $100K single limit
    expect(result.line20b_pensionExclusion).toBe(0)
  })

  it('rollover (code G) excluded from pension income', () => {
    const result = computeNJ({
      form1099Rs: [{
        id: 'r1', payerName: 'Pension', payerTin: '00-0000000',
        box1: cents(50000), box2a: cents(50000), box2b: false,
        box4: 0, box7: 'G', box12: 0,
      }],
    })

    expect(result.line20a_pensions).toBe(0) // rollover excluded
  })
})

// ── NJ EITC ──────────────────────────────────────────────────────

describe('NJ-1040 — NJ EITC', () => {
  it('40% of federal EITC when eligible', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(15000), box2: cents(0), box15State: 'NJ' })],
      dependents: [
        { firstName: 'Child', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2015-01-01' },
      ],
    }
    const federal = computeForm1040(model)
    const config = makeNJConfig()
    const result = computeNJ1040(model, federal, config)

    if (federal.earnedIncomeCredit && federal.earnedIncomeCredit.creditAmount > 0) {
      expect(result.line44_njEITC).toBe(Math.round(federal.earnedIncomeCredit.creditAmount * 0.40))
    }
  })

  it('no federal EITC → no NJ EITC', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(200000), box2: cents(30000), box15State: 'NJ' })],
    })

    expect(result.line44_njEITC).toBe(0)
  })
})

// ── NJ Child Tax Credit ──────────────────────────────────────────

describe('NJ-1040 — NJ Child Tax Credit', () => {
  it('$1,000 per child age ≤ 5', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000), box15State: 'NJ' })],
      dependents: [
        { firstName: 'A', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2021-06-15' }, // age 4
        { firstName: 'B', lastName: 'D', ssn: '222222222', relationship: 'daughter', monthsLived: 12, dateOfBirth: '2023-01-01' }, // age 2
        { firstName: 'C', lastName: 'D', ssn: '333333333', relationship: 'son', monthsLived: 12, dateOfBirth: '2010-01-01' }, // age 15 → not qualifying
      ],
    })

    expect(result.line45_njChildTaxCredit).toBe(cents(2000)) // 2 qualifying children × $1,000
  })

  it('income over $80K → no CTC', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(85000), box2: cents(8000), box15State: 'NJ' })],
      dependents: [
        { firstName: 'A', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2023-01-01' },
      ],
    })

    expect(result.line45_njChildTaxCredit).toBe(0)
  })

  it('no young children → $0', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000), box15State: 'NJ' })],
      dependents: [
        { firstName: 'A', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2010-01-01' }, // age 15
      ],
    })

    expect(result.line45_njChildTaxCredit).toBe(0)
  })
})

// ── Withholding and Refund/Owed ──────────────────────────────────

describe('NJ-1040 — withholding and refund/owed', () => {
  it('withholding exceeds tax → refund', () => {
    const result = computeNJ({
      w2s: [makeW2({
        id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000),
        box15State: 'NJ', box17StateIncomeTax: cents(5000),
      })],
    })

    expect(result.line52_njWithholding).toBe(cents(5000))
    expect(result.line56_overpaid).toBeGreaterThan(0)
    expect(result.line57_amountOwed).toBe(0)
  })

  it('no withholding → owes full tax', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000), box15State: 'NJ' })],
    })

    expect(result.line52_njWithholding).toBe(0)
    expect(result.line56_overpaid).toBe(0)
    expect(result.line57_amountOwed).toBe(result.line49_taxAfterCredits)
  })

  it('refundable credits counted as payments', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(5000),
        box15State: 'NJ', box17StateIncomeTax: cents(2000) })],
    }, { njIsHomeowner: false, njRentPaid: cents(1000) })

    // small rent → deemed property tax = $180 → use $50 credit
    // total payments = withholding + refundable credits
    expect(result.line55_totalPayments).toBe(result.line52_njWithholding + result.refundableCredits)
  })

  it('only NJ W-2s counted for withholding', () => {
    const result = computeNJ({
      w2s: [
        makeW2({ id: 'w1', employerName: 'NJ Co', box1: cents(60000), box2: cents(7000),
          box15State: 'NJ', box17StateIncomeTax: cents(3000) }),
        makeW2({ id: 'w2', employerName: 'PA Co', box1: cents(40000), box2: cents(4000),
          box15State: 'PA', box17StateIncomeTax: cents(2000) }),
      ],
    })

    expect(result.line52_njWithholding).toBe(cents(3000))
  })
})

// ── Integration Tests ────────────────────────────────────────────

describe('NJ-1040 — integration', () => {
  it('full return: $120K wages, $10K property tax, NJ withholding', () => {
    const result = computeNJ({
      w2s: [makeW2({
        id: 'w', employerName: 'Tech Co', box1: cents(120000), box2: cents(18000),
        box15State: 'NJ', box16StateWages: cents(120000), box17StateIncomeTax: cents(6500),
      })],
    }, { njIsHomeowner: true, njPropertyTaxPaid: cents(10000) })

    expect(result.line15_wages).toBe(cents(120000))
    expect(result.line29_njGrossIncome).toBe(cents(120000))
    expect(result.line30_propertyTaxDeduction).toBe(cents(10000))
    expect(result.line37_exemptions).toBe(cents(1000)) // single
    expect(result.line38_njTaxableIncome).toBe(cents(120000) - cents(10000) - cents(1000))
    expect(result.line39_njTax).toBeGreaterThan(0)
    expect(result.line52_njWithholding).toBe(cents(6500))
  })

  it('taxable income cannot go negative', () => {
    const result = computeNJ({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(500), box2: cents(0), box15State: 'NJ' })],
    })

    // Income $500 < exemption $1,000 → taxable clamped to $0
    expect(result.line38_njTaxableIncome).toBe(0)
    expect(result.line39_njTax).toBe(0)
  })

  it('MFJ family: wages + dependents + property tax + veteran', () => {
    const result = computeNJ({
      filingStatus: 'mfj',
      w2s: [makeW2({
        id: 'w', employerName: 'Corp', box1: cents(70000), box2: cents(8000),
        box15State: 'NJ', box16StateWages: cents(70000), box17StateIncomeTax: cents(3500),
      })],
      dependents: [
        { firstName: 'A', lastName: 'D', ssn: '111111111', relationship: 'son', monthsLived: 12, dateOfBirth: '2022-01-01' },
        { firstName: 'B', lastName: 'D', ssn: '222222222', relationship: 'daughter', monthsLived: 12, dateOfBirth: '2018-01-01' },
      ],
    }, { njIsHomeowner: true, njPropertyTaxPaid: cents(12000), njTaxpayerVeteran: true })

    // Exemptions: $1K self + $1K spouse + $1.5K × 2 deps + $6K veteran = $11,000
    expect(result.line37_exemptions).toBe(cents(11000))
    expect(result.line30_propertyTaxDeduction).toBe(cents(12000))
    expect(result.line15_wages).toBe(cents(70000))

    // NJ CTC: $70K < $80K cap, child A (age 3) qualifies, child B (age 7) too old
    expect(result.line45_njChildTaxCredit).toBe(cents(1000))

    // Verify computation chain
    expect(result.line38_njTaxableIncome).toBe(
      cents(70000) - cents(12000) - cents(11000),
    )
  })
})
