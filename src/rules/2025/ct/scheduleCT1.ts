import type { TaxReturn } from '../../../model/types'
import type { Form1040Result } from '../form1040'

export interface ScheduleCT1Result {
  federalAGI: number
  additions: number
  subtractions: number
  ctAGI: number
  usObligationInterest: number
}

export function computeScheduleCT1(model: TaxReturn, form1040: Form1040Result): ScheduleCT1Result {
  const federalAGI = form1040.line11.amount
  const usObligationInterest = model.form1099INTs.reduce((sum, i) => sum + (i.box3 ?? 0), 0)
  const additions = 0
  const subtractions = usObligationInterest
  const ctAGI = Math.max(0, federalAGI + additions - subtractions)

  return { federalAGI, additions, subtractions, ctAGI, usObligationInterest }
}
