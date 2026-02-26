/**
 * VA Form 760 PDF filler.
 *
 * Fills the official Virginia Form 760 (Resident Income Tax Return) template
 * from computed Form 760 results. Falls back to programmatic generation
 * when no template is available.
 *
 * The official VA Form 760 PDF uses AcroForm text fields and checkboxes,
 * so we use pdf-lib's form API to fill named fields.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { Form760Result } from '../../rules/2025/va/form760'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { setTextField, setDollarField, checkBox, formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import {
  F760_HEADER, F760_FILING_STATUS, F760_EXEMPTIONS,
  F760_INCOME, F760_TAX, F760_PAYMENTS,
} from '../mappings/form760Fields'

// ── Template-based filler ────────────────────────────────────────

async function fillForm760Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  form760: Form760Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Header / Personal Info ─────────────────────────────────
  setTextField(form, F760_HEADER.firstName, tp.firstName)
  if (tp.middleInitial) {
    setTextField(form, F760_HEADER.middleInitial, tp.middleInitial)
  }
  setTextField(form, F760_HEADER.lastName, tp.lastName)
  setTextField(form, F760_HEADER.ssn, (tp.ssn || '000000000').replace(/\D/g, ''))
  setTextField(form, F760_HEADER.lastNameLetters, tp.lastName.substring(0, 4).toUpperCase())

  // Spouse (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setTextField(form, F760_HEADER.spouseFirstName, sp.firstName)
    if (sp.middleInitial) {
      setTextField(form, F760_HEADER.spouseMiddleInitial, sp.middleInitial)
    }
    setTextField(form, F760_HEADER.spouseLastName, sp.lastName)
    setTextField(form, F760_HEADER.spouseSSN, sp.ssn.replace(/\D/g, ''))
    setTextField(form, F760_HEADER.spouseLastNameLetters, sp.lastName.substring(0, 4).toUpperCase())
  }

  // Address
  setTextField(form, F760_HEADER.address, tp.address.street)
  setTextField(form, F760_HEADER.city, tp.address.city)
  setTextField(form, F760_HEADER.state, tp.address.state)
  setTextField(form, F760_HEADER.zip, tp.address.zip)

  // Birthdate
  if (tp.dateOfBirth) {
    setTextField(form, F760_HEADER.yourBirthdate, tp.dateOfBirth)
  }
  if (taxReturn.spouse?.dateOfBirth) {
    setTextField(form, F760_HEADER.spouseBirthdate, taxReturn.spouse.dateOfBirth)
  }

  // ── Filing Status ──────────────────────────────────────────
  const statusMap: Record<string, string> = {
    single: '1',
    mfj: '2',
    mfs: '3',
    hoh: '4',
    qw: '5',
  }
  const statusCode = statusMap[taxReturn.filingStatus]
  if (statusCode) {
    setTextField(form, F760_FILING_STATUS.filingStatus, statusCode)
  }
  if (taxReturn.filingStatus === 'hoh') {
    checkBox(form, F760_FILING_STATUS.federalHOH)
  }

  // ── Exemptions ─────────────────────────────────────────────
  const numDependents = taxReturn.dependents?.length ?? 0
  if (numDependents > 0) {
    setTextField(form, F760_EXEMPTIONS.dependents, String(numDependents))
  }

  // Section A: personal + dependent exemptions
  const numFilersA = taxReturn.filingStatus === 'mfj' || taxReturn.filingStatus === 'mfs' ? 2 : 1
  const totalExemptionsA = numFilersA + numDependents
  setTextField(form, F760_EXEMPTIONS.totalExemptionsA, String(totalExemptionsA))
  setDollarField(form, F760_EXEMPTIONS.totalExemptionsDollarA, form760.personalExemptions + form760.dependentExemptions)

  // Section B: age 65+ and blind exemptions
  if (form760.age65Exemptions + form760.blindExemptions > 0) {
    const totalBExemptionCents = form760.age65Exemptions + form760.blindExemptions
    const countB = Math.round(totalBExemptionCents / 80000) // $800 each
    setTextField(form, F760_EXEMPTIONS.totalExemptionsB, String(countB))
    setDollarField(form, F760_EXEMPTIONS.totalExemptionsDollarB, totalBExemptionCents)
  }

  // ── Income (Lines 1–15) ────────────────────────────────────

  // Line 1: Federal AGI
  setDollarField(form, F760_INCOME.line1, form760.federalAGI)

  // Line 2: Additions from Schedule ADJ
  if (form760.vaAdjustments.additions > 0) {
    setDollarField(form, F760_INCOME.line2, form760.vaAdjustments.additions)
  }

  // Line 3: FAGI + additions
  const line3 = form760.federalAGI + form760.vaAdjustments.additions
  setDollarField(form, F760_INCOME.line3, line3)

  // Line 7: Subtractions from Schedule ADJ
  if (form760.vaAdjustments.subtractions > 0) {
    setDollarField(form, F760_INCOME.line7, form760.vaAdjustments.subtractions)
  }

  // Line 8: Total subtractions
  if (form760.vaAdjustments.subtractions > 0) {
    setDollarField(form, F760_INCOME.line8, form760.vaAdjustments.subtractions)
  }

  // Line 9: Virginia AGI
  setDollarField(form, F760_INCOME.line9, form760.vaAGI)

  // Line 10/11: Deductions
  if (form760.deductionMethod === 'itemized') {
    setDollarField(form, F760_INCOME.line10, form760.vaItemizedDeduction)
  } else {
    setDollarField(form, F760_INCOME.line11, form760.vaStandardDeduction)
  }

  // Line 12: Total exemptions
  setDollarField(form, F760_INCOME.line12, form760.totalExemptions)

  // Line 13: Total deductions
  setDollarField(form, F760_INCOME.line13, form760.deductionUsed + form760.totalExemptions)

  // Line 15: Virginia taxable income
  setDollarField(form, F760_INCOME.line15, form760.vaTaxableIncome)

  // ── Page 2: Tax & Credits (Lines 16–25) ────────────────────

  // SSN on page 2
  setTextField(form, F760_TAX.ssn, (tp.ssn || '000000000').replace(/\D/g, ''))

  // Line 16: VA income tax
  setDollarField(form, F760_TAX.line16, form760.vaTax)

  // Line 18: Net amount of tax (same as line 16 when no spouse adjustment)
  setDollarField(form, F760_TAX.line18, form760.vaTax)

  // Line 19a: Your VA withholding
  if (form760.stateWithholding > 0) {
    setDollarField(form, F760_TAX.line19a, form760.stateWithholding)
  }

  // Line 20: Estimated payments
  if (form760.estimatedPayments > 0) {
    setDollarField(form, F760_TAX.line20, form760.estimatedPayments)
  }

  // Line 23: Low-income / EIC credit
  if (form760.lowIncomeCredit > 0) {
    setDollarField(form, F760_TAX.line23, form760.lowIncomeCredit)
  }

  // ── Payments & Result (Lines 26–36) ────────────────────────

  // Line 26: Total payments & credits
  setDollarField(form, F760_PAYMENTS.line26, form760.totalPayments + form760.totalCredits)

  // Line 27/35: Tax owed
  if (form760.amountOwed > 0) {
    setDollarField(form, F760_PAYMENTS.line27, form760.amountOwed)
    setDollarField(form, F760_PAYMENTS.line35, form760.amountOwed)
  }

  // Line 28/36: Overpayment / Refund
  if (form760.overpaid > 0) {
    setDollarField(form, F760_PAYMENTS.line28, form760.overpaid)
    setDollarField(form, F760_PAYMENTS.line36, form760.overpaid)
  }

  form.flatten()
  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateForm760(
  taxReturn: TaxReturn,
  form760: Form760Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const darkBlue = rgb(0.1, 0.15, 0.35)

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
  const isPartYear = form760.residencyType === 'part-year'
  const formTitle = isPartYear ? 'Virginia Form 760PY' : 'Virginia Form 760'
  const formSubtitle = isPartYear
    ? `Part-Year Resident Income Tax Return — 2025 (${Math.round(form760.apportionmentRatio * 100)}% VA)`
    : 'Resident Income Tax Return — 2025'
  draw(formTitle, 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw(formSubtitle, 72, 10, { color: gray })
  y -= 6
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: darkBlue })
  y -= 20

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

  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal adjusted gross income', '1', `$${formatDollars(form760.federalAGI)}`)
  if (form760.vaAdjustments.additions > 0) {
    drawLine('Schedule ADJ additions', '2', `$${formatDollars(form760.vaAdjustments.additions)}`)
  }
  if (form760.vaAdjustments.subtractions > 0) {
    drawLine('Schedule ADJ subtractions', '4', `($${formatDollars(form760.vaAdjustments.subtractions)})`)
  }
  drawLine('Virginia adjusted gross income', '5', `$${formatDollars(form760.vaAGI)}`, { bold: true })
  if (form760.vaSourceIncome !== undefined) {
    draw(`Apportionment: ${Math.round(form760.apportionmentRatio * 100)}% — VA-source income: $${formatDollars(form760.vaSourceIncome)}`, 120, 8, { color: gray })
    y -= 14
  }
  y -= 6

  draw('Deductions & Exemptions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16
  const dedLabel = form760.deductionMethod === 'itemized' ? 'VA itemized deductions' : 'VA standard deduction'
  drawLine(dedLabel, '6', `$${formatDollars(form760.deductionUsed)}`)
  drawLine('Personal exemptions', '7', `$${formatDollars(form760.totalExemptions)}`)
  drawLine('Virginia taxable income', '9', `$${formatDollars(form760.vaTaxableIncome)}`, { bold: true })
  y -= 6

  draw('Tax & Credits', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16
  drawLine('Virginia income tax', '10', `$${formatDollars(form760.vaTax)}`)
  if (form760.lowIncomeCredit > 0) {
    drawLine('Low-income credit', '12', `($${formatDollars(form760.lowIncomeCredit)})`)
  }
  drawLine('Tax after credits', '13', `$${formatDollars(form760.taxAfterCredits)}`, { bold: true })
  y -= 6

  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16
  if (form760.stateWithholding > 0) {
    drawLine('VA state income tax withheld', '18', `$${formatDollars(form760.stateWithholding)}`)
  }
  drawLine('Total payments', '25', `$${formatDollars(form760.totalPayments)}`, { bold: true })
  y -= 6

  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16
  if (form760.overpaid > 0) {
    drawLine('Overpaid (refund)', '27', `$${formatDollars(form760.overpaid)}`, { bold: true })
  } else if (form760.amountOwed > 0) {
    drawLine('Amount you owe', '35', `$${formatDollars(form760.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  const officialForm = isPartYear ? 'VA Form 760PY' : 'VA Form 760'
  draw(`Generated by OpenTax — for review purposes. File using official ${officialForm}.`, 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const vaFormCompiler: StateFormCompiler = {
  stateCode: 'VA',

  templateFiles: ['f760.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form760 = stateResult.detail as Form760Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('f760')
    const doc = templateBytes
      ? await fillForm760Template(templateBytes, taxReturn, form760)
      : await generateForm760(taxReturn, form760)

    const formId = form760.residencyType === 'part-year' ? 'VA Form 760PY' : 'VA Form 760'

    return {
      doc,
      forms: [
        {
          formId,
          sequenceNumber: 'VA-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
