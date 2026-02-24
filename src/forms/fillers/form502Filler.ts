/**
 * MD Form 502 PDF generator.
 *
 * Generates a Maryland Form 502 (Resident Income Tax Return) PDF
 * from computed Form 502 results.
 *
 * Currently generates programmatically using pdf-lib since the official
 * MD template is not bundled.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { StateComputeResult } from '../../rules/stateEngine'
import type { Form502Result } from '../../rules/2025/md/form502'
import type { StateCompiledForms, StateFormCompiler, StateFormTemplates } from '../stateCompiler'
import { filingStatusLabel, formatDollars, formatSSN } from '../helpers'
import { MD_COUNTIES } from '../../rules/2025/md/constants'

// ── Programmatic generator ────────────────────────────────────────

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
    _templates: StateFormTemplates,
  ): Promise<StateCompiledForms> {
    const form = stateResult.detail as Form502Result

    const doc = await generateForm502(taxReturn, form)

    const formId = form.residencyType === 'nonresident' ? 'MD Form 505' : 'MD Form 502'

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
