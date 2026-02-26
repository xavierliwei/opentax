/**
 * Form 4952 (Investment Interest Expense Deduction) PDF filler.
 *
 * Filled when Schedule A line 9 (investment interest deduction) is claimed.
 * Data comes from TaxReturn model (deductions.itemized) and ScheduleAResult.
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { ScheduleAResult } from '../../rules/2025/scheduleA'
import { F4952_HEADER, F4952_PART1, F4952_PART2, F4952_PART3 } from '../mappings/form4952Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillForm4952(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  scheduleA: ScheduleAResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const d = taxReturn.deductions.itemized

  // Header
  setTextField(form, F4952_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F4952_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I — Total Investment Interest Expense
  const currentInterest = d?.investmentInterest ?? 0
  const priorCarryforward = d?.priorYearInvestmentInterestCarryforward ?? 0
  const totalInterest = currentInterest + priorCarryforward

  setDollarField(form, F4952_PART1.line1, currentInterest)
  setDollarField(form, F4952_PART1.line2, priorCarryforward)
  setDollarField(form, F4952_PART1.line3, totalInterest)

  // Part II — Net Investment Income
  // Line 4g: Total net investment income (from rules)
  // We write the NII that the schedule A computation used to limit the deduction
  const nii = scheduleA.line9.amount + scheduleA.investmentInterestCarryforward.amount
  setDollarField(form, F4952_PART2.line4g, Math.max(0, nii > 0 ? nii : totalInterest - scheduleA.investmentInterestCarryforward.amount))

  // Part III — Deduction
  // Line 5: deductible amount (= Schedule A line 9)
  setDollarField(form, F4952_PART3.line5, scheduleA.line9.amount)

  // Line 8: Investment interest expense deduction → Schedule A line 9
  setDollarField(form, F4952_PART3.line8, scheduleA.line9.amount)

  // Line 9: Carryforward to next year
  setDollarField(form, F4952_PART3.line9, scheduleA.investmentInterestCarryforward.amount)

  if (flatten) form.flatten()
  return pdfDoc
}
