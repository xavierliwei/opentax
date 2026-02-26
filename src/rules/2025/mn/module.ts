/** MN state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormM1, type FormM1Result } from './formM1'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormM1Result): StateComputeResult {
  return {
    stateCode: 'MN',
    formLabel: 'MN Form M1',
    residencyType: form.residencyType,
    stateAGI: form.mnAGI,
    stateTaxableIncome: form.mnTaxableIncome,
    stateTax: form.mnTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const MN_NODE_LABELS: Record<string, string> = {
  'formM1.mnAdditions': 'MN additions to federal AGI',
  'formM1.mnSubtractions': 'MN subtractions from federal AGI',
  'formM1.mnAGI': 'Minnesota adjusted gross income',
  'formM1.deductionUsed': 'MN deduction (standard or itemized)',
  'formM1.mnTaxableIncome': 'Minnesota taxable income',
  'formM1.mnTax': 'Minnesota income tax',
  'formM1.mnWorkingFamilyCredit': 'MN Working Family Credit',
  'formM1.mnChildTaxCredit': 'MN Child Tax Credit',
  'formM1.taxAfterCredits': 'MN tax after credits',
  'formM1.stateWithholding': 'MN state income tax withheld',
  'formM1.overpaid': 'MN overpaid (refund)',
  'formM1.amountOwed': 'MN amount you owe',
}

function collectMNTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormM1Result
  const values = new Map<string, TracedValue>()

  const mnAGIInputs = ['form1040.line11']
  if (form.mnAdditions > 0) {
    mnAGIInputs.push('formM1.mnAdditions')
    values.set('formM1.mnAdditions', tracedFromComputation(
      form.mnAdditions, 'formM1.mnAdditions', [],
      'MN additions to federal AGI',
    ))
  }
  if (form.mnSubtractions > 0) {
    mnAGIInputs.push('formM1.mnSubtractions')
    values.set('formM1.mnSubtractions', tracedFromComputation(
      form.mnSubtractions, 'formM1.mnSubtractions', [],
      'MN subtractions (SS exemption, US gov interest)',
    ))
  }

  values.set('formM1.mnAGI', tracedFromComputation(
    form.mnAGI,
    'formM1.mnAGI',
    mnAGIInputs,
    'Minnesota adjusted gross income',
  ))

  values.set('formM1.deductionUsed', tracedFromComputation(
    form.deductionUsed,
    'formM1.deductionUsed',
    [],
    `MN ${form.deductionMethod} deduction`,
  ))

  const taxableInputs = ['formM1.mnAGI', 'formM1.deductionUsed']
  values.set('formM1.mnTaxableIncome', tracedFromComputation(
    form.mnTaxableIncome,
    'formM1.mnTaxableIncome',
    taxableInputs,
    'Minnesota taxable income',
  ))

  values.set('formM1.mnTax', tracedFromComputation(
    form.mnTax,
    'formM1.mnTax',
    ['formM1.mnTaxableIncome'],
    'Minnesota income tax',
  ))

  const taxAfterInputs = ['formM1.mnTax']
  if (form.mnWorkingFamilyCredit > 0) {
    values.set('formM1.mnWorkingFamilyCredit', tracedFromComputation(
      form.mnWorkingFamilyCredit,
      'formM1.mnWorkingFamilyCredit',
      [],
      'MN Working Family Credit (25% of federal EITC)',
    ))
    taxAfterInputs.push('formM1.mnWorkingFamilyCredit')
  }

  if (form.mnChildTaxCredit > 0) {
    values.set('formM1.mnChildTaxCredit', tracedFromComputation(
      form.mnChildTaxCredit,
      'formM1.mnChildTaxCredit',
      [],
      'MN Child Tax Credit ($1,750 per qualifying child)',
    ))
    taxAfterInputs.push('formM1.mnChildTaxCredit')
  }

  values.set('formM1.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'formM1.taxAfterCredits',
    taxAfterInputs,
    'MN tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('formM1.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'formM1.stateWithholding',
      [],
      'MN state income tax withheld',
    ))
  }

  if (form.overpaid > 0) {
    values.set('formM1.overpaid', tracedFromComputation(
      form.overpaid,
      'formM1.overpaid',
      ['formM1.taxAfterCredits', 'formM1.stateWithholding'],
      'MN overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('formM1.amountOwed', tracedFromComputation(
      form.amountOwed,
      'formM1.amountOwed',
      ['formM1.taxAfterCredits', 'formM1.stateWithholding'],
      'MN amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormM1Result {
  return result.detail as FormM1Result
}

const MN_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Minnesota starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'MN Form M1 Instructions',
          pubUrl: 'https://www.revenue.state.mn.us/individual-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MN Additions',
        nodeId: 'formM1.mnAdditions',
        getValue: (r) => d(r).mnAdditions,
        showWhen: (r) => d(r).mnAdditions > 0,
        tooltip: {
          explanation: 'MN additions to federal AGI for items where Minnesota does not conform to federal treatment (e.g. bond interest from non-MN states).',
          pubName: 'MN Schedule M1M',
          pubUrl: 'https://www.revenue.state.mn.us/individual-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MN Subtractions',
        nodeId: 'formM1.mnSubtractions',
        getValue: (r) => d(r).mnSubtractions,
        showWhen: (r) => d(r).mnSubtractions > 0,
        tooltip: {
          explanation: 'MN subtractions include Social Security exemption and US government obligation interest.',
          pubName: 'MN Schedule M1M',
          pubUrl: 'https://www.revenue.state.mn.us/individual-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MN AGI',
        nodeId: 'formM1.mnAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Minnesota adjusted gross income: Federal AGI + MN additions - MN subtractions.',
          pubName: 'MN Form M1 Instructions',
          pubUrl: 'https://www.revenue.state.mn.us/individual-income-tax-forms-and-instructions',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'MN Deduction',
        nodeId: 'formM1.deductionUsed',
        getValue: (r) => d(r).deductionUsed,
        tooltip: {
          explanation: 'MN standard deduction or MN itemized deduction, whichever is larger. MN itemized deductions follow federal Schedule A but remove the federal $10K SALT cap.',
          pubName: 'MN Form M1 Instructions',
          pubUrl: 'https://www.revenue.state.mn.us/individual-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MN Taxable Income',
        nodeId: 'formM1.mnTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Minnesota taxable income equals MN AGI minus the deduction.',
          pubName: 'MN Form M1 Instructions',
          pubUrl: 'https://www.revenue.state.mn.us/individual-income-tax-forms-and-instructions',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'MN Tax',
        nodeId: 'formM1.mnTax',
        getValue: (r) => d(r).mnTax,
        tooltip: {
          explanation: 'Minnesota income tax computed using the progressive rate schedule (5.35% to 9.85%).',
          pubName: 'MN Form M1 Instructions',
          pubUrl: 'https://www.revenue.state.mn.us/individual-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MN Working Family Credit',
        nodeId: 'formM1.mnWorkingFamilyCredit',
        getValue: (r) => d(r).mnWorkingFamilyCredit,
        showWhen: (r) => d(r).mnWorkingFamilyCredit > 0,
        tooltip: {
          explanation: 'Minnesota Working Family Credit equals approximately 25% of the federal earned income credit.',
          pubName: 'MN Form M1 Instructions',
          pubUrl: 'https://www.revenue.state.mn.us/individual-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MN Child Tax Credit',
        nodeId: 'formM1.mnChildTaxCredit',
        getValue: (r) => d(r).mnChildTaxCredit,
        showWhen: (r) => d(r).mnChildTaxCredit > 0,
        tooltip: {
          explanation: 'Minnesota Child Tax Credit: $1,750 per qualifying child under age 17.',
          pubName: 'MN Form M1 Instructions',
          pubUrl: 'https://www.revenue.state.mn.us/individual-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MN Tax After Credits',
        nodeId: 'formM1.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Minnesota income tax after all credits.',
          pubName: 'MN Form M1 Instructions',
          pubUrl: 'https://www.revenue.state.mn.us/individual-income-tax-forms-and-instructions',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'MN State Withholding',
        nodeId: 'formM1.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Minnesota tax withheld from W-2 Box 17 entries for MN.',
          pubName: 'MN Form M1 Instructions',
          pubUrl: 'https://www.revenue.state.mn.us/individual-income-tax-forms-and-instructions',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const MN_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'MN Refund',
    nodeId: 'formM1.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'MN Amount You Owe',
    nodeId: 'formM1.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'MN tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const mnModule: StateRulesModule = {
  stateCode: 'MN',
  stateName: 'Minnesota',
  formLabel: 'MN Form M1',
  sidebarLabel: 'MN Form M1',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormM1(model, federal, config))
  },
  nodeLabels: MN_NODE_LABELS,
  collectTracedValues: collectMNTracedValues,
  reviewLayout: MN_REVIEW_LAYOUT,
  reviewResultLines: MN_REVIEW_RESULT_LINES,
}
