/** WI state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeWIForm1, type WIForm1Result } from './form1'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: WIForm1Result): StateComputeResult {
  return {
    stateCode: 'WI',
    formLabel: 'WI Form 1',
    residencyType: form.residencyType,
    stateAGI: form.wiAGI,
    stateTaxableIncome: form.wiTaxableIncome,
    stateTax: form.wiTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const WI_NODE_LABELS: Record<string, string> = {
  'wiForm1.wiAdditions': 'WI additions to federal AGI',
  'wiForm1.wiSubtractions': 'WI subtractions from federal AGI',
  'wiForm1.wiAGI': 'Wisconsin adjusted gross income',
  'wiForm1.deductionUsed': 'WI deduction (standard or itemized)',
  'wiForm1.personalExemptions': 'WI personal exemptions',
  'wiForm1.wiTaxableIncome': 'Wisconsin taxable income',
  'wiForm1.wiTax': 'Wisconsin income tax',
  'wiForm1.wiEITC': 'WI Earned Income Credit',
  'wiForm1.wiItemizedDeductionCredit': 'WI itemized deduction credit',
  'wiForm1.taxAfterCredits': 'WI tax after credits',
  'wiForm1.stateWithholding': 'WI state income tax withheld',
  'wiForm1.overpaid': 'WI overpaid (refund)',
  'wiForm1.amountOwed': 'WI amount you owe',
}

function collectWITracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as WIForm1Result
  const values = new Map<string, TracedValue>()

  const wiAGIInputs = ['form1040.line11']
  if (form.wiAdditions > 0) {
    wiAGIInputs.push('wiForm1.wiAdditions')
    values.set('wiForm1.wiAdditions', tracedFromComputation(
      form.wiAdditions, 'wiForm1.wiAdditions', [],
      'WI additions to federal AGI',
    ))
  }
  if (form.wiSubtractions > 0) {
    wiAGIInputs.push('wiForm1.wiSubtractions')
    values.set('wiForm1.wiSubtractions', tracedFromComputation(
      form.wiSubtractions, 'wiForm1.wiSubtractions', [],
      'WI subtractions (SS exemption, US gov interest)',
    ))
  }

  values.set('wiForm1.wiAGI', tracedFromComputation(
    form.wiAGI,
    'wiForm1.wiAGI',
    wiAGIInputs,
    'Wisconsin adjusted gross income',
  ))

  values.set('wiForm1.deductionUsed', tracedFromComputation(
    form.deductionUsed,
    'wiForm1.deductionUsed',
    [],
    `WI ${form.deductionMethod} deduction`,
  ))

  values.set('wiForm1.personalExemptions', tracedFromComputation(
    form.personalExemptions,
    'wiForm1.personalExemptions',
    [],
    `WI personal exemptions ($700 x ${form.numExemptions})`,
  ))

  const taxableInputs = ['wiForm1.wiAGI', 'wiForm1.deductionUsed', 'wiForm1.personalExemptions']
  values.set('wiForm1.wiTaxableIncome', tracedFromComputation(
    form.wiTaxableIncome,
    'wiForm1.wiTaxableIncome',
    taxableInputs,
    'Wisconsin taxable income',
  ))

  values.set('wiForm1.wiTax', tracedFromComputation(
    form.wiTax,
    'wiForm1.wiTax',
    ['wiForm1.wiTaxableIncome'],
    'Wisconsin income tax',
  ))

  const taxAfterInputs = ['wiForm1.wiTax']
  if (form.wiEITC > 0) {
    values.set('wiForm1.wiEITC', tracedFromComputation(
      form.wiEITC,
      'wiForm1.wiEITC',
      [],
      'WI Earned Income Credit (% of federal EITC based on # children)',
    ))
    taxAfterInputs.push('wiForm1.wiEITC')
  }

  if (form.wiItemizedDeductionCredit > 0) {
    values.set('wiForm1.wiItemizedDeductionCredit', tracedFromComputation(
      form.wiItemizedDeductionCredit,
      'wiForm1.wiItemizedDeductionCredit',
      [],
      'WI itemized deduction credit (5% of WI itemized deductions)',
    ))
    taxAfterInputs.push('wiForm1.wiItemizedDeductionCredit')
  }

  values.set('wiForm1.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'wiForm1.taxAfterCredits',
    taxAfterInputs,
    'WI tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('wiForm1.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'wiForm1.stateWithholding',
      [],
      'WI state income tax withheld',
    ))
  }

  if (form.overpaid > 0) {
    values.set('wiForm1.overpaid', tracedFromComputation(
      form.overpaid,
      'wiForm1.overpaid',
      ['wiForm1.taxAfterCredits', 'wiForm1.stateWithholding'],
      'WI overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('wiForm1.amountOwed', tracedFromComputation(
      form.amountOwed,
      'wiForm1.amountOwed',
      ['wiForm1.taxAfterCredits', 'wiForm1.stateWithholding'],
      'WI amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): WIForm1Result {
  return result.detail as WIForm1Result
}

const WI_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Wisconsin starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'WI Form 1 Instructions',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
      },
      {
        label: 'WI Additions',
        nodeId: 'wiForm1.wiAdditions',
        getValue: (r) => d(r).wiAdditions,
        showWhen: (r) => d(r).wiAdditions > 0,
        tooltip: {
          explanation: 'WI additions to federal AGI for items where Wisconsin does not conform to federal treatment (e.g. bond interest from non-WI states).',
          pubName: 'WI Schedule I',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
      },
      {
        label: 'WI Subtractions',
        nodeId: 'wiForm1.wiSubtractions',
        getValue: (r) => d(r).wiSubtractions,
        showWhen: (r) => d(r).wiSubtractions > 0,
        tooltip: {
          explanation: 'WI subtractions include full Social Security exemption and US government obligation interest.',
          pubName: 'WI Schedule I',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
      },
      {
        label: 'WI AGI',
        nodeId: 'wiForm1.wiAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Wisconsin adjusted gross income: Federal AGI + WI additions - WI subtractions.',
          pubName: 'WI Form 1 Instructions',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'WI Deduction',
        nodeId: 'wiForm1.deductionUsed',
        getValue: (r) => d(r).deductionUsed,
        tooltip: {
          explanation: 'WI standard deduction (with income-based phase-out) or WI itemized deduction, whichever is larger. WI itemized deductions remove the federal $10K SALT cap.',
          pubName: 'WI Form 1 Instructions',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
      },
      {
        label: 'Personal Exemptions',
        nodeId: 'wiForm1.personalExemptions',
        getValue: (r) => d(r).personalExemptions,
        showWhen: (r) => d(r).personalExemptions > 0,
        tooltip: {
          explanation: 'Wisconsin personal exemption: $700 per person (taxpayer, spouse, and each dependent).',
          pubName: 'WI Form 1 Instructions',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
      },
      {
        label: 'WI Taxable Income',
        nodeId: 'wiForm1.wiTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Wisconsin taxable income equals WI AGI minus the deduction and personal exemptions.',
          pubName: 'WI Form 1 Instructions',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'WI Tax',
        nodeId: 'wiForm1.wiTax',
        getValue: (r) => d(r).wiTax,
        tooltip: {
          explanation: 'Wisconsin income tax computed using the progressive rate schedule (3.50% to 7.65%).',
          pubName: 'WI Form 1 Instructions',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
      },
      {
        label: 'WI Earned Income Credit',
        nodeId: 'wiForm1.wiEITC',
        getValue: (r) => d(r).wiEITC,
        showWhen: (r) => d(r).wiEITC > 0,
        tooltip: {
          explanation: 'Wisconsin Earned Income Credit: 4% (1 child), 11% (2 children), or 34% (3+ children) of your federal EITC.',
          pubName: 'WI Form 1 Instructions',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
      },
      {
        label: 'WI Itemized Deduction Credit',
        nodeId: 'wiForm1.wiItemizedDeductionCredit',
        getValue: (r) => d(r).wiItemizedDeductionCredit,
        showWhen: (r) => d(r).wiItemizedDeductionCredit > 0,
        tooltip: {
          explanation: 'Wisconsin itemized deduction credit: 5% of your Wisconsin itemized deductions.',
          pubName: 'WI Form 1 Instructions',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
      },
      {
        label: 'WI Tax After Credits',
        nodeId: 'wiForm1.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Wisconsin income tax after all credits.',
          pubName: 'WI Form 1 Instructions',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'WI State Withholding',
        nodeId: 'wiForm1.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Wisconsin tax withheld from W-2 Box 17 entries for WI.',
          pubName: 'WI Form 1 Instructions',
          pubUrl: 'https://www.revenue.wi.gov/Pages/Form/2024Individual.aspx',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const WI_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'WI Refund',
    nodeId: 'wiForm1.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'WI Amount You Owe',
    nodeId: 'wiForm1.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'WI tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const wiModule: StateRulesModule = {
  stateCode: 'WI',
  stateName: 'Wisconsin',
  formLabel: 'WI Form 1',
  sidebarLabel: 'WI Form 1',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeWIForm1(model, federal, config))
  },
  nodeLabels: WI_NODE_LABELS,
  collectTracedValues: collectWITracedValues,
  reviewLayout: WI_REVIEW_LAYOUT,
  reviewResultLines: WI_REVIEW_RESULT_LINES,
}
