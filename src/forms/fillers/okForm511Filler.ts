/**
 * OK Form 511 PDF filler.
 *
 * Fills the official Oklahoma Form 511 (Individual Income Tax Return)
 * template from computed Form 511 results. Falls back to programmatic
 * generation when no template is available.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { Form511Result } from '../../rules/2025/ok/form511'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

// ── Programmatic fallback generator ──────────────────────────────

async function generateForm511(
  taxReturn: TaxReturn,
  ok: Form511Result,
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
  draw('Oklahoma Form 511', 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw('Individual Income Tax Return — 2025', 72, 10, { color: gray })
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

  if (ok.residencyType !== 'full-year') {
    draw(`Residency: ${ok.residencyType} (ratio: ${ok.apportionmentRatio.toFixed(4)})`, 90, 9)
    y -= 14
  }
  y -= 10

  // Income
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal adjusted gross income', '1', `$${formatDollars(ok.federalAGI)}`)
  if (ok.okAdditions > 0) drawLine('OK additions', '2', `$${formatDollars(ok.okAdditions)}`)
  if (ok.ssExemption > 0) drawLine('Social Security exemption', '5', `($${formatDollars(ok.ssExemption)})`)
  if (ok.usGovInterest > 0) drawLine('US gov obligation interest', '6', `($${formatDollars(ok.usGovInterest)})`)
  if (ok.militaryRetirement > 0) drawLine('Military retirement exemption', '7', `($${formatDollars(ok.militaryRetirement)})`)
  if (ok.okSubtractions > 0) drawLine('Total OK subtractions', '8', `($${formatDollars(ok.okSubtractions)})`)
  drawLine('Oklahoma adjusted gross income', '9', `$${formatDollars(ok.okAGI)}`, { bold: true })
  y -= 6

  // Deductions & Exemptions
  draw('Deductions & Exemptions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine(`OK ${ok.deductionMethod} deduction`, '10', `$${formatDollars(ok.deductionUsed)}`)
  drawLine(`Personal exemptions ($1,000 x ${ok.personalExemptionCount})`, '11', `$${formatDollars(ok.personalExemptions)}`)
  drawLine('OK taxable income', '12', `$${formatDollars(ok.okTaxableIncome)}`, { bold: true })
  y -= 6

  // Tax & Credits
  draw('Tax & Credits', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('OK tax (from rate schedule)', '13', `$${formatDollars(ok.okTax)}`)
  if (ok.okEITC > 0) drawLine('OK Earned Income Credit', '14', `($${formatDollars(ok.okEITC)})`)
  if (ok.okChildTaxCredit > 0) drawLine('OK Child Tax Credit', '15', `($${formatDollars(ok.okChildTaxCredit)})`)
  if (ok.totalCredits > 0) drawLine('Total credits', '16', `($${formatDollars(ok.totalCredits)})`)
  drawLine('Tax after credits', '17', `$${formatDollars(ok.taxAfterCredits)}`, { bold: true })
  y -= 6

  // Payments
  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (ok.stateWithholding > 0) drawLine('OK state income tax withheld', '20', `$${formatDollars(ok.stateWithholding)}`)
  drawLine('Total payments', '22', `$${formatDollars(ok.totalPayments)}`, { bold: true })
  y -= 6

  // Result
  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (ok.overpaid > 0) {
    drawLine('Overpaid (refund)', '28', `$${formatDollars(ok.overpaid)}`, { bold: true })
  } else if (ok.amountOwed > 0) {
    drawLine('Amount you owe', '30', `$${formatDollars(ok.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  draw('Generated by OpenTax — for review purposes. File using official OK Form 511.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const okFormCompiler: StateFormCompiler = {
  stateCode: 'OK',

  templateFiles: ['form511.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const ok = stateResult.detail as Form511Result

    // For now, always use programmatic generation since we don't have
    // official template field mappings. Template-based filling can be
    // added when official 2025 field mappings are confirmed.
    const doc = await generateForm511(taxReturn, ok)

    return {
      doc,
      forms: [
        {
          formId: 'OK Form 511',
          sequenceNumber: 'OK-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
