import type { FilingStatus } from '../../../model/types'
import { CT_EITC_CHILD_BONUS, CT_EITC_RATE, CT_PROPERTY_TAX_CREDIT } from './constants'

export function computePropertyTaxCredit(ctAGI: number, filingStatus: FilingStatus, ctPropertyTaxPaid = 0): number {
  if (ctPropertyTaxPaid <= 0) return 0
  const maxAllowed = Math.min(ctPropertyTaxPaid, CT_PROPERTY_TAX_CREDIT.maxCredit)
  const limit = CT_PROPERTY_TAX_CREDIT.incomeLimit[filingStatus]
  if (ctAGI <= limit) return maxAllowed

  const step = filingStatus === 'mfs' ? CT_PROPERTY_TAX_CREDIT.phaseOutStepMFS : CT_PROPERTY_TAX_CREDIT.phaseOutStep
  const increments = Math.ceil((ctAGI - limit) / step)
  const reduction = Math.round(increments * CT_PROPERTY_TAX_CREDIT.phaseOutRate * CT_PROPERTY_TAX_CREDIT.maxCredit)
  return Math.max(0, maxAllowed - reduction)
}

export function computeCTEITC(
  federalEITC: number,
  hasQualifyingChildren: boolean,
  isFullYearResident: boolean,
): number {
  if (!isFullYearResident || federalEITC <= 0) return 0
  return Math.round(federalEITC * CT_EITC_RATE) + (hasQualifyingChildren ? CT_EITC_CHILD_BONUS : 0)
}
