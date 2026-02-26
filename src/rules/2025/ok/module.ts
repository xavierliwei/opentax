/** OK state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm511, type Form511Result } from './form511'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: Form511Result): StateComputeResult {
  const isPartYear = form.residencyType === 'part-year'
  return {
    stateCode: 'OK',
    formLabel: isPartYear ? 'OK Form 511 (Part-Year)' : 'OK Form 511',
    residencyType: form.residencyType,
    stateAGI: form.okAGI,
    stateTaxableIncome: form.okTaxableIncome,
    stateTax: form.okTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const OK_NODE_LABELS: Record<string, string> = {
  'form511.okAdditions': 'OK additions to federal AGI',
  'form511.okSubtractions': 'OK subtractions from federal AGI',
  'form511.okAGI': 'Oklahoma adjusted gross income',
  'form511.deductionUsed': 'OK deduction (standard or itemized)',
  'form511.personalExemptions': 'OK personal exemptions',
  'form511.okTaxableIncome': 'Oklahoma taxable income',
  'form511.okTax': 'Oklahoma income tax',
  'form511.okEITC': 'OK Earned Income Tax Credit',
  'form511.okChildTaxCredit': 'OK Child Tax Credit',
  'form511.taxAfterCredits': 'OK tax after credits',
  'form511.stateWithholding': 'OK state income tax withheld',
  'form511.overpaid': 'OK overpaid (refund)',
  'form511.amountOwed': 'OK amount you owe',
}

function collectOKTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as Form511Result
  const values = new Map<string, TracedValue>()

  const okAGIInputs = ['form1040.line11']
  if (form.okAdditions > 0) {
    okAGIInputs.push('form511.okAdditions')
    values.set('form511.okAdditions', tracedFromComputation(
      form.okAdditions, 'form511.okAdditions', [],
      'OK additions to federal AGI',
    ))
  }
  if (form.okSubtractions > 0) {
    okAGIInputs.push('form511.okSubtractions')
    values.set('form511.okSubtractions', tracedFromComputation(
      form.okSubtractions, 'form511.okSubtractions', [],
      'OK subtractions (SS exemption, US gov interest, military retirement)',
    ))
  }

  values.set('form511.okAGI', tracedFromComputation(
    form.okAGI,
    'form511.okAGI',
    okAGIInputs,
    'Oklahoma adjusted gross income',
  ))

  values.set('form511.deductionUsed', tracedFromComputation(
    form.deductionUsed,
    'form511.deductionUsed',
    [],
    `OK ${form.deductionMethod} deduction`,
  ))

  values.set('form511.personalExemptions', tracedFromComputation(
    form.personalExemptions,
    'form511.personalExemptions',
    [],
    `OK personal exemptions ($1,000 x ${form.personalExemptionCount})`,
  ))

  const taxableInputs = ['form511.okAGI', 'form511.deductionUsed', 'form511.personalExemptions']
  values.set('form511.okTaxableIncome', tracedFromComputation(
    form.okTaxableIncome,
    'form511.okTaxableIncome',
    taxableInputs,
    'Oklahoma taxable income',
  ))

  values.set('form511.okTax', tracedFromComputation(
    form.okTax,
    'form511.okTax',
    ['form511.okTaxableIncome'],
    'Oklahoma income tax',
  ))

  const taxAfterInputs = ['form511.okTax']
  if (form.okEITC > 0) {
    values.set('form511.okEITC', tracedFromComputation(
      form.okEITC,
      'form511.okEITC',
      [],
      'OK Earned Income Tax Credit (5% of federal EITC, nonrefundable)',
    ))
    taxAfterInputs.push('form511.okEITC')
  }

  if (form.okChildTaxCredit > 0) {
    values.set('form511.okChildTaxCredit', tracedFromComputation(
      form.okChildTaxCredit,
      'form511.okChildTaxCredit',
      [],
      'OK Child Tax Credit ($100 per qualifying child)',
    ))
    taxAfterInputs.push('form511.okChildTaxCredit')
  }

  values.set('form511.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'form511.taxAfterCredits',
    taxAfterInputs,
    'OK tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('form511.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'form511.stateWithholding',
      [],
      'OK state income tax withheld',
    ))
  }

  if (form.overpaid > 0) {
    values.set('form511.overpaid', tracedFromComputation(
      form.overpaid,
      'form511.overpaid',
      ['form511.taxAfterCredits', 'form511.stateWithholding'],
      'OK overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('form511.amountOwed', tracedFromComputation(
      form.amountOwed,
      'form511.amountOwed',
      ['form511.taxAfterCredits', 'form511.stateWithholding'],
      'OK amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form511Result {
  return result.detail as Form511Result
}

const OK_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Oklahoma starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
      },
      {
        label: 'OK Additions',
        nodeId: 'form511.okAdditions',
        getValue: (r) => d(r).okAdditions,
        showWhen: (r) => d(r).okAdditions > 0,
        tooltip: {
          explanation: 'Oklahoma additions to federal AGI for items where Oklahoma does not conform to federal treatment (e.g. non-OK municipal bond interest).',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
      },
      {
        label: 'OK Subtractions',
        nodeId: 'form511.okSubtractions',
        getValue: (r) => d(r).okSubtractions,
        showWhen: (r) => d(r).okSubtractions > 0,
        tooltip: {
          explanation: 'Oklahoma subtractions include full Social Security exemption, US government obligation interest, and military retirement pay.',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
      },
      {
        label: 'OK AGI',
        nodeId: 'form511.okAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Oklahoma adjusted gross income: Federal AGI + OK additions - OK subtractions.',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'OK Deduction',
        nodeId: 'form511.deductionUsed',
        getValue: (r) => d(r).deductionUsed,
        tooltip: {
          explanation: 'Oklahoma uses the federal standard deduction amount, or you may itemize. Oklahoma follows federal itemized deduction rules.',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
      },
      {
        label: 'Personal Exemptions',
        nodeId: 'form511.personalExemptions',
        getValue: (r) => d(r).personalExemptions,
        tooltip: {
          explanation: 'Oklahoma allows a $1,000 personal exemption for the taxpayer, spouse (if MFJ), and each dependent.',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
      },
      {
        label: 'OK Taxable Income',
        nodeId: 'form511.okTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Oklahoma taxable income equals OK AGI minus deductions and personal exemptions.',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'OK Tax',
        nodeId: 'form511.okTax',
        getValue: (r) => d(r).okTax,
        tooltip: {
          explanation: 'Oklahoma income tax computed using the progressive rate schedule (0.25% to 4.75%).',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
      },
      {
        label: 'OK Earned Income Credit',
        nodeId: 'form511.okEITC',
        getValue: (r) => d(r).okEITC,
        showWhen: (r) => d(r).okEITC > 0,
        tooltip: {
          explanation: 'Oklahoma EITC equals 5% of the federal earned income credit (nonrefundable).',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
      },
      {
        label: 'OK Child Tax Credit',
        nodeId: 'form511.okChildTaxCredit',
        getValue: (r) => d(r).okChildTaxCredit,
        showWhen: (r) => d(r).okChildTaxCredit > 0,
        tooltip: {
          explanation: 'Oklahoma child tax credit: $100 per qualifying child under age 17 (nonrefundable).',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
      },
      {
        label: 'OK Tax After Credits',
        nodeId: 'form511.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Oklahoma income tax after all credits.',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'OK State Withholding',
        nodeId: 'form511.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Oklahoma tax withheld from W-2 Box 17 entries for OK.',
          pubName: 'OK Form 511 Instructions',
          pubUrl: 'https://oklahoma.gov/tax/individuals/income-tax/forms.html',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const OK_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'OK Refund',
    nodeId: 'form511.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'OK Amount You Owe',
    nodeId: 'form511.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'OK tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const okModule: StateRulesModule = {
  stateCode: 'OK',
  stateName: 'Oklahoma',
  formLabel: 'OK Form 511',
  sidebarLabel: 'OK Form 511',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm511(model, federal, config))
  },
  nodeLabels: OK_NODE_LABELS,
  collectTracedValues: collectOKTracedValues,
  reviewLayout: OK_REVIEW_LAYOUT,
  reviewResultLines: OK_REVIEW_RESULT_LINES,
}
