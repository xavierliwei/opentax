/**
 * Form 8995-A (Qualified Business Income Deduction — Above Threshold)
 *
 * Fills the official IRS Form 8995-A template from computed QBI results.
 * Falls back to programmatic generation when no template is available.
 *
 * Form structure:
 *   Page 1: Header, Part I (business info), Part II (QBI computation, lines 2-16)
 *   Page 2: Part III (phased-in reduction, lines 17-26), Part IV (deduction, lines 27-40)
 *
 * Source: IRS Form 8995-A, IRC §199A
 * All amounts in integer cents.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { QBIDeductionResult, QBIBusinessResult } from '../../rules/2025/qbiDeduction'
import { formatDollars, formatSSN, setTextField, setDollarField, checkBox } from '../helpers'
import {
  F8995A_HEADER, F8995A_PART1, F8995A_PART2, F8995A_PART4,
} from '../mappings/form8995aFields'

// ── Template-based filler ────────────────────────────────────────

async function fillForm8995ATemplate(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: QBIDeductionResult,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Header ──────────────────────────────────────────────
  setTextField(form, F8995A_HEADER.name,
    `${tp.firstName} ${tp.lastName}`)
  setTextField(form, F8995A_HEADER.ssn,
    formatSSN(tp.ssn || '000000000'))

  // ── Part I: Business Info (up to 3 rows: A, B, C) ──────
  const bizResults = result.businessResults ?? []
  const part1Rows = [
    { name: F8995A_PART1.rowA_name, tin: F8995A_PART1.rowA_tin, sstb: F8995A_PART1.rowA_specService },
    { name: F8995A_PART1.rowB_name, tin: F8995A_PART1.rowB_tin, sstb: F8995A_PART1.rowB_specService },
    { name: F8995A_PART1.rowC_name, tin: F8995A_PART1.rowC_tin, sstb: F8995A_PART1.rowC_specService },
  ]
  // Map business results back to input data for TIN
  const allBusinessInputs = [
    ...(taxReturn.scheduleCBusinesses ?? []).map(b => ({ name: b.businessName, tin: b.businessEin || '' })),
    ...(taxReturn.scheduleK1s ?? []).filter(k => k.section199AQBI !== 0).map(k => ({ name: k.entityName, tin: k.entityEin })),
  ]

  for (let i = 0; i < Math.min(bizResults.length, part1Rows.length); i++) {
    const biz = bizResults[i]
    const fields = part1Rows[i]
    setTextField(form, fields.name, biz.name)
    // Try to find the TIN from input data
    const input = allBusinessInputs.find(b => b.name === biz.name)
    if (input?.tin) setTextField(form, fields.tin, input.tin)
    if (biz.sstbExcluded || biz.sstbPhaseInApplied) {
      checkBox(form, fields.sstb)
    }
  }

  // ── Part II: QBI Computation (columns A, B, C) ──────────
  const colFields = [
    { // Column A
      line2: F8995A_PART2.line2_a, line3: F8995A_PART2.line3_a,
      line10: F8995A_PART2.line10_a, line11: F8995A_PART2.line11_a,
      line13: F8995A_PART2.line13_a, line15: F8995A_PART2.line15_a,
    },
    { // Column B
      line2: F8995A_PART2.line2_b, line3: F8995A_PART2.line3_b,
      line10: F8995A_PART2.line10_b, line11: F8995A_PART2.line11_b,
      line13: F8995A_PART2.line13_b, line15: F8995A_PART2.line15_b,
    },
    { // Column C
      line2: F8995A_PART2.line2_c, line3: F8995A_PART2.line3_c,
      line10: F8995A_PART2.line10_c, line11: F8995A_PART2.line11_c,
      line13: F8995A_PART2.line13_c, line15: F8995A_PART2.line15_c,
    },
  ]

  for (let i = 0; i < Math.min(bizResults.length, colFields.length); i++) {
    const biz = bizResults[i]
    const f = colFields[i]
    // Line 2: QBI
    setDollarField(form, f.line2, biz.qbi)
    // Line 3: 20% of QBI
    setDollarField(form, f.line3, biz.twentyPercentQBI)
    // Line 10: Greater of 50%×W2 or 25%×W2+2.5%×UBIA (wage limitation)
    setDollarField(form, f.line10, biz.wageLimitation)
    // Line 11: Smaller of line 3 or line 10
    const line11 = Math.min(biz.twentyPercentQBI, biz.wageLimitation)
    setDollarField(form, f.line11, line11)
    // Line 13: Greater of line 11 or line 12 (phase-in)
    setDollarField(form, f.line13, biz.deductibleQBI)
    // Line 15: QBI component (= line 13 for non-patron businesses)
    setDollarField(form, f.line15, biz.deductibleQBI)
  }

  // Line 16: Total QBI component (sum of all line 15 values)
  const totalQBIComponent = bizResults
    .filter(r => r.deductibleQBI > 0)
    .reduce((sum, r) => sum + r.deductibleQBI, 0)
  // Put total in the first column position (line 16 is a total row)
  setDollarField(form, F8995A_PART2.line16_a, totalQBIComponent)

  // ── Part IV: QBI Deduction (Page 2) ─────────────────────
  // Line 27: Total QBI component (from line 16)
  setDollarField(form, F8995A_PART4.line27, totalQBIComponent)

  // Lines 28-31: REIT/PTP (not modeled — leave blank)

  // Line 32: QBI deduction before income limitation
  setDollarField(form, F8995A_PART4.line32, totalQBIComponent)

  // Line 33: Taxable income before QBI deduction
  const taxableIncomeBeforeQBI = result.taxableIncomeComponent > 0
    ? Math.round(result.taxableIncomeComponent / 0.20)
    : 0
  setDollarField(form, F8995A_PART4.line33, taxableIncomeBeforeQBI)

  // Line 34: Net capital gain (not modeled — leave blank)

  // Line 35: Line 33 minus line 34
  setDollarField(form, F8995A_PART4.line35, taxableIncomeBeforeQBI)

  // Line 36: Income limitation (20% of line 35)
  setDollarField(form, F8995A_PART4.line36, result.taxableIncomeComponent)

  // Line 37: QBI deduction before DPAD (lesser of line 32 or 36)
  setDollarField(form, F8995A_PART4.line37, result.deductionAmount)

  // Line 38: DPAD (not modeled — leave blank)

  // Line 39: Total QBI deduction
  setDollarField(form, F8995A_PART4.line39, result.deductionAmount)

  form.flatten()
  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

/** Unsupported sub-path warnings to render on the form. */
function collectWarnings(result: QBIDeductionResult): string[] {
  const warnings: string[] = []

  if (result.hasSSTB && result.sstbWarning) {
    warnings.push(
      'SSTB businesses detected. Phase-in reduction was applied conservatively. ' +
      'Review SSTB treatment with a tax professional if businesses are in the phase-in range.',
    )
  }

  if (!result.businessResults || result.businessResults.length === 0) {
    warnings.push(
      'No per-business data available for above-threshold computation. ' +
      'QBI deduction is conservatively set to $0. Provide per-business W-2 wages and UBIA ' +
      'to compute the deduction under Form 8995-A.',
    )
  }

  warnings.push(
    'Note: Aggregation elections (multiple businesses treated as one) are not yet supported. ' +
    'Each business is computed individually.',
  )

  return warnings
}

async function generateForm8995A(
  taxReturn: TaxReturn,
  result: QBIDeductionResult,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.3, 0.3, 0.3)
  const lightGray = rgb(0.85, 0.85, 0.85)
  const warningBg = rgb(1.0, 0.96, 0.88)

  let page = pdfDoc.addPage([612, 792])
  let y = 740

  const drawText = (text: string, x: number, size: number, opts?: { font?: typeof font; color?: typeof black }) => {
    page.drawText(text, { x, y, size, font: opts?.font ?? font, color: opts?.color ?? black })
  }

  const drawLine = (x1: number, x2: number) => {
    page.drawLine({ start: { x: x1, y: y + 4 }, end: { x: x2, y: y + 4 }, thickness: 0.5, color: gray })
  }

  const ensureSpace = (needed: number) => {
    if (y < needed + 60) {
      page = pdfDoc.addPage([612, 792])
      y = 740
    }
  }

  // ── Header ──────────────────────────────────────────────────
  drawText('Form 8995-A', 56, 14, { font: fontBold })
  drawText('Qualified Business Income Deduction', 180, 14, { font: fontBold })
  y -= 16
  drawText('For taxpayers with taxable income above threshold', 180, 9, { font: fontItalic, color: gray })
  y -= 12
  drawText('Department of the Treasury — Internal Revenue Service', 56, 7, { color: gray })
  y -= 8
  drawText('OMB No. 1545-0074  |  Attachment Sequence No. 55A', 56, 7, { color: gray })
  y -= 14

  drawLine(56, 556)
  y -= 6

  drawText('Name(s) shown on return:', 56, 8, { color: gray })
  const tpName = `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`
  drawText(tpName, 180, 10, { font: fontBold })
  drawText('Your SSN:', 400, 8, { color: gray })
  drawText(formatSSN(taxReturn.taxpayer.ssn || '000000000'), 460, 10, { font: fontBold })
  y -= 22

  drawLine(56, 556)
  y -= 10

  // ── Warnings ────────────────────────────────────────────────
  const warnings = collectWarnings(result)
  if (warnings.length > 0) {
    page.drawRectangle({ x: 56, y: y - (warnings.length * 24) - 4, width: 500, height: warnings.length * 24 + 8, color: warningBg })
    for (const warning of warnings) {
      const maxChars = 85
      const lines: string[] = []
      let remaining = warning
      while (remaining.length > maxChars) {
        let breakAt = remaining.lastIndexOf(' ', maxChars)
        if (breakAt <= 0) breakAt = maxChars
        lines.push(remaining.slice(0, breakAt))
        remaining = remaining.slice(breakAt + 1)
      }
      if (remaining) lines.push(remaining)

      for (const line of lines) {
        drawText(line, 64, 8, { font: fontItalic, color: gray })
        y -= 12
      }
      y -= 4
    }
    y -= 8
  }

  // ── Part I: Trade or Business Information ───────────────────
  const bizResults = result.businessResults ?? []

  drawText('Part I — Trade or Business Information and QBI', 56, 11, { font: fontBold })
  y -= 22

  if (bizResults.length > 0) {
    page.drawRectangle({ x: 56, y: y - 2, width: 500, height: 16, color: lightGray })
    drawText('Business Name', 60, 7, { font: fontBold })
    drawText('QBI', 240, 7, { font: fontBold })
    drawText('20% QBI', 310, 7, { font: fontBold })
    drawText('W-2/UBIA Limit', 385, 7, { font: fontBold })
    drawText('Deductible', 480, 7, { font: fontBold })
    y -= 20

    for (const biz of bizResults) {
      ensureSpace(20)
      const nameDisplay = biz.name.length > 28 ? biz.name.slice(0, 25) + '...' : biz.name
      drawText(nameDisplay, 60, 8)
      drawText(formatDollars(biz.qbi), 240, 8)
      drawText(formatDollars(biz.twentyPercentQBI), 310, 8)
      drawText(formatDollars(biz.wageLimitation), 385, 8)
      drawText(formatDollars(biz.deductibleQBI), 480, 8)

      if (biz.sstbExcluded) {
        y -= 12
        drawText('  * SSTB excluded (above phase-in range)', 60, 7, { font: fontItalic, color: gray })
      }
      if (biz.sstbPhaseInApplied) {
        y -= 12
        drawText('  * SSTB phase-in reduction applied', 60, 7, { font: fontItalic, color: gray })
      }
      if (biz.qbi < 0) {
        y -= 12
        drawText('  * Loss business (passed through for netting)', 60, 7, { font: fontItalic, color: gray })
      }

      y -= 16
    }
  } else {
    drawText('No per-business data available.', 60, 9, { font: fontItalic, color: gray })
    y -= 16
  }

  y -= 8
  drawLine(56, 556)
  y -= 10

  // ── Part II: W-2 Wages and UBIA Detail ──────────────────────
  ensureSpace(120)
  drawText('Part II — W-2 Wage and Qualified Property (UBIA) Limitations', 56, 11, { font: fontBold })
  y -= 22

  if (bizResults.length > 0) {
    page.drawRectangle({ x: 56, y: y - 2, width: 500, height: 16, color: lightGray })
    drawText('Business', 60, 7, { font: fontBold })
    drawText('50% W-2', 210, 7, { font: fontBold })
    drawText('25% W-2 + 2.5% UBIA', 300, 7, { font: fontBold })
    drawText('Wage Limit', 435, 7, { font: fontBold })
    y -= 20

    for (const biz of bizResults) {
      if (biz.qbi <= 0 || biz.sstbExcluded) continue
      ensureSpace(20)

      const nameDisplay = biz.name.length > 22 ? biz.name.slice(0, 19) + '...' : biz.name
      drawText(nameDisplay, 60, 8)
      drawText('—', 230, 8, { color: gray })
      drawText('—', 340, 8, { color: gray })
      drawText(formatDollars(biz.wageLimitation), 435, 8)
      y -= 16
    }
  } else {
    drawText('N/A — no per-business data.', 60, 9, { font: fontItalic, color: gray })
    y -= 16
  }

  y -= 8
  drawLine(56, 556)
  y -= 10

  // ── Part III: QBI Deduction Summary ─────────────────────────
  ensureSpace(140)
  drawText('Part IV — QBI Deduction Summary', 56, 11, { font: fontBold })
  y -= 22

  const drawSummaryRow = (lineNum: string, label: string, value: number) => {
    drawText(lineNum, 60, 9, { font: fontBold })
    drawText(label, 84, 9)
    drawText(formatDollars(value), 470, 9, { font: fontBold })
    y -= 18
  }

  const positiveDeductible = bizResults
    .filter((r: QBIBusinessResult) => r.deductibleQBI > 0)
    .reduce((sum: number, r: QBIBusinessResult) => sum + r.deductibleQBI, 0)
  drawSummaryRow('27', 'Total QBI component from all businesses', positiveDeductible)

  drawSummaryRow('33', 'Taxable income limitation (20% of taxable income)', result.taxableIncomeComponent)

  y -= 6
  drawLine(56, 556)
  y -= 8

  page.drawRectangle({ x: 440, y: y - 4, width: 116, height: 20, color: lightGray })
  drawText('39', 60, 10, { font: fontBold })
  drawText('Total qualified business income deduction', 84, 9, { font: fontBold })
  drawText(formatDollars(result.deductionAmount), 470, 10, { font: fontBold })
  y -= 24

  drawText('Enter on Form 1040, Line 13', 84, 8, { font: fontItalic, color: gray })
  y -= 30

  drawLine(56, 556)
  y -= 8
  drawText('Generated by OpenTax — Form 8995-A (Above-Threshold QBI Deduction)', 56, 7, { color: gray })

  return pdfDoc
}

// ── Public API ──────────────────────────────────────────────────

export async function fillForm8995A(
  taxReturn: TaxReturn,
  result: QBIDeductionResult,
  templateBytes?: Uint8Array,
): Promise<PDFDocument> {
  if (templateBytes) {
    return fillForm8995ATemplate(templateBytes, taxReturn, result)
  }
  return generateForm8995A(taxReturn, result)
}
