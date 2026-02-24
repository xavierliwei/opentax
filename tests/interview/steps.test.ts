import { describe, it, expect } from 'vitest'
import { STEPS } from '../../src/interview/steps.ts'
import { emptyTaxReturn } from '../../src/model/types.ts'
import type { TaxReturn } from '../../src/model/types.ts'

function makeTr(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return { ...emptyTaxReturn(2025), ...overrides }
}

describe('steps.ts — visibility logic', () => {
  it('has expected total steps (including dynamic state review steps)', () => {
    // 21 static + dynamic state review steps (CA, PA)
    expect(STEPS.length).toBeGreaterThanOrEqual(23)
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

  it('state-returns page is always visible', () => {
    const tr = makeTr()
    const step = STEPS.find((s) => s.id === 'state-returns')!
    expect(step).toBeDefined()
    expect(step.isVisible(tr)).toBe(true)
    expect(step.section).toBe('getting-started')
  })

  it('state-review-CA is visible only when CA is in stateReturns', () => {
    const tr = makeTr()
    const step = STEPS.find((s) => s.id === 'state-review-CA')!
    expect(step).toBeDefined()
    expect(step.isVisible(tr)).toBe(false)

    const trWithCA = makeTr({
      stateReturns: [{ stateCode: 'CA', residencyType: 'full-year' }],
    })
    expect(step.isVisible(trWithCA)).toBe(true)
  })

  it('state-review-CA has section=review', () => {
    const step = STEPS.find((s) => s.id === 'state-review-CA')!
    expect(step.section).toBe('review')
  })

  it('state-review-PA is visible only when PA is in stateReturns', () => {
    const tr = makeTr()
    const step = STEPS.find((s) => s.id === 'state-review-PA')!
    expect(step).toBeDefined()
    expect(step.isVisible(tr)).toBe(false)

    const trWithPA = makeTr({
      stateReturns: [{ stateCode: 'PA', residencyType: 'full-year' }],
    })
    expect(step.isVisible(trWithPA)).toBe(true)
  it('state-review-NC exists and is visible only when NC is selected', () => {
    const step = STEPS.find((s) => s.id === 'state-review-NC')!
    expect(step).toBeDefined()
    expect(step.section).toBe('review')

    const tr = makeTr()
    expect(step.isVisible(tr)).toBe(false)

    const trWithNC = makeTr({ stateReturns: [{ stateCode: 'NC', residencyType: 'full-year' }] })
    expect(step.isVisible(trWithNC)).toBe(true)
  })
})

describe('steps.ts — section assignments', () => {
  it('welcome and filing-status are in getting-started', () => {
    const welcome = STEPS.find((s) => s.id === 'welcome')!
    const filing = STEPS.find((s) => s.id === 'filing-status')!
    expect(welcome.section).toBe('getting-started')
    expect(filing.section).toBe('getting-started')
  })

  it('w2-income is in income section', () => {
    const step = STEPS.find((s) => s.id === 'w2-income')!
    expect(step.section).toBe('income')
  })

  it('deductions and credits are in deductions-credits section', () => {
    const deductions = STEPS.find((s) => s.id === 'deductions')!
    const credits = STEPS.find((s) => s.id === 'credits')!
    expect(deductions.section).toBe('deductions-credits')
    expect(credits.section).toBe('deductions-credits')
  })

  it('review is in review section', () => {
    const step = STEPS.find((s) => s.id === 'review')!
    expect(step.section).toBe('review')
  })

  it('download is in download section', () => {
    const step = STEPS.find((s) => s.id === 'download')!
    expect(step.section).toBe('download')
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

  it('state-returns is always complete (no selection = federal-only)', () => {
    const tr = makeTr()
    const step = STEPS.find((s) => s.id === 'state-returns')!
    expect(step.isComplete(tr)).toBe(true)
  })
})
