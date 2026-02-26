/**
 * OR Form OR-40 PDF filler.
 *
 * Fills the official Oregon Form OR-40 (Individual Income Tax Return)
 * template from computed OR-40 results. Falls back to programmatic
 * generation when no template is available.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { FormOR40Result } from '../../rules/2025/or/or40'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

// ── Programmatic fallback generator ──────────────────────────────

async function generateFormOR40(
  taxReturn: TaxReturn,
  or40: FormOR40Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const darkBlue = rgb(0.05, 0.15, 0.4)

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
  draw('Oregon Form OR-40', 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw('Individual Income Tax Return \u2014 2025', 72, 10, { color: gray })
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

  if (or40.residencyType !== 'full-year') {
    draw(`Residency: ${or40.residencyType} (ratio: ${or40.apportionmentRatio.toFixed(4)})`, 90, 9)
    y -= 14
  }
  y -= 10

  // Income
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal adjusted gross income', '7', `$${formatDollars(or40.federalAGI)}`)
  if (or40.orAdditions > 0) drawLine('OR additions', '8', `$${formatDollars(or40.orAdditions)}`)
  if (or40.usGovInterest > 0) drawLine('US gov obligation interest', '11', `($${formatDollars(or40.usGovInterest)})`)
  if (or40.orSubtractions > 0) drawLine('Total OR subtractions', '14', `($${formatDollars(or40.orSubtractions)})`)
  drawLine('Oregon adjusted gross income', '15', `$${formatDollars(or40.orAGI)}`, { bold: true })
  y -= 6

  // Deductions
  draw('Deductions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine(`OR ${or40.deductionMethod} deduction`, '17', `$${formatDollars(or40.deductionUsed)}`)
  drawLine('OR taxable income', '19', `$${formatDollars(or40.orTaxableIncome)}`, { bold: true })
  y -= 6

  // Tax & Credits
  draw('Tax & Credits', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('OR tax (from rate schedule)', '20', `$${formatDollars(or40.orTax)}`)
  if (or40.personalExemptionCredit > 0) {
    drawLine(`Personal exemption credit (${or40.personalExemptionCount} x $236)`, '36', `($${formatDollars(or40.personalExemptionCredit)})`)
  }
  if (or40.orEITC > 0) drawLine('Oregon Earned Income Credit', '37', `($${formatDollars(or40.orEITC)})`)
  if (or40.totalCredits > 0) drawLine('Total credits', '38', `($${formatDollars(or40.totalCredits)})`)
  drawLine('Tax after credits', '39', `$${formatDollars(or40.taxAfterCredits)}`, { bold: true })
  y -= 6

  // Payments
  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (or40.stateWithholding > 0) drawLine('OR state income tax withheld', '42', `$${formatDollars(or40.stateWithholding)}`)
  drawLine('Total payments', '45', `$${formatDollars(or40.totalPayments)}`, { bold: true })
  y -= 6

  // Result
  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (or40.overpaid > 0) {
    drawLine('Overpaid (refund)', '47', `$${formatDollars(or40.overpaid)}`, { bold: true })
  } else if (or40.amountOwed > 0) {
    drawLine('Amount you owe', '50', `$${formatDollars(or40.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  draw('Generated by OpenTax \u2014 for review purposes. File using official OR Form OR-40.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const orFormCompiler: StateFormCompiler = {
  stateCode: 'OR',

  templateFiles: ['or40.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const or40 = stateResult.detail as FormOR40Result

    // For now, always use programmatic generation since field names
    // may differ between form versions. Template-based filling can be
    // added when official 2025 field mappings are confirmed.
    const doc = await generateFormOR40(taxReturn, or40)

    return {
      doc,
      forms: [
        {
          formId: 'OR Form OR-40',
          sequenceNumber: 'OR-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
