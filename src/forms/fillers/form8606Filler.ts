/**
 * Form 8606 (Nondeductible IRAs) PDF filler.
 *
 * Part I: Nondeductible contributions and pro-rata rule
 * Part II: Conversions from traditional IRA to Roth
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { Form8606Result } from '../../rules/2025/form8606'
import { F8606_HEADER, F8606_PART1, F8606_PART2 } from '../mappings/form8606Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillForm8606(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: Form8606Result,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, F8606_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F8606_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I — Nondeductible Contributions to Traditional IRAs
  setDollarField(form, F8606_PART1.line1, result.line1)
  setDollarField(form, F8606_PART1.line2, result.line2)
  setDollarField(form, F8606_PART1.line3, result.line3)
  setDollarField(form, F8606_PART1.line4, result.line4)
  setDollarField(form, F8606_PART1.line5, result.line5)
  setDollarField(form, F8606_PART1.line6, result.line6)
  setDollarField(form, F8606_PART1.line7, result.line7)
  setDollarField(form, F8606_PART1.line8, result.line8)
  setDollarField(form, F8606_PART1.line9, result.line9)

  // Line 10: pro-rata ratio as decimal (3 places)
  if (result.line10 > 0) {
    const ratioStr = (result.line10 / 1_000_000).toFixed(3)
    setTextField(form, F8606_PART1.line10, ratioStr)
  }

  setDollarField(form, F8606_PART1.line11, result.line11)
  setDollarField(form, F8606_PART1.line12, result.line12)
  setDollarField(form, F8606_PART1.line13, result.line13)
  setDollarField(form, F8606_PART1.line14, result.line14)

  // Part II — Conversions from Traditional to Roth
  if (result.hasConversion) {
    setDollarField(form, F8606_PART2.line16, result.line16)
    setDollarField(form, F8606_PART2.line17, result.line17)
    setDollarField(form, F8606_PART2.line18, result.line18)
  }

  if (flatten) form.flatten()
  return pdfDoc
}
