/**
 * Form 1116 (Foreign Tax Credit — Passive Category) PDF filler.
 *
 * Fills Form 1116 from ForeignTaxCreditResult for the passive category
 * portfolio-income path (dividends and interest with foreign tax withheld).
 *
 * This filler is only invoked when:
 *   1. Foreign taxes were paid (result.applicable === true)
 *   2. The direct credit election does NOT apply (taxes > $300/$600 threshold)
 *
 * When the direct credit election applies, the FTC flows directly to
 * Schedule 3 Line 1 without Form 1116.
 *
 * Unsupported scenarios (noted on form):
 *   - General category income
 *   - Multiple category allocations
 *   - Carryback/carryforward
 *   - AMT foreign tax credit
 *   - Treaty-based positions
 *   - High-tax kickout
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { ForeignTaxCreditResult } from '../../rules/2025/foreignTaxCredit'
import {
  F1116_HEADER,
  F1116_INFO,
  F1116_PART1,
  F1116_PART2,
  F1116_PART3,
  F1116_PART4,
} from '../mappings/form1116Fields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillForm1116(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: ForeignTaxCreditResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  const fullName = `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`
  const ssn = formatSSN(taxReturn.taxpayer.ssn)

  // ── Headers (both pages) ──────────────────────────────────
  setTextField(form, F1116_HEADER.p1Name, fullName)
  setTextField(form, F1116_HEADER.p1Ssn, ssn)
  setTextField(form, F1116_HEADER.p2Name, fullName)
  setTextField(form, F1116_HEADER.p2Ssn, ssn)

  // ── Category & Country ────────────────────────────────────
  // List all countries separated by comma
  if (result.countries.length > 0) {
    setTextField(form, F1116_INFO.country, result.countries.join(', '))
  }

  // ── Part I — Foreign-Source Income ────────────────────────
  // Foreign-source income is split into dividends and interest
  // We use foreignSourceIncome for the gross total since the FTC result
  // doesn't break it out by type. Approximate using the tax ratio.
  const divSourceIncome = computeDividendSourceIncome(result)
  const intSourceIncome = result.foreignSourceIncome - divSourceIncome

  setDollarField(form, F1116_PART1.line1aDividends, divSourceIncome)
  setDollarField(form, F1116_PART1.line1aInterest, intSourceIncome)
  setDollarField(form, F1116_PART1.line2, result.foreignSourceIncome)

  // Simplified: no deduction allocation (conservative — full gross income used)
  // Line 3g = gross foreign-source income (no deductions allocated)
  setDollarField(form, F1116_PART1.line3g, result.foreignSourceIncome)

  // ── Part II — Foreign Taxes Paid ──────────────────────────
  setDollarField(form, F1116_PART2.line8Dividends, result.foreignTaxDIV)
  setDollarField(form, F1116_PART2.line8Interest, result.foreignTaxINT)
  setDollarField(form, F1116_PART2.line9, result.totalForeignTaxPaid)
  // Line 10: Carryback/carryover = 0 (not supported)
  setDollarField(form, F1116_PART2.line11, result.totalForeignTaxPaid)
  // Lines 12–13: Reductions = 0 (not applicable for passive portfolio)
  setDollarField(form, F1116_PART2.line14, result.totalForeignTaxPaid)

  // ── Part III — Figuring the Credit ────────────────────────
  setDollarField(form, F1116_PART3.line15, result.foreignSourceIncome)
  // Line 16: Adjustments = 0
  setDollarField(form, F1116_PART3.line17, result.foreignSourceIncome)
  setDollarField(form, F1116_PART3.line18, result.worldwideTaxableIncome)

  // Line 19: Ratio (foreign-source / worldwide) — expressed as decimal
  if (result.worldwideTaxableIncome > 0) {
    const effectiveForeignSource = Math.min(result.foreignSourceIncome, result.worldwideTaxableIncome)
    const ratio = effectiveForeignSource / result.worldwideTaxableIncome
    setTextField(form, F1116_PART3.line19, ratio.toFixed(4))
  }

  setDollarField(form, F1116_PART3.line20, result.usTaxBeforeCredits)
  setDollarField(form, F1116_PART3.line21, result.limitation)

  // Page 2: Part III continued
  // Line 22: Smaller of line 14 (net taxes) or line 21 (limitation)
  setDollarField(form, F1116_PART3.line22, result.creditAmount)
  // Line 23: Reduction for other categories = 0
  setDollarField(form, F1116_PART3.line24, result.creditAmount)
  setDollarField(form, F1116_PART3.line33, result.creditAmount)

  // Line 34: Excess credit (informational)
  setDollarField(form, F1116_PART3.line34, result.excessForeignTax)

  // ── Part IV — Summary ─────────────────────────────────────
  // Only passive category is populated
  setDollarField(form, F1116_PART4.line35, result.creditAmount)
  // Lines 36–37: Other categories = 0 (not supported)
  setDollarField(form, F1116_PART4.line38, result.creditAmount)

  if (flatten) form.flatten()
  return pdfDoc
}

/**
 * Approximate the foreign-source dividend income from the total.
 *
 * Since ForeignTaxCreditResult stores aggregated foreignSourceIncome but
 * not the dividend/interest split, we estimate the dividend portion by
 * using the ratio of dividend foreign taxes to total foreign taxes.
 * This is a reasonable approximation since foreign tax rates on
 * dividends and interest are typically similar.
 */
function computeDividendSourceIncome(result: ForeignTaxCreditResult): number {
  if (result.totalForeignTaxPaid === 0) return 0
  const ratio = result.foreignTaxDIV / result.totalForeignTaxPaid
  return Math.round(result.foreignSourceIncome * ratio)
}
