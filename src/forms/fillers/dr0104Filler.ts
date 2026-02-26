/**
 * CO Form DR 0104 PDF filler.
 *
 * Fills the official Colorado DR 0104 (Individual Income Tax Return)
 * template using AcroForm field names. The DR 0104 is an 8-page form
 * with fields named "Form Question 1" through "Form Question 44" for
 * the dollar-amount lines, plus named fields for personal info and
 * checkboxes C1-C3 for residency status.
 *
 * Falls back to programmatic generation when no template is available.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { DR0104Result } from '../../rules/2025/co/dr0104'
import type { StateCompiledForms, StateFormCompiler, StateFormTemplates } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel, setTextField, setDollarField, checkBox } from '../helpers'

// ── Field name mapping ──────────────────────────────────────────

/**
 * DR 0104 "Form Question N" → DR 0104 line number mapping:
 *
 * Page 3 (idx 2): Lines 1-9
 *   FQ1  = Line 1  (Federal Taxable Income)
 *   FQ2  = Line 2  (SALT from Sch A)
 *   FQ3  = Line 3  (QBI deduction addback)
 *   FQ4  = Line 4  (Std/itemized deduction addback)
 *   FQ5  = Line 5  (Business meals)
 *   FQ6  = Line 6  (CollegeInvest)
 *   FQ7  = Line 7  (ABLE)
 *   FQ8  = Line 8  (Other additions)
 *   FQ9  = Line 9  (Subtotal)
 *
 * Page 4 (idx 3): Lines 10-21
 *   FQ10 = Line 10 (Subtractions from DR 0104AD)
 *   FQ11 = Line 11 (CO Taxable Income)
 *   FQ12 = Line 12 (CO Tax)
 *   FQ13 = Line 13 (AMT)
 *   FQ14 = Line 14 (Recapture)
 *   FQ15 = Line 15 (Subtotal tax)
 *   FQ16 = Line 16 (Nonrefundable credits)
 *   FQ17 = Line 17 (Enterprise Zone credits)
 *   FQ18 = Line 18 (CHIPS Zone Credit)
 *   FQ19 = Line 19 (Strategic Capital Tax Credit)
 *   FQ20 = Line 20 (Net Income Tax)
 *   FQ21 = Line 21 (CO withholding)
 *
 * Page 5 (idx 4): Lines 22-34
 *   FQ22 = Line 22 (Prior-year est. tax carryforward)
 *   FQ23 = Line 23 (Estimated tax payments)
 *   FQ24 = Line 24 (Extension payment)
 *   FQ25 = Line 25 (Other prepayments)
 *   FQ26 = Line 26 (Conservation easement credit)
 *   FQ27 = Line 27 (Innovative motor vehicle credit)
 *   FQ28 = Line 28 (Refundable credits — CO EITC)
 *   FQ29 = Line 29 (Additional credits DR 0619)
 *   FQ30 = Line 30 (Subtotal payments)
 *   FQ31 = Line 31 (Federal AGI for TABOR)
 *   FQ32 = Line 32 (Nontaxable SS)
 *   FQ33 = Line 33 (Nontaxable interest)
 *   FQ34 = Line 34 (Modified AGI for TABOR)
 *
 * Page 6 (idx 5): Lines 35-39
 *   FQ35 = Line 35 (TABOR refund)
 *   FQ36 = Line 36 (Sum lines 30+35)
 *   FQ37 = Line 37 (Overpayment)
 *   FQ38 = Line 38 (Est. tax carryforward)
 *   FQ39 = Line 39 (Refund)
 *
 * Page 7 (idx 6): Lines 40-44
 *   FQ40 = Line 40 (Net Tax Due)
 *   FQ41 = Line 41 (Delinquent penalty)
 *   FQ42 = Line 42 (Delinquent interest)
 *   FQ43 = Line 43 (Estimated tax penalty)
 *   FQ44 = Line 44 (Amount You Owe)
 */

function fq(n: number): string {
  return `Form Question ${n}`
}

// ── Template-based filler ────────────────────────────────────────

async function fillDR0104Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  dr: DR0104Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()

  const tp = taxReturn.taxpayer

  // ── Page 1: Residency Status & Taxpayer Info ─────────────────
  // C1 = Full-Year, C2 = Part-Year/NR, C3 = Abroad
  if (dr.residencyType === 'full-year') {
    checkBox(form, 'C1')
  } else {
    checkBox(form, 'C2')
  }

  // Taxpayer info
  setTextField(form, 'Last Name', tp.lastName)
  setTextField(form, 'First Name', tp.firstName)
  if (tp.middleInitial) {
    setTextField(form, 'Middle Initial', tp.middleInitial)
  }
  setTextField(form, 'Social Security Number', formatSSN(tp.ssn || '000000000'))
  if (tp.dateOfBirth) {
    const [y, m, d] = tp.dateOfBirth.split('-')
    setTextField(form, 'Date of Birth', `${m}/${d}/${y}`)
  }

  // Spouse info (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setTextField(form, 'Spouse Last Name', sp.lastName)
    setTextField(form, 'Spouse First Name', sp.firstName)
    if (sp.middleInitial) {
      setTextField(form, 'Spouse Middle Initial', sp.middleInitial)
    }
    setTextField(form, 'Spouse Social Security Number', formatSSN(sp.ssn))
    if (sp.dateOfBirth) {
      const [y, m, d] = sp.dateOfBirth.split('-')
      setTextField(form, 'Spouse Date of Birth', `${m}/${d}/${y}`)
    }
  }

  // ── Page 2: Contact Info ─────────────────────────────────────
  setTextField(form, 'Physical Street Address 2', tp.address.street)
  setTextField(form, 'City 4', tp.address.city)
  setTextField(form, 'State 5', tp.address.state)
  setTextField(form, 'ZIP Code 4', tp.address.zip)

  // ── Page 2: Dependents (up to 5) ────────────────────────────
  const deps = taxReturn.dependents.slice(0, 5)
  deps.forEach((dep, i) => {
    const n = i + 1
    setTextField(form, `Last Name Dependent ${n}`, dep.lastName)
    setTextField(form, `First Name Dependent ${n}`, dep.firstName)
    setTextField(form, `Social Security Number Dependent ${n}`, formatSSN(dep.ssn))
    if (dep.dateOfBirth) {
      const year = dep.dateOfBirth.split('-')[0]
      setTextField(form, `Year of Birth Dependent ${n}`, year)
    }
  })

  // ── Page 3: Lines 1-9 (Income + Additions) ──────────────────
  setDollarField(form, fq(1), dr.line1)
  setDollarField(form, fq(2), dr.line2)
  // Lines 3-8 not yet computed (QBI addback, deduction addback, etc.)
  setDollarField(form, fq(9), dr.line9)

  // ── Page 4: Lines 10-21 (Subtractions, Tax, Credits) ────────
  setDollarField(form, fq(10), dr.line10)
  setDollarField(form, fq(11), dr.line11)
  setDollarField(form, fq(12), dr.line12)
  // Line 13 (AMT) and 14 (recapture) = 0
  setDollarField(form, fq(15), dr.line15)
  setDollarField(form, fq(16), dr.line16)
  // Lines 17-19 = 0
  setDollarField(form, fq(20), dr.line20)
  setDollarField(form, fq(21), dr.line21)

  // ── Page 5: Lines 22-34 (Prepayments, TABOR) ────────────────
  // Lines 22-27 = 0 (no estimated payments in model)
  setDollarField(form, fq(28), dr.line28)
  // Line 29 = 0
  setDollarField(form, fq(30), dr.line30)
  setDollarField(form, fq(31), dr.line31)
  // Lines 32, 33 only if nonzero
  if (dr.line37 > 0 || dr.line35 > 0) {
    // Fill TABOR section
    setDollarField(form, fq(34), dr.line34)
  }

  // ── Page 6: Lines 35-39 (TABOR Refund, Overpayment) ─────────
  setDollarField(form, fq(35), dr.line35)
  setDollarField(form, fq(36), dr.line36)
  if (dr.line37 > 0) {
    setDollarField(form, fq(37), dr.line37)
    setDollarField(form, fq(39), dr.line39)
  }

  // ── Page 7: Lines 40-44 (Tax Due) ───────────────────────────
  if (dr.line40 > 0) {
    setDollarField(form, fq(40), dr.line40)
    setDollarField(form, fq(44), dr.line44)
  }

  // Flatten form to prevent further editing
  form.flatten()

  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateDR0104(
  taxReturn: TaxReturn,
  dr: DR0104Result,
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

  draw('Colorado Form DR 0104', 72, 16, true)
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
  draw(`Residency: ${dr.residencyType}`, 72, 9)
  if (dr.apportionmentRatio < 1) {
    draw(`Apportionment: ${(dr.apportionmentRatio * 100).toFixed(1)}%`, 300, 9)
  }
  y -= 16

  draw('Income & Tax', 72, 11, true)
  y -= 16
  drawLine('1. Federal Taxable Income (1040 Line 15)', dr.line1)
  if (dr.coAdditions > 0) {
    drawLine('2-8. Colorado Additions', dr.coAdditions)
  }
  drawLine('9. Subtotal', dr.line9)
  if (dr.coSubtractions > 0) {
    drawLine('10. Colorado Subtractions', dr.line10)
  }
  drawLine('11. Colorado Taxable Income', dr.line11)
  drawLine('12. Colorado Tax (4.40%)', dr.line12)
  if (dr.line16 > 0) {
    drawLine('16. Nonrefundable Credits', dr.line16)
  }
  drawLine('20. Net Income Tax', dr.line20)

  y -= 8
  draw('Payments & Credits', 72, 11, true)
  y -= 16
  if (dr.line21 > 0) drawLine('21. CO Tax Withheld', dr.line21)
  if (dr.line28 > 0) drawLine('28. Refundable Credits (CO EITC)', dr.line28)
  drawLine('30. Total Payments', dr.line30)
  if (dr.line35 > 0) drawLine('35. TABOR Refund', dr.line35)
  drawLine('36. Total (Payments + TABOR)', dr.line36)

  y -= 8
  draw('Result', 72, 11, true)
  y -= 16
  if (dr.line37 > 0) drawLine('39. Refund', dr.line39)
  else if (dr.line44 > 0) drawLine('44. Amount You Owe', dr.line44)
  else drawLine('Balance', 0)

  y -= 20
  page.drawText('Generated by OpenTax — for review. File using official CO Form DR 0104.', {
    x: 72, y, size: 7, font, color: gray,
  })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const coFormCompiler: StateFormCompiler = {
  stateCode: 'CO',

  templateFiles: ['dr0104.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const dr = stateResult.detail as DR0104Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('dr0104')
    const doc = templateBytes
      ? await fillDR0104Template(templateBytes, taxReturn, dr)
      : await generateDR0104(taxReturn, dr)

    return {
      doc,
      forms: [
        {
          formId: 'CO DR 0104',
          sequenceNumber: 'CO-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
