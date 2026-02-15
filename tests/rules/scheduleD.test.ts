import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import { computeScheduleD } from '../../src/rules/2025/scheduleD'
import { getCategoryTotals } from '../../src/rules/2025/form8949'
import {
  singleLTSaleReturn,
  mixedTradesReturn,
  bigCapitalLossReturn,
  makeTransaction,
  make1099DIV,
} from '../fixtures/returns'

// ── Single sale ────────────────────────────────────────────────

describe('Schedule D — single long-term sale', () => {
  it('Line 8a = category D gain/loss', () => {
    const result = computeScheduleD(singleLTSaleReturn())
    expect(result.line8a.amount).toBe(cents(2000))
  })

  it('Lines 1a, 1b = $0 (no short-term trades)', () => {
    const result = computeScheduleD(singleLTSaleReturn())
    expect(result.line1a.amount).toBe(0)
    expect(result.line1b.amount).toBe(0)
  })

  it('Line 7 (net ST) = $0', () => {
    const result = computeScheduleD(singleLTSaleReturn())
    expect(result.line7.amount).toBe(0)
  })

  it('Line 15 (net LT) = $2,000', () => {
    const result = computeScheduleD(singleLTSaleReturn())
    expect(result.line15.amount).toBe(cents(2000))
  })

  it('Line 16 = Line 7 + Line 15 = $2,000', () => {
    const result = computeScheduleD(singleLTSaleReturn())
    expect(result.line16.amount).toBe(cents(2000))
  })

  it('Line 21 = $2,000 (gain, no loss limitation)', () => {
    const result = computeScheduleD(singleLTSaleReturn())
    expect(result.line21.amount).toBe(cents(2000))
  })

  it('no carryforward on a gain', () => {
    const result = computeScheduleD(singleLTSaleReturn())
    expect(result.capitalLossCarryforward).toBe(0)
  })
})

// ── Mixed trades ───────────────────────────────────────────────

describe('Schedule D — mixed short-term + long-term', () => {
  // ST: $1k + (-$1k) + $500 = $500 net ST gain
  // LT: $8k + $5k = $13k net LT gain

  it('Line 1a = net short-term category A gain/loss', () => {
    const result = computeScheduleD(mixedTradesReturn())
    expect(result.line1a.amount).toBe(cents(500))
  })

  it('Line 7 = net short-term = $500', () => {
    const result = computeScheduleD(mixedTradesReturn())
    expect(result.line7.amount).toBe(cents(500))
  })

  it('Line 8a = net long-term category D gain/loss', () => {
    const result = computeScheduleD(mixedTradesReturn())
    expect(result.line8a.amount).toBe(cents(13000))
  })

  it('Line 15 = net long-term = $13,000', () => {
    const result = computeScheduleD(mixedTradesReturn())
    expect(result.line15.amount).toBe(cents(13000))
  })

  it('Line 16 = $500 + $13,000 = $13,500', () => {
    const result = computeScheduleD(mixedTradesReturn())
    expect(result.line16.amount).toBe(cents(13500))
  })

  it('Line 21 = $13,500 (gain, no loss limitation)', () => {
    const result = computeScheduleD(mixedTradesReturn())
    expect(result.line21.amount).toBe(cents(13500))
  })
})

// ── Capital loss limitation ────────────────────────────────────

describe('Schedule D — capital loss limitation', () => {
  // bigCapitalLossReturn: -$7,000 + $2,000 = -$5,000 net loss

  it('Line 16 = -$5,000 (net loss before limitation)', () => {
    const result = computeScheduleD(bigCapitalLossReturn())
    expect(result.line16.amount).toBe(cents(-5000))
  })

  it('Line 21 = -$3,000 (limited to $3,000 for single filer)', () => {
    const result = computeScheduleD(bigCapitalLossReturn())
    expect(result.line21.amount).toBe(cents(-3000))
  })

  it('carryforward = $2,000', () => {
    const result = computeScheduleD(bigCapitalLossReturn())
    expect(result.capitalLossCarryforward).toBe(cents(2000))
  })

  it('MFS filer: loss limited to $1,500', () => {
    const tr = { ...bigCapitalLossReturn(), filingStatus: 'mfs' as const }
    const result = computeScheduleD(tr)
    expect(result.line21.amount).toBe(cents(-1500))
    expect(result.capitalLossCarryforward).toBe(cents(3500))
  })

  it('loss exactly at $3,000: no carryforward', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      capitalTransactions: [
        makeTransaction({
          id: 'tx-1',
          proceeds: cents(2000),
          adjustedBasis: cents(5000),  // -$3,000 loss
          longTerm: true,
          category: 'D',
        }),
      ],
    }
    const result = computeScheduleD(tr)
    expect(result.line16.amount).toBe(cents(-3000))
    expect(result.line21.amount).toBe(cents(-3000))
    expect(result.capitalLossCarryforward).toBe(0)
  })

  it('loss under $3,000: fully deductible, no carryforward', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      capitalTransactions: [
        makeTransaction({
          id: 'tx-1',
          proceeds: cents(4000),
          adjustedBasis: cents(5500),  // -$1,500 loss
          longTerm: false,
          category: 'A',
        }),
      ],
    }
    const result = computeScheduleD(tr)
    expect(result.line16.amount).toBe(cents(-1500))
    expect(result.line21.amount).toBe(cents(-1500))
    expect(result.capitalLossCarryforward).toBe(0)
  })
})

// ── Capital gain distributions (1099-DIV Box 2a) ──────────────

describe('Schedule D — capital gain distributions', () => {
  it('Line 13 picks up 1099-DIV Box 2a', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Schwab', box1a: cents(2000), box2a: cents(500) }),
      ],
    }
    const result = computeScheduleD(tr)
    expect(result.line13.amount).toBe(cents(500))
  })

  it('Line 13 sums multiple 1099-DIVs', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Schwab', box1a: cents(1000), box2a: cents(300) }),
        make1099DIV({ id: 'div-2', payerName: 'Vanguard', box1a: cents(500), box2a: cents(200) }),
      ],
    }
    const result = computeScheduleD(tr)
    expect(result.line13.amount).toBe(cents(500))
  })

  it('Line 13 = $0 when no capital gain distributions', () => {
    const result = computeScheduleD(emptyTaxReturn(2025))
    expect(result.line13.amount).toBe(0)
  })

  it('Line 13 flows into Line 15 (net long-term)', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Schwab', box1a: cents(1000), box2a: cents(500) }),
      ],
      capitalTransactions: [
        makeTransaction({
          id: 'tx-1',
          proceeds: cents(8000),
          adjustedBasis: cents(6000),  // $2,000 gain
          longTerm: true,
          category: 'D',
        }),
      ],
    }
    const result = computeScheduleD(tr)
    // Line 15 = LT gain ($2,000) + cap gain dist ($500) = $2,500
    expect(result.line15.amount).toBe(cents(2500))
  })
})

// ── No transactions ────────────────────────────────────────────

describe('Schedule D — no transactions', () => {
  it('all lines are $0', () => {
    const result = computeScheduleD(emptyTaxReturn(2025))

    expect(result.line1a.amount).toBe(0)
    expect(result.line1b.amount).toBe(0)
    expect(result.line7.amount).toBe(0)
    expect(result.line8a.amount).toBe(0)
    expect(result.line8b.amount).toBe(0)
    expect(result.line13.amount).toBe(0)
    expect(result.line15.amount).toBe(0)
    expect(result.line16.amount).toBe(0)
    expect(result.line21.amount).toBe(0)
    expect(result.capitalLossCarryforward).toBe(0)
  })
})

// ── Cross-form consistency: Schedule D ↔ Form 8949 ─────────────

describe('cross-form: Schedule D ↔ Form 8949', () => {
  it('Line 1a = Form 8949 category A gain/loss total', () => {
    const result = computeScheduleD(mixedTradesReturn())
    const catA = getCategoryTotals(result.form8949, 'A')
    expect(result.line1a.amount).toBe(catA.totalGainLoss.amount)
  })

  it('Line 8a = Form 8949 category D gain/loss total', () => {
    const result = computeScheduleD(mixedTradesReturn())
    const catD = getCategoryTotals(result.form8949, 'D')
    expect(result.line8a.amount).toBe(catD.totalGainLoss.amount)
  })

  it('Line 7 = sum of all short-term categories', () => {
    const result = computeScheduleD(mixedTradesReturn())
    const catA = getCategoryTotals(result.form8949, 'A')
    const catB = getCategoryTotals(result.form8949, 'B')
    expect(result.line7.amount).toBe(catA.totalGainLoss.amount + catB.totalGainLoss.amount)
  })

  it('Line 16 = Line 7 + Line 15', () => {
    const result = computeScheduleD(mixedTradesReturn())
    expect(result.line16.amount).toBe(result.line7.amount + result.line15.amount)
  })
})

// ── IRS citations ──────────────────────────────────────────────

describe('Schedule D IRS citations', () => {
  it('all lines have correct citations', () => {
    const result = computeScheduleD(singleLTSaleReturn())

    expect(result.line1a.irsCitation).toBe('Schedule D, Line 1a')
    expect(result.line1b.irsCitation).toBe('Schedule D, Line 1b')
    expect(result.line7.irsCitation).toBe('Schedule D, Line 7')
    expect(result.line8a.irsCitation).toBe('Schedule D, Line 8a')
    expect(result.line8b.irsCitation).toBe('Schedule D, Line 8b')
    expect(result.line15.irsCitation).toBe('Schedule D, Line 15')
    expect(result.line16.irsCitation).toBe('Schedule D, Line 16')
    expect(result.line21.irsCitation).toBe('Schedule D, Line 21')
  })
})
