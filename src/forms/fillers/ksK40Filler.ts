/**
 * KS Form K-40 PDF filler.
 *
 * Fills the official Kansas Form K-40 (Individual Income Tax Return) template
 * from computed K-40 results. Falls back to programmatic generation when no
 * template is available.
 *
 * Because the official KS K-40 PDF may be a flat (non-fillable) form, this
 * filler uses programmatic generation as the primary path.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { FormK40Result } from '../../rules/2025/ks/k40'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

// ── Programmatic generator ──────────────────────────────────────

async function generateFormK40(
  taxReturn: TaxReturn,
  formK40: FormK40Result,
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
  draw('Kansas Form K-40', 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw('Individual Income Tax Return — 2025', 72, 10, { color: gray })
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
  if (formK40.residencyType !== 'full-year') {
    draw(`Residency: ${formK40.residencyType}`, 90, 9)
    if (formK40.apportionmentRatio < 1) {
      draw(`Apportionment: ${(formK40.apportionmentRatio * 100).toFixed(1)}%`, 300, 9)
    }
    y -= 14
  }

  // ── Income ───────────────────────────────────────────────────
  y -= 8
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal AGI', '1', `$${formatDollars(formK40.federalAGI)}`)
  if (formK40.ksAdditions > 0) {
    drawLine('KS additions', '2a', `$${formatDollars(formK40.ksAdditions)}`)
  }
  if (formK40.ksSubtractions > 0) {
    drawLine('KS subtractions', '2b', `($${formatDollars(formK40.ksSubtractions)})`)
  }
  drawLine('Kansas AGI', '3', `$${formatDollars(formK40.ksAGI)}`, { bold: true })

  // ── Deductions & Exemptions ──────────────────────────────────
  y -= 8
  draw('Deductions & Exemptions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('KS standard deduction', '4', `$${formatDollars(formK40.ksStandardDeduction)}`)
  drawLine(`Personal exemptions (${formK40.numExemptions} x $2,250)`, '5', `$${formatDollars(formK40.personalExemptions)}`)
  drawLine('Taxable income', '7', `$${formatDollars(formK40.ksTaxableIncome)}`, { bold: true })

  // ── Tax, Credits, and Payments ───────────────────────────────
  y -= 8
  draw('Tax, Credits, and Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('KS tax (graduated)', '8', `$${formatDollars(formK40.ksTax)}`)
  if (formK40.dependentCareCredit > 0) {
    drawLine('Dependent care credit', '13', `($${formatDollars(formK40.dependentCareCredit)})`)
  }
  drawLine('Tax after credits', '15', `$${formatDollars(formK40.taxAfterCredits)}`, { bold: true })

  if (formK40.foodSalesTaxCredit > 0) {
    drawLine('Food sales tax credit (refundable)', '20', `$${formatDollars(formK40.foodSalesTaxCredit)}`)
  }
  if (formK40.stateWithholding > 0) {
    drawLine('KS withholding', '22', `$${formatDollars(formK40.stateWithholding)}`)
  }
  drawLine('Total payments', '25', `$${formatDollars(formK40.totalPayments)}`, { bold: true })

  // ── Result ───────────────────────────────────────────────────
  y -= 8
  if (formK40.overpaid > 0) {
    drawLine('Refund', '31', `$${formatDollars(formK40.overpaid)}`, { bold: true })
  } else if (formK40.amountOwed > 0) {
    drawLine('Amount owed', '29', `$${formatDollars(formK40.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 20
  draw('Generated by OpenTax for review. File with official KS Form K-40.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const ksFormCompiler: StateFormCompiler = {
  stateCode: 'KS',
  templateFiles: ['k40.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const formK40 = stateResult.detail as FormK40Result

    // Use programmatic generation (official KS PDF is flat/non-fillable)
    const doc = await generateFormK40(taxReturn, formK40)

    return {
      doc,
      forms: [{
        formId: stateResult.formLabel,
        sequenceNumber: 'KS-01',
        pageCount: doc.getPageCount(),
      }],
    }
  },
}
