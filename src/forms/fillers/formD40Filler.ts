/**
 * DC Form D-40 PDF filler.
 *
 * Fills the official District of Columbia Form D-40 (Individual Income Tax
 * Return) template from computed Form D-40 results. Falls back to
 * programmatic generation when no template is available.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { FormD40Result } from '../../rules/2025/dc/formd40'
import type { StateCompiledForms, StateFormCompiler, StateFormTemplates } from '../stateCompiler'
import { setTextField, setDollarField, checkBox, formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import {
  D40_HEADER, D40_FILING_STATUS, D40_CHECKBOXES,
  D40_AGI, D40_TAX, D40_CREDITS, D40_REFUNDABLE,
  D40_PAYMENTS, D40_RESULT,
} from '../mappings/formD40Fields'

// ── Template-based filler ────────────────────────────────────────

async function fillFormD40Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  d40: FormD40Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Header / Personal Info ─────────────────────────────────
  setTextField(form, D40_HEADER.firstName, tp.firstName + (tp.middleInitial ? ` ${tp.middleInitial}` : ''))
  setTextField(form, D40_HEADER.lastName, tp.lastName)
  setTextField(form, D40_HEADER.ssn, formatSSN(tp.ssn || '000000000'))
  setTextField(form, D40_HEADER.addressLine1, tp.address.street)
  if (tp.address.apartment) {
    setTextField(form, D40_HEADER.addressLine2, tp.address.apartment)
  }
  setTextField(form, D40_HEADER.city, tp.address.city)
  setTextField(form, D40_HEADER.state, tp.address.state)
  setTextField(form, D40_HEADER.zip, tp.address.zip)

  // Spouse (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setTextField(form, D40_HEADER.spouseFirstName, sp.firstName + (sp.middleInitial ? ` ${sp.middleInitial}` : ''))
    setTextField(form, D40_HEADER.spouseLastName, sp.lastName)
    setTextField(form, D40_HEADER.spouseSSN, formatSSN(sp.ssn))
  }

  // ── Filing Status ──────────────────────────────────────────
  const statusMap: Record<string, string> = {
    single: D40_FILING_STATUS.single,
    hoh:    D40_FILING_STATUS.hoh,
    mfj:    D40_FILING_STATUS.mfj,
    mfs:    D40_FILING_STATUS.mfs,
    qw:     D40_FILING_STATUS.qw,
  }
  const selectedOption = statusMap[taxReturn.filingStatus]
  if (selectedOption) {
    try {
      const radioGroup = form.getRadioGroup(D40_FILING_STATUS.radioGroup)
      radioGroup.select(selectedOption)
    } catch {
      // Radio group not found — skip silently
    }
  }

  // ── Part-Year Residency ────────────────────────────────────
  if (d40.residencyType === 'part-year') {
    checkBox(form, D40_CHECKBOXES.partYearTotal)
  }

  // ── DC AGI and Deductions ──────────────────────────────────
  // Line 17: DC adjusted gross income
  setDollarField(form, D40_AGI.dcAGI, d40.dcAGI)

  // Deduction type radio: "S" = Standard, "I" = Itemized
  try {
    const dedRadio = form.getRadioGroup(D40_AGI.deductionType)
    dedRadio.select(d40.deductionMethod === 'itemized' ? 'I' : 'S')
  } catch {
    // Radio group not found — skip silently
  }

  // Line 18: Deduction amount
  setDollarField(form, D40_AGI.deductionAmount, d40.deductionUsed)

  // Line 19: DC taxable income
  setDollarField(form, D40_AGI.dcTaxableIncome, d40.dcTaxableIncome)

  // ── Tax (Line 20) ─────────────────────────────────────────
  setDollarField(form, D40_TAX.dcTax, d40.dcTax)

  // ── Credits (Lines 21-24) ─────────────────────────────────
  // Line 23: Total non-refundable credits (0 for simple returns)
  // Line 24: Tax after non-refundable credits = DC tax - credits
  setDollarField(form, D40_CREDITS.line24_taxAfterCr, d40.taxAfterCredits)

  // ── Refundable Credits (Lines 26-33) ──────────────────────
  // Line 26: Total tax (tax after credits + HSR)
  setDollarField(form, D40_REFUNDABLE.line26_totalTax, d40.taxAfterCredits)

  // Line 33: Total credits
  // (For simple returns, total credits = 0; set only if nonzero)

  // ── Payments (Lines 34-37) ────────────────────────────────
  // Line 34: DC income tax withheld
  if (d40.stateWithholding > 0) {
    setDollarField(form, D40_PAYMENTS.line34_withheld, d40.stateWithholding)
  }

  // Line 37: Total payments
  setDollarField(form, D40_PAYMENTS.line37_totalPayment, d40.totalPayments)

  // ── Tax Due / Refund ──────────────────────────────────────
  if (d40.amountOwed > 0) {
    // Line 38: Tax due
    setDollarField(form, D40_RESULT.line38_taxDue, d40.amountOwed)
    // Line 43: Total amount due
    setDollarField(form, D40_RESULT.line43_totalDue, d40.amountOwed)
  }

  if (d40.overpaid > 0) {
    // Line 39: Overpayment
    setDollarField(form, D40_RESULT.line39_overpayment, d40.overpaid)
    // Line 44: Net refund
    setDollarField(form, D40_RESULT.line44_netRefund, d40.overpaid)
  }

  form.flatten()
  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateFormD40(taxReturn: TaxReturn, d40: FormD40Result): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const page = pdfDoc.addPage([612, 792])

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const blue = rgb(0.08, 0.15, 0.35)

  let y = 750
  const draw = (text: string, x: number, size: number, bold = false, color = black) => {
    page.drawText(text, { x, y, size, font: bold ? fontBold : font, color })
  }
  const drawLine = (label: string, line: string, value: string) => {
    draw(`Line ${line}`, 72, 9, false, gray)
    draw(label, 120, 9)
    draw(value, 450, 9, true)
    y -= 16
  }

  draw('District of Columbia Form D-40', 72, 16, true, blue); y -= 14
  draw('Individual Income Tax Return — 2025', 72, 10, false, gray); y -= 14
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: blue }); y -= 20

  const tp = taxReturn.taxpayer
  draw(`Name: ${tp.firstName} ${tp.lastName}`, 72, 9)
  y -= 14
  draw(`SSN: ${formatSSN(tp.ssn || '000000000')}`, 72, 9)
  draw(`Filing status: ${filingStatusLabel(taxReturn.filingStatus)}`, 300, 9)
  y -= 14
  draw(`Address: ${tp.address.street}, ${tp.address.city}, ${tp.address.state} ${tp.address.zip}`, 72, 9)
  y -= 22

  drawLine('Federal AGI', '1', `$${formatDollars(d40.federalAGI)}`)
  drawLine('DC AGI', '4', `$${formatDollars(d40.dcAGI)}`)
  drawLine('Deduction', '5', `$${formatDollars(d40.deductionUsed)}`)
  drawLine('DC taxable income', '6', `$${formatDollars(d40.dcTaxableIncome)}`)
  drawLine('DC tax', '12', `$${formatDollars(d40.dcTax)}`)

  if (d40.commuterExempt) {
    draw('Reciprocity override: MD/VA nonresident commuter (DC tax = $0).', 120, 8, false, gray)
    y -= 14
  }

  drawLine('DC withholding', '30', `$${formatDollars(d40.stateWithholding)}`)
  drawLine('Total payments', '36', `$${formatDollars(d40.totalPayments)}`)

  if (d40.overpaid > 0) drawLine('Refund', '40', `$${formatDollars(d40.overpaid)}`)
  else if (d40.amountOwed > 0) drawLine('Amount owed', '44', `$${formatDollars(d40.amountOwed)}`)
  else drawLine('Balance', '44', '$0')

  y -= 20
  draw('Generated by OpenTax for review. File with official DC OTR forms.', 72, 7, false, gray)

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const dcFormCompiler: StateFormCompiler = {
  stateCode: 'DC',

  templateFiles: ['d40.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const d40 = stateResult.detail as FormD40Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('d40')
    const doc = templateBytes
      ? await fillFormD40Template(templateBytes, taxReturn, d40)
      : await generateFormD40(taxReturn, d40)

    return {
      doc,
      forms: [{ formId: 'DC Form D-40', sequenceNumber: 'DC-01', pageCount: doc.getPageCount() }],
    }
  },
}
