/**
 * STATE-GAP-031: DC Form D-40 — Expanded Test Coverage
 *
 * Covers: all 5 filing statuses (standard deduction differences), bracket boundaries,
 * itemized vs standard deduction selection, part-year apportionment edge cases,
 * commuter exemption (MD/VA), nonresident with non-exempt state, and refund/owed.
 */

import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, StateReturnConfig, FilingStatus } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeFormD40, computeApportionmentRatio } from '../../../src/rules/2025/dc/formd40'
import { computeBracketTax } from '../../../src/rules/2025/taxComputation'
import { DC_STANDARD_DEDUCTION, DC_TAX_BRACKETS } from '../../../src/rules/2025/dc/constants'
import { makeW2 } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function makeDCReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Test',
      lastName: 'User',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
      address: { street: '1 Main', city: 'Washington', state: 'DC', zip: '20001' },
    },
    w2s: [makeW2({ id: 'w1', employerName: 'DC Corp', box1: cents(100000), box2: cents(10000), box15State: 'DC', box17StateIncomeTax: cents(3000) })],
    ...overrides,
  }
}

function computeD40(overrides: Partial<TaxReturn> = {}, config?: StateReturnConfig) {
  const tr = makeDCReturn(overrides)
  const cfg = config ?? { stateCode: 'DC', residencyType: 'full-year' }
  const fed = computeForm1040(tr)
  return computeFormD40(tr, fed, cfg)
}

// ── Standard deduction by filing status ─────────────────────────

describe('DC standard deduction — all filing statuses', () => {
  const cases: [FilingStatus, number][] = [
    ['single', cents(14600)],
    ['mfj', cents(29200)],
    ['mfs', cents(14600)],
    ['hoh', cents(21900)],
    ['qw', cents(29200)],
  ]

  for (const [status, expected] of cases) {
    it(`${status}: standard deduction = $${expected / 100}`, () => {
      const result = computeD40({ filingStatus: status })
      expect(result.dcStandardDeduction).toBe(expected)
    })
  }

  it('QW matches MFJ standard deduction', () => {
    expect(DC_STANDARD_DEDUCTION.qw).toBe(DC_STANDARD_DEDUCTION.mfj)
  })

  it('MFS matches single standard deduction', () => {
    expect(DC_STANDARD_DEDUCTION.mfs).toBe(DC_STANDARD_DEDUCTION.single)
  })

  it('HOH deduction is between single and MFJ', () => {
    expect(DC_STANDARD_DEDUCTION.hoh).toBeGreaterThan(DC_STANDARD_DEDUCTION.single)
    expect(DC_STANDARD_DEDUCTION.hoh).toBeLessThan(DC_STANDARD_DEDUCTION.mfj)
  })
})

// ── Tax computation by filing status ────────────────────────────

describe('DC tax — filing status impact on deductions', () => {
  it('MFJ pays less tax than single on same income (larger deduction)', () => {
    const singleResult = computeD40({ filingStatus: 'single' })
    const mfjResult = computeD40({ filingStatus: 'mfj' })
    // Same $100K income, but MFJ has $29,200 deduction vs $14,600
    expect(mfjResult.dcTax).toBeLessThan(singleResult.dcTax)
  })

  it('HOH pays less tax than single on same income', () => {
    const singleResult = computeD40({ filingStatus: 'single' })
    const hohResult = computeD40({ filingStatus: 'hoh' })
    expect(hohResult.dcTax).toBeLessThan(singleResult.dcTax)
  })

  it('QW and MFJ produce identical tax', () => {
    const mfjResult = computeD40({ filingStatus: 'mfj' })
    const qwResult = computeD40({ filingStatus: 'qw' })
    expect(qwResult.dcTax).toBe(mfjResult.dcTax)
  })

  it('MFS and single produce identical tax', () => {
    const singleResult = computeD40({ filingStatus: 'single' })
    const mfsResult = computeD40({ filingStatus: 'mfs' })
    expect(mfsResult.dcTax).toBe(singleResult.dcTax)
  })
})

// ── Bracket boundary tests ──────────────────────────────────────

describe('DC bracket boundaries', () => {
  function taxFor(taxableCents: number) {
    return computeBracketTax(taxableCents, DC_TAX_BRACKETS.single)
  }

  it('$10,000 exactly → first bracket only (4%)', () => {
    expect(taxFor(cents(10000))).toBe(cents(400))
  })

  it('$40,000 exactly → fills first two brackets', () => {
    // $10K × 4% + $30K × 6% = $400 + $1,800 = $2,200
    expect(taxFor(cents(40000))).toBe(cents(2200))
  })

  it('$60,000 → fills three brackets', () => {
    // $10K × 4% + $30K × 6% + $20K × 6.5% = $400 + $1,800 + $1,300 = $3,500
    expect(taxFor(cents(60000))).toBe(cents(3500))
  })

  it('$250,000 → fills four brackets', () => {
    // $10K×4% + $30K×6% + $20K×6.5% + $190K×8.5% = 400+1800+1300+16150 = 19650
    expect(taxFor(cents(250000))).toBe(cents(19650))
  })

  it('$1 → 4% rate', () => {
    expect(taxFor(cents(1))).toBe(Math.round(100 * 0.04))
  })

  it('zero income → zero tax', () => {
    expect(taxFor(0)).toBe(0)
  })

  it('all brackets produce same results across filing statuses (flat brackets)', () => {
    const amount = cents(300000)
    const singleTax = computeBracketTax(amount, DC_TAX_BRACKETS.single)
    const mfjTax = computeBracketTax(amount, DC_TAX_BRACKETS.mfj)
    const hohTax = computeBracketTax(amount, DC_TAX_BRACKETS.hoh)
    // DC uses flat brackets for all statuses
    expect(singleTax).toBe(mfjTax)
    expect(singleTax).toBe(hohTax)
  })
})

// ── Itemized vs standard deduction selection ────────────────────

describe('DC deduction method selection', () => {
  it('uses standard deduction by default', () => {
    const result = computeD40()
    expect(result.deductionMethod).toBe('standard')
    expect(result.deductionUsed).toBe(DC_STANDARD_DEDUCTION.single)
  })

  it('uses itemized when federal itemized exceeds standard', () => {
    const result = computeD40({
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: cents(5000),
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
    // Federal Schedule A total > $14,600 standard
    expect(result.deductionMethod).toBe('itemized')
    expect(result.deductionUsed).toBeGreaterThan(DC_STANDARD_DEDUCTION.single)
  })

  it('uses standard when itemized is lower', () => {
    const result = computeD40({
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: cents(2000),
          stateLocalSalesTaxes: 0,
          realEstateTaxes: 0,
          personalPropertyTaxes: 0,
          mortgageInterest: cents(3000),
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: 0,
          priorYearInvestmentInterestCarryforward: 0,
          charitableCash: cents(1000),
          charitableNoncash: 0,
          gamblingLosses: 0,
          casualtyTheftLosses: 0,
          federalEstateTaxIRD: 0,
          otherMiscDeductions: 0,
        },
      },
    })
    // $6,000 itemized < $14,600 standard
    expect(result.deductionMethod).toBe('standard')
  })
})

// ── Part-year apportionment ─────────────────────────────────────

describe('DC apportionment ratio', () => {
  it('full-year → ratio = 1', () => {
    expect(computeApportionmentRatio({ stateCode: 'DC', residencyType: 'full-year' }, 2025)).toBe(1)
  })

  it('nonresident → ratio = 0', () => {
    expect(computeApportionmentRatio({ stateCode: 'DC', residencyType: 'nonresident' }, 2025)).toBe(0)
  })

  it('half-year (Jan 1 – Jun 30) → ~0.4959', () => {
    const ratio = computeApportionmentRatio({
      stateCode: 'DC', residencyType: 'part-year',
      moveInDate: '2025-01-01', moveOutDate: '2025-06-30',
    }, 2025)
    expect(ratio).toBeGreaterThan(0.49)
    expect(ratio).toBeLessThan(0.51)
  })

  it('single day (Jan 1) → 1/365', () => {
    const ratio = computeApportionmentRatio({
      stateCode: 'DC', residencyType: 'part-year',
      moveInDate: '2025-01-01', moveOutDate: '2025-01-01',
    }, 2025)
    expect(ratio).toBeCloseTo(1 / 365, 4)
  })

  it('full year dates → ratio = 1', () => {
    const ratio = computeApportionmentRatio({
      stateCode: 'DC', residencyType: 'part-year',
      moveInDate: '2025-01-01', moveOutDate: '2025-12-31',
    }, 2025)
    expect(ratio).toBe(1)
  })

  it('reversed dates → ratio = 0', () => {
    const ratio = computeApportionmentRatio({
      stateCode: 'DC', residencyType: 'part-year',
      moveInDate: '2025-12-31', moveOutDate: '2025-01-01',
    }, 2025)
    expect(ratio).toBe(0)
  })

  it('leap year 2024 → 366 days', () => {
    const ratio = computeApportionmentRatio({
      stateCode: 'DC', residencyType: 'part-year',
      moveInDate: '2024-01-01', moveOutDate: '2024-12-31',
    }, 2024)
    expect(ratio).toBe(1)
  })
})

describe('DC part-year return computation', () => {
  it('part-year income is apportioned', () => {
    const result = computeD40({}, {
      stateCode: 'DC', residencyType: 'part-year',
      moveInDate: '2025-01-01', moveOutDate: '2025-06-30',
    })
    expect(result.dcAGI).toBeLessThan(result.federalAGI)
    expect(result.apportionmentRatio).toBeLessThan(1)
    expect(result.dcSourceIncome).toBeDefined()
  })

  it('part-year tax is less than full-year', () => {
    const full = computeD40()
    const part = computeD40({}, {
      stateCode: 'DC', residencyType: 'part-year',
      moveInDate: '2025-07-01', moveOutDate: '2025-12-31',
    })
    expect(part.dcTax).toBeLessThan(full.dcTax)
  })
})

// ── Commuter exemption ──────────────────────────────────────────

describe('DC commuter exemption', () => {
  it('MD resident nonresident → exempt, zero tax, full refund', () => {
    const result = computeD40(
      { taxpayer: { firstName: 'A', lastName: 'B', ssn: '111', dateOfBirth: '1990-01-01', address: { street: '1', city: 'Bethesda', state: 'MD', zip: '20814' } } },
      { stateCode: 'DC', residencyType: 'nonresident', dcCommuterResidentState: 'MD' },
    )
    expect(result.commuterExempt).toBe(true)
    expect(result.dcTax).toBe(0)
    expect(result.overpaid).toBe(cents(3000))
  })

  it('VA resident nonresident → exempt', () => {
    const result = computeD40(
      { taxpayer: { firstName: 'A', lastName: 'B', ssn: '111', dateOfBirth: '1990-01-01', address: { street: '1', city: 'Arlington', state: 'VA', zip: '22201' } } },
      { stateCode: 'DC', residencyType: 'nonresident', dcCommuterResidentState: 'VA' },
    )
    expect(result.commuterExempt).toBe(true)
    expect(result.dcTax).toBe(0)
  })

  it('non-exempt state nonresident → taxed normally', () => {
    const result = computeD40(
      { taxpayer: { firstName: 'A', lastName: 'B', ssn: '111', dateOfBirth: '1990-01-01', address: { street: '1', city: 'NYC', state: 'NY', zip: '10001' } } },
      { stateCode: 'DC', residencyType: 'nonresident' },
    )
    expect(result.commuterExempt).toBe(false)
    // Nonresident with no apportionment → 0 ratio → $0 income
    expect(result.dcAGI).toBe(0)
  })

  it('full-year resident → never exempt', () => {
    const result = computeD40(
      { taxpayer: { firstName: 'A', lastName: 'B', ssn: '111', dateOfBirth: '1990-01-01', address: { street: '1', city: 'Bethesda', state: 'MD', zip: '20814' } } },
      { stateCode: 'DC', residencyType: 'full-year' },
    )
    expect(result.commuterExempt).toBe(false)
    expect(result.dcTax).toBeGreaterThan(0)
  })

  it('auto-detects MD commuter from address when dcCommuterResidentState not set', () => {
    const result = computeD40(
      { taxpayer: { firstName: 'A', lastName: 'B', ssn: '111', dateOfBirth: '1990-01-01', address: { street: '1', city: 'Bethesda', state: 'MD', zip: '20814' } } },
      { stateCode: 'DC', residencyType: 'nonresident' },
    )
    expect(result.commuterExempt).toBe(true)
  })
})

// ── Refund / amount owed ────────────────────────────────────────

describe('DC refund/owed', () => {
  it('withholding > tax → refund', () => {
    const result = computeD40({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(30000), box2: cents(2000), box15State: 'DC', box17StateIncomeTax: cents(5000) })],
    })
    expect(result.overpaid).toBeGreaterThan(0)
    expect(result.amountOwed).toBe(0)
  })

  it('withholding < tax → amount owed', () => {
    const result = computeD40({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(200000), box2: cents(30000), box15State: 'DC', box17StateIncomeTax: cents(1000) })],
    })
    expect(result.amountOwed).toBeGreaterThan(0)
    expect(result.overpaid).toBe(0)
  })

  it('only DC withholding counted', () => {
    const result = computeD40({
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(60000), box2: cents(6000), box15State: 'DC', box17StateIncomeTax: cents(2000) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(40000), box2: cents(4000), box15State: 'VA', box17StateIncomeTax: cents(1500) }),
      ],
    })
    expect(result.stateWithholding).toBe(cents(2000))
  })
})

// ── Edge cases ──────────────────────────────────────────────────

describe('DC edge cases', () => {
  it('zero income → zero tax', () => {
    const result = computeD40({ w2s: [] })
    expect(result.dcAGI).toBe(0)
    expect(result.dcTaxableIncome).toBe(0)
    expect(result.dcTax).toBe(0)
  })

  it('income less than standard deduction → taxable = 0', () => {
    const result = computeD40({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(10000), box2: cents(500), box15State: 'DC', box17StateIncomeTax: cents(200) })],
    })
    expect(result.dcTaxableIncome).toBe(0)
    expect(result.dcTax).toBe(0)
    expect(result.overpaid).toBe(cents(200))
  })

  it('high earner $1M → top bracket (8.95%)', () => {
    const result = computeD40({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(1000000), box2: cents(200000), box15State: 'DC', box17StateIncomeTax: cents(50000) })],
    })
    // Taxable = $1M - $14.6K = $985,400 → well into 8.95% bracket
    expect(result.dcTax).toBeGreaterThan(cents(70000))
  })
})
