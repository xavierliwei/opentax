/**
 * Form 8959 (Additional Medicare Tax) PDF filler.
 *
 * Part I: Medicare wages above threshold → 0.9% additional tax
 * Part IV: Withholding reconciliation → excess Medicare withholding credit
 *
 * Parts II (self-employment) and III (railroad) are skipped — not relevant
 * for most filers.
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { AdditionalMedicareTaxResult } from '../../rules/2025/form1040'
import { MEDICARE_TAX_RATE } from '../../rules/2025/constants'
import { F8959_HEADER, F8959_PART1, F8959_PART3, F8959_PART4 } from '../mappings/form8959Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillForm8959(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: AdditionalMedicareTaxResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, F8959_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F8959_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I — Additional Medicare Tax on Medicare Wages
  setDollarField(form, F8959_PART1.line1, result.medicareWages)
  // Lines 2-3 skipped (unreported tips / railroad)
  setDollarField(form, F8959_PART1.line4, result.medicareWages)
  setDollarField(form, F8959_PART1.line5, result.threshold)
  setDollarField(form, F8959_PART1.line6, result.excessWages)
  setDollarField(form, F8959_PART1.line7, result.additionalTax)

  // Line 18: Total additional Medicare Tax (only Part I for wage earners)
  setDollarField(form, F8959_PART3.line18, result.additionalTax)

  // Part IV — Withholding Reconciliation
  const medicareWithheld = taxReturn.w2s.reduce((s, w) => s + w.box6, 0)
  setDollarField(form, F8959_PART4.line19, medicareWithheld)

  // Line 20: Regular Medicare tax = 1.45% * Medicare wages
  const regularMedicare = Math.round(result.medicareWages * MEDICARE_TAX_RATE)
  setDollarField(form, F8959_PART4.line20, regularMedicare)

  // Line 22: Excess withholding (line 19 - line 20, but >= 0)
  const excessWithholding = Math.max(0, medicareWithheld - regularMedicare)
  setDollarField(form, F8959_PART4.line22, excessWithholding)

  // Line 24: Additional Medicare Tax withholding credit
  setDollarField(form, F8959_PART4.line24, result.withholdingCredit)

  if (flatten) form.flatten()
  return pdfDoc
}
