/** DE state module */

import type { TaxReturn, StateReturnConfig, SupportedStateCode } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm200, type Form200Result } from './form200'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: Form200Result): StateComputeResult {
  return {
    stateCode: 'DE' as SupportedStateCode,
    formLabel: 'DE Form 200-01',
    residencyType: form.residencyType,
    stateAGI: form.deAGI,
    stateTaxableIncome: form.deTaxableIncome,
    stateTax: form.deTax,
    stateCredits: form.totalNonrefundableCredits + form.totalRefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const DE_NODE_LABELS: Record<string, string> = {
  'form200.deAdditions': 'DE additions to federal AGI',
  'form200.deSubtractions': 'DE subtractions from federal AGI',
  'form200.deAGI': 'Delaware adjusted gross income',
  'form200.deStandardDeduction': 'DE standard deduction',
  'form200.deTaxableIncome': 'Delaware taxable income',
  'form200.deTax': 'Delaware income tax',
  'form200.personalCredit': 'DE personal credit',
  'form200.taxAfterCredits': 'DE tax after credits',
  'form200.stateWithholding': 'DE state income tax withheld',
  'form200.overpaid': 'DE overpaid (refund)',
  'form200.amountOwed': 'DE amount you owe',
}

function collectDETracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as Form200Result
  const values = new Map<string, TracedValue>()

  const deAGIInputs = ['form1040.line11']
  if (form.deAdditions > 0) {
    deAGIInputs.push('form200.deAdditions')
    values.set('form200.deAdditions', tracedFromComputation(
      form.deAdditions, 'form200.deAdditions', [],
      'DE additions to federal AGI',
    ))
  }
  if (form.deSubtractions > 0) {
    deAGIInputs.push('form200.deSubtractions')
    values.set('form200.deSubtractions', tracedFromComputation(
      form.deSubtractions, 'form200.deSubtractions', [],
      'DE subtractions (US gov interest)',
    ))
  }

  values.set('form200.deAGI', tracedFromComputation(
    form.deAGI,
    'form200.deAGI',
    deAGIInputs,
    'Delaware adjusted gross income',
  ))

  values.set('form200.deStandardDeduction', tracedFromComputation(
    form.deStandardDeduction,
    'form200.deStandardDeduction',
    [],
    'DE standard deduction',
  ))

  const taxableInputs = ['form200.deAGI', 'form200.deStandardDeduction']
  values.set('form200.deTaxableIncome', tracedFromComputation(
    form.deTaxableIncome,
    'form200.deTaxableIncome',
    taxableInputs,
    'Delaware taxable income',
  ))

  values.set('form200.deTax', tracedFromComputation(
    form.deTax,
    'form200.deTax',
    ['form200.deTaxableIncome'],
    'DE Tax (7 brackets, 0%\u20136.6%)',
  ))

  const taxAfterInputs = ['form200.deTax']
  if (form.personalCredit > 0) {
    values.set('form200.personalCredit', tracedFromComputation(
      form.personalCredit,
      'form200.personalCredit',
      [],
      `DE personal credit ($110 x ${form.numExemptions})`,
    ))
    taxAfterInputs.push('form200.personalCredit')
  }

  values.set('form200.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'form200.taxAfterCredits',
    taxAfterInputs,
    'DE tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('form200.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'form200.stateWithholding',
      [],
      'DE state income tax withheld',
    ))
  }

  const resultInputs = ['form200.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('form200.stateWithholding')

  if (form.overpaid > 0) {
    values.set('form200.overpaid', tracedFromComputation(
      form.overpaid,
      'form200.overpaid',
      resultInputs,
      'DE overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('form200.amountOwed', tracedFromComputation(
      form.amountOwed,
      'form200.amountOwed',
      resultInputs,
      'DE amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form200Result {
  return result.detail as Form200Result
}

const DE_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for Delaware income tax.',
          pubName: 'DE Form 200-01 Instructions',
          pubUrl: 'https://revenue.delaware.gov/personal-income-tax/',
        },
      },
      {
        label: 'DE Additions',
        nodeId: 'form200.deAdditions',
        getValue: (r) => d(r).deAdditions,
        showWhen: (r) => d(r).deAdditions > 0,
        tooltip: {
          explanation: 'Delaware additions to federal AGI, including non-DE municipal bond interest and other state-specific items.',
          pubName: 'DE Form 200-01 Schedule A',
          pubUrl: 'https://revenue.delaware.gov/personal-income-tax/',
        },
      },
      {
        label: 'DE Subtractions',
        nodeId: 'form200.deSubtractions',
        getValue: (r) => d(r).deSubtractions,
        showWhen: (r) => d(r).deSubtractions > 0,
        tooltip: {
          explanation: 'Delaware subtractions include US government obligation interest (Treasury bonds, I-bonds, etc.).',
          pubName: 'DE Form 200-01 Schedule A',
          pubUrl: 'https://revenue.delaware.gov/personal-income-tax/',
        },
      },
      {
        label: 'DE AGI',
        nodeId: 'form200.deAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Delaware adjusted gross income: Federal AGI + DE additions - DE subtractions.',
          pubName: 'DE Form 200-01 Line 11',
          pubUrl: 'https://revenue.delaware.gov/personal-income-tax/',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'DE Standard Deduction',
        nodeId: 'form200.deStandardDeduction',
        getValue: (r) => d(r).deStandardDeduction,
        tooltip: {
          explanation: 'Delaware standard deduction. Delaware uses its own amounts which differ from the federal standard deduction.',
          pubName: 'DE Form 200-01 Line 12',
          pubUrl: 'https://revenue.delaware.gov/personal-income-tax/',
        },
      },
      {
        label: 'DE Taxable Income',
        nodeId: 'form200.deTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Delaware taxable income equals DE AGI minus the standard deduction.',
          pubName: 'DE Form 200-01 Line 17',
          pubUrl: 'https://revenue.delaware.gov/personal-income-tax/',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'DE Tax (7 brackets, 0%\u20136.6%)',
        nodeId: 'form200.deTax',
        getValue: (r) => d(r).deTax,
        tooltip: {
          explanation: 'Delaware income tax computed using 7 graduated brackets: 0% on the first $2,000, up to 6.6% on income over $60,000. Same brackets apply to all filing statuses.',
          pubName: 'DE Form 200-01 Tax Table',
          pubUrl: 'https://revenue.delaware.gov/personal-income-tax/',
        },
      },
      {
        label: 'Personal Credit',
        nodeId: 'form200.personalCredit',
        getValue: (r) => d(r).personalCredit,
        showWhen: (r) => d(r).personalCredit > 0,
        tooltip: {
          explanation: 'Delaware allows a $110 personal credit for each person (taxpayer, spouse, and dependents). This credit is nonrefundable.',
          pubName: 'DE Form 200-01 Line 19',
          pubUrl: 'https://revenue.delaware.gov/personal-income-tax/',
        },
      },
      {
        label: 'DE Tax After Credits',
        nodeId: 'form200.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Delaware income tax after the nonrefundable personal credit.',
          pubName: 'DE Form 200-01 Instructions',
          pubUrl: 'https://revenue.delaware.gov/personal-income-tax/',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'DE State Withholding',
        nodeId: 'form200.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Delaware tax withheld from W-2 Box 17 entries for DE.',
          pubName: 'DE Form 200-01 Line 27',
          pubUrl: 'https://revenue.delaware.gov/personal-income-tax/',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const DE_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'DE Refund',
    nodeId: 'form200.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'DE Amount You Owe',
    nodeId: 'form200.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'DE tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const deModule: StateRulesModule = {
  stateCode: 'DE' as SupportedStateCode,
  stateName: 'Delaware',
  formLabel: 'DE Form 200-01',
  sidebarLabel: 'DE Form 200-01',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm200(model, federal, config))
  },
  nodeLabels: DE_NODE_LABELS,
  collectTracedValues: collectDETracedValues,
  reviewLayout: DE_REVIEW_LAYOUT,
  reviewResultLines: DE_REVIEW_RESULT_LINES,
}
