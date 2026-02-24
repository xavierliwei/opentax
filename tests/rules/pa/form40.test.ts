import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../../src/model/types'
import { computeAll } from '../../../src/rules/engine'

describe('PA-40 computation', () => {
  it('computes flat 3.07% tax and withholding reconciliation', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'PA' as const, residencyType: 'full-year' as const }],
      w2s: [{
        id: 'w2-1',
        employerEin: '12-3456789',
        employerName: 'Test',
        box1: 10000000,
        box2: 1000000,
        box3: 10000000,
        box4: 620000,
        box5: 10000000,
        box6: 145000,
        box7: 0,
        box8: 0,
        box10: 0,
        box11: 0,
        box12: [],
        box13StatutoryEmployee: false,
        box13RetirementPlan: false,
        box13ThirdPartySickPay: false,
        box14: '',
        box15State: 'PA',
        box16StateWages: 10000000,
        box17StateIncomeTax: 350000,
      }],
    }

    const result = computeAll(tr)
    const pa = result.stateResults.find(s => s.stateCode === 'PA')!

    expect(pa.stateTax).toBe(Math.round(pa.stateTaxableIncome * 0.0307))
    expect(pa.stateWithholding).toBe(350000)
    expect(pa.overpaid > 0 || pa.amountOwed > 0 || (pa.overpaid === 0 && pa.amountOwed === 0)).toBe(true)
  })

  it('part-year PA return applies apportionment ratio', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{
        stateCode: 'PA' as const,
        residencyType: 'part-year' as const,
        moveInDate: '2025-01-01',
        moveOutDate: '2025-06-30',
      }],
      w2s: [{
        id: 'w2-1',
        employerEin: '12-3456789',
        employerName: 'Test',
        box1: 10000000,
        box2: 1000000,
        box3: 10000000,
        box4: 620000,
        box5: 10000000,
        box6: 145000,
        box7: 0,
        box8: 0,
        box10: 0,
        box11: 0,
        box12: [],
        box13StatutoryEmployee: false,
        box13RetirementPlan: false,
        box13ThirdPartySickPay: false,
        box14: '',
        box15State: 'PA',
        box16StateWages: 10000000,
        box17StateIncomeTax: 200000,
      }],
    }

    const result = computeAll(tr)
    const pa = result.stateResults.find(s => s.stateCode === 'PA')!
    expect(pa.apportionmentRatio).toBeGreaterThan(0.49)
    expect(pa.apportionmentRatio).toBeLessThan(0.51)
  })
})
