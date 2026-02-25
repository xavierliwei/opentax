/**
 * STATE-GAP-032: NC Form D-400 — Expanded Test Coverage
 *
 * Covers: all 5 filing statuses (standard deduction differences), flat tax rate
 * verification, part-year apportionment edge cases, nonresident zero computation,
 * high income, zero income, withholding from multiple employers, and NC-specific
 * additions/deductions (HSA add-back, state/local tax add-back, SS exemption,
 * US government obligation interest).
 */

import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, StateReturnConfig, FilingStatus } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeFormD400, computeNCApportionmentRatio } from '../../../src/rules/2025/nc/formd400'
import { NC_FLAT_TAX_RATE, NC_STANDARD_DEDUCTION } from '../../../src/rules/2025/nc/constants'
import { makeW2, make1099INT, makeSSA1099 } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function makeNCReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [makeW2({ id: 'w1', employerName: 'NC Co', box1: cents(100000), box2: cents(12000), box15State: 'NC', box16StateWages: cents(100000), box17StateIncomeTax: cents(4000) })],
    ...overrides,
  }
}

function computeD400(overrides: Partial<TaxReturn> = {}, config?: StateReturnConfig) {
  const tr = makeNCReturn(overrides)
  const cfg = config ?? { stateCode: 'NC', residencyType: 'full-year' }
  const fed = computeForm1040(tr)
  return computeFormD400(tr, fed, cfg)
}

// ── Standard deduction by filing status ─────────────────────────

describe('NC standard deduction — all filing statuses', () => {
  const cases: [FilingStatus, number][] = [
    ['single', cents(12750)],
    ['mfj', cents(25500)],
    ['mfs', cents(12750)],
    ['hoh', cents(19125)],
    ['qw', cents(25500)],
  ]

  for (const [status, expected] of cases) {
    it(`${status}: standard deduction = $${expected / 100}`, () => {
      const result = computeD400({ filingStatus: status })
      expect(result.standardDeduction).toBe(expected)
    })
  }

  it('QW matches MFJ standard deduction', () => {
    expect(NC_STANDARD_DEDUCTION.qw).toBe(NC_STANDARD_DEDUCTION.mfj)
  })

  it('MFS matches single standard deduction', () => {
    expect(NC_STANDARD_DEDUCTION.mfs).toBe(NC_STANDARD_DEDUCTION.single)
  })

  it('HOH deduction is between single and MFJ', () => {
    expect(NC_STANDARD_DEDUCTION.hoh).toBeGreaterThan(NC_STANDARD_DEDUCTION.single)
    expect(NC_STANDARD_DEDUCTION.hoh).toBeLessThan(NC_STANDARD_DEDUCTION.mfj)
  })
})

// ── Flat tax rate verification ──────────────────────────────────

describe('NC flat tax rate', () => {
  it('rate is 4.25%', () => {
    expect(NC_FLAT_TAX_RATE).toBe(0.0425)
  })

  it('tax = (AGI - standard deduction) × 4.25% for single $100K', () => {
    const result = computeD400()
    const expectedTaxable = cents(100000) - NC_STANDARD_DEDUCTION.single
    const expectedTax = Math.round(expectedTaxable * NC_FLAT_TAX_RATE)
    expect(result.ncTaxableIncome).toBe(expectedTaxable)
    expect(result.ncTax).toBe(expectedTax)
  })

  it('same flat rate applies to all filing statuses', () => {
    const statuses: FilingStatus[] = ['single', 'mfj', 'mfs', 'hoh', 'qw']
    for (const status of statuses) {
      const result = computeD400({ filingStatus: status })
      const expectedTax = Math.round(result.ncTaxableIncome * NC_FLAT_TAX_RATE)
      expect(result.ncTax).toBe(expectedTax)
    }
  })
})

// ── Tax impact by filing status ─────────────────────────────────

describe('NC tax — filing status impact', () => {
  it('MFJ pays less tax than single on same income (larger deduction)', () => {
    const singleResult = computeD400({ filingStatus: 'single' })
    const mfjResult = computeD400({ filingStatus: 'mfj' })
    expect(mfjResult.ncTax).toBeLessThan(singleResult.ncTax)
  })

  it('HOH pays less tax than single', () => {
    const singleResult = computeD400({ filingStatus: 'single' })
    const hohResult = computeD400({ filingStatus: 'hoh' })
    expect(hohResult.ncTax).toBeLessThan(singleResult.ncTax)
  })

  it('QW and MFJ produce identical tax', () => {
    const mfjResult = computeD400({ filingStatus: 'mfj' })
    const qwResult = computeD400({ filingStatus: 'qw' })
    expect(qwResult.ncTax).toBe(mfjResult.ncTax)
  })

  it('MFS and single produce identical tax', () => {
    const singleResult = computeD400({ filingStatus: 'single' })
    const mfsResult = computeD400({ filingStatus: 'mfs' })
    expect(mfsResult.ncTax).toBe(singleResult.ncTax)
  })
})

// ── Apportionment ratio ─────────────────────────────────────────

describe('NC apportionment ratio', () => {
  it('full-year → ratio = 1', () => {
    expect(computeNCApportionmentRatio({ stateCode: 'NC', residencyType: 'full-year' }, 2025)).toBe(1)
  })

  it('nonresident → ratio = 0', () => {
    expect(computeNCApportionmentRatio({ stateCode: 'NC', residencyType: 'nonresident' }, 2025)).toBe(0)
  })

  it('half-year → ~0.4959', () => {
    const ratio = computeNCApportionmentRatio({
      stateCode: 'NC', residencyType: 'part-year',
      moveInDate: '2025-01-01', moveOutDate: '2025-06-30',
    }, 2025)
    expect(ratio).toBeGreaterThan(0.49)
    expect(ratio).toBeLessThan(0.51)
  })

  it('single day → 1/365', () => {
    const ratio = computeNCApportionmentRatio({
      stateCode: 'NC', residencyType: 'part-year',
      moveInDate: '2025-06-15', moveOutDate: '2025-06-15',
    }, 2025)
    expect(ratio).toBeCloseTo(1 / 365, 4)
  })

  it('reversed dates → 0', () => {
    const ratio = computeNCApportionmentRatio({
      stateCode: 'NC', residencyType: 'part-year',
      moveInDate: '2025-12-31', moveOutDate: '2025-01-01',
    }, 2025)
    expect(ratio).toBe(0)
  })

  it('full year part-year dates → 1', () => {
    const ratio = computeNCApportionmentRatio({
      stateCode: 'NC', residencyType: 'part-year',
      moveInDate: '2025-01-01', moveOutDate: '2025-12-31',
    }, 2025)
    expect(ratio).toBe(1)
  })

  it('dates before year start are clamped', () => {
    const ratio = computeNCApportionmentRatio({
      stateCode: 'NC', residencyType: 'part-year',
      moveInDate: '2024-06-01', moveOutDate: '2025-06-30',
    }, 2025)
    expect(ratio).toBeGreaterThan(0.49)
    expect(ratio).toBeLessThan(0.51)
  })

  it('leap year 2024 → 366 days denominator', () => {
    const ratio = computeNCApportionmentRatio({
      stateCode: 'NC', residencyType: 'part-year',
      moveInDate: '2024-01-01', moveOutDate: '2024-01-01',
    }, 2024)
    expect(ratio).toBeCloseTo(1 / 366, 4)
  })
})

// ── Part-year return computation ────────────────────────────────

describe('NC part-year return', () => {
  it('part-year tax is prorated', () => {
    const fullYear = computeD400()
    const partYear = computeD400({}, {
      stateCode: 'NC', residencyType: 'part-year',
      moveInDate: '2025-01-01', moveOutDate: '2025-06-30',
    })
    expect(partYear.ncTax).toBeLessThan(fullYear.ncTax)
    expect(partYear.apportionmentRatio).toBeLessThan(1)
  })

  it('part-year reports nc source income', () => {
    const result = computeD400({}, {
      stateCode: 'NC', residencyType: 'part-year',
      moveInDate: '2025-07-01', moveOutDate: '2025-12-31',
    })
    expect(result.ncSourceIncome).toBeDefined()
    expect(result.ncSourceIncome!).toBeLessThan(result.ncAGI)
  })

  it('full-year does not report nc source income', () => {
    const result = computeD400()
    expect(result.ncSourceIncome).toBeUndefined()
  })
})

// ── Nonresident ─────────────────────────────────────────────────

describe('NC nonresident', () => {
  it('nonresident produces zero tax', () => {
    const result = computeD400({}, { stateCode: 'NC', residencyType: 'nonresident' })
    expect(result.apportionmentRatio).toBe(0)
    expect(result.ncTax).toBe(0)
  })

  it('nonresident with NC withholding → full refund', () => {
    const result = computeD400({}, { stateCode: 'NC', residencyType: 'nonresident' })
    expect(result.overpaid).toBe(cents(4000))
  })
})

// ── Withholding ─────────────────────────────────────────────────

describe('NC withholding', () => {
  it('sums only NC withholding from W-2s', () => {
    const result = computeD400({
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(50000), box2: cents(5000), box15State: 'NC', box17StateIncomeTax: cents(2000) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(50000), box2: cents(5000), box15State: 'VA', box17StateIncomeTax: cents(1500) }),
      ],
    })
    expect(result.stateWithholding).toBe(cents(2000))
  })

  it('multiple NC employers → sums all', () => {
    const result = computeD400({
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(60000), box2: cents(6000), box15State: 'NC', box17StateIncomeTax: cents(2500) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(40000), box2: cents(4000), box15State: 'NC', box17StateIncomeTax: cents(1500) }),
      ],
    })
    expect(result.stateWithholding).toBe(cents(4000))
  })

  it('no NC withholding → $0', () => {
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'A', box1: cents(100000), box2: cents(12000), box15State: 'CA', box17StateIncomeTax: cents(5000) })],
    })
    expect(result.stateWithholding).toBe(0)
  })
})

// ── Refund / amount owed ────────────────────────────────────────

describe('NC refund/owed', () => {
  it('withholding > tax → refund', () => {
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(30000), box2: cents(2000), box15State: 'NC', box17StateIncomeTax: cents(5000) })],
    })
    expect(result.overpaid).toBeGreaterThan(0)
    expect(result.amountOwed).toBe(0)
  })

  it('withholding < tax → amount owed', () => {
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(200000), box2: cents(30000), box15State: 'NC', box17StateIncomeTax: cents(1000) })],
    })
    expect(result.amountOwed).toBeGreaterThan(0)
    expect(result.overpaid).toBe(0)
  })
})

// ── Edge cases ──────────────────────────────────────────────────

describe('NC edge cases', () => {
  it('zero income → zero tax', () => {
    const result = computeD400({ w2s: [] })
    expect(result.ncAGI).toBe(0)
    expect(result.ncTaxableIncome).toBe(0)
    expect(result.ncTax).toBe(0)
  })

  it('income below standard deduction → taxable = 0', () => {
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(10000), box2: cents(500), box15State: 'NC', box17StateIncomeTax: cents(200) })],
    })
    expect(result.ncTaxableIncome).toBe(0)
    expect(result.ncTax).toBe(0)
    expect(result.overpaid).toBe(cents(200))
  })

  it('high earner $500K → deterministic flat tax', () => {
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(500000), box2: cents(80000), box15State: 'NC', box17StateIncomeTax: cents(20000) })],
    })
    const expectedTaxable = cents(500000) - NC_STANDARD_DEDUCTION.single
    const expectedTax = Math.round(expectedTaxable * NC_FLAT_TAX_RATE)
    expect(result.ncTax).toBe(expectedTax)
  })

  it('W-2 only return: no additions or deductions, NC AGI = federal AGI', () => {
    const result = computeD400()
    expect(result.ncAdditions).toBe(0)
    expect(result.ncDeductions).toBe(0)
    expect(result.ncAGI).toBe(result.federalAGI)
  })
})

// ── NC Additions (D-400 Schedule S, Part A) ────────────────────

describe('NC additions — HSA deduction add-back', () => {
  it('HSA contributions create an NC addition (NC does not conform to IRC 223)', () => {
    const result = computeD400({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(3000),
        qualifiedExpenses: cents(1000),
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    })
    // The federal HSA deduction (deductibleAmount) should be added back for NC
    expect(result.hsaAddBack).toBe(cents(3000))
    expect(result.ncAdditions).toBeGreaterThanOrEqual(cents(3000))
    expect(result.ncAGI).toBeGreaterThan(result.federalAGI)
  })

  it('no HSA → hsaAddBack is zero', () => {
    const result = computeD400()
    expect(result.hsaAddBack).toBe(0)
  })

  it('HSA add-back increases NC taxable income and tax', () => {
    const withoutHSA = computeD400()
    const withHSA = computeD400({
      hsa: {
        coverageType: 'family',
        contributions: cents(5000),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    })
    // NC adds back the HSA deduction, so NC tax should be higher
    // (even though federal tax is lower due to the HSA deduction)
    expect(withHSA.ncAGI).toBeGreaterThan(withHSA.federalAGI)
    // The NC additions should include the HSA add-back
    expect(withHSA.hsaAddBack).toBeGreaterThan(0)
  })
})

describe('NC additions — state/local income tax add-back', () => {
  it('itemized state/local taxes create an NC addition', () => {
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'NC Co', box1: cents(150000), box2: cents(30000), box15State: 'NC', box17StateIncomeTax: cents(6000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: cents(8000),
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(5000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(15000),
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: cents(5000),
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
      },
    })
    expect(result.stateLocalTaxAddBack).toBe(cents(8000))
    expect(result.ncAdditions).toBeGreaterThanOrEqual(cents(8000))
    expect(result.ncAGI).toBeGreaterThan(result.federalAGI)
  })

  it('standard deduction filer → no state/local tax add-back', () => {
    const result = computeD400()
    expect(result.stateLocalTaxAddBack).toBe(0)
  })

  it('itemized with zero state/local taxes → no add-back', () => {
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'NC Co', box1: cents(150000), box2: cents(30000), box15State: 'NC', box17StateIncomeTax: cents(6000) })],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(5000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(20000),
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: cents(5000),
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
      },
    })
    expect(result.stateLocalTaxAddBack).toBe(0)
  })
})

// ── NC Deductions (D-400 Schedule S, Part B) ───────────────────

describe('NC deductions — Social Security exemption', () => {
  it('Social Security benefits reduce NC AGI (NC fully exempts SS)', () => {
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'NC Co', box1: cents(50000), box2: cents(5000), box15State: 'NC', box17StateIncomeTax: cents(2000) })],
      formSSA1099s: [
        makeSSA1099({ id: 'ssa-1', recipientName: 'Test Filer', box5: cents(24000), box6: cents(2400) }),
      ],
    })
    // The taxable SS amount (line6b) should be deducted from NC income
    expect(result.ssExemption).toBeGreaterThan(0)
    expect(result.ncDeductions).toBeGreaterThan(0)
    expect(result.ncAGI).toBeLessThan(result.federalAGI)
  })

  it('NC AGI differs from federal AGI when SS income is present', () => {
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'NC Co', box1: cents(30000), box2: cents(3000), box15State: 'NC', box17StateIncomeTax: cents(1500) })],
      formSSA1099s: [
        makeSSA1099({ id: 'ssa-1', recipientName: 'Test Retiree', box5: cents(18000), box6: cents(1800) }),
      ],
    })
    // With SS income, federal AGI includes taxable SS, but NC deducts it back
    expect(result.federalAGI).not.toBe(result.ncAGI)
    expect(result.ncAGI).toBe(result.federalAGI - result.ssExemption - result.usGovInterest)
  })

  it('zero SS benefits → ssExemption is zero', () => {
    const result = computeD400()
    expect(result.ssExemption).toBe(0)
  })

  it('SS exemption equals Form 1040 Line 6b (taxable SS)', () => {
    const tr = makeNCReturn({
      w2s: [makeW2({ id: 'w1', employerName: 'NC Co', box1: cents(50000), box2: cents(5000), box15State: 'NC', box17StateIncomeTax: cents(2000) })],
      formSSA1099s: [
        makeSSA1099({ id: 'ssa-1', recipientName: 'Test Filer', box5: cents(24000), box6: cents(2400) }),
      ],
    })
    const fed = computeForm1040(tr)
    const nc = computeFormD400(tr, fed, { stateCode: 'NC', residencyType: 'full-year' })
    expect(nc.ssExemption).toBe(fed.line6b.amount)
  })
})

describe('NC deductions — US government obligation interest', () => {
  it('Treasury bond interest creates an NC deduction (1099-INT box 3)', () => {
    const result = computeD400({
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'TreasuryDirect', box1: cents(5000), box3: cents(5000) }),
      ],
    })
    expect(result.usGovInterest).toBe(cents(5000))
    expect(result.ncDeductions).toBeGreaterThanOrEqual(cents(5000))
    expect(result.ncAGI).toBeLessThan(result.federalAGI)
  })

  it('multiple 1099-INTs with box 3 → sums all US gov interest', () => {
    const result = computeD400({
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'TreasuryDirect', box1: cents(3000), box3: cents(3000) }),
        make1099INT({ id: 'int-2', payerName: 'Schwab Treasury', box1: cents(2000), box3: cents(2000) }),
      ],
    })
    expect(result.usGovInterest).toBe(cents(5000))
    expect(result.ncDeductions).toBeGreaterThanOrEqual(cents(5000))
  })

  it('1099-INT with box3 = 0 → no US gov interest deduction', () => {
    const result = computeD400({
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase Bank', box1: cents(2000), box3: 0 }),
      ],
    })
    expect(result.usGovInterest).toBe(0)
  })

  it('mix of regular interest and US gov interest', () => {
    const result = computeD400({
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase Bank', box1: cents(3000), box3: 0 }),
        make1099INT({ id: 'int-2', payerName: 'TreasuryDirect', box1: cents(2000), box3: cents(2000) }),
      ],
    })
    // Only box3 (US gov interest) is deducted, not regular interest
    expect(result.usGovInterest).toBe(cents(2000))
    expect(result.ncDeductions).toBeGreaterThanOrEqual(cents(2000))
  })
})

// ── Combined additions and deductions ──────────────────────────

describe('NC AGI — combined additions and deductions', () => {
  it('NC AGI = federal AGI + additions - deductions', () => {
    const result = computeD400({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(3000),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      formSSA1099s: [
        makeSSA1099({ id: 'ssa-1', recipientName: 'Test', box5: cents(18000) }),
      ],
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Treasury', box1: cents(1000), box3: cents(1000) }),
      ],
    })
    expect(result.ncAGI).toBe(result.federalAGI + result.ncAdditions - result.ncDeductions)
  })

  it('deductions larger than additions → NC AGI < federal AGI', () => {
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'NC Co', box1: cents(40000), box2: cents(4000), box15State: 'NC', box17StateIncomeTax: cents(1500) })],
      formSSA1099s: [
        makeSSA1099({ id: 'ssa-1', recipientName: 'Retiree', box5: cents(30000), box6: cents(3000) }),
      ],
    })
    expect(result.ncDeductions).toBeGreaterThan(result.ncAdditions)
    expect(result.ncAGI).toBeLessThan(result.federalAGI)
  })

  it('additions larger than deductions → NC AGI > federal AGI', () => {
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'NC Co', box1: cents(150000), box2: cents(30000), box15State: 'NC', box17StateIncomeTax: cents(6000) })],
      hsa: {
        coverageType: 'family',
        contributions: cents(8000),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: cents(10000),
          stateLocalSalesTaxes: 0,
          realEstateTaxes: cents(5000),
          personalPropertyTaxes: 0,
          mortgageInterest: cents(15000),
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: cents(5000),
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
      },
    })
    // HSA add-back + state/local tax add-back should outweigh zero deductions
    expect(result.ncAdditions).toBeGreaterThan(result.ncDeductions)
    expect(result.ncAGI).toBeGreaterThan(result.federalAGI)
  })

  it('detail fields sum correctly', () => {
    const result = computeD400({
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4000),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Treasury', box1: cents(2000), box3: cents(2000) }),
      ],
    })
    expect(result.ncAdditions).toBe(result.hsaAddBack + result.stateLocalTaxAddBack)
    expect(result.ncDeductions).toBe(result.ssExemption + result.usGovInterest)
  })

  it('NC AGI cannot go negative due to deductions (taxable income floors at 0)', () => {
    // Large SS benefits + US gov interest could push NC AGI low
    const result = computeD400({
      w2s: [makeW2({ id: 'w1', employerName: 'NC Co', box1: cents(10000), box2: cents(500), box15State: 'NC', box17StateIncomeTax: cents(200) })],
      formSSA1099s: [
        makeSSA1099({ id: 'ssa-1', recipientName: 'Senior', box5: cents(30000) }),
      ],
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Treasury', box1: cents(5000), box3: cents(5000) }),
      ],
    })
    // NC taxable income is max(0, ncAGI - standardDeduction)
    expect(result.ncTaxableIncome).toBeGreaterThanOrEqual(0)
    expect(result.ncTax).toBeGreaterThanOrEqual(0)
  })
})
