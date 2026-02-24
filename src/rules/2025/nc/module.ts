/** NC state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormD400, type FormD400Result } from './formd400'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormD400Result): StateComputeResult {
  return {
    stateCode: 'NC',
    formLabel: 'NC Form D-400',
    residencyType: form.residencyType,
    stateAGI: form.ncAGI,
    stateTaxableIncome: form.ncTaxableIncome,
    stateTax: form.ncTax,
    stateCredits: 0,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const NC_NODE_LABELS: Record<string, string> = {
  'formd400.ncAGI': 'North Carolina adjusted gross income',
  'formd400.ncTaxableIncome': 'North Carolina taxable income',
  'formd400.ncTax': 'North Carolina income tax',
  'formd400.taxAfterCredits': 'NC tax after credits',
  'formd400.stateWithholding': 'NC state income tax withheld',
  'formd400.overpaid': 'NC overpaid (refund)',
  'formd400.amountOwed': 'NC amount you owe',
}

function collectNCTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormD400Result
  const values = new Map<string, TracedValue>()

  values.set('formd400.ncAGI', tracedFromComputation(
    form.ncAGI,
    'formd400.ncAGI',
    ['form1040.line11'],
    'North Carolina adjusted gross income',
  ))

  values.set('formd400.ncTaxableIncome', tracedFromComputation(
    form.ncTaxableIncome,
    'formd400.ncTaxableIncome',
    ['formd400.ncAGI'],
    'North Carolina taxable income',
  ))

  values.set('formd400.ncTax', tracedFromComputation(
    form.ncTax,
    'formd400.ncTax',
    ['formd400.ncTaxableIncome'],
    'North Carolina income tax',
  ))

  values.set('formd400.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'formd400.taxAfterCredits',
    ['formd400.ncTax'],
    'NC tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('formd400.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'formd400.stateWithholding',
      [],
      'NC state income tax withheld',
    ))
  }

  if (form.overpaid > 0) {
    values.set('formd400.overpaid', tracedFromComputation(
      form.overpaid,
      'formd400.overpaid',
      ['formd400.taxAfterCredits', 'formd400.stateWithholding'],
      'NC overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('formd400.amountOwed', tracedFromComputation(
      form.amountOwed,
      'formd400.amountOwed',
      ['formd400.taxAfterCredits', 'formd400.stateWithholding'],
      'NC amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormD400Result {
  return result.detail as FormD400Result
}

const NC_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'North Carolina starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'NC D-400 Instructions',
          pubUrl: 'https://www.ncdor.gov/taxes-forms/individual-income-tax',
        },
      },
      {
        label: 'NC AGI',
        nodeId: 'formd400.ncAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'North Carolina adjusted gross income after state additions/subtractions (when applicable).',
          pubName: 'NC D-400 Instructions',
          pubUrl: 'https://www.ncdor.gov/taxes-forms/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'NC Taxable Income',
        nodeId: 'formd400.ncTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'North Carolina taxable income equals NC AGI minus the NC standard deduction.',
          pubName: 'NC D-400 Instructions',
          pubUrl: 'https://www.ncdor.gov/taxes-forms/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'NC Tax',
        nodeId: 'formd400.ncTax',
        getValue: (r) => d(r).ncTax,
        tooltip: {
          explanation: 'North Carolina tax is computed using the state flat income tax rate.',
          pubName: 'NC D-400 Instructions',
          pubUrl: 'https://www.ncdor.gov/taxes-forms/individual-income-tax',
        },
      },
      {
        label: 'NC Tax After Credits',
        nodeId: 'formd400.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net North Carolina income tax after nonrefundable credits.',
          pubName: 'NC D-400 Instructions',
          pubUrl: 'https://www.ncdor.gov/taxes-forms/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'NC State Withholding',
        nodeId: 'formd400.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'North Carolina tax withheld from W-2 Box 17 entries for NC.',
          pubName: 'NC D-400 Instructions',
          pubUrl: 'https://www.ncdor.gov/taxes-forms/individual-income-tax',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const NC_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'NC Refund',
    nodeId: 'formd400.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'NC Amount You Owe',
    nodeId: 'formd400.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'NC tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const ncModule: StateRulesModule = {
  stateCode: 'NC',
  stateName: 'North Carolina',
  formLabel: 'NC Form D-400',
  sidebarLabel: 'NC Form D-400',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormD400(model, federal, config))
  },
  nodeLabels: NC_NODE_LABELS,
  collectTracedValues: collectNCTracedValues,
  reviewLayout: NC_REVIEW_LAYOUT,
  reviewResultLines: NC_REVIEW_RESULT_LINES,
}
