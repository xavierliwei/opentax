/**
 * Schedule 3 (Additional Credits and Payments) PDF filler.
 *
 * Part I: Nonrefundable credits → Form 1040 Line 20
 * Part II: Other payments and refundable credits → Form 1040 Line 31
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { Form1040Result } from '../../rules/2025/form1040'
import { SCH3_HEADER, SCH3_PART1 } from '../mappings/schedule3Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillSchedule3(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: Form1040Result,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, SCH3_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, SCH3_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I — Nonrefundable Credits
  let totalNonrefundable = 0

  // Line 2: Dependent care credit (Form 2441)
  if (result.dependentCareCredit) {
    setDollarField(form, SCH3_PART1.line2, result.dependentCareCredit.creditAmount)
    totalNonrefundable += result.dependentCareCredit.creditAmount
  }

  // Line 3: Education credits (Form 8863, nonrefundable portion)
  if (result.educationCredit) {
    setDollarField(form, SCH3_PART1.line3, result.educationCredit.totalNonRefundable)
    totalNonrefundable += result.educationCredit.totalNonRefundable
  }

  // Line 4: Saver's credit (Form 8880)
  if (result.saversCredit) {
    setDollarField(form, SCH3_PART1.line4, result.saversCredit.creditAmount)
    totalNonrefundable += result.saversCredit.creditAmount
  }

  // Line 5a: Residential energy credit (Form 5695)
  if (result.energyCredit) {
    setDollarField(form, SCH3_PART1.line5a, result.energyCredit.totalCredit)
    totalNonrefundable += result.energyCredit.totalCredit
  }

  // Line 8: Total nonrefundable credits → Form 1040 Line 20
  setDollarField(form, SCH3_PART1.line8, totalNonrefundable)

  if (flatten) form.flatten()
  return pdfDoc
}
