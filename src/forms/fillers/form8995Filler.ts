/**
 * Form 8995 (Qualified Business Income Deduction — Simplified Computation)
 *
 * Programmatically generated PDF (no IRS template available).
 * Used when taxable income is at or below the QBI threshold:
 *   $191,950 (single/MFS/HOH) / $383,900 (MFJ/QW).
 *
 * Layout mirrors IRS Form 8995 line structure:
 *   Header: Name, SSN
 *   Lines i–v: Per-business QBI (up to 5 rows)
 *   Line 1: Total QBI
 *   Line 2: QBI component (20% of Line 1)
 *   Line 3: Taxable income before QBI deduction
 *   Line 4: Net capital gain (not computed — 0)
 *   Line 5: Line 3 minus Line 4
 *   Line 6: Income limitation (20% of Line 5)
 *   Line 7: QBI deduction (lesser of Line 2 and Line 6)
 *
 * Source: IRS Form 8995, IRC §199A
 * All amounts in integer cents.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { QBIDeductionResult } from '../../rules/2025/qbiDeduction'
import { formatDollars, formatSSN } from '../helpers'

/** Per-business row for the simplified form (name + QBI). */
interface SimplifiedBusinessRow {
  name: string
  tin: string
  qbi: number // cents
}

/**
 * Build the per-business rows from the tax return data.
 * Form 8995 simplified path aggregates all QBI, but the form still
 * lists individual businesses for transparency.
 *
 * QBI per business = Schedule C net profit (line 31) for sole proprietorships,
 * or Section 199A QBI from K-1 for passthrough entities.
 */
function buildBusinessRows(taxReturn: TaxReturn): SimplifiedBusinessRow[] {
  const rows: SimplifiedBusinessRow[] = []

  for (const biz of taxReturn.scheduleCBusinesses ?? []) {
    // Compute net profit inline (grossReceipts - returns - COGS - expenses)
    // This mirrors the Schedule C computation in the rules engine.
    const grossProfit = biz.grossReceipts - biz.returns - biz.costOfGoodsSold
    const totalExpenses =
      biz.advertising + biz.carAndTruck + biz.commissions + biz.contractLabor +
      biz.depreciation + biz.insurance + biz.mortgageInterest + biz.otherInterest +
      biz.legal + biz.officeExpense + biz.rent + biz.repairs + biz.supplies +
      biz.taxes + biz.travel + Math.round(biz.meals * 0.5) +
      biz.utilities + biz.wages + biz.otherExpenses
    rows.push({
      name: biz.businessName,
      tin: biz.businessEin || '',
      qbi: grossProfit - totalExpenses,
    })
  }

  for (const k1 of taxReturn.scheduleK1s ?? []) {
    if (k1.section199AQBI !== 0) {
      rows.push({
        name: k1.entityName,
        tin: k1.entityEin,
        qbi: k1.section199AQBI,
      })
    }
  }

  return rows
}

export async function fillForm8995(
  taxReturn: TaxReturn,
  result: QBIDeductionResult,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // US Letter
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.3, 0.3, 0.3)
  const lightGray = rgb(0.85, 0.85, 0.85)
  let y = 740

  // ── Helpers ─────────────────────────────────────────────────
  const drawText = (text: string, x: number, size: number, opts?: { font?: typeof font; color?: typeof black }) => {
    page.drawText(text, { x, y, size, font: opts?.font ?? font, color: opts?.color ?? black })
  }

  const drawLine = (x1: number, x2: number) => {
    page.drawLine({ start: { x: x1, y: y + 4 }, end: { x: x2, y: y + 4 }, thickness: 0.5, color: gray })
  }

  const drawRow = (label: string, lineNum: string, value: number) => {
    drawText(lineNum, 56, 9, { font: fontBold })
    drawText(label, 80, 9)
    drawText(formatDollars(value), 470, 9, { font: fontBold })
    y -= 18
  }

  // ── Header ──────────────────────────────────────────────────
  drawText('Form 8995', 56, 14, { font: fontBold })
  drawText('Qualified Business Income Deduction', 160, 14, { font: fontBold })
  y -= 16
  drawText('Simplified Computation', 160, 10, { font: fontItalic, color: gray })
  y -= 12
  drawText('Department of the Treasury — Internal Revenue Service', 56, 7, { color: gray })
  y -= 8
  drawText('OMB No. 1545-0123  |  Attachment Sequence No. 55', 56, 7, { color: gray })
  y -= 14

  drawLine(56, 556)
  y -= 6

  // Taxpayer name and SSN
  drawText('Name(s) shown on return:', 56, 8, { color: gray })
  const tpName = `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`
  drawText(tpName, 180, 10, { font: fontBold })
  drawText('Your SSN:', 400, 8, { color: gray })
  drawText(formatSSN(taxReturn.taxpayer.ssn || '000000000'), 460, 10, { font: fontBold })
  y -= 20

  drawLine(56, 556)
  y -= 8

  // ── Business rows ─────────────────────────────────────────
  const businesses = buildBusinessRows(taxReturn)

  if (businesses.length > 0) {
    // Column headers
    page.drawRectangle({ x: 56, y: y - 2, width: 500, height: 16, color: lightGray })
    drawText('(i) Trade, business, or aggregation name', 60, 8, { font: fontBold })
    drawText('(ii) TIN', 320, 8, { font: fontBold })
    drawText('(iii) QBI', 470, 8, { font: fontBold })
    y -= 20

    for (const biz of businesses.slice(0, 5)) {
      drawText(biz.name || '—', 60, 9)
      drawText(biz.tin || '—', 320, 9)
      drawText(formatDollars(biz.qbi), 470, 9)
      y -= 16
    }
    if (businesses.length > 5) {
      drawText('(additional businesses — see attached)', 60, 8, { font: fontItalic, color: gray })
      y -= 16
    }
    y -= 8
  }

  drawLine(56, 556)
  y -= 8

  // ── Computation lines ────────────────────────────────────
  drawText('Simplified QBI Deduction Computation', 56, 11, { font: fontBold })
  y -= 22

  // Line 1: Total QBI
  drawRow('Total qualified business income', '1', result.totalQBI)

  // Line 2: QBI component (20% of total QBI)
  drawRow('Qualified business income component (20% of Line 1)', '2', result.qbiComponent)

  // Line 3: Taxable income before QBI deduction
  // We reconstruct this from the result: taxableIncomeComponent / 0.20
  const taxableIncomeBeforeQBI = result.taxableIncomeComponent > 0
    ? Math.round(result.taxableIncomeComponent / 0.20)
    : 0
  drawRow('Taxable income before qualified business income deduction', '3', taxableIncomeBeforeQBI)

  // Line 4: Net capital gain (0 — not separately computed in simplified path)
  drawRow('Net capital gain (not applicable in simplified computation)', '4', 0)

  // Line 5: Line 3 minus Line 4
  drawRow('Subtract Line 4 from Line 3', '5', taxableIncomeBeforeQBI)

  // Line 6: Income limitation (20% of Line 5)
  drawRow('Income limitation (20% of Line 5)', '6', result.taxableIncomeComponent)

  y -= 6
  drawLine(56, 556)
  y -= 8

  // Line 7: QBI deduction (lesser of Line 2 and Line 6)
  page.drawRectangle({ x: 440, y: y - 4, width: 116, height: 20, color: lightGray })
  drawText('7', 56, 10, { font: fontBold })
  drawText('Qualified business income deduction (lesser of Line 2 or Line 6)', 80, 9, { font: fontBold })
  drawText(formatDollars(result.deductionAmount), 470, 10, { font: fontBold })
  y -= 24

  drawText('Enter on Form 1040, Line 13', 80, 8, { font: fontItalic, color: gray })
  y -= 30

  // ── Footer ──────────────────────────────────────────────────
  drawLine(56, 556)
  y -= 8
  drawText('Generated by OpenTax — Form 8995 (Simplified Computation)', 56, 7, { color: gray })

  return pdfDoc
}
