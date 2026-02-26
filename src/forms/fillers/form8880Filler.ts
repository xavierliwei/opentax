/**
 * Form 8880 (Credit for Qualified Retirement Savings Contributions) PDF filler.
 *
 * Saver's Credit: non-refundable credit for IRA/401(k)/etc. contributions.
 * Rate: 50%, 20%, 10%, or 0% depending on AGI and filing status.
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { SaversCreditResult } from '../../rules/2025/saversCredit'
import { F8880_HEADER, F8880_TABLE, F8880_LINES } from '../mappings/form8880Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillForm8880(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: SaversCreditResult,
  agi: number,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, F8880_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F8880_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  const contributions = taxReturn.retirementContributions

  // Lines 1-3: Contribution detail (you column only)
  if (contributions) {
    setDollarField(form, F8880_TABLE.line1You, contributions.traditionalIRA)
    setDollarField(form, F8880_TABLE.line2You, contributions.rothIRA)
  }
  setDollarField(form, F8880_TABLE.line3You, result.electiveDeferrals)

  // Line 4: Total contributions (you)
  setDollarField(form, F8880_TABLE.line4You, result.totalContributions)

  // Line 6: Net contributions after distributions (= total, we don't track distributions)
  setDollarField(form, F8880_TABLE.line6You, result.totalContributions)

  // Line 7: Eligible contributions (capped at $2K/$4K)
  setDollarField(form, F8880_LINES.line7, result.eligibleContributions)

  // Line 8: AGI
  setDollarField(form, F8880_LINES.line8, agi)

  // Line 10: Credit rate (decimal, e.g., ".50")
  if (result.creditRate > 0) {
    setTextField(form, F8880_LINES.line10, `.${Math.round(result.creditRate * 100).toString().padStart(2, '0')}`)
  }

  // Line 11: Credit amount (line 7 * line 10)
  setDollarField(form, F8880_LINES.line11, result.creditAmount)

  // Line 12: Tax liability limit — credit is already limited by rules engine
  setDollarField(form, F8880_LINES.line12, result.creditAmount)

  if (flatten) form.flatten()
  return pdfDoc
}
