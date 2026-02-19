/**
 * Tests for Schedule E Part I — Rental Real Estate Income/Loss
 *
 * Covers:
 * - Single property profit
 * - Single property loss with PAL limitation
 * - Multiple properties
 * - PAL phase-out at various AGI levels
 * - MFS $0 allowance
 * - Zero-income no-trigger
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { computeScheduleE, straightLineDepreciation, getEffectiveDepreciation } from '../../src/rules/2025/scheduleE'
import { makeScheduleEProperty } from '../fixtures/returns'

describe('computeScheduleE — Single property profit', () => {
  const props = [
    makeScheduleEProperty({
      id: 'p1',
      rentsReceived: cents(24000),
      insurance: cents(1200),
      repairs: cents(3000),
      taxes: cents(4000),
      depreciation: cents(5000),
    }),
  ]
  const result = computeScheduleE(props, 'single', cents(80000))

  it('computes per-property income', () => {
    expect(result.properties[0].income.amount).toBe(cents(24000))
  })

  it('computes per-property expenses', () => {
    expect(result.properties[0].expenses.amount).toBe(cents(13200))
  })

  it('computes per-property net income', () => {
    expect(result.properties[0].netIncome.amount).toBe(cents(10800))
  })

  it('line23a = net income (profit)', () => {
    expect(result.line23a.amount).toBe(cents(10800))
  })

  it('line25 = 0 (no loss)', () => {
    expect(result.line25.amount).toBe(0)
  })

  it('line26 = profit flows to Schedule 1', () => {
    expect(result.line26.amount).toBe(cents(10800))
  })

  it('no disallowed loss', () => {
    expect(result.disallowedLoss).toBe(0)
  })
})

describe('computeScheduleE — Single property loss with PAL', () => {
  const props = [
    makeScheduleEProperty({
      id: 'p1',
      rentsReceived: cents(12000),
      mortgageInterest: cents(15000),
      insurance: cents(2000),
      taxes: cents(5000),
      repairs: cents(8000),
      depreciation: cents(12000),
    }),
  ]

  it('allows full $25K loss when AGI < $100K', () => {
    const result = computeScheduleE(props, 'single', cents(80000))
    // Net loss: $12K - $42K = -$30K
    expect(result.line23a.amount).toBe(cents(-30000))
    // Allowed: min($30K, $25K) = $25K
    expect(result.line25.amount).toBe(cents(-25000))
    expect(result.line26.amount).toBe(cents(-25000))
    expect(result.disallowedLoss).toBe(cents(-5000))
  })

  it('phases out allowance when AGI between $100K–$150K', () => {
    // AGI = $120K → excess = $20K → reduction = $25K * 20/50 = $10K
    // Allowance = $25K - $10K = $15K
    const result = computeScheduleE(props, 'single', cents(120000))
    expect(result.line25.amount).toBe(cents(-15000))
    expect(result.line26.amount).toBe(cents(-15000))
    expect(result.disallowedLoss).toBe(cents(-15000))
  })

  it('fully phases out at AGI >= $150K', () => {
    const result = computeScheduleE(props, 'single', cents(150000))
    expect(result.line25.amount).toBe(0)
    expect(result.line26.amount).toBe(0)
    expect(result.disallowedLoss).toBe(cents(-30000))
  })

  it('gives $0 allowance for MFS', () => {
    const result = computeScheduleE(props, 'mfs', cents(50000))
    expect(result.line25.amount).toBe(0)
    expect(result.line26.amount).toBe(0)
    expect(result.disallowedLoss).toBe(cents(-30000))
  })
})

describe('computeScheduleE — Multiple properties', () => {
  const props = [
    makeScheduleEProperty({
      id: 'p1',
      address: 'Property A',
      rentsReceived: cents(20000),
      repairs: cents(5000),
      taxes: cents(3000),
      // Net: $20K - $8K = +$12K
    }),
    makeScheduleEProperty({
      id: 'p2',
      address: 'Property B',
      rentsReceived: cents(8000),
      mortgageInterest: cents(12000),
      depreciation: cents(10000),
      // Net: $8K - $22K = -$14K
    }),
  ]

  it('combines net across properties', () => {
    const result = computeScheduleE(props, 'single', cents(90000))
    // Total: +$12K + (-$14K) = -$2K
    expect(result.line23a.amount).toBe(cents(-2000))
  })

  it('allows small loss within PAL limit', () => {
    const result = computeScheduleE(props, 'single', cents(90000))
    // Loss $2K < $25K allowance → full loss allowed
    expect(result.line25.amount).toBe(cents(-2000))
    expect(result.line26.amount).toBe(cents(-2000))
    expect(result.disallowedLoss).toBe(0)
  })
})

describe('computeScheduleE — MFJ same phaseout as single', () => {
  const props = [
    makeScheduleEProperty({
      id: 'p1',
      rentsReceived: cents(10000),
      repairs: cents(35000),
      // Net: -$25K
    }),
  ]

  it('allows full $25K at AGI $80K (MFJ)', () => {
    const result = computeScheduleE(props, 'mfj', cents(80000))
    expect(result.line25.amount).toBe(cents(-25000))
    expect(result.disallowedLoss).toBe(0)
  })

  it('phases out at AGI $130K (MFJ)', () => {
    // excess = $30K → reduction = $25K * 30/50 = $15K → allowance = $10K
    const result = computeScheduleE(props, 'mfj', cents(130000))
    expect(result.line25.amount).toBe(cents(-10000))
    expect(result.disallowedLoss).toBe(cents(-15000))
  })
})

describe('computeScheduleE — Edge cases', () => {
  it('returns zeros for empty properties array', () => {
    const result = computeScheduleE([], 'single', cents(100000))
    expect(result.line23a.amount).toBe(0)
    expect(result.line25.amount).toBe(0)
    expect(result.line26.amount).toBe(0)
    expect(result.properties).toHaveLength(0)
  })

  it('handles royalties-only property', () => {
    const props = [
      makeScheduleEProperty({
        id: 'p1',
        propertyType: 'royalties',
        royaltiesReceived: cents(5000),
      }),
    ]
    const result = computeScheduleE(props, 'single', cents(50000))
    expect(result.line23a.amount).toBe(cents(5000))
    expect(result.line26.amount).toBe(cents(5000))
  })

  it('handles property with zero income and zero expenses', () => {
    const props = [makeScheduleEProperty({ id: 'p1' })]
    const result = computeScheduleE(props, 'single', cents(50000))
    expect(result.line23a.amount).toBe(0)
    expect(result.line26.amount).toBe(0)
  })
})

// ── Straight-line depreciation tests ──────────────────────────────

describe('straightLineDepreciation', () => {
  // $200,000 residential property, placed in service January 2020
  // Annual: $200,000 / 27.5 = $7,272.73
  // First year (Jan): (12 - 1 + 0.5) / 12 = 11.5/12 → $6,969.70

  it('computes first-year depreciation with mid-month convention (January)', () => {
    const dep = straightLineDepreciation(cents(200000), 1, 2025, 'single-family', 2025)
    // Annual = 20000000 / 27.5 = 727272.73
    // First year = round(727272.73 * 11.5 / 12) = round(696969.70) = 696970
    expect(dep).toBe(696970)
  })

  it('computes first-year depreciation (June placed in service)', () => {
    const dep = straightLineDepreciation(cents(200000), 6, 2025, 'single-family', 2025)
    // months = 12 - 6 + 0.5 = 6.5
    // First year = round(727272.73 * 6.5 / 12) = round(393939.39) = 393939
    expect(dep).toBe(393939)
  })

  it('computes first-year depreciation (December placed in service)', () => {
    const dep = straightLineDepreciation(cents(200000), 12, 2025, 'single-family', 2025)
    // months = 12 - 12 + 0.5 = 0.5
    // First year = round(727272.73 * 0.5 / 12) = round(30303.03) = 30303
    expect(dep).toBe(30303)
  })

  it('computes full-year depreciation for subsequent years', () => {
    // Placed in service Jan 2020, tax year 2025 (year 6)
    const dep = straightLineDepreciation(cents(200000), 1, 2020, 'single-family', 2025)
    // Full year = round(20000000 / 27.5) = round(727272.73) = 727273
    expect(dep).toBe(727273)
  })

  it('computes commercial property at 39-year life', () => {
    const dep = straightLineDepreciation(cents(300000), 1, 2025, 'commercial', 2025)
    // Annual = 30000000 / 39 = 769230.77
    // First year = round(769230.77 * 11.5 / 12) = round(737179.49) = 737179
    expect(dep).toBe(737179)
  })

  it('returns 0 for land (not depreciable)', () => {
    const dep = straightLineDepreciation(cents(200000), 1, 2020, 'land', 2025)
    expect(dep).toBe(0)
  })

  it('returns 0 for royalties (not depreciable via this calculator)', () => {
    const dep = straightLineDepreciation(cents(200000), 1, 2020, 'royalties', 2025)
    expect(dep).toBe(0)
  })

  it('returns 0 if tax year is before placed-in-service year', () => {
    const dep = straightLineDepreciation(cents(200000), 6, 2026, 'single-family', 2025)
    expect(dep).toBe(0)
  })

  it('returns 0 if basis is 0', () => {
    const dep = straightLineDepreciation(0, 1, 2020, 'single-family', 2025)
    expect(dep).toBe(0)
  })

  it('returns 0 if placed-in-service month is invalid', () => {
    expect(straightLineDepreciation(cents(200000), 0, 2020, 'single-family', 2025)).toBe(0)
    expect(straightLineDepreciation(cents(200000), 13, 2020, 'single-family', 2025)).toBe(0)
  })

  it('caps depreciation at remaining basis in final year', () => {
    // $100 basis, 27.5 year life → annual ≈ $3.64
    // After 27+ years, should not exceed basis
    // Placed Jan 1998, tax year 2025 = year 27
    const basis = cents(100)
    const dep = straightLineDepreciation(basis, 1, 1998, 'single-family', 2025)
    // First year = round(10000/27.5 * 11.5/12) = round(348.48) = 348
    // Full year = round(10000/27.5) = round(363.64) = 364
    // Prior = 348 + 364*26 = 348 + 9464 = 9812
    // Remaining = 10000 - 9812 = 188
    // min(364, 188) = 188
    expect(dep).toBe(188)
  })

  it('returns 0 when fully depreciated', () => {
    // Placed Jan 1995, tax year 2025 = year 30, well past 27.5 years
    const dep = straightLineDepreciation(cents(100), 1, 1995, 'single-family', 2025)
    expect(dep).toBe(0)
  })
})

describe('getEffectiveDepreciation', () => {
  it('returns computed depreciation when basis and date are set', () => {
    const prop = makeScheduleEProperty({
      id: 'p1',
      depreciableBasis: cents(200000),
      placedInServiceMonth: 1,
      placedInServiceYear: 2020,
      depreciation: cents(5000), // manual value should be ignored
    })
    const dep = getEffectiveDepreciation(prop)
    expect(dep).toBe(727273) // full year: round(20000000 / 27.5)
  })

  it('falls back to manual depreciation when basis is 0', () => {
    const prop = makeScheduleEProperty({
      id: 'p1',
      depreciation: cents(5000),
    })
    expect(getEffectiveDepreciation(prop)).toBe(cents(5000))
  })

  it('falls back to manual when placed-in-service month is missing', () => {
    const prop = makeScheduleEProperty({
      id: 'p1',
      depreciableBasis: cents(200000),
      placedInServiceYear: 2020,
      depreciation: cents(4000),
    })
    expect(getEffectiveDepreciation(prop)).toBe(cents(4000))
  })
})

describe('computeScheduleE — auto-depreciation integration', () => {
  it('uses computed depreciation in expense total', () => {
    const props = [
      makeScheduleEProperty({
        id: 'p1',
        rentsReceived: cents(24000),
        insurance: cents(1200),
        depreciableBasis: cents(200000),
        placedInServiceMonth: 1,
        placedInServiceYear: 2020,
        // Auto dep = round(20000000/27.5) = 727273 = $7,272.73
      }),
    ]
    const result = computeScheduleE(props, 'single', cents(80000))
    // Income: $24,000 = 2400000
    // Expenses: insurance 120000 + dep 727273 = 847273
    // Net: 2400000 - 847273 = 1552727
    expect(result.properties[0].expenses.amount).toBe(847273)
    expect(result.properties[0].netIncome.amount).toBe(1552727)
  })
})
