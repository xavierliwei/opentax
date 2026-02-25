/**
 * NY IT-201 PDF filler.
 *
 * Fills the official NYS IT-201 (Resident Income Tax Return) template
 * from computed IT-201 results. Falls back to programmatic generation
 * when no template is available.
 */

import { PDFDocument, PDFName, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { FormIT201Result } from '../../rules/2025/ny/formIT201'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { setTextField, setDollarField, formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import {
  IT201_HEADER, IT201_FILING_STATUS, IT201_DEPENDENTS,
  IT201_INCOME, IT201_ADJUSTMENTS, IT201_DEDUCTION_TYPE,
  IT201_TAX, IT201_OTHER_TAXES, IT201_YONKERS, IT201_CREDITS,
  IT201_RESULT, IT201_PAGE2_HEADER,
} from '../mappings/formIT201Fields'

// ── Multi-widget checkbox helper ────────────────────────────────
// NY IT-201 uses checkbox fields with multiple widgets where each widget
// has a unique on-value appearance key (acts like a radio button group).
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
              // Also set field value to match
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

async function fillFormIT201Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  ny: FormIT201Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Page 1: Header ─────────────────────────────────────────
  setTextField(form, IT201_HEADER.tpFirstName, tp.firstName)
  if (tp.middleInitial) setTextField(form, IT201_HEADER.tpMI, tp.middleInitial)
  setTextField(form, IT201_HEADER.tpLastName, tp.lastName)
  setTextField(form, IT201_HEADER.tpSSN, formatSSN(tp.ssn || '000000000'))

  // Address
  setTextField(form, IT201_HEADER.mailAddress, tp.address.street)
  if (tp.address.apartment) setTextField(form, IT201_HEADER.mailApt, tp.address.apartment)
  setTextField(form, IT201_HEADER.mailCity, tp.address.city)
  setTextField(form, IT201_HEADER.mailState, tp.address.state)
  setTextField(form, IT201_HEADER.mailZip, tp.address.zip)

  // Spouse (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setTextField(form, IT201_HEADER.spouseFirstName, sp.firstName)
    if (sp.middleInitial) setTextField(form, IT201_HEADER.spouseMI, sp.middleInitial)
    setTextField(form, IT201_HEADER.spouseLastName, sp.lastName)
    setTextField(form, IT201_HEADER.spouseSSN, formatSSN(sp.ssn))
  }

  // ── Filing status ──────────────────────────────────────────
  const statusWidgetMap: Record<string, number> = {
    single: IT201_FILING_STATUS.singleIdx,
    mfj:    IT201_FILING_STATUS.mfjIdx,
    mfs:    IT201_FILING_STATUS.mfsIdx,
    hoh:    IT201_FILING_STATUS.hohIdx,
    qw:     IT201_FILING_STATUS.qwIdx,
  }
  const widgetIdx = statusWidgetMap[taxReturn.filingStatus]
  if (widgetIdx !== undefined) {
    selectCheckboxWidget(form, IT201_FILING_STATUS.fieldName, widgetIdx)
  }

  // ── Dependents (Section H) ────────────────────────────────
  const dependents = taxReturn.dependents ?? []
  for (let i = 0; i < Math.min(dependents.length, 7); i++) {
    const dep = dependents[i]
    setTextField(form, IT201_DEPENDENTS.firstName[i], dep.firstName)
    setTextField(form, IT201_DEPENDENTS.lastName[i], dep.lastName)
    if (dep.ssn) setTextField(form, IT201_DEPENDENTS.ssn[i], formatSSN(dep.ssn))
    if (dep.relationship) setTextField(form, IT201_DEPENDENTS.relationship[i], dep.relationship)
    if (dep.dateOfBirth) setTextField(form, IT201_DEPENDENTS.dob[i], dep.dateOfBirth)
  }

  // ── Page 2 header ──────────────────────────────────────────
  const fullName = `${tp.firstName} ${tp.lastName}`
  setTextField(form, IT201_PAGE2_HEADER.nameAsPage1, fullName)

  // ── Income (Line 18 = Federal AGI) ─────────────────────────
  // IT-201 Lines 1-17 mirror federal individual line items.
  // We fill Line 18 (Federal AGI) which is the key rollup.
  setDollarField(form, IT201_INCOME.line18, ny.federalAGI)

  // ── NY additions (Line 19) ────────────────────────────────
  setDollarField(form, IT201_INCOME.line19, ny.nyAdditions)

  // ── NY subtractions (Lines 20-26) ─────────────────────────
  // Line 20: Interest income on US gov obligations
  setDollarField(form, IT201_ADJUSTMENTS.line20, ny.usGovInterest)
  // Line 22: Social Security benefits
  setDollarField(form, IT201_ADJUSTMENTS.line22, ny.ssExemption)
  // Line 23: Pension/annuity exclusion
  setDollarField(form, IT201_ADJUSTMENTS.line23, ny.pensionExclusion)
  // Line 26: Total NY subtractions
  setDollarField(form, IT201_ADJUSTMENTS.line26, ny.nySubtractions)

  // ── Line 27: Federal AGI +/- additions - subtractions ─────
  // Line 27 = Line 18 + Line 19 - Line 26
  const line27 = ny.federalAGI + ny.nyAdditions - ny.nySubtractions
  setDollarField(form, IT201_ADJUSTMENTS.line27, line27)

  // Lines 28-31: NY additions from non-NY bonds, etc. (currently 0)
  // Line 32: NY AGI
  setDollarField(form, IT201_ADJUSTMENTS.line32, ny.nyAGI)
  // Line 33: NY AGI (same as line 32 for full-year residents)
  setDollarField(form, IT201_ADJUSTMENTS.line33, ny.nyAGI)

  // ── Deduction (Line 34) ───────────────────────────────────
  // Select standard or itemized deduction checkbox
  const dedWidgetIdx = ny.deductionMethod === 'itemized'
    ? IT201_DEDUCTION_TYPE.itemizedIdx
    : IT201_DEDUCTION_TYPE.standardIdx
  selectCheckboxWidget(form, IT201_DEDUCTION_TYPE.fieldName, dedWidgetIdx)

  setDollarField(form, IT201_ADJUSTMENTS.line34, ny.deductionUsed)

  // Line 35: Line 33 - Line 34
  const line35 = Math.max(0, ny.nyAGI - ny.deductionUsed)
  setDollarField(form, IT201_ADJUSTMENTS.line35, line35)

  // Line 36: Dependent exemption
  setDollarField(form, IT201_ADJUSTMENTS.line36, ny.dependentExemption)

  // Line 37: NY taxable income
  setDollarField(form, IT201_ADJUSTMENTS.line37, ny.nyTaxableIncome)

  // ── Tax computation (Lines 38-39) ─────────────────────────
  setDollarField(form, IT201_TAX.line38, ny.nyTaxableIncome) // Line 38 = taxable income for rate lookup
  setDollarField(form, IT201_TAX.line39, ny.nyTax)            // Line 39 = computed tax

  // Lines 40-45: Credits applied against tax
  // Line 43 = tax minus household credit and child/dependent care
  setDollarField(form, IT201_TAX.line43, ny.nyTax) // Simplified: no household/child care credits yet

  // Line 44: NY EITC (earned income credit)
  setDollarField(form, IT201_TAX.line44, ny.nyEITC)

  // Line 45: Tax minus EITC
  const line45 = Math.max(0, ny.nyTax - ny.nyEITC)
  setDollarField(form, IT201_TAX.line45, line45)

  // Line 48: Tax after all credits (line 45 minus property/tuition credits)
  setDollarField(form, IT201_TAX.line48, ny.taxAfterCredits)

  // ── Other taxes (Lines 49-63) ──────────────────────────────
  // Line 50: NYS total tax (for now = taxAfterCredits + 0 other taxes)
  setDollarField(form, IT201_OTHER_TAXES.line50, ny.taxAfterCredits)

  // Lines 51-58: NYC taxes (not yet implemented, set to 0)
  // Lines 59-62: Yonkers taxes (not yet implemented, set to 0)

  // Line 63: Total NY State, NYC, Yonkers taxes
  setDollarField(form, IT201_YONKERS.line63, ny.taxAfterCredits)

  // ── Payments & Credits (Lines 64-76) ───────────────────────
  // Line 64: NY State tax withheld
  setDollarField(form, IT201_CREDITS.line64, ny.stateWithholding)

  // Line 70: Total withholding
  setDollarField(form, IT201_CREDITS.line70, ny.stateWithholding)

  // Line 70a: Total payments
  setDollarField(form, IT201_CREDITS.line70a, ny.totalPayments)

  // Line 71: Earned income credit (refundable portion)
  setDollarField(form, IT201_CREDITS.line71, ny.nyEITC)

  // Line 76: Total payments and credits
  setDollarField(form, IT201_CREDITS.line76, ny.totalPayments)

  // ── Refund / Amount Owed (Lines 77-82) ─────────────────────
  if (ny.overpaid > 0) {
    setDollarField(form, IT201_RESULT.line77, ny.overpaid)
    setDollarField(form, IT201_RESULT.line78, ny.overpaid)
  }

  if (ny.amountOwed > 0) {
    setDollarField(form, IT201_RESULT.line79, ny.amountOwed)
    setDollarField(form, IT201_RESULT.line81, ny.amountOwed)
  }

  form.flatten()
  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateFormIT201(
  taxReturn: TaxReturn,
  ny: FormIT201Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const darkBlue = rgb(0.05, 0.15, 0.4)

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
  draw('New York Form IT-201', 72, 16, { font: fontBold, color: darkBlue })
  y -= 12
  draw('Resident Income Tax Return — 2025', 72, 10, { color: gray })
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

  // Income
  draw('Income', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal adjusted gross income', '1', `$${formatDollars(ny.federalAGI)}`)
  if (ny.nyAdditions > 0) drawLine('NY additions', '2', `$${formatDollars(ny.nyAdditions)}`)
  if (ny.ssExemption > 0) drawLine('Social Security exemption', '27', `($${formatDollars(ny.ssExemption)})`)
  if (ny.usGovInterest > 0) drawLine('US gov obligation interest', '28', `($${formatDollars(ny.usGovInterest)})`)
  if (ny.nySubtractions > 0) drawLine('Total NY subtractions', '32', `($${formatDollars(ny.nySubtractions)})`)
  drawLine('New York adjusted gross income', '33', `$${formatDollars(ny.nyAGI)}`, { bold: true })
  y -= 6

  // Deductions
  draw('Deductions & Exemptions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine(`NY ${ny.deductionMethod} deduction`, '34', `$${formatDollars(ny.deductionUsed)}`)
  if (ny.dependentExemption > 0) drawLine('Dependent exemption', '36', `$${formatDollars(ny.dependentExemption)}`)
  drawLine('NY taxable income', '37', `$${formatDollars(ny.nyTaxableIncome)}`, { bold: true })
  y -= 6

  // Tax & Credits
  draw('Tax & Credits', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('NY tax (from rate schedule)', '39', `$${formatDollars(ny.nyTax)}`)
  if (ny.nyEITC > 0) drawLine('NY Earned Income Tax Credit', '65', `($${formatDollars(ny.nyEITC)})`)
  if (ny.totalCredits > 0) drawLine('Total credits', '68', `($${formatDollars(ny.totalCredits)})`)
  drawLine('Tax after credits', '69', `$${formatDollars(ny.taxAfterCredits)}`, { bold: true })
  y -= 6

  // Payments
  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (ny.stateWithholding > 0) drawLine('NY state income tax withheld', '72', `$${formatDollars(ny.stateWithholding)}`)
  drawLine('Total payments', '76', `$${formatDollars(ny.totalPayments)}`, { bold: true })
  y -= 6

  // Result
  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (ny.overpaid > 0) {
    drawLine('Overpaid (refund)', '78', `$${formatDollars(ny.overpaid)}`, { bold: true })
  } else if (ny.amountOwed > 0) {
    drawLine('Amount you owe', '80', `$${formatDollars(ny.amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  draw('Generated by OpenTax — for review purposes. File using official NY IT-201.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const nyFormCompiler: StateFormCompiler = {
  stateCode: 'NY',

  templateFiles: ['it201.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const it201 = stateResult.detail as FormIT201Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('it201')
    const doc = templateBytes
      ? await fillFormIT201Template(templateBytes, taxReturn, it201)
      : await generateFormIT201(taxReturn, it201)

    return {
      doc,
      forms: [
        {
          formId: 'NY Form IT-201',
          sequenceNumber: 'NY-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
