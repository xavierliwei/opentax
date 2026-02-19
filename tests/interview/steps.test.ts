import { describe, it, expect } from 'vitest'
import { STEPS } from '../../src/interview/steps.ts'
import { emptyTaxReturn } from '../../src/model/types.ts'
import type { TaxReturn } from '../../src/model/types.ts'

function makeTr(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return { ...emptyTaxReturn(2025), ...overrides }
}

describe('steps.ts — visibility logic', () => {
  it('has 13 total steps', () => {
    expect(STEPS).toHaveLength(13)
  })

  it('spouse-info is hidden when filing status is single', () => {
    const tr = makeTr({ filingStatus: 'single' })
    const spouse = STEPS.find((s) => s.id === 'spouse-info')!
    expect(spouse.isVisible(tr)).toBe(false)
  })

  it('spouse-info is visible when filing status is mfj', () => {
    const tr = makeTr({ filingStatus: 'mfj' })
    const spouse = STEPS.find((s) => s.id === 'spouse-info')!
    expect(spouse.isVisible(tr)).toBe(true)
  })

  it('rsu-income is hidden by default (no RSU events or W-2 code V)', () => {
    const tr = makeTr()
    const rsu = STEPS.find((s) => s.id === 'rsu-income')!
    expect(rsu.isVisible(tr)).toBe(false)
  })

  it('rsu-income is visible when rsuVestEvents has entries', () => {
    const tr = makeTr({
      rsuVestEvents: [{
        id: 'rsu-1',
        vestDate: '2025-03-15',
        symbol: 'GOOG',
        sharesVested: 100,
        sharesWithheldForTax: 40,
        sharesDelivered: 60,
        fmvAtVest: 15000,
        totalFmv: 1500000,
      }],
    })
    const rsu = STEPS.find((s) => s.id === 'rsu-income')!
    expect(rsu.isVisible(tr)).toBe(true)
  })
})

describe('steps.ts — completion logic', () => {
  it('welcome is always complete', () => {
    const tr = makeTr()
    const welcome = STEPS.find((s) => s.id === 'welcome')!
    expect(welcome.isComplete(tr)).toBe(true)
  })

  it('personal-info is incomplete when taxpayer is empty', () => {
    const tr = makeTr()
    const step = STEPS.find((s) => s.id === 'personal-info')!
    expect(step.isComplete(tr)).toBe(false)
  })

  it('personal-info is complete when all required fields are filled', () => {
    const tr = makeTr({
      taxpayer: {
        firstName: 'John',
        lastName: 'Doe',
        ssn: '123456789',
        address: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zip: '62701',
        },
      },
    })
    const step = STEPS.find((s) => s.id === 'personal-info')!
    expect(step.isComplete(tr)).toBe(true)
  })

  it('spouse-info is incomplete when spouse is undefined', () => {
    const tr = makeTr({ filingStatus: 'mfj' })
    const step = STEPS.find((s) => s.id === 'spouse-info')!
    expect(step.isComplete(tr)).toBe(false)
  })

  it('dependents is always complete (zero dependents is valid)', () => {
    const tr = makeTr()
    const step = STEPS.find((s) => s.id === 'dependents')!
    expect(step.isComplete(tr)).toBe(true)
  })

  it('review is never auto-complete', () => {
    const tr = makeTr()
    const step = STEPS.find((s) => s.id === 'review')!
    expect(step.isComplete(tr)).toBe(false)
  })
})
