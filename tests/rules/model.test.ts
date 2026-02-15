import { describe, it, expect } from 'vitest'
import {
  cents,
  dollars,
  tracedFromDocument,
  tracedFromComputation,
  tracedZero,
} from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn, W2 } from '../../src/model/types'

// ── cents() / dollars() ────────────────────────────────────────

describe('cents()', () => {
  it('converts whole dollars', () => {
    expect(cents(100)).toBe(10000)
  })

  it('converts dollars and cents', () => {
    expect(cents(100.10)).toBe(10010)
  })

  it('converts zero', () => {
    expect(cents(0)).toBe(0)
  })

  it('converts negative amounts', () => {
    expect(cents(-50.50)).toBe(-5050)
  })

  it('rounds to nearest cent (avoids float imprecision)', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
    expect(cents(0.1 + 0.2)).toBe(30)
  })

  it('handles large amounts', () => {
    expect(cents(999999.99)).toBe(99999999)
  })

  it('always produces an integer', () => {
    const testValues = [0.01, 0.10, 1.23, 99.99, 1234.56, 0.005]
    for (const v of testValues) {
      expect(Number.isInteger(cents(v))).toBe(true)
    }
  })
})

describe('dollars()', () => {
  it('converts cents to dollars', () => {
    expect(dollars(10010)).toBe(100.10)
  })

  it('converts zero', () => {
    expect(dollars(0)).toBe(0)
  })

  it('converts negative', () => {
    expect(dollars(-5050)).toBe(-50.50)
  })
})

describe('cents/dollars round-trip', () => {
  it('round-trips cleanly for 2-decimal values', () => {
    const values = [0, 0.01, 1.00, 99.99, 100.10, 1234.56, -500.25]
    for (const v of values) {
      expect(dollars(cents(v))).toBe(v)
    }
  })
})

// ── TracedValue factories ──────────────────────────────────────

describe('tracedFromDocument()', () => {
  it('creates a traced value with document source', () => {
    const tv = tracedFromDocument(7500000, 'W-2', 'w2-1', 'Box 1', 'Form 1040, Line 1a')

    expect(tv.amount).toBe(7500000)
    expect(tv.confidence).toBe(1.0)
    expect(tv.irsCitation).toBe('Form 1040, Line 1a')
    expect(tv.source.kind).toBe('document')
    if (tv.source.kind === 'document') {
      expect(tv.source.documentType).toBe('W-2')
      expect(tv.source.documentId).toBe('w2-1')
      expect(tv.source.field).toBe('Box 1')
    }
  })
})

describe('tracedFromComputation()', () => {
  it('creates a traced value with computed source', () => {
    const tv = tracedFromComputation(10000000, 'form1040.line9', ['line1a', 'line2b', 'line3b'])

    expect(tv.amount).toBe(10000000)
    expect(tv.source.kind).toBe('computed')
    if (tv.source.kind === 'computed') {
      expect(tv.source.nodeId).toBe('form1040.line9')
      expect(tv.source.inputs).toEqual(['line1a', 'line2b', 'line3b'])
    }
  })
})

describe('tracedZero()', () => {
  it('creates a zero-value traced value', () => {
    const tv = tracedZero('form1040.line8', 'Form 1040, Line 8')

    expect(tv.amount).toBe(0)
    expect(tv.source.kind).toBe('computed')
    expect(tv.irsCitation).toBe('Form 1040, Line 8')
  })
})

// ── emptyTaxReturn() ──────────────────────────────────────────

describe('emptyTaxReturn()', () => {
  it('creates a return for the given tax year', () => {
    const tr = emptyTaxReturn(2025)
    expect(tr.taxYear).toBe(2025)
  })

  it('defaults to single filing status', () => {
    const tr = emptyTaxReturn(2025)
    expect(tr.filingStatus).toBe('single')
  })

  it('defaults to standard deduction', () => {
    const tr = emptyTaxReturn(2025)
    expect(tr.deductions.method).toBe('standard')
  })

  it('starts with empty arrays for all document collections', () => {
    const tr = emptyTaxReturn(2025)
    expect(tr.w2s).toEqual([])
    expect(tr.form1099Bs).toEqual([])
    expect(tr.form1099INTs).toEqual([])
    expect(tr.form1099DIVs).toEqual([])
    expect(tr.rsuVestEvents).toEqual([])
    expect(tr.capitalTransactions).toEqual([])
    expect(tr.adjustments).toEqual([])
    expect(tr.credits).toEqual([])
    expect(tr.dependents).toEqual([])
  })

  it('has a taxpayer with empty strings (to be filled in)', () => {
    const tr = emptyTaxReturn(2025)
    expect(tr.taxpayer.firstName).toBe('')
    expect(tr.taxpayer.lastName).toBe('')
    expect(tr.taxpayer.ssn).toBe('')
    expect(tr.taxpayer.address.street).toBe('')
  })
})

// ── Type-level checks (compile = pass) ─────────────────────────

describe('type compatibility', () => {
  it('W2 satisfies the interface with all required fields', () => {
    const w2: W2 = {
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Acme Corp',
      box1: cents(75000),
      box2: cents(8000),
      box3: cents(75000),
      box4: cents(4650),
      box5: cents(75000),
      box6: cents(1087.50),
      box7: 0,
      box8: 0,
      box10: 0,
      box11: 0,
      box12: [{ code: 'D', amount: cents(5000) }],
      box13StatutoryEmployee: false,
      box13RetirementPlan: true,
      box13ThirdPartySickPay: false,
      box14: '',
    }
    expect(w2.id).toBe('w2-1')
    expect(w2.box1).toBe(cents(75000))
  })

  it('TaxReturn can hold mixed document types', () => {
    const tr = emptyTaxReturn(2025)

    // Add a W-2
    const w2: W2 = {
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Acme Corp',
      box1: cents(120000),
      box2: cents(20000),
      box3: cents(120000),
      box4: cents(7440),
      box5: cents(120000),
      box6: cents(1740),
      box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [],
      box13StatutoryEmployee: false,
      box13RetirementPlan: false,
      box13ThirdPartySickPay: false,
      box14: '',
    }

    const updated: TaxReturn = {
      ...tr,
      taxpayer: {
        firstName: 'Wei',
        lastName: 'Li',
        ssn: '123456789',
        address: { street: '123 Main St', city: 'San Francisco', state: 'CA', zip: '94105' },
      },
      w2s: [w2],
      form1099INTs: [{
        id: 'int-1',
        payerName: 'Chase Bank',
        box1: cents(250),
        box2: 0, box3: 0, box4: 0, box8: 0,
      }],
    }

    expect(updated.w2s).toHaveLength(1)
    expect(updated.form1099INTs).toHaveLength(1)
    expect(updated.taxpayer.firstName).toBe('Wei')
  })
})
