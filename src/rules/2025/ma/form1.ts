import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { MA_FLAT_TAX_RATE, MA_PERSONAL_EXEMPTION } from './constants'

export interface Form1Result {
  federalAGI: number
  maAGI: number
  personalExemption: number
  maTaxableIncome: number
  maIncomeTax: number
  taxAfterCredits: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  maSourceIncome?: number
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function computeApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
  if (config.residencyType === 'full-year') return 1
  if (config.residencyType === 'nonresident') return 0

  const daysInYear = isLeapYear(taxYear) ? 366 : 365
  const MS_PER_DAY = 86400000
  const yearStart = Date.UTC(taxYear, 0, 1)
  const yearEnd = Date.UTC(taxYear, 11, 31)

  let start = yearStart
  let end = yearEnd

  if (config.moveInDate) {
    const [y, m, d] = config.moveInDate.split('-').map(Number)
    const dt = Date.UTC(y, (m ?? 1) - 1, d ?? 1)
    if (!isNaN(dt)) start = dt
  }
  if (config.moveOutDate) {
    const [y, m, d] = config.moveOutDate.split('-').map(Number)
    const dt = Date.UTC(y, (m ?? 1) - 1, d ?? 1)
    if (!isNaN(dt)) end = dt
  }

  if (start < yearStart) start = yearStart
  if (end > yearEnd) end = yearEnd
  if (end < start) return 0

  const days = Math.round((end - start) / MS_PER_DAY) + 1
  return Math.min(1, Math.max(0, days / daysInYear))
}

export function computeForm1(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form1Result {
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount
  const maAGI = federalAGI
  const baseExemption = MA_PERSONAL_EXEMPTION[model.filingStatus]
  const personalExemption = ratio < 1 ? Math.round(baseExemption * ratio) : baseExemption

  const maSourceIncome = ratio < 1 ? Math.round(maAGI * ratio) : undefined
  const taxableBase = maSourceIncome ?? maAGI
  const maTaxableIncome = Math.max(0, taxableBase - personalExemption)
  const maIncomeTax = Math.round(maTaxableIncome * MA_FLAT_TAX_RATE)

  const taxAfterCredits = maIncomeTax

  const stateWithholding = model.w2s.reduce((sum, w2) => {
    if (w2.box15State === 'MA') return sum + (w2.box17StateIncomeTax ?? 0)
    return sum
  }, 0)

  const totalPayments = stateWithholding
  const overpaid = totalPayments > taxAfterCredits ? totalPayments - taxAfterCredits : 0
  const amountOwed = taxAfterCredits > totalPayments ? taxAfterCredits - totalPayments : 0

  return {
    federalAGI,
    maAGI,
    personalExemption,
    maTaxableIncome,
    maIncomeTax,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    maSourceIncome,
  }
}
