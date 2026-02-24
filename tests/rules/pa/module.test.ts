/**
 * Tests for PA StateRulesModule interface
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, StateReturnConfig } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { paModule } from '../../../src/rules/2025/pa/module'
import { getStateModule, getSupportedStates } from '../../../src/rules/stateRegistry'
import { makeW2 } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function paConfig(): StateReturnConfig {
  return { stateCode: 'PA', residencyType: 'full-year' }
}

function makeSimpleModel(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [makeW2({
      id: 'w2-1', employerName: 'PA Corp',
      box1: cents(75000), box2: cents(10000),
      box15State: 'PA', box16StateWages: cents(75000), box17StateIncomeTax: cents(2300),
    })],
  }
}

// ── Tests ───────────────────────────────────────────────────────

describe('PA StateRulesModule', () => {
  it('is registered in stateRegistry', () => {
    const mod = getStateModule('PA')
    expect(mod).toBeDefined()
    expect(mod?.stateCode).toBe('PA')
  })

  it('appears in getSupportedStates()', () => {
    const states = getSupportedStates()
    const pa = states.find(s => s.code === 'PA')
    expect(pa).toBeDefined()
    expect(pa?.stateName).toBe('Pennsylvania')
    expect(pa?.label).toBe('PA-40')
  })

  it('module metadata is correct', () => {
    expect(paModule.stateCode).toBe('PA')
    expect(paModule.stateName).toBe('Pennsylvania')
    expect(paModule.formLabel).toBe('PA-40')
    expect(paModule.sidebarLabel).toBe('PA-40')
  })

  it('compute() returns valid StateComputeResult', () => {
    const model = makeSimpleModel()
    const federal = computeForm1040(model)
    const result = paModule.compute(model, federal, paConfig())

    expect(result.stateCode).toBe('PA')
    expect(result.formLabel).toBe('PA-40')
    expect(result.residencyType).toBe('full-year')
    expect(result.stateTax).toBeGreaterThan(0)
    expect(result.stateWithholding).toBe(cents(2300))
    expect(typeof result.overpaid).toBe('number')
    expect(typeof result.amountOwed).toBe('number')
  })

  it('collectTracedValues returns expected trace nodes', () => {
    const model = makeSimpleModel()
    const federal = computeForm1040(model)
    const result = paModule.compute(model, federal, paConfig())
    const traced = paModule.collectTracedValues(result)

    expect(traced.has('pa40.totalTaxableIncome')).toBe(true)
    expect(traced.has('pa40.paTax')).toBe(true)
    expect(traced.has('pa40.taxAfterCredits')).toBe(true)
    expect(traced.has('pa40.compensation')).toBe(true)

    for (const [, v] of traced) {
      expect(typeof v.amount).toBe('number')
    }
  })

  it('reviewLayout sections have valid items', () => {
    const model = makeSimpleModel()
    const federal = computeForm1040(model)
    const result = paModule.compute(model, federal, paConfig())

    expect(paModule.reviewLayout.length).toBeGreaterThan(0)
    for (const section of paModule.reviewLayout) {
      expect(section.title).toBeTruthy()
      expect(section.items.length).toBeGreaterThan(0)
      for (const item of section.items) {
        expect(item.label).toBeTruthy()
        expect(typeof item.getValue(result)).toBe('number')
      }
    }

    expect(paModule.reviewResultLines.length).toBe(3)
    for (const line of paModule.reviewResultLines) {
      expect(typeof line.getValue(result)).toBe('number')
      expect(typeof line.showWhen(result)).toBe('boolean')
    }
  })
})
