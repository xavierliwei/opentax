/**
 * STATE-GAP-032: NC Form D-400 — Expanded Test Coverage
 *
 * Covers: all 5 filing statuses (standard deduction differences), flat tax rate
 * verification, part-year apportionment edge cases, nonresident zero computation,
 * high income, zero income, and withholding from multiple employers.
 */

import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, StateReturnConfig, FilingStatus } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeFormD400, computeNCApportionmentRatio } from '../../../src/rules/2025/nc/formd400'
import { NC_FLAT_TAX_RATE, NC_STANDARD_DEDUCTION } from '../../../src/rules/2025/nc/constants'
import { makeW2 } from '../../fixtures/returns'

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

  it('ncAdditions and ncDeductions are zero (no NC adjustments yet)', () => {
    const result = computeD400()
    expect(result.ncAdditions).toBe(0)
    expect(result.ncDeductions).toBe(0)
    expect(result.ncAGI).toBe(result.federalAGI)
  })
})
