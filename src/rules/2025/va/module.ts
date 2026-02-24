import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import type { StateRulesModule, StateComputeResult, StateReviewResultLine, StateReviewSection } from '../../stateEngine'
import { computeForm760 } from './form760'
import type { Form760Result } from './form760'

function toStateResult(form760: Form760Result): StateComputeResult {
  const isPartYear = form760.residencyType !== 'full-year'
  return {
    stateCode: 'VA',
    formLabel: isPartYear ? 'VA Form 760PY' : 'VA Form 760',
    residencyType: form760.residencyType,
    stateAGI: form760.vaAGI,
    stateTaxableIncome: form760.vaTaxableIncome,
    stateTax: form760.vaTax,
    stateCredits: form760.exemptions,
    taxAfterCredits: form760.taxAfterCredits,
    stateWithholding: form760.stateWithholding,
    overpaid: form760.overpaid,
    amountOwed: form760.amountOwed,
    apportionmentRatio: form760.apportionmentRatio,
    detail: form760,
  }
}

const VA_NODE_LABELS: Record<string, string> = {
  'form760.vaAGI': 'Virginia adjusted gross income',
  'form760.vaSourceIncome': 'Virginia-source income (apportioned)',
  'form760.vaDeduction': 'Virginia deduction',
  'form760.vaTaxableIncome': 'Virginia taxable income',
  'form760.vaTax': 'Virginia tax',
  'form760.exemptions': 'Virginia personal/dependent exemptions',
  'form760.taxAfterCredits': 'Virginia tax after credits',
  'form760.stateWithholding': 'VA state income tax withheld',
  'form760.overpaid': 'VA overpaid (refund)',
  'form760.amountOwed': 'VA amount you owe',
}

function collectVATracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form760 = result.detail as Form760Result
  const values = new Map<string, TracedValue>()

  values.set('form760.vaAGI', tracedFromComputation(
    form760.vaAGI,
    'form760.vaAGI',
    ['form1040.line11'],
    'Virginia adjusted gross income',
  ))

  if (form760.vaSourceIncome !== undefined) {
    values.set('form760.vaSourceIncome', tracedFromComputation(
      form760.vaSourceIncome,
      'form760.vaSourceIncome',
      ['form760.vaAGI'],
      'Virginia-source income',
    ))
  }

  values.set('form760.vaDeduction', tracedFromComputation(
    form760.deductionUsed,
    'form760.vaDeduction',
    [],
    `VA ${form760.deductionMethod} deduction`,
  ))

  values.set('form760.vaTaxableIncome', tracedFromComputation(
    form760.vaTaxableIncome,
    'form760.vaTaxableIncome',
    [form760.vaSourceIncome !== undefined ? 'form760.vaSourceIncome' : 'form760.vaAGI', 'form760.vaDeduction'],
    'Virginia taxable income',
  ))

  values.set('form760.vaTax', tracedFromComputation(
    form760.vaTax,
    'form760.vaTax',
    ['form760.vaTaxableIncome'],
    'Virginia tax',
  ))

  values.set('form760.exemptions', tracedFromComputation(
    form760.exemptions,
    'form760.exemptions',
    [],
    'Virginia exemptions',
  ))

  values.set('form760.taxAfterCredits', tracedFromComputation(
    form760.taxAfterCredits,
    'form760.taxAfterCredits',
    ['form760.vaTax', 'form760.exemptions'],
    'Virginia tax after credits',
  ))

  if (form760.stateWithholding > 0) {
    values.set('form760.stateWithholding', tracedFromComputation(
      form760.stateWithholding,
      'form760.stateWithholding',
      [],
      'VA state withholding',
    ))
  }

  if (form760.overpaid > 0) {
    values.set('form760.overpaid', tracedFromComputation(
      form760.overpaid,
      'form760.overpaid',
      ['form760.taxAfterCredits', 'form760.stateWithholding'],
      'VA refund',
    ))
  }

  if (form760.amountOwed > 0) {
    values.set('form760.amountOwed', tracedFromComputation(
      form760.amountOwed,
      'form760.amountOwed',
      ['form760.taxAfterCredits', 'form760.stateWithholding'],
      'VA amount owed',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form760Result {
  return result.detail as Form760Result
}

const VA_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Virginia starts with your federal adjusted gross income from Form 1040 line 11.',
          pubName: 'Virginia Form 760 Instructions',
          pubUrl: 'https://www.tax.virginia.gov/forms/search?title=760',
        },
      },
      {
        label: 'VA AGI',
        nodeId: 'form760.vaAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Virginia adjusted gross income starts from federal AGI with Virginia-specific adjustments.',
          pubName: 'Virginia Form 760 Instructions',
          pubUrl: 'https://www.tax.virginia.gov/forms/search?title=760',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'VA Deduction',
        nodeId: 'form760.vaDeduction',
        getValue: (r) => d(r).deductionUsed,
        tooltip: {
          explanation: 'Virginia uses the larger of Virginia standard deduction or eligible itemized deduction.',
          pubName: 'Virginia Form 760 Instructions',
          pubUrl: 'https://www.tax.virginia.gov/forms/search?title=760',
        },
      },
      {
        label: 'VA Taxable Income',
        nodeId: 'form760.vaTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Virginia taxable income after deductions.',
          pubName: 'Virginia Form 760 Instructions',
          pubUrl: 'https://www.tax.virginia.gov/forms/search?title=760',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'VA Tax',
        nodeId: 'form760.vaTax',
        getValue: (r) => d(r).vaTax,
        tooltip: {
          explanation: 'Virginia tax computed using the state rate schedule.',
          pubName: 'Virginia Tax Rate Schedule',
          pubUrl: 'https://www.tax.virginia.gov/individual-income-tax-rates',
        },
      },
      {
        label: 'VA Exemptions',
        nodeId: 'form760.exemptions',
        getValue: (r) => d(r).exemptions,
        tooltip: {
          explanation: 'Virginia personal and dependent exemptions reduce tax.',
          pubName: 'Virginia Form 760 Instructions',
          pubUrl: 'https://www.tax.virginia.gov/forms/search?title=760',
        },
      },
      {
        label: 'VA Tax After Credits',
        nodeId: 'form760.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Virginia tax after exemptions and credits.',
          pubName: 'Virginia Form 760 Instructions',
          pubUrl: 'https://www.tax.virginia.gov/forms/search?title=760',
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
          explanation: 'Virginia tax withheld from W-2 forms.',
          pubName: 'Virginia Form 760 Instructions',
          pubUrl: 'https://www.tax.virginia.gov/forms/search?title=760',
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
