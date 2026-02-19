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
import { computeScheduleE } from '../../src/rules/2025/scheduleE'
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
