/** UT state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeTC40, type TC40Result } from './tc40'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: TC40Result): StateComputeResult {
  return {
    stateCode: 'UT',
    formLabel: 'UT Form TC-40',
    residencyType: form.residencyType,
    stateAGI: form.utAdjustedIncome,
    stateTaxableIncome: form.utTaxableIncome,
    stateTax: form.utTaxBeforeCredits,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const UT_NODE_LABELS: Record<string, string> = {
  'tc40.utAdditions': 'UT additions',
  'tc40.utSubtractions': 'UT subtractions',
  'tc40.utAdjustedIncome': 'Utah adjusted income',
  'tc40.utTaxableIncome': 'Utah taxable income',
  'tc40.utTaxBeforeCredits': 'Utah income tax (4.55%)',
  'tc40.taxpayerTaxCredit': 'UT Taxpayer Tax Credit',
  'tc40.utEITC': 'UT Earned Income Tax Credit',
  'tc40.totalCredits': 'UT total credits',
  'tc40.taxAfterCredits': 'UT tax after credits',
  'tc40.stateWithholding': 'UT state income tax withheld',
  'tc40.overpaid': 'UT overpaid (refund)',
  'tc40.amountOwed': 'UT amount you owe',
}

function collectUTTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as TC40Result
  const values = new Map<string, TracedValue>()

  // Additions
  if (form.utAdditions > 0) {
    values.set('tc40.utAdditions', tracedFromComputation(
      form.utAdditions, 'tc40.utAdditions', [],
      'UT additions to federal AGI',
    ))
  }

  // Subtractions
  if (form.utSubtractions > 0) {
    values.set('tc40.utSubtractions', tracedFromComputation(
      form.utSubtractions, 'tc40.utSubtractions', [],
      'UT subtractions (state tax refund)',
    ))
  }

  // Adjusted income
  const adjInputs = ['form1040.line11']
  if (form.utAdditions > 0) adjInputs.push('tc40.utAdditions')
  if (form.utSubtractions > 0) adjInputs.push('tc40.utSubtractions')
  values.set('tc40.utAdjustedIncome', tracedFromComputation(
    form.utAdjustedIncome,
    'tc40.utAdjustedIncome',
    adjInputs,
    'Utah adjusted income (federal AGI + additions - subtractions)',
  ))

  // Taxable income
  values.set('tc40.utTaxableIncome', tracedFromComputation(
    form.utTaxableIncome,
    'tc40.utTaxableIncome',
    ['tc40.utAdjustedIncome'],
    'Utah taxable income',
  ))

  // Tax before credits
  values.set('tc40.utTaxBeforeCredits', tracedFromComputation(
    form.utTaxBeforeCredits,
    'tc40.utTaxBeforeCredits',
    ['tc40.utTaxableIncome'],
    'Utah income tax (4.55% flat rate)',
  ))

  // Credits
  const creditInputs: string[] = []

  if (form.taxpayerTaxCredit > 0) {
    values.set('tc40.taxpayerTaxCredit', tracedFromComputation(
      form.taxpayerTaxCredit,
      'tc40.taxpayerTaxCredit',
      [],
      `UT Taxpayer Tax Credit (6% of deductions + exemptions, phaseout applied)`,
    ))
    creditInputs.push('tc40.taxpayerTaxCredit')
  }

  if (form.utEITC > 0) {
    values.set('tc40.utEITC', tracedFromComputation(
      form.utEITC,
      'tc40.utEITC',
      [],
      'UT Earned Income Tax Credit (20% of federal EITC)',
    ))
    creditInputs.push('tc40.utEITC')
  }

  if (form.totalCredits > 0) {
    values.set('tc40.totalCredits', tracedFromComputation(
      form.totalCredits,
      'tc40.totalCredits',
      creditInputs,
      'UT total credits',
    ))
  }

  // Tax after credits
  const taxAfterInputs = ['tc40.utTaxBeforeCredits']
  if (form.totalCredits > 0) taxAfterInputs.push('tc40.totalCredits')
  values.set('tc40.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'tc40.taxAfterCredits',
    taxAfterInputs,
    'UT tax after credits',
  ))

  // Withholding
  if (form.stateWithholding > 0) {
    values.set('tc40.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'tc40.stateWithholding',
      [],
      'UT state income tax withheld',
    ))
  }

  // Result
  const resultInputs = ['tc40.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('tc40.stateWithholding')

  if (form.overpaid > 0) {
    values.set('tc40.overpaid', tracedFromComputation(
      form.overpaid,
      'tc40.overpaid',
      resultInputs,
      'UT overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('tc40.amountOwed', tracedFromComputation(
      form.amountOwed,
      'tc40.amountOwed',
      resultInputs,
      'UT amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): TC40Result {
  return result.detail as TC40Result
}

const UT_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Utah starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'TC-40 Instructions',
          pubUrl: 'https://tax.utah.gov/forms/current/tc-40.pdf',
        },
      },
      {
        label: 'UT Additions',
        nodeId: 'tc40.utAdditions',
        getValue: (r) => d(r).utAdditions,
        showWhen: (r) => d(r).utAdditions > 0,
        tooltip: {
          explanation: 'Utah additions to federal AGI.',
          pubName: 'TC-40 Instructions',
          pubUrl: 'https://tax.utah.gov/forms/current/tc-40.pdf',
        },
      },
      {
        label: 'UT Subtractions',
        nodeId: 'tc40.utSubtractions',
        getValue: (r) => d(r).utSubtractions,
        showWhen: (r) => d(r).utSubtractions > 0,
        tooltip: {
          explanation: 'Utah subtractions include state tax refunds included in federal AGI.',
          pubName: 'TC-40 Instructions',
          pubUrl: 'https://tax.utah.gov/forms/current/tc-40.pdf',
        },
      },
      {
        label: 'UT Adjusted Income',
        nodeId: 'tc40.utAdjustedIncome',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Utah adjusted income: Federal AGI + UT additions - UT subtractions.',
          pubName: 'TC-40 Instructions',
          pubUrl: 'https://tax.utah.gov/forms/current/tc-40.pdf',
        },
      },
      {
        label: 'UT Taxable Income',
        nodeId: 'tc40.utTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Utah taxable income. For part-year residents and nonresidents, this is the apportioned amount. Utah has no standard deduction — instead it uses a Taxpayer Tax Credit.',
          pubName: 'TC-40 Instructions',
          pubUrl: 'https://tax.utah.gov/forms/current/tc-40.pdf',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'UT Tax (4.55%)',
        nodeId: 'tc40.utTaxBeforeCredits',
        getValue: (r) => d(r).utTaxBeforeCredits,
        tooltip: {
          explanation: 'Utah applies a flat 4.55% tax rate to taxable income.',
          pubName: 'TC-40 Instructions',
          pubUrl: 'https://tax.utah.gov/forms/current/tc-40.pdf',
        },
      },
      {
        label: 'Taxpayer Tax Credit',
        nodeId: 'tc40.taxpayerTaxCredit',
        getValue: (r) => d(r).taxpayerTaxCredit,
        showWhen: (r) => d(r).taxpayerTaxCredit > 0,
        tooltip: {
          explanation: 'Utah Taxpayer Tax Credit: 6% of (federal standard/itemized deduction + personal exemptions). This effectively works like a deduction but is applied as a credit. Phases out for higher incomes.',
          pubName: 'TC-40 Instructions',
          pubUrl: 'https://tax.utah.gov/forms/current/tc-40.pdf',
        },
      },
      {
        label: 'UT Earned Income Credit',
        nodeId: 'tc40.utEITC',
        getValue: (r) => d(r).utEITC,
        showWhen: (r) => d(r).utEITC > 0,
        tooltip: {
          explanation: 'Utah Earned Income Tax Credit equals 20% of your federal Earned Income Tax Credit.',
          pubName: 'TC-40 Instructions',
          pubUrl: 'https://tax.utah.gov/forms/current/tc-40.pdf',
        },
      },
      {
        label: 'UT Tax After Credits',
        nodeId: 'tc40.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Utah income tax after all credits (Taxpayer Tax Credit, EITC).',
          pubName: 'TC-40 Instructions',
          pubUrl: 'https://tax.utah.gov/forms/current/tc-40.pdf',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'UT State Withholding',
        nodeId: 'tc40.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Utah tax withheld from W-2 Box 17 entries for UT.',
          pubName: 'TC-40 Instructions',
          pubUrl: 'https://tax.utah.gov/forms/current/tc-40.pdf',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const UT_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'UT Refund',
    nodeId: 'tc40.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'UT Amount You Owe',
    nodeId: 'tc40.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'UT tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const utModule: StateRulesModule = {
  stateCode: 'UT',
  stateName: 'Utah',
  formLabel: 'UT Form TC-40',
  sidebarLabel: 'UT Form TC-40',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeTC40(model, federal, config))
  },
  nodeLabels: UT_NODE_LABELS,
  collectTracedValues: collectUTTracedValues,
  reviewLayout: UT_REVIEW_LAYOUT,
  reviewResultLines: UT_REVIEW_RESULT_LINES,
}
