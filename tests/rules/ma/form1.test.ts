import { describe, it, expect } from 'vitest'
import { computeForm1, computeApportionmentRatio } from '../../../src/rules/2025/ma/form1'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { emptyTaxReturn } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { makeW2 } from '../../fixtures/returns'

describe('MA Form 1', () => {
  it('computes full-year MA tax and withholding', () => {
    const tr = emptyTaxReturn(2025)
    tr.stateReturns = [{ stateCode: 'MA', residencyType: 'full-year' }]
    tr.w2s = [makeW2({
      id: 'w2-1', employerName: 'Mass Corp', box1: cents(100000), box2: cents(15000),
      box15State: 'MA', box16StateWages: cents(100000), box17StateIncomeTax: cents(3500),
    })]

    const f1040 = computeForm1040(tr)
    const r = computeForm1(tr, f1040, tr.stateReturns[0])

    expect(r.maAGI).toBe(f1040.line11.amount)
    expect(r.maTaxableIncome).toBeGreaterThan(0)
    expect(r.maIncomeTax).toBe(Math.round(r.maTaxableIncome * 0.05))
    expect(r.stateWithholding).toBe(cents(3500))
  })

  it('computes part-year apportionment ratio', () => {
    const ratio = computeApportionmentRatio({ stateCode: 'MA', residencyType: 'part-year', moveInDate: '2025-01-01', moveOutDate: '2025-06-30' }, 2025)
    expect(ratio).toBeGreaterThan(0.49)
    expect(ratio).toBeLessThan(0.51)
  })
})
