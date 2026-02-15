import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import { computeScheduleB, isScheduleBRequired } from '../../src/rules/2025/scheduleB'
import { computeLine2b, computeLine3b } from '../../src/rules/2025/form1040'
import { make1099INT, make1099DIV, w2WithInvestmentsReturn } from '../fixtures/returns'

// ── isScheduleBRequired — threshold tests ──────────────────────

describe('isScheduleBRequired', () => {
  it('not required when no interest or dividends', () => {
    expect(isScheduleBRequired(emptyTaxReturn(2025))).toBe(false)
  })

  it('not required: single interest source at $1,400', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase', box1: cents(1400) }),
      ],
    }
    expect(isScheduleBRequired(tr)).toBe(false)
  })

  it('not required: interest exactly at $1,500 threshold', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase', box1: cents(1500) }),
      ],
    }
    expect(isScheduleBRequired(tr)).toBe(false)
  })

  it('required: two interest sources at $800 each → $1,600', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase', box1: cents(800) }),
        make1099INT({ id: 'int-2', payerName: 'Ally', box1: cents(800) }),
      ],
    }
    expect(isScheduleBRequired(tr)).toBe(true)
  })

  it('required: interest at $1,500.01', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase', box1: cents(1500.01) }),
      ],
    }
    expect(isScheduleBRequired(tr)).toBe(true)
  })

  it('required: dividends exceed $1,500 even if interest does not', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase', box1: cents(500) }),
      ],
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Schwab', box1a: cents(2000) }),
      ],
    }
    expect(isScheduleBRequired(tr)).toBe(true)
  })

  it('not required: both interest and dividends under threshold', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase', box1: cents(1000) }),
      ],
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Schwab', box1a: cents(1200) }),
      ],
    }
    expect(isScheduleBRequired(tr)).toBe(false)
  })
})

// ── Part I — Interest ──────────────────────────────────────────

describe('Schedule B Part I — Interest', () => {
  it('lists each payer with name and amount', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase Bank', payerTin: '12-3456789', box1: cents(800) }),
        make1099INT({ id: 'int-2', payerName: 'Ally Bank', payerTin: '98-7654321', box1: cents(900) }),
      ],
    }
    const result = computeScheduleB(tr)

    expect(result.interestItems).toHaveLength(2)
    expect(result.interestItems[0]).toEqual({
      payerName: 'Chase Bank',
      payerTin: '12-3456789',
      amount: cents(800),
      sourceDocumentId: 'int-1',
    })
    expect(result.interestItems[1]).toEqual({
      payerName: 'Ally Bank',
      payerTin: '98-7654321',
      amount: cents(900),
      sourceDocumentId: 'int-2',
    })
  })

  it('Line 4 = total of all interest', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase', box1: cents(800) }),
        make1099INT({ id: 'int-2', payerName: 'Ally', box1: cents(900) }),
        make1099INT({ id: 'int-3', payerName: 'Marcus', box1: cents(300) }),
      ],
    }
    const result = computeScheduleB(tr)

    expect(result.line4.amount).toBe(cents(2000))
    expect(result.interestItems).toHaveLength(3)
  })

  it('Line 4 = $0 when no interest forms', () => {
    const result = computeScheduleB(emptyTaxReturn(2025))
    expect(result.line4.amount).toBe(0)
    expect(result.interestItems).toHaveLength(0)
  })

  it('Line 4 has correct IRS citation', () => {
    const result = computeScheduleB(emptyTaxReturn(2025))
    expect(result.line4.irsCitation).toBe('Schedule B, Line 4')
  })

  it('Line 4 traces to each 1099-INT source', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Chase', box1: cents(500) }),
        make1099INT({ id: 'int-2', payerName: 'Ally', box1: cents(600) }),
      ],
    }
    const result = computeScheduleB(tr)
    if (result.line4.source.kind === 'computed') {
      expect(result.line4.source.inputs).toEqual([
        '1099int:int-1:box1',
        '1099int:int-2:box1',
      ])
    }
  })
})

// ── Part II — Ordinary Dividends ───────────────────────────────

describe('Schedule B Part II — Ordinary Dividends', () => {
  it('lists each payer with name and amount', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Schwab', payerTin: '11-1111111', box1a: cents(2000) }),
        make1099DIV({ id: 'div-2', payerName: 'Vanguard', payerTin: '22-2222222', box1a: cents(1500) }),
      ],
    }
    const result = computeScheduleB(tr)

    expect(result.dividendItems).toHaveLength(2)
    expect(result.dividendItems[0]).toEqual({
      payerName: 'Schwab',
      payerTin: '11-1111111',
      amount: cents(2000),
      sourceDocumentId: 'div-1',
    })
    expect(result.dividendItems[1]).toEqual({
      payerName: 'Vanguard',
      payerTin: '22-2222222',
      amount: cents(1500),
      sourceDocumentId: 'div-2',
    })
  })

  it('Line 6 = total of all ordinary dividends', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Schwab', box1a: cents(2000) }),
        make1099DIV({ id: 'div-2', payerName: 'Vanguard', box1a: cents(1500) }),
      ],
    }
    const result = computeScheduleB(tr)
    expect(result.line6.amount).toBe(cents(3500))
  })

  it('Line 6 = $0 when no dividend forms', () => {
    const result = computeScheduleB(emptyTaxReturn(2025))
    expect(result.line6.amount).toBe(0)
    expect(result.dividendItems).toHaveLength(0)
  })

  it('Line 6 has correct IRS citation', () => {
    const result = computeScheduleB(emptyTaxReturn(2025))
    expect(result.line6.irsCitation).toBe('Schedule B, Line 6')
  })

  it('uses Box 1a (ordinary), not Box 1b (qualified)', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({
          id: 'div-1',
          payerName: 'Schwab',
          box1a: cents(3000),   // ordinary (includes qualified)
          box1b: cents(1500),   // qualified subset — should NOT be used
        }),
      ],
    }
    const result = computeScheduleB(tr)
    expect(result.line6.amount).toBe(cents(3000))
    expect(result.dividendItems[0].amount).toBe(cents(3000))
  })
})

// ── Cross-form consistency: Schedule B ↔ Form 1040 ─────────────

describe('cross-form: Schedule B ↔ Form 1040', () => {
  it('Schedule B Line 4 = Form 1040 Line 2b', () => {
    const tr = w2WithInvestmentsReturn()
    const schB = computeScheduleB(tr)
    const line2b = computeLine2b(tr)

    expect(schB.line4.amount).toBe(line2b.amount)
  })

  it('Schedule B Line 6 = Form 1040 Line 3b', () => {
    const tr = w2WithInvestmentsReturn()
    const schB = computeScheduleB(tr)
    const line3b = computeLine3b(tr)

    expect(schB.line6.amount).toBe(line3b.amount)
  })

  it('consistency holds with multiple payers', () => {
    const tr = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'A', box1: cents(100) }),
        make1099INT({ id: 'int-2', payerName: 'B', box1: cents(200) }),
        make1099INT({ id: 'int-3', payerName: 'C', box1: cents(300) }),
      ],
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'X', box1a: cents(400) }),
        make1099DIV({ id: 'div-2', payerName: 'Y', box1a: cents(500) }),
      ],
    }

    const schB = computeScheduleB(tr)
    const line2b = computeLine2b(tr)
    const line3b = computeLine3b(tr)

    expect(schB.line4.amount).toBe(line2b.amount)
    expect(schB.line6.amount).toBe(line3b.amount)
    expect(schB.line4.amount).toBe(cents(600))
    expect(schB.line6.amount).toBe(cents(900))
  })

  it('consistency holds with zero documents', () => {
    const tr = emptyTaxReturn(2025)
    const schB = computeScheduleB(tr)
    const line2b = computeLine2b(tr)
    const line3b = computeLine3b(tr)

    expect(schB.line4.amount).toBe(line2b.amount)
    expect(schB.line6.amount).toBe(line3b.amount)
    expect(schB.line4.amount).toBe(0)
    expect(schB.line6.amount).toBe(0)
  })
})
