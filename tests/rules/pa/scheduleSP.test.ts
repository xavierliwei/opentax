/**
 * Tests for PA Schedule SP — Tax Forgiveness Credit
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn } from '../../../src/model/types'
import { computeScheduleSP, lookupForgivenessPercentage, computeEligibilityIncome } from '../../../src/rules/2025/pa/scheduleSP'
import { makeW2, makeDependent, makeSSA1099 } from '../../fixtures/returns'
import { PA_TAX_RATE } from '../../../src/rules/2025/pa/constants'

// ── Helpers ─────────────────────────────────────────────────────

function makeModel(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return { ...emptyTaxReturn(2025), ...overrides }
}

// ── lookupForgivenessPercentage ─────────────────────────────────

describe('lookupForgivenessPercentage', () => {
  it('single, 0 deps, $0 income → 100%', () => {
    expect(lookupForgivenessPercentage(0, 'single', 0)).toBe(100)
  })

  it('single, 0 deps, at $6,500 → 100%', () => {
    expect(lookupForgivenessPercentage(cents(6500), 'single', 0)).toBe(100)
  })

  it('single, 0 deps, at $6,501 → 90%', () => {
    expect(lookupForgivenessPercentage(cents(6500) + 1, 'single', 0)).toBe(90)
  })

  it('single, 0 deps, at $6,750 → 90%', () => {
    expect(lookupForgivenessPercentage(cents(6750), 'single', 0)).toBe(90)
  })

  it('single, 0 deps, at $6,751 → 80%', () => {
    expect(lookupForgivenessPercentage(cents(6750) + 1, 'single', 0)).toBe(80)
  })

  it('single, 0 deps, at $8,750 → 10%', () => {
    expect(lookupForgivenessPercentage(cents(8750), 'single', 0)).toBe(10)
  })

  it('single, 0 deps, at $8,751 → 0%', () => {
    expect(lookupForgivenessPercentage(cents(8750) + 1, 'single', 0)).toBe(0)
  })

  it('single, 0 deps, $100K → 0%', () => {
    expect(lookupForgivenessPercentage(cents(100000), 'single', 0)).toBe(0)
  })

  it('single, 2 deps → threshold shifts up by $19,000', () => {
    // Base $6,500 + 2 × $9,500 = $25,500
    expect(lookupForgivenessPercentage(cents(25500), 'single', 2)).toBe(100)
    expect(lookupForgivenessPercentage(cents(25500) + 1, 'single', 2)).toBe(90)
  })

  it('married, 0 deps → base is $13,000', () => {
    expect(lookupForgivenessPercentage(cents(13000), 'married', 0)).toBe(100)
    expect(lookupForgivenessPercentage(cents(13000) + 1, 'married', 0)).toBe(90)
  })

  it('married, 3 deps → base $13,000 + $28,500 = $41,500', () => {
    expect(lookupForgivenessPercentage(cents(41500), 'married', 3)).toBe(100)
    expect(lookupForgivenessPercentage(cents(41500) + 1, 'married', 3)).toBe(90)
  })
})

// ── computeEligibilityIncome ────────────────────────────────────

describe('computeEligibilityIncome', () => {
  it('PA taxable only → equals paTaxableIncome', () => {
    const model = makeModel()
    expect(computeEligibilityIncome(model, cents(50000))).toBe(cents(50000))
  })

  it('includes Social Security benefits', () => {
    const model = makeModel({
      formSSA1099s: [makeSSA1099({ id: 'ssa-1', box5: cents(18000) })],
    })
    expect(computeEligibilityIncome(model, cents(5000))).toBe(cents(5000) + cents(18000))
  })

  it('negative SS benefits → adds 0', () => {
    const model = makeModel({
      formSSA1099s: [makeSSA1099({ id: 'ssa-1', box5: cents(-1000) })],
    })
    expect(computeEligibilityIncome(model, cents(5000))).toBe(cents(5000))
  })
})

// ── computeScheduleSP (full integration) ────────────────────────

describe('computeScheduleSP — integration', () => {
  it('low income single → 100% forgiveness', () => {
    const model = makeModel({
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(5000), box2: 0 })],
    })
    const paTaxableIncome = cents(5000)
    const paTax = Math.round(paTaxableIncome * PA_TAX_RATE)
    const result = computeScheduleSP(model, paTaxableIncome, paTax)

    expect(result.filingCategory).toBe('single')
    expect(result.numberOfDependents).toBe(0)
    expect(result.forgivenessPercentage).toBe(100)
    expect(result.forgivenessCredit).toBe(paTax)
    expect(result.qualifies).toBe(true)
  })

  it('moderate income → partial forgiveness', () => {
    const model = makeModel()
    const paTaxableIncome = cents(7100)  // between $7,001-$7,250 → 70% for single, 0 deps
    const paTax = Math.round(paTaxableIncome * PA_TAX_RATE)
    const result = computeScheduleSP(model, paTaxableIncome, paTax)

    expect(result.forgivenessPercentage).toBe(70)
    expect(result.forgivenessCredit).toBe(Math.round(paTax * 70 / 100))
    expect(result.qualifies).toBe(true)
  })

  it('high income → no forgiveness', () => {
    const model = makeModel()
    const paTaxableIncome = cents(100000)
    const paTax = Math.round(paTaxableIncome * PA_TAX_RATE)
    const result = computeScheduleSP(model, paTaxableIncome, paTax)

    expect(result.forgivenessPercentage).toBe(0)
    expect(result.forgivenessCredit).toBe(0)
    expect(result.qualifies).toBe(false)
  })

  it('MFJ with 2 dependents, low income → adjusted threshold', () => {
    const model = makeModel({
      filingStatus: 'mfj',
      dependents: [
        makeDependent({ firstName: 'A', dateOfBirth: '2015-01-01' }),
        makeDependent({ firstName: 'B', dateOfBirth: '2017-01-01', ssn: '987654322' }),
      ],
    })
    // Married base $13,000 + 2 × $9,500 = $32,000
    const paTaxableIncome = cents(32000)
    const paTax = Math.round(paTaxableIncome * PA_TAX_RATE)
    const result = computeScheduleSP(model, paTaxableIncome, paTax)

    expect(result.filingCategory).toBe('married')
    expect(result.numberOfDependents).toBe(2)
    expect(result.forgivenessPercentage).toBe(100)
    expect(result.qualifies).toBe(true)
  })

  it('zero tax → forgiveness credit is $0 even if qualifies', () => {
    const model = makeModel()
    const result = computeScheduleSP(model, 0, 0)

    expect(result.forgivenessPercentage).toBe(100)
    expect(result.forgivenessCredit).toBe(0)
    expect(result.qualifies).toBe(true)
  })
})
