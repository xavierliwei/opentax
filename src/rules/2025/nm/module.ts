/** NM state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormPIT1, type FormPIT1Result } from './formPIT1'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormPIT1Result): StateComputeResult {
  return {
    stateCode: 'NM',
    formLabel: 'NM Form PIT-1',
    residencyType: form.residencyType,
    stateAGI: form.nmAGI,
    stateTaxableIncome: form.nmTaxableIncome,
    stateTax: form.nmTax,
    stateCredits: form.nmEITC,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const NM_NODE_LABELS: Record<string, string> = {
  'pit1.nmSubtractions': 'NM subtractions from federal AGI',
  'pit1.nmAGI': 'New Mexico adjusted gross income',
  'pit1.nmStandardDeduction': 'NM standard deduction',
  'pit1.personalExemptions': 'NM personal exemptions',
  'pit1.nmTaxableIncome': 'New Mexico taxable income',
  'pit1.nmTax': 'New Mexico income tax',
  'pit1.nmEITC': 'NM working families tax credit',
  'pit1.taxAfterCredits': 'NM tax after credits',
  'pit1.stateWithholding': 'NM state income tax withheld',
  'pit1.overpaid': 'NM overpaid (refund)',
  'pit1.amountOwed': 'NM amount you owe',
}

function collectNMTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormPIT1Result
  const values = new Map<string, TracedValue>()

  const agiInputs = ['form1040.line11']
  if (form.nmSubtractions > 0) {
    agiInputs.push('pit1.nmSubtractions')
    values.set('pit1.nmSubtractions', tracedFromComputation(
      form.nmSubtractions, 'pit1.nmSubtractions', [],
      'NM subtractions (US gov interest)',
    ))
  }

  values.set('pit1.nmAGI', tracedFromComputation(
    form.nmAGI, 'pit1.nmAGI', agiInputs,
    'New Mexico adjusted gross income',
  ))

  values.set('pit1.nmStandardDeduction', tracedFromComputation(
    form.nmStandardDeduction, 'pit1.nmStandardDeduction', [],
    'NM standard deduction (federal conformity)',
  ))

  if (form.personalExemptions > 0) {
    values.set('pit1.personalExemptions', tracedFromComputation(
      form.personalExemptions, 'pit1.personalExemptions', [],
      `NM personal exemptions ($4,150 x ${form.numExemptions})`,
    ))
  }

  const taxableInputs = ['pit1.nmAGI', 'pit1.nmStandardDeduction']
  if (form.personalExemptions > 0) taxableInputs.push('pit1.personalExemptions')
  values.set('pit1.nmTaxableIncome', tracedFromComputation(
    form.nmTaxableIncome, 'pit1.nmTaxableIncome', taxableInputs,
    'New Mexico taxable income',
  ))

  values.set('pit1.nmTax', tracedFromComputation(
    form.nmTax, 'pit1.nmTax', ['pit1.nmTaxableIncome'],
    'New Mexico income tax (1.7% / 3.2% / 4.7% / 4.9%)',
  ))

  const taxAfterInputs = ['pit1.nmTax']
  if (form.nmEITC > 0) {
    values.set('pit1.nmEITC', tracedFromComputation(
      form.nmEITC, 'pit1.nmEITC', [],
      'NM working families tax credit (25% of federal EITC)',
    ))
    taxAfterInputs.push('pit1.nmEITC')
  }

  values.set('pit1.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits, 'pit1.taxAfterCredits', taxAfterInputs,
    'NM tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('pit1.stateWithholding', tracedFromComputation(
      form.stateWithholding, 'pit1.stateWithholding', [],
      'NM state income tax withheld',
    ))
  }

  const resultInputs = ['pit1.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('pit1.stateWithholding')
  if (form.nmEITC > 0) resultInputs.push('pit1.nmEITC')

  if (form.overpaid > 0) {
    values.set('pit1.overpaid', tracedFromComputation(
      form.overpaid, 'pit1.overpaid', resultInputs, 'NM overpaid (refund)',
    ))
  }
  if (form.amountOwed > 0) {
    values.set('pit1.amountOwed', tracedFromComputation(
      form.amountOwed, 'pit1.amountOwed', resultInputs, 'NM amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormPIT1Result {
  return result.detail as FormPIT1Result
}

const NM_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11.',
          pubName: 'NM PIT-1 Instructions',
          pubUrl: 'https://www.tax.newmexico.gov/individuals/personal-income-tax/',
        },
      },
      {
        label: 'NM Subtractions',
        nodeId: 'pit1.nmSubtractions',
        getValue: (r) => d(r).nmSubtractions,
        showWhen: (r) => d(r).nmSubtractions > 0,
        tooltip: {
          explanation: 'New Mexico subtractions include US government obligation interest.',
          pubName: 'NM PIT-1',
          pubUrl: 'https://www.tax.newmexico.gov/individuals/personal-income-tax/',
        },
      },
      {
        label: 'NM AGI',
        nodeId: 'pit1.nmAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'New Mexico AGI: Federal AGI minus NM subtractions.',
          pubName: 'NM PIT-1',
          pubUrl: 'https://www.tax.newmexico.gov/individuals/personal-income-tax/',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'NM Standard Deduction',
        nodeId: 'pit1.nmStandardDeduction',
        getValue: (r) => d(r).nmStandardDeduction,
        tooltip: {
          explanation: 'NM conforms to the federal standard deduction.',
          pubName: 'NM PIT-1',
          pubUrl: 'https://www.tax.newmexico.gov/individuals/personal-income-tax/',
        },
      },
      {
        label: 'Personal Exemptions',
        nodeId: 'pit1.personalExemptions',
        getValue: (r) => d(r).personalExemptions,
        showWhen: (r) => d(r).personalExemptions > 0,
        tooltip: {
          explanation: 'NM allows a $4,150 personal exemption per person.',
          pubName: 'NM PIT-1',
          pubUrl: 'https://www.tax.newmexico.gov/individuals/personal-income-tax/',
        },
      },
      {
        label: 'NM Taxable Income',
        nodeId: 'pit1.nmTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'NM taxable income = NM AGI minus deduction and exemptions.',
          pubName: 'NM PIT-1',
          pubUrl: 'https://www.tax.newmexico.gov/individuals/personal-income-tax/',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'NM Tax (1.7% / 3.2% / 4.7% / 4.9%)',
        nodeId: 'pit1.nmTax',
        getValue: (r) => d(r).nmTax,
        tooltip: {
          explanation: 'New Mexico income tax using 4 graduated brackets.',
          pubName: 'NM PIT-1 Tax Table',
          pubUrl: 'https://www.tax.newmexico.gov/individuals/personal-income-tax/',
        },
      },
      {
        label: 'NM EITC',
        nodeId: 'pit1.nmEITC',
        getValue: (r) => d(r).nmEITC,
        showWhen: (r) => d(r).nmEITC > 0,
        tooltip: {
          explanation: 'NM Working Families Tax Credit = 25% of federal EITC (refundable).',
          pubName: 'NM PIT-1',
          pubUrl: 'https://www.tax.newmexico.gov/individuals/personal-income-tax/',
        },
      },
      {
        label: 'NM Tax After Credits',
        nodeId: 'pit1.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net New Mexico income tax after credits.',
          pubName: 'NM PIT-1',
          pubUrl: 'https://www.tax.newmexico.gov/individuals/personal-income-tax/',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'NM State Withholding',
        nodeId: 'pit1.stateWithholding',
        getValue: (r) => r.stateWithholding,
        showWhen: (r) => r.stateWithholding > 0,
        tooltip: {
          explanation: 'NM tax withheld from W-2 Box 17.',
          pubName: 'NM PIT-1',
          pubUrl: 'https://www.tax.newmexico.gov/individuals/personal-income-tax/',
        },
      },
    ],
  },
]

const NM_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  { type: 'refund', label: 'NM Refund', nodeId: 'pit1.overpaid', getValue: (r) => r.overpaid, showWhen: (r) => r.overpaid > 0 },
  { type: 'owed', label: 'NM Amount You Owe', nodeId: 'pit1.amountOwed', getValue: (r) => r.amountOwed, showWhen: (r) => r.amountOwed > 0 },
  { type: 'zero', label: 'NM tax balance', nodeId: '', getValue: () => 0, showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0 },
]

export const nmModule: StateRulesModule = {
  stateCode: 'NM',
  stateName: 'New Mexico',
  formLabel: 'NM Form PIT-1',
  sidebarLabel: 'NM Form PIT-1',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormPIT1(model, federal, config))
  },
  nodeLabels: NM_NODE_LABELS,
  collectTracedValues: collectNMTracedValues,
  reviewLayout: NM_REVIEW_LAYOUT,
  reviewResultLines: NM_REVIEW_RESULT_LINES,
}
