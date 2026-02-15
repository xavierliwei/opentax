import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { computeForm8949, getCategoryTotals } from '../../src/rules/2025/form8949'
import { makeTransaction, singleLTSaleReturn, mixedTradesReturn } from '../fixtures/returns'

// ── Category classification ────────────────────────────────────

describe('Form 8949 category grouping', () => {
  it('groups a single long-term basis-reported trade into category D', () => {
    const result = computeForm8949(singleLTSaleReturn().capitalTransactions)

    expect(result.categories).toHaveLength(1)
    expect(result.categories[0].category).toBe('D')
    expect(result.categories[0].transactions).toHaveLength(1)
  })

  it('classifies all 4 categories correctly', () => {
    const txs = [
      makeTransaction({ id: 'a', proceeds: cents(100), adjustedBasis: cents(80), longTerm: false, category: 'A' }),
      makeTransaction({ id: 'b', proceeds: cents(200), adjustedBasis: cents(150), longTerm: false, category: 'B' }),
      makeTransaction({ id: 'd', proceeds: cents(300), adjustedBasis: cents(200), longTerm: true, category: 'D' }),
      makeTransaction({ id: 'e', proceeds: cents(400), adjustedBasis: cents(350), longTerm: true, category: 'E' }),
    ]
    const result = computeForm8949(txs)

    expect(result.categories).toHaveLength(4)
    expect(result.byCategory['A']?.transactions).toHaveLength(1)
    expect(result.byCategory['B']?.transactions).toHaveLength(1)
    expect(result.byCategory['D']?.transactions).toHaveLength(1)
    expect(result.byCategory['E']?.transactions).toHaveLength(1)
  })

  it('groups mixed trades correctly (3 ST-A + 2 LT-D)', () => {
    const result = computeForm8949(mixedTradesReturn().capitalTransactions)

    expect(result.categories).toHaveLength(2)
    expect(result.byCategory['A']?.transactions).toHaveLength(3)
    expect(result.byCategory['D']?.transactions).toHaveLength(2)
    expect(result.byCategory['B']).toBeUndefined()
    expect(result.byCategory['E']).toBeUndefined()
  })

  it('returns empty categories for no transactions', () => {
    const result = computeForm8949([])
    expect(result.categories).toHaveLength(0)
  })
})

// ── Per-category totals ────────────────────────────────────────

describe('Form 8949 per-category totals', () => {
  it('single sale: proceeds, basis, gain/loss', () => {
    const result = computeForm8949(singleLTSaleReturn().capitalTransactions)
    const catD = getCategoryTotals(result, 'D')

    expect(catD.totalProceeds.amount).toBe(cents(7000))
    expect(catD.totalBasis.amount).toBe(cents(5000))
    expect(catD.totalGainLoss.amount).toBe(cents(2000))
    expect(catD.totalAdjustments.amount).toBe(0)
  })

  it('multiple trades: totals sum correctly', () => {
    const result = computeForm8949(mixedTradesReturn().capitalTransactions)
    const catA = getCategoryTotals(result, 'A')

    // ST trades: proceeds $8k+$5k+$4.5k = $17.5k
    expect(catA.totalProceeds.amount).toBe(cents(17500))
    // ST trades: basis $7k+$6k+$4k = $17k
    expect(catA.totalBasis.amount).toBe(cents(17000))
    // ST trades: gain/loss $1k + (-$1k) + $500 = $500
    expect(catA.totalGainLoss.amount).toBe(cents(500))
  })

  it('long-term totals for mixed return', () => {
    const result = computeForm8949(mixedTradesReturn().capitalTransactions)
    const catD = getCategoryTotals(result, 'D')

    // LT trades: proceeds $20k+$15k = $35k
    expect(catD.totalProceeds.amount).toBe(cents(35000))
    // LT trades: basis $12k+$10k = $22k
    expect(catD.totalBasis.amount).toBe(cents(22000))
    // LT trades: gain $8k+$5k = $13k
    expect(catD.totalGainLoss.amount).toBe(cents(13000))
  })

  it('getCategoryTotals returns zeros for missing category', () => {
    const result = computeForm8949(singleLTSaleReturn().capitalTransactions)
    const catA = getCategoryTotals(result, 'A')

    expect(catA.totalProceeds.amount).toBe(0)
    expect(catA.totalBasis.amount).toBe(0)
    expect(catA.totalGainLoss.amount).toBe(0)
    expect(catA.transactions).toHaveLength(0)
  })
})

// ── Gain/loss computation ──────────────────────────────────────

describe('Form 8949 gain/loss', () => {
  it('positive gain: proceeds > basis', () => {
    const txs = [
      makeTransaction({ id: 'g', proceeds: cents(10000), adjustedBasis: cents(6000), longTerm: true, category: 'D' }),
    ]
    const result = computeForm8949(txs)
    expect(getCategoryTotals(result, 'D').totalGainLoss.amount).toBe(cents(4000))
  })

  it('loss: proceeds < basis', () => {
    const txs = [
      makeTransaction({ id: 'l', proceeds: cents(3000), adjustedBasis: cents(8000), longTerm: false, category: 'A' }),
    ]
    const result = computeForm8949(txs)
    expect(getCategoryTotals(result, 'A').totalGainLoss.amount).toBe(cents(-5000))
  })

  it('break-even: proceeds = basis', () => {
    const txs = [
      makeTransaction({ id: 'be', proceeds: cents(5000), adjustedBasis: cents(5000), longTerm: true, category: 'D' }),
    ]
    const result = computeForm8949(txs)
    expect(getCategoryTotals(result, 'D').totalGainLoss.amount).toBe(0)
  })
})

// ── Trace / citation ───────────────────────────────────────────

describe('Form 8949 tracing', () => {
  it('category totals have correct IRS citations', () => {
    const result = computeForm8949(singleLTSaleReturn().capitalTransactions)
    const catD = getCategoryTotals(result, 'D')

    expect(catD.totalGainLoss.irsCitation).toBe('Form 8949, Box D — Total Gain/Loss')
    expect(catD.totalProceeds.irsCitation).toBe('Form 8949, Box D — Total Proceeds')
  })

  it('category totals trace to transaction IDs', () => {
    const result = computeForm8949(mixedTradesReturn().capitalTransactions)
    const catA = getCategoryTotals(result, 'A')

    if (catA.totalGainLoss.source.kind === 'computed') {
      expect(catA.totalGainLoss.source.inputs).toEqual([
        'tx:tx-st-1', 'tx:tx-st-2', 'tx:tx-st-3',
      ])
    }
  })
})
