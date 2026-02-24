import type { TaxReturn, FilingStatus, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { ScheduleAResult } from '../scheduleA'
import { MEDICAL_AGI_FLOOR_RATE } from '../constants'
import { computeApportionmentRatio } from '../ca/form540'
import {
  GA_TAX_RATE,
  GA_STANDARD_DEDUCTION,
  GA_DEPENDENT_EXEMPTION,
  GA_LOW_INCOME_AGI_LIMIT,
  GA_LOW_INCOME_CREDIT,
  GA_DEPENDENT_CARE_CREDIT_RATE,
} from './constants'
import { computeScheduleGA, type ScheduleGAResult } from './scheduleGA'

export interface Form500Result {
  federalAGI: number
  gaAdjustments: ScheduleGAResult
  gaAGI: number
  gaStandardDeduction: number
  gaItemizedDeduction: number
  deductionUsed: number
  deductionMethod: 'standard' | 'itemized'
  dependentExemption: number
  gaTaxableIncome: number
  gaTax: number
  lowIncomeCredit: number
  dependentCareCredit: number
  totalCredits: number
  taxAfterCredits: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  gaSourceIncome?: number
}

function computeGAItemized(
  model: TaxReturn,
  scheduleA: ScheduleAResult,
  gaAGI: number,
): number {
  const d = model.deductions.itemized
  if (!d) return 0

  const medicalFloor = Math.round(gaAGI * MEDICAL_AGI_FLOOR_RATE)
  const medicalDeduction = Math.max(0, d.medicalExpenses - medicalFloor)

  const gaSALT = d.realEstateTaxes + d.personalPropertyTaxes + d.stateLocalSalesTaxes

  return (
    medicalDeduction +
    gaSALT +
    scheduleA.line8a.amount +
    scheduleA.line9.amount +
    scheduleA.line14.amount +
    scheduleA.line16.amount
  )
}

function computeLowIncomeCredit(
  filingStatus: FilingStatus,
  federalAGI: number,
  isDependentOnAnotherReturn: boolean,
): number {
  if (isDependentOnAnotherReturn) return 0
  if (federalAGI >= GA_LOW_INCOME_AGI_LIMIT) return 0
  return GA_LOW_INCOME_CREDIT[filingStatus]
}

export function computeForm500(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form500Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config
    ? computeApportionmentRatio(config, model.taxYear)
    : 1.0

  const scheduleGA = computeScheduleGA(model, form1040)
  const federalAGI = scheduleGA.federalAGI
  const gaAGI = scheduleGA.gaAGI

  const gaStandardDeduction = GA_STANDARD_DEDUCTION[filingStatus]
  let gaItemizedDeduction = 0

  if (model.deductions.method === 'itemized' && form1040.scheduleA) {
    gaItemizedDeduction = computeGAItemized(model, form1040.scheduleA, gaAGI)
  }

  const useItemized = gaItemizedDeduction > gaStandardDeduction
  const deductionUsed = useItemized ? gaItemizedDeduction : gaStandardDeduction
  const deductionMethod = useItemized ? 'itemized' as const : 'standard' as const

  const dependentExemption = model.dependents.length * GA_DEPENDENT_EXEMPTION

  const gaTaxableIncome = Math.max(0, gaAGI - deductionUsed - dependentExemption)

  const fullYearTax = Math.round(gaTaxableIncome * GA_TAX_RATE)
  const gaTax = ratio < 1.0
    ? Math.round(fullYearTax * ratio)
    : fullYearTax

  const lowIncomeCredit = computeLowIncomeCredit(
    filingStatus,
    federalAGI,
    model.canBeClaimedAsDependent,
  )
  const dependentCareCredit = form1040.dependentCareCredit
    ? Math.round(form1040.dependentCareCredit.creditAmount * GA_DEPENDENT_CARE_CREDIT_RATE)
    : 0

  const totalCredits = lowIncomeCredit + dependentCareCredit
  const taxAfterCredits = Math.max(0, gaTax - totalCredits)

  const stateWithholding = model.w2s.reduce((sum, w) => {
    if (w.box15State === 'GA') return sum + (w.box17StateIncomeTax ?? 0)
    return sum
  }, 0)

  const totalPayments = stateWithholding

  const overpaid = totalPayments > taxAfterCredits
    ? totalPayments - taxAfterCredits
    : 0
  const amountOwed = taxAfterCredits > totalPayments
    ? taxAfterCredits - totalPayments
    : 0

  const gaSourceIncome = ratio < 1.0
    ? Math.round(gaAGI * ratio)
    : undefined

  return {
    federalAGI,
    gaAdjustments: scheduleGA,
    gaAGI,
    gaStandardDeduction,
    gaItemizedDeduction,
    deductionUsed,
    deductionMethod,
    dependentExemption,
    gaTaxableIncome,
    gaTax,
    lowIncomeCredit,
    dependentCareCredit,
    totalCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType,
    apportionmentRatio: ratio,
    gaSourceIncome,
  }
}
