/** ME state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm1040ME, type Form1040MEResult } from './form1040ME'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: Form1040MEResult): StateComputeResult {
  return {
    stateCode: 'ME',
    formLabel: 'ME Form 1040ME',
    residencyType: form.residencyType,
    stateAGI: form.meAGI,
    stateTaxableIncome: form.meTaxableIncome,
    stateTax: form.meTax,
    stateCredits: form.totalNonrefundableCredits + form.totalRefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const ME_NODE_LABELS: Record<string, string> = {
  'form1040ME.meAdditions': 'ME additions to federal AGI',
  'form1040ME.meSubtractions': 'ME subtractions from federal AGI',
  'form1040ME.meAGI': 'Maine adjusted gross income',
  'form1040ME.meStandardDeduction': 'ME standard deduction',
  'form1040ME.personalExemptions': 'ME personal exemptions',
  'form1040ME.meTaxableIncome': 'Maine taxable income',
  'form1040ME.meTax': 'Maine income tax',
  'form1040ME.dependentCareCredit': 'ME child/dependent care credit',
  'form1040ME.meEITC': 'ME earned income credit',
  'form1040ME.taxAfterCredits': 'ME tax after credits',
  'form1040ME.stateWithholding': 'ME state income tax withheld',
  'form1040ME.overpaid': 'ME overpaid (refund)',
  'form1040ME.amountOwed': 'ME amount you owe',
}

function collectMETracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as Form1040MEResult
  const values = new Map<string, TracedValue>()

  const meAGIInputs = ['form1040.line11']
  if (form.meAdditions > 0) {
    meAGIInputs.push('form1040ME.meAdditions')
    values.set('form1040ME.meAdditions', tracedFromComputation(
      form.meAdditions, 'form1040ME.meAdditions', [],
      'ME additions to federal AGI',
    ))
  }
  if (form.meSubtractions > 0) {
    meAGIInputs.push('form1040ME.meSubtractions')
    values.set('form1040ME.meSubtractions', tracedFromComputation(
      form.meSubtractions, 'form1040ME.meSubtractions', [],
      'ME subtractions (US gov interest)',
    ))
  }

  values.set('form1040ME.meAGI', tracedFromComputation(
    form.meAGI,
    'form1040ME.meAGI',
    meAGIInputs,
    'Maine adjusted gross income',
  ))

  values.set('form1040ME.meStandardDeduction', tracedFromComputation(
    form.meStandardDeduction,
    'form1040ME.meStandardDeduction',
    [],
    'ME standard deduction',
  ))

  if (form.personalExemptions > 0) {
    values.set('form1040ME.personalExemptions', tracedFromComputation(
      form.personalExemptions,
      'form1040ME.personalExemptions',
      [],
      `ME personal exemptions ($5,000 x ${form.numExemptions})`,
    ))
  }

  const taxableInputs = ['form1040ME.meAGI', 'form1040ME.meStandardDeduction']
  if (form.personalExemptions > 0) taxableInputs.push('form1040ME.personalExemptions')
  values.set('form1040ME.meTaxableIncome', tracedFromComputation(
    form.meTaxableIncome,
    'form1040ME.meTaxableIncome',
    taxableInputs,
    'Maine taxable income',
  ))

  values.set('form1040ME.meTax', tracedFromComputation(
    form.meTax,
    'form1040ME.meTax',
    ['form1040ME.meTaxableIncome'],
    'Maine income tax (5.8% / 6.75% / 7.15%)',
  ))

  const taxAfterInputs = ['form1040ME.meTax']
  if (form.dependentCareCredit > 0) {
    values.set('form1040ME.dependentCareCredit', tracedFromComputation(
      form.dependentCareCredit,
      'form1040ME.dependentCareCredit',
      [],
      'ME child/dependent care credit (25% of federal)',
    ))
    taxAfterInputs.push('form1040ME.dependentCareCredit')
  }

  values.set('form1040ME.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'form1040ME.taxAfterCredits',
    taxAfterInputs,
    'ME tax after credits',
  ))

  if (form.meEITC > 0) {
    values.set('form1040ME.meEITC', tracedFromComputation(
      form.meEITC,
      'form1040ME.meEITC',
      [],
      'ME earned income credit (25% of federal EITC)',
    ))
  }

  if (form.stateWithholding > 0) {
    values.set('form1040ME.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'form1040ME.stateWithholding',
      [],
      'ME state income tax withheld',
    ))
  }

  const resultInputs = ['form1040ME.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('form1040ME.stateWithholding')
  if (form.meEITC > 0) resultInputs.push('form1040ME.meEITC')

  if (form.overpaid > 0) {
    values.set('form1040ME.overpaid', tracedFromComputation(
      form.overpaid,
      'form1040ME.overpaid',
      resultInputs,
      'ME overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('form1040ME.amountOwed', tracedFromComputation(
      form.amountOwed,
      'form1040ME.amountOwed',
      resultInputs,
      'ME amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form1040MEResult {
  return result.detail as Form1040MEResult
}

const ME_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for Maine income tax.',
          pubName: 'ME Form 1040ME Instructions',
          pubUrl: 'https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax',
        },
      },
      {
        label: 'ME Subtractions',
        nodeId: 'form1040ME.meSubtractions',
        getValue: (r) => d(r).meSubtractions,
        showWhen: (r) => d(r).meSubtractions > 0,
        tooltip: {
          explanation: 'Maine subtractions include US government obligation interest.',
          pubName: 'ME Form 1040ME Schedule 1',
          pubUrl: 'https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax',
        },
      },
      {
        label: 'ME AGI',
        nodeId: 'form1040ME.meAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Maine adjusted gross income: Federal AGI + ME additions - ME subtractions.',
          pubName: 'ME Form 1040ME',
          pubUrl: 'https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'ME Standard Deduction',
        nodeId: 'form1040ME.meStandardDeduction',
        getValue: (r) => d(r).meStandardDeduction,
        tooltip: {
          explanation: 'Maine follows the federal standard deduction amounts.',
          pubName: 'ME Form 1040ME',
          pubUrl: 'https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax',
        },
      },
      {
        label: 'Personal Exemptions',
        nodeId: 'form1040ME.personalExemptions',
        getValue: (r) => d(r).personalExemptions,
        showWhen: (r) => d(r).personalExemptions > 0,
        tooltip: {
          explanation: 'Maine allows a $5,000 personal exemption per person (taxpayer, spouse, dependents).',
          pubName: 'ME Form 1040ME',
          pubUrl: 'https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax',
        },
      },
      {
        label: 'ME Taxable Income',
        nodeId: 'form1040ME.meTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Maine taxable income equals ME AGI minus standard deduction and personal exemptions.',
          pubName: 'ME Form 1040ME',
          pubUrl: 'https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'ME Tax (5.8% / 6.75% / 7.15%)',
        nodeId: 'form1040ME.meTax',
        getValue: (r) => d(r).meTax,
        tooltip: {
          explanation: 'Maine income tax computed using 3 graduated brackets: 5.8% on the first bracket, 6.75% on the second, and 7.15% on the remainder.',
          pubName: 'ME Tax Table',
          pubUrl: 'https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax',
        },
      },
      {
        label: 'Dependent Care Credit',
        nodeId: 'form1040ME.dependentCareCredit',
        getValue: (r) => d(r).dependentCareCredit,
        showWhen: (r) => d(r).dependentCareCredit > 0,
        tooltip: {
          explanation: 'Maine child and dependent care credit equals 25% of the federal child and dependent care credit.',
          pubName: 'ME Form 1040ME',
          pubUrl: 'https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax',
        },
      },
      {
        label: 'ME Earned Income Credit',
        nodeId: 'form1040ME.meEITC',
        getValue: (r) => d(r).meEITC,
        showWhen: (r) => d(r).meEITC > 0,
        tooltip: {
          explanation: 'Refundable Maine EITC equals 25% of the federal earned income credit.',
          pubName: 'ME Form 1040ME',
          pubUrl: 'https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax',
        },
      },
      {
        label: 'ME Tax After Credits',
        nodeId: 'form1040ME.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Maine income tax after nonrefundable credits. ME EITC is refundable and applied against the balance due.',
          pubName: 'ME Form 1040ME Instructions',
          pubUrl: 'https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'ME State Withholding',
        nodeId: 'form1040ME.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Maine tax withheld from W-2 Box 17 entries for ME.',
          pubName: 'ME Form 1040ME',
          pubUrl: 'https://www.maine.gov/revenue/taxes/income-estate-tax/individual-income-tax',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const ME_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'ME Refund',
    nodeId: 'form1040ME.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'ME Amount You Owe',
    nodeId: 'form1040ME.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'ME tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const meModule: StateRulesModule = {
  stateCode: 'ME',
  stateName: 'Maine',
  formLabel: 'ME Form 1040ME',
  sidebarLabel: 'ME Form 1040ME',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm1040ME(model, federal, config))
  },
  nodeLabels: ME_NODE_LABELS,
  collectTracedValues: collectMETracedValues,
  reviewLayout: ME_REVIEW_LAYOUT,
  reviewResultLines: ME_REVIEW_RESULT_LINES,
}
