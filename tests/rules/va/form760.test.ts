import { describe, it, expect } from 'vitest'
import { computeAll } from '../../../src/rules/engine'
import { emptyTaxReturn } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { makeW2 } from '../../fixtures/returns'

describe('VA Form 760 compute', () => {
  it('computes full-year VA return with withholding', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'VA' as const, residencyType: 'full-year' as const }],
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Test Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'VA',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(5000),
      })],
    }

    const result = computeAll(tr)
    const va = result.stateResults[0]
    expect(va.stateCode).toBe('VA')
    expect(va.formLabel).toBe('VA Form 760')
    expect(va.stateAGI).toBeGreaterThan(0)
    expect(va.stateTaxableIncome).toBeGreaterThan(0)
    expect(va.stateWithholding).toBe(cents(5000))
  })

  it('uses VA Form 760PY label for part-year', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{
        stateCode: 'VA' as const,
        residencyType: 'part-year' as const,
        moveInDate: '2025-01-01',
        moveOutDate: '2025-06-30',
      }],
      w2s: [makeW2({
        id: 'w2-1',
        employerName: 'Test Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'VA',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(5000),
      })],
    }

    const result = computeAll(tr)
    const va = result.stateResults[0]
    expect(va.formLabel).toBe('VA Form 760PY')
    expect(va.apportionmentRatio).toBeGreaterThan(0)
    expect(va.apportionmentRatio).toBeLessThan(1)
  })
})
