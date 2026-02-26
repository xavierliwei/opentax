/**
 * MD Form 502 PDF filler.
 *
 * Fills the official Maryland Form 502 (Resident Income Tax Return) template
 * from computed Form 502 results. Falls back to programmatic generation
 * when no template is available.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { Form502Result } from '../../rules/2025/md/form502'
import type { StateCompiledForms, StateFormCompiler, StateFormTemplates } from '../stateCompiler'
import { setTextField, setDollarField, checkBox, formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import { MD_COUNTIES } from '../../rules/2025/md/constants'
import {
  F502_HEADER, F502_FILING_STATUS, F502_COUNTY, F502_RESIDENCE,
  F502_EXEMPTIONS, F502_INCOME, F502_TAX, F502_PAYMENTS,
  F502_LOCAL_TAX, F502_REFUND,
} from '../mappings/form502Fields'

// ── Template-based filler ────────────────────────────────────────

async function fillForm502Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  form502: Form502Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Page 1: Header ─────────────────────────────────────────
  setTextField(form, F502_HEADER.firstName, tp.firstName + (tp.middleInitial ? ` ${tp.middleInitial}` : ''))
  setTextField(form, F502_HEADER.lastName, tp.lastName)
  setTextField(form, F502_HEADER.ssn, formatSSN(tp.ssn || '000000000'))
  setTextField(form, F502_HEADER.addressLine1, tp.address.street)
  if (tp.address.apartment) {
    setTextField(form, F502_HEADER.addressLine2, tp.address.apartment)
  }
  setTextField(form, F502_HEADER.city, tp.address.city)
  setTextField(form, F502_HEADER.state, tp.address.state)
  setTextField(form, F502_HEADER.zip, tp.address.zip)

  // Spouse (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setTextField(form, F502_HEADER.spouseFirstName, sp.firstName + (sp.middleInitial ? ` ${sp.middleInitial}` : ''))
    setTextField(form, F502_HEADER.spouseLastName, sp.lastName)
    setTextField(form, F502_HEADER.spouseSSN, formatSSN(sp.ssn))
  }

  // ── Filing status ──────────────────────────────────────────
  const statusMap: Record<string, string> = {
    single: F502_FILING_STATUS.single,
    mfj:    F502_FILING_STATUS.mfj,
    mfs:    F502_FILING_STATUS.mfs,
    hoh:    F502_FILING_STATUS.hoh,
    qw:     F502_FILING_STATUS.qw,
  }
  const selectedStatus = statusMap[taxReturn.filingStatus]
  if (selectedStatus) {
    checkBox(form, selectedStatus)
  }

  // ── County / Political Subdivision ─────────────────────────
  const countyInfo = MD_COUNTIES[form502.countyCode]
  if (countyInfo) {
    setTextField(form, F502_COUNTY.subdivisionName, countyInfo.name)
  }

  // Maryland physical address (same as mailing for residents)
  if (form502.residencyType === 'full-year') {
    setTextField(form, F502_COUNTY.physAddressLine1, tp.address.street)
    setTextField(form, F502_COUNTY.physCity, tp.address.city)
    setTextField(form, F502_COUNTY.physZip, tp.address.zip)
  }

  // ── Part-year residence dates ──────────────────────────────
  if (form502.residencyType === 'part-year') {
    setTextField(form, F502_RESIDENCE.partYearCode, 'P')
  }

  // ── Exemptions ─────────────────────────────────────────────
  // Section A: Regular personal exemptions
  const numPersonal = taxReturn.filingStatus === 'mfj' ? 2 : 1
  checkBox(form, F502_EXEMPTIONS.yourselfRegular)
  if (taxReturn.filingStatus === 'mfj') {
    checkBox(form, F502_EXEMPTIONS.spouseRegular)
  }
  setTextField(form, F502_EXEMPTIONS.numRegular, String(numPersonal))
  setDollarField(form, F502_EXEMPTIONS.amountA, form502.personalExemption)

  // Section C: Dependents
  const numDependents = taxReturn.dependents?.length ?? 0
  if (numDependents > 0) {
    setTextField(form, F502_EXEMPTIONS.numDependents, String(numDependents))
    setDollarField(form, F502_EXEMPTIONS.amountC, form502.dependentExemption)
  }

  // Section D: Total exemptions
  setDollarField(form, F502_EXEMPTIONS.totalExemptions, form502.totalExemptions)

  // ── Income (Lines 1-20) ────────────────────────────────────
  // Line 1: Federal AGI
  setDollarField(form, F502_INCOME.line1, form502.federalAGI)

  // Line 4: Total income (for simple case, same as line 1)
  setDollarField(form, F502_INCOME.line4, form502.federalAGI)

  // Line 5: Subtractions (Social Security subtraction goes here)
  if (form502.ssSubtraction > 0) {
    setDollarField(form, F502_INCOME.line5, form502.ssSubtraction)
  }

  // Line 6: Total subtractions
  if (form502.ssSubtraction > 0) {
    setDollarField(form, F502_INCOME.line6, form502.ssSubtraction)
  }

  // Line 7: MD adjusted gross income
  setDollarField(form, F502_INCOME.line7, form502.mdAGI)

  // Line 8: Standard deduction
  setDollarField(form, F502_INCOME.line8, form502.standardDeduction)

  // Line 9: Itemized deductions (if used)
  if (form502.deductionMethod === 'itemized') {
    setDollarField(form, F502_INCOME.line9, form502.itemizedDeduction)
  }

  // Line 10a: Deduction used (larger of 8 or 9)
  setDollarField(form, F502_INCOME.line10a, form502.deductionUsed)

  // Line 10b: AGI minus deduction
  const line10b = Math.max(0, form502.mdAGI - form502.deductionUsed)
  setDollarField(form, F502_INCOME.line10b, line10b)

  // Line 11: Total exemptions
  setDollarField(form, F502_INCOME.line11, form502.totalExemptions)

  // Line 12: Net income (line 10b - line 11)
  setDollarField(form, F502_INCOME.line12, form502.mdTaxableIncome)

  // Line 13: Taxable net income
  setDollarField(form, F502_INCOME.line13, form502.mdTaxableIncome)

  // Line 14: Maryland tax
  setDollarField(form, F502_INCOME.line14, form502.mdStateTax)

  // Line 15: Earned income credit
  if (form502.mdEIC > 0) {
    setDollarField(form, F502_INCOME.line15, form502.mdEIC)
  }

  // Line 17: Total credits
  const totalCredits = form502.mdEIC
  if (totalCredits > 0) {
    setDollarField(form, F502_INCOME.line17, totalCredits)
  }

  // Line 18: Tax after credits (state portion)
  const stateTaxAfterCredits = Math.max(0, form502.mdStateTax - totalCredits)
  setDollarField(form, F502_INCOME.line18, stateTaxAfterCredits)

  // Line 20: Total Maryland tax
  setDollarField(form, F502_INCOME.line20, stateTaxAfterCredits)

  // ── Page 3: Tax Computation ────────────────────────────────
  // Check tax computation method
  if (form502.mdTaxableIncome >= 10000000) { // $100,000 in cents
    checkBox(form, F502_TAX.taxRateCalcCB)
  } else {
    checkBox(form, F502_TAX.taxTableCB)
  }

  // Local tax rate
  setTextField(form, F502_TAX.localTaxRate, (form502.countyRate * 100).toFixed(2))

  // Line 21: State tax
  setDollarField(form, F502_TAX.line21, form502.mdStateTax)

  // Line 22: Local (county) tax
  setDollarField(form, F502_TAX.line22, form502.mdLocalTax)

  // Line 23: Total tax (state + local)
  const totalTax = form502.mdStateTax + form502.mdLocalTax
  setDollarField(form, F502_TAX.line23, totalTax)

  // Line 24: Earned income credit
  if (form502.mdEIC > 0) {
    setDollarField(form, F502_TAX.line24, form502.mdEIC)
  }

  // Line 27: Total credits
  if (form502.mdEIC > 0) {
    setDollarField(form, F502_TAX.line27, form502.mdEIC)
  }

  // Line 28: Taxes after credits
  setDollarField(form, F502_TAX.line28, form502.taxAfterCredits)

  // Line 30: Total Maryland tax, local tax, and contributions
  setDollarField(form, F502_TAX.line30, form502.taxAfterCredits)

  // Line 33: Total Maryland tax and additions
  setDollarField(form, F502_TAX.line33, form502.taxAfterCredits)

  // ── Payments ───────────────────────────────────────────────
  // Line 34: Total MD tax withheld
  if (form502.stateWithholding > 0) {
    setDollarField(form, F502_PAYMENTS.line34, form502.stateWithholding)
  }

  // Line 37: Total payments and credits
  setDollarField(form, F502_PAYMENTS.line37, form502.totalPayments)

  // ── Refund or Amount Owed ──────────────────────────────────
  if (form502.amountOwed > 0) {
    // Line 38: Tax to pay
    setDollarField(form, F502_PAYMENTS.line38, form502.amountOwed)
    // Line 40: Total amount due
    setDollarField(form, F502_PAYMENTS.line40, form502.amountOwed)
    // Total owed
    setDollarField(form, F502_REFUND.totalOwed, form502.amountOwed)
  }

  if (form502.overpaid > 0) {
    // Line 41: Overpayment
    setDollarField(form, F502_PAYMENTS.line41, form502.overpaid)
    // Line 43: Amount to refund
    setDollarField(form, F502_PAYMENTS.line43, form502.overpaid)
    // Total refund
    setDollarField(form, F502_REFUND.totalRefund, form502.overpaid)
  }

  // ── Local tax section ──────────────────────────────────────
  // Line 44: Local tax after credits
  const localTaxAfterCredits = form502.mdLocalTax
  if (localTaxAfterCredits > 0) {
    setDollarField(form, F502_LOCAL_TAX.line44, localTaxAfterCredits)
  }

  form.flatten()
  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateForm502(taxReturn: TaxReturn, form: Form502Result): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const blue = rgb(0.1, 0.15, 0.35)

  let y = 750

  const draw = (text: string, x: number, size: number, opts?: { font?: typeof font; color?: typeof black }) => {
    page.drawText(text, { x, y, size, font: opts?.font ?? font, color: opts?.color ?? black })
  }

  const drawLine = (label: string, value: string, opts?: { bold?: boolean }) => {
    draw(label, 90, 9, opts?.bold ? { font: bold } : undefined)
    draw(value, 450, 9, { font: bold })
    y -= 16
  }

  // Header
  const isPartYear = form.residencyType === 'part-year'
  const isNonresident = form.residencyType === 'nonresident'
  const formTitle = isNonresident ? 'Maryland Form 505' : 'Maryland Form 502'
  const formSubtitle = isPartYear
    ? `Part-Year Resident Income Tax Return — 2025 (${Math.round(form.apportionmentRatio * 100)}% MD)`
    : isNonresident
      ? 'Nonresident Income Tax Return — 2025'
      : 'Resident Income Tax Return — 2025'

  draw(formTitle, 72, 16, { font: bold, color: blue })
  y -= 12
  draw(formSubtitle, 72, 10, { color: gray })
  y -= 6
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: blue })
  y -= 20

  // Taxpayer info
  draw('Taxpayer Information', 72, 11, { font: bold })
  y -= 16
  const tp = taxReturn.taxpayer
  draw(`Name: ${tp.firstName} ${tp.lastName}`, 90, 9)
  y -= 14
  draw(`SSN: ${formatSSN(tp.ssn || '000000000')}`, 90, 9)
  draw(`Filing Status: ${filingStatusLabel(taxReturn.filingStatus)}`, 300, 9)
  y -= 14
  draw(`Address: ${tp.address.street}, ${tp.address.city}, ${tp.address.state} ${tp.address.zip}`, 90, 9)
  y -= 14
  const countyName = MD_COUNTIES[form.countyCode]?.name ?? form.countyCode
  draw(`County: ${countyName}`, 90, 9)
  y -= 14
  if (taxReturn.spouse) {
    draw(`Spouse: ${taxReturn.spouse.firstName} ${taxReturn.spouse.lastName}   SSN: ${formatSSN(taxReturn.spouse.ssn)}`, 90, 9)
    y -= 14
  }
  y -= 10

  // ── Income Section ──────────────────────────────────────────
  draw('Income', 72, 11, { font: bold, color: blue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal adjusted gross income', `$${formatDollars(form.federalAGI)}`)
  if (form.ssSubtraction > 0) {
    drawLine('Social Security subtraction', `($${formatDollars(form.ssSubtraction)})`)
  }
  drawLine('Maryland adjusted gross income', `$${formatDollars(form.mdAGI)}`, { bold: true })

  if (form.mdSourceIncome !== undefined) {
    draw(`Apportionment: ${Math.round(form.apportionmentRatio * 100)}% — MD-source income: $${formatDollars(form.mdSourceIncome)}`, 110, 8, { color: gray })
    y -= 14
  }
  y -= 6

  // ── Deductions Section ──────────────────────────────────────
  draw('Deductions & Exemptions', 72, 11, { font: bold, color: blue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  const dedLabel = form.deductionMethod === 'itemized'
    ? 'MD itemized deductions'
    : 'MD standard deduction'
  drawLine(dedLabel, `$${formatDollars(form.deductionUsed)}`)
  drawLine('Total exemptions', `$${formatDollars(form.totalExemptions)}`)
  drawLine('Maryland taxable income', `$${formatDollars(form.mdTaxableIncome)}`, { bold: true })
  y -= 6

  // ── Tax Section ─────────────────────────────────────────────
  draw('Tax', 72, 11, { font: bold, color: blue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('MD state tax', `$${formatDollars(form.mdStateTax)}`)
  drawLine(`Local tax (${countyName}, ${(form.countyRate * 100).toFixed(2)}%)`, `$${formatDollars(form.mdLocalTax)}`)

  if (form.mdEIC > 0) {
    drawLine('MD earned income credit', `($${formatDollars(form.mdEIC)})`)
  }

  drawLine('Tax after credits', `$${formatDollars(form.taxAfterCredits)}`, { bold: true })
  y -= 6

  // ── Payments Section ────────────────────────────────────────
  draw('Payments', 72, 11, { font: bold, color: blue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (form.stateWithholding > 0) {
    drawLine('MD state income tax withheld', `$${formatDollars(form.stateWithholding)}`)
  }
  drawLine('Total payments', `$${formatDollars(form.totalPayments)}`, { bold: true })
  y -= 6

  // ── Result Section ──────────────────────────────────────────
  draw('Result', 72, 11, { font: bold, color: blue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (form.overpaid > 0) {
    drawLine('Overpaid (refund)', `$${formatDollars(form.overpaid)}`, { bold: true })
  } else if (form.amountOwed > 0) {
    drawLine('Amount you owe', `$${formatDollars(form.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '$0')
  }

  y -= 30
  const officialForm = isNonresident ? 'MD Form 505' : 'MD Form 502'
  draw(`Generated by OpenTax — for review purposes. File using official ${officialForm}.`, 72, 7, { color: gray })

  return doc
}

// ── State Form Compiler ──────────────────────────────────────────

export const mdFormCompiler: StateFormCompiler = {
  stateCode: 'MD',

  templateFiles: ['502.pdf', '505.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form502 = stateResult.detail as Form502Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('502')
    const doc = templateBytes
      ? await fillForm502Template(templateBytes, taxReturn, form502)
      : await generateForm502(taxReturn, form502)

    const formId = form502.residencyType === 'nonresident' ? 'MD Form 505' : 'MD Form 502'

    return {
      doc,
      forms: [
        {
          formId,
          sequenceNumber: 'MD-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
