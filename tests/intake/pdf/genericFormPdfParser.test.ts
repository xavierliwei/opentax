/**
 * Tests for generic PDF form parser.
 *
 * Since we can't easily create real PDFs in unit tests, we mock the
 * pdfjs-dist layer (extractItems + groupLines) and test the parsing logic
 * that runs on top of the extracted text.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock pdfUtils to avoid loading the real PDF.js worker
vi.mock('../../../src/intake/pdf/pdfUtils', () => ({
  ensureWorker: vi.fn(() => Promise.resolve()),
  extractItems: vi.fn(),
  groupLines: vi.fn(),
}))

const { extractItems, groupLines } = await import('../../../src/intake/pdf/pdfUtils')
const { parseGenericFormPdf } = await import('../../../src/intake/pdf/genericFormPdfParser')
import type { RawItem, Line } from '../../../src/intake/pdf/pdfUtils'

// ── Helpers ──────────────────────────────────────────────────

function makeItem(str: string, page = 1, x = 0, y = 0): RawItem {
  return { str, page, x, y, width: str.length * 6 }
}

function makeLine(text: string, page = 1, y = 0): Line {
  return {
    items: [makeItem(text, page, 0, y)],
    text,
    y,
    page,
  }
}

function setupPdfMock(items: RawItem[], lines: Line[]) {
  vi.mocked(extractItems).mockResolvedValue(items)
  vi.mocked(groupLines).mockReturnValue(lines)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────

describe('parseGenericFormPdf', () => {
  describe('form type detection', () => {
    it('detects W-2 from "Wage and Tax Statement"', async () => {
      const items = [makeItem('Wage and Tax Statement')]
      const lines = [makeLine('Wage and Tax Statement')]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('W-2')
    })

    it('detects W-2 from "Form W-2"', async () => {
      const items = [makeItem('Form W-2 2024')]
      const lines = [makeLine('Form W-2 2024')]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('W-2')
    })

    it('detects 1099-INT from "Interest Income"', async () => {
      const items = [makeItem('Interest Income')]
      const lines = [makeLine('Interest Income')]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('1099-INT')
    })

    it('detects 1099-INT from "1099-INT"', async () => {
      const items = [makeItem('Form 1099-INT')]
      const lines = [makeLine('Form 1099-INT')]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('1099-INT')
    })

    it('detects 1099-DIV from "Dividends and Distributions"', async () => {
      const items = [makeItem('Dividends and Distributions')]
      const lines = [makeLine('Dividends and Distributions')]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('1099-DIV')
    })

    it('detects 1099-DIV from "1099-DIV"', async () => {
      const items = [makeItem('Form 1099-DIV')]
      const lines = [makeLine('Form 1099-DIV')]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('1099-DIV')
    })

    it('returns unknown for unrecognized PDF', async () => {
      const items = [makeItem('Some random PDF document')]
      const lines = [makeLine('Some random PDF document')]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('unknown')
      expect(result.fields.size).toBe(0)
    })
  })

  describe('1099-INT parsing', () => {
    it('extracts interest income fields', async () => {
      const items = [makeItem('Form 1099-INT Interest Income')]
      const lines = [
        makeLine('Form 1099-INT Interest Income', 1, 10),
        makeLine("PAYER'S name: Chase Bank NA", 1, 30),
        makeLine('1 Interest Income 1,250.00', 1, 50),
        makeLine('2 Early withdrawal penalty 0.00', 1, 60),
        makeLine('3 Interest on U.S. Savings Bonds 0.00', 1, 70),
        makeLine('4 Federal income tax withheld 125.00', 1, 80),
        makeLine('8 Tax-exempt interest 50.00', 1, 90),
      ]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('1099-INT')
      expect(result.fields.get('payerName')?.value).toBe('Chase Bank NA')
      expect(result.fields.get('box1')?.value).toBe('125000')
      expect(result.fields.get('box2')?.value).toBe('0')
      expect(result.fields.get('box4')?.value).toBe('12500')
      expect(result.fields.get('box8')?.value).toBe('5000')
    })

    it('extracts fields with "Box N" label format', async () => {
      const items = [makeItem('1099-INT')]
      const lines = [
        makeLine('1099-INT', 1, 10),
        makeLine('Box 1 Interest income 500.50', 1, 50),
        makeLine('Box 4 Federal tax withheld 75.25', 1, 60),
      ]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('1099-INT')
      expect(result.fields.get('box1')?.value).toBe('50050')
      expect(result.fields.get('box4')?.value).toBe('7525')
    })
  })

  describe('1099-DIV parsing', () => {
    it('extracts dividend fields', async () => {
      const items = [makeItem('Form 1099-DIV Dividends and Distributions')]
      const lines = [
        makeLine('Form 1099-DIV Dividends and Distributions', 1, 10),
        makeLine("PAYER'S name: Vanguard Group", 1, 30),
        makeLine('1a Total ordinary dividends 3,500.00', 1, 50),
        makeLine('1b Qualified dividends 2,800.00', 1, 60),
        makeLine('2a Total capital gain distributions 500.00', 1, 70),
        makeLine('4 Federal income tax withheld 350.00', 1, 80),
        makeLine('5 Section 199A dividends 100.00', 1, 90),
      ]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('1099-DIV')
      expect(result.fields.get('payerName')?.value).toBe('Vanguard Group')
      expect(result.fields.get('box1a')?.value).toBe('350000')
      expect(result.fields.get('box1b')?.value).toBe('280000')
      expect(result.fields.get('box2a')?.value).toBe('50000')
      expect(result.fields.get('box4')?.value).toBe('35000')
      expect(result.fields.get('box5')?.value).toBe('10000')
    })
  })

  describe('W-2 parsing', () => {
    it('extracts W-2 fields', async () => {
      const items = [makeItem('Wage and Tax Statement')]
      const lines = [
        makeLine('Wage and Tax Statement', 1, 10),
        makeLine("Employer's name: ACME Corp", 1, 30),
        makeLine('12-3456789', 1, 40),
        makeLine('1 Wages, tips, other compensation 75,000.00', 1, 60),
        makeLine('2 Federal income tax withheld 12,500.00', 1, 70),
        makeLine('3 Social security wages 75,000.00', 1, 80),
        makeLine('4 Social security tax withheld 4,650.00', 1, 90),
        makeLine('5 Medicare wages and tips 75,000.00', 1, 100),
        makeLine('6 Medicare tax withheld 1,087.50', 1, 110),
      ]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('W-2')
      expect(result.fields.get('employerName')?.value).toBe('ACME Corp')
      expect(result.fields.get('employerEin')?.value).toBe('12-3456789')
      expect(result.fields.get('box1')?.value).toBe('7500000')
      expect(result.fields.get('box2')?.value).toBe('1250000')
      expect(result.fields.get('box3')?.value).toBe('7500000')
      expect(result.fields.get('box4')?.value).toBe('465000')
      expect(result.fields.get('box5')?.value).toBe('7500000')
      expect(result.fields.get('box6')?.value).toBe('108750')
    })

    it('extracts state fields', async () => {
      const items = [makeItem('Form W-2')]
      const lines = [
        makeLine('Form W-2', 1, 10),
        makeLine('15 State CA', 1, 120),
        makeLine('16 State wages 75,000.00', 1, 130),
        makeLine('17 State income tax 3,000.00', 1, 140),
      ]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('W-2')
      expect(result.fields.get('box15State')?.value).toBe('CA')
      expect(result.fields.get('box16StateWages')?.value).toBe('7500000')
      expect(result.fields.get('box17StateIncomeTax')?.value).toBe('300000')
    })
  })

  describe('confidence', () => {
    it('sets confidence to 1.0 for PDF-extracted values', async () => {
      const items = [makeItem('1099-INT')]
      const lines = [
        makeLine('1099-INT', 1, 10),
        makeLine('1 Interest Income 100.00', 1, 50),
      ]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.fields.get('box1')?.confidence).toBe(1.0)
    })
  })

  describe('positional parsing (IRS grid layout)', () => {
    it('extracts 1099-INT fields from grid layout (Discover-style)', async () => {
      // Simulate the IRS form grid: box labels and values in different rows
      // This mirrors the actual Discover 1099-INT PDF layout
      const items: RawItem[] = [
        // Form identification text
        makeItem('Interest', 1, 545, 487),
        makeItem('Income', 1, 547, 499),
        makeItem('Form', 1, 419, 512),
        makeItem('1099-INT', 1, 439, 512),

        // PAYER'S label and payer name
        makeItem("PAYER'S", 1, 44, 472),
        makeItem('name,', 1, 71, 472),
        makeItem('street', 1, 90, 472),
        makeItem('address,', 1, 109, 472),
        makeItem('ACME BANK, N.A.', 1, 48, 488),
        makeItem('123 MAIN ST', 1, 48, 500),
        makeItem('ANYTOWN, CA 90210', 1, 48, 512),

        // Box 1: Interest income — label row
        { str: '1', page: 1, x: 306, y: 498, width: 4 },
        makeItem('Interest income', 1, 314, 498),
        // Box 1: value row ($ sign + amount on next row)
        { str: '$', page: 1, x: 302, y: 512, width: 4 },
        { str: '946.72', page: 1, x: 310, y: 512, width: 25 },

        // Box 2: Early withdrawal penalty — label row
        { str: '2', page: 1, x: 306, y: 522, width: 4 },
        makeItem('Early withdrawal penalty', 1, 314, 522),
        // Box 2: value row (empty — just $)
        { str: '$', page: 1, x: 302, y: 536, width: 4 },

        // Box 3: Interest on U.S. Savings Bonds
        { str: '3', page: 1, x: 306, y: 546, width: 4 },
        makeItem('Interest on U.S. Savings Bonds and Treasury obligations', 1, 314, 546),
        { str: '$', page: 1, x: 302, y: 560, width: 4 },

        // Box 4: Federal income tax withheld
        makeItem('4 Federal income tax withheld', 1, 306, 570),
        { str: '$', page: 1, x: 302, y: 584, width: 4 },
        { str: '50.00', page: 1, x: 310, y: 584, width: 20 },

        // Box 8: Tax-exempt interest
        { str: '8', page: 1, x: 306, y: 617, width: 4 },
        makeItem('Tax-exempt interest', 1, 314, 617),
        { str: '$', page: 1, x: 302, y: 631, width: 4 },

        // Box 15: State
        { str: '15', page: 1, x: 410, y: 690, width: 8 },
        makeItem('State', 1, 422, 690),
        { str: 'CA', page: 1, x: 418, y: 716, width: 12 },
      ]

      // groupLines returns lines that merge left/right columns —
      // the line-scan parser won't find separate label+value rows
      const lines = [
        makeLine("PAYER'S name, street address, city...", 1, 472),
        makeLine('ACME BANK, N.A. Interest', 1, 488),
        makeLine('123 MAIN ST 1 Interest income Income', 1, 498),
        makeLine('ANYTOWN, CA 90210 $ 946.72 Form 1099-INT', 1, 512),
        makeLine('2 Early withdrawal penalty', 1, 522),
        makeLine('$', 1, 536),
        makeLine('3 Interest on U.S. Savings Bonds and Treasury obligations', 1, 546),
        makeLine('$', 1, 560),
        makeLine('4 Federal income tax withheld', 1, 570),
        makeLine('$ 50.00', 1, 584),
        makeLine('8 Tax-exempt interest', 1, 617),
        makeLine('$', 1, 631),
      ]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('1099-INT')
      expect(result.fields.get('payerName')?.value).toBe('ACME BANK, N.A.')
      expect(result.fields.get('box1')?.value).toBe('94672')  // $946.72
      expect(result.fields.get('box4')?.value).toBe('5000')   // $50.00
      expect(result.fields.get('box1')?.confidence).toBe(1.0)
    })

    it('falls back to line-scan when positional finds nothing', async () => {
      // Items have no grid-layout box labels (x < 250)
      const items = [makeItem('Form 1099-INT')]
      const lines = [
        makeLine('Form 1099-INT', 1, 10),
        makeLine("PAYER'S name: Some Bank", 1, 20),
        makeLine('1 Interest Income 500.00', 1, 50),
        makeLine('4 Federal income tax withheld 75.00', 1, 60),
      ]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('1099-INT')
      expect(result.fields.get('payerName')?.value).toBe('Some Bank')
      expect(result.fields.get('box1')?.value).toBe('50000')
      expect(result.fields.get('box4')?.value).toBe('7500')
    })
  })

  describe('warnings', () => {
    it('warns when form type is detected but no fields extracted', async () => {
      const items = [makeItem('Form 1099-INT')]
      // Lines contain no parseable values
      const lines = [
        makeLine('Form 1099-INT', 1, 10),
        makeLine('Some other text with no dollar amounts', 1, 30),
      ]
      setupPdfMock(items, lines)

      const result = await parseGenericFormPdf(new ArrayBuffer(8))
      expect(result.formType).toBe('1099-INT')
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toMatch(/no field values/)
    })
  })
})
