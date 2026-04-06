/** NE state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm1040N, type Form1040NResult } from './form1040N'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: Form1040NResult): StateComputeResult {
  return {
    stateCode: 'NE',
    formLabel: 'NE Form 1040N',
    residencyType: form.residencyType,
    stateAGI: form.neAGI,
    stateTaxableIncome: form.neTaxableIncome,
    stateTax: form.neTax,
    stateCredits: form.totalNonrefundableCredits + form.totalRefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const NE_NODE_LABELS: Record<string, string> = {
  'form1040N.neAdditions': 'NE additions to federal AGI',
  'form1040N.neSubtractions': 'NE subtractions from federal AGI',
  'form1040N.neAGI': 'Nebraska adjusted gross income',
  'form1040N.neDeduction': 'NE standard deduction',
  'form1040N.neTaxableIncome': 'Nebraska taxable income',
  'form1040N.neTax': 'Nebraska income tax',
  'form1040N.personalExemptionCredit': 'NE personal exemption credit',
  'form1040N.dependentCareCredit': 'NE child/dependent care credit',
  'form1040N.neEITC': 'NE earned income credit',
  'form1040N.taxAfterCredits': 'NE tax after credits',
  'form1040N.stateWithholding': 'NE state income tax withheld',
  'form1040N.overpaid': 'NE overpaid (refund)',
  'form1040N.amountOwed': 'NE amount you owe',
}

function collectNETracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as Form1040NResult
  const values = new Map<string, TracedValue>()

  const neAGIInputs = ['form1040.line11']
  if (form.neAdditions > 0) {
    neAGIInputs.push('form1040N.neAdditions')
    values.set('form1040N.neAdditions', tracedFromComputation(
      form.neAdditions, 'form1040N.neAdditions', [],
      'NE additions to federal AGI',
    ))
  }
  if (form.neSubtractions > 0) {
    neAGIInputs.push('form1040N.neSubtractions')
    values.set('form1040N.neSubtractions', tracedFromComputation(
      form.neSubtractions, 'form1040N.neSubtractions', [],
      'NE subtractions (SS exemption, US gov interest)',
    ))
  }

  values.set('form1040N.neAGI', tracedFromComputation(
    form.neAGI,
    'form1040N.neAGI',
    neAGIInputs,
    'Nebraska adjusted gross income',
  ))

  values.set('form1040N.neDeduction', tracedFromComputation(
    form.neDeduction,
    'form1040N.neDeduction',
    [],
    'NE standard deduction',
  ))

  const taxableInputs = ['form1040N.neAGI', 'form1040N.neDeduction']
  values.set('form1040N.neTaxableIncome', tracedFromComputation(
    form.neTaxableIncome,
    'form1040N.neTaxableIncome',
    taxableInputs,
    'Nebraska taxable income',
  ))

  values.set('form1040N.neTax', tracedFromComputation(
    form.neTax,
    'form1040N.neTax',
    ['form1040N.neTaxableIncome'],
    'Nebraska income tax (2.46% / 3.51% / 5.84%)',
  ))

  const taxAfterInputs = ['form1040N.neTax']
  if (form.personalExemptionCredit > 0) {
    values.set('form1040N.personalExemptionCredit', tracedFromComputation(
      form.personalExemptionCredit,
      'form1040N.personalExemptionCredit',
      [],
      `NE personal exemption credit ($157 x ${form.numExemptions})`,
    ))
    taxAfterInputs.push('form1040N.personalExemptionCredit')
  }

  if (form.dependentCareCredit > 0) {
    values.set('form1040N.dependentCareCredit', tracedFromComputation(
      form.dependentCareCredit,
      'form1040N.dependentCareCredit',
      [],
      'NE child/dependent care credit (25% of federal)',
    ))
    taxAfterInputs.push('form1040N.dependentCareCredit')
  }

  values.set('form1040N.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'form1040N.taxAfterCredits',
    taxAfterInputs,
    'NE tax after credits',
  ))

  if (form.neEITC > 0) {
    values.set('form1040N.neEITC', tracedFromComputation(
      form.neEITC,
      'form1040N.neEITC',
      [],
      'NE earned income credit (10% of federal EITC)',
    ))
  }

  if (form.stateWithholding > 0) {
    values.set('form1040N.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'form1040N.stateWithholding',
      [],
      'NE state income tax withheld',
    ))
  }

  const resultInputs = ['form1040N.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('form1040N.stateWithholding')
  if (form.neEITC > 0) resultInputs.push('form1040N.neEITC')

  if (form.overpaid > 0) {
    values.set('form1040N.overpaid', tracedFromComputation(
      form.overpaid,
      'form1040N.overpaid',
      resultInputs,
      'NE overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('form1040N.amountOwed', tracedFromComputation(
      form.amountOwed,
      'form1040N.amountOwed',
      resultInputs,
      'NE amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form1040NResult {
  return result.detail as Form1040NResult
}

const NE_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for Nebraska income tax.',
          pubName: 'NE Form 1040N Instructions',
          pubUrl: 'https://revenue.nebraska.gov/individuals/individual-income-tax',
        },
      },
      {
        label: 'NE Subtractions',
        nodeId: 'form1040N.neSubtractions',
        getValue: (r) => d(r).neSubtractions,
        showWhen: (r) => d(r).neSubtractions > 0,
        tooltip: {
          explanation: 'Nebraska subtractions include full Social Security exemption and US government obligation interest.',
          pubName: 'NE Form 1040N Schedule I',
          pubUrl: 'https://revenue.nebraska.gov/individuals/individual-income-tax',
        },
      },
      {
        label: 'NE AGI',
        nodeId: 'form1040N.neAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Nebraska adjusted gross income: Federal AGI + NE additions - NE subtractions.',
          pubName: 'NE Form 1040N Line 4',
          pubUrl: 'https://revenue.nebraska.gov/individuals/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'NE Standard Deduction',
        nodeId: 'form1040N.neDeduction',
        getValue: (r) => d(r).neDeduction,
        tooltip: {
          explanation: 'Nebraska uses the federal standard deduction amounts.',
          pubName: 'NE Form 1040N Line 5',
          pubUrl: 'https://revenue.nebraska.gov/individuals/individual-income-tax',
        },
      },
      {
        label: 'NE Taxable Income',
        nodeId: 'form1040N.neTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Nebraska taxable income equals NE AGI minus the standard deduction.',
          pubName: 'NE Form 1040N Line 6',
          pubUrl: 'https://revenue.nebraska.gov/individuals/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'NE Tax (2.46% / 3.51% / 5.84%)',
        nodeId: 'form1040N.neTax',
        getValue: (r) => d(r).neTax,
        tooltip: {
          explanation: 'Nebraska income tax computed using 3 graduated brackets: 2.46% on the first bracket, 3.51% on the second, and 5.84% on the remainder.',
          pubName: 'NE Tax Table',
          pubUrl: 'https://revenue.nebraska.gov/individuals/individual-income-tax',
        },
      },
      {
        label: 'Personal Exemption Credit',
        nodeId: 'form1040N.personalExemptionCredit',
        getValue: (r) => d(r).personalExemptionCredit,
        showWhen: (r) => d(r).personalExemptionCredit > 0,
        tooltip: {
          explanation: 'Nebraska allows a $157 personal exemption credit per person (taxpayer, spouse, and dependents).',
          pubName: 'NE Form 1040N Line 10',
          pubUrl: 'https://revenue.nebraska.gov/individuals/individual-income-tax',
        },
      },
      {
        label: 'Dependent Care Credit',
        nodeId: 'form1040N.dependentCareCredit',
        getValue: (r) => d(r).dependentCareCredit,
        showWhen: (r) => d(r).dependentCareCredit > 0,
        tooltip: {
          explanation: 'Nebraska child and dependent care credit equals 25% of the federal child and dependent care credit.',
          pubName: 'NE Form 1040N',
          pubUrl: 'https://revenue.nebraska.gov/individuals/individual-income-tax',
        },
      },
      {
        label: 'NE Earned Income Credit',
        nodeId: 'form1040N.neEITC',
        getValue: (r) => d(r).neEITC,
        showWhen: (r) => d(r).neEITC > 0,
        tooltip: {
          explanation: 'Refundable Nebraska EITC equals 10% of the federal earned income credit.',
          pubName: 'NE Form 1040N',
          pubUrl: 'https://revenue.nebraska.gov/individuals/individual-income-tax',
        },
      },
      {
        label: 'NE Tax After Credits',
        nodeId: 'form1040N.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Nebraska income tax after nonrefundable credits. NE EITC is refundable and applied against the balance due.',
          pubName: 'NE Form 1040N Instructions',
          pubUrl: 'https://revenue.nebraska.gov/individuals/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'NE State Withholding',
        nodeId: 'form1040N.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Nebraska tax withheld from W-2 Box 17 entries for NE.',
          pubName: 'NE Form 1040N',
          pubUrl: 'https://revenue.nebraska.gov/individuals/individual-income-tax',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const NE_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'NE Refund',
    nodeId: 'form1040N.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'NE Amount You Owe',
    nodeId: 'form1040N.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'NE tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const neModule: StateRulesModule = {
  stateCode: 'NE',
  stateName: 'Nebraska',
  formLabel: 'NE Form 1040N',
  sidebarLabel: 'NE Form 1040N',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm1040N(model, federal, config))
  },
  nodeLabels: NE_NODE_LABELS,
  collectTracedValues: collectNETracedValues,
  reviewLayout: NE_REVIEW_LAYOUT,
  reviewResultLines: NE_REVIEW_RESULT_LINES,
}
