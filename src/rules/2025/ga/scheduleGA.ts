import type { TaxReturn } from '../../../model/types'
import type { Form1040Result } from '../form1040'

export interface ScheduleGAResult {
  federalAGI: number
  additions: number
  subtractions: number
  gaAGI: number
  socialSecuritySubtraction: number
  stateIncomeTaxAddBack: number
  retirementExclusion: number
}

export function computeScheduleGA(
  model: TaxReturn,
  form1040: Form1040Result,
): ScheduleGAResult {
  const federalAGI = form1040.line11.amount

  const socialSecuritySubtraction = form1040.line6b.amount
  const stateIncomeTaxAddBack = model.deductions.method === 'itemized'
    ? (model.deductions.itemized?.stateLocalIncomeTaxes ?? 0)
    : 0

  const additions = stateIncomeTaxAddBack
  const retirementExclusion = 0
  const subtractions = socialSecuritySubtraction + retirementExclusion
  const gaAGI = federalAGI + additions - subtractions

  return {
    federalAGI,
    additions,
    subtractions,
    gaAGI,
    socialSecuritySubtraction,
    stateIncomeTaxAddBack,
    retirementExclusion,
  }
}
