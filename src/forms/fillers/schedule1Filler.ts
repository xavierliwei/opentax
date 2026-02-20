/**
 * Schedule 1 (Additional Income and Adjustments to Income) PDF filler.
 *
 * Fills Part I (additional income from Schedule E, etc.) and
 * Part II (adjustments: HSA, IRA, student loan).
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { Schedule1Result } from '../../rules/2025/schedule1'
import type { IRADeductionResult } from '../../rules/2025/iraDeduction'
import type { HSAResult } from '../../rules/2025/hsaDeduction'
import type { StudentLoanDeductionResult } from '../../rules/2025/studentLoanDeduction'
import { SCH1_HEADER, SCH1_PART1, SCH1_PART2 } from '../mappings/schedule1Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillSchedule1(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  schedule1: Schedule1Result,
  iraDeduction: IRADeductionResult | null,
  hsaResult: HSAResult | null,
  studentLoanDeduction: StudentLoanDeductionResult | null,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, SCH1_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, SCH1_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I — Additional Income
  setDollarField(form, SCH1_PART1.line1, schedule1.line1.amount)     // Taxable refunds
  setDollarField(form, SCH1_PART1.line5, schedule1.line5.amount)     // Rental/royalty (Schedule E)
  setDollarField(form, SCH1_PART1.line7, schedule1.line7.amount)     // Unemployment compensation
  setDollarField(form, SCH1_PART1.line8z, schedule1.line8z.amount)   // Other income
  setDollarField(form, SCH1_PART1.line10, schedule1.line10.amount)   // Total additional income

  // Part II — Adjustments to Income
  if (hsaResult) {
    setDollarField(form, SCH1_PART2.line13, hsaResult.deductibleAmount)
  }
  if (iraDeduction) {
    setDollarField(form, SCH1_PART2.line20, iraDeduction.deductibleAmount)
  }
  if (studentLoanDeduction) {
    setDollarField(form, SCH1_PART2.line21, studentLoanDeduction.deductibleAmount)
  }

  // Total adjustments (sum of all Part II lines)
  const totalAdjustments =
    (hsaResult?.deductibleAmount ?? 0) +
    (iraDeduction?.deductibleAmount ?? 0) +
    (studentLoanDeduction?.deductibleAmount ?? 0)
  setDollarField(form, SCH1_PART2.line26, totalAdjustments)

  if (flatten) form.flatten()
  return pdfDoc
}
