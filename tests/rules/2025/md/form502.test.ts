import { describe, expect, it } from 'vitest'
import { emptyTaxReturn } from '../../../../src/model/types'
import { computeForm1040 } from '../../../../src/rules/2025/form1040'
import { computeApportionmentRatio, computeForm502 } from '../../../../src/rules/2025/md/form502'
import { makeW2 } from '../../../fixtures/returns'

describe('MD Form 502', () => {
  it('computes full-year return with withholding', () => {
    const tr = emptyTaxReturn(2025)
    tr.w2s = [makeW2({
      id: 'w2-1',
      employerName: 'Test Co',
      box1: 10000000,
      box2: 1500000,
      box15State: 'MD',
      box16StateWages: 10000000,
      box17StateIncomeTax: 400000,
    })]

    const f1040 = computeForm1040(tr)
    const md = computeForm502(tr, f1040, { stateCode: 'MD', residencyType: 'full-year' })

    expect(md.mdAGI).toBe(f1040.line11.amount)
    expect(md.apportionmentRatio).toBe(1)
    expect(md.stateWithholding).toBe(400000)
    expect(md.taxAfterCredits).toBeGreaterThan(0)
  })

  it('part-year ratio is computed from dates', () => {
    const ratio = computeApportionmentRatio({
      stateCode: 'MD',
      residencyType: 'part-year',
      moveInDate: '2025-01-01',
      moveOutDate: '2025-06-30',
    }, 2025)

    expect(ratio).toBeGreaterThan(0.49)
    expect(ratio).toBeLessThan(0.51)
  })

  it('nonresident ratio is zero', () => {
    const ratio = computeApportionmentRatio({ stateCode: 'MD', residencyType: 'nonresident' }, 2025)
    expect(ratio).toBe(0)
  })
})
