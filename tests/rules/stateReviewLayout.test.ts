/**
 * Tests for state review layout configuration.
 *
 * Verifies that the config-driven review layout for each state module
 * produces correct values when evaluated against real compute results.
 */

import { describe, it, expect } from 'vitest'
import { computeAll } from '../../src/rules/engine'
import { getStateModule } from '../../src/rules/stateRegistry'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn } from '../../src/model/types'
import { cents } from '../../src/model/traced'
import { makeW2 } from '../fixtures/returns'

function makeCAReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    stateReturns: [{ stateCode: 'CA', residencyType: 'full-year' }],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Test Corp',
        box1: cents(100000),
        box2: cents(15000),
        box15State: 'CA',
        box16StateWages: cents(100000),
        box17StateIncomeTax: cents(5000),
      }),
    ],
    ...overrides,
  }
}

describe('CA review layout config', () => {
  const caModule = getStateModule('CA')!

  it('has reviewLayout with expected sections', () => {
    expect(caModule.reviewLayout).toBeDefined()
    const titles = caModule.reviewLayout.map(s => s.title)
    expect(titles).toContain('Income')
    expect(titles).toContain('Deductions')
    expect(titles).toContain('Tax & Credits')
    expect(titles).toContain('Payments & Result')
  })

  it('has reviewResultLines for refund, owed, and zero', () => {
    expect(caModule.reviewResultLines).toBeDefined()
    expect(caModule.reviewResultLines).toHaveLength(3)
    expect(caModule.reviewResultLines.map(l => l.type)).toEqual(['refund', 'owed', 'zero'])
  })

  it('layout items produce correct values from real compute result', () => {
    const tr = makeCAReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    // Income section: Federal AGI should match form1040 line 11
    const incomeSection = caModule.reviewLayout.find(s => s.title === 'Income')!
    const fedAGI = incomeSection.items.find(i => i.label === 'Federal AGI')!
    expect(fedAGI.getValue(stateResult)).toBe(result.form1040.line11.amount)

    // CA AGI should be in the income section
    const caAGI = incomeSection.items.find(i => i.label === 'CA AGI')!
    expect(caAGI.getValue(stateResult)).toBe(stateResult.stateAGI)

    // Tax & Credits section: CA Tax After Credits
    const taxSection = caModule.reviewLayout.find(s => s.title === 'Tax & Credits')!
    const taxAfter = taxSection.items.find(i => i.label === 'CA Tax After Credits')!
    expect(taxAfter.getValue(stateResult)).toBe(stateResult.taxAfterCredits)

    // Payments section: withholding
    const paymentsSection = caModule.reviewLayout.find(s => s.title === 'Payments & Result')!
    const withholding = paymentsSection.items.find(i => i.label === 'CA State Withholding')!
    expect(withholding.getValue(stateResult)).toBe(stateResult.stateWithholding)
    expect(withholding.showWhen!(stateResult)).toBe(true) // withholding > 0
  })

  it('conditional items hide when values are zero', () => {
    // With a simple return (no renter's credit, no mental health tax)
    const tr = makeCAReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const taxSection = caModule.reviewLayout.find(s => s.title === 'Tax & Credits')!

    // Mental health tax should be hidden (income < $1M)
    const mentalHealth = taxSection.items.find(i => i.label === 'Mental Health Services Tax')!
    expect(mentalHealth.showWhen!(stateResult)).toBe(false)

    // Renter's credit should be hidden (not enabled)
    const renters = taxSection.items.find(i => i.label === "Renter's Credit")!
    expect(renters.showWhen!(stateResult)).toBe(false)
  })

  it('result lines correctly identify refund vs owed', () => {
    // With $5K withholding on ~$100K income, likely refund since CA tax < $5K
    const tr = makeCAReturn()
    const result = computeAll(tr)
    const stateResult = result.stateResults[0]

    const refundLine = caModule.reviewResultLines.find(l => l.type === 'refund')!
    const owedLine = caModule.reviewResultLines.find(l => l.type === 'owed')!
    const zeroLine = caModule.reviewResultLines.find(l => l.type === 'zero')!

    // Exactly one of the three should show
    const showing = caModule.reviewResultLines.filter(l => l.showWhen(stateResult))
    expect(showing).toHaveLength(1)

    if (stateResult.overpaid > 0) {
      expect(refundLine.showWhen(stateResult)).toBe(true)
      expect(refundLine.getValue(stateResult)).toBe(stateResult.overpaid)
    } else if (stateResult.amountOwed > 0) {
      expect(owedLine.showWhen(stateResult)).toBe(true)
      expect(owedLine.getValue(stateResult)).toBe(stateResult.amountOwed)
    } else {
      expect(zeroLine.showWhen(stateResult)).toBe(true)
    }
  })

  it('each item has a valid nodeId for explainability trace', () => {
    for (const section of caModule.reviewLayout) {
      for (const item of section.items) {
        // nodeId should be a dotted path like "form540.caAGI" or "form1040.line11"
        expect(item.nodeId).toMatch(/^[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/)
      }
    }
  })

  it('each item has tooltip with explanation, pubName, pubUrl', () => {
    for (const section of caModule.reviewLayout) {
      for (const item of section.items) {
        expect(item.tooltip.explanation.length).toBeGreaterThan(10)
        expect(item.tooltip.pubName.length).toBeGreaterThan(0)
        expect(item.tooltip.pubUrl).toMatch(/^https:\/\//)
      }
    }
  })
})
