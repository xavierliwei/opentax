/**
 * Form 8582 (Passive Activity Loss Limitations) PDF filler.
 *
 * Part I:  Passive activity loss computation (lines 1–4)
 * Part II: Special allowance for rental real estate (lines 5–10)
 * Part III: Total allowed losses (summary)
 *
 * Sequence number: 88 (per IRS attachment sequence)
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { Form8582Result } from '../../rules/2025/form8582'
import { F8582_HEADER, F8582_PART1, F8582_PART2, F8582_PART3 } from '../mappings/form8582Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillForm8582(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: Form8582Result,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, F8582_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F8582_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I — 2025 Passive Activity Loss
  setDollarField(form, F8582_PART1.line1a, result.line1a)   // net loss (negative)
  setDollarField(form, F8582_PART1.line1b, result.line1b)   // net income (positive)
  setDollarField(form, F8582_PART1.line1c, result.line1c)   // combine
  // Lines 2a–2c: not applicable (no non-rental passive activities in our scope)
  setDollarField(form, F8582_PART1.line3, result.line3)     // combine 1c + 2c
  // Line 4: if line 3 is a loss, enter as positive
  if (result.line4 < 0) {
    setDollarField(form, F8582_PART1.line4, Math.abs(result.line4))
  }

  // Part II — Special Allowance for Rental Real Estate
  setDollarField(form, F8582_PART2.line5, result.line5)
  setDollarField(form, F8582_PART2.line6, result.line6)
  setDollarField(form, F8582_PART2.line7, result.line7)
  setDollarField(form, F8582_PART2.line8, result.line8)
  setDollarField(form, F8582_PART2.line9, result.line9)
  setDollarField(form, F8582_PART2.line10, result.line10)

  // Part III — Total Allowed Losses (simplified)
  // Line 11: combine losses from lines 1c and 2c (only active participation rental)
  if (result.line1c < 0) {
    setDollarField(form, F8582_PART3.line11, Math.abs(result.line1c))
  }
  // Line 12: amount from line 10 (special allowance)
  setDollarField(form, F8582_PART3.line12, result.line10)
  // Line 16: total allowed losses = allowable loss amount
  if (result.allowableLoss > 0) {
    setDollarField(form, F8582_PART3.line16, result.allowableLoss)
  }

  if (flatten) form.flatten()
  return pdfDoc
}
