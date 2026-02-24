import { describe, it, expect } from 'vitest'
import { getStateModule } from '../../../src/rules/stateRegistry'
import { computeAll } from '../../../src/rules/engine'
import { emptyTaxReturn } from '../../../src/model/types'
import { makeW2 } from '../../fixtures/returns'
import { cents } from '../../../src/model/traced'

describe('NC module review layout', () => {
  const ncModule = getStateModule('NC')!

  it('exposes expected sections', () => {
    const titles = ncModule.reviewLayout.map(s => s.title)
    expect(titles).toContain('Income')
    expect(titles).toContain('Deductions')
    expect(titles).toContain('Tax & Credits')
    expect(titles).toContain('Payments & Result')
  })

  it('maps values from compute result', () => {
    const tr = emptyTaxReturn(2025)
    tr.stateReturns = [{ stateCode: 'NC', residencyType: 'full-year' }]
    tr.w2s = [makeW2({ id: 'w2-1', employerName: 'NC Co', box1: cents(90000), box2: cents(9000), box15State: 'NC', box17StateIncomeTax: cents(2500) })]

    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const income = ncModule.reviewLayout.find(s => s.title === 'Income')!
    const ncAgiLine = income.items.find(i => i.label === 'NC AGI')!
    expect(ncAgiLine.getValue(stateResult)).toBe(stateResult.stateAGI)
  })
})
