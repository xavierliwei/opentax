/**
 * Form 8863 (Education Credits) PDF filler.
 *
 * Part I: Refundable AOTC → Form 1040 Line 29
 * Part II: Nonrefundable education credits → Schedule 3 Line 3
 * Part III: Per-student AOTC detail (up to 2 students on the form)
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { EducationCreditResult } from '../../rules/2025/educationCredit'
import {
  F8863_HEADER, F8863_PART1, F8863_PART2,
  F8863_PAGE2_HEADER, F8863_STUDENT_A, F8863_STUDENT_B,
  F8863_PART3_TOTALS,
} from '../mappings/form8863Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillForm8863(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: EducationCreditResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const ssn = formatSSN(taxReturn.taxpayer.ssn)

  // Page 1 Header
  setTextField(form, F8863_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F8863_HEADER.ssn1, ssn.slice(0, 3))
  setTextField(form, F8863_HEADER.ssn2, ssn.slice(4, 6))
  setTextField(form, F8863_HEADER.ssn3, ssn.slice(7, 11))

  // Part I — Refundable AOTC
  setDollarField(form, F8863_PART1.line1, result.aotcTotalCredit)
  setDollarField(form, F8863_PART1.line4, result.aotcRefundable)

  // Part II — Nonrefundable Education Credits
  setDollarField(form, F8863_PART2.line16, result.llcQualifiedExpenses)
  setDollarField(form, F8863_PART2.line17, result.llcRawCredit)
  setDollarField(form, F8863_PART2.line19, result.totalNonRefundable)
  setDollarField(form, F8863_PART2.line25, result.totalNonRefundable)

  // Page 2 Header
  setTextField(form, F8863_PAGE2_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F8863_PAGE2_HEADER.ssn1, ssn.slice(0, 3))
  setTextField(form, F8863_PAGE2_HEADER.ssn2, ssn.slice(4, 6))
  setTextField(form, F8863_PAGE2_HEADER.ssn3, ssn.slice(7, 11))

  // Part III — Per-student AOTC detail (up to 2 students)
  const students = result.aotcStudents
  if (students.length >= 1) {
    const s = students[0]
    setTextField(form, F8863_STUDENT_A.name, s.studentName)
    setDollarField(form, F8863_STUDENT_A.expenses, s.qualifiedExpenses)
    setDollarField(form, F8863_STUDENT_A.tentativeAOTC, s.rawCredit)
  }
  if (students.length >= 2) {
    const s = students[1]
    setTextField(form, F8863_STUDENT_B.name, s.studentName)
    setDollarField(form, F8863_STUDENT_B.expenses, s.qualifiedExpenses)
    setDollarField(form, F8863_STUDENT_B.tentativeAOTC, s.rawCredit)
  }

  // Part III totals
  setDollarField(form, F8863_PART3_TOTALS.line31, result.aotcTotalCredit)

  if (flatten) form.flatten()
  return pdfDoc
}
