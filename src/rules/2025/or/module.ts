/** OR state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormOR40, type FormOR40Result } from './or40'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormOR40Result): StateComputeResult {
  return {
    stateCode: 'OR',
    formLabel: 'OR Form OR-40',
    residencyType: form.residencyType,
    stateAGI: form.orAGI,
    stateTaxableIncome: form.orTaxableIncome,
    stateTax: form.orTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const OR_NODE_LABELS: Record<string, string> = {
  'formOR40.orAdditions': 'OR additions to federal AGI',
  'formOR40.orSubtractions': 'OR subtractions from federal AGI',
  'formOR40.orAGI': 'Oregon adjusted gross income',
  'formOR40.deductionUsed': 'OR deduction (standard or itemized)',
  'formOR40.orTaxableIncome': 'Oregon taxable income',
  'formOR40.orTax': 'Oregon income tax',
  'formOR40.personalExemptionCredit': 'OR personal exemption credit',
  'formOR40.orEITC': 'Oregon Earned Income Credit',
  'formOR40.taxAfterCredits': 'OR tax after credits',
  'formOR40.stateWithholding': 'OR state income tax withheld',
  'formOR40.overpaid': 'OR overpaid (refund)',
  'formOR40.amountOwed': 'OR amount you owe',
}

function collectORTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormOR40Result
  const values = new Map<string, TracedValue>()

  const orAGIInputs = ['form1040.line11']
  if (form.orAdditions > 0) {
    orAGIInputs.push('formOR40.orAdditions')
    values.set('formOR40.orAdditions', tracedFromComputation(
      form.orAdditions, 'formOR40.orAdditions', [],
      'OR additions to federal AGI',
    ))
  }
  if (form.orSubtractions > 0) {
    orAGIInputs.push('formOR40.orSubtractions')
    values.set('formOR40.orSubtractions', tracedFromComputation(
      form.orSubtractions, 'formOR40.orSubtractions', [],
      'OR subtractions (US gov interest)',
    ))
  }

  values.set('formOR40.orAGI', tracedFromComputation(
    form.orAGI,
    'formOR40.orAGI',
    orAGIInputs,
    'Oregon adjusted gross income',
  ))

  values.set('formOR40.deductionUsed', tracedFromComputation(
    form.deductionUsed,
    'formOR40.deductionUsed',
    [],
    `OR ${form.deductionMethod} deduction`,
  ))

  const taxableInputs = ['formOR40.orAGI', 'formOR40.deductionUsed']
  values.set('formOR40.orTaxableIncome', tracedFromComputation(
    form.orTaxableIncome,
    'formOR40.orTaxableIncome',
    taxableInputs,
    'Oregon taxable income',
  ))

  values.set('formOR40.orTax', tracedFromComputation(
    form.orTax,
    'formOR40.orTax',
    ['formOR40.orTaxableIncome'],
    'Oregon income tax',
  ))

  const taxAfterInputs = ['formOR40.orTax']
  if (form.personalExemptionCredit > 0) {
    values.set('formOR40.personalExemptionCredit', tracedFromComputation(
      form.personalExemptionCredit,
      'formOR40.personalExemptionCredit',
      [],
      `OR personal exemption credit ($236 x ${form.personalExemptionCount})`,
    ))
    taxAfterInputs.push('formOR40.personalExemptionCredit')
  }

  if (form.orEITC > 0) {
    values.set('formOR40.orEITC', tracedFromComputation(
      form.orEITC,
      'formOR40.orEITC',
      [],
      'Oregon Earned Income Credit (12%/9% of federal EITC)',
    ))
    taxAfterInputs.push('formOR40.orEITC')
  }

  values.set('formOR40.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'formOR40.taxAfterCredits',
    taxAfterInputs,
    'OR tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('formOR40.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'formOR40.stateWithholding',
      [],
      'OR state income tax withheld',
    ))
  }

  if (form.overpaid > 0) {
    values.set('formOR40.overpaid', tracedFromComputation(
      form.overpaid,
      'formOR40.overpaid',
      ['formOR40.taxAfterCredits', 'formOR40.stateWithholding'],
      'OR overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('formOR40.amountOwed', tracedFromComputation(
      form.amountOwed,
      'formOR40.amountOwed',
      ['formOR40.taxAfterCredits', 'formOR40.stateWithholding'],
      'OR amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormOR40Result {
  return result.detail as FormOR40Result
}

const OR_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Oregon starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'OR Form OR-40 Instructions',
          pubUrl: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2024.pdf',
        },
      },
      {
        label: 'OR Additions',
        nodeId: 'formOR40.orAdditions',
        getValue: (r) => d(r).orAdditions,
        showWhen: (r) => d(r).orAdditions > 0,
        tooltip: {
          explanation: 'Oregon additions to federal AGI for items where Oregon does not conform to federal treatment (e.g. non-OR bond interest).',
          pubName: 'OR Schedule OR-ASC',
          pubUrl: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2024.pdf',
        },
      },
      {
        label: 'OR Subtractions',
        nodeId: 'formOR40.orSubtractions',
        getValue: (r) => d(r).orSubtractions,
        showWhen: (r) => d(r).orSubtractions > 0,
        tooltip: {
          explanation: 'Oregon subtractions include US government obligation interest.',
          pubName: 'OR Schedule OR-ASC',
          pubUrl: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2024.pdf',
        },
      },
      {
        label: 'OR AGI',
        nodeId: 'formOR40.orAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Oregon adjusted gross income: Federal AGI + OR additions - OR subtractions.',
          pubName: 'OR Form OR-40 Instructions',
          pubUrl: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2024.pdf',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'OR Deduction',
        nodeId: 'formOR40.deductionUsed',
        getValue: (r) => d(r).deductionUsed,
        tooltip: {
          explanation: 'Oregon standard deduction or Oregon itemized deduction, whichever is larger. Oregon standard deductions are significantly lower than federal ($2,745 single / $5,495 MFJ).',
          pubName: 'OR Form OR-40 Instructions',
          pubUrl: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2024.pdf',
        },
      },
      {
        label: 'OR Taxable Income',
        nodeId: 'formOR40.orTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Oregon taxable income equals OR AGI minus the deduction.',
          pubName: 'OR Form OR-40 Instructions',
          pubUrl: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2024.pdf',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'OR Tax',
        nodeId: 'formOR40.orTax',
        getValue: (r) => d(r).orTax,
        tooltip: {
          explanation: 'Oregon income tax computed using the progressive rate schedule (4.75% to 9.9%). Oregon has one of the highest top rates in the nation.',
          pubName: 'OR Form OR-40 Instructions',
          pubUrl: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2024.pdf',
        },
      },
      {
        label: 'OR Personal Exemption Credit',
        nodeId: 'formOR40.personalExemptionCredit',
        getValue: (r) => d(r).personalExemptionCredit,
        showWhen: (r) => d(r).personalExemptionCredit > 0,
        tooltip: {
          explanation: 'Oregon personal exemption credit: $236 per exemption (taxpayer, spouse, dependents). Phases out at higher income levels.',
          pubName: 'OR Form OR-40 Instructions',
          pubUrl: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2024.pdf',
        },
      },
      {
        label: 'OR Earned Income Credit',
        nodeId: 'formOR40.orEITC',
        getValue: (r) => d(r).orEITC,
        showWhen: (r) => d(r).orEITC > 0,
        tooltip: {
          explanation: 'Oregon Earned Income Credit: 12% of federal EITC (with qualifying children) or 9% (without).',
          pubName: 'OR Form OR-40 Instructions',
          pubUrl: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2024.pdf',
        },
      },
      {
        label: 'OR Tax After Credits',
        nodeId: 'formOR40.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Oregon income tax after all credits.',
          pubName: 'OR Form OR-40 Instructions',
          pubUrl: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2024.pdf',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'OR State Withholding',
        nodeId: 'formOR40.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Oregon tax withheld from W-2 Box 17 entries for OR.',
          pubName: 'OR Form OR-40 Instructions',
          pubUrl: 'https://www.oregon.gov/dor/forms/FormsPubs/form-or-40-inst_101-040-1_2024.pdf',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const OR_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'OR Refund',
    nodeId: 'formOR40.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'OR Amount You Owe',
    nodeId: 'formOR40.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'OR tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const orModule: StateRulesModule = {
  stateCode: 'OR',
  stateName: 'Oregon',
  formLabel: 'OR Form OR-40',
  sidebarLabel: 'OR Form OR-40',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormOR40(model, federal, config))
  },
  nodeLabels: OR_NODE_LABELS,
  collectTracedValues: collectORTracedValues,
  reviewLayout: OR_REVIEW_LAYOUT,
  reviewResultLines: OR_REVIEW_RESULT_LINES,
}
