/**
 * NC Form D-400 PDF filler.
 *
 * Fills the official North Carolina Form D-400 (Individual Income Tax Return)
 * template from computed Form D-400 results.  Falls back to programmatic
 * generation when no template is available.
 *
 * Because the official NC D-400 PDF has AcroForm widgets that pdf-lib cannot
 * parse (corrupted object references), this filler overlays text at calibrated
 * (x, y) coordinates rather than filling named AcroForm fields.
 */

import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { FormD400Result } from '../../rules/2025/nc/formd400'
import type { StateCompiledForms, StateFormCompiler, StateFormTemplates } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import type { FieldPosition } from '../mappings/formD400Fields'
import {
  D400_HEADER, D400_FILING_STATUS, D400_RESIDENCY,
  D400_INCOME, D400_PAGE2_HEADER, D400_TAX,
  D400_WITHHOLDING, D400_RESULT,
} from '../mappings/formD400Fields'

// ── Coordinate-based helpers ────────────────────────────────────

/**
 * Draw text on a PDF page at the specified field position.
 * Since the NC D-400 has AcroForm fields that pdf-lib cannot parse,
 * we draw text directly at calibrated coordinates.
 */
function drawAtPos(
  pages: PDFPage[],
  font: PDFFont,
  pos: FieldPosition,
  value: string,
): void {
  const page = pages[pos.page]
  if (!page) return
  try {
    page.drawText(value, {
      x: pos.x,
      y: pos.y,
      size: pos.size ?? 9,
      font,
      color: rgb(0, 0, 0),
    })
  } catch {
    // Skip silently if draw fails
  }
}

/**
 * Draw a dollar-formatted value at the specified position.
 * Skips if the amount is zero to keep the form clean.
 */
function drawDollarAtPos(
  pages: PDFPage[],
  font: PDFFont,
  pos: FieldPosition,
  amountCents: number,
): void {
  if (amountCents === 0) return
  drawAtPos(pages, font, pos, formatDollars(amountCents))
}

/**
 * Draw a checkbox mark ("X") at the specified position.
 */
function drawCheckAtPos(
  pages: PDFPage[],
  font: PDFFont,
  pos: FieldPosition,
): void {
  drawAtPos(pages, font, pos, 'X')
}

// ── Template-based filler ────────────────────────────────────────

async function fillFormD400Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  d400: FormD400Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()

  const tp = taxReturn.taxpayer

  // ── Page 1: Header ─────────────────────────────────────────
  drawAtPos(pages, font, D400_HEADER.ssn1, formatSSN(tp.ssn || '000000000'))
  drawAtPos(pages, font, D400_HEADER.firstName, tp.firstName)
  if (tp.middleInitial) {
    drawAtPos(pages, font, D400_HEADER.mi1, tp.middleInitial)
  }
  drawAtPos(pages, font, D400_HEADER.lastName, tp.lastName)

  // Mailing address
  drawAtPos(pages, font, D400_HEADER.address, tp.address.street)
  if (tp.address.apartment) {
    drawAtPos(pages, font, D400_HEADER.apartment, tp.address.apartment)
  }
  drawAtPos(pages, font, D400_HEADER.city, tp.address.city)
  drawAtPos(pages, font, D400_HEADER.state, tp.address.state)
  drawAtPos(pages, font, D400_HEADER.zip, tp.address.zip)

  // Spouse info (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    drawAtPos(pages, font, D400_HEADER.ssn2, formatSSN(sp.ssn))
    drawAtPos(pages, font, D400_HEADER.spouseFirstName, sp.firstName)
    if (sp.middleInitial) {
      drawAtPos(pages, font, D400_HEADER.spouseMI, sp.middleInitial)
    }
    drawAtPos(pages, font, D400_HEADER.spouseLastName, sp.lastName)
  }

  // ── Filing Status ──────────────────────────────────────────
  const statusMap: Record<string, FieldPosition> = {
    single: D400_FILING_STATUS.single,
    mfj:    D400_FILING_STATUS.mfj,
    mfs:    D400_FILING_STATUS.mfs,
    hoh:    D400_FILING_STATUS.hoh,
    qw:     D400_FILING_STATUS.qw,
  }
  const selectedStatus = statusMap[taxReturn.filingStatus]
  if (selectedStatus) {
    drawCheckAtPos(pages, font, selectedStatus)
  }

  // ── Residency Status ───────────────────────────────────────
  if (d400.residencyType === 'full-year') {
    drawCheckAtPos(pages, font, D400_RESIDENCY.res1Yes)
  } else {
    drawCheckAtPos(pages, font, D400_RESIDENCY.res1No)
  }

  // ── Income (Lines 6-15) ────────────────────────────────────

  // Line 6: Federal adjusted gross income
  drawDollarAtPos(pages, font, D400_INCOME.line6, d400.federalAGI)

  // Line 7: Additions to Federal AGI
  drawDollarAtPos(pages, font, D400_INCOME.line7, d400.ncAdditions)

  // Line 8: Add Lines 6 and 7
  const line8 = d400.federalAGI + d400.ncAdditions
  drawDollarAtPos(pages, font, D400_INCOME.line8, line8)

  // Line 9: Deductions from Federal AGI
  drawDollarAtPos(pages, font, D400_INCOME.line9, d400.ncDeductions)

  // Line 10a/10b: Child deduction (not computed in current model — skip)

  // Line 11: Standard Deduction or Itemized Deductions
  drawCheckAtPos(pages, font, D400_INCOME.standardDeductionCB)
  drawDollarAtPos(pages, font, D400_INCOME.line11, d400.standardDeduction)

  // Line 12a: Add Lines 9, 10b, and 11
  const line12a = d400.ncDeductions + d400.standardDeduction
  drawDollarAtPos(pages, font, D400_INCOME.line12a, line12a)

  // Line 12b: Subtract Line 12a from Line 8 (NC AGI minus deductions)
  const line12b = Math.max(0, line8 - line12a)
  drawDollarAtPos(pages, font, D400_INCOME.line12b, line12b)

  // Line 13: Part-year/Nonresident taxable percentage
  if (d400.residencyType !== 'full-year' && d400.apportionmentRatio < 1) {
    drawAtPos(pages, font, D400_INCOME.line13, d400.apportionmentRatio.toFixed(4))
  }

  // Line 14: North Carolina taxable income
  drawDollarAtPos(pages, font, D400_INCOME.line14, d400.ncTaxableIncome)

  // Line 15: North Carolina income tax (Line 14 x 4.5%)
  drawDollarAtPos(pages, font, D400_INCOME.line15, d400.ncTax)

  // ── Page 2: Header ─────────────────────────────────────────
  drawAtPos(pages, font, D400_PAGE2_HEADER.lastName,
    tp.lastName.substring(0, 10).toUpperCase())
  drawAtPos(pages, font, D400_PAGE2_HEADER.ssn, formatSSN(tp.ssn || '000000000'))

  // ── Page 2: Tax & Credits (Lines 16-19) ────────────────────

  // Line 16: Tax credits (not computed in current model — 0)
  // Line 17: Subtract Line 16 from Line 15 (tax after credits)
  drawDollarAtPos(pages, font, D400_TAX.line17, d400.taxAfterCredits)

  // Line 18: Consumer Use Tax (skip — 0)

  // Line 19: Add Lines 17 and 18 (total tax)
  drawDollarAtPos(pages, font, D400_TAX.line19, d400.taxAfterCredits)

  // ── Page 2: Withholding & Payments (Lines 20-25) ───────────

  // Line 20a: Your NC tax withheld
  if (d400.stateWithholding > 0) {
    drawDollarAtPos(pages, font, D400_WITHHOLDING.line20a, d400.stateWithholding)
  }

  // Line 23: Total payments (Lines 20a through 22)
  drawDollarAtPos(pages, font, D400_WITHHOLDING.line23, d400.totalPayments)

  // Line 25: Subtract Line 24 from Line 23 (net payments)
  drawDollarAtPos(pages, font, D400_WITHHOLDING.line25, d400.totalPayments)

  // ── Page 2: Tax Due / Overpayment (Lines 26-34) ────────────

  if (d400.amountOwed > 0) {
    // Line 26a: Tax due
    drawDollarAtPos(pages, font, D400_RESULT.line26a, d400.amountOwed)
    // Line 27: Amount due (= Line 26a when no penalties/interest)
    drawDollarAtPos(pages, font, D400_RESULT.line27, d400.amountOwed)
  }

  if (d400.overpaid > 0) {
    // Line 28: Overpayment
    drawDollarAtPos(pages, font, D400_RESULT.line28, d400.overpaid)
    // Line 34: Amount to be refunded (all of overpayment)
    drawDollarAtPos(pages, font, D400_RESULT.line34, d400.overpaid)
  }

  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateFormD400(
  taxReturn: TaxReturn,
  form: FormD400Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const blue = rgb(0.1, 0.2, 0.45)

  const page = pdfDoc.addPage([612, 792])
  let y = 750

  const draw = (text: string, x: number, size: number, bold = false) => {
    page.drawText(text, { x, y, size, font: bold ? fontBold : font, color: black })
  }

  const drawLine = (label: string, value: number) => {
    draw(label, 72, 10)
    draw(`$${formatDollars(value)}`, 460, 10, true)
    y -= 16
  }

  draw('North Carolina Form D-400', 72, 16, true)
  y -= 14
  page.drawText('Individual Income Tax Return — 2025', { x: 72, y, size: 9, font, color: gray })
  y -= 8
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.4, color: blue })
  y -= 20

  const tp = taxReturn.taxpayer
  draw(`Name: ${tp.firstName} ${tp.lastName}`, 72, 9)
  y -= 12
  draw(`SSN: ${formatSSN(tp.ssn || '000000000')}`, 72, 9)
  draw(`Status: ${filingStatusLabel(taxReturn.filingStatus)}`, 300, 9)
  y -= 12

  draw('Income & Tax', 72, 11, true)
  y -= 16
  drawLine('Federal AGI', form.federalAGI)
  drawLine('North Carolina AGI', form.ncAGI)
  drawLine('North Carolina Taxable Income', form.ncTaxableIncome)
  drawLine('North Carolina Tax', form.ncTax)
  drawLine('Tax After Credits', form.taxAfterCredits)

  y -= 8
  draw('Payments', 72, 11, true)
  y -= 16
  drawLine('NC State Withholding', form.stateWithholding)

  y -= 8
  draw('Result', 72, 11, true)
  y -= 16
  if (form.overpaid > 0) drawLine('Refund', form.overpaid)
  else drawLine('Amount You Owe', form.amountOwed)

  y -= 20
  page.drawText('Generated by OpenTax — for review. File using official NC Form D-400.', {
    x: 72, y, size: 7, font, color: gray,
  })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const ncFormCompiler: StateFormCompiler = {
  stateCode: 'NC',

  templateFiles: ['d400.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form = stateResult.detail as FormD400Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('d400')
    const doc = templateBytes
      ? await fillFormD400Template(templateBytes, taxReturn, form)
      : await generateFormD400(taxReturn, form)

    return {
      doc,
      forms: [
        {
          formId: 'NC Form D-400',
          sequenceNumber: 'NC-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
