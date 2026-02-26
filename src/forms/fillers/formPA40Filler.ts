/**
 * PA Form PA-40 PDF filler.
 *
 * Fills the official Pennsylvania PA-40 (Personal Income Tax Return) template
 * from computed PA-40 results. Falls back to programmatic generation
 * when no template is available.
 */

import { PDFDocument, PDFName, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { PA40Result } from '../../rules/2025/pa/pa40'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { setTextField, setDollarField, checkBox, formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import {
  PA40_HEADER, PA40_RESIDENCY, PA40_INCOME,
  PA40_TAX, PA40_TAX_FORGIVENESS, PA40_CREDITS, PA40_PAYMENTS,
} from '../mappings/formPA40Fields'

// ── Multi-widget checkbox helper ────────────────────────────────
// PA-40 uses checkbox fields with multiple widgets where each widget
// represents a different option (e.g., filing status, residency type).
// pdf-lib's checkBox() would check all widgets. Instead, we set the
// appearance state of the target widget to its on-value and all others to Off.

function selectCheckboxWidget(form: ReturnType<PDFDocument['getForm']>, fieldName: string, widgetIndex: number): void {
  try {
    const field = form.getCheckBox(fieldName)
    const widgets = field.acroField.getWidgets()
    if (widgetIndex >= widgets.length) return

    widgets.forEach((w, i) => {
      if (i === widgetIndex) {
        // Find the on-value key for this widget (the key that isn't /Off)
        const ap = w.dict.get(PDFName.of('AP'))
        const n = ap instanceof Object && 'get' in ap ? (ap as { get(k: unknown): unknown }).get(PDFName.of('N')) : null
        if (n && typeof n === 'object' && 'keys' in n) {
          for (const key of (n as { keys(): Iterable<{ toString(): string }> }).keys()) {
            const keyStr = key.toString()
            if (keyStr !== '/Off') {
              w.dict.set(PDFName.of('AS'), PDFName.of(keyStr.slice(1))) // remove leading /
              field.acroField.dict.set(PDFName.of('V'), PDFName.of(keyStr.slice(1)))
              break
            }
          }
        }
      } else {
        w.dict.set(PDFName.of('AS'), PDFName.of('Off'))
      }
    })
  } catch {
    // Field not found — skip silently
  }
}

// ── Template-based filler ────────────────────────────────────────

async function fillFormPA40Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  pa40: PA40Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Page 1: Header / Personal Info ───────────────────────────
  setTextField(form, PA40_HEADER.ssn, (tp.ssn || '000000000').replace(/\D/g, ''))
  setTextField(form, PA40_HEADER.firstName, tp.firstName.toUpperCase())
  if (tp.middleInitial) {
    setTextField(form, PA40_HEADER.middleInitial, tp.middleInitial.toUpperCase())
  }
  setTextField(form, PA40_HEADER.lastName, tp.lastName.toUpperCase())

  // Spouse (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setTextField(form, PA40_HEADER.spouseSSN, sp.ssn.replace(/\D/g, ''))
    setTextField(form, PA40_HEADER.spouseFirstName, sp.firstName.toUpperCase())
    if (sp.middleInitial) {
      setTextField(form, PA40_HEADER.spouseMiddleInitial, sp.middleInitial.toUpperCase())
    }
    if (sp.lastName !== tp.lastName) {
      setTextField(form, PA40_HEADER.spouseLastName, sp.lastName.toUpperCase())
    }
  }

  // Address
  setTextField(form, PA40_HEADER.addressLine1, tp.address.street.toUpperCase())
  setTextField(form, PA40_HEADER.city, tp.address.city.toUpperCase())
  setTextField(form, PA40_HEADER.state, tp.address.state.toUpperCase())
  setTextField(form, PA40_HEADER.zip, tp.address.zip)

  // Page 2 header — Name(s)
  const names = taxReturn.spouse
    ? `${tp.lastName.toUpperCase()}, ${tp.firstName.toUpperCase()} & ${taxReturn.spouse.firstName.toUpperCase()}`
    : `${tp.lastName.toUpperCase()}, ${tp.firstName.toUpperCase()}`
  setTextField(form, PA40_HEADER.namePage2, names)

  // ── Residency Status ─────────────────────────────────────────
  // Residency Status checkbox: widget[0]=Resident, widget[1]=Part-Year, widget[2]=Nonresident
  const residencyWidgetMap: Record<string, number> = {
    'full-year':   0,
    'part-year':   1,
    'nonresident': 2,
  }
  const residencyIdx = residencyWidgetMap[pa40.residencyType]
  if (residencyIdx !== undefined) {
    selectCheckboxWidget(form, PA40_RESIDENCY.residencyStatus, residencyIdx)
  }

  // Part-year dates
  if (pa40.residencyType === 'part-year') {
    // If the state config has moveIn/moveOut dates, they would be set here.
    // For now, we leave these blank as the dates aren't in PA40Result.
  }

  // ── Filing Status ────────────────────────────────────────────
  // Filing Status checkbox: widget[0]=Single, widget[1]=MFJ, widget[2]=MFS, widget[3]=other
  const statusWidgetMap: Record<string, number> = {
    single: 0,
    mfj:    1,
    mfs:    2,
    hoh:    0,  // PA doesn't have HOH — treated as single
    qw:     1,  // PA treats QW like MFJ for filing purposes
  }
  const statusIdx = statusWidgetMap[taxReturn.filingStatus]
  if (statusIdx !== undefined) {
    selectCheckboxWidget(form, 'Filing Status', statusIdx)
  }

  // ── Income Classes (Lines 1–11) ──────────────────────────────
  const ic = pa40.incomeClasses

  // Line 1: Compensation (1a = gross, 1b = unreimbursed expenses, 1c = net)
  setDollarField(form, PA40_INCOME.line1a, ic.compensation)
  if (ic.unreimbursedExpenses > 0) {
    setDollarField(form, PA40_INCOME.line1b, ic.unreimbursedExpenses)
  }
  setDollarField(form, PA40_INCOME.line1c, ic.netCompensation)

  // Line 2: Interest
  setDollarField(form, PA40_INCOME.line2, ic.interest)

  // Line 3: Dividends
  setDollarField(form, PA40_INCOME.line3, ic.dividends)

  // Line 4: Business income/loss
  if (ic.netBusinessIncome !== 0) {
    setDollarField(form, PA40_INCOME.line4, Math.abs(ic.netBusinessIncome))
    if (ic.netBusinessIncome < 0) {
      checkBox(form, PA40_INCOME.line4Loss)
    }
  }

  // Line 5: Net gain/loss from sale of property
  if (ic.netGains !== 0) {
    setDollarField(form, PA40_INCOME.line5, Math.abs(ic.netGains))
    if (ic.netGains < 0) {
      checkBox(form, PA40_INCOME.line5Loss)
    }
  }

  // Line 6: Rents/royalties
  if (ic.rentsRoyalties !== 0) {
    setDollarField(form, PA40_INCOME.line6, Math.abs(ic.rentsRoyalties))
    if (ic.rentsRoyalties < 0) {
      checkBox(form, PA40_INCOME.line6Loss)
    }
  }

  // Line 7: Estates/trusts
  setDollarField(form, PA40_INCOME.line7, ic.estateTrustIncome)

  // Line 8: Gambling/lottery
  setDollarField(form, PA40_INCOME.line8, ic.gamblingWinnings)

  // Line 9: Total PA Taxable Income
  setDollarField(form, PA40_INCOME.line9, pa40.totalPATaxableIncome)

  // Line 10: Deductions (§529)
  if (pa40.deductions529 > 0) {
    setTextField(form, PA40_INCOME.line10Code, '11') // Code 11 = §529 contributions
    setDollarField(form, PA40_INCOME.line10, pa40.deductions529)
  }

  // Line 11: Adjusted PA Taxable Income
  setDollarField(form, PA40_INCOME.line11, pa40.adjustedTaxableIncome)

  // ── Page 2: Tax & Credits (Lines 12–24) ──────────────────────

  // Line 12: PA Tax Liability (3.07%)
  setDollarField(form, PA40_TAX.line12, pa40.paTax)

  // Line 13: Total PA Tax Withheld (W-2)
  setDollarField(form, PA40_TAX.line13, pa40.stateWithholding)

  // Line 15: Estimated installment payments
  if (pa40.estimatedPayments > 0) {
    setDollarField(form, PA40_TAX.line15, pa40.estimatedPayments)
  }

  // Line 18: Total estimated payments and credits
  setDollarField(form, PA40_TAX.line18, pa40.totalPayments)

  // ── Tax Forgiveness (Schedule SP) ────────────────────────────
  const spResult = pa40.taxForgiveness
  if (spResult.qualifies) {
    // Tax Forgiveness checkbox: widget[0]=Yes
    selectCheckboxWidget(form, PA40_TAX_FORGIVENESS.taxForgiveness, 0)

    // Number of dependents
    if (spResult.numberOfDependents > 0) {
      setTextField(form, PA40_TAX_FORGIVENESS.dependents, String(spResult.numberOfDependents))
    }

    // Line 20: Total eligibility income
    setDollarField(form, PA40_TAX_FORGIVENESS.totalEligibility, spResult.eligibilityIncome)

    // Line 21: Tax forgiveness credit
    setDollarField(form, PA40_TAX_FORGIVENESS.forgivenessCredit, spResult.forgivenessCredit)
  } else {
    // Tax Forgiveness checkbox: widget[1]=No
    selectCheckboxWidget(form, PA40_TAX_FORGIVENESS.taxForgiveness, 1)
  }

  // Line 22: Resident credit (taxes paid to other states)
  if (pa40.residentCredit > 0) {
    setDollarField(form, PA40_CREDITS.residentCredit, pa40.residentCredit)
  }

  // Line 23: Other credits
  if (pa40.otherCredits > 0) {
    setDollarField(form, PA40_CREDITS.otherCredits, pa40.otherCredits)
  }

  // Line 24: Total payments and credits
  const totalPaymentsAndCredits = pa40.totalPayments + pa40.totalCredits
  setDollarField(form, PA40_CREDITS.totalPayments, totalPaymentsAndCredits)

  // ── Result (Lines 25–31) ─────────────────────────────────────

  // Line 26: Tax due
  if (pa40.amountOwed > 0) {
    setDollarField(form, PA40_PAYMENTS.taxDue, pa40.amountOwed)
    // Line 28: Total payment
    setDollarField(form, PA40_PAYMENTS.totalPayment, pa40.amountOwed)
  }

  // Line 29: Overpayment
  if (pa40.overpaid > 0) {
    setDollarField(form, PA40_PAYMENTS.overpayment, pa40.overpaid)
    // Line 30: Refund (entire overpayment)
    setDollarField(form, PA40_PAYMENTS.refund, pa40.overpaid)
  }

  form.flatten()
  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generatePA40(
  taxReturn: TaxReturn,
  pa40: PA40Result,
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

  const drawLine = (label: string, value: string, opts?: { bold?: boolean }) => {
    draw(label, 90, 10, opts?.bold ? { font: fontBold } : undefined)
    draw(value, 430, 10, { font: fontBold })
    y -= 18
  }

  draw('Pennsylvania PA-40', 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw('Personal Income Tax Return — 2025 (Generated summary)', 72, 10, { color: gray })
  y -= 10
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: darkBlue })
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
  y -= 22

  draw('Computation', 72, 11, { font: fontBold, color: darkBlue })
  y -= 16
  drawLine('PA Total Taxable Income (Line 9)', `$${formatDollars(pa40.totalPATaxableIncome)}`)
  drawLine('PA Taxable Income', `$${formatDollars(pa40.adjustedTaxableIncome)}`)
  drawLine('PA Tax (3.07%)', `$${formatDollars(pa40.paTax)}`)
  drawLine('PA State Withholding', `$${formatDollars(pa40.stateWithholding)}`)
  y -= 6

  if (pa40.overpaid > 0) {
    drawLine('PA Refund', `$${formatDollars(pa40.overpaid)}`, { bold: true })
  } else if (pa40.amountOwed > 0) {
    drawLine('PA Amount You Owe', `$${formatDollars(pa40.amountOwed)}`, { bold: true })
  } else {
    drawLine('PA Balance', '$0.00', { bold: true })
  }

  y -= 18
  draw('Generated by OpenTax. Review against official PA-40 instructions before filing.', 72, 8, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const paFormCompiler: StateFormCompiler = {
  stateCode: 'PA',
  templateFiles: ['pa40.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const pa40 = stateResult.detail as PA40Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('pa40')
    const doc = templateBytes
      ? await fillFormPA40Template(templateBytes, taxReturn, pa40)
      : await generatePA40(taxReturn, pa40)

    return {
      doc,
      forms: [
        {
          formId: 'PA-40',
          sequenceNumber: 'PA-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
