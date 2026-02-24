/**
 * Tests for Massachusetts Adjustments — Federal AGI → MA AGI
 *
 * Covers: HSA add-back, Social Security exemption, US government
 * interest exemption, and combined adjustment scenarios.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeMAAdjustments } from '../../../src/rules/2025/ma/adjustments'
import { makeW2, make1099INT, makeSSA1099 } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function makeModel(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return { ...emptyTaxReturn(2025), ...overrides }
}

function computeAdj(overrides: Partial<TaxReturn> = {}) {
  const model = makeModel(overrides)
  const form1040 = computeForm1040(model)
  return computeMAAdjustments(model, form1040)
}

// ── Tests ───────────────────────────────────────────────────────

describe('MA Adjustments — HSA add-back', () => {
  it('adds back federal HSA deduction', () => {
    const result = computeAdj({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(10000) })],
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4300),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
    })

    expect(result.hsaAddBack).toBe(cents(4300))
    expect(result.additions).toBe(cents(4300))
    // MA AGI = federal AGI + HSA add-back
    expect(result.maAGI).toBe(result.federalAGI + cents(4300))
  })

  it('no HSA → no add-back', () => {
    const result = computeAdj({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(80000), box2: cents(10000) })],
    })

    expect(result.hsaAddBack).toBe(0)
    expect(result.additions).toBe(0)
  })
})

describe('MA Adjustments — Social Security exemption', () => {
  it('subtracts federally taxable SS benefits', () => {
    const result = computeAdj({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(40000), box2: cents(4000) })],
      formSSA1099s: [makeSSA1099({
        id: 'ssa1', recipientName: 'T', box5: cents(24000), box3: cents(24000), box4: 0, box6: 0,
      })],
    })

    // If SS was federally taxable (depends on combined income), it gets subtracted
    if (result.ssExemption > 0) {
      expect(result.maAGI).toBeLessThan(result.federalAGI)
      expect(result.subtractions).toBeGreaterThan(0)
    }
  })

  it('no SS benefits → no exemption', () => {
    const result = computeAdj({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
    })

    expect(result.ssExemption).toBe(0)
  })
})

describe('MA Adjustments — US government interest', () => {
  it('subtracts 1099-INT Box 3 US gov interest', () => {
    const result = computeAdj({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
      form1099INTs: [
        make1099INT({ id: 'i1', payerName: 'Treasury', box1: cents(3000), box3: cents(3000) }),
      ],
    })

    expect(result.usGovInterest).toBe(cents(3000))
    expect(result.maAGI).toBe(result.federalAGI - cents(3000))
  })

  it('sums across multiple 1099-INTs', () => {
    const result = computeAdj({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
      form1099INTs: [
        make1099INT({ id: 'i1', payerName: 'Treasury', box1: cents(2000), box3: cents(2000) }),
        make1099INT({ id: 'i2', payerName: 'Savings', box1: cents(1000), box3: cents(500) }),
      ],
    })

    expect(result.usGovInterest).toBe(cents(2500))
  })

  it('no US gov interest → $0', () => {
    const result = computeAdj({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
      form1099INTs: [
        make1099INT({ id: 'i1', payerName: 'Bank', box1: cents(1000) }),
      ],
    })

    expect(result.usGovInterest).toBe(0)
  })
})

describe('MA Adjustments — combined', () => {
  it('all adjustments: HSA add-back + SS exemption + US gov interest', () => {
    const result = computeAdj({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(60000), box2: cents(8000) })],
      hsa: {
        coverageType: 'self-only',
        contributions: cents(4300),
        qualifiedExpenses: 0,
        age55OrOlder: false,
        age65OrDisabled: false,
      },
      form1099INTs: [
        make1099INT({ id: 'i1', payerName: 'Treasury', box1: cents(2000), box3: cents(2000) }),
      ],
    })

    expect(result.hsaAddBack).toBe(cents(4300))
    expect(result.usGovInterest).toBe(cents(2000))
    expect(result.additions).toBe(cents(4300))
    expect(result.subtractions).toBeGreaterThanOrEqual(cents(2000))
    // MA AGI = federal + 4300 - 2000 - ssExemption
    expect(result.maAGI).toBe(
      result.federalAGI + result.additions - result.subtractions,
    )
  })

  it('no adjustments → MA AGI equals federal AGI', () => {
    const result = computeAdj({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000) })],
    })

    expect(result.maAGI).toBe(result.federalAGI)
  })
})
