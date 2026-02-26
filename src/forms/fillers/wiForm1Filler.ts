/**
 * WI Form 1 PDF filler.
 *
 * Fills the official Wisconsin Form 1 (Individual Income Tax Return)
 * template from computed Form 1 results. Falls back to programmatic
 * generation when no template is available.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { WIForm1Result } from '../../rules/2025/wi/form1'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

// ── Programmatic fallback generator ──────────────────────────────

async function generateWIForm1(
  taxReturn: TaxReturn,
  wi: WIForm1Result,
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
  draw('Wisconsin Form 1', 72, 16, { font: fontBold, color: darkBlue })
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

  if (wi.residencyType !== 'full-year') {
    draw(`Residency: ${wi.residencyType} (ratio: ${wi.apportionmentRatio.toFixed(4)})`, 90, 9)
    y -= 14
  }
  y -= 10

  // Income
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal adjusted gross income', '1', `$${formatDollars(wi.federalAGI)}`)
  if (wi.wiAdditions > 0) drawLine('WI additions', '2', `$${formatDollars(wi.wiAdditions)}`)
  if (wi.ssExemption > 0) drawLine('Social Security exemption', '5', `($${formatDollars(wi.ssExemption)})`)
  if (wi.usGovInterest > 0) drawLine('US gov obligation interest', '6', `($${formatDollars(wi.usGovInterest)})`)
  if (wi.wiSubtractions > 0) drawLine('Total WI subtractions', '7', `($${formatDollars(wi.wiSubtractions)})`)
  drawLine('Wisconsin adjusted gross income', '8', `$${formatDollars(wi.wiAGI)}`, { bold: true })
  y -= 6

  // Deductions & Exemptions
  draw('Deductions & Exemptions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine(`WI ${wi.deductionMethod} deduction`, '9', `$${formatDollars(wi.deductionUsed)}`)
  drawLine(`Personal exemptions (${wi.numExemptions} x $700)`, '10', `$${formatDollars(wi.personalExemptions)}`)
  drawLine('WI taxable income', '11', `$${formatDollars(wi.wiTaxableIncome)}`, { bold: true })
  y -= 6

  // Tax & Credits
  draw('Tax & Credits', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('WI tax (from rate schedule)', '12', `$${formatDollars(wi.wiTax)}`)
  if (wi.wiEITC > 0) drawLine('WI Earned Income Credit', '13', `($${formatDollars(wi.wiEITC)})`)
  if (wi.wiItemizedDeductionCredit > 0) drawLine('WI Itemized Deduction Credit', '14', `($${formatDollars(wi.wiItemizedDeductionCredit)})`)
  if (wi.totalCredits > 0) drawLine('Total credits', '15', `($${formatDollars(wi.totalCredits)})`)
  drawLine('Tax after credits', '16', `$${formatDollars(wi.taxAfterCredits)}`, { bold: true })
  y -= 6

  // Payments
  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (wi.stateWithholding > 0) drawLine('WI state income tax withheld', '20', `$${formatDollars(wi.stateWithholding)}`)
  drawLine('Total payments', '22', `$${formatDollars(wi.totalPayments)}`, { bold: true })
  y -= 6

  // Result
  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (wi.overpaid > 0) {
    drawLine('Overpaid (refund)', '28', `$${formatDollars(wi.overpaid)}`, { bold: true })
  } else if (wi.amountOwed > 0) {
    drawLine('Amount you owe', '30', `$${formatDollars(wi.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  draw('Generated by OpenTax — for review purposes. File using official WI Form 1.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const wiFormCompiler: StateFormCompiler = {
  stateCode: 'WI',

  templateFiles: ['form1.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const wi = stateResult.detail as WIForm1Result

    // For now, always use programmatic generation since field names in the
    // official template may differ between years. Template-based filling can
    // be added when official 2025 field mappings are confirmed.
    const doc = await generateWIForm1(taxReturn, wi)

    return {
      doc,
      forms: [
        {
          formId: 'WI Form 1',
          sequenceNumber: 'WI-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
