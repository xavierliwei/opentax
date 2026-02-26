/**
 * Form 8829 (Expenses for Business Use of Your Home) — PDF filler.
 *
 * Generates a programmatic PDF since no IRS template is currently available.
 * Only used for the regular method — simplified method does not require Form 8829.
 *
 * Maps Form8829Data (input) + Form8829Result (computed) onto a clean PDF page.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { Form8829Result } from '../../rules/2025/form8829'
import { formatSSN, formatDollars } from '../helpers'

function fmtPct(pct: number): string {
  return pct.toFixed(2) + '%'
}

export async function fillForm8829(
  taxReturn: TaxReturn,
  result: Form8829Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const page = pdfDoc.addPage([612, 792])  // Letter size

  const { width, height } = page.getSize()
  const margin = 50
  let y = height - margin

  // Colors
  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)

  // Helper functions
  const drawTitle = (text: string) => {
    page.drawText(text, { x: margin, y, size: 14, font: boldFont, color: black })
    y -= 20
  }

  const drawSubtitle = (text: string) => {
    page.drawText(text, { x: margin, y, size: 10, font: boldFont, color: black })
    y -= 16
  }

  const drawLine = (label: string, value: string, lineNum?: string) => {
    const labelX = margin + (lineNum ? 40 : 0)
    if (lineNum) {
      page.drawText(lineNum, { x: margin, y, size: 9, font: boldFont, color: gray })
    }
    page.drawText(label, { x: labelX, y, size: 9, font, color: black })
    page.drawText(value, { x: width - margin - font.widthOfTextAtSize(value, 9), y, size: 9, font, color: black })
    y -= 14
  }

  const drawSeparator = () => {
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: width - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    })
    y -= 4
  }

  // ── Header ──────────────────────────────────────────────────────
  drawTitle('Form 8829 — Expenses for Business Use of Your Home')
  page.drawText('Department of the Treasury — Internal Revenue Service', {
    x: margin, y, size: 8, font, color: gray,
  })
  y -= 14
  page.drawText(`Tax Year 2025`, { x: margin, y, size: 8, font, color: gray })
  y -= 18

  // Taxpayer info
  // Find the associated Schedule C to determine whose business this is
  const biz = (taxReturn.scheduleCBusinesses ?? []).find(b => b.id === result.scheduleCId)
  const owner = biz?.owner === 'spouse' && taxReturn.spouse
    ? taxReturn.spouse
    : taxReturn.taxpayer

  drawLine('Name(s) shown on return', `${owner.firstName} ${owner.lastName}`)
  drawLine('Your social security number', formatSSN(owner.ssn))
  if (biz) {
    drawLine('Name of proprietor', biz.businessName)
  }
  y -= 6
  drawSeparator()

  // ── Part I — Part of Your Home Used for Business ────────────────
  drawSubtitle('Part I — Part of Your Home Used for Business')

  // Find the input data
  const data = (taxReturn.form8829s ?? []).find(f => f.scheduleCId === result.scheduleCId)

  drawLine('Area used regularly and exclusively for business', `${data?.businessUseSquareFootage ?? 0} sq ft`, '1')
  drawLine('Total area of home', `${data?.totalHomeSquareFootage ?? 0} sq ft`, '2')
  drawLine('Business percentage (Line 1 / Line 2)', fmtPct(result.businessPercentage), '3')
  y -= 4
  drawSeparator()

  // ── Part II — Figure Your Allowable Deduction ───────────────────
  drawSubtitle('Part II — Figure Your Allowable Deduction')

  drawLine('Direct expenses (100% business use)', formatDollars(result.directExpenses), '9-11')
  drawLine('Indirect expenses (total before proration)', formatDollars(result.indirectExpensesTotal), '12-16')
  drawLine('Indirect expenses (prorated by business %)', formatDollars(result.indirectExpensesProrated), '17')
  drawLine('Depreciation', formatDollars(result.depreciation), '19-20')
  y -= 4
  drawSeparator()

  drawLine('Total deduction before profit limit', formatDollars(result.totalBeforeLimit), '33')
  drawLine('Allowable home office deduction', formatDollars(result.deduction), '35')

  if (result.excessCarryforward > 0) {
    drawLine('Excess carried forward to next year', formatDollars(result.excessCarryforward), '43')
  }

  y -= 4
  drawSeparator()

  // Schedule A adjustment note
  if (result.mortgageInterestBusiness > 0 || result.realEstateTaxesBusiness > 0) {
    y -= 4
    page.drawText('Schedule A Adjustment:', { x: margin, y, size: 9, font: boldFont, color: black })
    y -= 14
    if (result.mortgageInterestBusiness > 0) {
      drawLine('Mortgage interest allocated to business', formatDollars(result.mortgageInterestBusiness))
    }
    if (result.realEstateTaxesBusiness > 0) {
      drawLine('Real estate taxes allocated to business', formatDollars(result.realEstateTaxesBusiness))
    }
    page.drawText('These amounts have been removed from Schedule A to avoid double-counting.', {
      x: margin, y, size: 8, font, color: gray,
    })
    y -= 14
  }

  // Footer
  y = margin + 20
  page.drawText('This deduction flows to Schedule C, Line 30.', {
    x: margin, y, size: 8, font, color: gray,
  })

  return pdfDoc
}
