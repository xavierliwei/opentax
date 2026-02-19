import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import {
  computeLine1a,
  computeLine2a,
  computeLine2b,
  computeLine3a,
  computeLine3b,
  computeLine7,
  computeLine8,
  computeLine9,
} from '../../src/rules/2025/form1040'
import {
  simpleW2Return,
  twoW2Return,
  w2WithInvestmentsReturn,
  make1099INT,
  make1099DIV,
} from '../fixtures/returns'
import type { TracedValue } from '../../src/model/traced'

// ── Line 1a — Wages ────────────────────────────────────────────

describe('computeLine1a (Wages)', () => {
  it('sums a single W-2 Box 1', () => {
    const result = computeLine1a(simpleW2Return())
    expect(result.amount).toBe(cents(75000))
  })

  it('sums two W-2s', () => {
    const result = computeLine1a(twoW2Return())
    expect(result.amount).toBe(cents(60000) + cents(40000))
    expect(result.amount).toBe(cents(100000))
  })

  it('returns $0 when no W-2s', () => {
    const result = computeLine1a(emptyTaxReturn(2025))
    expect(result.amount).toBe(0)
  })

  it('has correct IRS citation', () => {
    const result = computeLine1a(simpleW2Return())
    expect(result.irsCitation).toBe('Form 1040, Line 1a')
  })

  it('traces to each W-2 source', () => {
    const result = computeLine1a(twoW2Return())
    expect(result.source.kind).toBe('computed')
    if (result.source.kind === 'computed') {
      expect(result.source.inputs).toEqual(['w2:w2-1:box1', 'w2:w2-2:box1'])
    }
  })

  it('has confidence 1.0', () => {
    const result = computeLine1a(simpleW2Return())
    expect(result.confidence).toBe(1.0)
  })
})

// ── Line 2a — Tax-exempt interest ──────────────────────────────

describe('computeLine2a (Tax-exempt interest)', () => {
  it('returns $0 when no 1099-INTs', () => {
    const result = computeLine2a(emptyTaxReturn(2025))
    expect(result.amount).toBe(0)
  })

  it('sums 1099-INT Box 8 (tax-exempt interest)', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Muni Fund', box1: 0, box8: cents(500) }),
        make1099INT({ id: 'int-2', payerName: 'State Bond', box1: 0, box8: cents(300) }),
      ],
    }
    const result = computeLine2a(tr)
    expect(result.amount).toBe(cents(800))
  })

  it('has correct IRS citation', () => {
    const result = computeLine2a(emptyTaxReturn(2025))
    expect(result.irsCitation).toBe('Form 1040, Line 2a')
  })
})

// ── Line 2b — Taxable interest ─────────────────────────────────

describe('computeLine2b (Taxable interest)', () => {
  it('returns $0 when no 1099-INTs', () => {
    const result = computeLine2b(emptyTaxReturn(2025))
    expect(result.amount).toBe(0)
  })

  it('sums a single 1099-INT Box 1', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase', box1: cents(2500) }),
      ],
    }
    const result = computeLine2b(tr)
    expect(result.amount).toBe(cents(2500))
  })

  it('sums multiple 1099-INTs', () => {
    const result = computeLine2b(w2WithInvestmentsReturn())
    expect(result.amount).toBe(cents(2500) + cents(800))
    expect(result.amount).toBe(cents(3300))
  })

  it('traces to each 1099-INT source', () => {
    const result = computeLine2b(w2WithInvestmentsReturn())
    if (result.source.kind === 'computed') {
      expect(result.source.inputs).toEqual(['1099int:int-1:box1', '1099int:int-2:box1'])
    }
  })

  it('handles 1099-INT with $0 interest', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase', box1: 0 }),
      ],
    }
    const result = computeLine2b(tr)
    expect(result.amount).toBe(0)
  })
})

// ── Line 3a — Qualified dividends ──────────────────────────────

describe('computeLine3a (Qualified dividends)', () => {
  it('returns $0 when no 1099-DIVs', () => {
    const result = computeLine3a(emptyTaxReturn(2025))
    expect(result.amount).toBe(0)
  })

  it('sums 1099-DIV Box 1b', () => {
    const result = computeLine3a(w2WithInvestmentsReturn())
    expect(result.amount).toBe(cents(1500))
  })

  it('sums multiple 1099-DIVs', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Schwab', box1a: cents(2000), box1b: cents(1000) }),
        make1099DIV({ id: 'div-2', payerName: 'Vanguard', box1a: cents(1500), box1b: cents(750) }),
      ],
    }
    const result = computeLine3a(tr)
    expect(result.amount).toBe(cents(1750))
  })

  it('has correct IRS citation', () => {
    const result = computeLine3a(emptyTaxReturn(2025))
    expect(result.irsCitation).toBe('Form 1040, Line 3a')
  })
})

// ── Line 3b — Ordinary dividends ───────────────────────────────

describe('computeLine3b (Ordinary dividends)', () => {
  it('returns $0 when no 1099-DIVs', () => {
    const result = computeLine3b(emptyTaxReturn(2025))
    expect(result.amount).toBe(0)
  })

  it('sums 1099-DIV Box 1a', () => {
    const result = computeLine3b(w2WithInvestmentsReturn())
    expect(result.amount).toBe(cents(3000))
  })

  it('sums multiple 1099-DIVs', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Schwab', box1a: cents(2000) }),
        make1099DIV({ id: 'div-2', payerName: 'Vanguard', box1a: cents(1500) }),
      ],
    }
    const result = computeLine3b(tr)
    expect(result.amount).toBe(cents(3500))
  })

  it('traces to each 1099-DIV source', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Schwab', box1a: cents(2000) }),
        make1099DIV({ id: 'div-2', payerName: 'Vanguard', box1a: cents(1500) }),
      ],
    }
    const result = computeLine3b(tr)
    if (result.source.kind === 'computed') {
      expect(result.source.inputs).toEqual(['1099div:div-1:box1a', '1099div:div-2:box1a'])
    }
  })
})

// ── Line 7 — Capital gain/loss ─────────────────────────────────

describe('computeLine7 (Capital gain/loss)', () => {
  it('returns $0 when no Schedule D result provided', () => {
    const result = computeLine7()
    expect(result.amount).toBe(0)
    expect(result.irsCitation).toBe('Form 1040, Line 7')
  })

  it('passes through Schedule D result when provided', () => {
    const scheduleDResult: TracedValue = {
      amount: cents(23500),
      source: { kind: 'computed', nodeId: 'scheduleD.line21', inputs: [] },
      confidence: 1.0,
    }
    const result = computeLine7(scheduleDResult)
    expect(result.amount).toBe(cents(23500))
  })

  it('handles negative capital loss from Schedule D', () => {
    const scheduleDResult: TracedValue = {
      amount: cents(-3000),
      source: { kind: 'computed', nodeId: 'scheduleD.line21', inputs: [] },
      confidence: 1.0,
    }
    const result = computeLine7(scheduleDResult)
    expect(result.amount).toBe(cents(-3000))
  })
})

// ── Line 8 — Other income ──────────────────────────────────────

describe('computeLine8 (Other income)', () => {
  it('returns $0 when no Schedule 1', () => {
    const result = computeLine8()
    expect(result.amount).toBe(0)
    expect(result.irsCitation).toBe('Form 1040, Line 8')
  })
})

// ── Line 9 — Total income ─────────────────────────────────────

describe('computeLine9 (Total income)', () => {
  it('equals wages when only W-2 income', () => {
    const result = computeLine9(simpleW2Return())
    expect(result.amount).toBe(cents(75000))
  })

  it('sums wages from two W-2s', () => {
    const result = computeLine9(twoW2Return())
    expect(result.amount).toBe(cents(100000))
  })

  it('returns $0 for empty return', () => {
    const result = computeLine9(emptyTaxReturn(2025))
    expect(result.amount).toBe(0)
  })

  it('sums W-2 + interest + dividends', () => {
    // W-2: $90,000 + 1099-INT: $2,500 + $800 + 1099-DIV: $3,000 ordinary
    const result = computeLine9(w2WithInvestmentsReturn())
    expect(result.amount).toBe(cents(90000) + cents(3300) + cents(3000))
    expect(result.amount).toBe(cents(96300))
  })

  it('does NOT include qualified dividends (Line 3a) in total', () => {
    // Qualified dividends (1099-DIV Box 1b) are a subset of ordinary dividends (Box 1a).
    // Only Box 1a (ordinary) goes into total income via Line 3b.
    // Box 1b is informational for the QDCG worksheet.
    const tr = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({
          id: 'div-1',
          payerName: 'Schwab',
          box1a: cents(3000),  // ordinary (includes qualified)
          box1b: cents(1500),  // qualified subset
        }),
      ],
    }
    const result = computeLine9(tr)
    // Should be $3,000 (ordinary), NOT $3,000 + $1,500
    expect(result.amount).toBe(cents(3000))
  })

  it('includes capital gain when Schedule D result provided', () => {
    const tr = simpleW2Return()
    const scheduleDResult: TracedValue = {
      amount: cents(10000),
      source: { kind: 'computed', nodeId: 'scheduleD.line21', inputs: [] },
      confidence: 1.0,
    }
    const result = computeLine9(tr, scheduleDResult)
    expect(result.amount).toBe(cents(75000) + cents(10000))
    expect(result.amount).toBe(cents(85000))
  })

  it('subtracts capital loss when Schedule D result is negative', () => {
    const tr = simpleW2Return()
    const scheduleDResult: TracedValue = {
      amount: cents(-3000),
      source: { kind: 'computed', nodeId: 'scheduleD.line21', inputs: [] },
      confidence: 1.0,
    }
    const result = computeLine9(tr, scheduleDResult)
    expect(result.amount).toBe(cents(75000) + cents(-3000))
    expect(result.amount).toBe(cents(72000))
  })

  it('has correct IRS citation', () => {
    const result = computeLine9(emptyTaxReturn(2025))
    expect(result.irsCitation).toBe('Form 1040, Line 9')
  })

  it('traces to all income line inputs', () => {
    const result = computeLine9(simpleW2Return())
    if (result.source.kind === 'computed') {
      expect(result.source.inputs).toEqual([
        'form1040.line1a',
        'form1040.line2b',
        'form1040.line3b',
        'form1040.line7',
        'form1040.line8',
      ])
    }
  })
})

// ── Cross-line consistency ─────────────────────────────────────

describe('cross-line consistency', () => {
  it('Line 9 = Line 1a + Line 2b + Line 3b + Line 7 + Line 8', () => {
    const tr = w2WithInvestmentsReturn()
    const line1a = computeLine1a(tr)
    const line2b = computeLine2b(tr)
    const line3b = computeLine3b(tr)
    const line7 = computeLine7()
    const line8 = computeLine8()
    const line9 = computeLine9(tr)

    expect(line9.amount).toBe(
      line1a.amount + line2b.amount + line3b.amount + line7.amount + line8.amount,
    )
  })

  it('Line 3a ≤ Line 3b (qualified ≤ ordinary dividends)', () => {
    const tr = w2WithInvestmentsReturn()
    const line3a = computeLine3a(tr)
    const line3b = computeLine3b(tr)
    expect(line3a.amount).toBeLessThanOrEqual(line3b.amount)
  })
})
