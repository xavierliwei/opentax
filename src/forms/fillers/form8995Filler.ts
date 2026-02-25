/**
 * Form 8995 (Qualified Business Income Deduction — Simplified Computation)
 *
 * Fills the official IRS Form 8995 template from computed QBI results.
 * Falls back to programmatic generation when no template is available.
 *
 * Layout mirrors IRS Form 8995 line structure:
 *   Header: Name, SSN
 *   Lines 1i–1v: Per-business QBI (up to 5 rows)
 *   Lines 2–5: QBI computation
 *   Lines 6–9: REIT/PTP (not currently modeled)
 *   Lines 10–15: Deduction computation
 *   Lines 16–17: Loss carryforwards
 *
 * Source: IRS Form 8995, IRC §199A
 * All amounts in integer cents.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { QBIDeductionResult } from '../../rules/2025/qbiDeduction'
import { formatDollars, formatSSN, setTextField, setDollarField } from '../helpers'
import {
  F8995_HEADER, F8995_BUSINESS, F8995_QBI,
  F8995_DEDUCTION,
} from '../mappings/form8995Fields'

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

// ── Template-based filler ────────────────────────────────────────

async function fillForm8995Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: QBIDeductionResult,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Header ──────────────────────────────────────────────
  setTextField(form, F8995_HEADER.name,
    `${tp.firstName} ${tp.lastName}`)
  setTextField(form, F8995_HEADER.ssn,
    formatSSN(tp.ssn || '000000000'))

  // ── Business rows (up to 5) ─────────────────────────────
  const businesses = buildBusinessRows(taxReturn)
  const rowFields = [
    { name: F8995_BUSINESS.row1_name, tin: F8995_BUSINESS.row1_tin, qbi: F8995_BUSINESS.row1_qbi },
    { name: F8995_BUSINESS.row2_name, tin: F8995_BUSINESS.row2_tin, qbi: F8995_BUSINESS.row2_qbi },
    { name: F8995_BUSINESS.row3_name, tin: F8995_BUSINESS.row3_tin, qbi: F8995_BUSINESS.row3_qbi },
    { name: F8995_BUSINESS.row4_name, tin: F8995_BUSINESS.row4_tin, qbi: F8995_BUSINESS.row4_qbi },
    { name: F8995_BUSINESS.row5_name, tin: F8995_BUSINESS.row5_tin, qbi: F8995_BUSINESS.row5_qbi },
  ]
  for (let i = 0; i < Math.min(businesses.length, rowFields.length); i++) {
    const biz = businesses[i]
    const fields = rowFields[i]
    setTextField(form, fields.name, biz.name)
    if (biz.tin) setTextField(form, fields.tin, biz.tin)
    setDollarField(form, fields.qbi, biz.qbi)
  }

  // ── Lines 2–5: QBI Computation ──────────────────────────
  // Line 2: Total QBI
  setDollarField(form, F8995_QBI.line2, result.totalQBI)

  // Line 3: QBI loss carryforward (not modeled — leave blank)

  // Line 4: Total QBI (same as line 2 when no carryforward)
  setDollarField(form, F8995_QBI.line4, Math.max(0, result.totalQBI))

  // Line 5: QBI component (20% of line 4)
  setDollarField(form, F8995_QBI.line5, result.qbiComponent)

  // Lines 6–9: REIT/PTP (not modeled — leave blank)

  // ── Lines 10–15: Deduction Computation ──────────────────
  // Line 10: QBI deduction before income limitation (= line 5 when no REIT/PTP)
  setDollarField(form, F8995_DEDUCTION.line10, result.qbiComponent)

  // Line 11: Taxable income before QBI deduction
  const taxableIncomeBeforeQBI = result.taxableIncomeComponent > 0
    ? Math.round(result.taxableIncomeComponent / 0.20)
    : 0
  setDollarField(form, F8995_DEDUCTION.line11, taxableIncomeBeforeQBI)

  // Line 12: Net capital gain (not separately computed — leave blank)

  // Line 13: Line 11 minus line 12
  setDollarField(form, F8995_DEDUCTION.line13, taxableIncomeBeforeQBI)

  // Line 14: Income limitation (20% of line 13)
  setDollarField(form, F8995_DEDUCTION.line14, result.taxableIncomeComponent)

  // Line 15: QBI deduction (lesser of line 10 or 14)
  setDollarField(form, F8995_DEDUCTION.line15, result.deductionAmount)

  form.flatten()
  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateForm8995(
  taxReturn: TaxReturn,
  result: QBIDeductionResult,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.3, 0.3, 0.3)
  const lightGray = rgb(0.85, 0.85, 0.85)
  let y = 740

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
  drawText('OMB No. 1545-0074  |  Attachment Sequence No. 55', 56, 7, { color: gray })
  y -= 14

  drawLine(56, 556)
  y -= 6

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
    page.drawRectangle({ x: 56, y: y - 2, width: 500, height: 16, color: lightGray })
    drawText('(a) Trade, business, or aggregation name', 60, 8, { font: fontBold })
    drawText('(b) TIN', 320, 8, { font: fontBold })
    drawText('(c) QBI', 470, 8, { font: fontBold })
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

  drawRow('Total qualified business income', '2', result.totalQBI)
  drawRow('Qualified business income component (20% of Line 4)', '5', result.qbiComponent)

  const taxableIncomeBeforeQBI = result.taxableIncomeComponent > 0
    ? Math.round(result.taxableIncomeComponent / 0.20)
    : 0
  drawRow('Taxable income before qualified business income deduction', '11', taxableIncomeBeforeQBI)
  drawRow('Subtract line 12 from line 11', '13', taxableIncomeBeforeQBI)
  drawRow('Income limitation (20% of Line 13)', '14', result.taxableIncomeComponent)

  y -= 6
  drawLine(56, 556)
  y -= 8

  page.drawRectangle({ x: 440, y: y - 4, width: 116, height: 20, color: lightGray })
  drawText('15', 56, 10, { font: fontBold })
  drawText('Qualified business income deduction (lesser of Line 10 or Line 14)', 80, 9, { font: fontBold })
  drawText(formatDollars(result.deductionAmount), 470, 10, { font: fontBold })
  y -= 24

  drawText('Enter on Form 1040, Line 13', 80, 8, { font: fontItalic, color: gray })
  y -= 30

  drawLine(56, 556)
  y -= 8
  drawText('Generated by OpenTax — Form 8995 (Simplified Computation)', 56, 7, { color: gray })

  return pdfDoc
}

// ── Public API ──────────────────────────────────────────────────

export async function fillForm8995(
  taxReturn: TaxReturn,
  result: QBIDeductionResult,
  templateBytes?: Uint8Array,
): Promise<PDFDocument> {
  if (templateBytes) {
    return fillForm8995Template(templateBytes, taxReturn, result)
  }
  return generateForm8995(taxReturn, result)
}
