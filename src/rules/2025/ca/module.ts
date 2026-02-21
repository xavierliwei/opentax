/**
 * CA State Module — Wraps existing Form 540 computation into the StateRulesModule interface
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm540 } from './form540'
import type { Form540Result } from './form540'
import type { StateRulesModule, StateComputeResult } from '../../stateEngine'

/** Map a Form540Result into the standardised StateComputeResult */
function toStateResult(form540: Form540Result): StateComputeResult {
  return {
    stateCode: 'CA',
    formLabel: 'CA Form 540',
    stateAGI: form540.caAGI,
    stateTaxableIncome: form540.caTaxableIncome,
    stateTax: form540.caTax + form540.mentalHealthTax,
    stateCredits: form540.totalExemptionCredits + form540.rentersCredit,
    taxAfterCredits: form540.taxAfterCredits,
    stateWithholding: form540.stateWithholding,
    overpaid: form540.overpaid,
    amountOwed: form540.amountOwed,
    detail: form540,
  }
}

/** Node labels for CA trace nodes */
const CA_NODE_LABELS: Record<string, string> = {
  'form540.caAGI': 'California adjusted gross income',
  'form540.caDeduction': 'California deduction',
  'form540.caTaxableIncome': 'California taxable income',
  'form540.caTax': 'California tax',
  'form540.mentalHealthTax': 'Mental health services tax (1%)',
  'form540.exemptionCredits': 'CA exemption credits',
  'form540.rentersCredit': "CA renter's credit",
  'form540.taxAfterCredits': 'CA tax after credits',
  'form540.stateWithholding': 'CA state income tax withheld',
  'form540.overpaid': 'CA overpaid (refund)',
  'form540.amountOwed': 'CA amount you owe',
  'scheduleCA.hsaAddBack': 'HSA deduction add-back (CA)',
  'scheduleCA.additions': 'CA income additions',
  'scheduleCA.subtractions': 'CA income subtractions',
}

/** Build traced values for the CA explainability graph */
function collectCATracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form540 = result.detail as Form540Result
  const values = new Map<string, TracedValue>()

  const caInputs = ['form1040.line11']
  if (form540.caAdjustments.hsaAddBack > 0) caInputs.push('scheduleCA.hsaAddBack')

  if (form540.caAdjustments.hsaAddBack > 0) {
    values.set('scheduleCA.hsaAddBack', tracedFromComputation(
      form540.caAdjustments.hsaAddBack, 'scheduleCA.hsaAddBack', ['adjustments.hsa'],
      'HSA deduction add-back (CA)',
    ))
  }
  if (form540.caAdjustments.additions > 0) {
    values.set('scheduleCA.additions', tracedFromComputation(
      form540.caAdjustments.additions, 'scheduleCA.additions',
      form540.caAdjustments.hsaAddBack > 0 ? ['scheduleCA.hsaAddBack'] : [],
      'CA income additions',
    ))
  }

  values.set('form540.caAGI', tracedFromComputation(
    form540.caAGI, 'form540.caAGI', caInputs, 'California adjusted gross income',
  ))
  values.set('form540.caDeduction', tracedFromComputation(
    form540.deductionUsed, 'form540.caDeduction', [],
    `CA ${form540.deductionMethod} deduction`,
  ))
  values.set('form540.caTaxableIncome', tracedFromComputation(
    form540.caTaxableIncome, 'form540.caTaxableIncome',
    ['form540.caAGI', 'form540.caDeduction'],
    'California taxable income',
  ))
  values.set('form540.caTax', tracedFromComputation(
    form540.caTax, 'form540.caTax', ['form540.caTaxableIncome'], 'California tax',
  ))

  if (form540.totalExemptionCredits > 0) {
    values.set('form540.exemptionCredits', tracedFromComputation(
      form540.totalExemptionCredits, 'form540.exemptionCredits', [],
      'CA exemption credits',
    ))
  }

  if (form540.mentalHealthTax > 0) {
    values.set('form540.mentalHealthTax', tracedFromComputation(
      form540.mentalHealthTax, 'form540.mentalHealthTax', ['form540.caTaxableIncome'],
      'Mental health services tax (1%)',
    ))
  }

  if (form540.rentersCredit > 0) {
    values.set('form540.rentersCredit', tracedFromComputation(
      form540.rentersCredit, 'form540.rentersCredit', [],
      "CA renter's credit",
    ))
  }

  const taxAfterInputs = ['form540.caTax']
  if (form540.totalExemptionCredits > 0) taxAfterInputs.push('form540.exemptionCredits')
  if (form540.mentalHealthTax > 0) taxAfterInputs.push('form540.mentalHealthTax')
  if (form540.rentersCredit > 0) taxAfterInputs.push('form540.rentersCredit')
  values.set('form540.taxAfterCredits', tracedFromComputation(
    form540.taxAfterCredits, 'form540.taxAfterCredits', taxAfterInputs,
    'CA tax after credits',
  ))

  if (form540.stateWithholding > 0) {
    values.set('form540.stateWithholding', tracedFromComputation(
      form540.stateWithholding, 'form540.stateWithholding', [],
      'CA state income tax withheld',
    ))
  }

  const resultInputs = ['form540.taxAfterCredits']
  if (form540.stateWithholding > 0) resultInputs.push('form540.stateWithholding')
  if (form540.overpaid > 0) {
    values.set('form540.overpaid', tracedFromComputation(
      form540.overpaid, 'form540.overpaid', resultInputs, 'CA overpaid (refund)',
    ))
  }
  if (form540.amountOwed > 0) {
    values.set('form540.amountOwed', tracedFromComputation(
      form540.amountOwed, 'form540.amountOwed', resultInputs, 'CA amount you owe',
    ))
  }

  return values
}

export const caModule: StateRulesModule = {
  stateCode: 'CA',
  formLabel: 'CA Form 540',
  sidebarLabel: 'CA Form 540',

  compute(model: TaxReturn, federal: Form1040Result, _config: StateReturnConfig): StateComputeResult {
    const form540 = computeForm540(model, federal)
    return toStateResult(form540)
  },

  nodeLabels: CA_NODE_LABELS,
  collectTracedValues: collectCATracedValues,
}

/** Extract Form540Result from a CA StateComputeResult (for backward compat) */
export function extractForm540(result: StateComputeResult): Form540Result {
  return result.detail as Form540Result
}
