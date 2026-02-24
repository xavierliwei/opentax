import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeBracketTax } from '../taxComputation'
import { DC_COMMUTER_EXEMPT_STATES, DC_STANDARD_DEDUCTION, DC_TAX_BRACKETS } from './constants'

export interface FormD40Result {
  federalAGI: number
  dcAGI: number
  dcStandardDeduction: number
  dcItemizedDeduction: number
  deductionMethod: 'standard' | 'itemized'
  deductionUsed: number
  dcTaxableIncome: number
  dcTax: number
  taxAfterCredits: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  dcSourceIncome?: number
  commuterExempt: boolean
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function computeApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
  if (config.residencyType === 'full-year') return 1
  if (config.residencyType === 'nonresident') return 0

  const daysInYear = isLeapYear(taxYear) ? 366 : 365
  const yearStartMs = Date.UTC(taxYear, 0, 1)
  const yearEndMs = Date.UTC(taxYear, 11, 31)
  const MS_PER_DAY = 86400000

  let startMs = yearStartMs
  let endMs = yearEndMs
  if (config.moveInDate) {
    const [y, m, d] = config.moveInDate.split('-').map(Number)
    const ms = Date.UTC(y, m - 1, d)
    if (!isNaN(ms)) startMs = ms
  }
  if (config.moveOutDate) {
    const [y, m, d] = config.moveOutDate.split('-').map(Number)
    const ms = Date.UTC(y, m - 1, d)
    if (!isNaN(ms)) endMs = ms
  }

  if (startMs < yearStartMs) startMs = yearStartMs
  if (endMs > yearEndMs) endMs = yearEndMs
  if (endMs < startMs) return 0

  const daysInState = Math.round((endMs - startMs) / MS_PER_DAY) + 1
  return Math.min(1, Math.max(0, daysInState / daysInYear))
}

function isDCCommuterExempt(model: TaxReturn, config: StateReturnConfig): boolean {
  if (config.residencyType !== 'nonresident') return false
  const commuterState = config.dcCommuterResidentState
    ?? (DC_COMMUTER_EXEMPT_STATES.has(model.taxpayer.address.state) ? model.taxpayer.address.state : 'OTHER')
  return commuterState === 'MD' || commuterState === 'VA'
}

export function computeFormD40(model: TaxReturn, form1040: Form1040Result, config: StateReturnConfig): FormD40Result {
  const ratio = computeApportionmentRatio(config, model.taxYear)
  const commuterExempt = isDCCommuterExempt(model, config)

  const federalAGI = form1040.line11.amount
  const dcAGI = ratio < 1 ? Math.round(federalAGI * ratio) : federalAGI

  const dcStandardDeduction = DC_STANDARD_DEDUCTION[model.filingStatus]
  const dcItemizedDeduction = model.deductions.method === 'itemized' && form1040.scheduleA
    ? form1040.scheduleA.line17.amount
    : 0
  const useItemized = dcItemizedDeduction > dcStandardDeduction
  const deductionUsed = useItemized ? dcItemizedDeduction : dcStandardDeduction

  const dcTaxableIncome = Math.max(0, dcAGI - deductionUsed)
  const dcTax = commuterExempt ? 0 : computeBracketTax(dcTaxableIncome, DC_TAX_BRACKETS[model.filingStatus])

  const taxAfterCredits = dcTax
  const stateWithholding = model.w2s.reduce((sum, w2) => sum + ((w2.box15State === 'DC') ? (w2.box17StateIncomeTax ?? 0) : 0), 0)
  const totalPayments = stateWithholding
  const overpaid = totalPayments > taxAfterCredits ? totalPayments - taxAfterCredits : 0
  const amountOwed = taxAfterCredits > totalPayments ? taxAfterCredits - totalPayments : 0

  return {
    federalAGI,
    dcAGI,
    dcStandardDeduction,
    dcItemizedDeduction,
    deductionMethod: useItemized ? 'itemized' : 'standard',
    deductionUsed,
    dcTaxableIncome,
    dcTax,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType: config.residencyType,
    apportionmentRatio: ratio,
    dcSourceIncome: ratio < 1 ? dcAGI : undefined,
    commuterExempt,
  }
}
