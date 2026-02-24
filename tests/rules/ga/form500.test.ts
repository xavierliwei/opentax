import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeForm500 } from '../../../src/rules/2025/ga/form500'
import { cents } from '../../../src/model/traced'
import { makeW2 } from '../../fixtures/returns'

function makeGAReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    stateReturns: [{ stateCode: 'GA', residencyType: 'full-year' }],
    w2s: [makeW2({ box1: cents(100000), box2: cents(15000), box15State: 'GA', box17StateIncomeTax: cents(5000) })],
    ...overrides,
  }
}

describe('computeForm500', () => {
  it('computes flat tax at 5.19%', () => {
    const tr = makeGAReturn()
    const f1040 = computeForm1040(tr)
    const ga = computeForm500(tr, f1040, tr.stateReturns[0])

    // 100000 - 12000 = 88000 taxable (single standard)
    expect(ga.gaTaxableIncome).toBe(cents(88000))
    expect(ga.gaTax).toBe(cents(4567.2))
  })

  it('uses MFJ standard deduction', () => {
    const tr = makeGAReturn({
      filingStatus: 'mfj',
      w2s: [
        makeW2({ box1: cents(120000), box2: cents(18000), box15State: 'GA', box17StateIncomeTax: cents(6000) }),
      ],
    })
    const f1040 = computeForm1040(tr)
    const ga = computeForm500(tr, f1040, tr.stateReturns[0])

    expect(ga.gaTaxableIncome).toBe(cents(96000))
  })

  it('applies dependent exemption', () => {
    const tr = makeGAReturn({
      dependents: [{
        firstName: 'Kid',
        lastName: 'One',
        ssn: '123456789',
        relationship: 'son',
        monthsLived: 12,
        dateOfBirth: '2020-01-01',
      }],
    })
    const f1040 = computeForm1040(tr)
    const ga = computeForm500(tr, f1040, tr.stateReturns[0])

    expect(ga.dependentExemption).toBe(cents(3000))
    expect(ga.gaTaxableIncome).toBe(cents(85000))
  })

  it('computes low-income credit under threshold', () => {
    const tr = makeGAReturn({
      w2s: [makeW2({ box1: cents(18000), box2: cents(1000), box15State: 'GA', box17StateIncomeTax: cents(400) })],
    })
    const f1040 = computeForm1040(tr)
    const ga = computeForm500(tr, f1040, tr.stateReturns[0])

    expect(ga.lowIncomeCredit).toBe(cents(26))
  })

  it('sums only GA state withholding from W-2s', () => {
    const tr = makeGAReturn({
      w2s: [
        makeW2({ box1: cents(50000), box15State: 'GA', box17StateIncomeTax: cents(2200) }),
        makeW2({ box1: cents(50000), box15State: 'CA', box17StateIncomeTax: cents(1800) }),
      ],
    })
    const f1040 = computeForm1040(tr)
    const ga = computeForm500(tr, f1040, tr.stateReturns[0])

    expect(ga.stateWithholding).toBe(cents(2200))
  })

  it('apportions tax for part-year resident', () => {
    const tr = makeGAReturn({
      stateReturns: [{ stateCode: 'GA', residencyType: 'part-year', moveInDate: '2025-07-01', moveOutDate: '2025-12-31' }],
    })
    const f1040 = computeForm1040(tr)
    const ga = computeForm500(tr, f1040, tr.stateReturns[0])

    expect(ga.apportionmentRatio).toBeGreaterThan(0.49)
    expect(ga.apportionmentRatio).toBeLessThan(0.51)
    expect(ga.gaTax).toBeLessThan(cents(4567.2))
  })
})
