/**
 * Schedule A PDF filler.
 *
 * Fills itemized deduction lines from ScheduleAResult.
 */

import { PDFDocument } from 'pdf-lib'
import type { ScheduleAResult } from '../../rules/2025/scheduleA'
import { SCHA_HEADER, SCHA_MEDICAL, SCHA_TAXES, SCHA_INTEREST, SCHA_CHARITY, SCHA_OTHER } from '../mappings/scheduleAFields'
import { setTextField, setDollarField, formatSSN } from '../helpers'
import type { TaxReturn } from '../../model/types'

export async function fillScheduleA(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: ScheduleAResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, SCHA_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, SCHA_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Medical (Lines 1-4)
  setDollarField(form, SCHA_MEDICAL.line1, result.line1.amount)
  setDollarField(form, SCHA_MEDICAL.line2, result.line2.amount)
  setDollarField(form, SCHA_MEDICAL.line3, result.line3.amount)
  setDollarField(form, SCHA_MEDICAL.line4, result.line4.amount)

  // SALT (Lines 5a–5e, 7)
  // line5a holds the elected amount (max of income/sales taxes)
  setDollarField(form, SCHA_TAXES.line5a, result.line5a.amount)
  setDollarField(form, SCHA_TAXES.line5c, result.line5b.amount)   // real estate → PDF field 5c
  setDollarField(form, SCHA_TAXES.line5d, result.line5c.amount)   // personal property → PDF field 5d
  setDollarField(form, SCHA_TAXES.line5e, result.line5e.amount)
  setDollarField(form, SCHA_TAXES.line7, result.line7.amount)

  // Interest (Lines 8a, 9, 10)
  setDollarField(form, SCHA_INTEREST.line8a, result.line8a.amount)
  setDollarField(form, SCHA_INTEREST.line9,  result.line9.amount)
  setDollarField(form, SCHA_INTEREST.line10, result.line10.amount)

  // Charitable (Lines 11, 12, 14)
  setDollarField(form, SCHA_CHARITY.line11, result.line11.amount)
  setDollarField(form, SCHA_CHARITY.line12, result.line12.amount)
  setDollarField(form, SCHA_CHARITY.line14, result.line14.amount)

  // Other (Line 16)
  setDollarField(form, SCHA_OTHER.line16, result.line16.amount)

  // Total (Line 17)
  setDollarField(form, SCHA_OTHER.line17, result.line17.amount)

  if (flatten) form.flatten()
  return pdfDoc
}
