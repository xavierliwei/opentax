/**
 * CA Form 540 PDF generator.
 *
 * Generates a California Form 540 (Resident Income Tax Return) PDF
 * from computed Form 540 results.
 *
 * Currently generates programmatically using pdf-lib since the official
 * FTB template is not bundled. Can be upgraded to template-based filling
 * when the official f540.pdf is available in public/forms/state/CA/.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { Form540Result } from '../../rules/2025/ca/form540'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

// ── Programmatic generator ────────────────────────────────────────

async function generateForm540(
  taxReturn: TaxReturn,
  form540: Form540Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const darkBlue = rgb(0.1, 0.15, 0.35)

  // ── Page 1 ────────────────────────────────────────────────────
  const page1 = pdfDoc.addPage([612, 792])
  let y = 750

  const draw = (text: string, x: number, size: number, opts?: { font?: typeof font; color?: typeof black }) => {
    page1.drawText(text, { x, y, size, font: opts?.font ?? font, color: opts?.color ?? black })
  }

  const drawLine = (label: string, lineNum: string, value: string, opts?: { bold?: boolean }) => {
    draw(`Line ${lineNum}`, 72, 9, { color: gray })
    draw(label, 120, 9, opts?.bold ? { font: fontBold } : undefined)
    draw(value, 460, 9, opts?.bold ? { font: fontBold } : { font: fontBold })
    y -= 16
  }

  // Header
  draw('California Form 540', 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw('Resident Income Tax Return — 2025', 72, 10, { color: gray })
  y -= 6
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: darkBlue })
  y -= 20

  // Taxpayer info
  draw('Taxpayer Information', 72, 11, { font: fontBold })
  y -= 16
  const tp = taxReturn.taxpayer
  draw(`Name: ${tp.firstName} ${tp.lastName}`, 90, 9)
  y -= 14
  draw(`SSN: ${formatSSN(tp.ssn || '000000000')}`, 90, 9)
  draw(`Filing Status: ${filingStatusLabel(taxReturn.filingStatus)}`, 300, 9)
  y -= 14
  draw(`Address: ${tp.address.street}, ${tp.address.city}, ${tp.address.state} ${tp.address.zip}`, 90, 9)
  y -= 14
  if (taxReturn.spouse) {
    draw(`Spouse: ${taxReturn.spouse.firstName} ${taxReturn.spouse.lastName}   SSN: ${formatSSN(taxReturn.spouse.ssn)}`, 90, 9)
    y -= 14
  }
  y -= 10

  // ── Income Section ──────────────────────────────────────────
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal adjusted gross income', '13', `$${formatDollars(form540.federalAGI)}`)

  if (form540.caAdjustments.additions > 0) {
    drawLine('Schedule CA additions', '14', `$${formatDollars(form540.caAdjustments.additions)}`)
  }
  if (form540.caAdjustments.subtractions > 0) {
    drawLine('Schedule CA subtractions', '16', `($${formatDollars(form540.caAdjustments.subtractions)})`)
  }

  drawLine('California adjusted gross income', '17', `$${formatDollars(form540.caAGI)}`, { bold: true })
  y -= 6

  // ── Deductions Section ──────────────────────────────────────
  draw('Deductions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  const dedLabel = form540.deductionMethod === 'itemized'
    ? 'CA itemized deductions'
    : 'CA standard deduction'
  drawLine(dedLabel, '18', `$${formatDollars(form540.deductionUsed)}`)

  if (form540.deductionMethod === 'itemized') {
    draw(`(Standard: $${formatDollars(form540.caStandardDeduction)} vs Itemized: $${formatDollars(form540.caItemizedDeduction)})`, 120, 8, { color: gray })
    y -= 14
  }

  drawLine('California taxable income', '19', `$${formatDollars(form540.caTaxableIncome)}`, { bold: true })
  y -= 6

  // ── Tax Section ─────────────────────────────────────────────
  draw('Tax', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Tax (from tax rate schedule)', '31', `$${formatDollars(form540.caTax)}`)

  if (form540.totalExemptionCredits > 0) {
    drawLine('Exemption credits', '32', `($${formatDollars(form540.totalExemptionCredits)})`)
  }

  if (form540.mentalHealthTax > 0) {
    drawLine('Mental health services tax (1%)', '36', `$${formatDollars(form540.mentalHealthTax)}`)
  }

  if (form540.rentersCredit > 0) {
    drawLine("Renter's credit", '46', `($${formatDollars(form540.rentersCredit)})`)
  }

  drawLine('Tax after credits', '48', `$${formatDollars(form540.taxAfterCredits)}`, { bold: true })
  y -= 6

  // ── Payments Section ────────────────────────────────────────
  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (form540.stateWithholding > 0) {
    drawLine('CA state income tax withheld', '71', `$${formatDollars(form540.stateWithholding)}`)
  }

  drawLine('Total payments', '77', `$${formatDollars(form540.totalPayments)}`, { bold: true })
  y -= 6

  // ── Result Section ──────────────────────────────────────────
  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (form540.overpaid > 0) {
    drawLine('Overpaid (refund)', '93', `$${formatDollars(form540.overpaid)}`, { bold: true })
  } else if (form540.amountOwed > 0) {
    drawLine('Amount you owe', '97', `$${formatDollars(form540.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  draw('Generated by OpenTax — for review purposes. File using official FTB Form 540.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const caFormCompiler: StateFormCompiler = {
  stateCode: 'CA',

  templateFiles: ['f540.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form540 = stateResult.detail as Form540Result

    // Generate programmatically (no official template yet)
    const doc = await generateForm540(taxReturn, form540)

    return {
      doc,
      forms: [
        {
          formId: 'CA Form 540',
          sequenceNumber: 'CA-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
