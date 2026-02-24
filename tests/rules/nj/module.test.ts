/**
 * Tests for NJ state module — review layout, result lines, and integration
 */

import { describe, expect, it } from 'vitest'
import { getStateModule } from '../../../src/rules/stateRegistry'
import { emptyTaxReturn } from '../../../src/model/types'
import { makeW2 } from '../../fixtures/returns'
import { cents } from '../../../src/model/traced'
import { computeAll } from '../../../src/rules/engine'

describe('NJ state module review layout', () => {
  it('has expected review sections and result lines', () => {
    const mod = getStateModule('NJ')!
    expect(mod).toBeDefined()
    const sectionTitles = mod.reviewLayout.map((s) => s.title)
    expect(sectionTitles).toEqual(['Income', 'Deductions & Exemptions', 'Tax & Credits', 'Payments & Result'])
    expect(mod.reviewResultLines.map((l) => l.type)).toEqual(['refund', 'owed', 'zero'])
  })

  it('module metadata is correct', () => {
    const mod = getStateModule('NJ')!
    expect(mod.stateCode).toBe('NJ')
    expect(mod.stateName).toBe('New Jersey')
    expect(mod.formLabel).toBe('NJ Form NJ-1040')
    expect(mod.sidebarLabel).toBe('NJ-1040')
  })

  it('layout value getters read from computed state result', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'NJ' as const, residencyType: 'full-year' as const }],
      w2s: [makeW2({ id: 'w2', employerName: 'A', box1: cents(80000), box2: cents(9000), box15State: 'NJ', box17StateIncomeTax: cents(2500) })],
    }
    const result = computeAll(tr)
    const sr = result.stateResults.find(s => s.stateCode === 'NJ')!
    expect(sr).toBeDefined()
    const mod = getStateModule('NJ')!

    const incomeSection = mod.reviewLayout.find((s) => s.title === 'Income')!
    const gross = incomeSection.items.find((i) => i.label === 'NJ Gross Income')!
    expect(gross.getValue(sr)).toBe(sr.stateAGI)
  })

  it('collectTracedValues produces a non-empty map', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'NJ' as const, residencyType: 'full-year' as const }],
      w2s: [makeW2({ id: 'w2', employerName: 'A', box1: cents(60000), box2: cents(6000), box15State: 'NJ', box17StateIncomeTax: cents(2000) })],
    }
    const result = computeAll(tr)
    const sr = result.stateResults.find(s => s.stateCode === 'NJ')!
    const mod = getStateModule('NJ')!
    const tracedValues = mod.collectTracedValues(sr)
    expect(tracedValues.size).toBeGreaterThan(0)
    expect(tracedValues.has('nj1040.njGrossIncome')).toBe(true)
    expect(tracedValues.has('nj1040.njTax')).toBe(true)
  })
})

describe('NJ state module — engine integration', () => {
  it('computeAll produces NJ state result', () => {
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
    expect(nj!.stateAGI).toBe(cents(120000))
    expect(nj!.stateWithholding).toBe(cents(6500))
    expect(nj!.stateTax).toBeGreaterThan(0)
  })



  it('part-year NJ selection is labeled as a resident estimate', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'NJ' as const, residencyType: 'part-year' as const }],
      w2s: [makeW2({
        id: 'w2-nj-py',
        employerName: 'Garden State Inc',
        box1: cents(75000),
        box2: cents(9000),
        box15State: 'NJ',
        box16StateWages: cents(75000),
      })],
    }

    const result = computeAll(tr)
    const nj = result.stateResults.find((s) => s.stateCode === 'NJ')
    expect(nj).toBeDefined()
    expect(nj!.formLabel).toContain('NJ-1040NR not yet supported')
  })
  it('NJ state result has correct refund/owed', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'NJ' as const, residencyType: 'full-year' as const }],
      w2s: [makeW2({
        id: 'w2',
        employerName: 'Test',
        box1: cents(50000),
        box2: cents(5000),
        box15State: 'NJ',
        box17StateIncomeTax: cents(5000),
      })],
    }

    const result = computeAll(tr)
    const nj = result.stateResults.find((s) => s.stateCode === 'NJ')!
    // With $5K withholding on $50K income, should have a refund
    expect(nj.overpaid).toBeGreaterThan(0)
    expect(nj.amountOwed).toBe(0)
  })
})
