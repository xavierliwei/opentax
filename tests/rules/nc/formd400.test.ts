import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeFormD400, computeNCApportionmentRatio } from '../../../src/rules/2025/nc/formd400'
import { cents } from '../../../src/model/traced'
import { makeW2 } from '../../fixtures/returns'

describe('NC Form D-400', () => {
  it('computes full-year NC tax and withholding', () => {
    const tr = emptyTaxReturn(2025)
    tr.w2s = [
      makeW2({
        id: 'w2-1',
        employerName: 'NC Co',
        box1: cents(100000),
        box2: cents(12000),
        box15State: 'NC',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(4000),
      }),
    ]

    const federal = computeForm1040(tr)
    const result = computeFormD400(tr, federal, { stateCode: 'NC', residencyType: 'full-year' })

    expect(result.ncAGI).toBe(federal.line11.amount)
    expect(result.ncTaxableIncome).toBeGreaterThan(0)
    expect(result.ncTax).toBeGreaterThan(0)
    expect(result.stateWithholding).toBe(cents(4000))
  })

  it('part-year residency prorates tax', () => {
    const tr = emptyTaxReturn(2025)
    tr.w2s = [
      makeW2({
        id: 'w2-1', employerName: 'NC Co', box1: cents(80000), box2: cents(8000), box15State: 'NC', box17StateIncomeTax: cents(2000),
      }),
    ]
    const federal = computeForm1040(tr)

    const fullYear = computeFormD400(tr, federal, { stateCode: 'NC', residencyType: 'full-year' })
    const partYear = computeFormD400(tr, federal, {
      stateCode: 'NC', residencyType: 'part-year', moveInDate: '2025-01-01', moveOutDate: '2025-06-30',
    })

    expect(partYear.apportionmentRatio).toBeLessThan(1)
    expect(partYear.ncTax).toBeLessThan(fullYear.ncTax)
  })

  it('apportionment ratio handles leap years and invalid ranges', () => {
    expect(computeNCApportionmentRatio({ stateCode: 'NC', residencyType: 'full-year' }, 2025)).toBe(1)
    expect(computeNCApportionmentRatio({ stateCode: 'NC', residencyType: 'nonresident' }, 2025)).toBe(0)
    expect(computeNCApportionmentRatio({
      stateCode: 'NC', residencyType: 'part-year', moveInDate: '2025-12-31', moveOutDate: '2025-01-01',
    }, 2025)).toBe(0)
  })
})
