/** IA state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeIA1040, type IA1040Result } from './ia1040'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: IA1040Result): StateComputeResult {
  return {
    stateCode: 'IA',
    formLabel: 'IA Form IA 1040',
    residencyType: form.residencyType,
    stateAGI: form.iaNetIncome,
    stateTaxableIncome: form.iaTaxableIncome,
    stateTax: form.iaTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const IA_NODE_LABELS: Record<string, string> = {
  'ia1040.iaAdditions': 'IA additions',
  'ia1040.iaSubtractions': 'IA subtractions',
  'ia1040.iaNetIncome': 'Iowa net income',
  'ia1040.standardDeduction': 'Iowa standard deduction',
  'ia1040.iaTaxableIncome': 'Iowa taxable income',
  'ia1040.iaTax': 'Iowa income tax (3.8%)',
  'ia1040.personalExemptionCredit': 'IA personal exemption credit',
  'ia1040.iaEIC': 'IA Earned Income Credit',
  'ia1040.totalCredits': 'IA total credits',
  'ia1040.taxAfterCredits': 'IA tax after credits',
  'ia1040.stateWithholding': 'IA state income tax withheld',
  'ia1040.overpaid': 'IA overpaid (refund)',
  'ia1040.amountOwed': 'IA amount you owe',
}

function collectIATracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as IA1040Result
  const values = new Map<string, TracedValue>()

  // Additions
  if (form.iaAdditions > 0) {
    values.set('ia1040.iaAdditions', tracedFromComputation(
      form.iaAdditions, 'ia1040.iaAdditions', [],
      'IA additions (federally tax-exempt interest from other states)',
    ))
  }

  // Subtractions
  if (form.iaSubtractions > 0) {
    values.set('ia1040.iaSubtractions', tracedFromComputation(
      form.iaSubtractions, 'ia1040.iaSubtractions', [],
      'IA subtractions (US gov interest, Social Security exemption)',
    ))
  }

  // Net income
  const netInputs = ['form1040.line11']
  if (form.iaAdditions > 0) netInputs.push('ia1040.iaAdditions')
  if (form.iaSubtractions > 0) netInputs.push('ia1040.iaSubtractions')
  values.set('ia1040.iaNetIncome', tracedFromComputation(
    form.iaNetIncome,
    'ia1040.iaNetIncome',
    netInputs,
    'Iowa net income (federal AGI + additions - subtractions)',
  ))

  // Standard deduction
  values.set('ia1040.standardDeduction', tracedFromComputation(
    form.standardDeduction,
    'ia1040.standardDeduction',
    [],
    'Iowa standard deduction',
  ))

  // Taxable income
  values.set('ia1040.iaTaxableIncome', tracedFromComputation(
    form.iaTaxableIncome,
    'ia1040.iaTaxableIncome',
    ['ia1040.iaNetIncome', 'ia1040.standardDeduction'],
    'Iowa taxable income (net income minus standard deduction)',
  ))

  // Tax
  values.set('ia1040.iaTax', tracedFromComputation(
    form.iaTax,
    'ia1040.iaTax',
    ['ia1040.iaTaxableIncome'],
    'Iowa income tax (3.8% flat rate)',
  ))

  // Credits
  const creditInputs: string[] = []

  values.set('ia1040.personalExemptionCredit', tracedFromComputation(
    form.personalExemptionCredit,
    'ia1040.personalExemptionCredit',
    [],
    `IA personal exemption credit ($40 x ${form.exemptionCount} persons)`,
  ))
  creditInputs.push('ia1040.personalExemptionCredit')

  if (form.iaEIC > 0) {
    values.set('ia1040.iaEIC', tracedFromComputation(
      form.iaEIC,
      'ia1040.iaEIC',
      [],
      'IA Earned Income Credit (15% of federal EITC)',
    ))
    creditInputs.push('ia1040.iaEIC')
  }

  if (form.totalCredits > 0) {
    values.set('ia1040.totalCredits', tracedFromComputation(
      form.totalCredits,
      'ia1040.totalCredits',
      creditInputs,
      'IA total credits',
    ))
  }

  // Tax after credits
  const taxAfterInputs = ['ia1040.iaTax']
  if (form.totalCredits > 0) taxAfterInputs.push('ia1040.totalCredits')
  values.set('ia1040.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'ia1040.taxAfterCredits',
    taxAfterInputs,
    'IA tax after credits',
  ))

  // Withholding
  if (form.stateWithholding > 0) {
    values.set('ia1040.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'ia1040.stateWithholding',
      [],
      'IA state income tax withheld',
    ))
  }

  // Result
  const resultInputs = ['ia1040.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('ia1040.stateWithholding')

  if (form.overpaid > 0) {
    values.set('ia1040.overpaid', tracedFromComputation(
      form.overpaid,
      'ia1040.overpaid',
      resultInputs,
      'IA overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('ia1040.amountOwed', tracedFromComputation(
      form.amountOwed,
      'ia1040.amountOwed',
      resultInputs,
      'IA amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): IA1040Result {
  return result.detail as IA1040Result
}

const IA_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Iowa starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'IA 1040 Instructions',
          pubUrl: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
        },
      },
      {
        label: 'IA Additions',
        nodeId: 'ia1040.iaAdditions',
        getValue: (r) => d(r).iaAdditions,
        showWhen: (r) => d(r).iaAdditions > 0,
        tooltip: {
          explanation: 'Iowa additions include federally tax-exempt interest income (municipal bonds from other states).',
          pubName: 'IA 1040 Instructions',
          pubUrl: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
        },
      },
      {
        label: 'IA Subtractions',
        nodeId: 'ia1040.iaSubtractions',
        getValue: (r) => d(r).iaSubtractions,
        showWhen: (r) => d(r).iaSubtractions > 0,
        tooltip: {
          explanation: 'Iowa subtractions include US government obligation interest and Social Security benefits (fully exempt starting 2023).',
          pubName: 'IA 1040 Instructions',
          pubUrl: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
        },
      },
      {
        label: 'Iowa Net Income',
        nodeId: 'ia1040.iaNetIncome',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Iowa net income: Federal AGI + IA additions - IA subtractions.',
          pubName: 'IA 1040 Instructions',
          pubUrl: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'Iowa Standard Deduction',
        nodeId: 'ia1040.standardDeduction',
        getValue: (r) => d(r).standardDeduction,
        tooltip: {
          explanation: 'Iowa has its own standard deduction amounts: $2,210 for single/MFS, $5,450 for MFJ/HOH/QW.',
          pubName: 'IA 1040 Instructions',
          pubUrl: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
        },
      },
      {
        label: 'Iowa Taxable Income',
        nodeId: 'ia1040.iaTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Iowa taxable income equals net income minus the Iowa standard deduction. For part-year/nonresidents, this is the apportioned amount.',
          pubName: 'IA 1040 Instructions',
          pubUrl: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'Iowa Tax (3.8%)',
        nodeId: 'ia1040.iaTax',
        getValue: (r) => d(r).iaTax,
        tooltip: {
          explanation: 'Iowa applies a flat 3.8% tax rate to taxable income (2025 reform).',
          pubName: 'IA 1040 Instructions',
          pubUrl: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
        },
      },
      {
        label: 'Personal Exemption Credit',
        nodeId: 'ia1040.personalExemptionCredit',
        getValue: (r) => d(r).personalExemptionCredit,
        tooltip: {
          explanation: 'Iowa personal exemption credit: $40 per person (taxpayer, spouse if MFJ, and each dependent).',
          pubName: 'IA 1040 Instructions',
          pubUrl: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
        },
      },
      {
        label: 'IA Earned Income Credit',
        nodeId: 'ia1040.iaEIC',
        getValue: (r) => d(r).iaEIC,
        showWhen: (r) => d(r).iaEIC > 0,
        tooltip: {
          explanation: 'Iowa Earned Income Credit equals 15% of your federal Earned Income Tax Credit.',
          pubName: 'IA 1040 Instructions',
          pubUrl: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
        },
      },
      {
        label: 'IA Tax After Credits',
        nodeId: 'ia1040.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Iowa income tax after personal exemption credit and earned income credit.',
          pubName: 'IA 1040 Instructions',
          pubUrl: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'IA State Withholding',
        nodeId: 'ia1040.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Iowa tax withheld from W-2 Box 17 entries for IA.',
          pubName: 'IA 1040 Instructions',
          pubUrl: 'https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/1040-expanded-instructions',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const IA_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'IA Refund',
    nodeId: 'ia1040.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'IA Amount You Owe',
    nodeId: 'ia1040.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'IA tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const iaModule: StateRulesModule = {
  stateCode: 'IA',
  stateName: 'Iowa',
  formLabel: 'IA Form IA 1040',
  sidebarLabel: 'IA Form IA 1040',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeIA1040(model, federal, config))
  },
  nodeLabels: IA_NODE_LABELS,
  collectTracedValues: collectIATracedValues,
  reviewLayout: IA_REVIEW_LAYOUT,
  reviewResultLines: IA_REVIEW_RESULT_LINES,
}
