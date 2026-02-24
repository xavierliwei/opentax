/**
 * CA Form 540 PDF filler.
 *
 * Fills the official FTB Form 540 (Resident Income Tax Return) template
 * from computed Form 540 results. Falls back to programmatic generation
 * when no template is available.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { Form540Result } from '../../rules/2025/ca/form540'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { setTextField, setDollarField, checkBox, formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import {
  F540_HEADER, F540_FILING_STATUS, F540_EXEMPTIONS,
  F540_PAGE2_HEADER, F540_INCOME, F540_TAX,
  F540_PAGE3, F540_PAGE4, F540_PAGE5,
} from '../mappings/form540Fields'

// ── Template-based filler ────────────────────────────────────────

async function fillForm540Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  form540: Form540Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Page 1: Header ─────────────────────────────────────────
  setTextField(form, F540_HEADER.firstName, tp.firstName + (tp.middleInitial ? ` ${tp.middleInitial}` : ''))
  setTextField(form, F540_HEADER.lastName, tp.lastName)
  setTextField(form, F540_HEADER.ssn, formatSSN(tp.ssn || '000000000'))
  setTextField(form, F540_HEADER.street, tp.address.street)
  if (tp.address.apartment) setTextField(form, F540_HEADER.apt, tp.address.apartment)
  setTextField(form, F540_HEADER.city, tp.address.city)
  setTextField(form, F540_HEADER.state, tp.address.state)
  setTextField(form, F540_HEADER.zip, tp.address.zip)
  checkBox(form, F540_HEADER.sameAddress)

  // Spouse (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setTextField(form, F540_HEADER.spouseFirstName, sp.firstName + (sp.middleInitial ? ` ${sp.middleInitial}` : ''))
    setTextField(form, F540_HEADER.spouseLastName, sp.lastName)
    setTextField(form, F540_HEADER.spouseSSN, formatSSN(sp.ssn))
  }

  // ── Filing status ──────────────────────────────────────────
  const statusOptions: Record<string, string> = {
    single: F540_FILING_STATUS.single,
    mfj:    F540_FILING_STATUS.mfj,
    mfs:    F540_FILING_STATUS.mfs,
    hoh:    F540_FILING_STATUS.hoh,
    qw:     F540_FILING_STATUS.qw,
  }
  const selectedStatus = statusOptions[taxReturn.filingStatus]
  if (selectedStatus) {
    try {
      const radio = form.getRadioGroup(F540_FILING_STATUS.radioGroup)
      radio.select(selectedStatus)
    } catch { /* ok */ }
  }
  if (taxReturn.filingStatus === 'mfs' && taxReturn.spouse) {
    setTextField(form, F540_FILING_STATUS.mfsSpouseName,
      `${taxReturn.spouse.firstName} ${taxReturn.spouse.lastName}`)
  }

  // ── Exemptions (Lines 7-11) ────────────────────────────────
  const CA_PERSONAL = 15300  // $153 in cents
  const CA_DEPENDENT = 47500  // $475 in cents
  const personalCount = form540.personalExemptionCredit > 0
    ? Math.round(form540.personalExemptionCredit / CA_PERSONAL) : 0
  const dependentCount = form540.dependentExemptionCredit > 0
    ? Math.round(form540.dependentExemptionCredit / CA_DEPENDENT) : 0

  if (personalCount > 0) {
    setTextField(form, F540_EXEMPTIONS.line7count, String(personalCount))
    setDollarField(form, F540_EXEMPTIONS.line7amount, form540.personalExemptionCredit)
  }
  if (dependentCount > 0) {
    setTextField(form, F540_DEPENDENTS_LINE10_COUNT, String(dependentCount))
    setDollarField(form, F540_DEPENDENTS_LINE10_AMOUNT, form540.dependentExemptionCredit)
  }
  // Line 11: total exemption amount (before phase-out)
  const exemptionTotal = form540.personalExemptionCredit + form540.dependentExemptionCredit
  setDollarField(form, F540_DEPENDENTS_LINE11, exemptionTotal)

  // ── Page 2 header ──────────────────────────────────────────
  const fullName = `${tp.firstName} ${tp.lastName}`
  setTextField(form, F540_PAGE2_HEADER.yourName, fullName)
  setTextField(form, F540_PAGE2_HEADER.yourSSN, formatSSN(tp.ssn || '000000000'))

  // ── Dependents (Line 10) ───────────────────────────────────
  const dependents = taxReturn.dependents ?? []
  const depFields = [
    { first: '540_form_2003', last: '540_form_2004', ssn: '540_form_2005', rel: '540_form_2006' },
    { first: '540_form_2007', last: '540_form_2008', ssn: '540_form_2009', rel: '540_form_2010' },
    { first: '540_form_2011', last: '540_form_2012', ssn: '540_form_2013', rel: '540_form_2014' },
  ]
  for (let i = 0; i < Math.min(dependents.length, 3); i++) {
    const dep = dependents[i]
    setTextField(form, depFields[i].first, dep.firstName)
    setTextField(form, depFields[i].last, dep.lastName)
    if (dep.ssn) setTextField(form, depFields[i].ssn, formatSSN(dep.ssn))
    if (dep.relationship) setTextField(form, depFields[i].rel, dep.relationship)
  }

  // ── State wages (Line 12) ─────────────────────────────────
  const stateWages = (taxReturn.w2s ?? []).reduce((sum, w) => sum + (w.box16StateWages ?? 0), 0)
  setDollarField(form, F540_INCOME.line12, stateWages)

  // ── Income (Lines 13-19) ──────────────────────────────────
  setDollarField(form, F540_INCOME.line13, form540.federalAGI)
  setDollarField(form, F540_INCOME.line14, form540.caAdjustments.subtractions)  // Line 14 = subtractions (column B)
  const line15 = form540.federalAGI - form540.caAdjustments.subtractions
  setDollarField(form, F540_INCOME.line15, line15)
  setDollarField(form, F540_INCOME.line16, form540.caAdjustments.additions)     // Line 16 = additions (column C)
  setDollarField(form, F540_INCOME.line17, form540.caAGI)
  setDollarField(form, F540_INCOME.line18, form540.deductionUsed)
  setDollarField(form, F540_INCOME.line19, form540.caTaxableIncome)

  // ── Tax (Lines 31-35) ─────────────────────────────────────
  checkBox(form, F540_TAX.taxRateSchedCB)  // We use tax rate schedule
  setDollarField(form, F540_TAX.line31, form540.caTax)
  setDollarField(form, F540_TAX.line32, form540.totalExemptionCredits)
  const line33 = Math.max(0, form540.caTax - form540.totalExemptionCredits)
  setDollarField(form, F540_TAX.line33, line33)
  // Line 34 = 0 (no Schedule G-1/FTB 5870A)
  setDollarField(form, F540_TAX.line35, line33) // Line 35 = Line 33 + Line 34

  // ── Credits (Lines 40-48) ─────────────────────────────────
  setDollarField(form, F540_PAGE3.line46, form540.rentersCredit)
  const totalCredits = form540.rentersCredit  // Only renter's credit for now
  setDollarField(form, F540_PAGE3.line47, totalCredits)
  setDollarField(form, F540_PAGE3.line48, form540.taxAfterCredits)

  // ── Other Taxes (Lines 61-64) ─────────────────────────────
  setDollarField(form, F540_PAGE3.line62, form540.mentalHealthTax)  // Behavioral Health Services Tax
  const totalTax = form540.taxAfterCredits + form540.mentalHealthTax
  setDollarField(form, F540_PAGE3.line64, totalTax)

  // ── Payments (Lines 71-78) ────────────────────────────────
  setDollarField(form, F540_PAGE3.line71, form540.stateWithholding)
  setDollarField(form, F540_PAGE3.line78, form540.totalPayments)

  // ── Use Tax (Line 91) ─────────────────────────────────────
  setTextField(form, F540_PAGE3.line91, '0')  // No use tax
  try {
    const useTaxRadio = form.getRadioGroup(F540_PAGE3.useTaxRadio)
    useTaxRadio.select(F540_PAGE3.useTaxNoOwed)
  } catch { /* ok */ }

  // ── Health care coverage (Line 92) ─────────────────────────
  checkBox(form, F540_PAGE3.line92cb)

  // ── Overpaid / Tax Due (Lines 93-100) ─────────────────────
  const line93 = form540.totalPayments  // Line 93 = Line 78 - Line 91 (use tax = 0)
  setDollarField(form, F540_PAGE3.line93, line93)
  setDollarField(form, F540_PAGE3.line95, line93)  // Line 95 = Line 93 (no ISR penalty)
  setDollarField(form, F540_PAGE3.line97, form540.overpaid)

  // Page 4
  setDollarField(form, F540_PAGE4.line99, form540.overpaid)   // Line 99 = Line 97 (no amount applied to est. tax)
  setDollarField(form, F540_PAGE4.line100, form540.amountOwed)

  // Page 5
  if (form540.amountOwed > 0) {
    setDollarField(form, F540_PAGE5.line111, form540.amountOwed)
  }
  if (form540.overpaid > 0) {
    setDollarField(form, F540_PAGE5.line115, form540.overpaid)
  }

  form.flatten()
  return pdfDoc
}

// Constants for dependent field references used above
const F540_DEPENDENTS_LINE10_COUNT = '540_form_2015'
const F540_DEPENDENTS_LINE10_AMOUNT = '540_form_2016'
const F540_DEPENDENTS_LINE11 = '540_form_2017'

// ── Programmatic fallback generator ──────────────────────────────

async function generateForm540(
  taxReturn: TaxReturn,
  form540: Form540Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const darkBlue = rgb(0.1, 0.15, 0.35)

  // ── Page 1 ────────────────────────────────────────────────────
  const page1 = pdfDoc.addPage([612, 792])
  let y = 750

  const draw = (text: string, x: number, size: number, opts?: { font?: typeof font; color?: typeof black }) => {
    page1.drawText(text, { x, y, size, font: opts?.font ?? font, color: opts?.color ?? black })
  }

  const drawLine = (label: string, lineNum: string, value: string, opts?: { bold?: boolean }) => {
    draw(`Line ${lineNum}`, 72, 9, { color: gray })
    draw(label, 120, 9, opts?.bold ? { font: fontBold } : undefined)
    draw(value, 460, 9, opts?.bold ? { font: fontBold } : { font: fontBold })
    y -= 16
  }

  // Header
  const isPartYear = form540.residencyType === 'part-year'
  const formTitle = isPartYear ? 'California Form 540NR' : 'California Form 540'
  const formSubtitle = isPartYear
    ? `Part-Year Resident Income Tax Return — 2025 (${Math.round(form540.apportionmentRatio * 100)}% CA)`
    : 'Resident Income Tax Return — 2025'
  draw(formTitle, 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw(formSubtitle, 72, 10, { color: gray })
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

  // ── Income Section ──────────────────────────────────────────
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal adjusted gross income', '13', `$${formatDollars(form540.federalAGI)}`)

  if (form540.caAdjustments.subtractions > 0) {
    drawLine('Schedule CA subtractions', '14', `($${formatDollars(form540.caAdjustments.subtractions)})`)
  }
  if (form540.caAdjustments.additions > 0) {
    drawLine('Schedule CA additions', '16', `$${formatDollars(form540.caAdjustments.additions)}`)
  }

  drawLine('California adjusted gross income', '17', `$${formatDollars(form540.caAGI)}`, { bold: true })

  if (form540.caSourceIncome !== undefined) {
    draw(`Apportionment: ${Math.round(form540.apportionmentRatio * 100)}% — CA-source income: $${formatDollars(form540.caSourceIncome)}`, 120, 8, { color: gray })
    y -= 14
  }
  y -= 6

  // ── Deductions Section ──────────────────────────────────────
  draw('Deductions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  const dedLabel = form540.deductionMethod === 'itemized'
    ? 'CA itemized deductions'
    : 'CA standard deduction'
  drawLine(dedLabel, '18', `$${formatDollars(form540.deductionUsed)}`)

  if (form540.deductionMethod === 'itemized') {
    draw(`(Standard: $${formatDollars(form540.caStandardDeduction)} vs Itemized: $${formatDollars(form540.caItemizedDeduction)})`, 120, 8, { color: gray })
    y -= 14
  }

  drawLine('California taxable income', '19', `$${formatDollars(form540.caTaxableIncome)}`, { bold: true })
  y -= 6

  // ── Tax Section ─────────────────────────────────────────────
  draw('Tax', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Tax (from tax rate schedule)', '31', `$${formatDollars(form540.caTax)}`)

  if (form540.totalExemptionCredits > 0) {
    drawLine('Exemption credits', '32', `($${formatDollars(form540.totalExemptionCredits)})`)
  }

  if (form540.mentalHealthTax > 0) {
    drawLine('Behavioral health services tax (1%)', '62', `$${formatDollars(form540.mentalHealthTax)}`)
  }

  if (form540.rentersCredit > 0) {
    drawLine("Renter's credit", '46', `($${formatDollars(form540.rentersCredit)})`)
  }

  drawLine('Tax after credits', '48', `$${formatDollars(form540.taxAfterCredits)}`, { bold: true })
  y -= 6

  // ── Payments Section ────────────────────────────────────────
  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (form540.stateWithholding > 0) {
    drawLine('CA state income tax withheld', '71', `$${formatDollars(form540.stateWithholding)}`)
  }

  drawLine('Total payments', '78', `$${formatDollars(form540.totalPayments)}`, { bold: true })
  y -= 6

  // ── Result Section ──────────────────────────────────────────
  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (form540.overpaid > 0) {
    drawLine('Overpaid (refund)', '97', `$${formatDollars(form540.overpaid)}`, { bold: true })
  } else if (form540.amountOwed > 0) {
    drawLine('Amount you owe', '100', `$${formatDollars(form540.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  const officialForm = isPartYear ? 'FTB Form 540NR' : 'FTB Form 540'
  draw(`Generated by OpenTax — for review purposes. File using official ${officialForm}.`, 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const caFormCompiler: StateFormCompiler = {
  stateCode: 'CA',

  templateFiles: ['f540.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form540 = stateResult.detail as Form540Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('f540')
    const doc = templateBytes
      ? await fillForm540Template(templateBytes, taxReturn, form540)
      : await generateForm540(taxReturn, form540)

    const formId = form540.residencyType === 'part-year' ? 'CA Form 540NR' : 'CA Form 540'

    return {
      doc,
      forms: [
        {
          formId,
          sequenceNumber: 'CA-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
