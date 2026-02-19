/**
 * Form 8889 (Health Savings Accounts) PDF filler.
 *
 * Part I: Contributions and deduction → Schedule 1, Line 13
 * Part II: Distributions → taxable amount
 * Part III: Additional tax/penalties → Schedule 2, Part II
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { HSAResult } from '../../rules/2025/hsaDeduction'
import { F8889_HEADER, F8889_PART1, F8889_PART2, F8889_PART3 } from '../mappings/form8889Fields'
import { setTextField, setDollarField, formatSSN, checkBox } from '../helpers'

export async function fillForm8889(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: HSAResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, F8889_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F8889_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Coverage type checkbox
  if (result.coverageType === 'self-only') {
    checkBox(form, F8889_HEADER.selfOnly)
  } else {
    checkBox(form, F8889_HEADER.family)
  }

  // Part I — Contributions and Deduction
  setDollarField(form, F8889_PART1.line2, result.taxpayerContributions)
  setDollarField(form, F8889_PART1.line3, result.employerContributions)
  setDollarField(form, F8889_PART1.line6, result.annualLimit)
  setDollarField(form, F8889_PART1.line7, result.catchUpAmount)
  setDollarField(form, F8889_PART1.line8, result.totalLimit)
  setDollarField(form, F8889_PART1.line9, result.employerContributions)

  // Line 10: max deductible (totalLimit - employerContributions)
  const maxDeductible = Math.max(0, result.totalLimit - result.employerContributions)
  setDollarField(form, F8889_PART1.line10, maxDeductible)

  // Line 11: smaller of contributions or max deductible
  const line11 = Math.min(result.taxpayerContributions, maxDeductible)
  setDollarField(form, F8889_PART1.line11, line11)

  // Line 13: HSA deduction → Schedule 1, Line 13
  setDollarField(form, F8889_PART1.line13, result.deductibleAmount)

  // Part II — Distributions
  setDollarField(form, F8889_PART2.line14a, result.totalDistributions)
  setDollarField(form, F8889_PART2.line14c, result.qualifiedMedicalExpenses)
  setDollarField(form, F8889_PART2.line15, result.taxableDistributions)

  // Part III — Additional Tax
  setDollarField(form, F8889_PART3.line17a, result.distributionPenalty)
  setDollarField(form, F8889_PART3.line20, result.excessPenalty)

  // Total additional tax → Schedule 2
  const totalPenalty = result.distributionPenalty + result.excessPenalty
  setDollarField(form, F8889_PART3.line21, totalPenalty)

  if (flatten) form.flatten()
  return pdfDoc
}
