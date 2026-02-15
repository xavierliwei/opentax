import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCSV, parseCurrency, parseDate, parseTerm } from '../../src/intake/csv/utils'
import { RobinhoodParser } from '../../src/intake/csv/robinhood'
import type { Form1099B } from '../../src/model/types'

// ═══════════════════════════════════════════════════════════════
// CSV parser (RFC 4180)
// ═══════════════════════════════════════════════════════════════

describe('parseCSV()', () => {
  it('parses simple CSV', () => {
    const rows = parseCSV('a,b,c\n1,2,3\n')
    expect(rows).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('handles CRLF line endings', () => {
    const rows = parseCSV('a,b\r\n1,2\r\n')
    expect(rows).toEqual([['a', 'b'], ['1', '2']])
  })

  it('handles quoted fields with commas', () => {
    const rows = parseCSV('name,value\n"Smith, John","$1,234"\n')
    expect(rows).toEqual([['name', 'value'], ['Smith, John', '$1,234']])
  })

  it('handles escaped quotes inside quoted fields', () => {
    const rows = parseCSV('a\n"He said ""hello"""\n')
    expect(rows).toEqual([['a'], ['He said "hello"']])
  })

  it('handles newlines inside quoted fields', () => {
    const rows = parseCSV('a,b\n"line1\nline2",val\n')
    expect(rows).toEqual([['a', 'b'], ['line1\nline2', 'val']])
  })

  it('handles empty input', () => {
    expect(parseCSV('')).toEqual([])
  })

  it('handles single row without trailing newline', () => {
    const rows = parseCSV('a,b,c')
    expect(rows).toEqual([['a', 'b', 'c']])
  })

  it('handles empty fields', () => {
    const rows = parseCSV('a,,c\n,b,\n')
    expect(rows).toEqual([['a', '', 'c'], ['', 'b', '']])
  })

  it('handles trailing commas', () => {
    const rows = parseCSV('a,b,\n1,2,\n')
    expect(rows).toEqual([['a', 'b', ''], ['1', '2', '']])
  })
})

// ═══════════════════════════════════════════════════════════════
// parseCurrency()
// ═══════════════════════════════════════════════════════════════

describe('parseCurrency()', () => {
  it('parses standard dollar amount', () => {
    expect(parseCurrency('$1,234.56')).toBe(123456)
  })

  it('parses amount without dollar sign', () => {
    expect(parseCurrency('1234.56')).toBe(123456)
  })

  it('parses parenthesized negative', () => {
    expect(parseCurrency('($500.00)')).toBe(-50000)
  })

  it('parses minus-sign negative', () => {
    expect(parseCurrency('-$500.00')).toBe(-50000)
  })

  it('parses zero', () => {
    expect(parseCurrency('$0.00')).toBe(0)
  })

  it('returns null for empty string', () => {
    expect(parseCurrency('')).toBeNull()
  })

  it('returns null for N/A', () => {
    expect(parseCurrency('N/A')).toBeNull()
  })

  it('returns null for whitespace', () => {
    expect(parseCurrency('   ')).toBeNull()
  })

  it('strips Robinhood N suffix (net proceeds)', () => {
    expect(parseCurrency('1200.00N')).toBe(120000)
  })

  it('strips Robinhood G suffix (gross proceeds)', () => {
    expect(parseCurrency('$1,200.00G')).toBe(120000)
  })

  it('strips Robinhood W suffix (wash sale)', () => {
    expect(parseCurrency('$1,500.00W')).toBe(150000)
  })

  it('handles large amounts', () => {
    expect(parseCurrency('$2,851,139.69')).toBe(285113969)
  })

  it('handles cents correctly (no floating point errors)', () => {
    expect(parseCurrency('$100.10')).toBe(10010)
    expect(parseCurrency('$0.01')).toBe(1)
    expect(parseCurrency('$99.99')).toBe(9999)
  })
})

// ═══════════════════════════════════════════════════════════════
// parseDate()
// ═══════════════════════════════════════════════════════════════

describe('parseDate()', () => {
  it('parses MM/DD/YYYY', () => {
    expect(parseDate('01/15/2025')).toBe('2025-01-15')
  })

  it('parses M/D/YYYY (single-digit month/day)', () => {
    expect(parseDate('1/5/2025')).toBe('2025-01-05')
  })

  it('passes through ISO format', () => {
    expect(parseDate('2025-01-15')).toBe('2025-01-15')
  })

  it('returns null for "Various"', () => {
    expect(parseDate('Various')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull()
  })

  it('handles whitespace', () => {
    expect(parseDate('  01/15/2025  ')).toBe('2025-01-15')
  })

  it('returns null for unrecognized format', () => {
    expect(parseDate('Jan 15, 2025')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// parseTerm()
// ═══════════════════════════════════════════════════════════════

describe('parseTerm()', () => {
  it('parses "Short Term"', () => {
    expect(parseTerm('Short Term')).toBe('short')
  })

  it('parses "SHORT-TERM"', () => {
    expect(parseTerm('SHORT-TERM')).toBe('short')
  })

  it('parses "Long Term"', () => {
    expect(parseTerm('Long Term')).toBe('long')
  })

  it('parses "LONG-TERM"', () => {
    expect(parseTerm('LONG-TERM')).toBe('long')
  })

  it('parses abbreviations', () => {
    expect(parseTerm('ST')).toBe('short')
    expect(parseTerm('LT')).toBe('long')
  })

  it('returns null for empty string', () => {
    expect(parseTerm('')).toBeNull()
  })

  it('returns null for N/A', () => {
    expect(parseTerm('N/A')).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// Robinhood parser — golden file
// ═══════════════════════════════════════════════════════════════

describe('RobinhoodParser', () => {
  const parser = new RobinhoodParser()

  describe('golden file test', () => {
    const csv = readFileSync(
      join(__dirname, '../fixtures/robinhood-sample.csv'),
      'utf-8',
    )
    const result = parser.parse(csv)

    it('parses expected number of transactions', () => {
      expect(result.transactions).toHaveLength(8)
    })

    it('skips summary rows', () => {
      expect(result.rowCounts.skipped).toBe(1)
    })

    it('reports no errors', () => {
      expect(result.errors).toEqual([])
    })

    it('row counts are consistent', () => {
      expect(result.rowCounts.total).toBe(
        result.rowCounts.parsed + result.rowCounts.skipped,
      )
    })

    it('parses NVDA (short-term, category A) correctly', () => {
      const nvda = result.transactions[0]
      expect(nvda.description).toBe('100 sh NVDA')
      expect(nvda.dateAcquired).toBe('2025-01-10')
      expect(nvda.dateSold).toBe('2025-03-15')
      expect(nvda.proceeds).toBe(1520000)
      expect(nvda.costBasis).toBe(1250000)
      expect(nvda.gainLoss).toBe(270000)
      expect(nvda.washSaleLossDisallowed).toBe(0)
      expect(nvda.longTerm).toBe(false)
      expect(nvda.basisReportedToIrs).toBe(true)
      expect(nvda.noncoveredSecurity).toBe(false)
    })

    it('parses AAPL loss correctly', () => {
      const aapl = result.transactions[1]
      expect(aapl.gainLoss).toBe(-35000) // ($350.00)
    })

    it('parses option (TSLA call) correctly', () => {
      const tslaCall = result.transactions[2]
      expect(tslaCall.description).toBe('TSLA 02/21/2025 CALL $250.00')
      expect(tslaCall.proceeds).toBe(120000)
      expect(tslaCall.costBasis).toBe(80000)
      expect(tslaCall.gainLoss).toBe(40000)
    })

    it('parses "Various" date acquired as null', () => {
      const goog = result.transactions[3]
      expect(goog.dateAcquired).toBeNull()
    })

    it('parses wash sale amount (W suffix)', () => {
      const goog = result.transactions[3]
      expect(goog.washSaleLossDisallowed).toBe(150000) // $1,500.00
    })

    it('parses long-term trades (category D)', () => {
      const amzn = result.transactions[4]
      expect(amzn.longTerm).toBe(true)
      expect(amzn.basisReportedToIrs).toBe(true)
      expect(amzn.noncoveredSecurity).toBe(false)
    })

    it('parses noncovered security (category B)', () => {
      const pltr = result.transactions[6]
      expect(pltr.longTerm).toBe(false)
      expect(pltr.basisReportedToIrs).toBe(false)
      expect(pltr.noncoveredSecurity).toBe(true)
      expect(pltr.costBasis).toBeNull()
    })

    it('parses category E (long-term, basis not reported)', () => {
      const mega = result.transactions[7]
      expect(mega.longTerm).toBe(true)
      expect(mega.basisReportedToIrs).toBe(false)
      expect(mega.noncoveredSecurity).toBe(true)
    })

    it('flags RSU transactions with warning', () => {
      // MEGA (RSU shares) with $0 basis should trigger RSU warning
      expect(result.warnings.some(w => w.includes('RSU') || w.includes('MEGA'))).toBe(true)
    })
  })

  // ── Edge cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty CSV', () => {
      const result = parser.parse('')
      expect(result.transactions).toEqual([])
      expect(result.errors).toEqual([])
      expect(result.rowCounts.total).toBe(0)
    })

    it('handles headers only (no data rows)', () => {
      const result = parser.parse(
        'Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Wash Sale Loss Disallowed,Gain/Loss,Term,Box\n',
      )
      expect(result.transactions).toEqual([])
      expect(result.errors).toEqual([])
      expect(result.rowCounts.total).toBe(0)
    })

    it('reports error for missing required columns', () => {
      const result = parser.parse('Foo,Bar,Baz\n1,2,3\n')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toMatch(/Missing required columns/)
    })

    it('reports error for row with missing date sold', () => {
      const csv = [
        'Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Wash Sale Loss Disallowed,Gain/Loss,Term,Box',
        '"100 sh AAPL",01/01/2025,,"$5,000.00","$4,000.00",,"$1,000.00",Short Term,A',
      ].join('\n')
      const result = parser.parse(csv)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]).toMatch(/date sold/)
    })

    it('reports error for row with missing proceeds', () => {
      const csv = [
        'Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Wash Sale Loss Disallowed,Gain/Loss,Term,Box',
        '"100 sh AAPL",01/01/2025,03/15/2025,,"$4,000.00",,"$1,000.00",Short Term,A',
      ].join('\n')
      const result = parser.parse(csv)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0]).toMatch(/proceeds/)
    })

    it('still parses valid rows when some rows have errors', () => {
      const csv = [
        'Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Wash Sale Loss Disallowed,Gain/Loss,Term,Box',
        '"100 sh GOOD",01/01/2025,03/15/2025,"$5,000.00","$4,000.00",,"$1,000.00",Short Term,A',
        '"100 sh BAD",01/01/2025,,"$5,000.00","$4,000.00",,,,',
        '"100 sh ALSO GOOD",02/01/2025,04/20/2025,"$6,000.00","$5,500.00",,"$500.00",Long Term,D',
      ].join('\n')
      const result = parser.parse(csv)
      expect(result.transactions).toHaveLength(2)
      expect(result.errors).toHaveLength(1)
    })

    it('detects RSU by $0 cost basis', () => {
      const csv = [
        'Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Wash Sale Loss Disallowed,Gain/Loss,Term,Box',
        '"100 sh MEGA",01/01/2024,06/15/2025,"$10,000.00","$0.00",,"$10,000.00",Long Term,E',
      ].join('\n')
      const result = parser.parse(csv)
      expect(result.warnings.some(w => w.includes('RSU'))).toBe(true)
    })

    it('detects RSU by description keyword', () => {
      const csv = [
        'Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Wash Sale Loss Disallowed,Gain/Loss,Term,Box',
        '"100 sh MEGA (RSU)",01/01/2024,06/15/2025,"$10,000.00","$5,000.00",,"$5,000.00",Long Term,D',
      ].join('\n')
      const result = parser.parse(csv)
      expect(result.warnings.some(w => w.includes('RSU'))).toBe(true)
    })

    it('does not false-positive RSU for options with $0 basis', () => {
      const csv = [
        'Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Wash Sale Loss Disallowed,Gain/Loss,Term,Box',
        '"NVDA CALL $140.00",01/01/2025,02/21/2025,"$1,200.00","$0.00",,"$1,200.00",Short Term,A',
      ].join('\n')
      const result = parser.parse(csv)
      expect(result.warnings.some(w => w.includes('RSU'))).toBe(false)
    })
  })

  // ── Round-trip Form1099B validation ──────────────────────────

  describe('Form1099B round-trip validation', () => {
    const csv = [
      'Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Wash Sale Loss Disallowed,Gain/Loss,Term,Box',
      '"100 sh AAPL",01/10/2025,06/15/2025,"$17,500.00","$15,000.00",,"$2,500.00",Long Term,D',
      '"50 sh GOOG",02/01/2025,04/20/2025,"$8,000.00","$9,000.00",,"($1,000.00)",Short Term,A',
    ].join('\n')

    const result = parser.parse(csv)

    it('produces valid Form1099B objects', () => {
      for (const txn of result.transactions) {
        // Required string fields
        expect(typeof txn.id).toBe('string')
        expect(txn.id.length).toBeGreaterThan(0)
        expect(typeof txn.description).toBe('string')
        expect(typeof txn.dateSold).toBe('string')

        // Required number fields
        expect(typeof txn.proceeds).toBe('number')
        expect(Number.isInteger(txn.proceeds)).toBe(true)
        expect(typeof txn.gainLoss).toBe('number')
        expect(Number.isInteger(txn.gainLoss)).toBe(true)
        expect(typeof txn.washSaleLossDisallowed).toBe('number')
        expect(typeof txn.federalTaxWithheld).toBe('number')

        // Classification booleans
        expect(typeof txn.basisReportedToIrs).toBe('boolean')
        expect(typeof txn.noncoveredSecurity).toBe('boolean')
        expect(txn.longTerm === true || txn.longTerm === false || txn.longTerm === null).toBe(true)
      }
    })

    it('gain/loss equals proceeds minus basis minus wash sale', () => {
      for (const txn of result.transactions) {
        if (txn.costBasis !== null) {
          const expected = txn.proceeds - txn.costBasis - txn.washSaleLossDisallowed
          expect(txn.gainLoss).toBe(expected)
        }
      }
    })

    it('unique IDs across all transactions', () => {
      const ids = result.transactions.map(t => t.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })
})
