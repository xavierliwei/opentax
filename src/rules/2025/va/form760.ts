import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { VA_PERSONAL_EXEMPTION_PER_PERSON, VA_STANDARD_DEDUCTION, VA_TAX_BRACKETS } from './constants'

export interface Form760Result {
  residencyType: StateReturnConfig['residencyType']
  federalAGI: number
  vaAGI: number
  vaSourceIncome?: number
  apportionmentRatio: number
  deductionMethod: 'standard' | 'itemized'
  vaStandardDeduction: number
  vaItemizedDeduction: number
  deductionUsed: number
  exemptions: number
  vaTaxableIncome: number
  vaTax: number
  taxAfterCredits: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number
}

function computeApportionmentRatio(config: StateReturnConfig): number {
  if (config.residencyType === 'full-year') return 1
  if (!config.moveInDate && !config.moveOutDate) return 0.5

  const start = new Date('2025-01-01T00:00:00Z')
  const end = new Date('2025-12-31T00:00:00Z')

  const moveIn = config.moveInDate ? new Date(`${config.moveInDate}T00:00:00Z`) : start
  const moveOut = config.moveOutDate ? new Date(`${config.moveOutDate}T00:00:00Z`) : end

  const clippedStart = moveIn < start ? start : moveIn
  const clippedEnd = moveOut > end ? end : moveOut
  if (clippedEnd < clippedStart) return 0

  const dayMs = 24 * 60 * 60 * 1000
  const daysInPeriod = Math.floor((clippedEnd.getTime() - clippedStart.getTime()) / dayMs) + 1
  return Math.max(0, Math.min(1, daysInPeriod / 365))
}

function computeVATax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0
  const bracket = VA_TAX_BRACKETS.find((b) => taxableIncome <= b.upTo)!
  return Math.round(bracket.baseTax + (taxableIncome - bracket.over) * bracket.rate)
}

function sumVAWithholding(model: TaxReturn): number {
  return model.w2s.reduce((sum, w2) => {
    const isVA = (w2.box15State || '').toUpperCase() === 'VA'
    return sum + (isVA ? (w2.box17StateIncomeTax || 0) : 0)
  }, 0)
}

export function computeForm760(
  model: TaxReturn,
  federal: Form1040Result,
  config: StateReturnConfig,
): Form760Result {
  const federalAGI = federal.line11.amount
  const vaAGI = federalAGI
  const apportionmentRatio = computeApportionmentRatio(config)
  const vaSourceIncome = config.residencyType === 'full-year'
    ? undefined
    : Math.round(vaAGI * apportionmentRatio)

  const vaStandardDeduction = VA_STANDARD_DEDUCTION[model.filingStatus]
  const vaItemizedDeduction = model.deductions.method === 'itemized'
    ? (federal.scheduleA?.line17.amount ?? 0)
    : 0
  const deductionUsed = Math.max(vaStandardDeduction, vaItemizedDeduction)

  const exemptionCount = (model.filingStatus === 'mfj' || model.filingStatus === 'mfs' ? 2 : 1) + model.dependents.length
  const exemptions = exemptionCount * VA_PERSONAL_EXEMPTION_PER_PERSON

  const incomeBase = vaSourceIncome ?? vaAGI
  const allocatedDeduction = vaSourceIncome !== undefined
    ? Math.round(deductionUsed * apportionmentRatio)
    : deductionUsed
  const vaTaxableIncome = Math.max(0, incomeBase - allocatedDeduction)
  const vaTax = computeVATax(vaTaxableIncome)

  const taxAfterCredits = Math.max(0, vaTax - exemptions)
  const stateWithholding = sumVAWithholding(model)
  const totalPayments = stateWithholding
  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  return {
    residencyType: config.residencyType,
    federalAGI,
    vaAGI,
    vaSourceIncome,
    apportionmentRatio,
    deductionMethod: model.deductions.method,
    vaStandardDeduction,
    vaItemizedDeduction,
    deductionUsed,
    exemptions,
    vaTaxableIncome,
    vaTax,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
  }
}
