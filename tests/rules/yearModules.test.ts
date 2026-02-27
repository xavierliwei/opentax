/**
 * Tests for multi-year tax rules architecture.
 *
 * Verifies:
 * 1. Year module registry resolves correct modules
 * 2. engine.computeAll dispatches by TaxReturn.taxYear
 * 3. Unsupported year throws a clear error
 * 4. 2025 and 2026 modules have the correct TAX_YEAR
 * 5. getSupportedTaxYears returns all registered years
 */

import { describe, it, expect } from 'vitest'
import { getYearModule, getSupportedTaxYears } from '../../src/rules/yearModules'
import { computeAll } from '../../src/rules/engine'
import { simpleW2Return } from '../fixtures/returns'
import { TAX_YEAR as TAX_YEAR_2025 } from '../../src/rules/2025/constants'
import { TAX_YEAR as TAX_YEAR_2026 } from '../../src/rules/2026/constants'

// ── 1. Registry resolution ──────────────────────────────────────

describe('getYearModule', () => {
  it('resolves the 2025 year module', () => {
    const mod = getYearModule(2025)
    expect(mod.taxYear).toBe(2025)
    expect(typeof mod.computeForm1040).toBe('function')
    expect(typeof mod.computeScheduleB).toBe('function')
    expect(typeof mod.getStateModule).toBe('function')
    expect(typeof mod.getSupportedStates).toBe('function')
    expect(typeof mod.extractForm540).toBe('function')
  })

  it('resolves the 2026 year module', () => {
    const mod = getYearModule(2026)
    expect(mod.taxYear).toBe(2026)
    expect(typeof mod.computeForm1040).toBe('function')
  })

  it('throws for unsupported year', () => {
    expect(() => getYearModule(2020)).toThrow('No rules module registered for tax year 2020')
    expect(() => getYearModule(2020)).toThrow('Supported years:')
  })
})

// ── 2. Constants per year ───────────────────────────────────────

describe('year-specific constants', () => {
  it('2025 TAX_YEAR = 2025', () => {
    expect(TAX_YEAR_2025).toBe(2025)
  })

  it('2026 TAX_YEAR = 2026', () => {
    expect(TAX_YEAR_2026).toBe(2026)
  })

  it('each module has standard deduction for all filing statuses', () => {
    for (const year of [2025, 2026]) {
      const mod = getYearModule(year)
      for (const status of ['single', 'mfj', 'mfs', 'hoh', 'qw'] as const) {
        expect(mod.standardDeduction[status]).toBeGreaterThan(0)
      }
    }
  })
})

// ── 3. getSupportedTaxYears ──────────────────────────────────────

describe('getSupportedTaxYears', () => {
  it('includes 2025 and 2026', () => {
    const years = getSupportedTaxYears()
    expect(years).toContain(2025)
    expect(years).toContain(2026)
  })

  it('returns sorted array', () => {
    const years = getSupportedTaxYears()
    expect(years).toEqual([...years].sort())
  })
})

// ── 4. Engine dispatches by year ────────────────────────────────

describe('computeAll year dispatch', () => {
  it('computes correctly for taxYear 2025', () => {
    const model = simpleW2Return()
    model.taxYear = 2025
    const result = computeAll(model)
    expect(result.form1040).toBeDefined()
    expect(result.form1040.line1a.amount).toBeGreaterThan(0)
  })

  it('computes for taxYear 2026 (reuses 2025 logic)', () => {
    const model = simpleW2Return()
    model.taxYear = 2026
    const result = computeAll(model)
    expect(result.form1040).toBeDefined()
    expect(result.form1040.line1a.amount).toBeGreaterThan(0)
  })

  it('2025 and 2026 produce consistent results for same input', () => {
    const model2025 = simpleW2Return()
    model2025.taxYear = 2025
    const result2025 = computeAll(model2025)

    const model2026 = simpleW2Return()
    model2026.taxYear = 2026
    const result2026 = computeAll(model2026)

    // With stub 2026 constants matching 2025, results should be identical
    expect(result2026.form1040.line1a.amount).toBe(result2025.form1040.line1a.amount)
    expect(result2026.form1040.line9.amount).toBe(result2025.form1040.line9.amount)
    expect(result2026.form1040.line11.amount).toBe(result2025.form1040.line11.amount)
  })

  it('throws for unsupported taxYear in computeAll', () => {
    const model = simpleW2Return()
    model.taxYear = 2019
    expect(() => computeAll(model)).toThrow('No rules module registered for tax year 2019')
  })
})
