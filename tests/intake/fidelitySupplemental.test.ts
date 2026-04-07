/**
 * Tests for Fidelity supplemental stock plan lot detail parsing.
 *
 * Mocks pdfUtils to provide synthetic text matching Fidelity PDF layout,
 * verifying that (e)-flagged transactions get adjusted cost basis from
 * the supplemental section.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/intake/pdf/pdfUtils', () => ({
  ensureWorker: vi.fn(() => Promise.resolve()),
  extractItems: vi.fn(),
  groupLines: vi.fn(),
}))

const { groupLines } = await import('../../src/intake/pdf/pdfUtils')
const { parseFidelityPdf } = await import('../../src/intake/pdf/fidelityPdfParser')
import type { Line } from '../../src/intake/pdf/pdfUtils'

// ── Helpers ──────────────────────────────────────────────────

function item(str: string, x: number, page = 3, y = 0) {
  return { str, x, y, page, width: str.length * 6 }
}

function line(items: ReturnType<typeof item>[]): Line {
  const text = items.map(i => i.str).join(' ')
  return { items, text, y: items[0]?.y ?? 0, page: items[0]?.page ?? 1 }
}

function textLine(text: string, page = 1, y = 0): Line {
  return { items: [item(text, 0, page, y)], text, y, page }
}

// ── Column positions matching Fidelity layout ────────────────

// 1099-B columns: Action(20) Qty(80) DateAcq(150) DateSold(210) Proceeds(300) CostBasis(400) WashSale(500) GainLoss(580) FedTax(680)
const COL_HEADER_ITEMS = [
  item('Action', 20, 3), item('Quantity', 80, 3), item('1b Date', 150, 3),
  item('1c Date Sold', 210, 3), item('1d', 280, 3), item('Proceeds', 300, 3),
  item('1e', 380, 3), item('Cost or', 400, 3), item('1g', 480, 3),
  item('Wash Sale', 500, 3), item('Gain/Loss', 580, 3),
  item('4 Federal', 680, 3),
]

// Supplemental columns: Grant(20) Qty(80) DateAcq(150) DateSold(210) Proceeds(300) OrdInc(400) AdjBasis(500) WashSale(580) AdjGain(660)
const SUPP_HEADER_ITEMS = [
  item('Grant', 20, 9), item('Quantity', 80, 9), item('Date of', 150, 9),
  item('Date Sold', 210, 9), item('Proceeds', 300, 9),
  item('Ordinary Income', 400, 9), item('Adjusted Cost', 500, 9),
  item('Wash Sale', 580, 9), item('Adjusted Gain/Loss', 660, 9),
]

function makeTxnLine(qty: string, dateAcq: string, dateSold: string, proceeds: string, basis: string, gainLoss: string, hasE = false, page = 3) {
  const items = [
    item('Sale', 20, page),
    item(qty, 80, page),
    item(dateAcq, 150, page),
    item(dateSold, 210, page),
    item(proceeds, 300, page),
    item(basis, 400, page),
  ]
  if (hasE) items.push(item('(e)', 450, page))
  items.push(item(gainLoss, 580, page))
  return line(items)
}

function makeSuppLine(grantType: string, qty: string, dateAcq: string, dateSold: string, proceeds: string, ordInc: string, adjBasis: string, washSale: string, adjGain: string, page = 9) {
  return line([
    item(grantType, 20, page),
    item(qty, 80, page),
    item(dateAcq, 150, page),
    item(dateSold, 210, page),
    item(proceeds, 300, page),
    item(ordInc, 400, page),
    item(adjBasis, 500, page),
    item(washSale, 580, page),
    item(adjGain, 660, page),
  ])
}

// ── Tests ────────────────────────────────────────────────────

describe('Fidelity supplemental stock plan lot detail', () => {
  it('adjusts cost basis for (e)-marked transactions', async () => {
    const lines: Line[] = [
      // 1099-B section
      textLine('FORM 1099-B*', 3),
      textLine('Short-term transactions for which basis is reported to the IRS Box A checked', 3),
      line(COL_HEADER_ITEMS),
      textLine('MICROSOFT CORP, MSFT, 594918104', 3),
      // Regular transaction (no (e))
      makeTxnLine('800.000', '01/28/25', '05/16/25', '42,040.08', '40,249.04', '1,791.04', false),
      // (e)-marked MSFT transaction: unadjusted basis $1,882.65, gain $312.15
      makeTxnLine('4.972', '03/28/24', '01/28/25', '2,194.80', '1,882.65', '312.15', true),

      // Supplemental section
      textLine('2025 SUPPLEMENTAL INFORMATION', 9),
      textLine('Supplemental Stock Plan Lot Detail', 9),
      textLine('Short-Term Transactions', 9),
      textLine('MICROSOFT CORP, MSFT, 594918104', 9),
      line(SUPP_HEADER_ITEMS),
      // Adjusted: basis $2,091.82, gain $102.98
      makeSuppLine('QSP', '4.972', '03/28/24', '01/28/25', '2,194.80', '209.17', '2,091.82', '0.00', '102.98'),
    ]

    vi.mocked(groupLines).mockReturnValue(lines)

    const result = await parseFidelityPdf(new ArrayBuffer(0))

    expect(result.transactions).toHaveLength(2)
    expect(result.errors).toEqual([])

    // Regular transaction — NOT adjusted
    const regular = result.transactions[0]
    expect(regular.costBasis).toBe(4024904)
    expect(regular.gainLoss).toBe(179104)
    expect(regular.basisAdjustedFromSupplemental).toBeUndefined()

    // (e) transaction — adjusted from supplemental
    const adjusted = result.transactions[1]
    expect(adjusted.costBasis).toBe(209182)
    expect(adjusted.gainLoss).toBe(10298)
    expect(adjusted.basisAdjustedFromSupplemental).toBe(true)
  })

  it('warns when (e) transaction has no matching supplemental entry', async () => {
    const lines: Line[] = [
      textLine('FORM 1099-B*', 3),
      textLine('Short-term transactions for which basis is reported to the IRS Box A checked', 3),
      line(COL_HEADER_ITEMS),
      textLine('MICROSOFT CORP, MSFT, 594918104', 3),
      makeTxnLine('4.972', '03/28/24', '01/28/25', '2,194.80', '1,882.65', '312.15', true),
      // No supplemental section at all
    ]

    vi.mocked(groupLines).mockReturnValue(lines)

    const result = await parseFidelityPdf(new ArrayBuffer(0))

    expect(result.transactions).toHaveLength(1)
    // No supplemental entries, so no adjustment
    expect(result.transactions[0].costBasis).toBe(188265)
    expect(result.transactions[0].basisAdjustedFromSupplemental).toBeUndefined()
    // No warning either since there's no supplemental section
  })

  it('handles both short-term and long-term supplemental sections', async () => {
    const lines: Line[] = [
      // Short-term 1099-B
      textLine('FORM 1099-B*', 3),
      textLine('Short-term transactions for which basis is reported to the IRS Box A checked', 3),
      line(COL_HEADER_ITEMS),
      textLine('MICROSOFT CORP, MSFT, 594918104', 3),
      makeTxnLine('4.972', '03/28/24', '01/28/25', '2,194.80', '1,882.65', '312.15', true),

      // Long-term 1099-B
      textLine('Long-term transactions for which basis is reported to the IRS Box D checked', 5),
      line(COL_HEADER_ITEMS.map(i => ({ ...i, page: 5 }))),
      textLine('MICROSOFT CORP, MSFT, 594918104', 5),
      makeTxnLine('2.628', '12/29/23', '01/28/25', '1,160.00', '889.35', '270.65', true, 5),

      // Supplemental section — short-term
      textLine('2025 SUPPLEMENTAL INFORMATION', 9),
      textLine('Supplemental Stock Plan Lot Detail', 9),
      textLine('Short-Term Transactions', 9),
      textLine('MICROSOFT CORP, MSFT, 594918104', 9),
      line(SUPP_HEADER_ITEMS),
      makeSuppLine('QSP', '4.972', '03/28/24', '01/28/25', '2,194.80', '209.17', '2,091.82', '0.00', '102.98'),

      // Supplemental section — long-term
      textLine('Supplemental Stock Plan Lot Detail', 10),
      textLine('Long-Term Transactions', 10),
      textLine('MICROSOFT CORP, MSFT, 594918104', 10),
      line(SUPP_HEADER_ITEMS.map(i => ({ ...i, page: 10 }))),
      makeSuppLine('QSP', '2.628', '12/29/23', '01/28/25', '1,160.00', '98.81', '988.16', '0.00', '171.84', 10),
    ]

    vi.mocked(groupLines).mockReturnValue(lines)

    const result = await parseFidelityPdf(new ArrayBuffer(0))

    expect(result.transactions).toHaveLength(2)

    // Short-term adjusted
    const st = result.transactions[0]
    expect(st.costBasis).toBe(209182)
    expect(st.gainLoss).toBe(10298)
    expect(st.longTerm).toBe(false)
    expect(st.basisAdjustedFromSupplemental).toBe(true)

    // Long-term adjusted
    const lt = result.transactions[1]
    expect(lt.costBasis).toBe(98816)
    expect(lt.gainLoss).toBe(17184)
    expect(lt.longTerm).toBe(true)
    expect(lt.basisAdjustedFromSupplemental).toBe(true)
  })

  it('does not adjust transactions without (e) marker even if supplemental exists', async () => {
    const lines: Line[] = [
      textLine('FORM 1099-B*', 3),
      textLine('Short-term transactions for which basis is reported to the IRS Box A checked', 3),
      line(COL_HEADER_ITEMS),
      textLine('GRANITESHARES ETF TR2X LONG NVDA DAI, NVDL, 38747R827', 3),
      // No (e) marker — regular ETF trade
      makeTxnLine('800.000', '01/28/25', '05/16/25', '42,040.08', '40,249.04', '1,791.04', false),
    ]

    vi.mocked(groupLines).mockReturnValue(lines)

    const result = await parseFidelityPdf(new ArrayBuffer(0))

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].costBasis).toBe(4024904)
    expect(result.transactions[0].basisAdjustedFromSupplemental).toBeUndefined()
  })
})
