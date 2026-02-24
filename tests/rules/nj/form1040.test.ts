import { describe, expect, it } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import { makeW2 } from '../../fixtures/returns'
import { cents } from '../../../src/model/traced'
import { computeAll } from '../../../src/rules/engine'

describe('NJ Form NJ-1040 compute', () => {
  it('computes NJ state result for full-year resident', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'NJ' as const, residencyType: 'full-year' as const }],
      w2s: [makeW2({
        id: 'w2-nj',
        employerName: 'Garden State Inc',
        box1: cents(120000),
        box2: cents(18000),
        box15State: 'NJ',
        box16StateWages: cents(120000),
        box17StateIncomeTax: cents(6500),
      })],
    }

    const result = computeAll(tr)
    const nj = result.stateResults.find((s) => s.stateCode === 'NJ')
    expect(nj).toBeDefined()
    expect(nj!.formLabel).toBe('NJ Form NJ-1040')
    expect(nj!.stateAGI).toBeGreaterThan(0)
    expect(nj!.stateWithholding).toBe(cents(6500))
  })

  it('apportions income for part-year resident with valid dates', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{
        stateCode: 'NJ' as const,
        residencyType: 'part-year' as const,
        moveInDate: '2025-01-01',
        moveOutDate: '2025-06-30',
      }],
      w2s: [makeW2({ id: 'w2-1', employerName: 'Test', box1: cents(100000), box2: cents(12000) })],
    }

    const result = computeAll(tr)
    const nj = result.stateResults.find((s) => s.stateCode === 'NJ')!
    expect(nj.apportionmentRatio).toBeLessThan(1)
    expect(nj.stateAGI).toBeLessThan(result.form1040.line11.amount)
  })
})
