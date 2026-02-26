/** MI state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeMI1040, type MI1040Result } from './mi1040'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: MI1040Result): StateComputeResult {
  return {
    stateCode: 'MI',
    formLabel: 'MI Form MI-1040',
    residencyType: form.residencyType,
    stateAGI: form.miAGI,
    stateTaxableIncome: form.miTaxableIncome,
    stateTax: form.miTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const MI_NODE_LABELS: Record<string, string> = {
  'mi1040.miAdditions': 'MI additions to federal AGI',
  'mi1040.miSubtractions': 'MI subtractions from federal AGI',
  'mi1040.miAGI': 'Michigan adjusted gross income',
  'mi1040.personalExemptions': 'MI personal exemptions',
  'mi1040.miTaxableIncome': 'Michigan taxable income',
  'mi1040.miTax': 'Michigan income tax (4.25%)',
  'mi1040.miEITC': 'Michigan EITC (30% of federal)',
  'mi1040.taxAfterCredits': 'MI tax after credits',
  'mi1040.stateWithholding': 'MI state income tax withheld',
  'mi1040.overpaid': 'MI overpaid (refund)',
  'mi1040.amountOwed': 'MI amount you owe',
}

function collectMITracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as MI1040Result
  const values = new Map<string, TracedValue>()

  // AGI inputs
  const miAGIInputs = ['form1040.line11']
  if (form.miAdditions > 0) {
    miAGIInputs.push('mi1040.miAdditions')
    values.set('mi1040.miAdditions', tracedFromComputation(
      form.miAdditions, 'mi1040.miAdditions', [],
      'MI additions (other state obligation interest)',
    ))
  }
  if (form.miSubtractions > 0) {
    miAGIInputs.push('mi1040.miSubtractions')
    values.set('mi1040.miSubtractions', tracedFromComputation(
      form.miSubtractions, 'mi1040.miSubtractions', [],
      'MI subtractions (SS exemption, US gov interest)',
    ))
  }

  values.set('mi1040.miAGI', tracedFromComputation(
    form.miAGI,
    'mi1040.miAGI',
    miAGIInputs,
    'Michigan adjusted gross income',
  ))

  if (form.personalExemptions > 0) {
    values.set('mi1040.personalExemptions', tracedFromComputation(
      form.personalExemptions,
      'mi1040.personalExemptions',
      [],
      `MI personal exemptions (${form.numExemptions} x $5,600)`,
    ))
  }

  const taxableInputs = ['mi1040.miAGI']
  if (form.personalExemptions > 0) taxableInputs.push('mi1040.personalExemptions')
  values.set('mi1040.miTaxableIncome', tracedFromComputation(
    form.miTaxableIncome,
    'mi1040.miTaxableIncome',
    taxableInputs,
    'Michigan taxable income',
  ))

  values.set('mi1040.miTax', tracedFromComputation(
    form.miTax,
    'mi1040.miTax',
    ['mi1040.miTaxableIncome'],
    'Michigan income tax (4.25%)',
  ))

  const taxAfterInputs = ['mi1040.miTax']
  if (form.miEITC > 0) {
    values.set('mi1040.miEITC', tracedFromComputation(
      form.miEITC,
      'mi1040.miEITC',
      [],
      'Michigan EITC (30% of federal)',
    ))
    taxAfterInputs.push('mi1040.miEITC')
  }

  values.set('mi1040.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'mi1040.taxAfterCredits',
    taxAfterInputs,
    'MI tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('mi1040.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'mi1040.stateWithholding',
      [],
      'MI state income tax withheld',
    ))
  }

  const resultInputs = ['mi1040.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('mi1040.stateWithholding')
  if (form.miEITC > 0) resultInputs.push('mi1040.miEITC')

  if (form.overpaid > 0) {
    values.set('mi1040.overpaid', tracedFromComputation(
      form.overpaid,
      'mi1040.overpaid',
      resultInputs,
      'MI overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('mi1040.amountOwed', tracedFromComputation(
      form.amountOwed,
      'mi1040.amountOwed',
      resultInputs,
      'MI amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): MI1040Result {
  return result.detail as MI1040Result
}

const MI_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Michigan starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'MI-1040 Instructions',
          pubUrl: 'https://www.michigan.gov/taxes/iit-forms',
        },
      },
      {
        label: 'MI Additions',
        nodeId: 'mi1040.miAdditions',
        getValue: (r) => d(r).miAdditions,
        showWhen: (r) => d(r).miAdditions > 0,
        tooltip: {
          explanation: 'Michigan additions include interest and dividends from obligations of other states and municipalities.',
          pubName: 'MI-1040 Instructions',
          pubUrl: 'https://www.michigan.gov/taxes/iit-forms',
        },
      },
      {
        label: 'MI Subtractions',
        nodeId: 'mi1040.miSubtractions',
        getValue: (r) => d(r).miSubtractions,
        showWhen: (r) => d(r).miSubtractions > 0,
        tooltip: {
          explanation: 'Michigan subtractions include Social Security benefits (fully exempt), US government obligation interest, military pay, and retirement/pension income.',
          pubName: 'MI-1040 Instructions',
          pubUrl: 'https://www.michigan.gov/taxes/iit-forms',
        },
      },
      {
        label: 'MI AGI',
        nodeId: 'mi1040.miAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Michigan adjusted gross income: Federal AGI + MI additions - MI subtractions.',
          pubName: 'MI-1040 Instructions',
          pubUrl: 'https://www.michigan.gov/taxes/iit-forms',
        },
      },
    ],
  },
  {
    title: 'Exemptions',
    items: [
      {
        label: 'Personal Exemptions',
        nodeId: 'mi1040.personalExemptions',
        getValue: (r) => d(r).personalExemptions,
        tooltip: {
          explanation: 'Michigan allows a $5,600 personal exemption for each person (taxpayer, spouse if MFJ, and each dependent).',
          pubName: 'MI-1040 Instructions',
          pubUrl: 'https://www.michigan.gov/taxes/iit-forms',
        },
        showWhen: (r) => d(r).personalExemptions > 0,
      },
      {
        label: 'MI Taxable Income',
        nodeId: 'mi1040.miTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Michigan taxable income equals MI AGI minus personal exemptions.',
          pubName: 'MI-1040 Instructions',
          pubUrl: 'https://www.michigan.gov/taxes/iit-forms',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'MI Tax (4.25%)',
        nodeId: 'mi1040.miTax',
        getValue: (r) => d(r).miTax,
        tooltip: {
          explanation: 'Michigan applies a flat 4.25% tax rate to taxable income.',
          pubName: 'MI-1040 Instructions',
          pubUrl: 'https://www.michigan.gov/taxes/iit-forms',
        },
      },
      {
        label: 'MI EITC (30% of Federal)',
        nodeId: 'mi1040.miEITC',
        getValue: (r) => d(r).miEITC,
        showWhen: (r) => d(r).miEITC > 0,
        tooltip: {
          explanation: 'Michigan Earned Income Tax Credit equals 30% of your federal EITC. This is a refundable credit.',
          pubName: 'MI-1040 Instructions, MCL 206.272',
          pubUrl: 'https://www.michigan.gov/taxes/iit-forms',
        },
      },
      {
        label: 'MI Tax After Credits',
        nodeId: 'mi1040.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Michigan income tax after all credits.',
          pubName: 'MI-1040 Instructions',
          pubUrl: 'https://www.michigan.gov/taxes/iit-forms',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'MI State Withholding',
        nodeId: 'mi1040.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Michigan tax withheld from W-2 Box 17 entries for MI.',
          pubName: 'MI-1040 Instructions',
          pubUrl: 'https://www.michigan.gov/taxes/iit-forms',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const MI_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'MI Refund',
    nodeId: 'mi1040.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'MI Amount You Owe',
    nodeId: 'mi1040.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'MI tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const miModule: StateRulesModule = {
  stateCode: 'MI',
  stateName: 'Michigan',
  formLabel: 'MI Form MI-1040',
  sidebarLabel: 'MI Form MI-1040',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeMI1040(model, federal, config))
  },
  nodeLabels: MI_NODE_LABELS,
  collectTracedValues: collectMITracedValues,
  reviewLayout: MI_REVIEW_LAYOUT,
  reviewResultLines: MI_REVIEW_RESULT_LINES,
}
