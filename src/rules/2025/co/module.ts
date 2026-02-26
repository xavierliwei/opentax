/** CO state module — Colorado DR 0104 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeDR0104, type DR0104Result } from './dr0104'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: DR0104Result): StateComputeResult {
  return {
    stateCode: 'CO',
    formLabel: 'CO DR 0104',
    residencyType: form.residencyType,
    stateAGI: form.coTaxableIncome,  // CO doesn't use "AGI" — uses federal taxable as base
    stateTaxableIncome: form.coTaxableIncome,
    stateTax: form.coTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const CO_NODE_LABELS: Record<string, string> = {
  'dr0104.federalTaxableIncome': 'Federal taxable income (1040 Line 15)',
  'dr0104.coAdditions': 'CO additions to income',
  'dr0104.coSubtractions': 'CO subtractions from income',
  'dr0104.coTaxableIncome': 'Colorado taxable income',
  'dr0104.coTax': 'Colorado income tax (4.40%)',
  'dr0104.coEITC': 'CO Earned Income Tax Credit (38% of federal)',
  'dr0104.coCTC': 'CO Child Tax Credit (20% of federal)',
  'dr0104.taxAfterCredits': 'CO tax after credits',
  'dr0104.stateWithholding': 'CO state income tax withheld',
  'dr0104.overpaid': 'CO overpaid (refund)',
  'dr0104.amountOwed': 'CO amount you owe',
}

function collectCOTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as DR0104Result
  const values = new Map<string, TracedValue>()

  // Federal taxable income — CO starts here, not AGI
  values.set('dr0104.federalTaxableIncome', tracedFromComputation(
    form.federalTaxableIncome,
    'dr0104.federalTaxableIncome',
    ['form1040.line15'],
    'Federal taxable income (Form 1040 Line 15) — Colorado starting point',
  ))

  const taxableInputs = ['dr0104.federalTaxableIncome']

  if (form.coAdditions > 0) {
    taxableInputs.push('dr0104.coAdditions')
    values.set('dr0104.coAdditions', tracedFromComputation(
      form.coAdditions, 'dr0104.coAdditions', [],
      'CO additions (state/local tax refund)',
    ))
  }

  if (form.coSubtractions > 0) {
    taxableInputs.push('dr0104.coSubtractions')
    values.set('dr0104.coSubtractions', tracedFromComputation(
      form.coSubtractions, 'dr0104.coSubtractions', [],
      'CO subtractions (US gov interest, SS exemption, pension subtraction)',
    ))
  }

  values.set('dr0104.coTaxableIncome', tracedFromComputation(
    form.coTaxableIncome,
    'dr0104.coTaxableIncome',
    taxableInputs,
    'Colorado taxable income',
  ))

  values.set('dr0104.coTax', tracedFromComputation(
    form.coTax,
    'dr0104.coTax',
    ['dr0104.coTaxableIncome'],
    'Colorado income tax (4.40% flat rate)',
  ))

  const taxAfterInputs = ['dr0104.coTax']
  if (form.coEITC > 0) {
    values.set('dr0104.coEITC', tracedFromComputation(
      form.coEITC, 'dr0104.coEITC', [],
      'CO Earned Income Tax Credit (38% of federal EITC)',
    ))
    taxAfterInputs.push('dr0104.coEITC')
  }
  if (form.coCTC > 0) {
    values.set('dr0104.coCTC', tracedFromComputation(
      form.coCTC, 'dr0104.coCTC', [],
      'CO Child Tax Credit (20% of federal CTC)',
    ))
    taxAfterInputs.push('dr0104.coCTC')
  }

  values.set('dr0104.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'dr0104.taxAfterCredits',
    taxAfterInputs,
    'CO tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('dr0104.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'dr0104.stateWithholding',
      [],
      'CO state income tax withheld',
    ))
  }

  const resultInputs = ['dr0104.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('dr0104.stateWithholding')

  if (form.overpaid > 0) {
    values.set('dr0104.overpaid', tracedFromComputation(
      form.overpaid,
      'dr0104.overpaid',
      resultInputs,
      'CO overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('dr0104.amountOwed', tracedFromComputation(
      form.amountOwed,
      'dr0104.amountOwed',
      resultInputs,
      'CO amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): DR0104Result {
  return result.detail as DR0104Result
}

const CO_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal Taxable Income',
        nodeId: 'dr0104.federalTaxableIncome',
        getValue: (r) => d(r).federalTaxableIncome,
        tooltip: {
          explanation: 'Colorado starts from federal taxable income (Form 1040 Line 15), not AGI. This is unique among states.',
          pubName: 'CO DR 0104 Instructions',
          pubUrl: 'https://tax.colorado.gov/individual-income-tax-filing-guide',
        },
      },
      {
        label: 'CO Additions',
        nodeId: 'dr0104.coAdditions',
        getValue: (r) => d(r).coAdditions,
        showWhen: (r) => d(r).coAdditions > 0,
        tooltip: {
          explanation: 'Colorado additions include state/local tax refunds reported on federal return (if taxpayer itemized in prior year).',
          pubName: 'CO DR 0104AD Instructions',
          pubUrl: 'https://tax.colorado.gov/individual-income-tax-filing-guide',
        },
      },
      {
        label: 'CO Subtractions',
        nodeId: 'dr0104.coSubtractions',
        getValue: (r) => d(r).coSubtractions,
        showWhen: (r) => d(r).coSubtractions > 0,
        tooltip: {
          explanation: 'Colorado subtractions include US government interest, Social Security exemption, and pension/annuity subtraction for filers age 55+.',
          pubName: 'CO DR 0104AD Instructions',
          pubUrl: 'https://tax.colorado.gov/individual-income-tax-filing-guide',
        },
      },
      {
        label: 'CO Taxable Income',
        nodeId: 'dr0104.coTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Colorado taxable income = Federal taxable income + CO additions - CO subtractions.',
          pubName: 'CO DR 0104 Line 4',
          pubUrl: 'https://tax.colorado.gov/individual-income-tax-filing-guide',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'CO Tax (4.40%)',
        nodeId: 'dr0104.coTax',
        getValue: (r) => d(r).coTax,
        tooltip: {
          explanation: 'Colorado applies a flat 4.40% income tax rate to Colorado taxable income.',
          pubName: 'CO DR 0104 Line 5',
          pubUrl: 'https://tax.colorado.gov/individual-income-tax-filing-guide',
        },
      },
      {
        label: 'CO EITC (38%)',
        nodeId: 'dr0104.coEITC',
        getValue: (r) => d(r).coEITC,
        showWhen: (r) => d(r).coEITC > 0,
        tooltip: {
          explanation: 'Colorado Earned Income Tax Credit equals 38% of the federal EITC. This is one of the most generous state EITCs in the country.',
          pubName: 'CO DR 0104CR',
          pubUrl: 'https://tax.colorado.gov/individual-income-tax-filing-guide',
        },
      },
      {
        label: 'CO Child Tax Credit',
        nodeId: 'dr0104.coCTC',
        getValue: (r) => d(r).coCTC,
        showWhen: (r) => d(r).coCTC > 0,
        tooltip: {
          explanation: 'Colorado Child Tax Credit equals 20-60% of the federal CTC (income-based). Currently implemented at the 20% base rate.',
          pubName: 'CO DR 0104CR',
          pubUrl: 'https://tax.colorado.gov/individual-income-tax-filing-guide',
        },
      },
      {
        label: 'CO Tax After Credits',
        nodeId: 'dr0104.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Colorado tax after all credits applied.',
          pubName: 'CO DR 0104 Instructions',
          pubUrl: 'https://tax.colorado.gov/individual-income-tax-filing-guide',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'CO State Withholding',
        nodeId: 'dr0104.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Colorado tax withheld from W-2 Box 17 entries for CO.',
          pubName: 'CO DR 0104 Instructions',
          pubUrl: 'https://tax.colorado.gov/individual-income-tax-filing-guide',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const CO_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'CO Refund',
    nodeId: 'dr0104.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'CO Amount You Owe',
    nodeId: 'dr0104.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'CO tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const coModule: StateRulesModule = {
  stateCode: 'CO',
  stateName: 'Colorado',
  formLabel: 'CO DR 0104',
  sidebarLabel: 'CO DR 0104',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeDR0104(model, federal, config))
  },
  nodeLabels: CO_NODE_LABELS,
  collectTracedValues: collectCOTracedValues,
  reviewLayout: CO_REVIEW_LAYOUT,
  reviewResultLines: CO_REVIEW_RESULT_LINES,
}
