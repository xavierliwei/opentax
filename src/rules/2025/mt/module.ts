/** MT state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm2, type Form2Result } from './form2'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: Form2Result): StateComputeResult {
  return {
    stateCode: 'MT',
    formLabel: 'MT Form 2',
    residencyType: form.residencyType,
    stateAGI: form.mtAGI,
    stateTaxableIncome: form.mtTaxableIncome,
    stateTax: form.mtTax,
    stateCredits: form.totalNonrefundableCredits + form.totalRefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const MT_NODE_LABELS: Record<string, string> = {
  'form2.mtAdditions': 'MT additions to federal AGI',
  'form2.mtSubtractions': 'MT subtractions from federal AGI',
  'form2.mtAGI': 'Montana adjusted gross income',
  'form2.mtStandardDeduction': 'MT standard deduction (20% of AGI)',
  'form2.personalExemptions': 'MT personal exemptions',
  'form2.mtTaxableIncome': 'Montana taxable income',
  'form2.mtTax': 'Montana income tax',
  'form2.taxAfterCredits': 'MT tax after credits',
  'form2.stateWithholding': 'MT state income tax withheld',
  'form2.overpaid': 'MT overpaid (refund)',
  'form2.amountOwed': 'MT amount you owe',
}

function collectMTTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as Form2Result
  const values = new Map<string, TracedValue>()

  const mtAGIInputs = ['form1040.line11']
  if (form.mtAdditions > 0) {
    mtAGIInputs.push('form2.mtAdditions')
    values.set('form2.mtAdditions', tracedFromComputation(
      form.mtAdditions, 'form2.mtAdditions', [],
      'MT additions to federal AGI',
    ))
  }
  if (form.mtSubtractions > 0) {
    mtAGIInputs.push('form2.mtSubtractions')
    values.set('form2.mtSubtractions', tracedFromComputation(
      form.mtSubtractions, 'form2.mtSubtractions', [],
      'MT subtractions (US gov interest)',
    ))
  }

  values.set('form2.mtAGI', tracedFromComputation(
    form.mtAGI,
    'form2.mtAGI',
    mtAGIInputs,
    'Montana adjusted gross income',
  ))

  values.set('form2.mtStandardDeduction', tracedFromComputation(
    form.mtStandardDeduction,
    'form2.mtStandardDeduction',
    [],
    'MT standard deduction (20% of AGI)',
  ))

  if (form.personalExemptions > 0) {
    values.set('form2.personalExemptions', tracedFromComputation(
      form.personalExemptions,
      'form2.personalExemptions',
      [],
      `MT personal exemptions ($3,000 x ${form.numExemptions})`,
    ))
  }

  const taxableInputs = ['form2.mtAGI', 'form2.mtStandardDeduction']
  if (form.personalExemptions > 0) taxableInputs.push('form2.personalExemptions')
  values.set('form2.mtTaxableIncome', tracedFromComputation(
    form.mtTaxableIncome,
    'form2.mtTaxableIncome',
    taxableInputs,
    'Montana taxable income',
  ))

  values.set('form2.mtTax', tracedFromComputation(
    form.mtTax,
    'form2.mtTax',
    ['form2.mtTaxableIncome'],
    'Montana income tax (4.7% / 5.9%)',
  ))

  values.set('form2.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'form2.taxAfterCredits',
    ['form2.mtTax'],
    'MT tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('form2.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'form2.stateWithholding',
      [],
      'MT state income tax withheld',
    ))
  }

  const resultInputs = ['form2.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('form2.stateWithholding')

  if (form.overpaid > 0) {
    values.set('form2.overpaid', tracedFromComputation(
      form.overpaid,
      'form2.overpaid',
      resultInputs,
      'MT overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('form2.amountOwed', tracedFromComputation(
      form.amountOwed,
      'form2.amountOwed',
      resultInputs,
      'MT amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form2Result {
  return result.detail as Form2Result
}

const MT_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for Montana income tax.',
          pubName: 'MT Form 2 Instructions',
          pubUrl: 'https://mtrevenue.gov/taxes/individual-income-tax/',
        },
      },
      {
        label: 'MT Subtractions',
        nodeId: 'form2.mtSubtractions',
        getValue: (r) => d(r).mtSubtractions,
        showWhen: (r) => d(r).mtSubtractions > 0,
        tooltip: {
          explanation: 'Montana subtractions include US government obligation interest.',
          pubName: 'MT Form 2 Schedule',
          pubUrl: 'https://mtrevenue.gov/taxes/individual-income-tax/',
        },
      },
      {
        label: 'MT AGI',
        nodeId: 'form2.mtAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Montana adjusted gross income: Federal AGI + MT additions - MT subtractions.',
          pubName: 'MT Form 2',
          pubUrl: 'https://mtrevenue.gov/taxes/individual-income-tax/',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'MT Standard Deduction (20% of AGI)',
        nodeId: 'form2.mtStandardDeduction',
        getValue: (r) => d(r).mtStandardDeduction,
        tooltip: {
          explanation: 'Montana standard deduction equals 20% of Montana AGI, capped by filing status. Montana does NOT conform to federal standard deduction amounts.',
          pubName: 'MT Form 2',
          pubUrl: 'https://mtrevenue.gov/taxes/individual-income-tax/',
        },
      },
      {
        label: 'Personal Exemptions',
        nodeId: 'form2.personalExemptions',
        getValue: (r) => d(r).personalExemptions,
        showWhen: (r) => d(r).personalExemptions > 0,
        tooltip: {
          explanation: 'Montana allows a $3,000 personal exemption per person (taxpayer, spouse, dependents).',
          pubName: 'MT Form 2',
          pubUrl: 'https://mtrevenue.gov/taxes/individual-income-tax/',
        },
      },
      {
        label: 'MT Taxable Income',
        nodeId: 'form2.mtTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Montana taxable income equals MT AGI minus standard deduction and personal exemptions.',
          pubName: 'MT Form 2',
          pubUrl: 'https://mtrevenue.gov/taxes/individual-income-tax/',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'MT Tax (4.7% / 5.9%)',
        nodeId: 'form2.mtTax',
        getValue: (r) => d(r).mtTax,
        tooltip: {
          explanation: 'Montana income tax computed using 2 graduated brackets: 4.7% on the first $20,500 and 5.9% on the remainder.',
          pubName: 'MT Tax Table',
          pubUrl: 'https://mtrevenue.gov/taxes/individual-income-tax/',
        },
      },
      {
        label: 'MT Tax After Credits',
        nodeId: 'form2.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Montana income tax after credits.',
          pubName: 'MT Form 2 Instructions',
          pubUrl: 'https://mtrevenue.gov/taxes/individual-income-tax/',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'MT State Withholding',
        nodeId: 'form2.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Montana tax withheld from W-2 Box 17 entries for MT.',
          pubName: 'MT Form 2',
          pubUrl: 'https://mtrevenue.gov/taxes/individual-income-tax/',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const MT_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'MT Refund',
    nodeId: 'form2.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'MT Amount You Owe',
    nodeId: 'form2.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'MT tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const mtModule: StateRulesModule = {
  stateCode: 'MT',
  stateName: 'Montana',
  formLabel: 'MT Form 2',
  sidebarLabel: 'MT Form 2',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm2(model, federal, config))
  },
  nodeLabels: MT_NODE_LABELS,
  collectTracedValues: collectMTTracedValues,
  reviewLayout: MT_REVIEW_LAYOUT,
  reviewResultLines: MT_REVIEW_RESULT_LINES,
}
