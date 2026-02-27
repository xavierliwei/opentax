/**
 * DE Form 200-01 PDF filler.
 *
 * Fills the official Delaware Form 200-01 (Individual Income Tax Return) template
 * from computed Form 200 results. Falls back to programmatic generation when no
 * template is available.
 *
 * Because the official DE Form 200-01 PDF may be a flat (non-fillable) form, this
 * filler uses programmatic generation as the primary path.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { Form200Result } from '../../rules/2025/de/form200'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

// ── Programmatic generator ──────────────────────────────────────

async function generateForm200(
  taxReturn: TaxReturn,
  form200: Form200Result,
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

  // ── Title ────────────────────────────────────────────────────
  draw('Delaware Form 200-01', 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw('Individual Income Tax Return \u2014 2025', 72, 10, { color: gray })
  y -= 6
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: darkBlue })
  y -= 20

  // ── Taxpayer Info ────────────────────────────────────────────
  draw('Taxpayer Information', 72, 11, { font: fontBold })
  y -= 16
  draw(`Name: ${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`, 90, 9)
  y -= 14
  draw(`SSN: ${formatSSN(taxReturn.taxpayer.ssn || '000000000')}`, 90, 9)
  draw(`Filing Status: ${filingStatusLabel(taxReturn.filingStatus)}`, 300, 9)
  y -= 14
  if (taxReturn.spouse) {
    draw(`Spouse: ${taxReturn.spouse.firstName} ${taxReturn.spouse.lastName}`, 90, 9)
    draw(`SSN: ${formatSSN(taxReturn.spouse.ssn || '000000000')}`, 300, 9)
    y -= 14
  }
  if (form200.residencyType !== 'full-year') {
    draw(`Residency: ${form200.residencyType}`, 90, 9)
    if (form200.apportionmentRatio < 1) {
      draw(`Apportionment: ${(form200.apportionmentRatio * 100).toFixed(1)}%`, 300, 9)
    }
    y -= 14
  }

  // ── Income ───────────────────────────────────────────────────
  y -= 8
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal AGI', '1', `$${formatDollars(form200.federalAGI)}`)
  if (form200.deAdditions > 0) {
    drawLine('DE additions', '2a', `$${formatDollars(form200.deAdditions)}`)
  }
  if (form200.deSubtractions > 0) {
    drawLine('DE subtractions', '2b', `($${formatDollars(form200.deSubtractions)})`)
  }
  drawLine('Delaware AGI', '11', `$${formatDollars(form200.deAGI)}`, { bold: true })

  // ── Deductions ─────────────────────────────────────────────
  y -= 8
  draw('Deductions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('DE standard deduction', '12', `$${formatDollars(form200.deStandardDeduction)}`)
  drawLine('Taxable income', '17', `$${formatDollars(form200.deTaxableIncome)}`, { bold: true })

  // ── Tax, Credits, and Payments ───────────────────────────────
  y -= 8
  draw('Tax, Credits, and Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('DE tax (graduated)', '18', `$${formatDollars(form200.deTax)}`)
  if (form200.personalCredit > 0) {
    drawLine(`Personal credit (${form200.numExemptions} x $110)`, '19', `($${formatDollars(form200.personalCredit)})`)
  }
  drawLine('Tax after credits', '21', `$${formatDollars(form200.taxAfterCredits)}`, { bold: true })

  if (form200.stateWithholding > 0) {
    drawLine('DE withholding', '27', `$${formatDollars(form200.stateWithholding)}`)
  }
  drawLine('Total payments', '30', `$${formatDollars(form200.totalPayments)}`, { bold: true })

  // ── Result ───────────────────────────────────────────────────
  y -= 8
  if (form200.overpaid > 0) {
    drawLine('Refund', '34', `$${formatDollars(form200.overpaid)}`, { bold: true })
  } else if (form200.amountOwed > 0) {
    drawLine('Amount owed', '32', `$${formatDollars(form200.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 20
  draw('Generated by OpenTax for review. File with official DE Form 200-01.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const deFormCompiler: StateFormCompiler = {
  stateCode: 'DE',
  templateFiles: ['form200.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form200 = stateResult.detail as Form200Result

    // Use programmatic generation (official DE PDF is flat/non-fillable)
    const doc = await generateForm200(taxReturn, form200)

    return {
      doc,
      forms: [{
        formId: stateResult.formLabel,
        sequenceNumber: 'DE-01',
        pageCount: doc.getPageCount(),
      }],
    }
  },
}
