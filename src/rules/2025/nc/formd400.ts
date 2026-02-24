/**
 * North Carolina Form D-400 — Individual Income Tax Return
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { NC_FLAT_TAX_RATE, NC_STANDARD_DEDUCTION } from './constants'

export interface FormD400Result {
  federalAGI: number
  ncAdditions: number
  ncDeductions: number
  ncAGI: number

  standardDeduction: number
  ncTaxableIncome: number
  ncTax: number

  taxAfterCredits: number

  stateWithholding: number
  totalPayments: number

  overpaid: number
  amountOwed: number

  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  ncSourceIncome?: number
}

export function computeNCApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
  if (config.residencyType === 'full-year') return 1
  if (config.residencyType === 'nonresident') return 0

  const daysInYear = isLeapYear(taxYear) ? 366 : 365
  const yearStart = Date.UTC(taxYear, 0, 1)
  const yearEnd = Date.UTC(taxYear, 11, 31)
  const dayMs = 86400000

  let start = yearStart
  let end = yearEnd

  if (config.moveInDate) {
    const [y, m, d] = config.moveInDate.split('-').map(Number)
    const parsed = Date.UTC(y, m - 1, d)
    if (!Number.isNaN(parsed)) start = parsed
  }

  if (config.moveOutDate) {
    const [y, m, d] = config.moveOutDate.split('-').map(Number)
    const parsed = Date.UTC(y, m - 1, d)
    if (!Number.isNaN(parsed)) end = parsed
  }

  if (start < yearStart) start = yearStart
  if (end > yearEnd) end = yearEnd
  if (end < start) return 0

  const daysInState = Math.round((end - start) / dayMs) + 1
  return Math.min(1, Math.max(0, daysInState / daysInYear))
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function computeFormD400(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): FormD400Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeNCApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount
  const ncAdditions = 0
  const ncDeductions = 0
  const ncAGI = federalAGI + ncAdditions - ncDeductions

  const standardDeduction = NC_STANDARD_DEDUCTION[model.filingStatus]
  const ncTaxableIncome = Math.max(0, ncAGI - standardDeduction)

  const fullYearTax = Math.round(ncTaxableIncome * NC_FLAT_TAX_RATE)
  const ncTax = ratio < 1 ? Math.round(fullYearTax * ratio) : fullYearTax

  const taxAfterCredits = ncTax

  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'NC' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const ncSourceIncome = ratio < 1 ? Math.round(ncAGI * ratio) : undefined

  return {
    federalAGI,
    ncAdditions,
    ncDeductions,
    ncAGI,
    standardDeduction,
    ncTaxableIncome,
    ncTax,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    ncSourceIncome,
  }
}
