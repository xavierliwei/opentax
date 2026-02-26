/**
 * MN Form M1 PDF filler.
 *
 * Fills the official Minnesota Form M1 (Individual Income Tax Return)
 * template from computed M1 results. Falls back to programmatic
 * generation when no template is available.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { FormM1Result } from '../../rules/2025/mn/formM1'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

// ── Programmatic fallback generator ──────────────────────────────

async function generateFormM1(
  taxReturn: TaxReturn,
  mn: FormM1Result,
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
  draw('Minnesota Form M1', 72, 16, { font: fontBold, color: darkBlue })
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

  if (mn.residencyType !== 'full-year') {
    draw(`Residency: ${mn.residencyType} (ratio: ${mn.apportionmentRatio.toFixed(4)})`, 90, 9)
    y -= 14
  }
  y -= 10

  // Income
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal adjusted gross income', '1', `$${formatDollars(mn.federalAGI)}`)
  if (mn.mnAdditions > 0) drawLine('MN additions', '2', `$${formatDollars(mn.mnAdditions)}`)
  if (mn.ssExemption > 0) drawLine('Social Security exemption', '5', `($${formatDollars(mn.ssExemption)})`)
  if (mn.usGovInterest > 0) drawLine('US gov obligation interest', '6', `($${formatDollars(mn.usGovInterest)})`)
  if (mn.mnSubtractions > 0) drawLine('Total MN subtractions', '7', `($${formatDollars(mn.mnSubtractions)})`)
  drawLine('Minnesota adjusted gross income', '8', `$${formatDollars(mn.mnAGI)}`, { bold: true })
  y -= 6

  // Deductions
  draw('Deductions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine(`MN ${mn.deductionMethod} deduction`, '9', `$${formatDollars(mn.deductionUsed)}`)
  drawLine('MN taxable income', '10', `$${formatDollars(mn.mnTaxableIncome)}`, { bold: true })
  y -= 6

  // Tax & Credits
  draw('Tax & Credits', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('MN tax (from rate schedule)', '11', `$${formatDollars(mn.mnTax)}`)
  if (mn.mnWorkingFamilyCredit > 0) drawLine('MN Working Family Credit', '12', `($${formatDollars(mn.mnWorkingFamilyCredit)})`)
  if (mn.mnChildTaxCredit > 0) drawLine('MN Child Tax Credit', '13', `($${formatDollars(mn.mnChildTaxCredit)})`)
  if (mn.totalCredits > 0) drawLine('Total credits', '14', `($${formatDollars(mn.totalCredits)})`)
  drawLine('Tax after credits', '15', `$${formatDollars(mn.taxAfterCredits)}`, { bold: true })
  y -= 6

  // Payments
  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (mn.stateWithholding > 0) drawLine('MN state income tax withheld', '20', `$${formatDollars(mn.stateWithholding)}`)
  drawLine('Total payments', '22', `$${formatDollars(mn.totalPayments)}`, { bold: true })
  y -= 6

  // Result
  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (mn.overpaid > 0) {
    drawLine('Overpaid (refund)', '28', `$${formatDollars(mn.overpaid)}`, { bold: true })
  } else if (mn.amountOwed > 0) {
    drawLine('Amount you owe', '30', `$${formatDollars(mn.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  draw('Generated by OpenTax — for review purposes. File using official MN Form M1.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const mnFormCompiler: StateFormCompiler = {
  stateCode: 'MN',

  templateFiles: ['m1.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const m1 = stateResult.detail as FormM1Result

    // For now, always use programmatic generation since we have the 2023
    // template (field names may differ). Template-based filling can be
    // added when official 2024/2025 field mappings are confirmed.
    const doc = await generateFormM1(taxReturn, m1)

    return {
      doc,
      forms: [
        {
          formId: 'MN Form M1',
          sequenceNumber: 'MN-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
