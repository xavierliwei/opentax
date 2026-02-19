/**
 * Schedule 2 (Additional Taxes) PDF filler.
 *
 * Part I: AMT (from Form 6251) → Form 1040 Line 17
 * Part II: HSA penalties and other taxes → Form 1040 Line 23
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { AMTResult } from '../../rules/2025/amt'
import type { HSAResult } from '../../rules/2025/hsaDeduction'
import { SCH2_HEADER, SCH2_PART1, SCH2_PART2 } from '../mappings/schedule2Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillSchedule2(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  amtResult: AMTResult | null,
  hsaResult: HSAResult | null,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, SCH2_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, SCH2_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I — AMT
  let partITotal = 0
  if (amtResult && amtResult.amt > 0) {
    setDollarField(form, SCH2_PART1.line1, amtResult.amt)
    partITotal += amtResult.amt
  }
  setDollarField(form, SCH2_PART1.line3, partITotal)
  setDollarField(form, SCH2_PART1.line4, partITotal)

  // Part II — Other Taxes
  let partIITotal = 0
  if (hsaResult) {
    const hsaPenalty = hsaResult.distributionPenalty + hsaResult.excessPenalty
    if (hsaPenalty > 0) {
      setDollarField(form, SCH2_PART2.line8, hsaPenalty)
      partIITotal += hsaPenalty
    }
  }
  setDollarField(form, SCH2_PART2.line21, partIITotal)

  if (flatten) form.flatten()
  return pdfDoc
}
