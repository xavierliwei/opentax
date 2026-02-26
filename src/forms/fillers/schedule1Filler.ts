/**
 * Schedule 1 (Additional Income and Adjustments to Income) PDF filler.
 *
 * Fills Part I (additional income from Schedule E, etc.) and
 * Part II (adjustments: educator expenses, HSA, IRA, student loan, SE plans, SE health insurance).
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { Schedule1Result } from '../../rules/2025/schedule1'
import type { IRADeductionResult } from '../../rules/2025/iraDeduction'
import type { HSAResult } from '../../rules/2025/hsaDeduction'
import type { StudentLoanDeductionResult } from '../../rules/2025/studentLoanDeduction'
import type { EducatorExpensesResult, SESepSimpleResult, SEHealthInsuranceResult } from '../../rules/2025/schedule1Adjustments'
import { SCH1_HEADER, SCH1_PART1, SCH1_PART2 } from '../mappings/schedule1Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillSchedule1(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  schedule1: Schedule1Result,
  iraDeduction: IRADeductionResult | null,
  hsaResult: HSAResult | null,
  studentLoanDeduction: StudentLoanDeductionResult | null,
  educatorExpenses: EducatorExpensesResult | null = null,
  seSepSimple: SESepSimpleResult | null = null,
  seHealthInsurance: SEHealthInsuranceResult | null = null,
  seDeductibleHalf: number = 0,
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
  setDollarField(form, SCH1_PART1.line1, schedule1.line1.amount)       // Taxable refunds
  setDollarField(form, SCH1_PART1.line2a, schedule1.line2a.amount)     // Alimony received
  setDollarField(form, SCH1_PART1.line3, schedule1.line3.amount)       // Business income
  setDollarField(form, SCH1_PART1.line5, schedule1.line5.amount)       // Rental/royalty (Schedule E)
  setDollarField(form, SCH1_PART1.line7, schedule1.line7.amount)       // Unemployment compensation
  setDollarField(form, SCH1_PART1.line8z, schedule1.line8z.amount)     // Other income
  setDollarField(form, SCH1_PART1.line10, schedule1.line10.amount)     // Total additional income

  // Part II — Adjustments to Income
  if (educatorExpenses) {
    setDollarField(form, SCH1_PART2.line11, educatorExpenses.totalDeduction)
  }
  if (hsaResult) {
    setDollarField(form, SCH1_PART2.line13, hsaResult.deductibleAmount)
  }
  if (seDeductibleHalf > 0) {
    setDollarField(form, SCH1_PART2.line15, seDeductibleHalf)
  }
  if (seSepSimple) {
    setDollarField(form, SCH1_PART2.line16, seSepSimple.deductibleAmount)
  }
  if (seHealthInsurance) {
    setDollarField(form, SCH1_PART2.line17, seHealthInsurance.deductibleAmount)
  }
  if (iraDeduction) {
    setDollarField(form, SCH1_PART2.line20, iraDeduction.deductibleAmount)
  }
  if (studentLoanDeduction) {
    setDollarField(form, SCH1_PART2.line21, studentLoanDeduction.deductibleAmount)
  }

  // Total adjustments (sum of all Part II lines)
  const totalAdjustments =
    (educatorExpenses?.totalDeduction ?? 0) +
    (hsaResult?.deductibleAmount ?? 0) +
    seDeductibleHalf +
    (seSepSimple?.deductibleAmount ?? 0) +
    (seHealthInsurance?.deductibleAmount ?? 0) +
    (iraDeduction?.deductibleAmount ?? 0) +
    (studentLoanDeduction?.deductibleAmount ?? 0)
  setDollarField(form, SCH1_PART2.line26, totalAdjustments)

  if (flatten) form.flatten()
  return pdfDoc
}
