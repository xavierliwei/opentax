/**
 * Form 8995-A (Qualified Business Income Deduction — Above Threshold)
 *
 * Programmatically generated PDF (no IRS template available).
 * Used when taxable income exceeds the QBI threshold:
 *   $191,950 (single/MFS/HOH) / $383,900 (MFJ/QW).
 *
 * Layout mirrors IRS Form 8995-A structure:
 *   Page 1:
 *     Header: Name, SSN
 *     Part I: Trade or Business Name and Taxpayer ID
 *     Part II: W-2 Wages and Qualified Property (UBIA)
 *     Part III: QBI Deduction Summary
 *
 * Warnings are emitted for unsupported sub-paths (e.g., SSTB phase-in,
 * aggregation elections, patron reduction) as IRS-visible notes.
 *
 * Source: IRS Form 8995-A, IRC §199A
 * All amounts in integer cents.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { QBIDeductionResult, QBIBusinessResult } from '../../rules/2025/qbiDeduction'
import { formatDollars, formatSSN } from '../helpers'

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

  // Aggregation election not supported
  warnings.push(
    'Note: Aggregation elections (multiple businesses treated as one) are not yet supported. ' +
    'Each business is computed individually.',
  )

  // Patron reduction not supported
  // (This is a rare case for cooperatives — just note it)

  return warnings
}

export async function fillForm8995A(
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
  const warningBg = rgb(1.0, 0.96, 0.88) // light yellow

  // ── Page 1 ──────────────────────────────────────────────────
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
  drawText('OMB No. 1545-0123  |  Attachment Sequence No. 55A', 56, 7, { color: gray })
  y -= 14

  drawLine(56, 556)
  y -= 6

  // Taxpayer name and SSN
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
      // Wrap long warning text
      const maxChars = 85
      const lines = []
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
    // Column headers
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

      // Annotations
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
    // Detail rows for each business
    page.drawRectangle({ x: 56, y: y - 2, width: 500, height: 16, color: lightGray })
    drawText('Business', 60, 7, { font: fontBold })
    drawText('50% W-2', 210, 7, { font: fontBold })
    drawText('25% W-2 + 2.5% UBIA', 300, 7, { font: fontBold })
    drawText('Wage Limit', 435, 7, { font: fontBold })
    y -= 20

    for (const biz of bizResults) {
      if (biz.qbi <= 0 || biz.sstbExcluded) continue
      ensureSpace(20)

      // We don't have the original W-2/UBIA inputs here, but we show the computed limitation
      const nameDisplay = biz.name.length > 22 ? biz.name.slice(0, 19) + '...' : biz.name
      drawText(nameDisplay, 60, 8)
      drawText('—', 230, 8, { color: gray }) // Detail not in result
      drawText('—', 340, 8, { color: gray }) // Detail not in result
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
  drawText('Part III — QBI Deduction Summary', 56, 11, { font: fontBold })
  y -= 22

  const drawSummaryRow = (lineNum: string, label: string, value: number) => {
    drawText(lineNum, 60, 9, { font: fontBold })
    drawText(label, 84, 9)
    drawText(formatDollars(value), 470, 9, { font: fontBold })
    y -= 18
  }

  // Positive deductible
  const positiveDeductible = bizResults
    .filter(r => r.deductibleQBI > 0)
    .reduce((sum, r) => sum + r.deductibleQBI, 0)
  drawSummaryRow('15', 'Total deductible QBI from all businesses', positiveDeductible)

  // Losses
  const totalLosses = bizResults
    .filter(r => r.qbi < 0)
    .reduce((sum, r) => sum + r.qbi, 0)
  if (totalLosses < 0) {
    drawSummaryRow('16', 'Total QBI losses (20% carryover)', Math.round(totalLosses * 0.20))
  }

  // Combined
  const combinedDeductible = Math.max(0, positiveDeductible + Math.round(totalLosses * 0.20))
  drawSummaryRow('17', 'Combined QBI deductible amount', combinedDeductible)

  // Taxable income component
  drawSummaryRow('33', 'Taxable income limitation (20% of taxable income)', result.taxableIncomeComponent)

  y -= 6
  drawLine(56, 556)
  y -= 8

  // Final deduction
  page.drawRectangle({ x: 440, y: y - 4, width: 116, height: 20, color: lightGray })
  drawText('34', 60, 10, { font: fontBold })
  drawText('Qualified business income deduction (lesser of Line 17 or Line 33)', 84, 9, { font: fontBold })
  drawText(formatDollars(result.deductionAmount), 470, 10, { font: fontBold })
  y -= 24

  drawText('Enter on Form 1040, Line 13', 84, 8, { font: fontItalic, color: gray })
  y -= 30

  // ── Footer ──────────────────────────────────────────────────
  drawLine(56, 556)
  y -= 8
  drawText('Generated by OpenTax — Form 8995-A (Above-Threshold QBI Deduction)', 56, 7, { color: gray })

  return pdfDoc
}
