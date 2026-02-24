/**
 * NY IT-201 PDF generator.
 *
 * Generates a New York IT-201 (Resident Income Tax Return) PDF
 * from computed IT-201 results using pdf-lib.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { FormIT201Result } from '../../rules/2025/ny/formIT201'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

async function generateFormIT201(
  taxReturn: TaxReturn,
  ny: FormIT201Result,
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
  draw('New York Form IT-201', 72, 16, { font: fontBold, color: darkBlue })
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

  // Income
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal adjusted gross income', '1', `$${formatDollars(ny.federalAGI)}`)
  if (ny.nyAdditions > 0) drawLine('NY additions', '2', `$${formatDollars(ny.nyAdditions)}`)
  if (ny.ssExemption > 0) drawLine('Social Security exemption', '27', `($${formatDollars(ny.ssExemption)})`)
  if (ny.usGovInterest > 0) drawLine('US gov obligation interest', '28', `($${formatDollars(ny.usGovInterest)})`)
  if (ny.nySubtractions > 0) drawLine('Total NY subtractions', '32', `($${formatDollars(ny.nySubtractions)})`)
  drawLine('New York adjusted gross income', '33', `$${formatDollars(ny.nyAGI)}`, { bold: true })
  y -= 6

  // Deductions
  draw('Deductions & Exemptions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine(`NY ${ny.deductionMethod} deduction`, '34', `$${formatDollars(ny.deductionUsed)}`)
  if (ny.dependentExemption > 0) drawLine('Dependent exemption', '36', `$${formatDollars(ny.dependentExemption)}`)
  drawLine('NY taxable income', '37', `$${formatDollars(ny.nyTaxableIncome)}`, { bold: true })
  y -= 6

  // Tax & Credits
  draw('Tax & Credits', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('NY tax (from rate schedule)', '39', `$${formatDollars(ny.nyTax)}`)
  if (ny.nyEITC > 0) drawLine('NY Earned Income Tax Credit', '65', `($${formatDollars(ny.nyEITC)})`)
  if (ny.totalCredits > 0) drawLine('Total credits', '68', `($${formatDollars(ny.totalCredits)})`)
  drawLine('Tax after credits', '69', `$${formatDollars(ny.taxAfterCredits)}`, { bold: true })
  y -= 6

  // Payments
  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (ny.stateWithholding > 0) drawLine('NY state income tax withheld', '72', `$${formatDollars(ny.stateWithholding)}`)
  drawLine('Total payments', '76', `$${formatDollars(ny.totalPayments)}`, { bold: true })
  y -= 6

  // Result
  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (ny.overpaid > 0) {
    drawLine('Overpaid (refund)', '78', `$${formatDollars(ny.overpaid)}`, { bold: true })
  } else if (ny.amountOwed > 0) {
    drawLine('Amount you owe', '80', `$${formatDollars(ny.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  draw('Generated by OpenTax — for review purposes. File using official NY IT-201.', 72, 7, { color: gray })

  return pdfDoc
}

export const nyFormCompiler: StateFormCompiler = {
  stateCode: 'NY',
  templateFiles: [],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const it201 = stateResult.detail as FormIT201Result
    const doc = await generateFormIT201(taxReturn, it201)

    return {
      doc,
      forms: [
        {
          formId: 'NY Form IT-201',
          sequenceNumber: 'NY-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
