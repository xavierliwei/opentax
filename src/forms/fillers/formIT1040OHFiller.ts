/**
 * Ohio Form IT 1040 PDF filler.
 *
 * Fills the official Ohio IT 1040 (Individual Income Tax Return) template
 * from computed Form IT 1040 results. Falls back to programmatic generation
 * when no template is available.
 *
 * Because the official Ohio IT 1040 PDF is a flat (non-fillable) form, this
 * filler overlays text at calibrated (x, y) coordinates rather than filling
 * named AcroForm fields.
 */

import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { FormIT1040Result } from '../../rules/2025/oh/formIT1040'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import type { FieldPosition } from '../mappings/formIT1040OHFields'
import {
  IT1040_HEADER, IT1040_RESIDENCY, IT1040_FILING_STATUS,
  IT1040_INCOME, IT1040_PAGE1_HEADER,
  IT1040_TAX, IT1040_PAYMENTS, IT1040_RESULT,
} from '../mappings/formIT1040OHFields'

// ── Coordinate-based helpers ────────────────────────────────────

/**
 * Draw text on a PDF page at the specified field position.
 * Since the OH IT 1040 is a flat PDF (no AcroForm fields), we draw text
 * directly at calibrated coordinates.
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

// ── Template-based filler ────────────────────────────────────────

async function fillFormIT1040OHTemplate(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  form: FormIT1040Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()

  const tp = taxReturn.taxpayer

  // ── Page 0: Header / Personal Info ──────────────────────────
  drawAtPos(pages, font, IT1040_HEADER.primarySSN, formatSSN(tp.ssn || '000000000'))
  drawAtPos(pages, font, IT1040_HEADER.firstName, tp.firstName)
  if (tp.middleInitial) {
    drawAtPos(pages, font, IT1040_HEADER.middleInitial, tp.middleInitial)
  }
  drawAtPos(pages, font, IT1040_HEADER.lastName, tp.lastName)

  drawAtPos(pages, font, IT1040_HEADER.addressLine1, tp.address.street)
  if (tp.address.apartment) {
    drawAtPos(pages, font, IT1040_HEADER.addressLine2, tp.address.apartment)
  }
  drawAtPos(pages, font, IT1040_HEADER.city, tp.address.city)
  drawAtPos(pages, font, IT1040_HEADER.state, tp.address.state)
  drawAtPos(pages, font, IT1040_HEADER.zip, tp.address.zip)

  // Spouse (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    drawAtPos(pages, font, IT1040_HEADER.spouseSSN, formatSSN(sp.ssn))
    drawAtPos(pages, font, IT1040_HEADER.spouseFirstName, sp.firstName)
    if (sp.middleInitial) {
      drawAtPos(pages, font, IT1040_HEADER.spouseMI, sp.middleInitial)
    }
    drawAtPos(pages, font, IT1040_HEADER.spouseLastName, sp.lastName)
  }

  // ── Residency Status ─────────────────────────────────────────
  const residencyCheckbox = form.residencyType === 'full-year'
    ? IT1040_RESIDENCY.resident
    : form.residencyType === 'part-year'
      ? IT1040_RESIDENCY.partYear
      : IT1040_RESIDENCY.nonresident
  drawAtPos(pages, font, residencyCheckbox, 'X')

  // ── Filing Status ────────────────────────────────────────────
  const fs = taxReturn.filingStatus
  if (fs === 'mfj') {
    drawAtPos(pages, font, IT1040_FILING_STATUS.mfj, 'X')
  } else if (fs === 'mfs') {
    drawAtPos(pages, font, IT1040_FILING_STATUS.mfs, 'X')
    if (taxReturn.spouse) {
      drawAtPos(pages, font, IT1040_FILING_STATUS.mfsSpouseSSN,
        formatSSN(taxReturn.spouse.ssn))
    }
  } else {
    // single, hoh, qw all use the first checkbox
    drawAtPos(pages, font, IT1040_FILING_STATUS.singleHohQw, 'X')
  }

  // ── Page 0: Income Lines 1-7 ─────────────────────────────────
  // Line 1: Federal adjusted gross income
  drawDollarAtPos(pages, font, IT1040_INCOME.line1, form.federalAGI)

  // Line 2a: Additions
  if (form.ohAdditions > 0) {
    drawDollarAtPos(pages, font, IT1040_INCOME.line2a, form.ohAdditions)
  }

  // Line 2b: Deductions (includes SS exemption)
  if (form.ohDeductions > 0) {
    drawDollarAtPos(pages, font, IT1040_INCOME.line2b, form.ohDeductions)
  }

  // Line 3: Ohio AGI
  drawDollarAtPos(pages, font, IT1040_INCOME.line3, form.ohAGI)

  // Line 4: Exemption amount — Ohio doesn't use a standard deduction,
  // but the exemption is $0 for most filers (handled through credits)
  // Line 4 count: number of exemptions
  const numExemptions = taxReturn.filingStatus === 'mfj' ? 2 : 1
  const depCount = taxReturn.dependents?.length ?? 0
  const totalExemptions = numExemptions + depCount
  if (totalExemptions > 0) {
    drawAtPos(pages, font, IT1040_INCOME.line4count, String(totalExemptions))
  }

  // Line 5: Ohio income tax base (= Ohio AGI - exemptions, min 0)
  drawDollarAtPos(pages, font, IT1040_INCOME.line5, form.ohTaxableIncome)

  // Line 6: Taxable business income (not currently modeled → 0)
  // Line 7: Taxable nonbusiness income (= line 5 - line 6)
  drawDollarAtPos(pages, font, IT1040_INCOME.line7, form.ohTaxableIncome)

  // ── Page 1: SSN header ───────────────────────────────────────
  drawAtPos(pages, font, IT1040_PAGE1_HEADER.ssn, formatSSN(tp.ssn || '000000000'))

  // ── Page 1: Lines 7a-13 (Tax) ────────────────────────────────
  // Line 7a: Same as line 7 on page 1
  drawDollarAtPos(pages, font, IT1040_TAX.line7a, form.ohTaxableIncome)

  // Line 8a: Nonbusiness income tax liability
  drawDollarAtPos(pages, font, IT1040_TAX.line8a, form.ohTaxBeforeCredits)

  // Line 8b: Business income tax liability (not modeled → 0)

  // Line 8c: Total income tax liability before credits (= 8a + 8b)
  drawDollarAtPos(pages, font, IT1040_TAX.line8c, form.ohTaxBeforeCredits)

  // Line 9: Nonrefundable credits
  if (form.totalCredits > 0) {
    drawDollarAtPos(pages, font, IT1040_TAX.line9, form.totalCredits)
  }

  // Line 10: Tax after nonrefundable credits
  drawDollarAtPos(pages, font, IT1040_TAX.line10, form.taxAfterCredits)

  // Lines 11-12: Penalties/use tax (not modeled → 0)

  // Line 13: Total Ohio tax liability
  drawDollarAtPos(pages, font, IT1040_TAX.line13, form.taxAfterCredits)

  // ── Page 1: Lines 14-17 (Payments) ───────────────────────────
  // Line 14: Ohio income tax withheld
  if (form.stateWithholding > 0) {
    drawDollarAtPos(pages, font, IT1040_PAYMENTS.line14, form.stateWithholding)
  }

  // Line 15-16: Estimated payments / refundable credits (not modeled → 0)

  // Line 17: Total Ohio tax payments
  drawDollarAtPos(pages, font, IT1040_PAYMENTS.line17, form.totalPayments)

  // ── Page 1: Lines 19-26 (Result) ─────────────────────────────
  // Line 19: Total payments (= line 17 for non-amended)
  drawDollarAtPos(pages, font, IT1040_RESULT.line19, form.totalPayments)

  if (form.amountOwed > 0) {
    // Line 20: Tax due
    drawDollarAtPos(pages, font, IT1040_RESULT.line20, form.amountOwed)
    // Line 22: TOTAL AMOUNT DUE
    drawDollarAtPos(pages, font, IT1040_RESULT.line22, form.amountOwed)
  }

  if (form.overpaid > 0) {
    // Line 23: Overpayment
    drawDollarAtPos(pages, font, IT1040_RESULT.line23, form.overpaid)
    // Line 26: REFUND
    drawDollarAtPos(pages, font, IT1040_RESULT.line26, form.overpaid)
  }

  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateFormIT1040OH(
  taxReturn: TaxReturn,
  form: FormIT1040Result,
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

  draw('Ohio Form IT 1040', 72, 16, true)
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

  // ── Income ───────────────────────────────────────────────────
  draw('Income', 72, 11, true)
  y -= 16
  drawLine('Federal AGI', form.federalAGI)
  drawLine('Ohio Deductions (SS Exemption)', form.ssExemption)
  drawLine('Ohio AGI', form.ohAGI)

  // ── Tax ──────────────────────────────────────────────────────
  y -= 8
  draw('Tax', 72, 11, true)
  y -= 16
  drawLine('Ohio Taxable Income', form.ohTaxableIncome)
  drawLine('Ohio Tax Before Credits', form.ohTaxBeforeCredits)
  if (form.personalExemptionCredit > 0) drawLine('Personal Exemption Credit', form.personalExemptionCredit)
  if (form.jointFilingCredit > 0) drawLine('Joint Filing Credit', form.jointFilingCredit)
  drawLine('Ohio Tax After Credits', form.taxAfterCredits)

  // ── Payments ─────────────────────────────────────────────────
  y -= 8
  draw('Payments', 72, 11, true)
  y -= 16
  drawLine('OH State Withholding', form.stateWithholding)

  // ── Result ───────────────────────────────────────────────────
  y -= 8
  draw('Result', 72, 11, true)
  y -= 16
  if (form.overpaid > 0) drawLine('Refund', form.overpaid)
  else drawLine('Amount You Owe', form.amountOwed)

  y -= 20
  page.drawText('Generated by OpenTax — for review. File using official OH Form IT 1040.', {
    x: 72, y, size: 7, font, color: gray,
  })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const ohFormCompiler: StateFormCompiler = {
  stateCode: 'OH',

  templateFiles: ['it1040.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form = stateResult.detail as FormIT1040Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('it1040')
    const doc = templateBytes
      ? await fillFormIT1040OHTemplate(templateBytes, taxReturn, form)
      : await generateFormIT1040OH(taxReturn, form)

    return {
      doc,
      forms: [
        {
          formId: 'OH Form IT 1040',
          sequenceNumber: 'OH-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
