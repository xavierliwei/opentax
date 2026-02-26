/**
 * IL Form IL-1040 PDF filler.
 *
 * Fills the official Illinois Form IL-1040 (Individual Income Tax Return)
 * template from computed IL-1040 results. Falls back to programmatic
 * generation when no template is available.
 *
 * The official IL-1040 PDF has proper AcroForm text fields that can be
 * filled directly by field name.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { IL1040Result } from '../../rules/2025/il/il1040'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { setTextField, setDollarField, formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import {
  IL1040_HEADER, IL1040_INCOME, IL1040_EXEMPTIONS,
  IL1040_TAX, IL1040_PAYMENTS, IL1040_RESULT,
} from '../mappings/formIL1040Fields'

// ── Template-based filler ────────────────────────────────────────

async function fillIL1040Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  il1040: IL1040Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Step 1: Personal Information ───────────────────────────
  setTextField(form, IL1040_HEADER.firstName,
    tp.firstName + (tp.middleInitial ? ` ${tp.middleInitial}` : ''))
  setTextField(form, IL1040_HEADER.lastName, tp.lastName)
  setTextField(form, IL1040_HEADER.ssn, formatSSN(tp.ssn || '000000000'))

  if (tp.dateOfBirth) {
    setTextField(form, IL1040_HEADER.dob, tp.dateOfBirth)
  }

  // Mailing address
  setTextField(form, IL1040_HEADER.address, tp.address.street)
  if (tp.address.apartment) {
    setTextField(form, IL1040_HEADER.aptNo, tp.address.apartment)
  }
  setTextField(form, IL1040_HEADER.city, tp.address.city)
  setTextField(form, IL1040_HEADER.state, tp.address.state)
  setTextField(form, IL1040_HEADER.zip, tp.address.zip)

  // Spouse info (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setTextField(form, IL1040_HEADER.spouseFirstName,
      sp.firstName + (sp.middleInitial ? ` ${sp.middleInitial}` : ''))
    setTextField(form, IL1040_HEADER.spouseLastName, sp.lastName)
    setTextField(form, IL1040_HEADER.spouseSSN, formatSSN(sp.ssn))
    if (sp.dateOfBirth) {
      setTextField(form, IL1040_HEADER.spouseDob, sp.dateOfBirth)
    }
  }

  // ── Step 3: Base Income ────────────────────────────────────

  // Line 1: Federal AGI
  setDollarField(form, IL1040_INCOME.federalAGI, il1040.federalAGI)

  // Line 2: Federally tax-exempt interest
  setDollarField(form, IL1040_INCOME.taxExemptInterest, il1040.taxExemptInterest)

  // Line 4: Total income (Line 1 + Line 2 + Line 3)
  const totalIncome = il1040.federalAGI + il1040.ilAdditions
  setDollarField(form, IL1040_INCOME.totalIncome, totalIncome)

  // Line 5: Social Security and retirement subtraction
  const ssSub = il1040.socialSecuritySubtraction
  setDollarField(form, IL1040_INCOME.line5, ssSub)

  // Line 6: Other subtractions (US gov interest + IL tax refund)
  const otherSub = il1040.usGovInterest + il1040.ilTaxRefundSubtraction
  setDollarField(form, IL1040_INCOME.line6, otherSub)

  // Line 7: Total subtractions (Lines 5+6)
  setDollarField(form, IL1040_INCOME.totalSubtractions, il1040.ilSubtractions)

  // Line 9: Illinois base income
  setDollarField(form, IL1040_INCOME.baseIncome, il1040.ilBaseIncome)

  // ── Step 4: Exemptions ─────────────────────────────────────

  // Basic exemption: $2,625 per person (taxpayer + spouse)
  let basicExemptionCount = 1
  if (taxReturn.filingStatus === 'mfj' && taxReturn.spouse) {
    basicExemptionCount = 2
  }
  setDollarField(form, IL1040_EXEMPTIONS.exemptionAmount,
    basicExemptionCount * 262500)

  // Dependents
  if (taxReturn.dependents.length > 0) {
    setTextField(form, IL1040_EXEMPTIONS.dependentsClaimed,
      String(taxReturn.dependents.length))
  }

  // Line 11: Total exemption allowance
  setDollarField(form, IL1040_EXEMPTIONS.exemptionAllowance, il1040.exemptionAllowance)

  // ── Step 5-7: Tax ──────────────────────────────────────────

  // Income tax (4.95% of net income)
  setDollarField(form, IL1040_TAX.incomeTax, il1040.ilTax)

  // Total credits
  if (il1040.totalCredits > 0) {
    setDollarField(form, IL1040_TAX.totalCredits, il1040.totalCredits)
  }

  // Tax after nonrefundable credits
  setDollarField(form, IL1040_TAX.taxAfterCredits, il1040.taxAfterCredits)

  // Total tax (same as tax after credits when no use tax/household tax)
  setDollarField(form, IL1040_TAX.totalTax, il1040.taxAfterCredits)

  // ── Step 8-9: Payments ─────────────────────────────────────

  // Total tax from Page 1
  setDollarField(form, IL1040_PAYMENTS.totalTaxPage1, il1040.taxAfterCredits)

  // IL income tax withheld
  if (il1040.stateWithholding > 0) {
    setDollarField(form, IL1040_PAYMENTS.withheld, il1040.stateWithholding)
  }

  // IL Earned Income Credit (refundable)
  if (il1040.ilEIC > 0) {
    setDollarField(form, IL1040_PAYMENTS.eic, il1040.ilEIC)
  }

  // Total payments
  const totalPaymentsAndCredits = il1040.stateWithholding + il1040.ilEIC
  setDollarField(form, IL1040_PAYMENTS.totalPayments, totalPaymentsAndCredits)

  // ── Step 10-11: Result ─────────────────────────────────────

  if (il1040.overpaid > 0) {
    setDollarField(form, IL1040_RESULT.overpayment, il1040.overpaid)
    setDollarField(form, IL1040_RESULT.overpaymentAmount, il1040.overpaid)
    setDollarField(form, IL1040_RESULT.refund, il1040.overpaid)
  }

  if (il1040.amountOwed > 0) {
    setDollarField(form, IL1040_RESULT.underpayment, il1040.amountOwed)
    setDollarField(form, IL1040_RESULT.amountYouOwe, il1040.amountOwed)
  }

  // Flatten form so fields are rendered as static text
  form.flatten()

  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateIL1040(
  taxReturn: TaxReturn,
  form: IL1040Result,
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

  draw('Illinois Form IL-1040', 72, 16, true)
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
  if (form.ilAdditions > 0) drawLine('IL Additions', form.ilAdditions)
  if (form.ilSubtractions > 0) drawLine('IL Subtractions', form.ilSubtractions)
  drawLine('Illinois Base Income', form.ilBaseIncome)

  y -= 8
  draw('Exemptions & Tax', 72, 11, true)
  y -= 16
  drawLine(`Exemption Allowance (${form.exemptionCount} x $2,625)`, form.exemptionAllowance)
  drawLine('Illinois Net Income', form.ilNetIncome)
  drawLine('Illinois Taxable Income', form.ilTaxableIncome)
  drawLine('Illinois Tax (4.95%)', form.ilTax)
  if (form.ilEIC > 0) drawLine('IL Earned Income Credit', form.ilEIC)
  drawLine('Tax After Credits', form.taxAfterCredits)

  y -= 8
  draw('Payments', 72, 11, true)
  y -= 16
  drawLine('IL State Withholding', form.stateWithholding)

  y -= 8
  draw('Result', 72, 11, true)
  y -= 16
  if (form.overpaid > 0) drawLine('Refund', form.overpaid)
  else drawLine('Amount You Owe', form.amountOwed)

  y -= 20
  page.drawText('Generated by OpenTax — for review. File using official IL Form IL-1040.', {
    x: 72, y, size: 7, font, color: gray,
  })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const ilFormCompiler: StateFormCompiler = {
  stateCode: 'IL',

  templateFiles: ['il1040.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form = stateResult.detail as IL1040Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('il1040')
    const doc = templateBytes
      ? await fillIL1040Template(templateBytes, taxReturn, form)
      : await generateIL1040(taxReturn, form)

    return {
      doc,
      forms: [
        {
          formId: 'IL Form IL-1040',
          sequenceNumber: 'IL-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
