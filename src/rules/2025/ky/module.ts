/** KY state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm740, type Form740Result } from './form740'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: Form740Result): StateComputeResult {
  return {
    stateCode: 'KY',
    formLabel: 'KY Form 740',
    residencyType: form.residencyType,
    stateAGI: form.kyAGI,
    stateTaxableIncome: form.kyTaxableIncome,
    stateTax: form.kyTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const KY_NODE_LABELS: Record<string, string> = {
  'form740.kyAdditions': 'KY additions (Schedule M Part I)',
  'form740.kySubtractions': 'KY subtractions (Schedule M Part II)',
  'form740.kyAGI': 'Kentucky adjusted gross income',
  'form740.standardDeduction': 'KY standard deduction',
  'form740.kyTaxableIncome': 'Kentucky taxable income',
  'form740.kyTax': 'Kentucky income tax (4.0%)',
  'form740.personalTaxCredit': 'KY personal tax credit ($40/person)',
  'form740.familySizeTaxCredit': 'KY Family Size Tax Credit',
  'form740.totalCredits': 'KY total credits',
  'form740.taxAfterCredits': 'KY tax after credits',
  'form740.stateWithholding': 'KY state income tax withheld',
  'form740.overpaid': 'KY overpaid (refund)',
  'form740.amountOwed': 'KY amount you owe',
}

function collectKYTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as Form740Result
  const values = new Map<string, TracedValue>()

  // Additions
  if (form.kyAdditions > 0) {
    values.set('form740.kyAdditions', tracedFromComputation(
      form.kyAdditions, 'form740.kyAdditions', [],
      'KY additions (other states\' tax-exempt interest)',
    ))
  }

  // Subtractions
  if (form.kySubtractions > 0) {
    values.set('form740.kySubtractions', tracedFromComputation(
      form.kySubtractions, 'form740.kySubtractions', [],
      'KY subtractions (US gov interest, SS exemption, pension exclusion)',
    ))
  }

  // KY AGI
  const agiInputs = ['form1040.line11']
  if (form.kyAdditions > 0) agiInputs.push('form740.kyAdditions')
  if (form.kySubtractions > 0) agiInputs.push('form740.kySubtractions')
  values.set('form740.kyAGI', tracedFromComputation(
    form.kyAGI,
    'form740.kyAGI',
    agiInputs,
    'Kentucky adjusted gross income (federal AGI + additions - subtractions)',
  ))

  // Standard deduction
  values.set('form740.standardDeduction', tracedFromComputation(
    form.standardDeduction,
    'form740.standardDeduction',
    [],
    'Kentucky standard deduction ($3,160 per person)',
  ))

  // Taxable income
  values.set('form740.kyTaxableIncome', tracedFromComputation(
    form.kyTaxableIncome,
    'form740.kyTaxableIncome',
    ['form740.kyAGI', 'form740.standardDeduction'],
    'Kentucky taxable income',
  ))

  // Tax
  values.set('form740.kyTax', tracedFromComputation(
    form.kyTax,
    'form740.kyTax',
    ['form740.kyTaxableIncome'],
    'Kentucky income tax (4.0% flat rate)',
  ))

  // Credits
  const creditInputs: string[] = []

  values.set('form740.personalTaxCredit', tracedFromComputation(
    form.personalTaxCredit,
    'form740.personalTaxCredit',
    [],
    `KY personal tax credit ($40 x ${form.personalTaxCreditCount} persons)`,
  ))
  creditInputs.push('form740.personalTaxCredit')

  if (form.familySizeTaxCredit > 0) {
    values.set('form740.familySizeTaxCredit', tracedFromComputation(
      form.familySizeTaxCredit,
      'form740.familySizeTaxCredit',
      ['form740.kyTax', 'form740.personalTaxCredit'],
      'KY Family Size Tax Credit (based on income and family size)',
    ))
    creditInputs.push('form740.familySizeTaxCredit')
  }

  if (form.totalCredits > 0) {
    values.set('form740.totalCredits', tracedFromComputation(
      form.totalCredits,
      'form740.totalCredits',
      creditInputs,
      'KY total credits',
    ))
  }

  // Tax after credits
  const taxAfterInputs = ['form740.kyTax']
  if (form.totalCredits > 0) taxAfterInputs.push('form740.totalCredits')
  values.set('form740.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'form740.taxAfterCredits',
    taxAfterInputs,
    'KY tax after credits',
  ))

  // Withholding
  if (form.stateWithholding > 0) {
    values.set('form740.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'form740.stateWithholding',
      [],
      'KY state income tax withheld',
    ))
  }

  // Result
  const resultInputs = ['form740.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('form740.stateWithholding')

  if (form.overpaid > 0) {
    values.set('form740.overpaid', tracedFromComputation(
      form.overpaid,
      'form740.overpaid',
      resultInputs,
      'KY overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('form740.amountOwed', tracedFromComputation(
      form.amountOwed,
      'form740.amountOwed',
      resultInputs,
      'KY amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form740Result {
  return result.detail as Form740Result
}

const KY_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Kentucky starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'KY Form 740 Instructions',
          pubUrl: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx',
        },
      },
      {
        label: 'KY Additions',
        nodeId: 'form740.kyAdditions',
        getValue: (r) => d(r).kyAdditions,
        showWhen: (r) => d(r).kyAdditions > 0,
        tooltip: {
          explanation: 'Kentucky additions include federally tax-exempt interest income from other states\' municipal bonds.',
          pubName: 'KY Schedule M',
          pubUrl: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx',
        },
      },
      {
        label: 'KY Subtractions',
        nodeId: 'form740.kySubtractions',
        getValue: (r) => d(r).kySubtractions,
        showWhen: (r) => d(r).kySubtractions > 0,
        tooltip: {
          explanation: 'Kentucky subtractions include US government interest, Social Security benefits (fully exempt in KY), and pension income exclusion ($31,110).',
          pubName: 'KY Schedule M',
          pubUrl: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx',
        },
      },
      {
        label: 'KY AGI',
        nodeId: 'form740.kyAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Kentucky adjusted gross income: Federal AGI + KY additions - KY subtractions.',
          pubName: 'KY Form 740 Instructions',
          pubUrl: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'KY Standard Deduction',
        nodeId: 'form740.standardDeduction',
        getValue: (r) => d(r).standardDeduction,
        tooltip: {
          explanation: 'Kentucky uses its own standard deduction ($3,160 per person), not the federal standard deduction amount.',
          pubName: 'KY Form 740 Instructions',
          pubUrl: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx',
        },
      },
      {
        label: 'KY Taxable Income',
        nodeId: 'form740.kyTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Kentucky taxable income equals KY AGI minus the KY standard deduction (or itemized deductions).',
          pubName: 'KY Form 740 Instructions',
          pubUrl: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'KY Tax (4.0%)',
        nodeId: 'form740.kyTax',
        getValue: (r) => d(r).kyTax,
        tooltip: {
          explanation: 'Kentucky applies a flat 4.0% tax rate to taxable income.',
          pubName: 'KY Form 740 Instructions',
          pubUrl: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx',
        },
      },
      {
        label: 'Personal Tax Credit',
        nodeId: 'form740.personalTaxCredit',
        getValue: (r) => d(r).personalTaxCredit,
        tooltip: {
          explanation: 'Kentucky provides a $40 personal tax credit for each person: taxpayer, spouse (if MFJ), and each dependent.',
          pubName: 'KY Form 740 Instructions',
          pubUrl: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx',
        },
      },
      {
        label: 'Family Size Tax Credit',
        nodeId: 'form740.familySizeTaxCredit',
        getValue: (r) => d(r).familySizeTaxCredit,
        showWhen: (r) => d(r).familySizeTaxCredit > 0,
        tooltip: {
          explanation: 'The KY Family Size Tax Credit provides a credit for low-income taxpayers based on modified gross income and family size. The credit can equal 100% of the tax for very low income.',
          pubName: 'KY Form 740 Instructions',
          pubUrl: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx',
        },
      },
      {
        label: 'KY Tax After Credits',
        nodeId: 'form740.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Kentucky income tax after personal tax credit and Family Size Tax Credit.',
          pubName: 'KY Form 740 Instructions',
          pubUrl: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'KY State Withholding',
        nodeId: 'form740.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Kentucky tax withheld from W-2 Box 17 entries for KY.',
          pubName: 'KY Form 740 Instructions',
          pubUrl: 'https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const KY_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'KY Refund',
    nodeId: 'form740.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'KY Amount You Owe',
    nodeId: 'form740.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'KY tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const kyModule: StateRulesModule = {
  stateCode: 'KY',
  stateName: 'Kentucky',
  formLabel: 'KY Form 740',
  sidebarLabel: 'KY Form 740',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm740(model, federal, config))
  },
  nodeLabels: KY_NODE_LABELS,
  collectTracedValues: collectKYTracedValues,
  reviewLayout: KY_REVIEW_LAYOUT,
  reviewResultLines: KY_REVIEW_RESULT_LINES,
}
