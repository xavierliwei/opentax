import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock idb — IndexedDB is not available in the node test environment
const fakeStore = new Map<string, unknown>()
vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve({
    get: vi.fn((_, key: string) => Promise.resolve(fakeStore.get(key))),
    put: vi.fn((_, value: unknown, key: string) => { fakeStore.set(key, value); return Promise.resolve() }),
    delete: vi.fn((_, key: string) => { fakeStore.delete(key); return Promise.resolve() }),
  })),
}))

// Import store after mock is in place
const { useTaxStore } = await import('../../src/store/taxStore.ts')

import { emptyTaxReturn } from '../../src/model/types.ts'
import type { W2, Form1099INT, Form1099DIV, CapitalTransaction } from '../../src/model/types.ts'
import { cents } from '../../src/model/traced.ts'
import { STANDARD_DEDUCTION } from '../../src/rules/2025/constants.ts'

// Reset store before each test (ignores any persistence)
beforeEach(() => {
  useTaxStore.setState({
    taxReturn: emptyTaxReturn(2025),
    computeResult: useTaxStore.getState().computeResult,
  })
  // Re-trigger compute with clean state
  useTaxStore.getState().resetReturn()
})

function getState() {
  return useTaxStore.getState()
}

// ── Test helpers ────────────────────────────────────────────────

function makeW2(overrides: Partial<W2> = {}): W2 {
  return {
    id: 'w2-1',
    employerEin: '12-3456789',
    employerName: 'Acme Corp',
    box1: cents(50000),
    box2: cents(8000),
    box3: cents(50000),
    box4: cents(3100),
    box5: cents(50000),
    box6: cents(725),
    box7: 0,
    box8: 0,
    box10: 0,
    box11: 0,
    box12: [],
    box13StatutoryEmployee: false,
    box13RetirementPlan: false,
    box13ThirdPartySickPay: false,
    box14: '',
    ...overrides,
  }
}

function make1099INT(overrides: Partial<Form1099INT> = {}): Form1099INT {
  return {
    id: '1099int-1',
    payerName: 'First Bank',
    box1: cents(1200),
    box2: 0,
    box3: 0,
    box4: 0,
    box8: 0,
    ...overrides,
  }
}

function make1099DIV(overrides: Partial<Form1099DIV> = {}): Form1099DIV {
  return {
    id: '1099div-1',
    payerName: 'Vanguard',
    box1a: cents(3000),
    box1b: cents(2000),
    box2a: cents(500),
    box3: 0,
    box4: 0,
    box5: 0,
    box11: 0,
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────

describe('taxStore', () => {
  it('initial state matches emptyTaxReturn(2025) with valid computeResult', () => {
    const { taxReturn, computeResult } = getState()
    expect(taxReturn.taxYear).toBe(2025)
    expect(taxReturn.filingStatus).toBe('single')
    expect(taxReturn.w2s).toEqual([])
    expect(taxReturn.form1099INTs).toEqual([])
    expect(taxReturn.form1099DIVs).toEqual([])
    expect(computeResult).toBeDefined()
    expect(computeResult.form1040).toBeDefined()
    expect(computeResult.form1040.line1a.amount).toBe(0)
  })

  it('setFilingStatus changes filing status and recomputes standard deduction', () => {
    getState().setFilingStatus('mfj')
    const { taxReturn, computeResult } = getState()
    expect(taxReturn.filingStatus).toBe('mfj')
    // Standard deduction for MFJ = $30,000
    expect(computeResult.form1040.line12.amount).toBe(STANDARD_DEDUCTION['mfj'])
  })

  it('addW2 adds a W-2 and recomputes line1a (wages) and line25 (withheld)', () => {
    const w2 = makeW2()
    getState().addW2(w2)
    const { taxReturn, computeResult } = getState()
    expect(taxReturn.w2s).toHaveLength(1)
    expect(taxReturn.w2s[0].id).toBe('w2-1')
    expect(computeResult.form1040.line1a.amount).toBe(cents(50000))
    expect(computeResult.form1040.line25.amount).toBe(cents(8000))
  })

  it('updateW2 modifies an existing W-2 and recomputes', () => {
    getState().addW2(makeW2())
    getState().updateW2('w2-1', { box1: cents(75000), box2: cents(12000) })
    const { taxReturn, computeResult } = getState()
    expect(taxReturn.w2s[0].box1).toBe(cents(75000))
    expect(computeResult.form1040.line1a.amount).toBe(cents(75000))
    expect(computeResult.form1040.line25.amount).toBe(cents(12000))
  })

  it('removeW2 removes the W-2 and wages go back to 0', () => {
    getState().addW2(makeW2())
    expect(getState().taxReturn.w2s).toHaveLength(1)
    getState().removeW2('w2-1')
    const { taxReturn, computeResult } = getState()
    expect(taxReturn.w2s).toHaveLength(0)
    expect(computeResult.form1040.line1a.amount).toBe(0)
    expect(computeResult.form1040.line25.amount).toBe(0)
  })

  it('addForm1099INT adds interest and recomputes line2b', () => {
    getState().addForm1099INT(make1099INT())
    const { taxReturn, computeResult } = getState()
    expect(taxReturn.form1099INTs).toHaveLength(1)
    expect(computeResult.form1040.line2b.amount).toBe(cents(1200))
  })

  it('addForm1099DIV adds dividends and recomputes line3a/3b', () => {
    getState().addForm1099DIV(make1099DIV())
    const { taxReturn, computeResult } = getState()
    expect(taxReturn.form1099DIVs).toHaveLength(1)
    expect(computeResult.form1040.line3a.amount).toBe(cents(2000))
    expect(computeResult.form1040.line3b.amount).toBe(cents(3000))
  })

  it('setCapitalTransactions sets transactions and recomputes line7', () => {
    const txn: CapitalTransaction = {
      id: 'tx-1',
      description: 'AAPL',
      dateAcquired: '2024-01-15',
      dateSold: '2025-06-20',
      proceeds: cents(15000),
      reportedBasis: cents(10000),
      adjustedBasis: cents(10000),
      adjustmentCode: null,
      adjustmentAmount: 0,
      gainLoss: cents(5000),
      washSaleLossDisallowed: 0,
      longTerm: true,
      category: 'D',
      source1099BId: 'b-1',
    }
    getState().setCapitalTransactions([txn])
    const { taxReturn, computeResult } = getState()
    expect(taxReturn.capitalTransactions).toHaveLength(1)
    expect(computeResult.form1040.line7.amount).toBe(cents(5000))
  })

  it('setDeductionMethod toggles standard/itemized and recomputes line12', () => {
    // Start with standard
    expect(getState().taxReturn.deductions.method).toBe('standard')
    expect(getState().computeResult.form1040.line12.amount).toBe(STANDARD_DEDUCTION['single'])

    // Switch to itemized — without itemized data object, engine falls back to standard
    getState().setDeductionMethod('itemized')
    expect(getState().taxReturn.deductions.method).toBe('itemized')
    expect(getState().computeResult.form1040.line12.amount).toBe(STANDARD_DEDUCTION['single'])

    // Switch back to standard explicitly
    getState().setDeductionMethod('standard')
    expect(getState().taxReturn.deductions.method).toBe('standard')
    expect(getState().computeResult.form1040.line12.amount).toBe(STANDARD_DEDUCTION['single'])
  })

  it('importReturn imports a full TaxReturn and recomputes', () => {
    const tr = emptyTaxReturn(2025)
    tr.filingStatus = 'hoh'
    tr.w2s = [makeW2({ id: 'imported-w2', box1: cents(80000), box2: cents(15000) })]
    getState().importReturn(tr)
    const { taxReturn, computeResult } = getState()
    expect(taxReturn.filingStatus).toBe('hoh')
    expect(taxReturn.w2s).toHaveLength(1)
    expect(computeResult.form1040.line1a.amount).toBe(cents(80000))
    expect(computeResult.form1040.line25.amount).toBe(cents(15000))
    expect(computeResult.form1040.line12.amount).toBe(STANDARD_DEDUCTION['hoh'])
  })

  it('resetReturn resets to empty and all values go to zero', () => {
    // Add some data first
    getState().addW2(makeW2())
    getState().addForm1099INT(make1099INT())
    expect(getState().taxReturn.w2s).toHaveLength(1)

    // Reset
    getState().resetReturn()
    const { taxReturn, computeResult } = getState()
    expect(taxReturn.w2s).toHaveLength(0)
    expect(taxReturn.form1099INTs).toHaveLength(0)
    expect(taxReturn.filingStatus).toBe('single')
    expect(computeResult.form1040.line1a.amount).toBe(0)
    expect(computeResult.form1040.line2b.amount).toBe(0)
    expect(computeResult.form1040.line25.amount).toBe(0)
  })
})
