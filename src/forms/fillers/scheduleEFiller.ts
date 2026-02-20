/**
 * Schedule E (Supplemental Income and Loss) Part I — PDF filler.
 *
 * Fills per-property income/expenses (up to 3 properties) and
 * summary lines 23a–26 from the ScheduleE computation result.
 *
 * Handles up to 3 properties on a single form. Additional pages
 * for >3 properties are not yet supported.
 */

import { PDFDocument } from 'pdf-lib'
import type { ScheduleEResult } from '../../rules/2025/scheduleE'
import { getEffectiveDepreciation } from '../../rules/2025/scheduleE'
import type { TaxReturn, ScheduleEPropertyType } from '../../model/types'
import {
  SCHE_HEADER,
  SCHE_ADDRESS,
  SCHE_TYPE,
  SCHE_DAYS,
  SCHE_INCOME,
  SCHE_EXPENSES,
  SCHE_SUMMARY,
} from '../mappings/scheduleEFields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

/** Map our property type to IRS code 1–8 */
const PROPERTY_TYPE_CODE: Record<ScheduleEPropertyType, string> = {
  'single-family': '1',
  'multi-family': '2',
  'vacation': '3',
  'commercial': '4',
  'land': '5',
  'royalties': '6',
  'other': '8',
}

export async function fillScheduleE(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: ScheduleEResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Header
  setTextField(form, SCHE_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, SCHE_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Fill up to 3 properties
  const properties = taxReturn.scheduleEProperties ?? []
  const count = Math.min(properties.length, 3)

  for (let i = 0; i < count; i++) {
    const p = properties[i]
    const pr = result.properties[i]

    // Line 1a — address
    setTextField(form, SCHE_ADDRESS[i], p.address)

    // Line 1b — property type code
    setTextField(form, SCHE_TYPE[i], PROPERTY_TYPE_CODE[p.propertyType])

    // Line 2 — fair rental days / personal use days
    if (p.fairRentalDays > 0) setTextField(form, SCHE_DAYS[i].fair, String(p.fairRentalDays))
    if (p.personalUseDays > 0) setTextField(form, SCHE_DAYS[i].personal, String(p.personalUseDays))

    // Line 3 — rents received
    setDollarField(form, SCHE_INCOME.line3[i], p.rentsReceived)

    // Line 4 — royalties received
    setDollarField(form, SCHE_INCOME.line4[i], p.royaltiesReceived)

    // Lines 5–18 — individual expenses
    setDollarField(form, SCHE_EXPENSES.line5[i], p.advertising)
    setDollarField(form, SCHE_EXPENSES.line6[i], p.auto)
    setDollarField(form, SCHE_EXPENSES.line7[i], p.cleaning)
    setDollarField(form, SCHE_EXPENSES.line8[i], p.commissions)
    setDollarField(form, SCHE_EXPENSES.line9[i], p.insurance)
    setDollarField(form, SCHE_EXPENSES.line10[i], p.legal)
    setDollarField(form, SCHE_EXPENSES.line11[i], p.management)
    setDollarField(form, SCHE_EXPENSES.line12[i], p.mortgageInterest)
    setDollarField(form, SCHE_EXPENSES.line13[i], p.otherInterest)
    setDollarField(form, SCHE_EXPENSES.line14[i], p.repairs)
    setDollarField(form, SCHE_EXPENSES.line15[i], p.supplies)
    setDollarField(form, SCHE_EXPENSES.line16[i], p.taxes)
    setDollarField(form, SCHE_EXPENSES.line17[i], p.utilities)
    setDollarField(form, SCHE_EXPENSES.line18[i], getEffectiveDepreciation(p))
    setDollarField(form, SCHE_EXPENSES.line19[i], p.other)

    // Line 20 — total expenses
    setDollarField(form, SCHE_EXPENSES.line20[i], pr.expenses.amount)

    // Line 21 — net income/loss (income minus expenses)
    setDollarField(form, SCHE_EXPENSES.line21[i], pr.netIncome.amount)
  }

  // ── Summary lines ──────────────────────────────────────────

  // Lines 23a–e: cross-property totals
  const totalRents = properties.reduce((s, p) => s + p.rentsReceived, 0)
  const totalRoyalties = properties.reduce((s, p) => s + p.royaltiesReceived, 0)
  const totalMortgageInt = properties.reduce((s, p) => s + p.mortgageInterest, 0)
  const totalDepreciation = properties.reduce((s, p) => s + getEffectiveDepreciation(p), 0)
  const totalExpenses = result.properties.reduce((s, pr) => s + pr.expenses.amount, 0)

  setDollarField(form, SCHE_SUMMARY.line23a, totalRents)
  setDollarField(form, SCHE_SUMMARY.line23b, totalRoyalties)
  setDollarField(form, SCHE_SUMMARY.line23c, totalMortgageInt)
  setDollarField(form, SCHE_SUMMARY.line23d, totalDepreciation)
  setDollarField(form, SCHE_SUMMARY.line23e, totalExpenses)

  // Line 24 — income (sum of positive net amounts from line 21)
  const incomeOnly = result.properties.reduce(
    (s, pr) => s + Math.max(0, pr.netIncome.amount), 0,
  )
  setDollarField(form, SCHE_SUMMARY.line24, incomeOnly)

  // Line 25 — losses (after PAL limitation)
  setDollarField(form, SCHE_SUMMARY.line25, result.line25.amount)

  // Line 26 — total to Schedule 1
  setDollarField(form, SCHE_SUMMARY.line26, result.line26.amount)

  if (flatten) form.flatten()
  return pdfDoc
}
