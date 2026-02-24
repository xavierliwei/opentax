/**
 * NJ-1040 PDF generator.
 *
 * Generates a New Jersey NJ-1040 (Resident Income Tax Return) PDF
 * from computed NJ-1040 results using pdf-lib.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { NJ1040Result } from '../../rules/2025/nj/formNJ1040'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

async function generateFormNJ1040(
  taxReturn: TaxReturn,
  nj: NJ1040Result,
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
  draw('New Jersey NJ-1040', 72, 16, { font: fontBold, color: darkBlue })
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

  if (nj.line15_wages > 0) drawLine('Wages, salaries, tips', '15', `$${formatDollars(nj.line15_wages)}`)
  if (nj.line16a_taxableInterest > 0) drawLine('Taxable interest', '16a', `$${formatDollars(nj.line16a_taxableInterest)}`)
  if (nj.line17_dividends > 0) drawLine('Dividends', '17', `$${formatDollars(nj.line17_dividends)}`)
  if (nj.line18_businessIncome !== 0) drawLine('Net business income', '18', `$${formatDollars(nj.line18_businessIncome)}`)
  if (nj.line19_capitalGains !== 0) drawLine('Net gains from property', '19', `$${formatDollars(nj.line19_capitalGains)}`)
  if (nj.line20a_pensions > 0) drawLine('Pensions, annuities, IRA', '20a', `$${formatDollars(nj.line20a_pensions)}`)
  if (nj.line20b_pensionExclusion > 0) drawLine('Pension exclusion', '20b', `($${formatDollars(nj.line20b_pensionExclusion)})`)
  if (nj.line21_partnershipIncome !== 0) drawLine('Partnership/S-corp income', '21', `$${formatDollars(nj.line21_partnershipIncome)}`)
  if (nj.line22_rentalIncome !== 0) drawLine('Rental income', '22', `$${formatDollars(nj.line22_rentalIncome)}`)

  drawLine('Total income', '27', `$${formatDollars(nj.line27_totalIncome)}`)
  if (nj.line28c_totalExclusions > 0) drawLine('Total exclusions', '28c', `($${formatDollars(nj.line28c_totalExclusions)})`)
  drawLine('NJ gross income', '29', `$${formatDollars(nj.line29_njGrossIncome)}`, { bold: true })
  y -= 6

  // Deductions & Exemptions
  draw('Deductions & Exemptions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (nj.line30_propertyTaxDeduction > 0) drawLine('Property tax deduction', '30', `$${formatDollars(nj.line30_propertyTaxDeduction)}`)
  if (nj.line31_medicalExpenses > 0) drawLine('Medical expenses (>2% NJ gross)', '31', `$${formatDollars(nj.line31_medicalExpenses)}`)
  drawLine('Personal exemptions', '37', `$${formatDollars(nj.line37_exemptions)}`)
  drawLine('NJ taxable income', '38', `$${formatDollars(nj.line38_njTaxableIncome)}`, { bold: true })
  y -= 6

  // Tax & Credits
  draw('Tax & Credits', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('NJ tax (from rate schedule)', '39', `$${formatDollars(nj.line39_njTax)}`)
  if (nj.line43_propertyTaxCredit > 0) drawLine('Property tax credit', '43', `($${formatDollars(nj.line43_propertyTaxCredit)})`)
  if (nj.line44_njEITC > 0) drawLine('NJ Earned Income Tax Credit', '44', `($${formatDollars(nj.line44_njEITC)})`)
  if (nj.line45_njChildTaxCredit > 0) drawLine('NJ Child Tax Credit', '45', `($${formatDollars(nj.line45_njChildTaxCredit)})`)
  drawLine('Tax after credits', '49', `$${formatDollars(nj.line49_taxAfterCredits)}`, { bold: true })
  y -= 6

  // Payments
  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (nj.line52_njWithholding > 0) drawLine('NJ state income tax withheld', '52', `$${formatDollars(nj.line52_njWithholding)}`)
  drawLine('Total payments', '55', `$${formatDollars(nj.line55_totalPayments)}`, { bold: true })
  y -= 6

  // Result
  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (nj.line56_overpaid > 0) {
    drawLine('Overpaid (refund)', '56', `$${formatDollars(nj.line56_overpaid)}`, { bold: true })
  } else if (nj.line57_amountOwed > 0) {
    drawLine('Amount you owe', '57', `$${formatDollars(nj.line57_amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  draw('Generated by OpenTax — for review purposes. File using official NJ-1040.', 72, 7, { color: gray })

  return pdfDoc
}

export const njFormCompiler: StateFormCompiler = {
  stateCode: 'NJ',
  templateFiles: ['nj1040.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const nj1040 = stateResult.detail as NJ1040Result
    const doc = await generateFormNJ1040(taxReturn, nj1040)

    return {
      doc,
      forms: [
        {
          formId: 'NJ Form NJ-1040',
          sequenceNumber: 'NJ-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
