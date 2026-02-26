/** KS state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormK40, type FormK40Result } from './k40'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormK40Result): StateComputeResult {
  return {
    stateCode: 'KS',
    formLabel: 'KS Form K-40',
    residencyType: form.residencyType,
    stateAGI: form.ksAGI,
    stateTaxableIncome: form.ksTaxableIncome,
    stateTax: form.ksTax,
    stateCredits: form.totalNonrefundableCredits + form.totalRefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const KS_NODE_LABELS: Record<string, string> = {
  'formK40.ksAdditions': 'KS additions to federal AGI',
  'formK40.ksSubtractions': 'KS subtractions from federal AGI',
  'formK40.ksAGI': 'Kansas adjusted gross income',
  'formK40.ksStandardDeduction': 'KS standard deduction',
  'formK40.personalExemptions': 'KS personal exemptions',
  'formK40.ksTaxableIncome': 'Kansas taxable income',
  'formK40.ksTax': 'Kansas income tax',
  'formK40.dependentCareCredit': 'KS child/dependent care credit',
  'formK40.foodSalesTaxCredit': 'KS food sales tax credit',
  'formK40.taxAfterCredits': 'KS tax after credits',
  'formK40.stateWithholding': 'KS state income tax withheld',
  'formK40.overpaid': 'KS overpaid (refund)',
  'formK40.amountOwed': 'KS amount you owe',
}

function collectKSTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormK40Result
  const values = new Map<string, TracedValue>()

  const ksAGIInputs = ['form1040.line11']
  if (form.ksAdditions > 0) {
    ksAGIInputs.push('formK40.ksAdditions')
    values.set('formK40.ksAdditions', tracedFromComputation(
      form.ksAdditions, 'formK40.ksAdditions', [],
      'KS additions to federal AGI',
    ))
  }
  if (form.ksSubtractions > 0) {
    ksAGIInputs.push('formK40.ksSubtractions')
    values.set('formK40.ksSubtractions', tracedFromComputation(
      form.ksSubtractions, 'formK40.ksSubtractions', [],
      'KS subtractions (SS exemption, US gov interest)',
    ))
  }

  values.set('formK40.ksAGI', tracedFromComputation(
    form.ksAGI,
    'formK40.ksAGI',
    ksAGIInputs,
    'Kansas adjusted gross income',
  ))

  values.set('formK40.ksStandardDeduction', tracedFromComputation(
    form.ksStandardDeduction,
    'formK40.ksStandardDeduction',
    [],
    'KS standard deduction',
  ))

  if (form.personalExemptions > 0) {
    values.set('formK40.personalExemptions', tracedFromComputation(
      form.personalExemptions,
      'formK40.personalExemptions',
      [],
      `KS personal exemptions ($2,250 x ${form.numExemptions})`,
    ))
  }

  const taxableInputs = ['formK40.ksAGI', 'formK40.ksStandardDeduction']
  if (form.personalExemptions > 0) taxableInputs.push('formK40.personalExemptions')
  values.set('formK40.ksTaxableIncome', tracedFromComputation(
    form.ksTaxableIncome,
    'formK40.ksTaxableIncome',
    taxableInputs,
    'Kansas taxable income',
  ))

  values.set('formK40.ksTax', tracedFromComputation(
    form.ksTax,
    'formK40.ksTax',
    ['formK40.ksTaxableIncome'],
    'Kansas income tax (3.1% / 5.25% / 5.7%)',
  ))

  const taxAfterInputs = ['formK40.ksTax']
  if (form.dependentCareCredit > 0) {
    values.set('formK40.dependentCareCredit', tracedFromComputation(
      form.dependentCareCredit,
      'formK40.dependentCareCredit',
      [],
      'KS child/dependent care credit (25% of federal)',
    ))
    taxAfterInputs.push('formK40.dependentCareCredit')
  }

  values.set('formK40.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'formK40.taxAfterCredits',
    taxAfterInputs,
    'KS tax after credits',
  ))

  if (form.foodSalesTaxCredit > 0) {
    values.set('formK40.foodSalesTaxCredit', tracedFromComputation(
      form.foodSalesTaxCredit,
      'formK40.foodSalesTaxCredit',
      [],
      `KS food sales tax credit ($125 x ${form.numExemptions})`,
    ))
  }

  if (form.stateWithholding > 0) {
    values.set('formK40.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'formK40.stateWithholding',
      [],
      'KS state income tax withheld',
    ))
  }

  const resultInputs = ['formK40.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('formK40.stateWithholding')
  if (form.foodSalesTaxCredit > 0) resultInputs.push('formK40.foodSalesTaxCredit')

  if (form.overpaid > 0) {
    values.set('formK40.overpaid', tracedFromComputation(
      form.overpaid,
      'formK40.overpaid',
      resultInputs,
      'KS overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('formK40.amountOwed', tracedFromComputation(
      form.amountOwed,
      'formK40.amountOwed',
      resultInputs,
      'KS amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormK40Result {
  return result.detail as FormK40Result
}

const KS_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for Kansas income tax.',
          pubName: 'KS K-40 Instructions',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
      },
      {
        label: 'KS Additions',
        nodeId: 'formK40.ksAdditions',
        getValue: (r) => d(r).ksAdditions,
        showWhen: (r) => d(r).ksAdditions > 0,
        tooltip: {
          explanation: 'Kansas additions to federal AGI, including non-KS municipal bond interest and other state-specific items.',
          pubName: 'KS K-40 Schedule S',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
      },
      {
        label: 'KS Subtractions',
        nodeId: 'formK40.ksSubtractions',
        getValue: (r) => d(r).ksSubtractions,
        showWhen: (r) => d(r).ksSubtractions > 0,
        tooltip: {
          explanation: 'Kansas subtractions include Social Security exemption (for AGI under $75,000) and US government obligation interest.',
          pubName: 'KS K-40 Schedule S',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
      },
      {
        label: 'KS AGI',
        nodeId: 'formK40.ksAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Kansas adjusted gross income: Federal AGI + KS additions - KS subtractions.',
          pubName: 'KS K-40 Line 3',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'KS Standard Deduction',
        nodeId: 'formK40.ksStandardDeduction',
        getValue: (r) => d(r).ksStandardDeduction,
        tooltip: {
          explanation: 'Kansas standard deduction. KS uses its own amounts which are lower than federal standard deduction.',
          pubName: 'KS K-40 Line 4',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
      },
      {
        label: 'Personal Exemptions',
        nodeId: 'formK40.personalExemptions',
        getValue: (r) => d(r).personalExemptions,
        tooltip: {
          explanation: 'Kansas allows a $2,250 personal exemption for each person (taxpayer, spouse, and dependents).',
          pubName: 'KS K-40 Line 5',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
        showWhen: (r) => d(r).personalExemptions > 0,
      },
      {
        label: 'KS Taxable Income',
        nodeId: 'formK40.ksTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Kansas taxable income equals KS AGI minus standard deduction and personal exemptions.',
          pubName: 'KS K-40 Line 7',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'KS Tax (3.1% / 5.25% / 5.7%)',
        nodeId: 'formK40.ksTax',
        getValue: (r) => d(r).ksTax,
        tooltip: {
          explanation: 'Kansas income tax computed using 3 graduated brackets: 3.1% on the first bracket, 5.25% on the second, and 5.7% on the remainder.',
          pubName: 'KS K-40 Tax Table',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
      },
      {
        label: 'Dependent Care Credit',
        nodeId: 'formK40.dependentCareCredit',
        getValue: (r) => d(r).dependentCareCredit,
        showWhen: (r) => d(r).dependentCareCredit > 0,
        tooltip: {
          explanation: 'Kansas child and dependent care credit equals 25% of the federal child and dependent care credit.',
          pubName: 'KS K-40 Schedule K-21',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
      },
      {
        label: 'Food Sales Tax Credit',
        nodeId: 'formK40.foodSalesTaxCredit',
        getValue: (r) => d(r).foodSalesTaxCredit,
        showWhen: (r) => d(r).foodSalesTaxCredit > 0,
        tooltip: {
          explanation: 'Refundable Kansas food sales tax credit of $125 per person for filers with income under $30,615.',
          pubName: 'KS K-40 Line 20',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
      },
      {
        label: 'KS Tax After Credits',
        nodeId: 'formK40.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Kansas income tax after nonrefundable credits (dependent care). Food sales tax credit is refundable and applied against the balance due.',
          pubName: 'KS K-40 Instructions',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'KS State Withholding',
        nodeId: 'formK40.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Kansas tax withheld from W-2 Box 17 entries for KS.',
          pubName: 'KS K-40 Line 22',
          pubUrl: 'https://www.ksrevenue.gov/persincome.html',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const KS_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'KS Refund',
    nodeId: 'formK40.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'KS Amount You Owe',
    nodeId: 'formK40.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'KS tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const ksModule: StateRulesModule = {
  stateCode: 'KS',
  stateName: 'Kansas',
  formLabel: 'KS Form K-40',
  sidebarLabel: 'KS Form K-40',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormK40(model, federal, config))
  },
  nodeLabels: KS_NODE_LABELS,
  collectTracedValues: collectKSTracedValues,
  reviewLayout: KS_REVIEW_LAYOUT,
  reviewResultLines: KS_REVIEW_RESULT_LINES,
}
