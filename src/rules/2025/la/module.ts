/** LA state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeIT540, type IT540Result } from './it540'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: IT540Result): StateComputeResult {
  return {
    stateCode: 'LA',
    formLabel: 'LA Form IT-540',
    residencyType: form.residencyType,
    stateAGI: form.laAGI,
    stateTaxableIncome: form.laTaxableIncome,
    stateTax: form.laTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const LA_NODE_LABELS: Record<string, string> = {
  'it540.laAdditions': 'LA additions',
  'it540.laSubtractions': 'LA subtractions',
  'it540.laAGI': 'Louisiana adjusted gross income',
  'it540.standardDeduction': 'LA standard deduction',
  'it540.laTaxableIncome': 'Louisiana taxable income',
  'it540.laTax': 'Louisiana income tax (3.0%)',
  'it540.dependentCredit': 'LA dependent credit',
  'it540.laEIC': 'LA Earned Income Credit',
  'it540.totalCredits': 'LA total credits',
  'it540.taxAfterCredits': 'LA tax after credits',
  'it540.stateWithholding': 'LA state income tax withheld',
  'it540.overpaid': 'LA overpaid (refund)',
  'it540.amountOwed': 'LA amount you owe',
}

function collectLATracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as IT540Result
  const values = new Map<string, TracedValue>()

  // Additions
  if (form.laAdditions > 0) {
    values.set('it540.laAdditions', tracedFromComputation(
      form.laAdditions, 'it540.laAdditions', [],
      'LA additions (non-LA municipal bond interest)',
    ))
  }

  // Subtractions
  if (form.laSubtractions > 0) {
    values.set('it540.laSubtractions', tracedFromComputation(
      form.laSubtractions, 'it540.laSubtractions', [],
      'LA subtractions (US gov interest, SS exemption)',
    ))
  }

  // LA AGI
  const agiInputs = ['form1040.line11']
  if (form.laAdditions > 0) agiInputs.push('it540.laAdditions')
  if (form.laSubtractions > 0) agiInputs.push('it540.laSubtractions')
  values.set('it540.laAGI', tracedFromComputation(
    form.laAGI,
    'it540.laAGI',
    agiInputs,
    'Louisiana adjusted gross income (federal AGI + additions - subtractions)',
  ))

  // Standard deduction
  values.set('it540.standardDeduction', tracedFromComputation(
    form.standardDeduction,
    'it540.standardDeduction',
    [],
    'Louisiana standard deduction',
  ))

  // Taxable income
  values.set('it540.laTaxableIncome', tracedFromComputation(
    form.laTaxableIncome,
    'it540.laTaxableIncome',
    ['it540.laAGI', 'it540.standardDeduction'],
    'Louisiana taxable income',
  ))

  // Tax
  values.set('it540.laTax', tracedFromComputation(
    form.laTax,
    'it540.laTax',
    ['it540.laTaxableIncome'],
    'Louisiana income tax (3.0% flat rate)',
  ))

  // Credits
  const creditInputs: string[] = []

  if (form.dependentCredit > 0) {
    values.set('it540.dependentCredit', tracedFromComputation(
      form.dependentCredit,
      'it540.dependentCredit',
      [],
      `LA dependent credit ($100 x ${form.dependentCredit / 10000} dependents)`,
    ))
    creditInputs.push('it540.dependentCredit')
  }

  if (form.laEIC > 0) {
    values.set('it540.laEIC', tracedFromComputation(
      form.laEIC,
      'it540.laEIC',
      [],
      'LA Earned Income Credit (5% of federal EITC)',
    ))
    creditInputs.push('it540.laEIC')
  }

  if (form.totalCredits > 0) {
    values.set('it540.totalCredits', tracedFromComputation(
      form.totalCredits,
      'it540.totalCredits',
      creditInputs,
      'LA total credits',
    ))
  }

  // Tax after credits
  const taxAfterInputs = ['it540.laTax']
  if (form.totalCredits > 0) taxAfterInputs.push('it540.totalCredits')
  values.set('it540.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'it540.taxAfterCredits',
    taxAfterInputs,
    'LA tax after credits',
  ))

  // Withholding
  if (form.stateWithholding > 0) {
    values.set('it540.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'it540.stateWithholding',
      [],
      'LA state income tax withheld',
    ))
  }

  // Result
  const resultInputs = ['it540.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('it540.stateWithholding')

  if (form.overpaid > 0) {
    values.set('it540.overpaid', tracedFromComputation(
      form.overpaid,
      'it540.overpaid',
      resultInputs,
      'LA overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('it540.amountOwed', tracedFromComputation(
      form.amountOwed,
      'it540.amountOwed',
      resultInputs,
      'LA amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): IT540Result {
  return result.detail as IT540Result
}

const LA_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Louisiana starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'LA IT-540 Instructions',
          pubUrl: 'https://revenue.louisiana.gov/tax-forms/individuals/',
        },
      },
      {
        label: 'LA Additions',
        nodeId: 'it540.laAdditions',
        getValue: (r) => d(r).laAdditions,
        showWhen: (r) => d(r).laAdditions > 0,
        tooltip: {
          explanation: 'Louisiana additions include non-Louisiana municipal bond interest that is federally tax-exempt but taxable by Louisiana.',
          pubName: 'LA IT-540 Instructions',
          pubUrl: 'https://revenue.louisiana.gov/tax-forms/individuals/',
        },
      },
      {
        label: 'LA Subtractions',
        nodeId: 'it540.laSubtractions',
        getValue: (r) => d(r).laSubtractions,
        showWhen: (r) => d(r).laSubtractions > 0,
        tooltip: {
          explanation: 'Louisiana subtractions include US government obligation interest and Social Security benefits (fully exempt in LA).',
          pubName: 'LA IT-540 Instructions',
          pubUrl: 'https://revenue.louisiana.gov/tax-forms/individuals/',
        },
      },
      {
        label: 'LA AGI',
        nodeId: 'it540.laAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Louisiana adjusted gross income: Federal AGI + LA additions - LA subtractions.',
          pubName: 'LA IT-540 Instructions',
          pubUrl: 'https://revenue.louisiana.gov/tax-forms/individuals/',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'LA Standard Deduction',
        nodeId: 'it540.standardDeduction',
        getValue: (r) => d(r).standardDeduction,
        tooltip: {
          explanation: 'Louisiana standard deduction under the 2025 tax reform: $12,500 (Single/MFS), $25,000 (MFJ/QW), $18,750 (HOH).',
          pubName: 'LA IT-540 Instructions',
          pubUrl: 'https://revenue.louisiana.gov/tax-forms/individuals/',
        },
      },
      {
        label: 'LA Taxable Income',
        nodeId: 'it540.laTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Louisiana taxable income equals LA AGI minus the standard deduction. For part-year residents and nonresidents, this is the apportioned amount.',
          pubName: 'LA IT-540 Instructions',
          pubUrl: 'https://revenue.louisiana.gov/tax-forms/individuals/',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'LA Tax (3.0%)',
        nodeId: 'it540.laTax',
        getValue: (r) => d(r).laTax,
        tooltip: {
          explanation: 'Louisiana applies a flat 3.0% tax rate to taxable income under the 2025 tax reform.',
          pubName: 'LA IT-540 Instructions',
          pubUrl: 'https://revenue.louisiana.gov/tax-forms/individuals/',
        },
      },
      {
        label: 'Dependent Credit',
        nodeId: 'it540.dependentCredit',
        getValue: (r) => d(r).dependentCredit,
        showWhen: (r) => d(r).dependentCredit > 0,
        tooltip: {
          explanation: 'Louisiana dependent credit: $100 per qualifying dependent (new under 2025 reform).',
          pubName: 'LA IT-540 Instructions',
          pubUrl: 'https://revenue.louisiana.gov/tax-forms/individuals/',
        },
      },
      {
        label: 'LA Earned Income Credit',
        nodeId: 'it540.laEIC',
        getValue: (r) => d(r).laEIC,
        showWhen: (r) => d(r).laEIC > 0,
        tooltip: {
          explanation: 'Louisiana Earned Income Credit equals 5% of your federal Earned Income Tax Credit (new under 2025 reform).',
          pubName: 'LA IT-540 Instructions',
          pubUrl: 'https://revenue.louisiana.gov/tax-forms/individuals/',
        },
      },
      {
        label: 'LA Tax After Credits',
        nodeId: 'it540.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Louisiana income tax after all credits (dependent credit, EITC).',
          pubName: 'LA IT-540 Instructions',
          pubUrl: 'https://revenue.louisiana.gov/tax-forms/individuals/',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'LA State Withholding',
        nodeId: 'it540.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Louisiana tax withheld from W-2 Box 17 entries for LA.',
          pubName: 'LA IT-540 Instructions',
          pubUrl: 'https://revenue.louisiana.gov/tax-forms/individuals/',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const LA_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'LA Refund',
    nodeId: 'it540.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'LA Amount You Owe',
    nodeId: 'it540.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'LA tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const laModule: StateRulesModule = {
  stateCode: 'LA',
  stateName: 'Louisiana',
  formLabel: 'LA Form IT-540',
  sidebarLabel: 'LA Form IT-540',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeIT540(model, federal, config))
  },
  nodeLabels: LA_NODE_LABELS,
  collectTracedValues: collectLATracedValues,
  reviewLayout: LA_REVIEW_LAYOUT,
  reviewResultLines: LA_REVIEW_RESULT_LINES,
}
