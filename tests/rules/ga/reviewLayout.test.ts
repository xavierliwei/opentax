import { describe, it, expect } from 'vitest'
import { computeAll } from '../../../src/rules/engine'
import { getStateModule } from '../../../src/rules/stateRegistry'
import { emptyTaxReturn } from '../../../src/model/types'
import { cents } from '../../../src/model/traced'
import { makeW2 } from '../../fixtures/returns'

describe('GA review layout config', () => {
  it('has expected sections and result lines', () => {
    const gaModule = getStateModule('GA')!
    const titles = gaModule.reviewLayout.map(s => s.title)
    expect(titles).toEqual(['Income', 'Deductions & Exemptions', 'Tax & Credits', 'Payments & Result'])
    expect(gaModule.reviewResultLines).toHaveLength(3)
  })

  it('layout values map to compute result', () => {
    const tr = emptyTaxReturn(2025)
    tr.stateReturns = [{ stateCode: 'GA', residencyType: 'full-year' }]
    tr.w2s = [makeW2({ box1: cents(100000), box15State: 'GA', box17StateIncomeTax: cents(5000) })]

    const result = computeAll(tr)
    const stateResult = result.stateResults[0]
    const gaModule = getStateModule('GA')!

    const income = gaModule.reviewLayout.find(s => s.title === 'Income')!
    const gaAgi = income.items.find(i => i.label === 'GA AGI')!
    expect(gaAgi.getValue(stateResult)).toBe(stateResult.stateAGI)
  })
})
