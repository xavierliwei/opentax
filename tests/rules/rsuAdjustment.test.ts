/**
 * RSU Basis Adjustment tests.
 *
 * Tests the full pipeline: matching → basis analysis → transaction generation.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import type { Form1099B, RSUVestEvent } from '../../src/model/types'
import {
  matchRSUToSales,
  analyzeBasis,
  form1099BToTransaction,
  processRSUAdjustments,
  estimateRSUImpact,
} from '../../src/rules/2025/rsuAdjustment'

// ── Test helpers ───────────────────────────────────────────────

function make1099B(overrides: Partial<Form1099B> & { id: string; proceeds: number }): Form1099B {
  return {
    brokerName: 'Schwab',
    description: 'MEGA INC',
    dateAcquired: '2024-03-15',
    dateSold: '2025-06-15',
    costBasis: 0,
    washSaleLossDisallowed: 0,
    gainLoss: 0,
    basisReportedToIrs: false,
    longTerm: null,
    noncoveredSecurity: false,
    federalTaxWithheld: 0,
    ...overrides,
  }
}

function makeVest(overrides: Partial<RSUVestEvent> & { id: string }): RSUVestEvent {
  return {
    vestDate: '2024-03-15',
    symbol: 'MEGA',
    sharesVested: 500,
    sharesWithheldForTax: 175,
    sharesDelivered: 325,
    fmvAtVest: cents(100),         // $100/share
    totalFmv: cents(50000),        // 500 × $100
    ...overrides,
  }
}

// ── Matching ───────────────────────────────────────────────────

describe('matchRSUToSales', () => {
  it('matches by symbol + date', () => {
    const sales = [make1099B({ id: 'b1', proceeds: cents(35750), description: 'MEGA INC' })]
    const vests = [makeVest({ id: 'v1' })]

    const result = matchRSUToSales(sales, vests)
    expect(result.matched).toHaveLength(1)
    expect(result.unmatched1099Bs).toHaveLength(0)
    expect(result.matched[0].vestEvent.id).toBe('v1')
    expect(result.matched[0].confidence).toBeGreaterThanOrEqual(0.4)
  })

  it('matches by CUSIP + date (higher confidence)', () => {
    const sales = [make1099B({ id: 'b1', proceeds: cents(35750), cusip: '123456789' })]
    const vests = [makeVest({ id: 'v1', cusip: '123456789' })]

    const result = matchRSUToSales(sales, vests)
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].confidence).toBeGreaterThan(0.7)
  })

  it('does not match if symbol/CUSIP mismatch', () => {
    const sales = [make1099B({ id: 'b1', proceeds: cents(5000), description: 'OTHER CORP' })]
    const vests = [makeVest({ id: 'v1', symbol: 'MEGA' })]

    const result = matchRSUToSales(sales, vests)
    expect(result.matched).toHaveLength(0)
    expect(result.unmatched1099Bs).toHaveLength(1)
  })

  it('does not match if date mismatch (more than 3 days)', () => {
    const sales = [make1099B({
      id: 'b1', proceeds: cents(5000), description: 'MEGA INC',
      dateAcquired: '2023-01-01',  // way off from vest date 2024-03-15
    })]
    const vests = [makeVest({ id: 'v1' })]

    const result = matchRSUToSales(sales, vests)
    expect(result.matched).toHaveLength(0)
    expect(result.unmatched1099Bs).toHaveLength(1)
  })

  it('tolerates dates within 3 days', () => {
    const sales = [make1099B({
      id: 'b1', proceeds: cents(5000), description: 'MEGA INC',
      dateAcquired: '2024-03-17',  // 2 days after vest date
    })]
    const vests = [makeVest({ id: 'v1', vestDate: '2024-03-15' })]

    const result = matchRSUToSales(sales, vests)
    expect(result.matched).toHaveLength(1)
  })

  it('handles "Various" date as weak match', () => {
    const sales = [make1099B({
      id: 'b1', proceeds: cents(5000), description: 'MEGA INC',
      dateAcquired: null,  // "Various"
    })]
    const vests = [makeVest({ id: 'v1' })]

    const result = matchRSUToSales(sales, vests)
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].confidence).toBeLessThan(0.7) // weaker
  })

  it('boosts confidence when description contains "RSU"', () => {
    const salesWithRSU = [make1099B({ id: 'b1', proceeds: cents(5000), description: 'MEGA INC RSU' })]
    const salesWithout = [make1099B({ id: 'b2', proceeds: cents(5000), description: 'MEGA INC' })]
    const vests = [makeVest({ id: 'v1' })]

    const withRSU = matchRSUToSales(salesWithRSU, vests)
    const without = matchRSUToSales(salesWithout, vests)

    expect(withRSU.matched[0].confidence).toBeGreaterThan(without.matched[0].confidence)
  })
})

// ── Multi-lot matching ─────────────────────────────────────────

describe('multi-lot matching', () => {
  it('matches 2 sales to 2 different vest events', () => {
    const sales = [
      make1099B({
        id: 'b1', proceeds: cents(35000), description: 'MEGA INC',
        dateAcquired: '2024-03-15', dateSold: '2025-06-01',
      }),
      make1099B({
        id: 'b2', proceeds: cents(22000), description: 'MEGA INC',
        dateAcquired: '2024-09-15', dateSold: '2025-06-01',
      }),
    ]
    const vests = [
      makeVest({ id: 'v1', vestDate: '2024-03-15', fmvAtVest: cents(100), sharesDelivered: 325 }),
      makeVest({ id: 'v2', vestDate: '2024-09-15', fmvAtVest: cents(80), sharesDelivered: 250 }),
      makeVest({ id: 'v3', vestDate: '2025-03-15', fmvAtVest: cents(120), sharesDelivered: 300 }),
    ]

    const result = matchRSUToSales(sales, vests)
    expect(result.matched).toHaveLength(2)

    // First sale should match v1 (March vest)
    expect(result.matched[0].vestEvent.id).toBe('v1')
    // Second sale should match v2 (September vest)
    expect(result.matched[1].vestEvent.id).toBe('v2')
  })

  it('leaves unmatched 1099-Bs as non-RSU', () => {
    const sales = [
      make1099B({ id: 'b1', proceeds: cents(10000), description: 'MEGA INC', dateAcquired: '2024-03-15' }),
      make1099B({ id: 'b2', proceeds: cents(5000), description: 'AAPL', dateAcquired: '2024-01-10' }),
    ]
    const vests = [makeVest({ id: 'v1' })]

    const result = matchRSUToSales(sales, vests)
    expect(result.matched).toHaveLength(1)
    expect(result.matched[0].form1099B.id).toBe('b1')
    expect(result.unmatched1099Bs).toHaveLength(1)
    expect(result.unmatched1099Bs[0].id).toBe('b2')
  })
})

// ── Basis analysis ─────────────────────────────────────────────

describe('analyzeBasis', () => {
  it('zero basis: detects $0 reported basis', () => {
    const match = matchRSUToSales(
      [make1099B({ id: 'b1', proceeds: cents(35750), costBasis: 0 })],
      [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 325 })],
    ).matched[0]

    const analysis = analyzeBasis(match)
    expect(analysis.status).toBe('zero')
    expect(analysis.reportedBasis).toBe(0)
    expect(analysis.correctBasis).toBe(cents(100) * 325)  // $32,500
    expect(analysis.discrepancy).toBe(cents(32500))
  })

  it('partial basis: detects basis that is too low', () => {
    const match = matchRSUToSales(
      [make1099B({ id: 'b1', proceeds: cents(35750), costBasis: cents(16250) })],
      [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 325 })],
    ).matched[0]

    const analysis = analyzeBasis(match)
    expect(analysis.status).toBe('incorrect')
    expect(analysis.reportedBasis).toBe(cents(16250))
    expect(analysis.correctBasis).toBe(cents(32500))
    expect(analysis.discrepancy).toBe(cents(16250))
  })

  it('correct basis: no adjustment needed', () => {
    const match = matchRSUToSales(
      [make1099B({ id: 'b1', proceeds: cents(35750), costBasis: cents(32500) })],
      [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 325 })],
    ).matched[0]

    const analysis = analyzeBasis(match)
    expect(analysis.status).toBe('correct')
    expect(analysis.discrepancy).toBe(0)
  })

  it('correct basis: allows small rounding difference', () => {
    // Basis off by $0.50 (50 cents) — within 1% tolerance
    const match = matchRSUToSales(
      [make1099B({ id: 'b1', proceeds: cents(35750), costBasis: cents(32500) + 50 })],
      [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 325 })],
    ).matched[0]

    const analysis = analyzeBasis(match)
    expect(analysis.status).toBe('correct')
  })
})

// ── Transaction generation (non-RSU) ───────────────────────────

describe('form1099BToTransaction (non-RSU)', () => {
  it('converts a normal 1099-B to a CapitalTransaction', () => {
    const sale = make1099B({
      id: 'b1',
      description: '100 sh AAPL',
      dateAcquired: '2023-05-01',
      dateSold: '2025-06-15',
      proceeds: cents(18000),
      costBasis: cents(12000),
      basisReportedToIrs: true,
      longTerm: true,
    })

    const tx = form1099BToTransaction(sale)
    expect(tx.proceeds).toBe(cents(18000))
    expect(tx.adjustedBasis).toBe(cents(12000))
    expect(tx.gainLoss).toBe(cents(6000))
    expect(tx.adjustmentCode).toBeNull()
    expect(tx.adjustmentAmount).toBe(0)
    expect(tx.longTerm).toBe(true)
    expect(tx.category).toBe('D')
    expect(tx.source1099BId).toBe('b1')
    expect(tx.linkedRsuVestId).toBeUndefined()
  })

  it('classifies short-term basis-reported as category A', () => {
    const sale = make1099B({
      id: 'b1', proceeds: cents(5000), costBasis: cents(4000),
      basisReportedToIrs: true, longTerm: false,
    })
    expect(form1099BToTransaction(sale).category).toBe('A')
  })

  it('classifies short-term basis-not-reported as category B', () => {
    const sale = make1099B({
      id: 'b1', proceeds: cents(5000), costBasis: cents(4000),
      basisReportedToIrs: false, longTerm: false,
    })
    expect(form1099BToTransaction(sale).category).toBe('B')
  })

  it('classifies long-term basis-not-reported as category E', () => {
    const sale = make1099B({
      id: 'b1', proceeds: cents(5000), costBasis: cents(4000),
      basisReportedToIrs: false, longTerm: true,
    })
    expect(form1099BToTransaction(sale).category).toBe('E')
  })

  it('infers long-term from dates when longTerm is null', () => {
    const sale = make1099B({
      id: 'b1', proceeds: cents(5000), costBasis: cents(4000),
      dateAcquired: '2023-01-15', dateSold: '2025-06-15',
      basisReportedToIrs: true, longTerm: null,
    })
    const tx = form1099BToTransaction(sale)
    expect(tx.longTerm).toBe(true)
    expect(tx.category).toBe('D')
  })

  it('infers short-term from dates when longTerm is null', () => {
    const sale = make1099B({
      id: 'b1', proceeds: cents(5000), costBasis: cents(4000),
      dateAcquired: '2025-03-01', dateSold: '2025-06-15',
      basisReportedToIrs: true, longTerm: null,
    })
    const tx = form1099BToTransaction(sale)
    expect(tx.longTerm).toBe(false)
    expect(tx.category).toBe('A')
  })

  it('treats null costBasis as $0', () => {
    const sale = make1099B({
      id: 'b1', proceeds: cents(5000), costBasis: null,
      basisReportedToIrs: false, longTerm: true,
    })
    const tx = form1099BToTransaction(sale)
    expect(tx.reportedBasis).toBe(0)
    expect(tx.adjustedBasis).toBe(0)
    expect(tx.gainLoss).toBe(cents(5000))
  })
})

// ── Full pipeline: processRSUAdjustments ───────────────────────

describe('processRSUAdjustments', () => {
  describe('zero-basis RSU sale', () => {
    it('corrects $0 basis to FMV at vest', () => {
      const result = processRSUAdjustments(
        [make1099B({
          id: 'b1', proceeds: cents(12000), costBasis: 0,
          description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-08-01',
        })],
        [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 100 })],
      )

      expect(result.transactions).toHaveLength(1)
      const tx = result.transactions[0]

      expect(tx.reportedBasis).toBe(0)
      expect(tx.adjustedBasis).toBe(cents(10000))    // 100 × $100
      expect(tx.adjustmentCode).toBe('B')
      expect(tx.adjustmentAmount).toBe(cents(10000))
      expect(tx.gainLoss).toBe(cents(2000))           // $12k - $10k
      expect(tx.linkedRsuVestId).toBe('v1')
    })
  })

  describe('partial-basis RSU sale', () => {
    it('corrects partial basis', () => {
      const result = processRSUAdjustments(
        [make1099B({
          id: 'b1', proceeds: cents(12000), costBasis: cents(5000),
          description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-08-01',
        })],
        [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 100 })],
      )

      const tx = result.transactions[0]
      expect(tx.reportedBasis).toBe(cents(5000))
      expect(tx.adjustedBasis).toBe(cents(10000))
      expect(tx.adjustmentAmount).toBe(cents(5000))
      expect(tx.gainLoss).toBe(cents(2000))
    })
  })

  describe('correct-basis RSU sale', () => {
    it('leaves correct basis unchanged', () => {
      const result = processRSUAdjustments(
        [make1099B({
          id: 'b1', proceeds: cents(12000), costBasis: cents(10000),
          description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-08-01',
          basisReportedToIrs: true,
        })],
        [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 100 })],
      )

      const tx = result.transactions[0]
      expect(tx.adjustedBasis).toBe(cents(10000))
      expect(tx.adjustmentCode).toBeNull()
      expect(tx.adjustmentAmount).toBe(0)
      expect(tx.gainLoss).toBe(cents(2000))

      expect(result.analyses[0].status).toBe('correct')
    })
  })

  describe('no-match (non-RSU sale)', () => {
    it('passes through without adjustment', () => {
      const result = processRSUAdjustments(
        [make1099B({
          id: 'b1', proceeds: cents(8000), costBasis: cents(5000),
          description: 'AAPL', dateAcquired: '2024-01-10', dateSold: '2025-06-01',
          basisReportedToIrs: true, longTerm: true,
        })],
        [makeVest({ id: 'v1', symbol: 'MEGA' })],  // different symbol
      )

      expect(result.transactions).toHaveLength(1)
      const tx = result.transactions[0]

      expect(tx.adjustedBasis).toBe(cents(5000))
      expect(tx.adjustmentCode).toBeNull()
      expect(tx.gainLoss).toBe(cents(3000))
      expect(tx.category).toBe('D')
      expect(tx.linkedRsuVestId).toBeUndefined()
    })
  })

  describe('mixed: RSU + non-RSU sales', () => {
    it('adjusts RSU and passes through non-RSU', () => {
      const result = processRSUAdjustments(
        [
          make1099B({
            id: 'b-rsu', proceeds: cents(35750), costBasis: 0,
            description: 'MEGA INC RSU', dateAcquired: '2024-03-15', dateSold: '2025-06-15',
          }),
          make1099B({
            id: 'b-normal', proceeds: cents(8000), costBasis: cents(5000),
            description: 'AAPL', dateAcquired: '2024-01-01', dateSold: '2025-07-01',
            basisReportedToIrs: true, longTerm: true,
          }),
        ],
        [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 325 })],
      )

      expect(result.transactions).toHaveLength(2)
      expect(result.analyses).toHaveLength(1) // only RSU sale analyzed

      // RSU transaction: adjusted
      const rsuTx = result.transactions.find(t => t.linkedRsuVestId)!
      expect(rsuTx.adjustedBasis).toBe(cents(32500))
      expect(rsuTx.adjustmentCode).toBe('B')
      expect(rsuTx.gainLoss).toBe(cents(3250))

      // Normal transaction: untouched
      const normalTx = result.transactions.find(t => !t.linkedRsuVestId)!
      expect(normalTx.adjustedBasis).toBe(cents(5000))
      expect(normalTx.adjustmentCode).toBeNull()
      expect(normalTx.gainLoss).toBe(cents(3000))
    })
  })

  describe('no vest events at all', () => {
    it('all sales pass through as normal transactions', () => {
      const result = processRSUAdjustments(
        [
          make1099B({ id: 'b1', proceeds: cents(10000), costBasis: cents(7000), basisReportedToIrs: true, longTerm: true }),
          make1099B({ id: 'b2', proceeds: cents(5000), costBasis: cents(6000), basisReportedToIrs: true, longTerm: false }),
        ],
        [],
      )

      expect(result.transactions).toHaveLength(2)
      expect(result.analyses).toHaveLength(0)
      expect(result.transactions.every(t => !t.linkedRsuVestId)).toBe(true)
    })
  })

  describe('no sales at all', () => {
    it('returns empty transactions', () => {
      const result = processRSUAdjustments(
        [],
        [makeVest({ id: 'v1' })],
      )
      expect(result.transactions).toHaveLength(0)
      expect(result.analyses).toHaveLength(0)
    })
  })
})

// ── Category assignment for RSU transactions ───────────────────

describe('RSU transaction categorization', () => {
  it('long-term RSU with basis adjustment → category E', () => {
    const result = processRSUAdjustments(
      [make1099B({
        id: 'b1', proceeds: cents(12000), costBasis: 0,
        description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-08-01',
        longTerm: true,
      })],
      [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 100 })],
    )
    expect(result.transactions[0].category).toBe('E')
  })

  it('short-term RSU with basis adjustment → category B', () => {
    const result = processRSUAdjustments(
      [make1099B({
        id: 'b1', proceeds: cents(12000), costBasis: 0,
        description: 'MEGA INC', dateAcquired: '2025-01-15', dateSold: '2025-06-01',
        longTerm: false,
      })],
      [makeVest({ id: 'v1', vestDate: '2025-01-15', fmvAtVest: cents(100), sharesDelivered: 100 })],
    )
    expect(result.transactions[0].category).toBe('B')
  })

  it('RSU with correct basis keeps original category', () => {
    const result = processRSUAdjustments(
      [make1099B({
        id: 'b1', proceeds: cents(12000), costBasis: cents(10000),
        description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-08-01',
        basisReportedToIrs: true, longTerm: true,
      })],
      [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 100 })],
    )
    expect(result.transactions[0].category).toBe('D')  // basis reported + long-term
    expect(result.transactions[0].adjustmentCode).toBeNull()
  })
})

// ── Impact calculator ──────────────────────────────────────────

describe('estimateRSUImpact', () => {
  it('calculates total adjustment and estimated tax saved', () => {
    const result = processRSUAdjustments(
      [make1099B({
        id: 'b1', proceeds: cents(35750), costBasis: 0,
        description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-06-15',
      })],
      [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 325 })],
    )

    const impact = estimateRSUImpact(result.analyses)
    expect(impact.totalAdjustmentAmount).toBe(cents(32500))
    // At 24% marginal rate: $32,500 × 0.24 = $7,800
    expect(impact.estimatedTaxSaved).toBe(cents(7800))
    expect(impact.marginalRateUsed).toBe(0.24)
  })

  it('uses custom marginal rate', () => {
    const result = processRSUAdjustments(
      [make1099B({
        id: 'b1', proceeds: cents(12000), costBasis: 0,
        description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-08-01',
      })],
      [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 100 })],
    )

    const impact = estimateRSUImpact(result.analyses, 0.32)
    expect(impact.totalAdjustmentAmount).toBe(cents(10000))
    // At 32%: $10,000 × 0.32 = $3,200
    expect(impact.estimatedTaxSaved).toBe(cents(3200))
  })

  it('returns zero when all bases are correct', () => {
    const result = processRSUAdjustments(
      [make1099B({
        id: 'b1', proceeds: cents(12000), costBasis: cents(10000),
        description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-08-01',
        basisReportedToIrs: true,
      })],
      [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 100 })],
    )

    const impact = estimateRSUImpact(result.analyses)
    expect(impact.totalAdjustmentAmount).toBe(0)
    expect(impact.estimatedTaxSaved).toBe(0)
  })

  it('sums adjustments across multiple RSU sales', () => {
    const result = processRSUAdjustments(
      [
        make1099B({
          id: 'b1', proceeds: cents(12000), costBasis: 0,
          description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-06-01',
        }),
        make1099B({
          id: 'b2', proceeds: cents(8000), costBasis: 0,
          description: 'MEGA INC', dateAcquired: '2024-09-15', dateSold: '2025-07-01',
        }),
      ],
      [
        makeVest({ id: 'v1', vestDate: '2024-03-15', fmvAtVest: cents(100), sharesDelivered: 100 }),
        makeVest({ id: 'v2', vestDate: '2024-09-15', fmvAtVest: cents(80), sharesDelivered: 50 }),
      ],
    )

    const impact = estimateRSUImpact(result.analyses)
    // v1: correct basis $10,000 (100 × $100)
    // v2: correct basis $4,000 (50 × $80)
    // Total adjustment: $10,000 + $4,000 = $14,000
    expect(impact.totalAdjustmentAmount).toBe(cents(14000))
  })
})

// ── Double-tax avoidance verification ──────────────────────────

describe('double-taxation avoidance', () => {
  it('without adjustment: phantom gain = full proceeds', () => {
    // If you don't adjust basis, $0 basis means gain = proceeds
    const sale = make1099B({
      id: 'b1', proceeds: cents(35750), costBasis: 0,
      description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-06-15',
    })
    const phantomGain = sale.proceeds - (sale.costBasis ?? 0)
    expect(phantomGain).toBe(cents(35750))
  })

  it('with adjustment: actual gain = proceeds - FMV at vest', () => {
    const result = processRSUAdjustments(
      [make1099B({
        id: 'b1', proceeds: cents(35750), costBasis: 0,
        description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-06-15',
      })],
      [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 325 })],
    )

    const tx = result.transactions[0]
    expect(tx.gainLoss).toBe(cents(3250))  // actual economic gain
  })

  it('saved from double-tax = adjustment amount = FMV at vest × shares', () => {
    const result = processRSUAdjustments(
      [make1099B({
        id: 'b1', proceeds: cents(35750), costBasis: 0,
        description: 'MEGA INC', dateAcquired: '2024-03-15', dateSold: '2025-06-15',
      })],
      [makeVest({ id: 'v1', fmvAtVest: cents(100), sharesDelivered: 325 })],
    )

    const tx = result.transactions[0]
    const phantomGain = tx.proceeds  // what IRS would see without adjustment
    const actualGain = tx.gainLoss
    const savedIncome = phantomGain - actualGain

    expect(savedIncome).toBe(cents(32500))
    expect(savedIncome).toBe(tx.adjustmentAmount)
  })
})
