import type { FilingStatus, StateReturnConfig, TaxReturn } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import { computeBracketTax } from '../taxComputation'
import { CT_PERSONAL_EXEMPTION, CT_TABLE_C, CT_TABLE_D, CT_TAX_BRACKETS } from './constants'
import { computeCTEITC, computePropertyTaxCredit } from './ctCredits'
import { computeScheduleCT1, type ScheduleCT1Result } from './scheduleCT1'

export interface FormCT1040Result {
  federalAGI: number
  ctSchedule1: ScheduleCT1Result
  ctAGI: number
  personalExemption: number
  exemptionPhaseOutReduction: number
  effectiveExemption: number
  ctTaxableIncome: number
  bracketTax: number
  tableC_addBack: number
  tableD_recapture: number
  ctIncomeTax: number
  propertyTaxCredit: number
  ctEITC: number
  totalNonrefundableCredits: number
  totalRefundableCredits: number
  taxAfterCredits: number
  stateWithholding: number
  totalPayments: number
  overpaid: number
  amountOwed: number
  residencyType: StateReturnConfig['residencyType']
  apportionmentRatio: number
  ctSourceIncome?: number
}

const c = (dollars: number): number => Math.round(dollars * 100)

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function computeCTApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
  if (config.residencyType === 'full-year') return 1
  if (config.residencyType === 'nonresident') return 0

  const daysInYear = isLeapYear(taxYear) ? 366 : 365
  const dayMs = 86400000
  const yearStart = Date.UTC(taxYear, 0, 1)
  const yearEnd = Date.UTC(taxYear, 11, 31)

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

function linearTableAmount(x: number, start: number, end: number, maxAmount: number): number {
  if (x <= start) return 0
  if (x >= end) return maxAmount
  const ratio = (x - start) / (end - start)
  return Math.round((maxAmount * ratio) / 100) * 100
}

export function computeTableCAddBack(ctAGI: number, filingStatus: FilingStatus): number {
  const t = CT_TABLE_C[filingStatus]
  return linearTableAmount(ctAGI, t.phaseOutStart, t.phaseOutEnd, t.maxAddBack)
}

export function computeTableDRecapture(ctAGI: number, filingStatus: FilingStatus): number {
  const t = CT_TABLE_D[filingStatus]
  return linearTableAmount(ctAGI, t.recaptureStart, t.recaptureEnd, t.maxRecapture)
}

export function computePersonalExemption(ctAGI: number, filingStatus: FilingStatus): { maxExemption: number; reduction: number; effectiveExemption: number } {
  const t = CT_PERSONAL_EXEMPTION[filingStatus]
  if (ctAGI <= t.phaseOutStart) return { maxExemption: t.maxExemption, reduction: 0, effectiveExemption: t.maxExemption }
  if (ctAGI >= t.phaseOutEnd) return { maxExemption: t.maxExemption, reduction: t.maxExemption, effectiveExemption: 0 }

  const reduction = Math.min(t.maxExemption, Math.ceil((ctAGI - t.phaseOutStart) / c(1000)) * c(1000))
  return { maxExemption: t.maxExemption, reduction, effectiveExemption: Math.max(0, t.maxExemption - reduction) }
}

export function computeFormCT1040(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig, schedule1?: ScheduleCT1Result): FormCT1040Result {
  const ctSchedule1 = schedule1 ?? computeScheduleCT1(model, federal)
  const ctAGI = ctSchedule1.ctAGI
  const ratio = computeCTApportionmentRatio(config, model.taxYear)

  const ex = computePersonalExemption(ctAGI, model.filingStatus)
  const ctTaxableIncome = Math.max(0, ctAGI - ex.effectiveExemption)

  const bracketTax = computeBracketTax(ctTaxableIncome, CT_TAX_BRACKETS[model.filingStatus])
  const tableC_addBack = computeTableCAddBack(ctAGI, model.filingStatus)
  const tableD_recapture = computeTableDRecapture(ctAGI, model.filingStatus)
  const fullYearTax = bracketTax + tableC_addBack + tableD_recapture
  // Part-year: apportion income tax by days-in-state ratio
  const ctIncomeTax = ratio < 1 ? Math.round(fullYearTax * ratio) : fullYearTax

  const propertyTaxCredit = Math.min(
    ctIncomeTax,
    computePropertyTaxCredit(ctAGI, model.filingStatus, config.ctPropertyTaxPaid ?? 0),
  )
  const hasQualifyingChildren = model.dependents.some((d) => {
    const rel = d.relationship.toLowerCase()
    return rel === 'son' || rel === 'daughter' || rel === 'child'
      || rel === 'stepson' || rel === 'stepdaughter' || rel === 'stepchild'
      || rel === 'foster child' || rel === 'foster_child'
  })
  const ctEITC = computeCTEITC(federal.line27.amount, hasQualifyingChildren, config.residencyType === 'full-year')

  const totalNonrefundableCredits = propertyTaxCredit
  const totalRefundableCredits = ctEITC
  const taxAfterCredits = Math.max(0, ctIncomeTax - totalNonrefundableCredits)

  const stateWithholding = model.w2s
    .filter((w) => (w.box15State ?? '').toUpperCase() === 'CT')
    .reduce((sum, w) => sum + (w.box17StateIncomeTax ?? 0), 0)
  const totalPayments = stateWithholding + totalRefundableCredits

  const overpaid = Math.max(0, totalPayments - taxAfterCredits)
  const amountOwed = Math.max(0, taxAfterCredits - totalPayments)

  const ctSourceIncome = ratio < 1 ? Math.round(ctAGI * ratio) : undefined

  return {
    federalAGI: ctSchedule1.federalAGI,
    ctSchedule1,
    ctAGI,
    personalExemption: ex.maxExemption,
    exemptionPhaseOutReduction: ex.reduction,
    effectiveExemption: ex.effectiveExemption,
    ctTaxableIncome,
    bracketTax,
    tableC_addBack,
    tableD_recapture,
    ctIncomeTax,
    propertyTaxCredit,
    ctEITC,
    totalNonrefundableCredits,
    totalRefundableCredits,
    taxAfterCredits,
    stateWithholding,
    totalPayments,
    overpaid,
    amountOwed,
    residencyType: config.residencyType,
    apportionmentRatio: ratio,
    ctSourceIncome,
  }
}
