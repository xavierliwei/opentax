/**
 * Form 6251 (Alternative Minimum Tax — Individuals) PDF filler.
 *
 * Part I: AMTI computation (taxable income + adjustments)
 * Part II: Exemption and phase-out
 * Part III: Tentative minimum tax, regular tax, AMT → Schedule 2 Line 1
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { AMTResult } from '../../rules/2025/amt'
import { F6251_HEADER, F6251_PART1, F6251_PART2, F6251_PART3 } from '../mappings/form6251Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillForm6251(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: AMTResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, F6251_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, F6251_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Part I — Alternative Minimum Taxable Income
  setDollarField(form, F6251_PART1.line1, result.line1_taxableIncome)
  setDollarField(form, F6251_PART1.line2a, result.line2a_saltAddBack)
  setDollarField(form, F6251_PART1.line2g, result.line2g_privateActivityBondInterest)
  setDollarField(form, F6251_PART1.line2i, result.line2i_isoSpread)
  setDollarField(form, F6251_PART1.line4, result.line4_amti)

  // Part II — Exemption and Phase-Out
  setDollarField(form, F6251_PART2.line5, result.line5_exemption)
  setDollarField(form, F6251_PART2.line8, result.line8_phaseOutReduction)
  setDollarField(form, F6251_PART2.line9, result.line9_reducedExemption)
  setDollarField(form, F6251_PART2.line10, result.line10_amtiAfterExemption)

  // Part III — Tax Computation (bottom of form)
  setDollarField(form, F6251_PART3.line39, result.tentativeMinimumTax)
  setDollarField(form, F6251_PART3.line40, result.regularTax)
  setDollarField(form, F6251_PART3.line42, result.amt)

  if (flatten) form.flatten()
  return pdfDoc
}
