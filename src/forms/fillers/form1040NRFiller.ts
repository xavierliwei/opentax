/**
 * Form 1040-NR PDF filler.
 *
 * Generates a programmatic Form 1040-NR (U.S. Nonresident Alien Income Tax Return)
 * from computed Form1040NRResult values. Uses PDFDocument.create() since the IRS
 * 1040-NR template may not be available.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { Form1040NRResult } from '../../rules/2025/form1040NR'
import { formatDollars, formatSSN } from '../helpers'

export async function fillForm1040NR(
  taxReturn: TaxReturn,
  result: Form1040NRResult,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const darkBlue = rgb(0.1, 0.2, 0.5)
  const lightGray = rgb(0.92, 0.92, 0.92)

  // ── Helper functions ──────────────────────────────────────

  function drawLine(page: ReturnType<typeof pdfDoc.addPage>, lineLabel: string, description: string, amount: number, x: number, y: number) {
    page.drawText(lineLabel, { x, y, size: 8, font: fontBold, color: darkBlue })
    page.drawText(description, { x: x + 30, y, size: 9, font, color: black })
    if (amount !== 0) {
      const dollarStr = formatDollars(amount)
      const dollarWidth = font.widthOfTextAtSize(dollarStr, 10)
      page.drawText(dollarStr, { x: 530 - dollarWidth, y, size: 10, font, color: black })
    }
  }

  // ── Page 1: Header + ECI Income ──────────────────────────
  const page1 = pdfDoc.addPage([612, 792])
  let y = 740

  // Title
  page1.drawText('Form 1040-NR', { x: 72, y, size: 18, font: fontBold, color: darkBlue })
  y -= 16
  page1.drawText('U.S. Nonresident Alien Income Tax Return', { x: 72, y, size: 11, font: fontItalic, color: gray })
  y -= 12
  page1.drawText(`Tax Year ${taxReturn.taxYear}`, { x: 72, y, size: 9, font, color: gray })
  y -= 5

  // Divider
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 1, color: darkBlue })
  y -= 20

  // Taxpayer info
  const tp = taxReturn.taxpayer
  const nra = taxReturn.nraInfo
  page1.drawText('Taxpayer Information', { x: 72, y, size: 10, font: fontBold, color: black })
  y -= 15
  page1.drawText(`Name: ${tp.firstName} ${tp.lastName}`, { x: 72, y, size: 9, font, color: black })
  page1.drawText(`SSN: ${formatSSN(tp.ssn || '000000000')}`, { x: 350, y, size: 9, font, color: black })
  y -= 13
  page1.drawText(`Address: ${tp.address.street}, ${tp.address.city}, ${tp.address.state} ${tp.address.zip}`, { x: 72, y, size: 9, font, color: black })
  y -= 13
  page1.drawText(`Country of Residence: ${nra?.countryOfResidence ?? 'N/A'}`, { x: 72, y, size: 9, font, color: black })
  if (nra?.visaType) {
    page1.drawText(`Visa: ${nra.visaType}`, { x: 350, y, size: 9, font, color: black })
  }
  y -= 13
  const statusLabel = taxReturn.filingStatus === 'mfs' ? 'Married Filing Separately' : 'Single'
  page1.drawText(`Filing Status: ${statusLabel}`, { x: 72, y, size: 9, font, color: black })
  y -= 20

  // ECI section header
  page1.drawRectangle({ x: 72, y: y - 2, width: 468, height: 16, color: lightGray })
  page1.drawText('Effectively Connected Income (ECI)', { x: 76, y: y + 1, size: 10, font: fontBold, color: darkBlue })
  y -= 22

  drawLine(page1, '1a.', 'Wages, salaries, tips (W-2)', result.eciWages.amount, 72, y)
  y -= 16
  drawLine(page1, '2b.', 'Taxable interest', result.eciInterest.amount, 72, y)
  y -= 16
  drawLine(page1, '3b.', 'Ordinary dividends', result.eciDividends.amount, 72, y)
  y -= 16
  drawLine(page1, '7.', 'Capital gain or (loss)', result.eciCapitalGains.amount, 72, y)
  y -= 16
  drawLine(page1, '8a.', 'Business income (Schedule C)', result.eciBusinessIncome.amount, 72, y)
  y -= 16
  if (result.eciScholarship.amount > 0) {
    drawLine(page1, '8b.', 'Taxable scholarship/fellowship', result.eciScholarship.amount, 72, y)
    y -= 16
  }
  if (result.eciOtherIncome.amount > 0) {
    drawLine(page1, '8c.', 'Other effectively connected income', result.eciOtherIncome.amount, 72, y)
    y -= 16
  }
  if (result.treatyExemption.amount > 0) {
    drawLine(page1, '', 'Less: Treaty exempt income', -result.treatyExemption.amount, 72, y)
    y -= 16
  }

  // Total line with emphasis
  page1.drawLine({ start: { x: 400, y: y + 12 }, end: { x: 540, y: y + 12 }, thickness: 0.5, color: gray })
  drawLine(page1, '9.', 'Total effectively connected income', result.totalECI.amount, 72, y)
  y -= 25

  // AGI section
  page1.drawRectangle({ x: 72, y: y - 2, width: 468, height: 16, color: lightGray })
  page1.drawText('Adjusted Gross Income', { x: 76, y: y + 1, size: 10, font: fontBold, color: darkBlue })
  y -= 22

  drawLine(page1, '10.', 'Adjustments to income', result.adjustments.amount, 72, y)
  y -= 16
  drawLine(page1, '11.', 'Adjusted gross income (AGI)', result.agi.amount, 72, y)
  y -= 25

  // Deductions
  page1.drawRectangle({ x: 72, y: y - 2, width: 468, height: 16, color: lightGray })
  page1.drawText('Deductions', { x: 76, y: y + 1, size: 10, font: fontBold, color: darkBlue })
  y -= 22

  drawLine(page1, '12.', 'Itemized deductions (limited)', result.deductions.amount, 72, y)
  y -= 16
  drawLine(page1, '15.', 'Taxable income', result.taxableIncome.amount, 72, y)
  y -= 25

  // Tax computation
  page1.drawRectangle({ x: 72, y: y - 2, width: 468, height: 16, color: lightGray })
  page1.drawText('Tax Computation', { x: 76, y: y + 1, size: 10, font: fontBold, color: darkBlue })
  y -= 22

  drawLine(page1, '16.', 'Tax on ECI (graduated rates)', result.eciTax.amount, 72, y)
  y -= 16
  if (result.totalFDAP.amount > 0) {
    drawLine(page1, '17.', `Tax on FDAP income (${(result.fdapTaxRate * 100).toFixed(0)}%)`, result.fdapTax.amount, 72, y)
    y -= 16
  }
  page1.drawLine({ start: { x: 400, y: y + 12 }, end: { x: 540, y: y + 12 }, thickness: 0.5, color: gray })
  drawLine(page1, '24.', 'Total tax', result.totalTax.amount, 72, y)
  y -= 25

  // Payments
  page1.drawRectangle({ x: 72, y: y - 2, width: 468, height: 16, color: lightGray })
  page1.drawText('Payments', { x: 76, y: y + 1, size: 10, font: fontBold, color: darkBlue })
  y -= 22

  drawLine(page1, '25.', 'Federal income tax withheld', result.withheld.amount, 72, y)
  y -= 16
  if (result.estimatedPayments.amount > 0) {
    drawLine(page1, '26.', 'Estimated tax payments', result.estimatedPayments.amount, 72, y)
    y -= 16
  }
  drawLine(page1, '33.', 'Total payments', result.totalPayments.amount, 72, y)
  y -= 25

  // Result
  page1.drawRectangle({ x: 72, y: y - 2, width: 468, height: 16, color: lightGray })
  page1.drawText('Refund or Amount You Owe', { x: 76, y: y + 1, size: 10, font: fontBold, color: darkBlue })
  y -= 22

  if (result.refund.amount > 0) {
    drawLine(page1, '34.', 'Overpaid (refund)', result.refund.amount, 72, y)
  } else if (result.amountOwed.amount > 0) {
    drawLine(page1, '37.', 'Amount you owe', result.amountOwed.amount, 72, y)
  } else {
    drawLine(page1, '', 'Balance: $0', 0, 72, y)
  }
  y -= 30

  // ── Page 2: Schedule NEC (if FDAP income) ──────────────────
  if (result.totalFDAP.amount > 0) {
    const page2 = pdfDoc.addPage([612, 792])
    let y2 = 740

    page2.drawText('Schedule NEC', { x: 72, y: y2, size: 16, font: fontBold, color: darkBlue })
    y2 -= 14
    page2.drawText('Tax on Income Not Effectively Connected With a U.S. Trade or Business', { x: 72, y: y2, size: 10, font: fontItalic, color: gray })
    y2 -= 5
    page2.drawLine({ start: { x: 72, y: y2 }, end: { x: 540, y: y2 }, thickness: 1, color: darkBlue })
    y2 -= 25

    // Rate info
    const rateStr = `Withholding rate: ${(result.fdapTaxRate * 100).toFixed(0)}%`
    page2.drawText(rateStr, { x: 72, y: y2, size: 9, font, color: gray })
    if (nra?.treatyCountry) {
      page2.drawText(`Treaty country: ${nra.treatyCountry}`, { x: 300, y: y2, size: 9, font, color: gray })
    }
    y2 -= 25

    // Column headers
    page2.drawRectangle({ x: 72, y: y2 - 2, width: 468, height: 16, color: lightGray })
    page2.drawText('Income Type', { x: 76, y: y2 + 1, size: 9, font: fontBold, color: black })
    page2.drawText('Amount', { x: 370, y: y2 + 1, size: 9, font: fontBold, color: black })
    page2.drawText('Tax', { x: 470, y: y2 + 1, size: 9, font: fontBold, color: black })
    y2 -= 22

    const items = [
      { label: 'Dividends', amount: result.fdapDividends.amount },
      { label: 'Interest', amount: result.fdapInterest.amount },
      { label: 'Royalties', amount: result.fdapRoyalties.amount },
      { label: 'Other FDAP income', amount: result.fdapOther.amount },
    ]

    for (const item of items) {
      if (item.amount <= 0) continue
      page2.drawText(item.label, { x: 76, y: y2, size: 9, font, color: black })

      const amtStr = formatDollars(item.amount)
      const amtWidth = font.widthOfTextAtSize(amtStr, 9)
      page2.drawText(amtStr, { x: 430 - amtWidth, y: y2, size: 9, font, color: black })

      const taxAmt = Math.round(item.amount * result.fdapTaxRate)
      const taxStr = formatDollars(taxAmt)
      const taxWidth = font.widthOfTextAtSize(taxStr, 9)
      page2.drawText(taxStr, { x: 530 - taxWidth, y: y2, size: 9, font, color: black })

      y2 -= 16
    }

    // Totals
    page2.drawLine({ start: { x: 350, y: y2 + 12 }, end: { x: 540, y: y2 + 12 }, thickness: 0.5, color: gray })
    y2 -= 4
    page2.drawText('Total', { x: 76, y: y2, size: 9, font: fontBold, color: black })
    const totalStr = formatDollars(result.totalFDAP.amount)
    const totalWidth = font.widthOfTextAtSize(totalStr, 10)
    page2.drawText(totalStr, { x: 430 - totalWidth, y: y2, size: 10, font: fontBold, color: black })
    const totalTaxStr = formatDollars(result.fdapTax.amount)
    const totalTaxWidth = font.widthOfTextAtSize(totalTaxStr, 10)
    page2.drawText(totalTaxStr, { x: 530 - totalTaxWidth, y: y2, size: 10, font: fontBold, color: black })
  }

  // ── Page 3: Schedule OI (Other Information) ────────────────
  const pageOI = pdfDoc.addPage([612, 792])
  let yOI = 740

  pageOI.drawText('Schedule OI', { x: 72, y: yOI, size: 16, font: fontBold, color: darkBlue })
  yOI -= 14
  pageOI.drawText('Other Information', { x: 72, y: yOI, size: 10, font: fontItalic, color: gray })
  yOI -= 5
  pageOI.drawLine({ start: { x: 72, y: yOI }, end: { x: 540, y: yOI }, thickness: 1, color: darkBlue })
  yOI -= 25

  const oiLines = [
    `Country of citizenship or nationality: ${nra?.countryOfResidence ?? 'N/A'}`,
    `Country of residence for tax purposes: ${nra?.countryOfResidence ?? 'N/A'}`,
    `Visa type: ${nra?.visaType ?? 'N/A'}`,
    `Days present in U.S. during ${taxReturn.taxYear}: ${nra?.daysInUS ?? 'N/A'}`,
  ]

  if (nra?.treatyCountry) {
    oiLines.push('')
    oiLines.push(`Tax treaty country: ${nra.treatyCountry}`)
    oiLines.push(`Treaty article: ${nra.treatyArticle ?? 'N/A'}`)
    oiLines.push(`Income exempt under treaty: ${nra.treatyExemptIncome ? formatDollars(nra.treatyExemptIncome) : '$0'}`)
  }

  for (const line of oiLines) {
    pageOI.drawText(line, { x: 72, y: yOI, size: 9, font, color: black })
    yOI -= 16
  }

  return pdfDoc
}
