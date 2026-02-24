import { describe, expect, it } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { computeAll } from '../../../src/rules/engine'
import { makeW2 } from '../../fixtures/returns'

describe('FL no-income-tax module', () => {
  it('computes zero tax for full-year Florida resident', () => {
    const tr = emptyTaxReturn(2025)
    tr.taxpayer.firstName = 'Flo'
    tr.taxpayer.lastName = 'Rida'
    tr.taxpayer.ssn = '111223333'
    tr.stateReturns = [{ stateCode: 'FL', residencyType: 'full-year' }]

    const result = computeAll(tr)
    const fl = result.stateResults.find((s) => s.stateCode === 'FL')

    expect(fl).toBeDefined()
    expect(fl!.taxAfterCredits).toBe(0)
    expect(fl!.amountOwed).toBe(0)
    expect(fl!.requiresIncomeTaxFiling).toBe(false)
  })

  it('tracks part-year apportionment ratio', () => {
    const tr = emptyTaxReturn(2025)
    tr.taxpayer.firstName = 'Part'
    tr.taxpayer.lastName = 'Year'
    tr.taxpayer.ssn = '111224444'
    tr.stateReturns = [{
      stateCode: 'FL',
      residencyType: 'part-year',
      moveInDate: '2025-07-01',
      moveOutDate: '2025-12-31',
    }]

    const result = computeAll(tr)
    const fl = result.stateResults.find((s) => s.stateCode === 'FL')

    expect(fl).toBeDefined()
    expect(fl!.apportionmentRatio).toBeCloseTo(184 / 365, 5)
  })

  it('surfaces FL-tagged state withholding as disclosure signal', () => {
    const tr = emptyTaxReturn(2025)
    tr.taxpayer.firstName = 'With'
    tr.taxpayer.lastName = 'Holding'
    tr.taxpayer.ssn = '111225555'
    tr.stateReturns = [{ stateCode: 'FL', residencyType: 'full-year' }]
    tr.w2s = [
      makeW2({
        id: 'w2-1',
        employerName: 'Example Inc',
        box1: cents(50000),
        box2: cents(5000),
        box15State: 'FL',
        box17StateIncomeTax: cents(1000),
      }),
    ]

    const result = computeAll(tr)
    const fl = result.stateResults.find((s) => s.stateCode === 'FL')

    expect(fl).toBeDefined()
    expect(fl!.stateWithholding).toBe(cents(1000))
    expect(fl!.overpaid).toBe(cents(1000))
    expect((fl!.disclosures ?? []).join(' ')).toContain('withholding')
  })
})
