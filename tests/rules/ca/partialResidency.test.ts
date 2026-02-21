/**
 * Tests for California partial-year residency (Form 540NR)
 *
 * Covers: apportionment ratio computation, part-year tax proration,
 * exemption credit proration, mental health tax on apportioned income,
 * renter's credit eligibility, and comparison with full-year returns.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, StateReturnConfig } from '../../../src/model/types'
import { computeForm1040 } from '../../../src/rules/2025/form1040'
import { computeForm540, computeApportionmentRatio } from '../../../src/rules/2025/ca/form540'
import { computeAll } from '../../../src/rules/engine'
import { makeW2 } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function makeCAReturn(overrides: Partial<TaxReturn> = {}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    caResident: true,
    ...overrides,
  }
}

function compute540WithConfig(
  overrides: Partial<TaxReturn> = {},
  config?: StateReturnConfig,
) {
  const model = makeCAReturn(overrides)
  const form1040 = computeForm1040(model)
  return computeForm540(model, form1040, config)
}

// ── Apportionment Ratio Tests ───────────────────────────────────

describe('computeApportionmentRatio', () => {
  it('full-year → 1.0', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'full-year',
    }
    expect(computeApportionmentRatio(config, 2025)).toBe(1.0)
  })

  it('nonresident → 0.0', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'nonresident',
    }
    expect(computeApportionmentRatio(config, 2025)).toBe(0.0)
  })

  it('part-year: moved in Jul 1 → ~50% of year', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
      moveInDate: '2025-07-01',
      // moveOutDate omitted → defaults to Dec 31
    }
    const ratio = computeApportionmentRatio(config, 2025)
    // Jul 1 to Dec 31 = 184 days / 365 ≈ 0.5041
    expect(ratio).toBeCloseTo(184 / 365, 4)
  })

  it('part-year: moved out Jun 30 → ~49.6% of year', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
      // moveInDate omitted → defaults to Jan 1
      moveOutDate: '2025-06-30',
    }
    const ratio = computeApportionmentRatio(config, 2025)
    // Jan 1 to Jun 30 = 181 days / 365 ≈ 0.4959
    expect(ratio).toBeCloseTo(181 / 365, 4)
  })

  it('part-year: entire year (both dates at boundaries) → 1.0', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
      moveInDate: '2025-01-01',
      moveOutDate: '2025-12-31',
    }
    expect(computeApportionmentRatio(config, 2025)).toBe(1.0)
  })

  it('part-year: single day → 1/365', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
      moveInDate: '2025-06-15',
      moveOutDate: '2025-06-15',
    }
    const ratio = computeApportionmentRatio(config, 2025)
    expect(ratio).toBeCloseTo(1 / 365, 4)
  })

  it('part-year: no dates → full year (defaults to Jan 1 – Dec 31)', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
    }
    expect(computeApportionmentRatio(config, 2025)).toBe(1.0)
  })

  it('part-year: moveOut before moveIn → 0', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
      moveInDate: '2025-09-01',
      moveOutDate: '2025-03-01',
    }
    expect(computeApportionmentRatio(config, 2025)).toBe(0)
  })

  it('part-year: dates outside tax year are clamped', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
      moveInDate: '2024-06-01',  // before tax year
      moveOutDate: '2025-06-30',
    }
    const ratio = computeApportionmentRatio(config, 2025)
    // Should clamp start to Jan 1, so Jan 1 – Jun 30 = 181 days
    expect(ratio).toBeCloseTo(181 / 365, 4)
  })

  it('handles leap year correctly', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
      moveInDate: '2024-07-01',
    }
    const ratio = computeApportionmentRatio(config, 2024)
    // Jul 1 to Dec 31 in 2024 (leap year) = 184 days / 366
    expect(ratio).toBeCloseTo(184 / 366, 4)
  })
})

// ── Part-Year Tax Computation Tests ─────────────────────────────

describe('Form 540 — part-year tax computation', () => {
  const partYearConfig: StateReturnConfig = {
    stateCode: 'CA',
    residencyType: 'part-year',
    moveInDate: '2025-07-01',
    // No moveOutDate → Dec 31
  }

  it('part-year tax is prorated from full-year tax', () => {
    const w2s = [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000),
      box15State: 'CA', box17StateIncomeTax: cents(5000) })]

    const fullYear = compute540WithConfig({ w2s }, { stateCode: 'CA', residencyType: 'full-year' })
    const partYear = compute540WithConfig({ w2s }, partYearConfig)

    // Part-year tax should be approximately ratio × full-year tax
    const expectedRatio = 184 / 365
    expect(partYear.apportionmentRatio).toBeCloseTo(expectedRatio, 4)
    expect(partYear.caTax).toBe(Math.round(fullYear.caTax * expectedRatio))
    expect(partYear.residencyType).toBe('part-year')
  })

  it('part-year has lower tax than full-year for same income', () => {
    const w2s = [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })]

    const fullYear = compute540WithConfig({ w2s })
    const partYear = compute540WithConfig({ w2s }, partYearConfig)

    expect(partYear.caTax).toBeLessThan(fullYear.caTax)
    expect(partYear.taxAfterCredits).toBeLessThan(fullYear.taxAfterCredits)
  })

  it('part-year exemption credits are prorated', () => {
    const w2s = [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000) })]

    const fullYear = compute540WithConfig({ w2s })
    const partYear = compute540WithConfig({ w2s }, partYearConfig)

    const expectedRatio = 184 / 365
    expect(partYear.totalExemptionCredits).toBe(
      Math.round(fullYear.totalExemptionCredits * expectedRatio),
    )
  })

  it('part-year CA-source income is set', () => {
    const w2s = [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })]
    const partYear = compute540WithConfig({ w2s }, partYearConfig)

    expect(partYear.caSourceIncome).toBeDefined()
    expect(partYear.caSourceIncome).toBe(Math.round(partYear.caAGI * partYear.apportionmentRatio))
  })

  it('full-year has no caSourceIncome field', () => {
    const w2s = [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })]
    const fullYear = compute540WithConfig({ w2s })

    expect(fullYear.caSourceIncome).toBeUndefined()
    expect(fullYear.apportionmentRatio).toBe(1.0)
  })
})

// ── Renter's Credit Part-Year Tests ──────────────────────────────

describe('Form 540 — renter\'s credit for part-year residents', () => {
  it('part-year with 50%+ residency can get renter\'s credit', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
      moveInDate: '2025-01-01',
      moveOutDate: '2025-07-15', // > 6 months
    }
    const result = compute540WithConfig(
      { rentPaidInCA: true, w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(0) })] },
      config,
    )
    expect(result.rentersCredit).toBe(cents(60))
  })

  it('part-year with <50% residency does NOT get renter\'s credit', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
      moveInDate: '2025-09-01', // ~33% of year
    }
    const result = compute540WithConfig(
      { rentPaidInCA: true, w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(50000), box2: cents(0) })] },
      config,
    )
    expect(result.rentersCredit).toBe(0)
  })
})

// ── Mental Health Tax Part-Year Tests ────────────────────────────

describe('Form 540 — mental health tax for part-year residents', () => {
  it('$2M income, 50% ratio → apportioned $1M ≤ threshold → no MH tax', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
      moveInDate: '2025-07-03',  // ~50% of year
    }
    const result = compute540WithConfig(
      { w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(2000000 + 5706), box2: cents(0) })] },
      config,
    )

    // Full taxable = $2M, apportioned ≈ $1M which is right at threshold
    expect(result.mentalHealthTax).toBe(0)
  })

  it('$3M income, 50% ratio → apportioned ~$1.5M → MH tax applies', () => {
    const config: StateReturnConfig = {
      stateCode: 'CA',
      residencyType: 'part-year',
      moveInDate: '2025-07-03',  // ~50% of year
    }
    const result = compute540WithConfig(
      { w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(3000000 + 5706), box2: cents(0) })] },
      config,
    )

    // Apportioned taxable > $1M → MH tax should be > 0
    expect(result.mentalHealthTax).toBeGreaterThan(0)
  })
})

// ── computeAll Integration Tests ─────────────────────────────────

describe('computeAll — part-year state integration', () => {
  it('part-year CA return in stateResults has correct residencyType', () => {
    const tr: TaxReturn = {
      ...emptyTaxReturn(2025),
      stateReturns: [{
        stateCode: 'CA',
        residencyType: 'part-year',
        moveInDate: '2025-07-01',
      }],
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000),
        box15State: 'CA', box17StateIncomeTax: cents(5000) })],
    }
    const result = computeAll(tr)

    expect(result.stateResults).toHaveLength(1)
    expect(result.stateResults[0].residencyType).toBe('part-year')
    expect(result.stateResults[0].formLabel).toBe('CA Form 540NR')
    expect(result.stateResults[0].apportionmentRatio).toBeCloseTo(184 / 365, 4)
  })

  it('full-year CA return has formLabel CA Form 540', () => {
    const tr: TaxReturn = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'CA', residencyType: 'full-year' }],
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
    }
    const result = computeAll(tr)

    expect(result.stateResults[0].residencyType).toBe('full-year')
    expect(result.stateResults[0].formLabel).toBe('CA Form 540')
  })

  it('part-year traced values include caSourceIncome', () => {
    const tr: TaxReturn = {
      ...emptyTaxReturn(2025),
      stateReturns: [{
        stateCode: 'CA',
        residencyType: 'part-year',
        moveInDate: '2025-07-01',
      }],
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
    }
    const result = computeAll(tr)

    expect(result.values.has('form540.caSourceIncome')).toBe(true)
  })

  it('full-year traced values do NOT include caSourceIncome', () => {
    const tr: TaxReturn = {
      ...emptyTaxReturn(2025),
      stateReturns: [{ stateCode: 'CA', residencyType: 'full-year' }],
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(100000), box2: cents(15000) })],
    }
    const result = computeAll(tr)

    expect(result.values.has('form540.caSourceIncome')).toBe(false)
  })
})

// ── Full-Year Backward Compatibility ─────────────────────────────

describe('Form 540 — full-year backward compatibility', () => {
  it('computeForm540 without config behaves as full-year', () => {
    const model = makeCAReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000),
        box15State: 'CA', box17StateIncomeTax: cents(3500) })],
    })
    const form1040 = computeForm1040(model)
    const result = computeForm540(model, form1040) // no config

    expect(result.residencyType).toBe('full-year')
    expect(result.apportionmentRatio).toBe(1.0)
    expect(result.caSourceIncome).toBeUndefined()
    expect(result.caTax).toBeGreaterThan(0)
  })

  it('full-year config produces same results as no config', () => {
    const model = makeCAReturn({
      w2s: [makeW2({ id: 'w', employerName: 'X', box1: cents(75000), box2: cents(10000),
        box15State: 'CA', box17StateIncomeTax: cents(3500) })],
    })
    const form1040 = computeForm1040(model)
    const noConfig = computeForm540(model, form1040)
    const withConfig = computeForm540(model, form1040, { stateCode: 'CA', residencyType: 'full-year' })

    expect(withConfig.caTax).toBe(noConfig.caTax)
    expect(withConfig.taxAfterCredits).toBe(noConfig.taxAfterCredits)
    expect(withConfig.totalExemptionCredits).toBe(noConfig.totalExemptionCredits)
    expect(withConfig.overpaid).toBe(noConfig.overpaid)
    expect(withConfig.amountOwed).toBe(noConfig.amountOwed)
  })
})
