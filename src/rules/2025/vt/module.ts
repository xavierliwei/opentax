/**
 * VT State Module — Wraps Form IN-111 computation into the StateRulesModule interface
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormIN111, type FormIN111Result } from './formIN111'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

/** Map a FormIN111Result into the standardised StateComputeResult */
function toStateResult(form: FormIN111Result): StateComputeResult {
  return {
    stateCode: 'VT',
    formLabel: 'VT Form IN-111',
    residencyType: form.residencyType,
    // VT starts from federal taxable income, so stateAGI = federalTaxableIncome
    stateAGI: form.federalTaxableIncome,
    stateTaxableIncome: form.vtTaxableIncome,
    stateTax: form.vtTax,
    stateCredits: form.totalNonrefundableCredits + form.totalRefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

/** Node labels for VT trace nodes */
const VT_NODE_LABELS: Record<string, string> = {
  'in111.federalTaxableIncome': 'Federal taxable income (Form 1040 Line 15)',
  'in111.vtSubtractions': 'VT subtractions (US gov interest)',
  'in111.vtTaxableIncome': 'Vermont taxable income',
  'in111.vtTax': 'Vermont income tax',
  'in111.dependentCareCredit': 'VT child & dependent care credit (24% of federal)',
  'in111.vtEITC': 'VT earned income tax credit (38% of federal)',
  'in111.taxAfterCredits': 'VT tax after credits',
  'in111.stateWithholding': 'VT state income tax withheld',
  'in111.overpaid': 'VT overpaid (refund)',
  'in111.amountOwed': 'VT amount you owe',
}

/** Build traced values for the VT explainability graph */
function collectVTTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormIN111Result
  const values = new Map<string, TracedValue>()

  // Federal taxable income (starting point for VT)
  values.set('in111.federalTaxableIncome', tracedFromComputation(
    form.federalTaxableIncome, 'in111.federalTaxableIncome', ['form1040.line15'],
    'Federal taxable income (Form 1040 Line 15)',
  ))

  // Subtractions (US gov interest)
  if (form.vtSubtractions > 0) {
    values.set('in111.vtSubtractions', tracedFromComputation(
      form.vtSubtractions, 'in111.vtSubtractions', [],
      'VT subtractions (US government obligation interest)',
    ))
  }

  // VT taxable income
  const taxableInputs = ['in111.federalTaxableIncome']
  if (form.vtSubtractions > 0) taxableInputs.push('in111.vtSubtractions')
  values.set('in111.vtTaxableIncome', tracedFromComputation(
    form.vtTaxableIncome, 'in111.vtTaxableIncome', taxableInputs,
    'Vermont taxable income',
  ))

  // VT tax
  values.set('in111.vtTax', tracedFromComputation(
    form.vtTax, 'in111.vtTax', ['in111.vtTaxableIncome'],
    'Vermont income tax (3.35% / 6.60% / 7.60% / 8.75%)',
  ))

  // Dependent care credit (nonrefundable)
  if (form.dependentCareCredit > 0) {
    values.set('in111.dependentCareCredit', tracedFromComputation(
      form.dependentCareCredit, 'in111.dependentCareCredit', [],
      'VT child & dependent care credit (24% of federal)',
    ))
  }

  // VT EITC (refundable)
  if (form.vtEITC > 0) {
    values.set('in111.vtEITC', tracedFromComputation(
      form.vtEITC, 'in111.vtEITC', [],
      'VT earned income tax credit (38% of federal EITC)',
    ))
  }

  // Tax after credits
  const taxAfterInputs = ['in111.vtTax']
  if (form.dependentCareCredit > 0) taxAfterInputs.push('in111.dependentCareCredit')
  values.set('in111.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits, 'in111.taxAfterCredits', taxAfterInputs,
    'VT tax after nonrefundable credits',
  ))

  // State withholding
  if (form.stateWithholding > 0) {
    values.set('in111.stateWithholding', tracedFromComputation(
      form.stateWithholding, 'in111.stateWithholding', [],
      'VT state income tax withheld',
    ))
  }

  // Result (refund or owed)
  const resultInputs = ['in111.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('in111.stateWithholding')
  if (form.vtEITC > 0) resultInputs.push('in111.vtEITC')

  if (form.overpaid > 0) {
    values.set('in111.overpaid', tracedFromComputation(
      form.overpaid, 'in111.overpaid', resultInputs,
      'VT overpaid (refund)',
    ))
  }
  if (form.amountOwed > 0) {
    values.set('in111.amountOwed', tracedFromComputation(
      form.amountOwed, 'in111.amountOwed', resultInputs,
      'VT amount you owe',
    ))
  }

  return values
}

/** Helper to safely extract FormIN111Result from StateComputeResult.detail */
function d(result: StateComputeResult): FormIN111Result {
  return result.detail as FormIN111Result
}

/** Config-driven review layout for the generic StateReviewPage */
const VT_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal Taxable Income',
        nodeId: 'form1040.line15',
        getValue: (r) => d(r).federalTaxableIncome,
        tooltip: {
          explanation: 'Vermont starts from federal taxable income (Form 1040 Line 15), not federal AGI. Because Vermont uses the federal taxable income figure, there is no separate VT standard deduction or personal exemption — those are already embedded in the federal amount.',
          pubName: 'VT Form IN-111 Instructions',
          pubUrl: 'https://tax.vermont.gov/individuals/income-tax',
        },
      },
      {
        label: 'VT Subtractions',
        nodeId: 'in111.vtSubtractions',
        getValue: (r) => d(r).vtSubtractions,
        tooltip: {
          explanation: 'Vermont subtractions include interest from US government obligations (Treasury bonds, etc.), which Vermont exempts from state income tax.',
          pubName: 'VT Form IN-111 Instructions',
          pubUrl: 'https://tax.vermont.gov/individuals/income-tax',
        },
        showWhen: (r) => d(r).vtSubtractions > 0,
      },
      {
        label: 'VT Taxable Income',
        nodeId: 'in111.vtTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Vermont taxable income is federal taxable income plus VT additions minus VT subtractions. Since VT starts from the federal taxable income line, no additional standard deduction is applied.',
          pubName: 'VT Form IN-111 Instructions',
          pubUrl: 'https://tax.vermont.gov/individuals/income-tax',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'VT Tax (3.35% / 6.60% / 7.60% / 8.75%)',
        nodeId: 'in111.vtTax',
        getValue: (r) => d(r).vtTax,
        tooltip: {
          explanation: "Vermont uses a 4-bracket graduated income tax: 3.35% on the first bracket, then 6.60%, 7.60%, and 8.75% on income above the highest threshold. Bracket widths vary by filing status.",
          pubName: 'VT Form IN-111 Instructions — Tax Rate Schedules',
          pubUrl: 'https://tax.vermont.gov/individuals/income-tax',
        },
      },
      {
        label: 'Child & Dependent Care Credit',
        nodeId: 'in111.dependentCareCredit',
        getValue: (r) => d(r).dependentCareCredit,
        tooltip: {
          explanation: 'Vermont allows a child and dependent care credit equal to 24% of the federal child and dependent care credit. This is a nonrefundable credit (limited to the amount of VT tax).',
          pubName: 'VT Form IN-111 Instructions',
          pubUrl: 'https://tax.vermont.gov/individuals/income-tax',
        },
        showWhen: (r) => d(r).dependentCareCredit > 0,
      },
      {
        label: 'VT Earned Income Tax Credit',
        nodeId: 'in111.vtEITC',
        getValue: (r) => d(r).vtEITC,
        tooltip: {
          explanation: 'Vermont allows an earned income tax credit equal to 38% of the federal EITC. This is a refundable credit — one of the highest state EITC rates in the country.',
          pubName: 'VT Form IN-111 Instructions',
          pubUrl: 'https://tax.vermont.gov/individuals/income-tax',
        },
        showWhen: (r) => d(r).vtEITC > 0,
      },
      {
        label: 'VT Tax After Credits',
        nodeId: 'in111.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Vermont tax after subtracting nonrefundable credits (child & dependent care credit). Refundable credits (VT EITC) are applied against this amount in the payments section.',
          pubName: 'VT Form IN-111 Instructions',
          pubUrl: 'https://tax.vermont.gov/individuals/income-tax',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'VT State Withholding',
        nodeId: 'in111.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Vermont state income tax withheld from your W-2(s) Box 17. This is tax you already paid to Vermont through payroll withholding during the year.',
          pubName: 'VT Form IN-111 Instructions',
          pubUrl: 'https://tax.vermont.gov/individuals/income-tax',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const VT_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'VT Refund',
    nodeId: 'in111.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'VT Amount You Owe',
    nodeId: 'in111.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'VT tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const vtModule: StateRulesModule = {
  stateCode: 'VT',
  stateName: 'Vermont',
  formLabel: 'VT Form IN-111',
  sidebarLabel: 'VT Form IN-111',

  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    const form = computeFormIN111(model, federal, config)
    return toStateResult(form)
  },

  nodeLabels: VT_NODE_LABELS,
  collectTracedValues: collectVTTracedValues,
  reviewLayout: VT_REVIEW_LAYOUT,
  reviewResultLines: VT_REVIEW_RESULT_LINES,
}

/** Extract FormIN111Result from a VT StateComputeResult (for backward compat) */
export function extractFormIN111(result: StateComputeResult): FormIN111Result {
  return result.detail as FormIN111Result
}
