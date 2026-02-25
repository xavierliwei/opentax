/**
 * MA Form 1 PDF filler.
 *
 * Fills the official MA DOR Form 1 (Resident Income Tax Return) template
 * from computed Form 1 results. Falls back to programmatic generation
 * when no template is available.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import type { Form1Result } from '../../rules/2025/ma/form1'
import { setTextField, setDollarField, checkBox, formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import {
  MA1_HEADER, MA1_FILING_STATUS, MA1_PAGE1_CHECKS,
  MA1_EXEMPTIONS, MA1_INCOME, MA1_DEDUCTIONS,
  MA1_TAX, MA1_PAYMENTS,
} from '../mappings/formMA1Fields'

// ── Template-based filler ────────────────────────────────────────

async function fillForm1Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  form1: Form1Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Page 1: Header ─────────────────────────────────────────
  setTextField(form, MA1_HEADER.firstName, tp.firstName)
  if (tp.middleInitial) setTextField(form, MA1_HEADER.middleInitial, tp.middleInitial)
  setTextField(form, MA1_HEADER.lastName, tp.lastName)
  setTextField(form, MA1_HEADER.ssn, formatSSN(tp.ssn || '000000000'))
  setTextField(form, MA1_HEADER.street, tp.address.street)
  setTextField(form, MA1_HEADER.city, tp.address.city)
  setTextField(form, MA1_HEADER.state, tp.address.state)
  setTextField(form, MA1_HEADER.zip, tp.address.zip)

  // Spouse (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setTextField(form, MA1_HEADER.spouseFirstName, sp.firstName)
    if (sp.middleInitial) setTextField(form, MA1_HEADER.spouseMiddleInit, sp.middleInitial)
    setTextField(form, MA1_HEADER.spouseLastName, sp.lastName)
    setTextField(form, MA1_HEADER.spouseSSN, formatSSN(sp.ssn))
  }

  // ── Filing status ──────────────────────────────────────────
  const statusOptions: Record<string, string> = {
    single: MA1_FILING_STATUS.single,
    mfj:    MA1_FILING_STATUS.mfj,
    mfs:    MA1_FILING_STATUS.mfs,
    hoh:    MA1_FILING_STATUS.hoh,
  }
  const selectedStatus = statusOptions[taxReturn.filingStatus]
  if (selectedStatus) {
    try {
      const radio = form.getRadioGroup(MA1_FILING_STATUS.radioGroup)
      radio.select(selectedStatus)
    } catch { /* ok */ }
  }

  // ── Exemptions (Page 1, Lines 1–2) ────────────────────────
  // Line 1a: personal exemption
  if (taxReturn.deductions.taxpayerAge65) checkBox(form, MA1_PAGE1_CHECKS.check1a)
  if (taxReturn.deductions.taxpayerBlind) checkBox(form, MA1_PAGE1_CHECKS.check1b)

  setDollarField(form, MA1_EXEMPTIONS.line1a, form1.personalExemption)

  // Line 2a: dependents
  const numDependents = taxReturn.dependents.length
  if (numDependents > 0) {
    setTextField(form, MA1_EXEMPTIONS.line2a, String(numDependents))
  }

  // Total exemptions
  setDollarField(form, MA1_EXEMPTIONS.total1, form1.personalExemption)
  setDollarField(form, MA1_EXEMPTIONS.total2, form1.dependentExemption)
  setDollarField(form, MA1_EXEMPTIONS.line2d, form1.age65Exemption)
  setDollarField(form, MA1_EXEMPTIONS.line2e, form1.blindExemption)
  setDollarField(form, MA1_EXEMPTIONS.line2g, form1.totalExemptions)

  // ── Page 2: Income (Lines 3–10) ────────────────────────────
  // Line 3: wages, salaries, tips from W-2s
  const stateWages = (taxReturn.w2s ?? []).reduce((sum, w) => {
    if (w.box15State === 'MA') return sum + (w.box16StateWages ?? 0)
    return sum
  }, 0)
  // Fall back to box1 sum if no MA-specific state wages
  const wages = stateWages > 0
    ? stateWages
    : (taxReturn.w2s ?? []).reduce((sum, w) => sum + w.box1, 0)
  setDollarField(form, MA1_INCOME.line3, wages)

  // Line 8a: total 5.0% income
  // For simplicity, the total 5% income is the MA AGI minus capital gains income
  // (which goes on lines 8b/9). For most returns this is the primary income.
  setDollarField(form, MA1_INCOME.line8a, form1.maAGI)

  // Line 10: total income
  setDollarField(form, MA1_INCOME.line10, form1.maAGI)

  // ── Page 2: Adjustments / Deductions (Lines 11–23) ─────────
  // Line 11a: Schedule Y adjustments (additions - subtractions)
  const schedYAdj = form1.maAdjustments.additions - form1.maAdjustments.subtractions
  if (schedYAdj !== 0) {
    setDollarField(form, MA1_DEDUCTIONS.line11a, schedYAdj)
  }

  // Line 14: Massachusetts AGI
  setDollarField(form, MA1_DEDUCTIONS.line14, form1.maAGI)

  // Line 15: exemption amount (from line 2g)
  setDollarField(form, MA1_DEDUCTIONS.line15, form1.totalExemptions)

  // Line 16: AGI minus exemptions
  const line16 = Math.max(0, form1.maAGI - form1.totalExemptions)
  setDollarField(form, MA1_DEDUCTIONS.line16, line16)

  // Line 17: deductions (rent deduction from Schedule Y)
  setDollarField(form, MA1_DEDUCTIONS.line17, form1.rentDeduction)

  // Line 18: adjusted after deductions
  const line18 = Math.max(0, line16 - form1.rentDeduction)
  setDollarField(form, MA1_DEDUCTIONS.line18, line18)

  // Line 21: total 5% taxable income
  setDollarField(form, MA1_DEDUCTIONS.line21, form1.maTaxableIncome)

  // ── Page 3: Tax / Credits (Lines 24–38) ────────────────────
  // Line 24: 5% tax on Line 21
  setDollarField(form, MA1_TAX.line24, form1.maBaseTax)

  // Line 28: total income tax (before surtax)
  setDollarField(form, MA1_TAX.line28, form1.maBaseTax)

  // Line 29: surtax (4% on income over $1M)
  setDollarField(form, MA1_TAX.line29, form1.maSurtax)

  // Line 30: total Massachusetts income tax
  setDollarField(form, MA1_TAX.line30, form1.maIncomeTax)

  // Line 33: total credits
  setDollarField(form, MA1_TAX.line33, form1.totalCredits)

  // Line 34: income tax after credits
  setDollarField(form, MA1_TAX.line34, form1.taxAfterCredits)

  // Line 37: total (line 34 + use tax + health care penalty)
  // For now, just line 34 (no use tax or HC penalty)
  setDollarField(form, MA1_TAX.line37, form1.taxAfterCredits)

  // Line 38: total additions (contributions, etc.) — 0 for now
  // Line 38 stays blank

  // ── Page 4: Payments / Refund / Amount Owed (Lines 39–54) ──
  // Line 39: total tax + additions = Line 37 + Line 38
  setDollarField(form, MA1_PAYMENTS.line39, form1.taxAfterCredits)

  // Line 40: Massachusetts income tax withheld
  setDollarField(form, MA1_PAYMENTS.line40, form1.stateWithholding)

  // Line 43b: MA EITC (refundable — 30% of federal EITC)
  if (form1.maEITC > 0) {
    setDollarField(form, MA1_PAYMENTS.line43b, form1.maEITC)
  }

  // Line 46: total refundable credits
  if (form1.maEITC > 0) {
    setDollarField(form, MA1_PAYMENTS.line46, form1.maEITC)
  }

  // Line 47: total payments and credits
  setDollarField(form, MA1_PAYMENTS.line47, form1.totalPayments)

  // Line 48: overpayment
  setDollarField(form, MA1_PAYMENTS.line48, form1.overpaid)

  // Line 50: refund amount (same as overpayment for now)
  setDollarField(form, MA1_PAYMENTS.line50, form1.overpaid)

  // Line 51: tax due
  setDollarField(form, MA1_PAYMENTS.line51, form1.amountOwed)

  // Line 53: total amount due (same as line 51 for now, no penalties)
  setDollarField(form, MA1_PAYMENTS.line53, form1.amountOwed)

  form.flatten()
  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateForm1(taxReturn: TaxReturn, form1: Form1Result): Promise<PDFDocument> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([612, 792])

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const blue = rgb(0.08, 0.18, 0.36)

  let y = 750
  const draw = (text: string, x: number, size = 9, f = font, color = black) => {
    page.drawText(text, { x, y, size, font: f, color })
  }
  const line = (label: string, val: number, tag?: string) => {
    if (tag) draw(tag, 72, 9, font, gray)
    draw(label, 120)
    draw(`$${formatDollars(val)}`, 455, 9, bold)
    y -= 16
  }

  const isPart = form1.residencyType === 'part-year'
  draw(isPart ? 'Massachusetts Form 1-NR/PY' : 'Massachusetts Form 1', 72, 16, bold, blue)
  y -= 14
  draw('Resident / Nonresident Personal Income Tax Return (generated summary)', 72, 9, font, gray)
  y -= 16

  const tp = taxReturn.taxpayer
  draw(`Name: ${tp.firstName} ${tp.lastName}`, 72)
  y -= 13
  draw(`SSN: ${formatSSN(tp.ssn || '000000000')}   Filing Status: ${filingStatusLabel(taxReturn.filingStatus)}`, 72)
  y -= 13
  draw(`Address: ${tp.address.street}, ${tp.address.city}, ${tp.address.state} ${tp.address.zip}`, 72)
  y -= 22

  draw('Income', 72, 11, bold, blue)
  y -= 16
  line('Federal AGI', form1.federalAGI)
  if (form1.maAdjustments.hsaAddBack > 0) line('HSA add-back', form1.maAdjustments.hsaAddBack)
  if (form1.maAdjustments.ssExemption > 0) line('Social Security exemption', form1.maAdjustments.ssExemption)
  if (form1.maAdjustments.usGovInterest > 0) line('US gov interest exemption', form1.maAdjustments.usGovInterest)
  line('Massachusetts AGI', form1.maAGI)
  if (form1.maSourceIncome !== undefined) {
    line('MA-source income (apportioned)', form1.maSourceIncome)
    draw(`Apportionment ratio: ${(form1.apportionmentRatio * 100).toFixed(1)}%`, 120, 8, font, gray)
    y -= 14
  }

  y -= 4
  draw('Exemptions & Deductions', 72, 11, bold, blue)
  y -= 16
  line('Personal exemption', form1.personalExemption)
  if (form1.dependentExemption > 0) line('Dependent exemption', form1.dependentExemption)
  if (form1.age65Exemption > 0) line('Age 65+ exemption', form1.age65Exemption)
  if (form1.blindExemption > 0) line('Blind exemption', form1.blindExemption)
  line('Total exemptions', form1.totalExemptions)
  if (form1.rentDeduction > 0) line('Rent deduction (50% of rent)', form1.rentDeduction)

  y -= 4
  draw('Tax', 72, 11, bold, blue)
  y -= 16
  line('MA taxable income', form1.maTaxableIncome)
  line('Base tax (5%)', form1.maBaseTax)
  if (form1.maSurtax > 0) line('Surtax (4% over $1M)', form1.maSurtax)
  line('Total income tax', form1.maIncomeTax)
  line('Tax after credits', form1.taxAfterCredits)

  y -= 4
  draw('Payments & Result', 72, 11, bold, blue)
  y -= 16
  line('State withholding', form1.stateWithholding)
  if (form1.overpaid > 0) line('Refund', form1.overpaid)
  if (form1.amountOwed > 0) line('Amount owed', form1.amountOwed)
  if (form1.overpaid === 0 && form1.amountOwed === 0) line('Balance', 0)

  y -= 24
  draw('Generated by OpenTax for review. File using official Massachusetts DOR forms.', 72, 7, font, gray)

  return doc
}

// ── State Form Compiler ──────────────────────────────────────────

export const maFormCompiler: StateFormCompiler = {
  stateCode: 'MA',

  templateFiles: ['form1.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form1 = stateResult.detail as Form1Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('form1')
    const doc = templateBytes
      ? await fillForm1Template(templateBytes, taxReturn, form1)
      : await generateForm1(taxReturn, form1)

    const formId = form1.residencyType === 'part-year' ? 'MA Form 1-NR/PY' : 'MA Form 1'

    return {
      doc,
      forms: [
        {
          formId,
          sequenceNumber: 'MA-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
