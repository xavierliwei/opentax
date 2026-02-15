/**
 * Form 1040 PDF filler.
 *
 * Maps computed Form1040Result values to IRS Form 1040 PDF fields.
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { Form1040Result } from '../../rules/2025/form1040'
import { F1040_HEADER, F1040_FILING_STATUS, F1040_INCOME, F1040_PAGE2 } from '../mappings/form1040Fields'
import { setTextField, setDollarField, checkBox, formatSSN } from '../helpers'

export async function fillForm1040(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: Form1040Result,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // ── Header ──────────────────────────────────────────────────
  const tp = taxReturn.taxpayer
  setTextField(form, F1040_HEADER.firstName, tp.firstName + (tp.middleInitial ? ` ${tp.middleInitial}` : ''))
  setTextField(form, F1040_HEADER.lastName, tp.lastName)
  setTextField(form, F1040_HEADER.ssn, formatSSN(tp.ssn))
  setTextField(form, F1040_HEADER.street, tp.address.street)
  if (tp.address.apartment) setTextField(form, F1040_HEADER.apartment, tp.address.apartment)
  setTextField(form, F1040_HEADER.city, tp.address.city)
  setTextField(form, F1040_HEADER.state, tp.address.state)
  setTextField(form, F1040_HEADER.zip, tp.address.zip)

  // Spouse (if MFJ)
  if (taxReturn.spouse) {
    const sp = taxReturn.spouse
    setTextField(form, F1040_HEADER.spouseFirstName, sp.firstName + (sp.middleInitial ? ` ${sp.middleInitial}` : ''))
    setTextField(form, F1040_HEADER.spouseLastName, sp.lastName)
    setTextField(form, F1040_HEADER.spouseSSN, formatSSN(sp.ssn))
  }

  // ── Filing status ───────────────────────────────────────────
  const statusMap = F1040_FILING_STATUS as Record<string, string>
  const statusField = statusMap[taxReturn.filingStatus]
  if (statusField) checkBox(form, statusField)

  // ── Page 1: Income ──────────────────────────────────────────
  setDollarField(form, F1040_INCOME.line1a, result.line1a.amount)
  setDollarField(form, F1040_INCOME.line1z, result.line1a.amount) // MVP: 1z = 1a
  setDollarField(form, F1040_INCOME.line2a, result.line2a.amount)
  setDollarField(form, F1040_INCOME.line2b, result.line2b.amount)
  setDollarField(form, F1040_INCOME.line3a, result.line3a.amount)
  setDollarField(form, F1040_INCOME.line3b, result.line3b.amount)
  setDollarField(form, F1040_INCOME.line7a, result.line7.amount)
  setDollarField(form, F1040_INCOME.line8, result.line8.amount)
  setDollarField(form, F1040_INCOME.line9, result.line9.amount)
  setDollarField(form, F1040_INCOME.line10, result.line10.amount)
  setDollarField(form, F1040_INCOME.line11a, result.line11.amount)

  // ── Page 2: Tax & Credits ───────────────────────────────────
  setDollarField(form, F1040_PAGE2.line11b, result.line11.amount)
  setDollarField(form, F1040_PAGE2.line12e, result.line12.amount)
  setDollarField(form, F1040_PAGE2.line13a, result.line13.amount)
  setDollarField(form, F1040_PAGE2.line14, result.line14.amount)
  setDollarField(form, F1040_PAGE2.line15, result.line15.amount)
  setDollarField(form, F1040_PAGE2.line16, result.line16.amount)
  // Lines 17-23 are $0 for MVP
  setDollarField(form, F1040_PAGE2.line18, result.line16.amount) // line 18 = line 16 for MVP
  setDollarField(form, F1040_PAGE2.line22, result.line16.amount) // line 22 = line 18 for MVP
  setDollarField(form, F1040_PAGE2.line24, result.line24.amount)

  // ── Page 2: Payments ────────────────────────────────────────
  setDollarField(form, F1040_PAGE2.line25a, result.line25.amount)
  setDollarField(form, F1040_PAGE2.line25d, result.line25.amount)
  setDollarField(form, F1040_PAGE2.line33, result.line33.amount)

  // ── Page 2: Refund / Owed ───────────────────────────────────
  setDollarField(form, F1040_PAGE2.line34, result.line34.amount)
  if (result.line34.amount > 0) {
    setDollarField(form, F1040_PAGE2.line35a, result.line34.amount)
  }
  setDollarField(form, F1040_PAGE2.line37, result.line37.amount)

  if (flatten) form.flatten()
  return pdfDoc
}
