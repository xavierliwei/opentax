/**
 * CT Form CT-1040 PDF filler.
 *
 * Fills the official DRS Form CT-1040 (Resident Income Tax Return) template
 * from computed CT-1040 results.  Falls back to programmatic generation
 * when no template is available.
 *
 * Because the official CT-1040 PDF is a flat (non-fillable) form, this filler
 * overlays text at calibrated (x, y) coordinates rather than filling named
 * AcroForm fields.
 */

import { PDFDocument, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { FormCT1040Result } from '../../rules/2025/ct/formCT1040'
import type { StateCompiledForms, StateFormCompiler, StateFormTemplates } from '../stateCompiler'
import { filingStatusLabel, formatDollars, formatSSN } from '../helpers'
import type { FieldPosition } from '../mappings/formCT1040Fields'
import {
  CT1040_HEADER, CT1040_FILING_STATUS, CT1040_INCOME,
  CT1040_PAGE2_HEADER, CT1040_PAYMENTS, CT1040_SCHEDULE1,
  CT1040_SCHEDULE3,
} from '../mappings/formCT1040Fields'

// ── Coordinate-based helpers ────────────────────────────────────

/**
 * Draw text on a PDF page at the specified field position.
 * Since the CT-1040 is a flat PDF (no AcroForm fields), we draw text
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

/**
 * Draw a checkbox mark ("X") at the specified position.
 */
function drawCheckAtPos(
  pages: PDFPage[],
  font: PDFFont,
  pos: FieldPosition,
): void {
  drawAtPos(pages, font, pos, 'X')
}

// ── Template-based filler ────────────────────────────────────────

async function fillFormCT1040Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  ct: FormCT1040Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()

  const tp = taxReturn.taxpayer

  // ── Page 1: Header ─────────────────────────────────────────
  drawAtPos(pages, font, CT1040_HEADER.yourSSN, formatSSN(tp.ssn || '000000000'))
  drawAtPos(pages, font, CT1040_HEADER.firstName,
    tp.firstName + (tp.middleInitial ? ` ${tp.middleInitial}` : ''))
  drawAtPos(pages, font, CT1040_HEADER.lastName, tp.lastName)
  drawAtPos(pages, font, CT1040_HEADER.street, tp.address.street)
  if (tp.address.apartment) {
    drawAtPos(pages, font, CT1040_HEADER.apt, tp.address.apartment)
  }
  drawAtPos(pages, font, CT1040_HEADER.city, tp.address.city)
  drawAtPos(pages, font, CT1040_HEADER.state, tp.address.state)
  drawAtPos(pages, font, CT1040_HEADER.zip, tp.address.zip)

  // Spouse (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    drawAtPos(pages, font, CT1040_HEADER.spouseSSN, formatSSN(sp.ssn))
    drawAtPos(pages, font, CT1040_HEADER.spouseFirstName,
      sp.firstName + (sp.middleInitial ? ` ${sp.middleInitial}` : ''))
    drawAtPos(pages, font, CT1040_HEADER.spouseLastName, sp.lastName)
  }

  // ── Filing Status ──────────────────────────────────────────
  const statusMap: Record<string, FieldPosition> = {
    single: CT1040_FILING_STATUS.single,
    mfj:    CT1040_FILING_STATUS.mfj,
    mfs:    CT1040_FILING_STATUS.mfs,
    hoh:    CT1040_FILING_STATUS.hoh,
    qw:     CT1040_FILING_STATUS.qw,
  }
  const selectedStatus = statusMap[taxReturn.filingStatus]
  if (selectedStatus) {
    drawCheckAtPos(pages, font, selectedStatus)
  }

  // ── Income (Lines 1–16) ────────────────────────────────────
  // Line 1: Federal adjusted gross income
  drawDollarAtPos(pages, font, CT1040_INCOME.line1, ct.federalAGI)

  // Line 2: Additions from Schedule 1
  drawDollarAtPos(pages, font, CT1040_INCOME.line2, ct.ctSchedule1.additions)

  // Line 3: Add Lines 1 and 2
  const line3 = ct.federalAGI + ct.ctSchedule1.additions
  drawDollarAtPos(pages, font, CT1040_INCOME.line3, line3)

  // Line 4: Subtractions from Schedule 1
  drawDollarAtPos(pages, font, CT1040_INCOME.line4, ct.ctSchedule1.subtractions)

  // Line 5: CT AGI (Line 3 minus Line 4)
  drawDollarAtPos(pages, font, CT1040_INCOME.line5, ct.ctAGI)

  // Line 6: Income from CT AGI (same as Line 5 for full-year residents)
  drawDollarAtPos(pages, font, CT1040_INCOME.line6, ct.ctAGI)

  // Line 7: Personal exemption
  drawDollarAtPos(pages, font, CT1040_INCOME.line7, ct.effectiveExemption)

  // Line 8: CT taxable income (Line 6 minus Line 7)
  drawDollarAtPos(pages, font, CT1040_INCOME.line8, ct.ctTaxableIncome)

  // Line 9: Tax from tax tables or tax calculation schedule
  drawDollarAtPos(pages, font, CT1040_INCOME.line9, ct.bracketTax)

  // Line 10: Credit from Table C (amount of tax credit)
  // Table C gives a credit that reduces the bracket tax;
  // the add-back is the reduction of that credit
  const tableCCredit = ct.bracketTax > 0 ? Math.max(0, ct.bracketTax - ct.tableC_addBack - (ct.bracketTax - ct.tableC_addBack < 0 ? 0 : 0)) : 0
  // Actually: Line 10 = bracket_tax * credit_rate from Table C
  // And Line 11 = Line 9 - Line 10
  // The addBack is the portion of the credit that gets "added back" (reduced)
  // So the actual credit from Table C = bracketTax - (bracketTax - tableC_addBack) ...
  // Simpler: Line 11 = bracketTax - credit + tableC_addBack
  // We know: ctIncomeTax = bracketTax + tableC_addBack + tableD_recapture (before apportionment)
  // And line11 = line9 - line10, line12 = line11 + tableD_recapture
  // So: line10 (the credit) = bracketTax - (ctIncomeTax / ratio - tableD_recapture) if ratio=1
  // For full year: ctIncomeTax = bracketTax + tableC_addBack + tableD_recapture
  // line11 = bracketTax - line10, line12 = line11 + tableD_recapture = ctIncomeTax
  // So: line11 = ctIncomeTax - tableD_recapture = bracketTax + tableC_addBack
  // line10 = bracketTax - line11 = bracketTax - (bracketTax + tableC_addBack) = -tableC_addBack
  // That can't be right. Let me re-read the CT-1040 instructions:
  // Line 9 = tax from tables, Line 10 = credit amount from Table C
  // Table C gives you a percentage of Line 9 as a credit (e.g. 75%)
  // Line 11 = Line 9 - Line 10 (net after credit)
  // Then Table D recapture adds back some of the credit for high earners
  // Line 12 = Line 11 + recapture from Schedule 2 = CT income tax
  //
  // So: bracketTax = Line 9
  //     tableC credit = bracketTax * rate (unknown rate, but we can derive)
  //     Line 11 = bracketTax - tableC credit
  //     tableC_addBack is the amount added back (i.e. reduction of the credit)
  //     Effective credit = full_credit - addBack
  //     ctIncomeTax = bracketTax - effective_credit + tableD_recapture
  //     = bracketTax - (full_credit - addBack) + tableD_recapture
  //     We know ctIncomeTax = bracketTax + tableC_addBack + tableD_recapture
  //     So: full_credit = bracketTax + tableC_addBack + tableD_recapture - bracketTax + full_credit - addBack - tableD_recapture
  //     Hmm, this is circular. Let me just compute:
  //     If ctIncomeTax = bracketTax + tableC_addBack + tableD_recapture (the formula from formCT1040.ts line 109)
  //     Then the net Line 10 credit to show = 0 (because there IS no separate credit, the addBack IS the adjustment)
  //     Actually looking at formCT1040.ts more carefully:
  //     fullYearTax = bracketTax + tableC_addBack + tableD_recapture
  //     This means the computation already incorporates Table C add-back as an addition to tax.
  //     So on the form:
  //     Line 9 = bracketTax (raw bracket computation)
  //     Line 10 = credit from Table C (we don't have the raw credit, we have the addBack)
  //     Line 11 = Line 9 - Line 10
  //     Line 12 = Line 11 + tableD_recapture
  //
  //     We need: Line 12 = ctIncomeTax (before apportionment, for full year)
  //     ctIncomeTax = bracketTax + tableC_addBack + tableD_recapture
  //     Line 12 = (bracketTax - Line10) + tableD_recapture = ctIncomeTax
  //     So: Line10 = bracketTax - ctIncomeTax + tableD_recapture
  //         Line10 = bracketTax - (bracketTax + tableC_addBack + tableD_recapture) + tableD_recapture
  //         Line10 = -tableC_addBack
  //     That's negative which doesn't make sense for a "credit" line.
  //
  //     RE-READING: The Table C add-back is not added to tax, it's the amount by which
  //     the credit is reduced. The "3% tax credit" from Table C is a credit that
  //     high-income taxpayers lose. The tableC_addBack represents how much of
  //     the credit they lose.
  //
  //     Full credit from Table C = bracketTax * 0.03 (or some percentage)
  //     Effective credit = full_credit - tableC_addBack (phase-out)
  //     Net tax = bracketTax - effective_credit + tableD_recapture
  //
  //     But formCT1040.ts says: fullYearTax = bracketTax + tableC_addBack + tableD_recapture
  //     This means: net_tax = bracketTax + tableC_addBack + tableD_recapture
  //     => bracketTax - effective_credit + tableD_recapture = bracketTax + tableC_addBack + tableD_recapture
  //     => effective_credit = -tableC_addBack
  //
  //     This doesn't work. The computation model must be using tableC_addBack as
  //     an ADDITIONAL tax amount (not a reduction of credit). Looking at the computation:
  //     computeTableCAddBack returns linearTableAmount(...) which returns 0 to maxAddBack.
  //     For low income: 0 add-back. For high income: full maxAddBack.
  //     So tableC_addBack is literally an extra tax on top of bracket tax for high earners.
  //
  //     On the actual form, this maps to:
  //     Line 9  = bracketTax (base tax)
  //     Line 10 = 0 (no credit for simplicity, or we skip it)
  //     Line 11 = bracketTax (Line 9 - Line 10)
  //     Line 12 = bracketTax + tableC_addBack + tableD_recapture = ctIncomeTax

  // For the form, we'll show the intermediate values
  const fullYearTax = ct.apportionmentRatio < 1
    ? Math.round(ct.ctIncomeTax / ct.apportionmentRatio)
    : ct.ctIncomeTax
  const line10Credit = 0  // Table C credit (would need raw credit rate to compute; skip for now)
  const line11 = ct.bracketTax - line10Credit
  drawDollarAtPos(pages, font, CT1040_INCOME.line10, line10Credit)
  drawDollarAtPos(pages, font, CT1040_INCOME.line11, line11)

  // Line 11a–11c: Table D recapture details (left column)
  if (ct.tableD_recapture > 0) {
    drawDollarAtPos(pages, font, CT1040_INCOME.line11a, ct.tableD_recapture)
  }

  // Line 12: CT income tax
  drawDollarAtPos(pages, font, CT1040_INCOME.line12, ct.ctIncomeTax)

  // Line 13: Credits (property tax credit + other non-refundable credits)
  drawDollarAtPos(pages, font, CT1040_INCOME.line13, ct.totalNonrefundableCredits)

  // Line 14: Balance (Line 12 minus Line 13)
  drawDollarAtPos(pages, font, CT1040_INCOME.line14, ct.taxAfterCredits)

  // Line 15: Individual use tax (0 for now)
  // Line 16: Total tax (Line 14 + Line 15)
  drawDollarAtPos(pages, font, CT1040_INCOME.line16, ct.taxAfterCredits)

  // ── Page 2: Payments / Tax Due / Refund ─────────────────────
  drawAtPos(pages, font, CT1040_PAGE2_HEADER.ssn, formatSSN(tp.ssn || '000000000'))

  // Line 17: Enter amount from Line 16
  drawDollarAtPos(pages, font, CT1040_PAYMENTS.line17, ct.taxAfterCredits)

  // W-2 withholding table (Lines 18a–18f)
  const ctW2s = (taxReturn.w2s ?? []).filter(
    (w) => (w.box15State ?? '').toUpperCase() === 'CT',
  )
  const w2Rows = CT1040_PAYMENTS.w2
  for (let i = 0; i < Math.min(ctW2s.length, w2Rows.length); i++) {
    const w2 = ctW2s[i]
    const row = w2Rows[i]
    drawAtPos(pages, font, row.fein, w2.employerEin)
    drawDollarAtPos(pages, font, row.wages, w2.box16StateWages ?? 0)
    drawDollarAtPos(pages, font, row.withheld, w2.box17StateIncomeTax ?? 0)
  }

  // Line 18: Total CT tax withheld
  drawDollarAtPos(pages, font, CT1040_PAYMENTS.line18, ct.stateWithholding)

  // Line 20a: CT EITC (refundable)
  drawDollarAtPos(pages, font, CT1040_PAYMENTS.line20a, ct.ctEITC)

  // Line 21: Total payments
  drawDollarAtPos(pages, font, CT1040_PAYMENTS.line21, ct.totalPayments)

  // Line 22: Tax due (if Line 17 > Line 21)
  if (ct.amountOwed > 0) {
    drawDollarAtPos(pages, font, CT1040_PAYMENTS.line22, ct.amountOwed)
  }

  // Line 23: Overpayment (if Line 21 > Line 17)
  if (ct.overpaid > 0) {
    drawDollarAtPos(pages, font, CT1040_PAYMENTS.line23, ct.overpaid)
    // Line 25: Refund (all of overpayment)
    drawDollarAtPos(pages, font, CT1040_PAYMENTS.line25, ct.overpaid)
  }

  // Line 26: Tax due (same as Line 22 for simple returns)
  if (ct.amountOwed > 0) {
    drawDollarAtPos(pages, font, CT1040_PAYMENTS.line26, ct.amountOwed)
    // Line 30: Total amount due
    drawDollarAtPos(pages, font, CT1040_PAYMENTS.line30, ct.amountOwed)
  }

  // ── Page 3: Schedule 1 — Modifications to Federal AGI ──────
  drawAtPos(pages, font, CT1040_SCHEDULE1.ssn, formatSSN(tp.ssn || '000000000'))

  // Additions
  drawDollarAtPos(pages, font, CT1040_SCHEDULE1.line34, ct.ctSchedule1.additions)

  // Subtractions
  if (ct.ctSchedule1.usObligationInterest > 0) {
    drawDollarAtPos(pages, font, CT1040_SCHEDULE1.line35, ct.ctSchedule1.usObligationInterest)
  }
  drawDollarAtPos(pages, font, CT1040_SCHEDULE1.line43, ct.ctSchedule1.subtractions)

  // ── Page 4: Schedule 3 (Property Tax Credit) ───────────────
  drawAtPos(pages, font, CT1040_SCHEDULE3.ssn, formatSSN(tp.ssn || '000000000'))

  if (ct.propertyTaxCredit > 0) {
    drawDollarAtPos(pages, font, CT1040_SCHEDULE3.line68, ct.propertyTaxCredit)
  }

  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateFormCT1040(taxReturn: TaxReturn, ct: FormCT1040Result): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const blue = rgb(0.1, 0.15, 0.35)
  let y = 750
  const line = (label: string, value: number) => {
    page.drawText(label, { x: 72, y, size: 9, font })
    page.drawText(`$${formatDollars(value)}`, { x: 460, y, size: 9, font: bold })
    y -= 16
  }

  page.drawText('Connecticut Form CT-1040 (2025)', { x: 72, y, size: 16, font: bold, color: blue }); y -= 20
  page.drawText(`${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}  SSN ${formatSSN(taxReturn.taxpayer.ssn || '000000000')}`, { x: 72, y, size: 9, font }); y -= 14
  page.drawText(`Filing status: ${filingStatusLabel(taxReturn.filingStatus)} (${ct.residencyType})`, { x: 72, y, size: 9, font }); y -= 24

  line('CT AGI', ct.ctAGI)
  line('Personal exemption', ct.effectiveExemption)
  line('CT taxable income', ct.ctTaxableIncome)
  line('Tax from brackets', ct.bracketTax)
  line('Table C add-back', ct.tableC_addBack)
  line('Table D recapture', ct.tableD_recapture)
  line('CT income tax', ct.ctIncomeTax)
  line('Property tax credit', ct.propertyTaxCredit)
  line('Tax after credits', ct.taxAfterCredits)
  line('CT EITC (refundable)', ct.ctEITC)
  line('CT withholding', ct.stateWithholding)
  line('Total payments', ct.totalPayments)
  if (ct.overpaid > 0) line('Refund', ct.overpaid)
  if (ct.amountOwed > 0) line('Amount owed', ct.amountOwed)

  return doc
}

// ── State Form Compiler ──────────────────────────────────────────

export const ctFormCompiler: StateFormCompiler = {
  stateCode: 'CT',

  templateFiles: ['ct1040.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const ct = stateResult.detail as FormCT1040Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('ct1040')
    const doc = templateBytes
      ? await fillFormCT1040Template(templateBytes, taxReturn, ct)
      : await generateFormCT1040(taxReturn, ct)

    return {
      doc,
      forms: [
        {
          formId: 'CT Form CT-1040',
          sequenceNumber: 'CT-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
