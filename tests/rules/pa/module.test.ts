import { describe, it, expect } from 'vitest'
import { getStateModule } from '../../../src/rules/stateRegistry'
import { computeAll } from '../../../src/rules/engine'
import { emptyTaxReturn } from '../../../src/model/types'

describe('PA module review layout', () => {
  it('has expected layout and result lines', () => {
    const pa = getStateModule('PA')!
    expect(pa.reviewLayout.map(s => s.title)).toEqual(['Income', 'Tax & Payments'])
    expect(pa.reviewResultLines).toHaveLength(3)
  })

  it('review layout getters return numeric values', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'PA' as const, residencyType: 'full-year' as const }],
      w2s: [{
        id: 'w2-1', employerEin: '12-3456789', employerName: 'A',
        box1: 8000000, box2: 500000, box3: 8000000, box4: 496000, box5: 8000000, box6: 116000,
        box7: 0, box8: 0, box10: 0, box11: 0, box12: [],
        box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false,
        box14: '', box15State: 'PA', box17StateIncomeTax: 150000,
      }],
    }
    const sr = computeAll(tr).stateResults.find(s => s.stateCode === 'PA')!
    const pa = getStateModule('PA')!

    for (const section of pa.reviewLayout) {
      for (const item of section.items) {
        expect(typeof item.getValue(sr)).toBe('number')
      }
    }
  })
})
