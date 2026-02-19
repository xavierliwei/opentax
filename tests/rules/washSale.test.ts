import { describe, it, expect } from 'vitest'
import { detectWashSales } from '../../src/rules/2025/washSale'
import type { CapitalTransaction } from '../../src/model/types'
import { cents } from '../../src/model/traced'

function makeTx(overrides: Partial<CapitalTransaction>): CapitalTransaction {
  return {
    id: 'tx-1',
    description: 'AAPL',
    dateAcquired: '2025-01-01',
    dateSold: '2025-06-15',
    proceeds: cents(1000),
    reportedBasis: cents(1500),
    adjustedBasis: cents(1500),
    adjustmentCode: null,
    adjustmentAmount: 0,
    gainLoss: cents(-500),
    washSaleLossDisallowed: 0,
    longTerm: false,
    category: 'A',
    source1099BId: 'src-1',
    ...overrides,
  }
}

describe('detectWashSales', () => {
  it('detects wash sale within 30-day window (replacement after sale)', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-06-20', dateSold: '2025-12-01', gainLoss: cents(300), proceeds: cents(1800), reportedBasis: cents(1500), adjustedBasis: cents(1500) }),
    ]
    const result = detectWashSales(transactions)

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].lossSaleId).toBe('1')
    expect(result.matches[0].replacementId).toBe('2')
    expect(result.matches[0].disallowedLoss).toBe(cents(500))
    expect(result.matches[0].symbol).toBe('AAPL')
  })

  it('detects wash sale within 30-day window (replacement before sale)', () => {
    const transactions = [
      makeTx({ id: '1', description: 'MSFT', dateAcquired: '2025-05-20', dateSold: '2025-12-01', gainLoss: cents(200), proceeds: cents(2000), reportedBasis: cents(1800), adjustedBasis: cents(1800) }),
      makeTx({ id: '2', description: 'MSFT', dateSold: '2025-06-15', gainLoss: cents(-700) }),
    ]
    const result = detectWashSales(transactions)

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].lossSaleId).toBe('2')
    expect(result.matches[0].replacementId).toBe('1')
  })

  it('does not detect wash sale outside 30-day window', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-07-20', dateSold: '2025-12-01', gainLoss: cents(300) }),
    ]
    const result = detectWashSales(transactions)
    expect(result.matches).toHaveLength(0)
  })

  it('does not match different securities', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) }),
      makeTx({ id: '2', description: 'MSFT', dateAcquired: '2025-06-20', dateSold: '2025-12-01', gainLoss: cents(300) }),
    ]
    const result = detectWashSales(transactions)
    expect(result.matches).toHaveLength(0)
  })

  it('does not flag gains as wash sales', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(500) }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-06-20', dateSold: '2025-12-01', gainLoss: cents(300) }),
    ]
    const result = detectWashSales(transactions)
    expect(result.matches).toHaveLength(0)
  })

  it('adjusts loss sale: sets code W and zeroes gainLoss', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-06-20', dateSold: '2025-12-01', gainLoss: cents(300), proceeds: cents(1800), adjustedBasis: cents(1500) }),
    ]
    const result = detectWashSales(transactions)
    const lossTx = result.adjustedTransactions.find((t) => t.id === '1')!

    expect(lossTx.adjustmentCode).toBe('W')
    expect(lossTx.washSaleLossDisallowed).toBe(cents(500))
    expect(lossTx.adjustmentAmount).toBe(cents(500))
    expect(lossTx.gainLoss).toBe(0)
  })

  it('adds disallowed loss to replacement basis', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-06-20', dateSold: '2025-12-01', proceeds: cents(1800), adjustedBasis: cents(1500), gainLoss: cents(300) }),
    ]
    const result = detectWashSales(transactions)
    const repTx = result.adjustedTransactions.find((t) => t.id === '2')!

    expect(repTx.adjustedBasis).toBe(cents(1500) + cents(500))
    expect(repTx.gainLoss).toBe(cents(1800) - (cents(1500) + cents(500)))
  })

  it('skips transactions already flagged with code W', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500), adjustmentCode: 'W' }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-06-20', dateSold: '2025-12-01', gainLoss: cents(300) }),
    ]
    const result = detectWashSales(transactions)
    expect(result.matches).toHaveLength(0)
  })

  it('handles multiple wash sales', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-06-20', dateSold: '2025-12-01', proceeds: cents(1800), adjustedBasis: cents(1500), gainLoss: cents(300) }),
      makeTx({ id: '3', description: 'MSFT', dateSold: '2025-07-10', gainLoss: cents(-200) }),
      makeTx({ id: '4', description: 'MSFT', dateAcquired: '2025-07-15', dateSold: '2025-12-01', proceeds: cents(1000), adjustedBasis: cents(800), gainLoss: cents(200) }),
    ]
    const result = detectWashSales(transactions)

    expect(result.matches).toHaveLength(2)
    expect(result.matches[0].symbol).toBe('AAPL')
    expect(result.matches[1].symbol).toBe('MSFT')
  })

  it('picks earliest replacement when multiple exist', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-06-25', dateSold: '2025-12-01', gainLoss: cents(100) }),
      makeTx({ id: '3', description: 'AAPL', dateAcquired: '2025-06-20', dateSold: '2025-12-01', gainLoss: cents(200) }),
    ]
    const result = detectWashSales(transactions)

    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].replacementId).toBe('3') // 06/20 is earlier than 06/25
  })

  it('returns empty matches for empty input', () => {
    const result = detectWashSales([])
    expect(result.matches).toHaveLength(0)
    expect(result.adjustedTransactions).toHaveLength(0)
  })

  it('does not mutate original transactions', () => {
    const original = makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) })
    const replacement = makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-06-20', dateSold: '2025-12-01', gainLoss: cents(300) })
    const transactions = [original, replacement]

    detectWashSales(transactions)

    // Originals should be untouched
    expect(original.adjustmentCode).toBeNull()
    expect(original.gainLoss).toBe(cents(-500))
    expect(replacement.adjustedBasis).toBe(cents(1500))
  })

  it('handles replacement with null dateAcquired (Various)', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: null, dateSold: '2025-12-01', gainLoss: cents(300) }),
    ]
    const result = detectWashSales(transactions)
    // Cannot determine if within window when dateAcquired is null
    expect(result.matches).toHaveLength(0)
  })

  it('matches case-insensitively on description', () => {
    const transactions = [
      makeTx({ id: '1', description: 'aapl', dateSold: '2025-06-15', gainLoss: cents(-500) }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-06-20', dateSold: '2025-12-01', gainLoss: cents(300) }),
    ]
    const result = detectWashSales(transactions)
    expect(result.matches).toHaveLength(1)
  })

  it('detects wash sale at exact 30-day boundary', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-07-15', dateSold: '2025-12-01', gainLoss: cents(300) }),
    ]
    const result = detectWashSales(transactions)
    expect(result.matches).toHaveLength(1)
  })

  it('does not detect wash sale at 31 days', () => {
    const transactions = [
      makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) }),
      makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-07-16', dateSold: '2025-12-01', gainLoss: cents(300) }),
    ]
    const result = detectWashSales(transactions)
    expect(result.matches).toHaveLength(0)
  })
})
