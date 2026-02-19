/**
 * Form 8812 (Credits for Qualifying Children and Other Dependents) PDF filler.
 *
 * Fills the CTC/ACTC worksheet from ChildTaxCreditResult.
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { ChildTaxCreditResult } from '../../rules/2025/childTaxCredit'
import { F8812_HEADER, F8812_PART1 } from '../mappings/form8812Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillForm8812(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: ChildTaxCreditResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, F8812_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F8812_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I-A: Child Tax Credit computation
  setTextField(form, F8812_PART1.line1, String(result.numQualifyingChildren))
  setTextField(form, F8812_PART1.line2, String(result.numOtherDependents))

  // $2,000 × qualifying children
  const line3 = result.numQualifyingChildren * 200000
  setDollarField(form, F8812_PART1.line3, line3)

  // $500 × other dependents
  const line4 = result.numOtherDependents * 50000
  setDollarField(form, F8812_PART1.line4, line4)

  // Initial credit
  setDollarField(form, F8812_PART1.line5, result.initialCredit)

  // Phase-out reduction
  setDollarField(form, F8812_PART1.line10, result.phaseOutReduction)

  // Credit after phase-out
  setDollarField(form, F8812_PART1.line11, result.creditAfterPhaseOut)

  // Non-refundable credit → Form 1040 Line 19
  setDollarField(form, F8812_PART1.line18, result.nonRefundableCredit)

  // Additional CTC → Form 1040 Line 28
  setDollarField(form, F8812_PART1.line28, result.additionalCTC)

  if (flatten) form.flatten()
  return pdfDoc
}
