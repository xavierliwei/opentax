/**
 * MO-1040 PDF filler.
 *
 * Fills the official Missouri Form MO-1040 (Individual Income Tax Return)
 * template from computed MO-1040 results. Falls back to programmatic
 * generation when no template is available.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { MO1040Result } from '../../rules/2025/mo/mo1040'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

// ── Programmatic fallback generator ──────────────────────────────

async function generateMO1040(
  taxReturn: TaxReturn,
  mo1040: MO1040Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const darkBlue = rgb(0.1, 0.15, 0.35)

  const page = pdfDoc.addPage([612, 792])
  let y = 750

  const draw = (text: string, x: number, size: number, opts?: { font?: typeof font; color?: typeof black }) => {
    page.drawText(text, { x, y, size, font: opts?.font ?? font, color: opts?.color ?? black })
  }

  const drawLine = (label: string, lineNum: string, value: string, opts?: { bold?: boolean }) => {
    draw(`Line ${lineNum}`, 72, 9, { color: gray })
    draw(label, 120, 9, opts?.bold ? { font: fontBold } : undefined)
    draw(value, 460, 9, { font: fontBold })
    y -= 16
  }

  // ── Header ──────────────────────────────────────────────
  draw('Missouri Form MO-1040', 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw('Individual Income Tax Return \u2014 2025', 72, 10, { color: gray })
  y -= 6
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: darkBlue })
  y -= 20

  // ── Taxpayer Info ───────────────────────────────────────
  draw('Taxpayer Information', 72, 11, { font: fontBold })
  y -= 16
  draw(`Name: ${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`, 90, 9)
  y -= 14
  draw(`SSN: ${formatSSN(taxReturn.taxpayer.ssn || '000000000')}`, 90, 9)
  draw(`Filing Status: ${filingStatusLabel(taxReturn.filingStatus)}`, 300, 9)
  y -= 14
  if (mo1040.residencyType !== 'full-year') {
    draw(`Residency: ${mo1040.residencyType === 'part-year' ? 'Part-Year Resident' : 'Nonresident'}`, 90, 9)
    y -= 14
  }

  // ── Income Section ──────────────────────────────────────
  y -= 8
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal AGI', '1', `$${formatDollars(mo1040.federalAGI)}`)
  if (mo1040.moAdjustments.additions > 0) {
    drawLine('MO additions', '2', `$${formatDollars(mo1040.moAdjustments.additions)}`)
  }
  if (mo1040.moAdjustments.subtractions > 0) {
    drawLine('MO subtractions', '4', `($${formatDollars(mo1040.moAdjustments.subtractions)})`)
  }
  drawLine('Missouri AGI', '6', `$${formatDollars(mo1040.moAGI)}`, { bold: true })

  // ── Deductions Section ──────────────────────────────────
  y -= 8
  draw('Deductions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Standard deduction', '7', `$${formatDollars(mo1040.moStandardDeduction)}`)
  drawLine('Federal tax deduction', '8', `$${formatDollars(mo1040.federalTaxDeduction)}`)
  drawLine('Total deductions', '9', `$${formatDollars(mo1040.totalDeductions)}`)
  drawLine('Taxable income', '10', `$${formatDollars(mo1040.moTaxableIncome)}`, { bold: true })

  // ── Tax & Credits Section ───────────────────────────────
  y -= 8
  draw('Tax, Credits, and Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('MO tax (2.0%\u20134.8%)', '11', `$${formatDollars(mo1040.moTax)}`)
  if (mo1040.totalCredits > 0) {
    drawLine('Credits', '27', `($${formatDollars(mo1040.totalCredits)})`)
  }
  drawLine('Tax after credits', '28', `$${formatDollars(mo1040.taxAfterCredits)}`, { bold: true })

  if (mo1040.stateWithholding > 0) {
    drawLine('MO withholding', '32', `$${formatDollars(mo1040.stateWithholding)}`)
  }
  drawLine('Total payments', '36', `$${formatDollars(mo1040.totalPayments)}`, { bold: true })

  // ── Result ──────────────────────────────────────────────
  if (mo1040.overpaid > 0) {
    drawLine('Refund', '41', `$${formatDollars(mo1040.overpaid)}`, { bold: true })
  } else if (mo1040.amountOwed > 0) {
    drawLine('Amount owed', '42', `$${formatDollars(mo1040.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  // ── Footer ──────────────────────────────────────────────
  y -= 20
  draw('Generated by OpenTax for review. File with official MO-1040.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const moFormCompiler: StateFormCompiler = {
  stateCode: 'MO',
  templateFiles: ['mo1040.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const mo1040 = stateResult.detail as MO1040Result

    // For now, use programmatic generation (template filling can be added later
    // once field positions are calibrated for the official MO-1040 PDF)
    const doc = await generateMO1040(taxReturn, mo1040)

    return {
      doc,
      forms: [{
        formId: stateResult.formLabel,
        sequenceNumber: 'MO-01',
        pageCount: doc.getPageCount(),
      }],
    }
  },
}
