/**
 * AZ Form 140 PDF filler.
 *
 * Fills the official Arizona Form 140 (Resident Personal Income Tax Return)
 * template from computed Form 140 results. Falls back to programmatic
 * generation when no template is available.
 *
 * The AZ Form 140 PDF has fillable AcroForm fields, so we can fill them
 * by name using pdf-lib's form API.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { Form140Result } from '../../rules/2025/az/az140'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel, setTextField, setDollarField } from '../helpers'

// ── Template-based filler ────────────────────────────────────────

async function fillForm140Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  form140: Form140Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()

  const tp = taxReturn.taxpayer

  // ── Header / Personal Info ──────────────────────────────────
  setTextField(form, '1a', tp.firstName)
  setTextField(form, '1b', tp.middleInitial ?? '')
  setTextField(form, '1c', tp.lastName)

  // SSN (field "8" is taxpayer SSN on AZ 140)
  setTextField(form, '8', formatSSN(tp.ssn || '000000000'))

  // Address
  setTextField(form, '2a', tp.address.street + (tp.address.apartment ? ` ${tp.address.apartment}` : ''))
  setTextField(form, 'City, Town, Post Office', tp.address.city)
  setTextField(form, 'State', tp.address.state)
  setTextField(form, 'ZIP Code', tp.address.zip)

  // Spouse info (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setTextField(form, '2b', sp.firstName)
    setTextField(form, '2c', sp.lastName)
    setTextField(form, '9', formatSSN(sp.ssn))
  }

  // ── Filing Status ──────────────────────────────────────────
  // The form has a radio group named "Filing Status"
  const statusMap: Record<string, string> = {
    single: '1',
    mfj: '2',
    mfs: '3',
    hoh: '4',
    qw: '5',
  }
  const statusValue = statusMap[taxReturn.filingStatus]
  if (statusValue) {
    try {
      const radio = form.getRadioGroup('Filing Status')
      radio.select(statusValue)
    } catch {
      // Skip if radio group issue
    }
  }

  // ── Dependents ─────────────────────────────────────────────
  // AZ Form 140 has dependent slots 10c-10n
  const depSlotIds = ['10c', '10d', '10e', '10f', '10g', '10h', '10i', '10j', '10k', '10l', '10m', '10n']
  const deps = taxReturn.dependents ?? []
  for (let i = 0; i < Math.min(deps.length, depSlotIds.length); i++) {
    const dep = deps[i]
    const prefix = depSlotIds[i]
    setTextField(form, `${prefix} First`, dep.firstName)
    setTextField(form, `${prefix} Last`, dep.lastName)
    setTextField(form, `${prefix} SSN`, formatSSN(dep.ssn))
    setTextField(form, `${prefix} Relationship`, dep.relationship)
    setTextField(form, `${prefix} Mo in Home`, String(dep.monthsLived))
  }

  // ── Income Lines ───────────────────────────────────────────

  // Line 12: Federal adjusted gross income
  setDollarField(form, '12', form140.federalAGI)

  // Line 13: Additions from AZ Schedule A(INT)
  setDollarField(form, '13', form140.additions)

  // Line 14: Subtotal (Line 12 + Line 13)
  setDollarField(form, '14', form140.federalAGI + form140.additions)

  // Line 15: Subtractions
  setDollarField(form, '15', form140.subtractions)

  // Line 16: AZ Adjusted Gross Income (Line 14 - Line 15)
  setDollarField(form, '16', form140.azAGI)

  // Line 17: Deductions (standard)
  setDollarField(form, '17', form140.standardDeduction)

  // Standard deduction checkbox
  try {
    const sdRadio = form.getRadioGroup('Itemized/Standard')
    sdRadio.select('Standard')
  } catch {
    // Skip
  }

  // Line 18: AZ Taxable Income (Line 16 - Line 17)
  setDollarField(form, '18', Math.max(0, form140.azAGI - form140.standardDeduction))

  // Line 19: Dependent exemption ($100 x dependents)
  if (form140.dependentExemption > 0) {
    setDollarField(form, '19', form140.dependentExemption)
  }

  // Line 20: Arizona taxable income (Line 18 - Line 19)
  setDollarField(form, '20', form140.azTaxableIncome)

  // Line 21: Tax amount (2.5% flat rate)
  setDollarField(form, '21', form140.azTax)

  // ── Credits ────────────────────────────────────────────────

  // Line 22-30 are various credits
  // Line 31: Family Tax Credit
  if (form140.familyTaxCredit > 0) {
    setDollarField(form, '31', form140.familyTaxCredit)
  }

  // Line 32: Total credits
  if (form140.totalCredits > 0) {
    setDollarField(form, '32', form140.totalCredits)
  }

  // Line 33: Tax after credits
  setDollarField(form, '33', form140.taxAfterCredits)

  // ── Payments ───────────────────────────────────────────────

  // Line 42: AZ tax withheld
  if (form140.stateWithholding > 0) {
    setDollarField(form, '42', form140.stateWithholding)
  }

  // Line 48: Total payments
  setDollarField(form, '48', form140.totalPayments)

  // ── Balance Due / Overpayment ──────────────────────────────

  if (form140.amountOwed > 0) {
    // Line 49: Tax due
    setDollarField(form, '49', form140.amountOwed)
    // Line 56: Amount owed
    setDollarField(form, '56', form140.amountOwed)
  }

  if (form140.overpaid > 0) {
    // Line 50: Overpayment
    setDollarField(form, '50', form140.overpaid)
    // Line 55: Refund amount
    setDollarField(form, '55', form140.overpaid)
  }

  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateForm140(
  taxReturn: TaxReturn,
  form140: Form140Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const darkRed = rgb(0.55, 0.1, 0.1)

  const page = pdfDoc.addPage([612, 792])
  let y = 750

  const draw = (text: string, x: number, size: number, opts?: { font?: typeof font; color?: typeof black }) => {
    page.drawText(text, { x, y, size, font: opts?.font ?? font, color: opts?.color ?? black })
  }

  const drawLine = (label: string, value: string, opts?: { bold?: boolean }) => {
    draw(label, 72, 9, opts?.bold ? { font: fontBold } : undefined)
    draw(value, 460, 9, { font: fontBold })
    y -= 16
  }

  draw('Arizona Form 140', 72, 16, { font: fontBold, color: darkRed })
  y -= 12
  draw('Resident Personal Income Tax Return — 2025', 72, 10, { color: gray })
  y -= 6
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: darkRed })
  y -= 20

  draw('Taxpayer Information', 72, 11, { font: fontBold })
  y -= 16
  draw(`Name: ${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`, 90, 9)
  y -= 14
  draw(`SSN: ${formatSSN(taxReturn.taxpayer.ssn || '000000000')}`, 90, 9)
  draw(`Filing Status: ${filingStatusLabel(taxReturn.filingStatus)}`, 300, 9)
  y -= 14

  y -= 8
  draw('Income', 72, 11, { font: fontBold, color: darkRed })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal AGI', `$${formatDollars(form140.federalAGI)}`)
  if (form140.additions > 0) {
    drawLine('AZ Additions', `$${formatDollars(form140.additions)}`)
  }
  if (form140.subtractions > 0) {
    drawLine('AZ Subtractions', `($${formatDollars(form140.subtractions)})`)
  }
  drawLine('Arizona AGI', `$${formatDollars(form140.azAGI)}`, { bold: true })

  y -= 8
  draw('Deductions & Exemptions', 72, 11, { font: fontBold, color: darkRed })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Standard Deduction', `$${formatDollars(form140.standardDeduction)}`)
  if (form140.dependentExemption > 0) {
    drawLine('Dependent Exemption', `$${formatDollars(form140.dependentExemption)}`)
  }
  drawLine('Taxable Income', `$${formatDollars(form140.azTaxableIncome)}`, { bold: true })

  y -= 8
  draw('Tax, Credits, and Payments', 72, 11, { font: fontBold, color: darkRed })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('AZ Tax (2.5%)', `$${formatDollars(form140.azTax)}`)
  if (form140.totalCredits > 0) {
    drawLine('Credits', `($${formatDollars(form140.totalCredits)})`)
  }
  drawLine('Tax After Credits', `$${formatDollars(form140.taxAfterCredits)}`, { bold: true })

  if (form140.stateWithholding > 0) {
    drawLine('AZ Withholding', `$${formatDollars(form140.stateWithholding)}`)
  }
  drawLine('Total Payments', `$${formatDollars(form140.totalPayments)}`, { bold: true })

  if (form140.overpaid > 0) {
    drawLine('Refund', `$${formatDollars(form140.overpaid)}`, { bold: true })
  } else if (form140.amountOwed > 0) {
    drawLine('Amount Owed', `$${formatDollars(form140.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '$0')
  }

  if (form140.apportionmentRatio < 1.0) {
    y -= 8
    draw(`Part-year apportionment ratio: ${form140.apportionmentRatio.toFixed(4)}`, 72, 8, { color: gray })
    y -= 12
  }

  y -= 20
  draw('Generated by OpenTax for review. File with official AZ Form 140.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const azFormCompiler: StateFormCompiler = {
  stateCode: 'AZ',
  templateFiles: ['az140.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form140 = stateResult.detail as Form140Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('az140')
    const doc = templateBytes
      ? await fillForm140Template(templateBytes, taxReturn, form140)
      : await generateForm140(taxReturn, form140)

    return {
      doc,
      forms: [{
        formId: stateResult.formLabel,
        sequenceNumber: 'AZ-01',
        pageCount: doc.getPageCount(),
      }],
    }
  },
}
