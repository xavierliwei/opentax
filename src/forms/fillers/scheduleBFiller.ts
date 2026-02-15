/**
 * Schedule B PDF filler.
 *
 * Lists payer names and amounts for interest (Part I) and dividends (Part II).
 */

import { PDFDocument } from 'pdf-lib'
import type { ScheduleBResult } from '../../rules/2025/scheduleB'
import { SCHB_HEADER, SCHB_INTEREST_ROWS, SCHB_DIVIDEND_ROWS, SCHB_INTEREST_TOTALS, SCHB_DIVIDEND_TOTALS } from '../mappings/scheduleBFields'
import { setTextField, setDollarField, formatSSN } from '../helpers'
import type { TaxReturn } from '../../model/types'

export async function fillScheduleB(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: ScheduleBResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, SCHB_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, SCHB_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I — Interest
  const maxInterest = Math.min(result.interestItems.length, SCHB_INTEREST_ROWS.length)
  for (let i = 0; i < maxInterest; i++) {
    const item = result.interestItems[i]
    const row = SCHB_INTEREST_ROWS[i]
    setTextField(form, row.name, item.payerName)
    setDollarField(form, row.amount, item.amount)
  }
  setDollarField(form, SCHB_INTEREST_TOTALS.line4, result.line4.amount)

  // Part II — Dividends
  const maxDividends = Math.min(result.dividendItems.length, SCHB_DIVIDEND_ROWS.length)
  for (let i = 0; i < maxDividends; i++) {
    const item = result.dividendItems[i]
    const row = SCHB_DIVIDEND_ROWS[i]
    setTextField(form, row.name, item.payerName)
    setDollarField(form, row.amount, item.amount)
  }
  setDollarField(form, SCHB_DIVIDEND_TOTALS.line6, result.line6.amount)

  if (flatten) form.flatten()
  return pdfDoc
}
