/** WV state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormIT140, type FormIT140Result } from './formIT140'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormIT140Result): StateComputeResult {
  return {
    stateCode: 'WV',
    formLabel: 'WV Form IT-140',
    residencyType: form.residencyType,
    stateAGI: form.wvAGI,
    stateTaxableIncome: form.wvTaxableIncome,
    stateTax: form.wvTax,
    stateCredits: form.totalNonrefundableCredits + form.totalRefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const WV_NODE_LABELS: Record<string, string> = {
  'it140.wvAdditions': 'WV additions to federal AGI',
  'it140.wvSubtractions': 'WV subtractions from federal AGI',
  'it140.wvAGI': 'West Virginia adjusted gross income',
  'it140.wvStandardDeduction': 'WV standard deduction',
  'it140.personalExemptions': 'WV personal exemptions',
  'it140.wvTaxableIncome': 'West Virginia taxable income',
  'it140.wvTax': 'West Virginia income tax',
  'it140.taxAfterCredits': 'WV tax after credits',
  'it140.stateWithholding': 'WV state income tax withheld',
  'it140.overpaid': 'WV overpaid (refund)',
  'it140.amountOwed': 'WV amount you owe',
}

function collectWVTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormIT140Result
  const values = new Map<string, TracedValue>()

  const wvAGIInputs = ['form1040.line11']
  if (form.wvAdditions > 0) {
    wvAGIInputs.push('it140.wvAdditions')
    values.set('it140.wvAdditions', tracedFromComputation(
      form.wvAdditions, 'it140.wvAdditions', [],
      'WV additions to federal AGI',
    ))
  }
  if (form.wvSubtractions > 0) {
    wvAGIInputs.push('it140.wvSubtractions')
    values.set('it140.wvSubtractions', tracedFromComputation(
      form.wvSubtractions, 'it140.wvSubtractions', [],
      'WV subtractions (SS exemption, US gov interest)',
    ))
  }

  values.set('it140.wvAGI', tracedFromComputation(
    form.wvAGI,
    'it140.wvAGI',
    wvAGIInputs,
    'West Virginia adjusted gross income',
  ))

  values.set('it140.wvStandardDeduction', tracedFromComputation(
    form.wvStandardDeduction,
    'it140.wvStandardDeduction',
    [],
    'WV standard deduction',
  ))

  if (form.personalExemptions > 0) {
    values.set('it140.personalExemptions', tracedFromComputation(
      form.personalExemptions,
      'it140.personalExemptions',
      [],
      `WV personal exemptions ($2,000 x ${form.numExemptions})`,
    ))
  }

  const taxableInputs = ['it140.wvAGI', 'it140.wvStandardDeduction']
  if (form.personalExemptions > 0) taxableInputs.push('it140.personalExemptions')
  values.set('it140.wvTaxableIncome', tracedFromComputation(
    form.wvTaxableIncome,
    'it140.wvTaxableIncome',
    taxableInputs,
    'West Virginia taxable income',
  ))

  values.set('it140.wvTax', tracedFromComputation(
    form.wvTax,
    'it140.wvTax',
    ['it140.wvTaxableIncome'],
    'West Virginia income tax (2.36% / 3.15% / 5.12%)',
  ))

  values.set('it140.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'it140.taxAfterCredits',
    ['it140.wvTax'],
    'WV tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('it140.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'it140.stateWithholding',
      [],
      'WV state income tax withheld',
    ))
  }

  const resultInputs = ['it140.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('it140.stateWithholding')

  if (form.overpaid > 0) {
    values.set('it140.overpaid', tracedFromComputation(
      form.overpaid,
      'it140.overpaid',
      resultInputs,
      'WV overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('it140.amountOwed', tracedFromComputation(
      form.amountOwed,
      'it140.amountOwed',
      resultInputs,
      'WV amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormIT140Result {
  return result.detail as FormIT140Result
}

const WV_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for West Virginia income tax.',
          pubName: 'WV Form IT-140 Instructions',
          pubUrl: 'https://tax.wv.gov/Individuals/Pages/IncomeTax.aspx',
        },
      },
      {
        label: 'WV Subtractions',
        nodeId: 'it140.wvSubtractions',
        getValue: (r) => d(r).wvSubtractions,
        showWhen: (r) => d(r).wvSubtractions > 0,
        tooltip: {
          explanation: 'West Virginia subtractions include full Social Security exemption and US government obligation interest.',
          pubName: 'WV Form IT-140 Schedule M',
          pubUrl: 'https://tax.wv.gov/Individuals/Pages/IncomeTax.aspx',
        },
      },
      {
        label: 'WV AGI',
        nodeId: 'it140.wvAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'West Virginia adjusted gross income: Federal AGI + WV additions - WV subtractions.',
          pubName: 'WV Form IT-140',
          pubUrl: 'https://tax.wv.gov/Individuals/Pages/IncomeTax.aspx',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'WV Standard Deduction',
        nodeId: 'it140.wvStandardDeduction',
        getValue: (r) => d(r).wvStandardDeduction,
        tooltip: {
          explanation: 'West Virginia follows federal standard deduction amounts.',
          pubName: 'WV Form IT-140',
          pubUrl: 'https://tax.wv.gov/Individuals/Pages/IncomeTax.aspx',
        },
      },
      {
        label: 'Personal Exemptions',
        nodeId: 'it140.personalExemptions',
        getValue: (r) => d(r).personalExemptions,
        showWhen: (r) => d(r).personalExemptions > 0,
        tooltip: {
          explanation: 'West Virginia allows a $2,000 personal exemption per person (taxpayer, spouse, dependents).',
          pubName: 'WV Form IT-140',
          pubUrl: 'https://tax.wv.gov/Individuals/Pages/IncomeTax.aspx',
        },
      },
      {
        label: 'WV Taxable Income',
        nodeId: 'it140.wvTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'West Virginia taxable income equals WV AGI minus standard deduction and personal exemptions.',
          pubName: 'WV Form IT-140',
          pubUrl: 'https://tax.wv.gov/Individuals/Pages/IncomeTax.aspx',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'WV Tax (2.36% / 3.15% / 5.12%)',
        nodeId: 'it140.wvTax',
        getValue: (r) => d(r).wvTax,
        tooltip: {
          explanation: 'West Virginia income tax computed using 3 graduated brackets: 2.36% on the first bracket, 3.15% on the second, and 5.12% on the remainder.',
          pubName: 'WV Tax Table',
          pubUrl: 'https://tax.wv.gov/Individuals/Pages/IncomeTax.aspx',
        },
      },
      {
        label: 'WV Tax After Credits',
        nodeId: 'it140.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net West Virginia income tax after credits.',
          pubName: 'WV Form IT-140 Instructions',
          pubUrl: 'https://tax.wv.gov/Individuals/Pages/IncomeTax.aspx',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'WV State Withholding',
        nodeId: 'it140.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'West Virginia tax withheld from W-2 Box 17 entries for WV.',
          pubName: 'WV Form IT-140',
          pubUrl: 'https://tax.wv.gov/Individuals/Pages/IncomeTax.aspx',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const WV_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'WV Refund',
    nodeId: 'it140.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'WV Amount You Owe',
    nodeId: 'it140.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'WV tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const wvModule: StateRulesModule = {
  stateCode: 'WV',
  stateName: 'West Virginia',
  formLabel: 'WV Form IT-140',
  sidebarLabel: 'WV Form IT-140',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormIT140(model, federal, config))
  },
  nodeLabels: WV_NODE_LABELS,
  collectTracedValues: collectWVTracedValues,
  reviewLayout: WV_REVIEW_LAYOUT,
  reviewResultLines: WV_REVIEW_RESULT_LINES,
}
