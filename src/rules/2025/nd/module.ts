/** ND state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormND1, type FormND1Result } from './formND1'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormND1Result): StateComputeResult {
  return {
    stateCode: 'ND',
    formLabel: 'ND Form ND-1',
    residencyType: form.residencyType,
    stateAGI: form.federalTaxableIncome,
    stateTaxableIncome: form.ndTaxableIncome,
    stateTax: form.ndTax,
    stateCredits: 0,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const ND_NODE_LABELS: Record<string, string> = {
  'formND1.federalTaxableIncome': 'Federal taxable income (1040 Line 15)',
  'formND1.ndSubtractions': 'ND subtractions',
  'formND1.ndTaxableIncome': 'North Dakota taxable income',
  'formND1.ndTax': 'North Dakota income tax',
  'formND1.taxAfterCredits': 'ND tax after credits',
  'formND1.stateWithholding': 'ND state income tax withheld',
  'formND1.overpaid': 'ND overpaid (refund)',
  'formND1.amountOwed': 'ND amount you owe',
}

function collectNDTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormND1Result
  const values = new Map<string, TracedValue>()

  values.set('formND1.federalTaxableIncome', tracedFromComputation(
    form.federalTaxableIncome, 'formND1.federalTaxableIncome',
    ['form1040.line15'],
    'Federal taxable income (ND starts from line 15)',
  ))

  const taxableInputs = ['formND1.federalTaxableIncome']
  if (form.ndSubtractions > 0) {
    taxableInputs.push('formND1.ndSubtractions')
    values.set('formND1.ndSubtractions', tracedFromComputation(
      form.ndSubtractions, 'formND1.ndSubtractions', [],
      'ND subtractions (US gov interest)',
    ))
  }

  values.set('formND1.ndTaxableIncome', tracedFromComputation(
    form.ndTaxableIncome, 'formND1.ndTaxableIncome', taxableInputs,
    'North Dakota taxable income',
  ))

  values.set('formND1.ndTax', tracedFromComputation(
    form.ndTax, 'formND1.ndTax', ['formND1.ndTaxableIncome'],
    'North Dakota income tax (1.95% / 2.50%)',
  ))

  values.set('formND1.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits, 'formND1.taxAfterCredits', ['formND1.ndTax'],
    'ND tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('formND1.stateWithholding', tracedFromComputation(
      form.stateWithholding, 'formND1.stateWithholding', [],
      'ND state income tax withheld',
    ))
  }

  const resultInputs = ['formND1.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('formND1.stateWithholding')

  if (form.overpaid > 0) {
    values.set('formND1.overpaid', tracedFromComputation(
      form.overpaid, 'formND1.overpaid', resultInputs, 'ND overpaid (refund)',
    ))
  }
  if (form.amountOwed > 0) {
    values.set('formND1.amountOwed', tracedFromComputation(
      form.amountOwed, 'formND1.amountOwed', resultInputs, 'ND amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormND1Result {
  return result.detail as FormND1Result
}

const ND_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal Taxable Income',
        nodeId: 'form1040.line15',
        getValue: (r) => d(r).federalTaxableIncome,
        tooltip: {
          explanation: 'North Dakota starts from federal taxable income (Form 1040 Line 15), not AGI. There is no separate ND standard deduction or personal exemption.',
          pubName: 'ND Form ND-1 Instructions',
          pubUrl: 'https://www.tax.nd.gov/individual/individual-income-tax',
        },
      },
      {
        label: 'ND Subtractions',
        nodeId: 'formND1.ndSubtractions',
        getValue: (r) => d(r).ndSubtractions,
        showWhen: (r) => d(r).ndSubtractions > 0,
        tooltip: {
          explanation: 'ND subtractions include US government obligation interest.',
          pubName: 'ND Form ND-1',
          pubUrl: 'https://www.tax.nd.gov/individual/individual-income-tax',
        },
      },
      {
        label: 'ND Taxable Income',
        nodeId: 'formND1.ndTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'North Dakota taxable income = federal taxable income minus ND subtractions.',
          pubName: 'ND Form ND-1',
          pubUrl: 'https://www.tax.nd.gov/individual/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Tax',
    items: [
      {
        label: 'ND Tax (1.95% / 2.50%)',
        nodeId: 'formND1.ndTax',
        getValue: (r) => d(r).ndTax,
        tooltip: {
          explanation: 'North Dakota income tax using 2 graduated brackets: 1.95% and 2.50%. Same brackets for all filing statuses. Lowest rates of any graduated-tax state.',
          pubName: 'ND Form ND-1 Tax Table',
          pubUrl: 'https://www.tax.nd.gov/individual/individual-income-tax',
        },
      },
      {
        label: 'ND Tax After Credits',
        nodeId: 'formND1.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net North Dakota income tax.',
          pubName: 'ND Form ND-1',
          pubUrl: 'https://www.tax.nd.gov/individual/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'ND State Withholding',
        nodeId: 'formND1.stateWithholding',
        getValue: (r) => r.stateWithholding,
        showWhen: (r) => r.stateWithholding > 0,
        tooltip: {
          explanation: 'North Dakota tax withheld from W-2 Box 17 entries for ND.',
          pubName: 'ND Form ND-1',
          pubUrl: 'https://www.tax.nd.gov/individual/individual-income-tax',
        },
      },
    ],
  },
]

const ND_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  { type: 'refund', label: 'ND Refund', nodeId: 'formND1.overpaid', getValue: (r) => r.overpaid, showWhen: (r) => r.overpaid > 0 },
  { type: 'owed', label: 'ND Amount You Owe', nodeId: 'formND1.amountOwed', getValue: (r) => r.amountOwed, showWhen: (r) => r.amountOwed > 0 },
  { type: 'zero', label: 'ND tax balance', nodeId: '', getValue: () => 0, showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0 },
]

export const ndModule: StateRulesModule = {
  stateCode: 'ND',
  stateName: 'North Dakota',
  formLabel: 'ND Form ND-1',
  sidebarLabel: 'ND Form ND-1',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormND1(model, federal, config))
  },
  nodeLabels: ND_NODE_LABELS,
  collectTracedValues: collectNDTracedValues,
  reviewLayout: ND_REVIEW_LAYOUT,
  reviewResultLines: ND_REVIEW_RESULT_LINES,
}
