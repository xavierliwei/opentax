/**
 * Vermont Form IN-111 PDF filler.
 *
 * Fills the official VT Form IN-111 (Individual Income Tax Return) template
 * from computed Form IN-111 results. Falls back to programmatic generation
 * when no template is available.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { FormIN111Result } from '../../rules/2025/vt/formIN111'
import type { StateFormCompiler, StateFormTemplates, StateCompiledForms } from '../stateCompiler'
import { formatDollars, formatSSN, filingStatusLabel } from '../helpers'

// ── Programmatic fallback generator ──────────────────────────────

async function generateFormIN111(
  taxReturn: TaxReturn,
  form: FormIN111Result,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const black = rgb(0, 0, 0)
  const gray = rgb(0.4, 0.4, 0.4)
  const green = rgb(0.05, 0.3, 0.15)

  const page = pdfDoc.addPage([612, 792])
  let y = 750

  const draw = (text: string, x: number, size: number, opts?: { font?: typeof font; color?: typeof black }) => {
    page.drawText(text, { x, y, size, font: opts?.font ?? font, color: opts?.color ?? black })
  }

  const drawLine = (label: string, value: string, opts?: { bold?: boolean }) => {
    draw(label, 90, 9, opts?.bold ? { font: fontBold } : undefined)
    draw(value, 460, 9, { font: fontBold })
    y -= 16
  }

  // ── Header ────────────────────────────────────────────────────
  const isPartYear = form.residencyType === 'part-year'
  const formTitle = 'Vermont Form IN-111'
  const formSubtitle = isPartYear
    ? `Individual Income Tax Return — 2025 (${Math.round(form.apportionmentRatio * 100)}% VT)`
    : 'Individual Income Tax Return — 2025'
  draw(formTitle, 72, 16, { font: fontBold, color: green })
  y -= 12
  draw(formSubtitle, 72, 10, { color: gray })
  y -= 6
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.5, color: green })
  y -= 20

  // ── Taxpayer info ─────────────────────────────────────────────
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

  // ── Income Section ────────────────────────────────────────────
  draw('Income', 72, 11, { font: fontBold, color: green })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('Federal taxable income (Form 1040 Line 15)', `$${formatDollars(form.federalTaxableIncome)}`)

  if (form.vtAdditions > 0) {
    drawLine('VT additions', `$${formatDollars(form.vtAdditions)}`)
  }
  if (form.vtSubtractions > 0) {
    drawLine('VT subtractions (US gov interest)', `($${formatDollars(form.vtSubtractions)})`)
  }

  drawLine('Vermont taxable income', `$${formatDollars(form.vtTaxableIncome)}`, { bold: true })

  if (form.vtSourceIncome !== undefined) {
    draw(`Apportionment: ${Math.round(form.apportionmentRatio * 100)}% — VT-source income: $${formatDollars(form.vtSourceIncome)}`, 90, 8, { color: gray })
    y -= 14
  }
  y -= 6

  // ── Tax & Credits Section ─────────────────────────────────────
  draw('Tax & Credits', 72, 11, { font: fontBold, color: green })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  drawLine('VT tax (3.35% / 6.60% / 7.60% / 8.75%)', `$${formatDollars(form.vtTax)}`)

  if (form.dependentCareCredit > 0) {
    drawLine('Child & dependent care credit (24% of federal)', `($${formatDollars(form.dependentCareCredit)})`)
  }

  drawLine('Tax after nonrefundable credits', `$${formatDollars(form.taxAfterCredits)}`, { bold: true })

  if (form.vtEITC > 0) {
    drawLine('VT earned income credit (38% of federal EITC)', `($${formatDollars(form.vtEITC)})`)
  }
  y -= 6

  // ── Payments Section ──────────────────────────────────────────
  draw('Payments', 72, 11, { font: fontBold, color: green })
  y -= 4
  page.drawLine({ start: { x: 72, y }, end: { x: 540, y }, thickness: 0.3, color: gray })
  y -= 16

  if (form.stateWithholding > 0) {
    drawLine('VT state income tax withheld', `$${formatDollars(form.stateWithholding)}`)
  }

  drawLine('Total payments (withholding + refundable credits)', `$${formatDollars(form.totalPayments)}`, { bold: true })
  y -= 6

  // ── Result Section ────────────────────────────────────────────
  draw('Result', 72, 11, { font: fontBold, color: green })
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
  draw('Generated by OpenTax — for review purposes. File using official VT Form IN-111.', 72, 7, { color: gray })

  return pdfDoc
}

// ── State Form Compiler ──────────────────────────────────────────

export const vtFormCompiler: StateFormCompiler = {
  stateCode: 'VT',

  templateFiles: ['in111.pdf'],

  async compile(
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form = stateResult.detail as FormIN111Result
    const doc = await generateFormIN111(taxReturn, form)

    return {
      doc,
      forms: [
        {
          formId: 'Vermont Form IN-111',
          sequenceNumber: 'VT-01',
          pageCount: doc.getPageCount(),
        },
      ],
    }
  },
}
