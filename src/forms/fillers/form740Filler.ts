/**
 * KY Form 740 PDF filler.
 *
 * Fills the official Kentucky Form 740 (Individual Income Tax Return)
 * template from computed Form 740 results. Falls back to programmatic
 * generation when no template is available.
 *
 * The official KY Form 740 PDF has proper AcroForm text fields that can be
 * filled directly by field name.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { Form740Result } from '../../rules/2025/ky/form740'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { setTextField, setDollarField, formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import {
  KY740_HEADER, KY740_DEDUCTIONS,
  KY740_TAX, KY740_PAYMENTS, KY740_RESULT,
} from '../mappings/form740Fields'

// ── Template-based filler ────────────────────────────────────────

async function fillForm740Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  form740: Form740Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Header / Personal Information ────────────────────────────
  const fullName = tp.firstName +
    (tp.middleInitial ? ` ${tp.middleInitial}` : '') +
    ` ${tp.lastName}` +
    (taxReturn.spouse
      ? ` & ${taxReturn.spouse.firstName}` +
        (taxReturn.spouse.middleInitial ? ` ${taxReturn.spouse.middleInitial}` : '') +
        ` ${taxReturn.spouse.lastName}`
      : '')
  setTextField(form, KY740_HEADER.name, fullName)
  setTextField(form, KY740_HEADER.primarySSN, formatSSN(tp.ssn || '000000000'))

  if (taxReturn.spouse) {
    setTextField(form, KY740_HEADER.spouseSSN, formatSSN(taxReturn.spouse.ssn))
  }

  // Address
  const addressLine = tp.address.street +
    (tp.address.apartment ? `, Apt ${tp.address.apartment}` : '')
  setTextField(form, KY740_HEADER.streetAddress, addressLine)
  setTextField(form, KY740_HEADER.city, tp.address.city)
  setTextField(form, KY740_HEADER.state, tp.address.state)
  setTextField(form, KY740_HEADER.zip, tp.address.zip)

  // ── Income & Adjustments ─────────────────────────────────────
  // Line 14A: Federal AGI (KY starts from federal AGI)
  setDollarField(form, KY740_DEDUCTIONS.line14A, form740.federalAGI)

  // Line 15A: KY additions (Schedule M)
  setDollarField(form, KY740_DEDUCTIONS.line15A, form740.kyAdditions)

  // Line 16A: KY subtractions (Schedule M)
  setDollarField(form, KY740_DEDUCTIONS.line16A, form740.kySubtractions)

  // Line 17A: KY AGI
  setDollarField(form, KY740_DEDUCTIONS.line17A, form740.kyAGI)

  // Line 18A: Standard deduction
  setDollarField(form, KY740_DEDUCTIONS.line18A, form740.standardDeduction)

  // Line 19: KY taxable income
  setDollarField(form, KY740_DEDUCTIONS.line19, form740.kyTaxableIncome)

  // ── Tax & Credits ────────────────────────────────────────────
  // Line 21: Family Size Tax Credit
  if (form740.familySizeTaxCredit > 0) {
    setDollarField(form, KY740_TAX.line21, form740.familySizeTaxCredit)
  }

  // Line 22: KY income tax after FSTC
  const taxAfterFSTC = Math.max(0, form740.kyTax - form740.familySizeTaxCredit)
  setDollarField(form, KY740_TAX.line22, taxAfterFSTC)

  // Line 24: Personal tax credit ($40 per person)
  setDollarField(form, KY740_TAX.line24, form740.personalTaxCredit)

  // Line 26: Tax after nonrefundable credits
  setDollarField(form, KY740_TAX.line26, form740.taxAfterCredits)

  // Line 30: Total tax (same as tax after credits when no use tax, etc.)
  setDollarField(form, KY740_TAX.line30, form740.taxAfterCredits)

  // ── Payments ─────────────────────────────────────────────────
  // Line 31a: KY income tax withheld (W-2s)
  if (form740.stateWithholding > 0) {
    setDollarField(form, KY740_PAYMENTS.line31a, form740.stateWithholding)
  }

  // Line 32: Total KY income tax withheld
  setDollarField(form, KY740_PAYMENTS.line32, form740.stateWithholding)

  // Line 35: Total payments and credits
  setDollarField(form, KY740_PAYMENTS.line35, form740.totalPayments)

  // ── Result ───────────────────────────────────────────────────
  if (form740.amountOwed > 0) {
    // Line 36: Underpayment
    setDollarField(form, KY740_PAYMENTS.line36, form740.amountOwed)
    // Line 41: Amount you owe
    setDollarField(form, KY740_RESULT.line41, form740.amountOwed)
  }

  if (form740.overpaid > 0) {
    // Line 38a: Overpayment
    setDollarField(form, KY740_RESULT.line38a, form740.overpaid)
    // Line 40: Net refund
    setDollarField(form, KY740_RESULT.line40, form740.overpaid)
  }

  // Flatten form so fields are rendered as static text
  form.flatten()

  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateForm740(
  taxReturn: TaxReturn,
  form: Form740Result,
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

  draw('Kentucky Form 740', 72, 16, true)
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

  draw('Income', 72, 11, true)
  y -= 16
  drawLine('Federal AGI', form.federalAGI)
  if (form.kyAdditions > 0) drawLine('KY Additions', form.kyAdditions)
  if (form.kySubtractions > 0) drawLine('KY Subtractions', form.kySubtractions)
  drawLine('Kentucky AGI', form.kyAGI)

  y -= 8
  draw('Deductions & Tax', 72, 11, true)
  y -= 16
  drawLine('KY Standard Deduction', form.standardDeduction)
  drawLine('Kentucky Taxable Income', form.kyTaxableIncome)
  drawLine('Kentucky Tax (4.0%)', form.kyTax)
  drawLine(`Personal Tax Credit ($40 x ${form.personalTaxCreditCount})`, form.personalTaxCredit)
  if (form.familySizeTaxCredit > 0) drawLine('Family Size Tax Credit', form.familySizeTaxCredit)
  drawLine('Tax After Credits', form.taxAfterCredits)

  y -= 8
  draw('Payments', 72, 11, true)
  y -= 16
  drawLine('KY State Withholding', form.stateWithholding)

  y -= 8
  draw('Result', 72, 11, true)
  y -= 16
  if (form.overpaid > 0) drawLine('Refund', form.overpaid)
  else drawLine('Amount You Owe', form.amountOwed)

  y -= 20
  page.drawText('Generated by OpenTax — for review. File using official KY Form 740.', {
    x: 72, y, size: 7, font, color: gray,
  })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const kyFormCompiler: StateFormCompiler = {
  stateCode: 'KY',

  templateFiles: ['form740.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form = stateResult.detail as Form740Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('form740')
    const doc = templateBytes
      ? await fillForm740Template(templateBytes, taxReturn, form)
      : await generateForm740(taxReturn, form)

    return {
      doc,
      forms: [
        {
          formId: 'KY Form 740',
          sequenceNumber: 'KY-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
