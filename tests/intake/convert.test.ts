import { describe, it, expect } from 'vitest'
import { convertToCapitalTransactions } from '../../src/intake/csv/convert'
import type { Form1099B } from '../../src/model/types'

function makeForm1099B(overrides: Partial<Form1099B> = {}): Form1099B {
  return {
    id: 'test-1',
    brokerName: 'Robinhood',
    description: 'AAPL',
    dateAcquired: '2025-01-15',
    dateSold: '2025-06-10',
    proceeds: 650000,
    costBasis: 500000,
    washSaleLossDisallowed: 0,
    gainLoss: 150000,
    basisReportedToIrs: true,
    longTerm: false,
    noncoveredSecurity: false,
    federalTaxWithheld: 0,
    ...overrides,
  }
}

describe('convertToCapitalTransactions', () => {
  it('converts a short-term basis-reported transaction to category A', () => {
    const txns = convertToCapitalTransactions([makeForm1099B()])
    expect(txns).toHaveLength(1)
    expect(txns[0].category).toBe('A')
    expect(txns[0].longTerm).toBe(false)
    expect(txns[0].proceeds).toBe(650000)
    expect(txns[0].reportedBasis).toBe(500000)
    expect(txns[0].adjustedBasis).toBe(500000)
    expect(txns[0].adjustmentCode).toBeNull()
    expect(txns[0].gainLoss).toBe(150000)
  })

  it('converts a short-term non-covered transaction to category B', () => {
    const txns = convertToCapitalTransactions([
      makeForm1099B({ basisReportedToIrs: false, noncoveredSecurity: true }),
    ])
    expect(txns[0].category).toBe('B')
  })

  it('converts a long-term basis-reported transaction to category D', () => {
    const txns = convertToCapitalTransactions([
      makeForm1099B({ longTerm: true }),
    ])
    expect(txns[0].category).toBe('D')
    expect(txns[0].longTerm).toBe(true)
  })

  it('converts a long-term non-covered transaction to category E', () => {
    const txns = convertToCapitalTransactions([
      makeForm1099B({ longTerm: true, basisReportedToIrs: false, noncoveredSecurity: true }),
    ])
    expect(txns[0].category).toBe('E')
  })

  it('sets adjustmentCode to B when cost basis is null', () => {
    const txns = convertToCapitalTransactions([
      makeForm1099B({ costBasis: null }),
    ])
    expect(txns[0].adjustmentCode).toBe('B')
    expect(txns[0].reportedBasis).toBe(0)
    expect(txns[0].adjustedBasis).toBe(0)
  })

  it('preserves wash sale loss disallowed', () => {
    const txns = convertToCapitalTransactions([
      makeForm1099B({ washSaleLossDisallowed: 70000 }),
    ])
    expect(txns[0].washSaleLossDisallowed).toBe(70000)
  })

  it('assigns sequential IDs', () => {
    const txns = convertToCapitalTransactions([
      makeForm1099B({ id: 'a' }),
      makeForm1099B({ id: 'b' }),
      makeForm1099B({ id: 'c' }),
    ])
    expect(txns.map((t) => t.id)).toEqual(['csv-0', 'csv-1', 'csv-2'])
  })

  it('links back to source 1099B id', () => {
    const txns = convertToCapitalTransactions([makeForm1099B({ id: 'rh-5' })])
    expect(txns[0].source1099BId).toBe('rh-5')
  })

  it('handles null longTerm by defaulting to false (short-term)', () => {
    const txns = convertToCapitalTransactions([
      makeForm1099B({ longTerm: null, basisReportedToIrs: true }),
    ])
    expect(txns[0].longTerm).toBe(false)
    expect(txns[0].category).toBe('A')
  })

  it('converts empty array', () => {
    expect(convertToCapitalTransactions([])).toEqual([])
  })
})
