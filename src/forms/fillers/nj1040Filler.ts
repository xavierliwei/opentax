/**
 * NJ-1040 PDF filler.
 *
 * Fills the official NJ Division of Taxation NJ-1040 (Resident Income Tax
 * Return) template from computed NJ-1040 results. Falls back to programmatic
 * generation when no template is available.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { NJ1040Result } from '../../rules/2025/nj/formNJ1040'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { setTextField, checkBox, formatDollars, formatSSN, filingStatusLabel } from '../helpers'
import {
  NJ1040_HEADER, NJ1040_FILING_STATUS, NJ1040_EXEMPTIONS, NJ1040_DEPENDENTS,
  NJ1040_PAGE1_HEADER, NJ1040_INCOME, NJ1040_DEDUCTIONS, NJ1040_TAX,
  NJ1040_PAGE2_HEADER, NJ1040_CREDITS, NJ1040_BALANCE, NJ1040_RESULT,
  NJ1040_PAGE3_HEADER, NJ1040_PAGE3,
} from '../mappings/formNJ1040Fields'

// ── Digit-field helpers ──────────────────────────────────────────

/**
 * Fill an array of single-digit PDF fields with the digits of a dollar
 * amount (cents → whole dollars). Digits are filled right-to-left so the
 * ones digit goes into the last field, tens into second-to-last, etc.
 * Skips if amount is zero.
 */
function setDigitDollarField(
  form: import('pdf-lib').PDFForm,
  fieldNames: readonly string[],
  amountCents: number,
): void {
  if (amountCents === 0) return
  const dollars = Math.abs(Math.trunc(amountCents / 100))
  const digits = String(dollars)
  // Fill right-to-left
  const offset = fieldNames.length - digits.length
  for (let i = 0; i < digits.length && offset + i >= 0; i++) {
    setTextField(form, fieldNames[offset + i], digits[i])
  }
}

/**
 * Fill an array of single-digit PDF fields with the individual characters
 * of a string (e.g. SSN digits). Fills left-to-right.
 */
function setDigitFields(
  form: import('pdf-lib').PDFForm,
  fieldNames: readonly string[],
  value: string,
): void {
  const chars = value.replace(/\D/g, '')
  for (let i = 0; i < Math.min(chars.length, fieldNames.length); i++) {
    setTextField(form, fieldNames[i], chars[i])
  }
}

// ── Template-based filler ────────────────────────────────────────

async function fillFormNJ1040Template(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  nj: NJ1040Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const tp = taxReturn.taxpayer

  // ── Page 0: Header ──────────────────────────────────────────
  setDigitFields(form, NJ1040_HEADER.ssnDigits, tp.ssn || '000000000')
  const fullName = `${tp.lastName} ${tp.firstName}${tp.middleInitial ? ` ${tp.middleInitial}` : ''}`
  setTextField(form, NJ1040_HEADER.fullName, fullName)
  setTextField(form, NJ1040_HEADER.countyMuniCode, `${tp.address.city}, ${tp.address.state}`)
  setTextField(form, NJ1040_HEADER.state, tp.address.state)
  setTextField(form, NJ1040_HEADER.zip, tp.address.zip)

  // Spouse (if MFJ or MFS)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setDigitFields(form, NJ1040_HEADER.spouseSsnDigits, sp.ssn)
    const spouseName = `${sp.lastName} ${sp.firstName}${sp.middleInitial ? ` ${sp.middleInitial}` : ''}`
    setTextField(form, NJ1040_HEADER.spouseName, spouseName)
  }

  // ── Filing status ───────────────────────────────────────────
  const statusOptions: Record<string, string> = {
    single: NJ1040_FILING_STATUS.single,
    mfj:    NJ1040_FILING_STATUS.mfj,
    mfs:    NJ1040_FILING_STATUS.mfs,
    hoh:    NJ1040_FILING_STATUS.hoh,
    qw:     NJ1040_FILING_STATUS.qw,
  }
  const selectedStatus = statusOptions[taxReturn.filingStatus]
  if (selectedStatus) {
    try {
      const radio = form.getRadioGroup(NJ1040_FILING_STATUS.radioGroup)
      radio.select(selectedStatus)
    } catch { /* ok */ }
  }

  // MFS: fill spouse SSN in the filing status area
  if (taxReturn.filingStatus === 'mfs' && taxReturn.spouse) {
    setDigitFields(form, NJ1040_FILING_STATUS.mfsSpouseSsnDigits, taxReturn.spouse.ssn)
  }

  // ── Exemptions ──────────────────────────────────────────────
  const isMFJ = taxReturn.filingStatus === 'mfj'

  // Regular exemption (self, and spouse if MFJ)
  checkBox(form, NJ1040_EXEMPTIONS.selfRegular)
  const regularCount = isMFJ ? 2 : 1
  setTextField(form, NJ1040_EXEMPTIONS.regularCount, String(regularCount))
  setTextField(form, NJ1040_EXEMPTIONS.regularAmount, String(regularCount * 1000))
  if (isMFJ) {
    checkBox(form, NJ1040_EXEMPTIONS.spouseRegular)
  }

  // Age 65+ (we check via deductions flags)
  let age65Count = 0
  if (taxReturn.deductions.taxpayerAge65) {
    checkBox(form, NJ1040_EXEMPTIONS.selfAge65)
    age65Count++
  }
  if (isMFJ && taxReturn.deductions.spouseAge65) {
    checkBox(form, NJ1040_EXEMPTIONS.spouseAge65)
    age65Count++
  }
  if (age65Count > 0) {
    setTextField(form, NJ1040_EXEMPTIONS.age65Count, String(age65Count))
    setTextField(form, NJ1040_EXEMPTIONS.age65Amount, String(age65Count * 1000))
  }

  // Dependent children
  const depCount = taxReturn.dependents.length
  if (depCount > 0) {
    setTextField(form, NJ1040_EXEMPTIONS.dependentChildCount, String(depCount))
    setTextField(form, NJ1040_EXEMPTIONS.dependentChildAmount, String(depCount * 1500))
  }

  // ── Dependents ──────────────────────────────────────────────
  const dependents = taxReturn.dependents ?? []
  const depSlots = [
    {
      name: NJ1040_DEPENDENTS.dep1Name,
      ssn: NJ1040_DEPENDENTS.dep1SsnDigits,
      birthYear: NJ1040_DEPENDENTS.dep1BirthYearDigits,
      healthCoverage: NJ1040_DEPENDENTS.dep1HealthCoverage,
    },
    {
      name: NJ1040_DEPENDENTS.dep2Name,
      ssn: NJ1040_DEPENDENTS.dep2SsnDigits,
      birthYear: NJ1040_DEPENDENTS.dep2BirthYearDigits,
      healthCoverage: NJ1040_DEPENDENTS.dep2HealthCoverage,
    },
    {
      name: NJ1040_DEPENDENTS.dep3Name,
      ssn: NJ1040_DEPENDENTS.dep3SsnDigits,
      birthYear: NJ1040_DEPENDENTS.dep3BirthYearDigits,
      healthCoverage: NJ1040_DEPENDENTS.dep3HealthCoverage,
    },
    {
      name: NJ1040_DEPENDENTS.dep4Name,
      ssn: NJ1040_DEPENDENTS.dep4SsnDigits,
      birthYear: NJ1040_DEPENDENTS.dep4BirthYearDigits,
      healthCoverage: NJ1040_DEPENDENTS.dep4HealthCoverage,
    },
  ]
  for (let i = 0; i < Math.min(dependents.length, 4); i++) {
    const dep = dependents[i]
    setTextField(form, depSlots[i].name,
      `${dep.lastName} ${dep.firstName}`)
    if (dep.ssn) {
      setDigitFields(form, depSlots[i].ssn, dep.ssn)
    }
    if (dep.dateOfBirth) {
      const year = dep.dateOfBirth.split('-')[0]
      setDigitFields(form, depSlots[i].birthYear, year)
    }
    checkBox(form, depSlots[i].healthCoverage)
  }

  // ── Page 1 header ───────────────────────────────────────────
  setTextField(form, NJ1040_PAGE1_HEADER.yourSSN, formatSSN(tp.ssn || '000000000'))
  const displayName = `${tp.firstName} ${tp.lastName}`
  setTextField(form, NJ1040_PAGE1_HEADER.yourName, displayName)

  // ── Income (Lines 15–29) ────────────────────────────────────
  setDigitDollarField(form, NJ1040_INCOME.line15, nj.line15_wages)
  setDigitDollarField(form, NJ1040_INCOME.line16a, nj.line16a_taxableInterest)
  setDigitDollarField(form, NJ1040_INCOME.line17, nj.line17_dividends)
  setDigitDollarField(form, NJ1040_INCOME.line18, nj.line18_businessIncome)
  setDigitDollarField(form, NJ1040_INCOME.line19, nj.line19_capitalGains)
  setDigitDollarField(form, NJ1040_INCOME.line20a, nj.line20a_pensions)
  setDigitDollarField(form, NJ1040_INCOME.line20b, nj.line20b_pensionExclusion)
  setDigitDollarField(form, NJ1040_INCOME.line21, nj.line21_partnershipIncome)
  setDigitDollarField(form, NJ1040_INCOME.line22, nj.line22_rentalIncome)
  setDigitDollarField(form, NJ1040_INCOME.line25, nj.line25_otherIncome)
  setDigitDollarField(form, NJ1040_INCOME.line27, nj.line27_totalIncome)
  // Line 28a: pension exclusion (same as 20b for Phase 1)
  setDigitDollarField(form, NJ1040_INCOME.line28a, nj.line20b_pensionExclusion)
  setDigitDollarField(form, NJ1040_INCOME.line28c, nj.line28c_totalExclusions)
  setDigitDollarField(form, NJ1040_INCOME.line29, nj.line29_njGrossIncome)

  // ── Deductions (Lines 30–36) ────────────────────────────────
  setDigitDollarField(form, NJ1040_DEDUCTIONS.line30, nj.line30_propertyTaxDeduction)
  setDigitDollarField(form, NJ1040_DEDUCTIONS.line31, nj.line31_medicalExpenses)
  setDigitDollarField(form, NJ1040_DEDUCTIONS.line36, nj.line36_totalDeductions)

  // ── Exemptions total (Line 37) ─────────────────────────────
  setDigitDollarField(form, NJ1040_TAX.line37, nj.line37_exemptions)

  // ── Property tax strategy (Line 38a radio) ─────────────────
  if (nj.usedPropertyTaxDeduction) {
    try {
      const radio = form.getRadioGroup(NJ1040_TAX.propertyTaxRadio)
      radio.select(NJ1040_TAX.propertyTaxDeduction)
    } catch { /* ok */ }
  } else if (nj.line43_propertyTaxCredit > 0) {
    try {
      const radio = form.getRadioGroup(NJ1040_TAX.propertyTaxRadio)
      radio.select(NJ1040_TAX.propertyTaxCredit)
    } catch { /* ok */ }
  }

  // ── Tax (Line 39) ──────────────────────────────────────────
  setDigitDollarField(form, NJ1040_TAX.line39, nj.line39_njTax)
  // Line 41 = total tax due (same as Line 49 for now)
  setDigitDollarField(form, NJ1040_TAX.line41, nj.line49_taxAfterCredits)

  // ── Page 2 header ───────────────────────────────────────────
  setTextField(form, NJ1040_PAGE2_HEADER.yourSSN, formatSSN(tp.ssn || '000000000'))
  setTextField(form, NJ1040_PAGE2_HEADER.yourName, displayName)

  // ── Credits (Lines 40–48) ──────────────────────────────────
  setDigitDollarField(form, NJ1040_CREDITS.line43, nj.line43_propertyTaxCredit)
  setDigitDollarField(form, NJ1040_CREDITS.line44, nj.line44_njEITC)
  setDigitDollarField(form, NJ1040_CREDITS.line45, nj.line45_njChildTaxCredit)
  setDigitDollarField(form, NJ1040_CREDITS.line48, nj.line48_totalCredits)

  // ── Balance (Lines 49–56) ──────────────────────────────────
  setDigitDollarField(form, NJ1040_BALANCE.line49, nj.line49_taxAfterCredits)
  setDigitDollarField(form, NJ1040_BALANCE.line51, nj.line51_totalTaxDue)
  checkBox(form, NJ1040_BALANCE.w2Attached)
  setDigitDollarField(form, NJ1040_BALANCE.line52, nj.line52_njWithholding)
  setDigitDollarField(form, NJ1040_BALANCE.line55, nj.line55_totalPayments)

  // Overpaid (Line 56)
  setDigitDollarField(form, NJ1040_BALANCE.line56, nj.line56_overpaid)

  // ── Refund / Amount Owed (Lines 58–66) ─────────────────────
  if (nj.line56_overpaid > 0) {
    // Refund the full overpayment
    setDigitDollarField(form, NJ1040_RESULT.line62, nj.line56_overpaid)
    setDigitDollarField(form, NJ1040_RESULT.line64, nj.line56_overpaid)
  }
  if (nj.line57_amountOwed > 0) {
    setDigitDollarField(form, NJ1040_RESULT.line66, nj.line57_amountOwed)
  }

  // ── Page 3 header ───────────────────────────────────────────
  setTextField(form, NJ1040_PAGE3_HEADER.yourSSN, formatSSN(tp.ssn || '000000000'))
  setTextField(form, NJ1040_PAGE3_HEADER.yourName, displayName)

  // ── Page 3: Total amount due / overpayment ─────────────────
  if (nj.line57_amountOwed > 0) {
    setDigitDollarField(form, NJ1040_PAGE3.line75, nj.line57_amountOwed)
  }
  if (nj.line56_overpaid > 0) {
    setDigitDollarField(form, NJ1040_PAGE3.line76, nj.line56_overpaid)
  }

  form.flatten()
  return pdfDoc
}

// ── Programmatic fallback generator ──────────────────────────────

async function generateFormNJ1040(
  taxReturn: TaxReturn,
  nj: NJ1040Result,
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
  draw('New Jersey NJ-1040', 72, 16, { font: fontBold, color: darkBlue })
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

  if (nj.line15_wages > 0) drawLine('Wages, salaries, tips', '15', `$${formatDollars(nj.line15_wages)}`)
  if (nj.line16a_taxableInterest > 0) drawLine('Taxable interest', '16a', `$${formatDollars(nj.line16a_taxableInterest)}`)
  if (nj.line17_dividends > 0) drawLine('Dividends', '17', `$${formatDollars(nj.line17_dividends)}`)
  if (nj.line18_businessIncome !== 0) drawLine('Net business income', '18', `$${formatDollars(nj.line18_businessIncome)}`)
  if (nj.line19_capitalGains !== 0) drawLine('Net gains from property', '19', `$${formatDollars(nj.line19_capitalGains)}`)
  if (nj.line20a_pensions > 0) drawLine('Pensions, annuities, IRA', '20a', `$${formatDollars(nj.line20a_pensions)}`)
  if (nj.line20b_pensionExclusion > 0) drawLine('Pension exclusion', '20b', `($${formatDollars(nj.line20b_pensionExclusion)})`)
  if (nj.line21_partnershipIncome !== 0) drawLine('Partnership/S-corp income', '21', `$${formatDollars(nj.line21_partnershipIncome)}`)
  if (nj.line22_rentalIncome !== 0) drawLine('Rental income', '22', `$${formatDollars(nj.line22_rentalIncome)}`)

  drawLine('Total income', '27', `$${formatDollars(nj.line27_totalIncome)}`)
  if (nj.line28c_totalExclusions > 0) drawLine('Total exclusions', '28c', `($${formatDollars(nj.line28c_totalExclusions)})`)
  drawLine('NJ gross income', '29', `$${formatDollars(nj.line29_njGrossIncome)}`, { bold: true })
  y -= 6

  // Deductions & Exemptions
  draw('Deductions & Exemptions', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (nj.line30_propertyTaxDeduction > 0) drawLine('Property tax deduction', '30', `$${formatDollars(nj.line30_propertyTaxDeduction)}`)
  if (nj.line31_medicalExpenses > 0) drawLine('Medical expenses (>2% NJ gross)', '31', `$${formatDollars(nj.line31_medicalExpenses)}`)
  drawLine('Personal exemptions', '37', `$${formatDollars(nj.line37_exemptions)}`)
  drawLine('NJ taxable income', '38', `$${formatDollars(nj.line38_njTaxableIncome)}`, { bold: true })
  y -= 6

  // Tax & Credits
  draw('Tax & Credits', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('NJ tax (from rate schedule)', '39', `$${formatDollars(nj.line39_njTax)}`)
  if (nj.line43_propertyTaxCredit > 0) drawLine('Property tax credit', '43', `($${formatDollars(nj.line43_propertyTaxCredit)})`)
  if (nj.line44_njEITC > 0) drawLine('NJ Earned Income Tax Credit', '44', `($${formatDollars(nj.line44_njEITC)})`)
  if (nj.line45_njChildTaxCredit > 0) drawLine('NJ Child Tax Credit', '45', `($${formatDollars(nj.line45_njChildTaxCredit)})`)
  drawLine('Tax after credits', '49', `$${formatDollars(nj.line49_taxAfterCredits)}`, { bold: true })
  y -= 6

  // Payments
  draw('Payments', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (nj.line52_njWithholding > 0) drawLine('NJ state income tax withheld', '52', `$${formatDollars(nj.line52_njWithholding)}`)
  drawLine('Total payments', '55', `$${formatDollars(nj.line55_totalPayments)}`, { bold: true })
  y -= 6

  // Result
  draw('Result', 72, 11, { font: fontBold, color: darkBlue })
  y -= 4
  page1.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (nj.line56_overpaid > 0) {
    drawLine('Overpaid (refund)', '56', `$${formatDollars(nj.line56_overpaid)}`, { bold: true })
  } else if (nj.line57_amountOwed > 0) {
    drawLine('Amount you owe', '57', `$${formatDollars(nj.line57_amountOwed)}`, { bold: true })
  } else {
    drawLine('Balance', '', '$0')
  }

  y -= 30
  draw('Generated by OpenTax — for review purposes. File using official NJ-1040.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const njFormCompiler: StateFormCompiler = {
  stateCode: 'NJ',

  templateFiles: ['nj1040.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const nj1040 = stateResult.detail as NJ1040Result

    // Use official template when available, fall back to programmatic generation
    const templateBytes = templates.templates.get('nj1040')
    const doc = templateBytes
      ? await fillFormNJ1040Template(templateBytes, taxReturn, nj1040)
      : await generateFormNJ1040(taxReturn, nj1040)

    return {
      doc,
      forms: [
        {
          formId: 'NJ Form NJ-1040',
          sequenceNumber: 'NJ-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
