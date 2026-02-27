/** AR state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormAR1000F, type FormAR1000FResult } from './formAR1000F'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormAR1000FResult): StateComputeResult {
  return {
    stateCode: 'AR',
    formLabel: 'AR Form AR1000F',
    residencyType: form.residencyType,
    stateAGI: form.arAGI,
    stateTaxableIncome: form.arTaxableIncome,
    stateTax: form.arTax,
    stateCredits: form.totalNonrefundableCredits + form.totalRefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const AR_NODE_LABELS: Record<string, string> = {
  'ar1000f.arAdditions': 'AR additions to federal AGI',
  'ar1000f.arSubtractions': 'AR subtractions from federal AGI',
  'ar1000f.arAGI': 'Arkansas adjusted gross income',
  'ar1000f.arStandardDeduction': 'AR standard deduction',
  'ar1000f.arTaxableIncome': 'Arkansas taxable income',
  'ar1000f.arTax': 'Arkansas income tax',
  'ar1000f.personalTaxCredit': 'AR personal tax credit',
  'ar1000f.arEITC': 'AR earned income credit',
  'ar1000f.taxAfterCredits': 'AR tax after credits',
  'ar1000f.stateWithholding': 'AR state income tax withheld',
  'ar1000f.overpaid': 'AR overpaid (refund)',
  'ar1000f.amountOwed': 'AR amount you owe',
}

function collectARTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormAR1000FResult
  const values = new Map<string, TracedValue>()

  const arAGIInputs = ['form1040.line11']
  if (form.arAdditions > 0) {
    arAGIInputs.push('ar1000f.arAdditions')
    values.set('ar1000f.arAdditions', tracedFromComputation(
      form.arAdditions, 'ar1000f.arAdditions', [],
      'AR additions to federal AGI',
    ))
  }
  if (form.arSubtractions > 0) {
    arAGIInputs.push('ar1000f.arSubtractions')
    values.set('ar1000f.arSubtractions', tracedFromComputation(
      form.arSubtractions, 'ar1000f.arSubtractions', [],
      'AR subtractions (US gov interest)',
    ))
  }

  values.set('ar1000f.arAGI', tracedFromComputation(
    form.arAGI,
    'ar1000f.arAGI',
    arAGIInputs,
    'Arkansas adjusted gross income',
  ))

  values.set('ar1000f.arStandardDeduction', tracedFromComputation(
    form.arStandardDeduction,
    'ar1000f.arStandardDeduction',
    [],
    'AR standard deduction',
  ))

  const taxableInputs = ['ar1000f.arAGI', 'ar1000f.arStandardDeduction']
  values.set('ar1000f.arTaxableIncome', tracedFromComputation(
    form.arTaxableIncome,
    'ar1000f.arTaxableIncome',
    taxableInputs,
    'Arkansas taxable income',
  ))

  values.set('ar1000f.arTax', tracedFromComputation(
    form.arTax,
    'ar1000f.arTax',
    ['ar1000f.arTaxableIncome'],
    'Arkansas income tax (2% / 4% / 4.4%)',
  ))

  const taxAfterInputs = ['ar1000f.arTax']
  if (form.personalTaxCredit > 0) {
    values.set('ar1000f.personalTaxCredit', tracedFromComputation(
      form.personalTaxCredit,
      'ar1000f.personalTaxCredit',
      [],
      `AR personal tax credit ($29 x ${form.numExemptions})`,
    ))
    taxAfterInputs.push('ar1000f.personalTaxCredit')
  }

  if (form.arEITC > 0) {
    values.set('ar1000f.arEITC', tracedFromComputation(
      form.arEITC,
      'ar1000f.arEITC',
      [],
      'AR earned income credit (20% of federal, nonrefundable)',
    ))
    taxAfterInputs.push('ar1000f.arEITC')
  }

  values.set('ar1000f.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'ar1000f.taxAfterCredits',
    taxAfterInputs,
    'AR tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('ar1000f.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'ar1000f.stateWithholding',
      [],
      'AR state income tax withheld',
    ))
  }

  const resultInputs = ['ar1000f.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('ar1000f.stateWithholding')

  if (form.overpaid > 0) {
    values.set('ar1000f.overpaid', tracedFromComputation(
      form.overpaid,
      'ar1000f.overpaid',
      resultInputs,
      'AR overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('ar1000f.amountOwed', tracedFromComputation(
      form.amountOwed,
      'ar1000f.amountOwed',
      resultInputs,
      'AR amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormAR1000FResult {
  return result.detail as FormAR1000FResult
}

const AR_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for Arkansas income tax.',
          pubName: 'AR Form AR1000F Instructions',
          pubUrl: 'https://www.dfa.arkansas.gov/income-tax/',
        },
      },
      {
        label: 'AR Subtractions',
        nodeId: 'ar1000f.arSubtractions',
        getValue: (r) => d(r).arSubtractions,
        showWhen: (r) => d(r).arSubtractions > 0,
        tooltip: {
          explanation: 'Arkansas subtractions include US government obligation interest.',
          pubName: 'AR Form AR1000F',
          pubUrl: 'https://www.dfa.arkansas.gov/income-tax/',
        },
      },
      {
        label: 'AR AGI',
        nodeId: 'ar1000f.arAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Arkansas adjusted gross income: Federal AGI + AR additions - AR subtractions.',
          pubName: 'AR Form AR1000F',
          pubUrl: 'https://www.dfa.arkansas.gov/income-tax/',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'AR Standard Deduction',
        nodeId: 'ar1000f.arStandardDeduction',
        getValue: (r) => d(r).arStandardDeduction,
        tooltip: {
          explanation: 'Arkansas standard deduction ($2,340 single / $4,680 joint).',
          pubName: 'AR Form AR1000F',
          pubUrl: 'https://www.dfa.arkansas.gov/income-tax/',
        },
      },
      {
        label: 'AR Taxable Income',
        nodeId: 'ar1000f.arTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Arkansas taxable income equals AR AGI minus the standard deduction.',
          pubName: 'AR Form AR1000F',
          pubUrl: 'https://www.dfa.arkansas.gov/income-tax/',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'AR Tax (2% / 4% / 4.4%)',
        nodeId: 'ar1000f.arTax',
        getValue: (r) => d(r).arTax,
        tooltip: {
          explanation: 'Arkansas income tax computed using 3 graduated brackets: 2% on the first bracket, 4% on the second, and 4.4% on the remainder.',
          pubName: 'AR Tax Table',
          pubUrl: 'https://www.dfa.arkansas.gov/income-tax/',
        },
      },
      {
        label: 'Personal Tax Credit',
        nodeId: 'ar1000f.personalTaxCredit',
        getValue: (r) => d(r).personalTaxCredit,
        showWhen: (r) => d(r).personalTaxCredit > 0,
        tooltip: {
          explanation: 'Arkansas allows a $29 personal tax credit per exemption (taxpayer, spouse, dependents).',
          pubName: 'AR Form AR1000F',
          pubUrl: 'https://www.dfa.arkansas.gov/income-tax/',
        },
      },
      {
        label: 'AR Earned Income Credit',
        nodeId: 'ar1000f.arEITC',
        getValue: (r) => d(r).arEITC,
        showWhen: (r) => d(r).arEITC > 0,
        tooltip: {
          explanation: 'Arkansas EITC equals 20% of the federal earned income credit (nonrefundable).',
          pubName: 'AR Form AR1000F',
          pubUrl: 'https://www.dfa.arkansas.gov/income-tax/',
        },
      },
      {
        label: 'AR Tax After Credits',
        nodeId: 'ar1000f.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Arkansas income tax after all nonrefundable credits.',
          pubName: 'AR Form AR1000F Instructions',
          pubUrl: 'https://www.dfa.arkansas.gov/income-tax/',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'AR State Withholding',
        nodeId: 'ar1000f.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Arkansas tax withheld from W-2 Box 17 entries for AR.',
          pubName: 'AR Form AR1000F',
          pubUrl: 'https://www.dfa.arkansas.gov/income-tax/',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const AR_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'AR Refund',
    nodeId: 'ar1000f.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'AR Amount You Owe',
    nodeId: 'ar1000f.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'AR tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const arModule: StateRulesModule = {
  stateCode: 'AR',
  stateName: 'Arkansas',
  formLabel: 'AR Form AR1000F',
  sidebarLabel: 'AR Form AR1000F',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormAR1000F(model, federal, config))
  },
  nodeLabels: AR_NODE_LABELS,
  collectTracedValues: collectARTracedValues,
  reviewLayout: AR_REVIEW_LAYOUT,
  reviewResultLines: AR_REVIEW_RESULT_LINES,
}
