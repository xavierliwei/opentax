import { describe, it, expect } from 'vitest'
import { analyzeGaps } from '../../openclaw-plugin/service/GapAnalysis.ts'
import { emptyTaxReturn } from '../../src/model/types.ts'
import type { TaxReturn, W2 } from '../../src/model/types.ts'
import { computeAll } from '../../src/rules/engine.ts'
import { cents } from '../../src/model/traced.ts'

// ── Helpers ──────────────────────────────────────────────────────

function analyze(taxReturn: TaxReturn) {
  return analyzeGaps(taxReturn, computeAll(taxReturn))
}

function makeW2(overrides: Partial<W2> = {}): W2 {
  return {
    id: 'w2-1',
    employerEin: '12-3456789',
    employerName: 'Acme Corp',
    box1: cents(60000),
    box2: cents(9000),
    box3: cents(60000),
    box4: cents(3720),
    box5: cents(60000),
    box6: cents(870),
    box7: 0,
    box8: 0,
    box10: 0,
    box11: 0,
    box12: [],
    box13StatutoryEmployee: false,
    box13RetirementPlan: false,
    box13ThirdPartySickPay: false,
    box14: '',
    ...overrides,
  }
}

function completeReturn(): TaxReturn {
  const tr = emptyTaxReturn(2025)
  tr.taxpayer = {
    firstName: 'John',
    lastName: 'Doe',
    ssn: '123456789',
    address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
  }
  tr.w2s = [makeW2()]
  return tr
}

// ── Tests ────────────────────────────────────────────────────────

describe('GapAnalysis', () => {
  it('empty return: 0% complete, all required missing, not ready to file', () => {
    const tr = emptyTaxReturn(2025)
    const result = analyze(tr)

    expect(result.readyToFile).toBe(false)
    expect(result.completionPercent).toBeLessThanOrEqual(10)

    const requiredItems = result.items.filter((i) => i.priority === 'required')
    expect(requiredItems.length).toBeGreaterThanOrEqual(5)

    // Should have personal info gaps
    expect(result.items.some((i) => i.field === 'name')).toBe(true)
    expect(result.items.some((i) => i.field === 'ssn')).toBe(true)
    expect(result.items.some((i) => i.field === 'income')).toBe(true)
  })

  it('partial return (W-2 only, no personal info): intermediate completion', () => {
    const tr = emptyTaxReturn(2025)
    tr.w2s = [makeW2()]
    const result = analyze(tr)

    expect(result.readyToFile).toBe(false)
    expect(result.completionPercent).toBeGreaterThan(0)
    expect(result.completionPercent).toBeLessThan(100)

    // Income gap should be resolved
    expect(result.items.some((i) => i.field === 'income')).toBe(false)
    // Personal info still missing
    expect(result.items.some((i) => i.field === 'name')).toBe(true)
  })

  it('complete return: 100% and readyToFile', () => {
    const tr = completeReturn()
    const result = analyze(tr)

    expect(result.readyToFile).toBe(true)
    expect(result.completionPercent).toBe(100)
    expect(result.items.filter((i) => i.priority === 'required')).toHaveLength(0)
  })

  it('complete return has appropriate suggestion', () => {
    const tr = completeReturn()
    const result = analyze(tr)

    expect(result.nextSuggestedAction).toContain('review')
  })

  it('MFJ without spouse: flags spouse as required', () => {
    const tr = completeReturn()
    tr.filingStatus = 'mfj'
    const result = analyze(tr)

    expect(result.readyToFile).toBe(false)
    expect(result.items.some((i) => i.category === 'spouse')).toBe(true)
  })

  it('MFJ with complete spouse is ready', () => {
    const tr = completeReturn()
    tr.filingStatus = 'mfj'
    tr.spouse = {
      firstName: 'Jane',
      lastName: 'Doe',
      ssn: '987654321',
      address: { street: '', city: '', state: '', zip: '' },
    }
    const result = analyze(tr)

    expect(result.readyToFile).toBe(true)
    expect(result.items.some((i) => i.category === 'spouse')).toBe(false)
  })

  it('MFJ with incomplete spouse name: flags as required', () => {
    const tr = completeReturn()
    tr.filingStatus = 'mfj'
    tr.spouse = {
      firstName: '',
      lastName: '',
      ssn: '987654321',
      address: { street: '', city: '', state: '', zip: '' },
    }
    const result = analyze(tr)

    expect(result.readyToFile).toBe(false)
    expect(result.items.some((i) => i.field === 'spouse.name')).toBe(true)
  })

  it('zero withholding with tax owed: warning', () => {
    const tr = completeReturn()
    // Remove withholding from W-2
    tr.w2s = [makeW2({ box2: 0 })]
    const result = analyze(tr)

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toContain('withholding')
    expect(result.items.some((i) => i.category === 'withholding')).toBe(true)
  })

  it('zero withholding but zero tax: no warning', () => {
    // Empty return has no income, so no tax owed
    const tr = emptyTaxReturn(2025)
    tr.taxpayer = {
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
      address: { street: '123 Main', city: 'City', state: 'CA', zip: '90000' },
    }
    const result = analyze(tr)
    expect(result.warnings.filter((w) => w.includes('withholding'))).toHaveLength(0)
  })

  it('itemized deductions with all zeros: warning', () => {
    const tr = completeReturn()
    tr.deductions = {
      method: 'itemized',
      itemized: {
        medicalExpenses: 0,
        stateLocalTaxes: 0,
        mortgageInterest: 0,
        charitableCash: 0,
        charitableNoncash: 0,
        otherDeductions: 0,
      },
    }
    const result = analyze(tr)

    expect(result.warnings.some((w) => w.includes('Itemized'))).toBe(true)
    expect(result.items.some((i) => i.field === 'itemized')).toBe(true)
  })

  it('itemized deductions selected but no itemized object: warning', () => {
    const tr = completeReturn()
    tr.deductions = { method: 'itemized' }
    const result = analyze(tr)

    expect(result.items.some((i) => i.field === 'itemized')).toBe(true)
  })

  it('nextSuggestedAction mentions personal info when that is missing', () => {
    const tr = emptyTaxReturn(2025)
    const result = analyze(tr)
    expect(result.nextSuggestedAction.toLowerCase()).toContain('personal')
  })

  it('nextSuggestedAction mentions income when only income is missing', () => {
    const tr = emptyTaxReturn(2025)
    tr.taxpayer = {
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
      address: { street: '123 Main', city: 'City', state: 'CA', zip: '90000' },
    }
    const result = analyze(tr)
    expect(result.nextSuggestedAction.toLowerCase()).toContain('income')
  })
})
