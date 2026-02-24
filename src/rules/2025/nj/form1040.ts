import type { FilingStatus, StateReturnConfig, TaxReturn } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeBracketTax } from '../taxComputation'
import { NJ_DEPENDENT_EXEMPTION, NJ_PERSONAL_EXEMPTION, NJ_TAX_BRACKETS } from './constants'

export interface NJ1040Result {
  residencyType: StateReturnConfig['residencyType']
  apportionmentRatio: number
  federalAGI: number
  njGrossIncome: number
  exemptionAmount: number
  njTaxableIncome: number
  njTax: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number
}

function daysInState(config: StateReturnConfig): number {
  if (config.residencyType !== 'part-year') return 365
  const start = config.moveInDate ? new Date(config.moveInDate) : new Date('2025-01-01')
  const end = config.moveOutDate ? new Date(config.moveOutDate) : new Date('2025-12-31')
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) return 365
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.max(1, Math.min(365, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1))
}

function computeExemptions(model: TaxReturn, filingStatus: FilingStatus): number {
  const personalCount = filingStatus === 'mfj' ? 2 : 1
  const dependentCount = model.dependents.length
  return personalCount * NJ_PERSONAL_EXEMPTION + dependentCount * NJ_DEPENDENT_EXEMPTION
}

function computeStateWithholding(model: TaxReturn): number {
  return model.w2s.reduce((sum, w2) => {
    if ((w2.box15State ?? '').toUpperCase() === 'NJ') return sum + (w2.box17StateIncomeTax ?? 0)
    return sum
  }, 0)
}

export function computeNJ1040(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): NJ1040Result {
  const apportionmentRatio = config.residencyType === 'full-year' ? 1 : config.residencyType === 'nonresident' ? 0 : daysInState(config) / 365
  const federalAGI = federal.line11.amount
  const njGrossIncome = Math.round(federalAGI * apportionmentRatio)
  const exemptionAmount = computeExemptions(model, model.filingStatus)
  const njTaxableIncome = Math.max(0, njGrossIncome - exemptionAmount)
  const njTax = Math.round(computeBracketTax(njTaxableIncome, NJ_TAX_BRACKETS[model.filingStatus]))
  const stateWithholding = computeStateWithholding(model)
  const totalPayments = stateWithholding
  const overpaid = Math.max(0, totalPayments - njTax)
  const amountOwed = Math.max(0, njTax - totalPayments)

  return {
    residencyType: config.residencyType,
    apportionmentRatio,
    federalAGI,
    njGrossIncome,
    exemptionAmount,
    njTaxableIncome,
    njTax,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
  }
}
