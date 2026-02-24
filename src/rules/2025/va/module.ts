/**
 * VA State Module — Wraps Form 760 computation into the StateRulesModule interface
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import type { StateRulesModule, StateComputeResult, StateReviewResultLine, StateReviewSection } from '../../stateEngine'
import { computeForm760 } from './form760'
import type { Form760Result } from './form760'

/** Map a Form760Result into the standardised StateComputeResult */
function toStateResult(form760: Form760Result): StateComputeResult {
  const isPartYear = form760.residencyType === 'part-year'
  return {
    stateCode: 'VA',
    formLabel: isPartYear ? 'VA Form 760PY' : 'VA Form 760',
    residencyType: form760.residencyType,
    stateAGI: form760.vaAGI,
    stateTaxableIncome: form760.vaTaxableIncome,
    stateTax: form760.vaTax,
    stateCredits: form760.totalCredits,
    taxAfterCredits: form760.taxAfterCredits,
    stateWithholding: form760.stateWithholding,
    overpaid: form760.overpaid,
    amountOwed: form760.amountOwed,
    apportionmentRatio: form760.apportionmentRatio,
    detail: form760,
  }
}

/** Node labels for VA trace nodes */
const VA_NODE_LABELS: Record<string, string> = {
  'form760.vaAGI': 'Virginia adjusted gross income',
  'form760.vaSourceIncome': 'VA-source income (apportioned)',
  'form760.apportionmentRatio': 'VA residency apportionment ratio',
  'form760.vaDeduction': 'Virginia deduction',
  'form760.vaExemptions': 'Virginia personal exemptions',
  'form760.vaTaxableIncome': 'Virginia taxable income',
  'form760.vaTax': 'Virginia income tax',
  'form760.lowIncomeCredit': 'VA low-income credit',
  'form760.taxAfterCredits': 'VA tax after credits',
  'form760.stateWithholding': 'VA state income tax withheld',
  'form760.overpaid': 'VA overpaid (refund)',
  'form760.amountOwed': 'VA amount you owe',
  'scheduleADJ.ageDeduction': 'VA age deduction (age 65+)',
  'scheduleADJ.additions': 'VA income additions',
  'scheduleADJ.subtractions': 'VA income subtractions',
}

/** Build traced values for the VA explainability graph */
function collectVATracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form760 = result.detail as Form760Result
  const values = new Map<string, TracedValue>()

  const vaAGIInputs = ['form1040.line11']
  if (form760.vaAdjustments.ageDeduction > 0) vaAGIInputs.push('scheduleADJ.ageDeduction')

  if (form760.vaAdjustments.ageDeduction > 0) {
    values.set('scheduleADJ.ageDeduction', tracedFromComputation(
      form760.vaAdjustments.ageDeduction, 'scheduleADJ.ageDeduction', [],
      'VA age deduction (age 65+)',
    ))
  }
  if (form760.vaAdjustments.subtractions > 0) {
    values.set('scheduleADJ.subtractions', tracedFromComputation(
      form760.vaAdjustments.subtractions, 'scheduleADJ.subtractions',
      form760.vaAdjustments.ageDeduction > 0 ? ['scheduleADJ.ageDeduction'] : [],
      'VA income subtractions',
    ))
  }

  values.set('form760.vaAGI', tracedFromComputation(
    form760.vaAGI, 'form760.vaAGI', vaAGIInputs, 'Virginia adjusted gross income',
  ))

  if (form760.vaSourceIncome !== undefined) {
    values.set('form760.vaSourceIncome', tracedFromComputation(
      form760.vaSourceIncome, 'form760.vaSourceIncome', ['form760.vaAGI'],
      `VA-source income (${Math.round(form760.apportionmentRatio * 100)}% of VA AGI)`,
    ))
  }

  values.set('form760.vaDeduction', tracedFromComputation(
    form760.deductionUsed, 'form760.vaDeduction', [],
    `VA ${form760.deductionMethod} deduction`,
  ))

  values.set('form760.vaExemptions', tracedFromComputation(
    form760.totalExemptions, 'form760.vaExemptions', [],
    'Virginia personal exemptions',
  ))

  values.set('form760.vaTaxableIncome', tracedFromComputation(
    form760.vaTaxableIncome, 'form760.vaTaxableIncome',
    ['form760.vaAGI', 'form760.vaDeduction', 'form760.vaExemptions'],
    'Virginia taxable income',
  ))

  values.set('form760.vaTax', tracedFromComputation(
    form760.vaTax, 'form760.vaTax', ['form760.vaTaxableIncome'], 'Virginia tax',
  ))

  if (form760.lowIncomeCredit > 0) {
    values.set('form760.lowIncomeCredit', tracedFromComputation(
      form760.lowIncomeCredit, 'form760.lowIncomeCredit', ['form760.vaTax'],
      'VA low-income credit',
    ))
  }

  const taxAfterInputs = ['form760.vaTax']
  if (form760.lowIncomeCredit > 0) taxAfterInputs.push('form760.lowIncomeCredit')
  values.set('form760.taxAfterCredits', tracedFromComputation(
    form760.taxAfterCredits, 'form760.taxAfterCredits', taxAfterInputs,
    'VA tax after credits',
  ))

  if (form760.stateWithholding > 0) {
    values.set('form760.stateWithholding', tracedFromComputation(
      form760.stateWithholding, 'form760.stateWithholding', [],
      'VA state income tax withheld',
    ))
  }

  const resultInputs = ['form760.taxAfterCredits']
  if (form760.stateWithholding > 0) resultInputs.push('form760.stateWithholding')
  if (form760.overpaid > 0) {
    values.set('form760.overpaid', tracedFromComputation(
      form760.overpaid, 'form760.overpaid', resultInputs, 'VA overpaid (refund)',
    ))
  }
  if (form760.amountOwed > 0) {
    values.set('form760.amountOwed', tracedFromComputation(
      form760.amountOwed, 'form760.amountOwed', resultInputs, 'VA amount you owe',
    ))
  }

  return values
}

/** Helper to safely extract Form760Result from StateComputeResult.detail */
function d(result: StateComputeResult): Form760Result {
  return result.detail as Form760Result
}

/** Config-driven review layout for the generic StateReviewPage */
const VA_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11.',
          pubName: 'VA Form 760 Instructions — Line 1',
          pubUrl: 'https://www.tax.virginia.gov/form-760-instructions',
        },
      },
      {
        label: 'Schedule ADJ Subtractions',
        nodeId: 'scheduleADJ.subtractions',
        getValue: (r) => d(r).vaAdjustments.subtractions,
        tooltip: {
          explanation: 'Virginia subtractions from federal AGI, including the age deduction for filers 65+.',
          pubName: 'VA Schedule ADJ Instructions',
          pubUrl: 'https://www.tax.virginia.gov/schedule-adj-instructions',
        },
        showWhen: (r) => d(r).vaAdjustments.subtractions > 0,
      },
      {
        label: 'Virginia AGI',
        nodeId: 'form760.vaAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Virginia AGI = Federal AGI + additions - subtractions.',
          pubName: 'VA Form 760 Instructions — Line 5',
          pubUrl: 'https://www.tax.virginia.gov/form-760-instructions',
        },
      },
      {
        label: 'VA-Source Income',
        nodeId: 'form760.vaSourceIncome',
        getValue: (r) => d(r).vaSourceIncome ?? r.stateAGI,
        tooltip: {
          explanation: 'For part-year residents, the portion of VA AGI allocated to Virginia based on days of residency.',
          pubName: 'VA Form 760PY Instructions',
          pubUrl: 'https://www.tax.virginia.gov/form-760py-instructions',
        },
        showWhen: (r) => d(r).residencyType === 'part-year',
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'VA Deduction',
        nodeId: 'form760.vaDeduction',
        getValue: (r) => d(r).deductionUsed,
        tooltip: {
          explanation: 'Virginia uses the larger of the VA standard deduction ($8,000 single / $16,000 MFJ) or VA itemized deductions. VA itemized conforms to federal except state income tax cannot be deducted.',
          pubName: 'VA Form 760 Instructions — Line 6',
          pubUrl: 'https://www.tax.virginia.gov/form-760-instructions',
        },
      },
      {
        label: 'VA Exemptions',
        nodeId: 'form760.vaExemptions',
        getValue: (r) => d(r).totalExemptions,
        tooltip: {
          explanation: 'Virginia personal exemptions: $930 per filer and dependent. Additional $800 for filers age 65+ or blind.',
          pubName: 'VA Form 760 Instructions — Line 7',
          pubUrl: 'https://www.tax.virginia.gov/form-760-instructions',
        },
      },
      {
        label: 'VA Taxable Income',
        nodeId: 'form760.vaTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: "Virginia taxable income = VA AGI minus deductions minus exemptions. Taxed using Virginia's 4-bracket rate schedule (2% to 5.75%).",
          pubName: 'VA 2025 Tax Rate Schedule',
          pubUrl: 'https://www.tax.virginia.gov/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'Virginia Tax',
        nodeId: 'form760.vaTax',
        getValue: (r) => d(r).vaTax,
        tooltip: {
          explanation: 'Virginia income tax from 4-bracket schedule. All income taxed at ordinary rates.',
          pubName: 'VA 2025 Tax Rate Schedule',
          pubUrl: 'https://www.tax.virginia.gov/individual-income-tax',
        },
      },
      {
        label: 'Low-Income Credit',
        nodeId: 'form760.lowIncomeCredit',
        getValue: (r) => d(r).lowIncomeCredit,
        tooltip: {
          explanation: 'Nonrefundable credit for filers with VA taxable income at or below the federal poverty level.',
          pubName: 'VA Schedule CR Instructions',
          pubUrl: 'https://www.tax.virginia.gov/schedule-cr-instructions',
        },
        showWhen: (r) => d(r).lowIncomeCredit > 0,
      },
      {
        label: 'VA Tax After Credits',
        nodeId: 'form760.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Virginia tax after credits. Compared against withholding to determine refund or amount owed.',
          pubName: 'VA Form 760 Instructions — Line 13',
          pubUrl: 'https://www.tax.virginia.gov/form-760-instructions',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'VA State Withholding',
        nodeId: 'form760.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Virginia state income tax withheld from your W-2(s) Box 17.',
          pubName: 'VA Form 760 Instructions — Line 18',
          pubUrl: 'https://www.tax.virginia.gov/form-760-instructions',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const VA_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'VA Refund',
    nodeId: 'form760.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'VA Amount You Owe',
    nodeId: 'form760.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'VA tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const vaModule: StateRulesModule = {
  stateCode: 'VA',
  stateName: 'Virginia',
  formLabel: 'VA Form 760',
  sidebarLabel: 'VA Form 760',

  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm760(model, federal, config))
  },

  nodeLabels: VA_NODE_LABELS,
  collectTracedValues: collectVATracedValues,
  reviewLayout: VA_REVIEW_LAYOUT,
  reviewResultLines: VA_REVIEW_RESULT_LINES,
}
