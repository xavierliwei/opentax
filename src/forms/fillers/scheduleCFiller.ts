/**
 * Schedule C (Profit or Loss From Business) — PDF filler.
 *
 * Fills a single Schedule C form for one business. The compiler calls
 * this once per business in the ScheduleCAggregateResult.
 *
 * Maps ScheduleC (input data) + ScheduleCResult (computed values) onto
 * the IRS Schedule C PDF template fields.
 */

import { PDFDocument } from 'pdf-lib'
import type { ScheduleC, TaxReturn } from '../../model/types'
import type { ScheduleCResult } from '../../rules/2025/scheduleC'
import {
  SCHC_HEADER,
  SCHC_BUSINESS,
  SCHC_METHOD,
  SCHC_INCOME,
  SCHC_EXPENSES,
  SCHC_SUMMARY,
} from '../mappings/scheduleCFields'
import { setTextField, setDollarField, checkBox, formatSSN } from '../helpers'

export async function fillScheduleC(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  business: ScheduleC,
  result: ScheduleCResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Determine whose SSN to use (taxpayer or spouse)
  const owner = business.owner === 'spouse' && taxReturn.spouse
    ? taxReturn.spouse
    : taxReturn.taxpayer

  // ── Header ──────────────────────────────────────────────────
  setTextField(form, SCHC_HEADER.name, `${owner.firstName} ${owner.lastName}`)
  setTextField(form, SCHC_HEADER.ssn, formatSSN(owner.ssn))

  // ── Business Info (Lines A–F) ────────────────────────────────
  setTextField(form, SCHC_BUSINESS.lineB, business.principalBusinessCode)
  setTextField(form, SCHC_BUSINESS.lineC, business.businessName)
  if (business.businessEin) {
    setTextField(form, SCHC_BUSINESS.lineD, business.businessEin)
  }

  // Accounting method checkbox
  if (business.accountingMethod === 'cash') {
    checkBox(form, SCHC_METHOD.cash)
  } else if (business.accountingMethod === 'accrual') {
    checkBox(form, SCHC_METHOD.accrual)
  }

  // ── Part I — Income ──────────────────────────────────────────
  setDollarField(form, SCHC_INCOME.line1, business.grossReceipts)
  setDollarField(form, SCHC_INCOME.line2, business.returns)

  // IRS Line 3 = receipts − returns (before COGS)
  const irsLine3 = business.grossReceipts - business.returns
  setDollarField(form, SCHC_INCOME.line3, irsLine3)

  setDollarField(form, SCHC_INCOME.line4, business.costOfGoodsSold)

  // IRS Line 5 = Line 3 − Line 4 = gross profit (same as rules engine line3)
  setDollarField(form, SCHC_INCOME.line5, result.line3.amount)
  // Line 6 = Other income (not supported — always 0)
  // Line 7 = Gross income (same as line 5 on simplified path)
  setDollarField(form, SCHC_INCOME.line7, result.line7.amount)

  // ── Part II — Expenses ───────────────────────────────────────
  setDollarField(form, SCHC_EXPENSES.line8, business.advertising)
  setDollarField(form, SCHC_EXPENSES.line9, business.carAndTruck)
  setDollarField(form, SCHC_EXPENSES.line10, business.commissions)
  setDollarField(form, SCHC_EXPENSES.line11, business.contractLabor)
  setDollarField(form, SCHC_EXPENSES.line13, business.depreciation)
  setDollarField(form, SCHC_EXPENSES.line15, business.insurance)
  setDollarField(form, SCHC_EXPENSES.line16a, business.mortgageInterest)
  setDollarField(form, SCHC_EXPENSES.line16b, business.otherInterest)
  setDollarField(form, SCHC_EXPENSES.line17, business.legal)
  setDollarField(form, SCHC_EXPENSES.line18, business.officeExpense)
  setDollarField(form, SCHC_EXPENSES.line20b, business.rent)
  setDollarField(form, SCHC_EXPENSES.line21, business.repairs)
  setDollarField(form, SCHC_EXPENSES.line22, business.supplies)
  setDollarField(form, SCHC_EXPENSES.line23, business.taxes)
  setDollarField(form, SCHC_EXPENSES.line24a, business.travel)

  // Meals are 50% deductible — show the deductible portion on line 24b
  const mealsDeductible = Math.round(business.meals * 0.50)
  setDollarField(form, SCHC_EXPENSES.line24b, mealsDeductible)

  setDollarField(form, SCHC_EXPENSES.line25, business.utilities)
  setDollarField(form, SCHC_EXPENSES.line26, business.wages)
  setDollarField(form, SCHC_EXPENSES.line27a, business.otherExpenses)

  // ── Summary (Lines 28–31) ────────────────────────────────────
  setDollarField(form, SCHC_SUMMARY.line28, result.line28.amount)
  // Line 29 = Tentative profit: line 7 − line 28
  setDollarField(form, SCHC_SUMMARY.line29, result.line7.amount - result.line28.amount)
  // Line 30 = Business use of home (not supported — always 0)
  // Line 31 = Net profit or (loss)
  setDollarField(form, SCHC_SUMMARY.line31, result.line31.amount)

  if (flatten) form.flatten()
  return pdfDoc
}
