/**
 * Form 8960 (Net Investment Income Tax) PDF filler.
 *
 * NIIT: 3.8% tax on the lesser of net investment income or
 * MAGI excess above threshold ($200K single, $250K MFJ).
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { NIITResult } from '../../rules/2025/form1040'
import { NIIT_THRESHOLD } from '../../rules/2025/constants'
import { F8960_HEADER, F8960_CHECKBOXES, F8960_PART1, F8960_PART2, F8960_PART3 } from '../mappings/form8960Fields'
import { setTextField, setDollarField, formatSSN, checkBox } from '../helpers'

export async function fillForm8960(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: NIITResult,
  agi: number,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, F8960_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F8960_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Check "Individual" box
  checkBox(form, F8960_CHECKBOXES.individual)

  // Part I — Net Investment Income
  // Break down NII into component lines
  const taxableInterest = taxReturn.form1099INTs.reduce((s, f) => s + f.box1, 0)
  const ordinaryDividends = taxReturn.form1099DIVs.reduce((s, f) => s + f.box1a, 0)

  setDollarField(form, F8960_PART1.line1, taxableInterest)
  setDollarField(form, F8960_PART1.line2, ordinaryDividends)

  // Line 8: Total NII
  setDollarField(form, F8960_PART1.line8, result.nii)

  // Part II — Modified Adjusted Gross Income
  const threshold = NIIT_THRESHOLD[taxReturn.filingStatus]
  setDollarField(form, F8960_PART2.line9a, agi)
  setDollarField(form, F8960_PART2.line9b, threshold)
  setDollarField(form, F8960_PART2.line9c, result.magiExcess)

  // Line 9d: Smaller of line 8 (NII) or line 9c (MAGI excess)
  const taxBase = Math.min(result.nii, result.magiExcess)
  setDollarField(form, F8960_PART2.line9d, taxBase)

  // Part III — Tax Computation
  setDollarField(form, F8960_PART3.line10, result.niitAmount)

  if (flatten) form.flatten()
  return pdfDoc
}
