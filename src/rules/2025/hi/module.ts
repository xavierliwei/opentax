/** HI state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormN11, type FormN11Result } from './formN11'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormN11Result): StateComputeResult {
  return {
    stateCode: 'HI',
    formLabel: 'HI Form N-11',
    residencyType: form.residencyType,
    stateAGI: form.hiAGI,
    stateTaxableIncome: form.hiTaxableIncome,
    stateTax: form.hiTax,
    stateCredits: form.totalNonrefundableCredits + form.totalRefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const HI_NODE_LABELS: Record<string, string> = {
  'formN11.hiAdditions': 'HI additions to federal AGI',
  'formN11.hiSubtractions': 'HI subtractions from federal AGI',
  'formN11.hiAGI': 'Hawaii adjusted gross income',
  'formN11.hiStandardDeduction': 'HI standard deduction',
  'formN11.personalExemptions': 'HI personal exemptions',
  'formN11.hiTaxableIncome': 'Hawaii taxable income',
  'formN11.hiTax': 'Hawaii income tax',
  'formN11.hiEITC': 'HI earned income credit',
  'formN11.foodExciseTaxCredit': 'HI food/excise tax credit',
  'formN11.taxAfterCredits': 'HI tax after credits',
  'formN11.stateWithholding': 'HI state income tax withheld',
  'formN11.overpaid': 'HI overpaid (refund)',
  'formN11.amountOwed': 'HI amount you owe',
}

function collectHITracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormN11Result
  const values = new Map<string, TracedValue>()

  const hiAGIInputs = ['form1040.line11']
  if (form.hiAdditions > 0) {
    hiAGIInputs.push('formN11.hiAdditions')
    values.set('formN11.hiAdditions', tracedFromComputation(
      form.hiAdditions, 'formN11.hiAdditions', [],
      'HI additions to federal AGI',
    ))
  }
  if (form.hiSubtractions > 0) {
    hiAGIInputs.push('formN11.hiSubtractions')
    values.set('formN11.hiSubtractions', tracedFromComputation(
      form.hiSubtractions, 'formN11.hiSubtractions', [],
      'HI subtractions (US gov interest)',
    ))
  }

  values.set('formN11.hiAGI', tracedFromComputation(
    form.hiAGI,
    'formN11.hiAGI',
    hiAGIInputs,
    'Hawaii adjusted gross income',
  ))

  values.set('formN11.hiStandardDeduction', tracedFromComputation(
    form.hiStandardDeduction,
    'formN11.hiStandardDeduction',
    [],
    'HI standard deduction',
  ))

  if (form.personalExemptions > 0) {
    values.set('formN11.personalExemptions', tracedFromComputation(
      form.personalExemptions,
      'formN11.personalExemptions',
      [],
      `HI personal exemptions ($1,144 x ${form.numExemptions})`,
    ))
  }

  const taxableInputs = ['formN11.hiAGI', 'formN11.hiStandardDeduction']
  if (form.personalExemptions > 0) taxableInputs.push('formN11.personalExemptions')
  values.set('formN11.hiTaxableIncome', tracedFromComputation(
    form.hiTaxableIncome,
    'formN11.hiTaxableIncome',
    taxableInputs,
    'Hawaii taxable income',
  ))

  values.set('formN11.hiTax', tracedFromComputation(
    form.hiTax,
    'formN11.hiTax',
    ['formN11.hiTaxableIncome'],
    'Hawaii income tax (12 brackets, 1.4%–11%)',
  ))

  const taxAfterInputs = ['formN11.hiTax']
  if (form.hiEITC > 0) {
    values.set('formN11.hiEITC', tracedFromComputation(
      form.hiEITC,
      'formN11.hiEITC',
      [],
      'HI earned income credit (20% of federal, nonrefundable)',
    ))
    taxAfterInputs.push('formN11.hiEITC')
  }

  if (form.foodExciseTaxCredit > 0) {
    values.set('formN11.foodExciseTaxCredit', tracedFromComputation(
      form.foodExciseTaxCredit,
      'formN11.foodExciseTaxCredit',
      [],
      `HI food/excise tax credit ($110 x ${form.numExemptions})`,
    ))
    taxAfterInputs.push('formN11.foodExciseTaxCredit')
  }

  values.set('formN11.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'formN11.taxAfterCredits',
    taxAfterInputs,
    'HI tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('formN11.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'formN11.stateWithholding',
      [],
      'HI state income tax withheld',
    ))
  }

  const resultInputs = ['formN11.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('formN11.stateWithholding')

  if (form.overpaid > 0) {
    values.set('formN11.overpaid', tracedFromComputation(
      form.overpaid,
      'formN11.overpaid',
      resultInputs,
      'HI overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('formN11.amountOwed', tracedFromComputation(
      form.amountOwed,
      'formN11.amountOwed',
      resultInputs,
      'HI amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormN11Result {
  return result.detail as FormN11Result
}

const HI_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for Hawaii income tax.',
          pubName: 'HI Form N-11 Instructions',
          pubUrl: 'https://tax.hawaii.gov/forms/a1_b1_1resid/',
        },
      },
      {
        label: 'HI Subtractions',
        nodeId: 'formN11.hiSubtractions',
        getValue: (r) => d(r).hiSubtractions,
        showWhen: (r) => d(r).hiSubtractions > 0,
        tooltip: {
          explanation: 'Hawaii subtractions include US government obligation interest.',
          pubName: 'HI Form N-11',
          pubUrl: 'https://tax.hawaii.gov/forms/a1_b1_1resid/',
        },
      },
      {
        label: 'HI AGI',
        nodeId: 'formN11.hiAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Hawaii adjusted gross income: Federal AGI + HI additions - HI subtractions.',
          pubName: 'HI Form N-11',
          pubUrl: 'https://tax.hawaii.gov/forms/a1_b1_1resid/',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'HI Standard Deduction',
        nodeId: 'formN11.hiStandardDeduction',
        getValue: (r) => d(r).hiStandardDeduction,
        tooltip: {
          explanation: 'Hawaii standard deduction. Hawaii uses its own lower deduction amounts.',
          pubName: 'HI Form N-11',
          pubUrl: 'https://tax.hawaii.gov/forms/a1_b1_1resid/',
        },
      },
      {
        label: 'Personal Exemptions',
        nodeId: 'formN11.personalExemptions',
        getValue: (r) => d(r).personalExemptions,
        showWhen: (r) => d(r).personalExemptions > 0,
        tooltip: {
          explanation: 'Hawaii allows a $1,144 personal exemption per person (taxpayer, spouse, dependents).',
          pubName: 'HI Form N-11',
          pubUrl: 'https://tax.hawaii.gov/forms/a1_b1_1resid/',
        },
      },
      {
        label: 'HI Taxable Income',
        nodeId: 'formN11.hiTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Hawaii taxable income equals HI AGI minus standard deduction and personal exemptions.',
          pubName: 'HI Form N-11',
          pubUrl: 'https://tax.hawaii.gov/forms/a1_b1_1resid/',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'HI Tax (12 brackets, 1.4%–11%)',
        nodeId: 'formN11.hiTax',
        getValue: (r) => d(r).hiTax,
        tooltip: {
          explanation: 'Hawaii income tax uses 12 graduated brackets from 1.4% to 11% — the most brackets of any state.',
          pubName: 'HI Tax Table',
          pubUrl: 'https://tax.hawaii.gov/forms/a1_b1_1resid/',
        },
      },
      {
        label: 'HI Earned Income Credit',
        nodeId: 'formN11.hiEITC',
        getValue: (r) => d(r).hiEITC,
        showWhen: (r) => d(r).hiEITC > 0,
        tooltip: {
          explanation: 'Hawaii EITC equals 20% of the federal earned income credit (nonrefundable).',
          pubName: 'HI Form N-11',
          pubUrl: 'https://tax.hawaii.gov/forms/a1_b1_1resid/',
        },
      },
      {
        label: 'Food/Excise Tax Credit',
        nodeId: 'formN11.foodExciseTaxCredit',
        getValue: (r) => d(r).foodExciseTaxCredit,
        showWhen: (r) => d(r).foodExciseTaxCredit > 0,
        tooltip: {
          explanation: 'Hawaii food/excise tax credit of $110 per exemption for qualifying low/moderate income filers.',
          pubName: 'HI Form N-11',
          pubUrl: 'https://tax.hawaii.gov/forms/a1_b1_1resid/',
        },
      },
      {
        label: 'HI Tax After Credits',
        nodeId: 'formN11.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Hawaii income tax after all nonrefundable credits.',
          pubName: 'HI Form N-11 Instructions',
          pubUrl: 'https://tax.hawaii.gov/forms/a1_b1_1resid/',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'HI State Withholding',
        nodeId: 'formN11.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Hawaii tax withheld from W-2 Box 17 entries for HI.',
          pubName: 'HI Form N-11',
          pubUrl: 'https://tax.hawaii.gov/forms/a1_b1_1resid/',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const HI_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'HI Refund',
    nodeId: 'formN11.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'HI Amount You Owe',
    nodeId: 'formN11.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'HI tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const hiModule: StateRulesModule = {
  stateCode: 'HI',
  stateName: 'Hawaii',
  formLabel: 'HI Form N-11',
  sidebarLabel: 'HI Form N-11',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormN11(model, federal, config))
  },
  nodeLabels: HI_NODE_LABELS,
  collectTracedValues: collectHITracedValues,
  reviewLayout: HI_REVIEW_LAYOUT,
  reviewResultLines: HI_REVIEW_RESULT_LINES,
}
