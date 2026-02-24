/**
 * VA Form 760 PDF generator.
 *
 * Generates a Virginia Form 760 (Resident Income Tax Return) PDF
 * from computed Form 760 results. Uses programmatic generation
 * via pdf-lib (no official template bundled).
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { Form760Result } from '../../rules/2025/va/form760'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

// ── Programmatic generator ────────────────────────────────────────

async function generateForm760(
  taxReturn: TaxReturn,
  form760: Form760Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const darkBlue = rgb(0.1, 0.15, 0.35)

  const page1 = pdfDoc.addPage([612, 792])
  let y = 750

  const draw = (text: string, x: number, size: number, opts?: { font?: typeof font; color?: typeof black }) => {
    page1.drawText(text, { x, y, size, font: opts?.font ?? font, color: opts?.color ?? black })
  }

  const drawLine = (label: string, lineNum: string, value: string, opts?: { bold?: boolean }) => {
    draw(`Line ${lineNum}`, 72, 9, { color: gray })
    draw(label, 120, 9, opts?.bold ? { font: fontBold } : undefined)
    draw(value, 460, 9, { font: fontBold })
    y -= 16
  }

  // Header
  const isPartYear = form760.residencyType === 'part-year'
  const formTitle = isPartYear ? 'Virginia Form 760PY' : 'Virginia Form 760'
  const formSubtitle = isPartYear
    ? `Part-Year Resident Income Tax Return — 2025 (${Math.round(form760.apportionmentRatio * 100)}% VA)`
    : 'Resident Income Tax Return — 2025'
  draw(formTitle, 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw(formSubtitle, 72, 10, { color: gray })
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

  drawLine('Federal adjusted gross income', '1', `$${formatDollars(form760.federalAGI)}`)

  if (form760.vaAdjustments.additions > 0) {
    drawLine('Schedule ADJ additions', '2', `$${formatDollars(form760.vaAdjustments.additions)}`)
  }
  if (form760.vaAdjustments.subtractions > 0) {
    drawLine('Schedule ADJ subtractions', '4', `($${formatDollars(form760.vaAdjustments.subtractions)})`)
  }

  drawLine('Virginia adjusted gross income', '5', `$${formatDollars(form760.vaAGI)}`, { bold: true })

  if (form760.vaSourceIncome !== undefined) {
    draw(`Apportionment: ${Math.round(form760.apportionmentRatio * 100)}% — VA-source income: $${formatDollars(form760.vaSourceIncome)}`, 120, 8, { color: gray })
    y -= 14
  }
  y -= 6

  // ── Deductions & Exemptions Section ───────────────────────
  draw('Deductions & Exemptions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  const dedLabel = form760.deductionMethod === 'itemized'
    ? 'VA itemized deductions'
    : 'VA standard deduction'
  drawLine(dedLabel, '6', `$${formatDollars(form760.deductionUsed)}`)

  drawLine('Personal exemptions', '7', `$${formatDollars(form760.totalExemptions)}`)

  drawLine('Virginia taxable income', '9', `$${formatDollars(form760.vaTaxableIncome)}`, { bold: true })
  y -= 6

  // ── Tax Section ─────────────────────────────────────────────
  draw('Tax & Credits', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Virginia income tax', '10', `$${formatDollars(form760.vaTax)}`)

  if (form760.lowIncomeCredit > 0) {
    drawLine('Low-income credit', '12', `($${formatDollars(form760.lowIncomeCredit)})`)
  }

  drawLine('Tax after credits', '13', `$${formatDollars(form760.taxAfterCredits)}`, { bold: true })
  y -= 6

  // ── Payments Section ────────────────────────────────────────
  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (form760.stateWithholding > 0) {
    drawLine('VA state income tax withheld', '18', `$${formatDollars(form760.stateWithholding)}`)
  }

  drawLine('Total payments', '25', `$${formatDollars(form760.totalPayments)}`, { bold: true })
  y -= 6

  // ── Result Section ──────────────────────────────────────────
  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (form760.overpaid > 0) {
    drawLine('Overpaid (refund)', '27', `$${formatDollars(form760.overpaid)}`, { bold: true })
  } else if (form760.amountOwed > 0) {
    drawLine('Amount you owe', '35', `$${formatDollars(form760.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  const officialForm = isPartYear ? 'VA Form 760PY' : 'VA Form 760'
  draw(`Generated by OpenTax — for review purposes. File using official ${officialForm}.`, 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const vaFormCompiler: StateFormCompiler = {
  stateCode: 'VA',

  templateFiles: ['f760.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form760 = stateResult.detail as Form760Result
    const doc = await generateForm760(taxReturn, form760)

    const formId = form760.residencyType === 'part-year' ? 'VA Form 760PY' : 'VA Form 760'

    return {
      doc,
      forms: [
        {
          formId,
          sequenceNumber: 'VA-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
