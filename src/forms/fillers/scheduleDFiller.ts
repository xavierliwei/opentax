/**
 * Schedule D PDF filler.
 *
 * Fills summary lines from Form 8949 category totals.
 */

import { PDFDocument } from 'pdf-lib'
import type { ScheduleDResult } from '../../rules/2025/scheduleD'
import type { Form8949CategoryTotals } from '../../rules/2025/form8949'
import { SCHD_HEADER, SCHD_SHORT_TERM_TABLE, SCHD_SHORT_TERM, SCHD_LONG_TERM_TABLE, SCHD_LONG_TERM, SCHD_SUMMARY } from '../mappings/scheduleDFields'
import { setTextField, setDollarField, formatSSN } from '../helpers'
import type { TaxReturn } from '../../model/types'

function fillCategoryLine(
  form: any,
  fields: { proceeds: string; basis: string; adjustments: string; gainLoss: string },
  cat: Form8949CategoryTotals | undefined,
): void {
  if (!cat) return
  setDollarField(form, fields.proceeds, cat.totalProceeds.amount)
  setDollarField(form, fields.basis, cat.totalBasis.amount)
  setDollarField(form, fields.adjustments, cat.totalAdjustments.amount)
  setDollarField(form, fields.gainLoss, cat.totalGainLoss.amount)
}

export async function fillScheduleD(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: ScheduleDResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, SCHD_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, SCHD_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I — Short-Term
  fillCategoryLine(form, SCHD_SHORT_TERM_TABLE.line1a, result.form8949.byCategory['A'])
  fillCategoryLine(form, SCHD_SHORT_TERM_TABLE.line1b, result.form8949.byCategory['B'])
  if (result.line5.amount !== 0) setDollarField(form, SCHD_SHORT_TERM.line5, result.line5.amount)
  if (result.line6.amount !== 0) setDollarField(form, SCHD_SHORT_TERM.line6, result.line6.amount)
  setDollarField(form, SCHD_SHORT_TERM.line7, result.line7.amount)

  // Part II — Long-Term
  fillCategoryLine(form, SCHD_LONG_TERM_TABLE.line8a, result.form8949.byCategory['D'])
  fillCategoryLine(form, SCHD_LONG_TERM_TABLE.line8b, result.form8949.byCategory['E'])
  if (result.line12.amount !== 0) setDollarField(form, SCHD_LONG_TERM.line12, result.line12.amount)
  setDollarField(form, SCHD_LONG_TERM.line13, result.line13.amount)
  if (result.line14.amount !== 0) setDollarField(form, SCHD_LONG_TERM.line14, result.line14.amount)
  setDollarField(form, SCHD_LONG_TERM.line15, result.line15.amount)

  // Part III — Summary
  setDollarField(form, SCHD_SUMMARY.line16, result.line16.amount)
  setDollarField(form, SCHD_SUMMARY.line21, result.line21.amount)

  if (flatten) form.flatten()
  return pdfDoc
}
