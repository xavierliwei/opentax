import type { FilingStatus, StateReturnConfig, TaxReturn } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeBracketTax } from '../taxComputation'
import {
  MD_DEPENDENT_EXEMPTION,
  MD_EXEMPTION_PHASEOUT_END,
  MD_EXEMPTION_PHASEOUT_START,
  MD_LOCAL_TAX_RATE_DEFAULT,
  MD_PERSONAL_EXEMPTION,
  MD_STANDARD_DEDUCTION_MAX,
  MD_STANDARD_DEDUCTION_MIN,
  MD_STANDARD_DEDUCTION_RATE,
  MD_TAX_BRACKETS,
} from './constants'

export interface Form502Result {
  federalAGI: number
  mdAGI: number
  mdSourceIncome?: number
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number

  standardDeduction: number
  itemizedDeduction: number
  deductionUsed: number
  deductionMethod: 'standard' | 'itemized'

  personalExemption: number
  dependentExemption: number
  exemptionReduction: number
  totalExemptions: number

  mdTaxableIncome: number
  mdStateTax: number
  mdLocalTax: number
  taxAfterCredits: number

  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number
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
    const ms = Date.UTC(y, (m ?? 1) - 1, d ?? 1)
    if (!isNaN(ms)) startMs = ms
  }
  if (config.moveOutDate) {
    const [y, m, d] = config.moveOutDate.split('-').map(Number)
    const ms = Date.UTC(y, (m ?? 1) - 1, d ?? 1)
    if (!isNaN(ms)) endMs = ms
  }

  if (startMs < yearStartMs) startMs = yearStartMs
  if (endMs > yearEndMs) endMs = yearEndMs
  if (endMs < startMs) return 0

  const daysInState = Math.round((endMs - startMs) / MS_PER_DAY) + 1
  return Math.min(1, Math.max(0, daysInState / daysInYear))
}

function computeStandardDeduction(filingStatus: FilingStatus, mdAGI: number): number {
  const raw = Math.round(mdAGI * MD_STANDARD_DEDUCTION_RATE)
  return Math.max(MD_STANDARD_DEDUCTION_MIN[filingStatus], Math.min(raw, MD_STANDARD_DEDUCTION_MAX[filingStatus]))
}

function computeExemptions(filingStatus: FilingStatus, dependents: number, mdAGI: number): {
  personal: number
  dependent: number
  reduction: number
  total: number
} {
  const personal = MD_PERSONAL_EXEMPTION[filingStatus]
  const dependent = dependents * MD_DEPENDENT_EXEMPTION
  const totalBefore = personal + dependent

  const start = MD_EXEMPTION_PHASEOUT_START[filingStatus]
  const end = MD_EXEMPTION_PHASEOUT_END[filingStatus]

  let reduction = 0
  if (mdAGI >= end) reduction = totalBefore
  else if (mdAGI > start) reduction = Math.round(totalBefore * ((mdAGI - start) / (end - start)))

  return { personal, dependent, reduction, total: Math.max(0, totalBefore - reduction) }
}

export function computeForm502(
  model: TaxReturn,
  form1040: Form1040Result,
  config?: StateReturnConfig,
): Form502Result {
  const filingStatus = model.filingStatus
  const residencyType = config?.residencyType ?? 'full-year'
  const ratio = config ? computeApportionmentRatio(config, model.taxYear) : 1

  const federalAGI = form1040.line11.amount
  const mdAGI = federalAGI

  const standardDeduction = computeStandardDeduction(filingStatus, mdAGI)
  const itemizedDeduction = model.deductions.method === 'itemized' && form1040.scheduleA
    ? form1040.scheduleA.line17.amount
    : 0
  const deductionUsed = Math.max(standardDeduction, itemizedDeduction)
  const deductionMethod = itemizedDeduction > standardDeduction ? 'itemized' as const : 'standard' as const

  const exemptions = computeExemptions(filingStatus, model.dependents.length, mdAGI)

  const apportionedAgi = Math.round(mdAGI * ratio)
  const apportionedDeduction = Math.round(deductionUsed * ratio)
  const apportionedExemptions = Math.round(exemptions.total * ratio)

  const mdTaxableIncome = Math.max(0, apportionedAgi - apportionedDeduction - apportionedExemptions)
  const mdStateTax = computeBracketTax(mdTaxableIncome, MD_TAX_BRACKETS[filingStatus])
  const mdLocalTax = Math.round(mdTaxableIncome * MD_LOCAL_TAX_RATE_DEFAULT)

  const taxAfterCredits = mdStateTax + mdLocalTax

  const stateWithholding = model.w2s.reduce((sum, w2) => (
    w2.box15State === 'MD' ? sum + (w2.box17StateIncomeTax ?? 0) : sum
  ), 0)

  const totalPayments = stateWithholding
  const overpaid = totalPayments > taxAfterCredits ? totalPayments - taxAfterCredits : 0
  const amountOwed = taxAfterCredits > totalPayments ? taxAfterCredits - totalPayments : 0

  return {
    federalAGI,
    mdAGI,
    mdSourceIncome: ratio < 1 ? apportionedAgi : undefined,
    residencyType,
    apportionmentRatio: ratio,

    standardDeduction,
    itemizedDeduction,
    deductionUsed,
    deductionMethod,

    personalExemption: exemptions.personal,
    dependentExemption: exemptions.dependent,
    exemptionReduction: exemptions.reduction,
    totalExemptions: apportionedExemptions,

    mdTaxableIncome,
    mdStateTax,
    mdLocalTax,
    taxAfterCredits,

    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
  }
}
