/**
 * Line 31 — Refundable Credits Framework Tests
 *
 * Tests the excess Social Security withholding computation,
 * the refundable credits aggregation, and Form 1040 integration.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import {
  computeExcessSSWithholding,
  computeRefundableCredits,
} from '../../src/rules/2025/refundableCredits'
import { SS_WAGE_BASE, SS_TAX_RATE } from '../../src/rules/2025/constants'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { emptyTaxReturn } from '../../src/model/types'
import { makeW2, excessSSWithholdingReturn } from '../fixtures/returns'

describe('computeExcessSSWithholding', () => {
  it('returns null for single employer (cannot over-withhold)', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Only Co',
          box1: cents(200000),
          box2: cents(30000),
          box4: cents(10918),
        }),
      ],
    }
    expect(computeExcessSSWithholding(model)).toBeNull()
  })

  it('returns null when total SS withheld is within limit', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Co A',
          box1: cents(80000),
          box2: cents(10000),
          box4: cents(4960),  // 6.2% of $80K
        }),
        makeW2({
          id: 'w2-2',
          employerName: 'Co B',
          box1: cents(50000),
          box2: cents(6000),
          box4: cents(3100),  // 6.2% of $50K
        }),
      ],
    }
    // Total SS withheld: $8,060; max: $10,918.20
    expect(computeExcessSSWithholding(model)).toBeNull()
  })

  it('computes excess when two employers over-withhold SS tax', () => {
    const model = excessSSWithholdingReturn()
    const result = computeExcessSSWithholding(model)

    expect(result).not.toBeNull()
    expect(result!.creditId).toBe('excessSSWithholding')

    // Total SS withheld: $6,200 + $5,580 = $11,780
    // Max SS withholding: round($176,100 × 0.062) = $10,918
    const maxSS = Math.round(SS_WAGE_BASE * SS_TAX_RATE)
    const expectedExcess = cents(6200) + cents(5580) - maxSS
    expect(result!.amount).toBe(expectedExcess)
    expect(result!.amount).toBeGreaterThan(0)
  })

  it('handles three employers each withholding on their own wages', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Co A',
          box1: cents(80000),
          box2: cents(10000),
          box4: cents(4960),  // 6.2% of $80K
        }),
        makeW2({
          id: 'w2-2',
          employerName: 'Co B',
          box1: cents(70000),
          box2: cents(8000),
          box4: cents(4340),  // 6.2% of $70K
        }),
        makeW2({
          id: 'w2-3',
          employerName: 'Co C',
          box1: cents(60000),
          box2: cents(7000),
          box4: cents(3720),  // 6.2% of $60K
        }),
      ],
    }
    // Total wages: $210K (exceeds $176,100 wage base)
    // Total SS withheld: $4,960 + $4,340 + $3,720 = $13,020
    // Max: round($176,100 × 0.062) = $10,918
    // Excess: $13,020 - $10,918 = $2,102
    const result = computeExcessSSWithholding(model)
    expect(result).not.toBeNull()

    const maxSS = Math.round(SS_WAGE_BASE * SS_TAX_RATE)
    expect(result!.amount).toBe(cents(4960) + cents(4340) + cents(3720) - maxSS)
  })
})

describe('computeRefundableCredits', () => {
  it('returns empty result for simple single-employer return', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Acme',
          box1: cents(75000),
          box2: cents(8000),
        }),
      ],
    }
    const result = computeRefundableCredits(model)
    expect(result.items).toHaveLength(0)
    expect(result.totalLine31).toBe(0)
  })

  it('includes excess SS withholding when applicable', () => {
    const model = excessSSWithholdingReturn()
    const result = computeRefundableCredits(model)

    expect(result.items.length).toBeGreaterThanOrEqual(1)
    const ssItem = result.items.find(i => i.creditId === 'excessSSWithholding')
    expect(ssItem).toBeDefined()
    expect(ssItem!.amount).toBeGreaterThan(0)
    expect(result.totalLine31).toBe(ssItem!.amount)
  })
})

describe('Line 31 — Form 1040 integration', () => {
  it('Line 31 is zero for simple return', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Acme',
          box1: cents(75000),
          box2: cents(8000),
        }),
      ],
    }
    const result = computeForm1040(model)
    expect(result.line31.amount).toBe(0)
  })

  it('Line 31 reflects excess SS withholding with multiple employers', () => {
    const model = excessSSWithholdingReturn()
    const result = computeForm1040(model)

    expect(result.line31.amount).toBeGreaterThan(0)
    expect(result.refundableCreditsResult).not.toBeNull()
    expect(result.refundableCreditsResult!.items.length).toBeGreaterThanOrEqual(1)

    // Line 31 should flow through to Line 32 and Line 33
    expect(result.line32.amount).toBeGreaterThanOrEqual(result.line31.amount)
    expect(result.line33.amount).toBeGreaterThan(0)
  })
})
