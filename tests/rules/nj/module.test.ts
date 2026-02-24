import { describe, expect, it } from 'vitest'
import { getStateModule } from '../../../src/rules/stateRegistry'
import { emptyTaxReturn } from '../../../src/model/types'
import { makeW2 } from '../../fixtures/returns'
import { cents } from '../../../src/model/traced'
import { computeAll } from '../../../src/rules/engine'

describe('NJ state module review layout', () => {
  it('has expected review sections and result lines', () => {
    const mod = getStateModule('NJ')!
    const sectionTitles = mod.reviewLayout.map((s) => s.title)
    expect(sectionTitles).toEqual(['Income', 'Deductions', 'Tax & Credits', 'Payments & Result'])
    expect(mod.reviewResultLines.map((l) => l.type)).toEqual(['refund', 'owed', 'zero'])
  })

  it('layout value getters read from computed state result', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'NJ' as const, residencyType: 'full-year' as const }],
      w2s: [makeW2({ id: 'w2', employerName: 'A', box1: cents(80000), box2: cents(9000), box15State: 'NJ', box17StateIncomeTax: cents(2500) })],
    }
    const result = computeAll(tr)
    const sr = result.stateResults[0]
    const mod = getStateModule('NJ')!

    const incomeSection = mod.reviewLayout.find((s) => s.title === 'Income')!
    const gross = incomeSection.items.find((i) => i.label === 'NJ Gross Income')!
    expect(gross.getValue(sr)).toBe(sr.stateAGI)
  })
})
