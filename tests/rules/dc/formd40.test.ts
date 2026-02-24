import { describe, it, expect } from 'vitest'
import { emptyTaxReturn, type StateReturnConfig, type TaxReturn } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeFormD40 } from '../../../src/rules/2025/dc/formd40'
import { cents } from '../../../src/model/traced'
import { makeW2 } from '../../fixtures/returns'

function baseReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    taxpayer: {
      firstName: 'Test',
      lastName: 'Taxpayer',
      ssn: '123456789',
      dateOfBirth: '1990-01-01',
      address: { street: '1 Main', city: 'Washington', state: 'DC', zip: '20001' },
    },
    w2s: [makeW2({ box1: cents(100000), box2: cents(10000), box15State: 'DC', box17StateIncomeTax: cents(3000) })],
  }
}

describe('computeFormD40', () => {
  it('computes full-year DC return with withholding', () => {
    const tr = baseReturn()
    const f1040 = computeForm1040(tr)
    const cfg: StateReturnConfig = { stateCode: 'DC', residencyType: 'full-year' }
    const d40 = computeFormD40(tr, f1040, cfg)

    expect(d40.dcAGI).toBe(f1040.line11.amount)
    expect(d40.dcTax).toBeGreaterThan(0)
    expect(d40.stateWithholding).toBe(cents(3000))
  })

  it('apportions part-year income by residency ratio', () => {
    const tr = baseReturn()
    const f1040 = computeForm1040(tr)
    const cfg: StateReturnConfig = {
      stateCode: 'DC',
      residencyType: 'part-year',
      moveInDate: '2025-01-01',
      moveOutDate: '2025-06-30',
    }
    const d40 = computeFormD40(tr, f1040, cfg)

    expect(d40.apportionmentRatio).toBeGreaterThan(0.49)
    expect(d40.apportionmentRatio).toBeLessThan(0.51)
    expect(d40.dcAGI).toBeLessThan(f1040.line11.amount)
  })

  it('applies MD/VA commuter exemption for nonresident', () => {
    const tr = baseReturn()
    tr.taxpayer.address.state = 'MD'
    const f1040 = computeForm1040(tr)
    const cfg: StateReturnConfig = { stateCode: 'DC', residencyType: 'nonresident', dcCommuterResidentState: 'MD' }
    const d40 = computeFormD40(tr, f1040, cfg)

    expect(d40.commuterExempt).toBe(true)
    expect(d40.dcTax).toBe(0)
    expect(d40.overpaid).toBe(cents(3000))
  })
})
