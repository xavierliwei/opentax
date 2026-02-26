/** MS state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm80105, type Form80105Result } from './form80105'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: Form80105Result): StateComputeResult {
  return {
    stateCode: 'MS',
    formLabel: 'MS Form 80-105',
    residencyType: form.residencyType,
    stateAGI: form.msAGI,
    stateTaxableIncome: form.msTaxableIncome,
    stateTax: form.msTax,
    stateCredits: 0,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const MS_NODE_LABELS: Record<string, string> = {
  'form80105.msAdditions': 'MS additions',
  'form80105.msSubtractions': 'MS subtractions',
  'form80105.msAGI': 'Mississippi adjusted gross income',
  'form80105.totalExemptions': 'MS deductions & exemptions',
  'form80105.msTaxableIncome': 'Mississippi taxable income',
  'form80105.msTax': 'Mississippi income tax',
  'form80105.taxAfterCredits': 'MS tax after credits',
  'form80105.stateWithholding': 'MS state income tax withheld',
  'form80105.overpaid': 'MS overpaid (refund)',
  'form80105.amountOwed': 'MS amount you owe',
}

function collectMSTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as Form80105Result
  const values = new Map<string, TracedValue>()

  // Additions
  if (form.msAdditions > 0) {
    values.set('form80105.msAdditions', tracedFromComputation(
      form.msAdditions, 'form80105.msAdditions', [],
      'MS additions (non-MS municipal bond interest)',
    ))
  }

  // Subtractions
  if (form.msSubtractions > 0) {
    values.set('form80105.msSubtractions', tracedFromComputation(
      form.msSubtractions, 'form80105.msSubtractions', [],
      'MS subtractions (US gov interest, SS exemption, retirement exemption, state tax refund)',
    ))
  }

  // MS AGI
  const msAGIInputs = ['form1040.line11']
  if (form.msAdditions > 0) msAGIInputs.push('form80105.msAdditions')
  if (form.msSubtractions > 0) msAGIInputs.push('form80105.msSubtractions')
  values.set('form80105.msAGI', tracedFromComputation(
    form.msAGI,
    'form80105.msAGI',
    msAGIInputs,
    'Mississippi adjusted gross income (federal AGI + additions - subtractions)',
  ))

  // Total exemptions
  values.set('form80105.totalExemptions', tracedFromComputation(
    form.totalExemptions,
    'form80105.totalExemptions',
    [],
    'MS standard deduction + personal exemption + dependent exemptions',
  ))

  // Taxable income
  values.set('form80105.msTaxableIncome', tracedFromComputation(
    form.msTaxableIncome,
    'form80105.msTaxableIncome',
    ['form80105.msAGI', 'form80105.totalExemptions'],
    'Mississippi taxable income (MS AGI minus deductions & exemptions)',
  ))

  // Tax
  values.set('form80105.msTax', tracedFromComputation(
    form.msTax,
    'form80105.msTax',
    ['form80105.msTaxableIncome'],
    'Mississippi income tax (4.4% on income above $10,000)',
  ))

  // Tax after credits
  values.set('form80105.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'form80105.taxAfterCredits',
    ['form80105.msTax'],
    'MS tax after credits',
  ))

  // Withholding
  if (form.stateWithholding > 0) {
    values.set('form80105.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'form80105.stateWithholding',
      [],
      'MS state income tax withheld',
    ))
  }

  // Result
  const resultInputs = ['form80105.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('form80105.stateWithholding')

  if (form.overpaid > 0) {
    values.set('form80105.overpaid', tracedFromComputation(
      form.overpaid,
      'form80105.overpaid',
      resultInputs,
      'MS overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('form80105.amountOwed', tracedFromComputation(
      form.amountOwed,
      'form80105.amountOwed',
      resultInputs,
      'MS amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form80105Result {
  return result.detail as Form80105Result
}

const MS_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Mississippi starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'MS Form 80-105 Instructions',
          pubUrl: 'https://www.dor.ms.gov/individual/individual-income-tax-forms',
        },
      },
      {
        label: 'MS Additions',
        nodeId: 'form80105.msAdditions',
        getValue: (r) => d(r).msAdditions,
        showWhen: (r) => d(r).msAdditions > 0,
        tooltip: {
          explanation: 'Mississippi additions include non-MS municipal bond interest that was federally tax-exempt.',
          pubName: 'MS Form 80-105 Instructions',
          pubUrl: 'https://www.dor.ms.gov/individual/individual-income-tax-forms',
        },
      },
      {
        label: 'MS Subtractions',
        nodeId: 'form80105.msSubtractions',
        getValue: (r) => d(r).msSubtractions,
        showWhen: (r) => d(r).msSubtractions > 0,
        tooltip: {
          explanation: 'Mississippi subtractions include US government interest, Social Security benefits (fully exempt), qualified retirement income (fully exempt), and state tax refunds included in federal AGI.',
          pubName: 'MS Form 80-105 Instructions',
          pubUrl: 'https://www.dor.ms.gov/individual/individual-income-tax-forms',
        },
      },
      {
        label: 'MS AGI',
        nodeId: 'form80105.msAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Mississippi adjusted gross income: Federal AGI + MS additions - MS subtractions.',
          pubName: 'MS Form 80-105 Instructions',
          pubUrl: 'https://www.dor.ms.gov/individual/individual-income-tax-forms',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'MS Deductions & Exemptions',
        nodeId: 'form80105.totalExemptions',
        getValue: (r) => d(r).totalExemptions,
        tooltip: {
          explanation: 'Mississippi standard deduction ($2,300 single / $4,600 MFJ) plus personal exemption ($6,000 single / $12,000 MFJ) plus $1,500 per dependent.',
          pubName: 'MS Form 80-105 Instructions',
          pubUrl: 'https://www.dor.ms.gov/individual/individual-income-tax-forms',
        },
      },
      {
        label: 'MS Taxable Income',
        nodeId: 'form80105.msTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Mississippi taxable income equals MS AGI minus the standard deduction and personal/dependent exemptions.',
          pubName: 'MS Form 80-105 Instructions',
          pubUrl: 'https://www.dor.ms.gov/individual/individual-income-tax-forms',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'MS Tax (4.4%)',
        nodeId: 'form80105.msTax',
        getValue: (r) => d(r).msTax,
        tooltip: {
          explanation: 'Mississippi applies a flat 4.4% tax rate on taxable income above $10,000. The first $10,000 of taxable income is exempt.',
          pubName: 'MS Form 80-105 Instructions',
          pubUrl: 'https://www.dor.ms.gov/individual/individual-income-tax-forms',
        },
      },
      {
        label: 'MS Tax After Credits',
        nodeId: 'form80105.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Mississippi income tax after credits.',
          pubName: 'MS Form 80-105 Instructions',
          pubUrl: 'https://www.dor.ms.gov/individual/individual-income-tax-forms',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'MS State Withholding',
        nodeId: 'form80105.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Mississippi tax withheld from W-2 Box 17 entries for MS.',
          pubName: 'MS Form 80-105 Instructions',
          pubUrl: 'https://www.dor.ms.gov/individual/individual-income-tax-forms',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const MS_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'MS Refund',
    nodeId: 'form80105.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'MS Amount You Owe',
    nodeId: 'form80105.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'MS tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const msModule: StateRulesModule = {
  stateCode: 'MS',
  stateName: 'Mississippi',
  formLabel: 'MS Form 80-105',
  sidebarLabel: 'MS Form 80-105',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm80105(model, federal, config))
  },
  nodeLabels: MS_NODE_LABELS,
  collectTracedValues: collectMSTracedValues,
  reviewLayout: MS_REVIEW_LAYOUT,
  reviewResultLines: MS_REVIEW_RESULT_LINES,
}
