/**
 * Form 2441 (Child and Dependent Care Expenses) PDF filler.
 *
 * Part III only: Lines 3-11 (credit computation).
 * Skips Part I (qualifying persons detail) and Part II (care providers)
 * since we don't track that level of detail.
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { DependentCareCreditResult } from '../../rules/2025/dependentCareCredit'
import { F2441_HEADER, F2441_PART3 } from '../mappings/form2441Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillForm2441(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: DependentCareCreditResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, F2441_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F2441_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part III — Dependent Care Credit
  // Line 3: Total qualified expenses
  const totalExpenses = taxReturn.dependentCare?.totalExpenses ?? 0
  setDollarField(form, F2441_PART3.line3, totalExpenses)

  // Line 4: Earned income (you) — sum of W-2 Box 1
  const earnedIncome = taxReturn.w2s.reduce((s, w) => s + w.box1, 0)
  setDollarField(form, F2441_PART3.line4, earnedIncome)

  // Line 6: Smallest of lines 3, 4, or 5 (= allowable expenses before limit)
  setDollarField(form, F2441_PART3.line6, result.allowableExpenses)

  // Line 7: Expense limit ($3,000 or $6,000)
  setDollarField(form, F2441_PART3.line7, result.expenseLimit)

  // Line 8: Smaller of line 6 or line 7
  setDollarField(form, F2441_PART3.line8, result.allowableExpenses)

  // Line 9: Credit rate (decimal)
  if (result.creditRate > 0) {
    setTextField(form, F2441_PART3.line9, `.${Math.round(result.creditRate * 100).toString().padStart(2, '0')}`)
  }

  // Line 10: Credit amount (line 8 * line 9)
  setDollarField(form, F2441_PART3.line10, result.creditAmount)

  // Line 11: Tax liability limit — we put the credit amount since the
  // credit is already limited by the rules engine to the tax liability
  setDollarField(form, F2441_PART3.line11, result.creditAmount)

  if (flatten) form.flatten()
  return pdfDoc
}
