/** RI state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormRI1040, type FormRI1040Result } from './formRI1040'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormRI1040Result): StateComputeResult {
  return {
    stateCode: 'RI',
    formLabel: 'RI Form RI-1040',
    residencyType: form.residencyType,
    stateAGI: form.riAGI,
    stateTaxableIncome: form.riTaxableIncome,
    stateTax: form.riTax,
    stateCredits: form.totalNonrefundableCredits + form.totalRefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const RI_NODE_LABELS: Record<string, string> = {
  'ri1040.riAdditions': 'RI additions to federal AGI',
  'ri1040.riSubtractions': 'RI subtractions from federal AGI',
  'ri1040.riAGI': 'Rhode Island adjusted gross income',
  'ri1040.riStandardDeduction': 'RI standard deduction',
  'ri1040.personalExemptions': 'RI personal exemptions',
  'ri1040.riTaxableIncome': 'Rhode Island taxable income',
  'ri1040.riTax': 'Rhode Island income tax',
  'ri1040.riEITC': 'RI earned income credit',
  'ri1040.taxAfterCredits': 'RI tax after credits',
  'ri1040.stateWithholding': 'RI state income tax withheld',
  'ri1040.overpaid': 'RI overpaid (refund)',
  'ri1040.amountOwed': 'RI amount you owe',
}

function collectRITracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormRI1040Result
  const values = new Map<string, TracedValue>()

  const riAGIInputs = ['form1040.line11']
  if (form.riAdditions > 0) {
    riAGIInputs.push('ri1040.riAdditions')
    values.set('ri1040.riAdditions', tracedFromComputation(
      form.riAdditions, 'ri1040.riAdditions', [],
      'RI additions to federal AGI',
    ))
  }
  if (form.riSubtractions > 0) {
    riAGIInputs.push('ri1040.riSubtractions')
    values.set('ri1040.riSubtractions', tracedFromComputation(
      form.riSubtractions, 'ri1040.riSubtractions', [],
      'RI subtractions (US gov interest)',
    ))
  }

  values.set('ri1040.riAGI', tracedFromComputation(
    form.riAGI,
    'ri1040.riAGI',
    riAGIInputs,
    'Rhode Island adjusted gross income',
  ))

  values.set('ri1040.riStandardDeduction', tracedFromComputation(
    form.riStandardDeduction,
    'ri1040.riStandardDeduction',
    [],
    'RI standard deduction',
  ))

  if (form.personalExemptions > 0) {
    values.set('ri1040.personalExemptions', tracedFromComputation(
      form.personalExemptions,
      'ri1040.personalExemptions',
      [],
      `RI personal exemptions ($4,700 x ${form.numExemptions})`,
    ))
  }

  const taxableInputs = ['ri1040.riAGI', 'ri1040.riStandardDeduction']
  if (form.personalExemptions > 0) taxableInputs.push('ri1040.personalExemptions')
  values.set('ri1040.riTaxableIncome', tracedFromComputation(
    form.riTaxableIncome,
    'ri1040.riTaxableIncome',
    taxableInputs,
    'Rhode Island taxable income',
  ))

  values.set('ri1040.riTax', tracedFromComputation(
    form.riTax,
    'ri1040.riTax',
    ['ri1040.riTaxableIncome'],
    'RI Tax (3.75% / 4.75% / 5.99%)',
  ))

  const taxAfterInputs = ['ri1040.riTax']
  values.set('ri1040.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'ri1040.taxAfterCredits',
    taxAfterInputs,
    'RI tax after credits',
  ))

  if (form.riEITC > 0) {
    values.set('ri1040.riEITC', tracedFromComputation(
      form.riEITC,
      'ri1040.riEITC',
      [],
      'RI earned income credit (15% of federal EITC)',
    ))
  }

  if (form.stateWithholding > 0) {
    values.set('ri1040.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'ri1040.stateWithholding',
      [],
      'RI state income tax withheld',
    ))
  }

  const resultInputs = ['ri1040.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('ri1040.stateWithholding')
  if (form.riEITC > 0) resultInputs.push('ri1040.riEITC')

  if (form.overpaid > 0) {
    values.set('ri1040.overpaid', tracedFromComputation(
      form.overpaid,
      'ri1040.overpaid',
      resultInputs,
      'RI overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('ri1040.amountOwed', tracedFromComputation(
      form.amountOwed,
      'ri1040.amountOwed',
      resultInputs,
      'RI amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormRI1040Result {
  return result.detail as FormRI1040Result
}

const RI_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for Rhode Island income tax.',
          pubName: 'RI Form RI-1040 Instructions',
          pubUrl: 'https://tax.ri.gov/tax-sections/personal-income-tax',
        },
      },
      {
        label: 'RI Subtractions',
        nodeId: 'ri1040.riSubtractions',
        getValue: (r) => d(r).riSubtractions,
        showWhen: (r) => d(r).riSubtractions > 0,
        tooltip: {
          explanation: 'Rhode Island subtractions include US government obligation interest.',
          pubName: 'RI Form RI-1040 Schedule M',
          pubUrl: 'https://tax.ri.gov/tax-sections/personal-income-tax',
        },
      },
      {
        label: 'RI AGI',
        nodeId: 'ri1040.riAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Rhode Island adjusted gross income: Federal AGI + RI additions - RI subtractions.',
          pubName: 'RI Form RI-1040',
          pubUrl: 'https://tax.ri.gov/tax-sections/personal-income-tax',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'RI Standard Deduction',
        nodeId: 'ri1040.riStandardDeduction',
        getValue: (r) => d(r).riStandardDeduction,
        tooltip: {
          explanation: 'Rhode Island follows the federal standard deduction amounts.',
          pubName: 'RI Form RI-1040',
          pubUrl: 'https://tax.ri.gov/tax-sections/personal-income-tax',
        },
      },
      {
        label: 'Personal Exemptions',
        nodeId: 'ri1040.personalExemptions',
        getValue: (r) => d(r).personalExemptions,
        showWhen: (r) => d(r).personalExemptions > 0,
        tooltip: {
          explanation: 'Rhode Island allows a $4,700 personal exemption per person (taxpayer, spouse, dependents). This is a deduction, not a credit.',
          pubName: 'RI Form RI-1040',
          pubUrl: 'https://tax.ri.gov/tax-sections/personal-income-tax',
        },
      },
      {
        label: 'RI Taxable Income',
        nodeId: 'ri1040.riTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Rhode Island taxable income equals RI AGI minus standard deduction and personal exemptions.',
          pubName: 'RI Form RI-1040',
          pubUrl: 'https://tax.ri.gov/tax-sections/personal-income-tax',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'RI Tax (3.75% / 4.75% / 5.99%)',
        nodeId: 'ri1040.riTax',
        getValue: (r) => d(r).riTax,
        tooltip: {
          explanation: 'Rhode Island income tax computed using 3 graduated brackets: 3.75% on the first $73,450, 4.75% on $73,450-$166,950, and 5.99% on the remainder. Same brackets for all filing statuses.',
          pubName: 'RI Tax Rate Schedule',
          pubUrl: 'https://tax.ri.gov/tax-sections/personal-income-tax',
        },
      },
      {
        label: 'RI Earned Income Credit',
        nodeId: 'ri1040.riEITC',
        getValue: (r) => d(r).riEITC,
        showWhen: (r) => d(r).riEITC > 0,
        tooltip: {
          explanation: 'Refundable Rhode Island EITC equals 15% of the federal earned income credit.',
          pubName: 'RI Form RI-1040',
          pubUrl: 'https://tax.ri.gov/tax-sections/personal-income-tax',
        },
      },
      {
        label: 'RI Tax After Credits',
        nodeId: 'ri1040.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Rhode Island income tax after nonrefundable credits. RI EITC is refundable and applied against the balance due.',
          pubName: 'RI Form RI-1040 Instructions',
          pubUrl: 'https://tax.ri.gov/tax-sections/personal-income-tax',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'RI State Withholding',
        nodeId: 'ri1040.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Rhode Island tax withheld from W-2 Box 17 entries for RI.',
          pubName: 'RI Form RI-1040',
          pubUrl: 'https://tax.ri.gov/tax-sections/personal-income-tax',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const RI_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'RI Refund',
    nodeId: 'ri1040.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'RI Amount You Owe',
    nodeId: 'ri1040.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'RI tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const riModule: StateRulesModule = {
  stateCode: 'RI',
  stateName: 'Rhode Island',
  formLabel: 'RI Form RI-1040',
  sidebarLabel: 'RI Form RI-1040',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormRI1040(model, federal, config))
  },
  nodeLabels: RI_NODE_LABELS,
  collectTracedValues: collectRITracedValues,
  reviewLayout: RI_REVIEW_LAYOUT,
  reviewResultLines: RI_REVIEW_RESULT_LINES,
}
