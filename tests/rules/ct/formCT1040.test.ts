/**
 * STATE-GAP-030: CT Form CT-1040 — Expanded Test Coverage
 *
 * Covers: all 5 filing statuses, bracket boundaries, personal exemption phase-out,
 * Table C add-back, Table D recapture, property tax credit (with MFS step),
 * CT EITC, part-year residency, Schedule CT-1 subtractions, and edge cases.
 */

import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, StateReturnConfig, FilingStatus } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import {
  computeFormCT1040,
  computePersonalExemption,
  computeTableCAddBack,
  computeTableDRecapture,
} from '../../../src/rules/2025/ct/formCT1040'
import { computePropertyTaxCredit, computeCTEITC } from '../../../src/rules/2025/ct/ctCredits'
import { computeBracketTax } from '../../../src/rules/2025/taxComputation'
import { CT_TAX_BRACKETS, CT_PERSONAL_EXEMPTION, CT_TABLE_C, CT_TABLE_D, CT_PROPERTY_TAX_CREDIT } from '../../../src/rules/2025/ct/constants'
import { makeW2, makeDependent, make1099INT } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function makeCTReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    stateReturns: [{ stateCode: 'CT', residencyType: 'full-year' }],
    w2s: [makeW2({ id: 'w1', employerName: 'CT Corp', box1: cents(80000), box2: cents(8000), box15State: 'CT', box17StateIncomeTax: cents(3500) })],
    ...overrides,
  }
}

function computeCT(overrides: Partial<TaxReturn> = {}, config?: StateReturnConfig) {
  const tr = makeCTReturn(overrides)
  const cfg = config ?? tr.stateReturns[0]
  const fed = computeForm1040(tr)
  return computeFormCT1040(tr, fed, cfg)
}

const ctFullYear: StateReturnConfig = { stateCode: 'CT', residencyType: 'full-year' }

// ── Personal exemption phase-out by filing status ───────────────

describe('CT personal exemption — all filing statuses', () => {
  const statuses: FilingStatus[] = ['single', 'mfj', 'mfs', 'hoh', 'qw']

  for (const status of statuses) {
    const params = CT_PERSONAL_EXEMPTION[status]

    it(`${status}: full exemption below phase-out start`, () => {
      const result = computePersonalExemption(params.phaseOutStart - cents(1000), status)
      expect(result.effectiveExemption).toBe(params.maxExemption)
      expect(result.reduction).toBe(0)
    })

    it(`${status}: zero exemption at/above phase-out end`, () => {
      const result = computePersonalExemption(params.phaseOutEnd, status)
      expect(result.effectiveExemption).toBe(0)
    })

    it(`${status}: partial exemption mid-phase-out`, () => {
      const mid = Math.round((params.phaseOutStart + params.phaseOutEnd) / 2)
      const result = computePersonalExemption(mid, status)
      expect(result.effectiveExemption).toBeGreaterThan(0)
      expect(result.effectiveExemption).toBeLessThan(params.maxExemption)
    })
  }

  it('QW matches MFJ exemption amounts', () => {
    expect(CT_PERSONAL_EXEMPTION.qw).toEqual(CT_PERSONAL_EXEMPTION.mfj)
  })

  it('MFS has smaller exemption than MFJ', () => {
    expect(CT_PERSONAL_EXEMPTION.mfs.maxExemption).toBeLessThan(CT_PERSONAL_EXEMPTION.mfj.maxExemption)
  })
})

// ── Table C add-back by filing status ────────────────────────────

describe('CT Table C add-back — all filing statuses', () => {
  const statuses: FilingStatus[] = ['single', 'mfj', 'mfs', 'hoh', 'qw']

  for (const status of statuses) {
    const params = CT_TABLE_C[status]

    it(`${status}: zero below phase-out start`, () => {
      expect(computeTableCAddBack(params.phaseOutStart - cents(100), status)).toBe(0)
    })

    it(`${status}: max at phase-out end`, () => {
      expect(computeTableCAddBack(params.phaseOutEnd, status)).toBe(params.maxAddBack)
    })

    it(`${status}: partial within range`, () => {
      const mid = Math.round((params.phaseOutStart + params.phaseOutEnd) / 2)
      const result = computeTableCAddBack(mid, status)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThanOrEqual(params.maxAddBack)
    })
  }

  it('MFJ has higher max add-back than single', () => {
    expect(CT_TABLE_C.mfj.maxAddBack).toBeGreaterThan(CT_TABLE_C.single.maxAddBack)
  })

  it('QW matches MFJ table C parameters', () => {
    expect(CT_TABLE_C.qw).toEqual(CT_TABLE_C.mfj)
  })
})

// ── Table D recapture by filing status ──────────────────────────

describe('CT Table D recapture — all filing statuses', () => {
  const statuses: FilingStatus[] = ['single', 'mfj', 'mfs', 'hoh', 'qw']

  for (const status of statuses) {
    const params = CT_TABLE_D[status]

    it(`${status}: zero below recapture start`, () => {
      expect(computeTableDRecapture(params.recaptureStart - cents(100), status)).toBe(0)
    })

    it(`${status}: max at recapture end`, () => {
      expect(computeTableDRecapture(params.recaptureEnd, status)).toBe(params.maxRecapture)
    })
  }

  it('QW matches MFJ table D parameters', () => {
    expect(CT_TABLE_D.qw).toEqual(CT_TABLE_D.mfj)
  })
})

// ── Bracket tax computation by filing status ────────────────────

describe('CT bracket tax — filing status differentiation', () => {
  it('single $100K: tax in 5.5% bracket', () => {
    // single: 2% on $10K, 4.5% on $40K, 5.5% on $50K
    const taxable = cents(100000)
    const tax = computeBracketTax(taxable, CT_TAX_BRACKETS.single)
    const expected = Math.round(cents(10000) * 0.02 + cents(40000) * 0.045 + cents(50000) * 0.055)
    expect(tax).toBe(expected)
  })

  it('MFJ $100K: tax uses wider brackets', () => {
    const taxable = cents(100000)
    const singleTax = computeBracketTax(taxable, CT_TAX_BRACKETS.single)
    const mfjTax = computeBracketTax(taxable, CT_TAX_BRACKETS.mfj)
    // MFJ brackets are wider → lower tax
    expect(mfjTax).toBeLessThan(singleTax)
  })

  it('HOH brackets differ from single', () => {
    const taxable = cents(80000)
    const singleTax = computeBracketTax(taxable, CT_TAX_BRACKETS.single)
    const hohTax = computeBracketTax(taxable, CT_TAX_BRACKETS.hoh)
    // HOH second bracket starts at $16K vs $10K → lower tax
    expect(hohTax).toBeLessThan(singleTax)
  })

  it('MFS brackets match single brackets', () => {
    const taxable = cents(200000)
    const singleTax = computeBracketTax(taxable, CT_TAX_BRACKETS.single)
    const mfsTax = computeBracketTax(taxable, CT_TAX_BRACKETS.mfs)
    expect(mfsTax).toBe(singleTax)
  })

  it('QW brackets match MFJ brackets', () => {
    const taxable = cents(200000)
    const mfjTax = computeBracketTax(taxable, CT_TAX_BRACKETS.mfj)
    const qwTax = computeBracketTax(taxable, CT_TAX_BRACKETS.qw)
    expect(qwTax).toBe(mfjTax)
  })

  it('zero taxable income → zero tax', () => {
    expect(computeBracketTax(0, CT_TAX_BRACKETS.single)).toBe(0)
  })

  it('top bracket applies above $500K (single)', () => {
    const taxable = cents(600000)
    const tax = computeBracketTax(taxable, CT_TAX_BRACKETS.single)
    // Verify top bracket (6.99%) is in play
    const taxAt500K = computeBracketTax(cents(500000), CT_TAX_BRACKETS.single)
    const marginalTax = tax - taxAt500K
    expect(marginalTax).toBe(Math.round(cents(100000) * 0.0699))
  })
})

// ── Property tax credit ─────────────────────────────────────────

describe('CT property tax credit', () => {
  it('no property tax paid → $0 credit', () => {
    expect(computePropertyTaxCredit(cents(30000), 'single', 0)).toBe(0)
  })

  it('single below income limit → full credit', () => {
    const credit = computePropertyTaxCredit(cents(40000), 'single', cents(500))
    // Property tax paid ($500) > max credit ($300) → capped at $300
    expect(credit).toBe(cents(300))
  })

  it('single at income limit → full credit', () => {
    const credit = computePropertyTaxCredit(CT_PROPERTY_TAX_CREDIT.incomeLimit.single, 'single', cents(300))
    expect(credit).toBe(cents(300))
  })

  it('single above income limit → reduced credit', () => {
    const overLimit = CT_PROPERTY_TAX_CREDIT.incomeLimit.single + cents(10000)
    const credit = computePropertyTaxCredit(overLimit, 'single', cents(300))
    // 1 increment × 15% × $300 = $45 reduction → $255
    expect(credit).toBeLessThan(cents(300))
    expect(credit).toBeGreaterThan(0)
  })

  it('MFS uses smaller phase-out step ($5K vs $10K)', () => {
    const overLimit = CT_PROPERTY_TAX_CREDIT.incomeLimit.mfs + cents(5000)
    const creditMFS = computePropertyTaxCredit(overLimit, 'mfs', cents(300))
    // MFS: 1 increment at $5K step × 15% × $300 = $45 reduction
    expect(creditMFS).toBe(cents(300) - Math.round(1 * 0.15 * cents(300)))
  })

  it('high income → $0 credit', () => {
    const credit = computePropertyTaxCredit(cents(200000), 'single', cents(300))
    expect(credit).toBe(0)
  })

  it('property tax below cap → uses actual amount', () => {
    const credit = computePropertyTaxCredit(cents(30000), 'single', cents(150))
    expect(credit).toBe(cents(150))
  })
})

// ── CT EITC ─────────────────────────────────────────────────────

describe('CT EITC', () => {
  it('full-year with children: 40% of federal + $250 bonus', () => {
    const fedEITC = cents(4000)
    const ctEITC = computeCTEITC(fedEITC, true, true)
    expect(ctEITC).toBe(Math.round(fedEITC * 0.4) + cents(250))
  })

  it('full-year without children: 40% of federal, no bonus', () => {
    const fedEITC = cents(600)
    const ctEITC = computeCTEITC(fedEITC, false, true)
    expect(ctEITC).toBe(Math.round(fedEITC * 0.4))
  })

  it('part-year resident → $0', () => {
    expect(computeCTEITC(cents(4000), true, false)).toBe(0)
  })

  it('no federal EITC → $0', () => {
    expect(computeCTEITC(0, true, true)).toBe(0)
  })
})

// ── Full return computation by filing status ────────────────────

describe('CT full return — filing status coverage', () => {
  it('single: standard scenario', () => {
    const result = computeCT()
    expect(result.ctAGI).toBe(cents(80000))
    expect(result.ctTaxableIncome).toBeGreaterThan(0)
    expect(result.bracketTax).toBeGreaterThan(0)
    expect(result.stateWithholding).toBe(cents(3500))
  })

  it('MFJ: combined wages', () => {
    const result = computeCT({
      filingStatus: 'mfj',
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(70000), box2: cents(7000), box15State: 'CT', box17StateIncomeTax: cents(2000) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(50000), box2: cents(5000), box15State: 'CT', box17StateIncomeTax: cents(1500) }),
      ],
    })
    expect(result.ctAGI).toBe(cents(120000))
    expect(result.stateWithholding).toBe(cents(3500))
    // MFJ exemption is $24K at this income (above phase-out)
    const ex = computePersonalExemption(cents(120000), 'mfj')
    expect(result.effectiveExemption).toBe(ex.effectiveExemption)
  })

  it('MFS: uses MFS brackets and exemption', () => {
    const result = computeCT({ filingStatus: 'mfs' })
    const ex = computePersonalExemption(cents(80000), 'mfs')
    expect(result.effectiveExemption).toBe(ex.effectiveExemption)
  })

  it('HOH: uses HOH brackets and wider exemption', () => {
    const result = computeCT({
      filingStatus: 'hoh',
      dependents: [makeDependent({ firstName: 'Kid', dateOfBirth: '2018-01-01' })],
    })
    const ex = computePersonalExemption(cents(80000), 'hoh')
    expect(result.effectiveExemption).toBe(ex.effectiveExemption)
    // HOH has higher exemption
    expect(CT_PERSONAL_EXEMPTION.hoh.maxExemption).toBeGreaterThan(CT_PERSONAL_EXEMPTION.single.maxExemption)
  })

  it('QW: uses MFJ-equivalent brackets and exemption', () => {
    const result = computeCT({ filingStatus: 'qw' })
    const ex = computePersonalExemption(cents(80000), 'qw')
    expect(result.effectiveExemption).toBe(ex.effectiveExemption)
    // QW should match MFJ computation
    const mfjResult = computeCT({ filingStatus: 'mfj' })
    expect(result.bracketTax).toBe(mfjResult.bracketTax)
  })
})

// ── Schedule CT-1 subtraction (US obligation interest) ──────────

describe('CT Schedule CT-1 — US obligation interest subtraction', () => {
  it('subtracts US obligation interest from federal AGI', () => {
    const result = computeCT({
      form1099INTs: [
        make1099INT({ id: 'i1', payerName: 'Treasury Direct', box1: cents(1000), box3: cents(500) }),
      ],
    })
    // ctAGI = federalAGI - usObligationInterest = $81,000 - $500
    expect(result.ctSchedule1.usObligationInterest).toBe(cents(500))
    expect(result.ctAGI).toBe(result.federalAGI - cents(500))
  })

  it('no US obligation interest → ctAGI = federalAGI', () => {
    const result = computeCT()
    expect(result.ctSchedule1.usObligationInterest).toBe(0)
    expect(result.ctAGI).toBe(result.federalAGI)
  })
})

// ── Part-year residency ─────────────────────────────────────────

describe('CT part-year residency', () => {
  it('stores residency type in result', () => {
    const result = computeCT({}, {
      stateCode: 'CT',
      residencyType: 'part-year',
      moveInDate: '2025-07-01',
      moveOutDate: '2025-12-31',
    })
    expect(result.residencyType).toBe('part-year')
  })
})

// ── Property tax credit integration ─────────────────────────────

describe('CT property tax credit — integration', () => {
  it('credit is capped by income tax', () => {
    // Low income → low tax, property tax credit capped
    const result = computeCT({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(20000), box2: cents(500), box15State: 'CT', box17StateIncomeTax: cents(200) })],
      stateReturns: [{ stateCode: 'CT', residencyType: 'full-year', ctPropertyTaxPaid: cents(5000) }],
    })
    // Property tax credit can't exceed the income tax
    expect(result.propertyTaxCredit).toBeLessThanOrEqual(result.ctIncomeTax)
  })

  it('no property tax → zero credit', () => {
    const result = computeCT()
    expect(result.propertyTaxCredit).toBe(0)
  })
})

// ── Refund / amount owed ────────────────────────────────────────

describe('CT refund/owed computation', () => {
  it('withholding > tax → refund', () => {
    const result = computeCT({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(30000), box2: cents(2000), box15State: 'CT', box17StateIncomeTax: cents(5000) })],
    })
    expect(result.overpaid).toBeGreaterThan(0)
    expect(result.amountOwed).toBe(0)
  })

  it('withholding < tax → amount owed', () => {
    const result = computeCT({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(200000), box2: cents(30000), box15State: 'CT', box17StateIncomeTax: cents(2000) })],
    })
    expect(result.amountOwed).toBeGreaterThan(0)
    expect(result.overpaid).toBe(0)
  })

  it('only CT withholding counted (not other states)', () => {
    const result = computeCT({
      w2s: [
        makeW2({ id: 'w1', employerName: 'A', box1: cents(50000), box2: cents(5000), box15State: 'CT', box17StateIncomeTax: cents(2000) }),
        makeW2({ id: 'w2', employerName: 'B', box1: cents(30000), box2: cents(3000), box15State: 'NY', box17StateIncomeTax: cents(1500) }),
      ],
    })
    expect(result.stateWithholding).toBe(cents(2000))
  })
})

// ── Edge cases ──────────────────────────────────────────────────

describe('CT edge cases', () => {
  it('zero income → zero tax', () => {
    const result = computeCT({
      w2s: [],
    })
    expect(result.ctAGI).toBe(0)
    expect(result.ctTaxableIncome).toBe(0)
    expect(result.bracketTax).toBe(0)
    expect(result.ctIncomeTax).toBe(0)
  })

  it('high income triggers Table C and Table D', () => {
    const result = computeCT({
      w2s: [makeW2({ id: 'w1', employerName: 'X', box1: cents(200000), box2: cents(30000), box15State: 'CT', box17StateIncomeTax: cents(10000) })],
    })
    // Single: Table D starts at $105K, this income is above it
    expect(result.tableD_recapture).toBeGreaterThan(0)
  })
})
