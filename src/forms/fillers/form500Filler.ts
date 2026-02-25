/**
 * GA Form 500 PDF filler.
 *
 * Fills the official Georgia Form 500 (Individual Income Tax Return) template
 * from computed Form 500 results. Falls back to programmatic generation
 * when no template is available.
 *
 * Because the official GA Form 500 PDF is a flat (non-fillable) form, this
 * filler overlays text at calibrated (x, y) coordinates rather than filling
 * named AcroForm fields.
 */

import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { Form500Result } from '../../rules/2025/ga/form500'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import type { FieldPosition } from '../mappings/formGA500Fields'
import {
  GA500_HEADER, GA500_RESIDENCY, GA500_FILING_STATUS, GA500_DOB,
  GA500_PAGE1_HEADER, GA500_DEPENDENTS, GA500_INCOME,
  GA500_PAGE2_HEADER, GA500_TAX,
  GA500_PAGE3_HEADER, GA500_PAYMENTS,
  GA500_PAGE4_HEADER, GA500_REFUND,
} from '../mappings/formGA500Fields'

// ── Coordinate-based helpers ────────────────────────────────────

/**
 * Draw text on a PDF page at the specified field position.
 * Since the GA Form 500 is a flat PDF (no AcroForm fields), we draw text
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

async function fillForm500Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  form500: Form500Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()

  const tp = taxReturn.taxpayer

  // ── Page 0: Header / Personal Info ──────────────────────────
  drawAtPos(pages, font, GA500_HEADER.firstName,
    tp.firstName + (tp.middleInitial ? ` ${tp.middleInitial}` : ''))
  drawAtPos(pages, font, GA500_HEADER.lastName, tp.lastName)
  drawAtPos(pages, font, GA500_HEADER.yourSSN, formatSSN(tp.ssn || '000000000'))
  drawAtPos(pages, font, GA500_HEADER.addressLine1, tp.address.street)
  if (tp.address.apartment) {
    drawAtPos(pages, font, GA500_HEADER.addressLine2, tp.address.apartment)
  }
  drawAtPos(pages, font, GA500_HEADER.city, tp.address.city)
  drawAtPos(pages, font, GA500_HEADER.state, tp.address.state)
  drawAtPos(pages, font, GA500_HEADER.zip, tp.address.zip)

  // Spouse (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    drawAtPos(pages, font, GA500_HEADER.spouseFirstName,
      sp.firstName + (sp.middleInitial ? ` ${sp.middleInitial}` : ''))
    drawAtPos(pages, font, GA500_HEADER.spouseLastName, sp.lastName)
    drawAtPos(pages, font, GA500_HEADER.spouseSSN, formatSSN(sp.ssn))
  }

  // ── Residency Status (Line 4) ──────────────────────────────
  const residencyCode = form500.residencyType === 'full-year' ? '1'
    : form500.residencyType === 'part-year' ? '2'
    : '3'
  drawAtPos(pages, font, GA500_RESIDENCY.statusCode, residencyCode)

  // ── Filing Status (Line 5) ─────────────────────────────────
  const filingStatusMap: Record<string, string> = {
    single: 'A',
    mfj: 'B',
    mfs: 'C',
    hoh: 'D',
    qw: 'D',  // Qualifying surviving spouse uses "D" on GA Form 500
  }
  const statusLetter = filingStatusMap[taxReturn.filingStatus]
  if (statusLetter) {
    drawAtPos(pages, font, GA500_FILING_STATUS.statusLetter, statusLetter)
  }

  // ── Date of Birth (Line 6) ─────────────────────────────────
  if (tp.dateOfBirth) {
    const [y, m, d] = tp.dateOfBirth.split('-')
    drawAtPos(pages, font, GA500_DOB.yourDOB, `${m}/${d}/${y}`)
  }
  if (taxReturn.spouse?.dateOfBirth) {
    const [y, m, d] = taxReturn.spouse.dateOfBirth.split('-')
    drawAtPos(pages, font, GA500_DOB.spouseDOB, `${m}/${d}/${y}`)
  }

  // ── Number of Dependents (Line 7c) ─────────────────────────
  const numDependents = taxReturn.dependents?.length ?? 0
  if (numDependents > 0) {
    drawAtPos(pages, font, GA500_DOB.totalDependents, String(numDependents))
  }

  // ── Page 1: SSN header ─────────────────────────────────────
  drawAtPos(pages, font, GA500_PAGE1_HEADER.ssn, formatSSN(tp.ssn || '000000000'))

  // ── Page 1: Dependent details ──────────────────────────────
  const depSlots = [
    { name: GA500_DEPENDENTS.dep1Name, last: GA500_DEPENDENTS.dep1Last, ssn: GA500_DEPENDENTS.dep1SSN, rel: GA500_DEPENDENTS.dep1Rel },
    { name: GA500_DEPENDENTS.dep2Name, last: GA500_DEPENDENTS.dep2Last, ssn: GA500_DEPENDENTS.dep2SSN, rel: GA500_DEPENDENTS.dep2Rel },
    { name: GA500_DEPENDENTS.dep3Name, last: GA500_DEPENDENTS.dep3Last, ssn: GA500_DEPENDENTS.dep3SSN, rel: GA500_DEPENDENTS.dep3Rel },
    { name: GA500_DEPENDENTS.dep4Name, last: GA500_DEPENDENTS.dep4Last, ssn: GA500_DEPENDENTS.dep4SSN, rel: GA500_DEPENDENTS.dep4Rel },
  ]
  const deps = taxReturn.dependents ?? []
  for (let i = 0; i < Math.min(deps.length, depSlots.length); i++) {
    const dep = deps[i]
    const slot = depSlots[i]
    drawAtPos(pages, font, slot.name, dep.firstName)
    drawAtPos(pages, font, slot.last, dep.lastName)
    drawAtPos(pages, font, slot.ssn, formatSSN(dep.ssn))
    drawAtPos(pages, font, slot.rel, dep.relationship)
  }

  // ── Page 1: Income Lines 8–13 ──────────────────────────────
  // Line 8: Federal adjusted gross income
  drawDollarAtPos(pages, font, GA500_INCOME.line8, form500.federalAGI)

  // Line 9: Adjustments from Form 500 Schedule 1
  const adjustments = form500.gaAdjustments.additions - form500.gaAdjustments.subtractions
  if (adjustments !== 0) {
    drawDollarAtPos(pages, font, GA500_INCOME.line9, adjustments)
  }

  // Line 10: Georgia adjusted gross income
  drawDollarAtPos(pages, font, GA500_INCOME.line10, form500.gaAGI)

  // Line 11 or 12c: Deduction (standard or itemized)
  if (form500.deductionMethod === 'standard') {
    drawDollarAtPos(pages, font, GA500_INCOME.line11, form500.gaStandardDeduction)
  } else {
    // Line 12a: Federal itemized deductions
    drawDollarAtPos(pages, font, GA500_INCOME.line12a, form500.gaItemizedDeduction)
    // Line 12c: Georgia total itemized deductions
    drawDollarAtPos(pages, font, GA500_INCOME.line12c, form500.gaItemizedDeduction)
  }

  // Line 13: Balance (Line 10 minus deduction)
  const line13 = Math.max(0, form500.gaAGI - form500.deductionUsed)
  drawDollarAtPos(pages, font, GA500_INCOME.line13, line13)

  // ── Page 2: SSN header ─────────────────────────────────────
  drawAtPos(pages, font, GA500_PAGE2_HEADER.ssn, formatSSN(tp.ssn || '000000000'))

  // ── Page 2: Lines 14–23 (Tax / Credits) ────────────────────
  // Line 14: Dependent exemption (number x $4,000)
  if (form500.dependentExemption > 0) {
    drawAtPos(pages, font, GA500_TAX.line14count, String(numDependents))
    drawDollarAtPos(pages, font, GA500_TAX.line14, form500.dependentExemption)
  }

  // Line 15a: Income before GA NOL (Line 13 - Line 14)
  const line15a = Math.max(0, line13 - form500.dependentExemption)
  drawDollarAtPos(pages, font, GA500_TAX.line15a, line15a)

  // Line 15c: Georgia taxable income (same as 15a when no NOL)
  drawDollarAtPos(pages, font, GA500_TAX.line15c, form500.gaTaxableIncome)

  // Line 16: Tax
  drawDollarAtPos(pages, font, GA500_TAX.line16, form500.gaTax)

  // Line 17c: Low income credit
  if (form500.lowIncomeCredit > 0) {
    drawDollarAtPos(pages, font, GA500_TAX.line17c, form500.lowIncomeCredit)
  }

  // Line 22: Total credits used
  if (form500.totalCredits > 0) {
    drawDollarAtPos(pages, font, GA500_TAX.line22, form500.totalCredits)
  }

  // Line 23: Balance (tax after credits)
  drawDollarAtPos(pages, font, GA500_TAX.line23, form500.taxAfterCredits)

  // ── Page 2: Income statement details (W-2 withholding) ─────
  const gaW2s = (taxReturn.w2s ?? []).filter(
    (w) => (w.box15State ?? '').toUpperCase() === 'GA',
  )
  const incomeStmts = [GA500_INCOME_STMT_A, GA500_INCOME_STMT_B, GA500_INCOME_STMT_C]
  for (let i = 0; i < Math.min(gaW2s.length, incomeStmts.length); i++) {
    const w2 = gaW2s[i]
    const stmt = incomeStmts[i]
    drawAtPos(pages, font, stmt.fein, w2.employerEin)
    drawDollarAtPos(pages, font, stmt.wages, w2.box16StateWages ?? 0)
    drawDollarAtPos(pages, font, stmt.withheld, w2.box17StateIncomeTax ?? 0)
  }

  // ── Page 3: SSN header ─────────────────────────────────────
  drawAtPos(pages, font, GA500_PAGE3_HEADER.ssn, formatSSN(tp.ssn || '000000000'))

  // ── Page 3: Lines 24–30 (Payments / Balance) ───────────────
  // Line 24: Georgia income tax withheld on wages/1099s
  if (form500.stateWithholding > 0) {
    drawDollarAtPos(pages, font, GA500_PAYMENTS.line24, form500.stateWithholding)
  }

  // Line 28: Total prepayment credits
  drawDollarAtPos(pages, font, GA500_PAYMENTS.line28, form500.totalPayments)

  // Line 29: Balance due (if tax exceeds payments)
  if (form500.amountOwed > 0) {
    drawDollarAtPos(pages, font, GA500_PAYMENTS.line29, form500.amountOwed)
  }

  // Line 30: Overpayment (if payments exceed tax)
  if (form500.overpaid > 0) {
    drawDollarAtPos(pages, font, GA500_PAYMENTS.line30, form500.overpaid)
  }

  // ── Page 4: SSN header ─────────────────────────────────────
  drawAtPos(pages, font, GA500_PAGE4_HEADER.ssn, formatSSN(tp.ssn || '000000000'))

  // ── Page 4: Lines 45–46 (Amount due / Refund) ──────────────
  if (form500.amountOwed > 0) {
    // Line 45: Total amount due
    drawDollarAtPos(pages, font, GA500_REFUND.line45, form500.amountOwed)
  }

  if (form500.overpaid > 0) {
    // Line 46: Refund
    drawDollarAtPos(pages, font, GA500_REFUND.line46, form500.overpaid)
  }

  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

// Need to import these items that are used by the income statement overlay
import {
  GA500_INCOME_STMT_A, GA500_INCOME_STMT_B, GA500_INCOME_STMT_C,
} from '../mappings/formGA500Fields'

async function generateForm500(
  taxReturn: TaxReturn,
  form500: Form500Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const darkBlue = rgb(0.1, 0.15, 0.35)

  const page = pdfDoc.addPage([612, 792])
  let y = 750

  const draw = (text: string, x: number, size: number, opts?: { font?: typeof font; color?: typeof black }) => {
    page.drawText(text, { x, y, size, font: opts?.font ?? font, color: opts?.color ?? black })
  }

  const drawLine = (label: string, lineNum: string, value: string, opts?: { bold?: boolean }) => {
    draw(`Line ${lineNum}`, 72, 9, { color: gray })
    draw(label, 120, 9, opts?.bold ? { font: fontBold } : undefined)
    draw(value, 460, 9, { font: fontBold })
    y -= 16
  }

  draw('Georgia Form 500', 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw('Individual Income Tax Return — 2025', 72, 10, { color: gray })
  y -= 6
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: darkBlue })
  y -= 20

  draw('Taxpayer Information', 72, 11, { font: fontBold })
  y -= 16
  draw(`Name: ${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`, 90, 9)
  y -= 14
  draw(`SSN: ${formatSSN(taxReturn.taxpayer.ssn || '000000000')}`, 90, 9)
  draw(`Filing Status: ${filingStatusLabel(taxReturn.filingStatus)}`, 300, 9)
  y -= 14

  y -= 8
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal AGI', '5', `$${formatDollars(form500.federalAGI)}`)
  if (form500.gaAdjustments.additions > 0) {
    drawLine('Schedule 1 additions', '6', `$${formatDollars(form500.gaAdjustments.additions)}`)
  }
  if (form500.gaAdjustments.subtractions > 0) {
    drawLine('Schedule 1 subtractions', '8', `($${formatDollars(form500.gaAdjustments.subtractions)})`)
  }
  drawLine('Georgia AGI', '9', `$${formatDollars(form500.gaAGI)}`, { bold: true })

  y -= 8
  draw('Deductions & Exemptions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Deduction used', '12', `$${formatDollars(form500.deductionUsed)}`)
  if (form500.dependentExemption > 0) {
    drawLine('Dependent exemption', '13', `$${formatDollars(form500.dependentExemption)}`)
  }
  drawLine('Taxable income', '15', `$${formatDollars(form500.gaTaxableIncome)}`, { bold: true })

  y -= 8
  draw('Tax, Credits, and Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('GA tax (5.19%)', '16', `$${formatDollars(form500.gaTax)}`)
  if (form500.totalCredits > 0) {
    drawLine('Credits', '20', `($${formatDollars(form500.totalCredits)})`)
  }
  drawLine('Tax after credits', '21', `$${formatDollars(form500.taxAfterCredits)}`, { bold: true })

  if (form500.stateWithholding > 0) {
    drawLine('GA withholding', '24', `$${formatDollars(form500.stateWithholding)}`)
  }
  drawLine('Total payments', '27', `$${formatDollars(form500.totalPayments)}`, { bold: true })

  if (form500.overpaid > 0) {
    drawLine('Refund', '29', `$${formatDollars(form500.overpaid)}`, { bold: true })
  } else if (form500.amountOwed > 0) {
    drawLine('Amount owed', '30', `$${formatDollars(form500.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 20
  draw('Generated by OpenTax for review. File with official GA Form 500.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const gaFormCompiler: StateFormCompiler = {
  stateCode: 'GA',
  templateFiles: ['form500.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form500 = stateResult.detail as Form500Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('form500')
    const doc = templateBytes
      ? await fillForm500Template(templateBytes, taxReturn, form500)
      : await generateForm500(taxReturn, form500)

    return {
      doc,
      forms: [{
        formId: stateResult.formLabel,
        sequenceNumber: 'GA-01',
        pageCount: doc.getPageCount(),
      }],
    }
  },
}
