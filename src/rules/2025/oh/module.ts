/** OH state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormIT1040, type FormIT1040Result } from './formIT1040'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormIT1040Result): StateComputeResult {
  return {
    stateCode: 'OH',
    formLabel: 'OH Form IT 1040',
    residencyType: form.residencyType,
    stateAGI: form.ohAGI,
    stateTaxableIncome: form.ohTaxableIncome,
    stateTax: form.ohTaxBeforeCredits,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const OH_NODE_LABELS: Record<string, string> = {
  'formit1040.ohDeductions': 'OH deductions (SS exemption)',
  'formit1040.ohAGI': 'Ohio adjusted gross income',
  'formit1040.ohTaxableIncome': 'Ohio taxable income',
  'formit1040.ohTaxBeforeCredits': 'Ohio tax before credits',
  'formit1040.personalExemptionCredit': 'Ohio personal exemption credit',
  'formit1040.jointFilingCredit': 'Ohio joint filing credit',
  'formit1040.ohEITC': 'Ohio Earned Income Tax Credit',
  'formit1040.taxAfterCredits': 'OH tax after credits',
  'formit1040.stateWithholding': 'OH state income tax withheld',
  'formit1040.overpaid': 'OH overpaid (refund)',
  'formit1040.amountOwed': 'OH amount you owe',
}

function collectOHTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormIT1040Result
  const values = new Map<string, TracedValue>()

  const ohAGIInputs = ['form1040.line11']
  if (form.ohDeductions > 0) {
    ohAGIInputs.push('formit1040.ohDeductions')
    values.set('formit1040.ohDeductions', tracedFromComputation(
      form.ohDeductions, 'formit1040.ohDeductions', [],
      'OH deductions (SS exemption)',
    ))
  }

  values.set('formit1040.ohAGI', tracedFromComputation(
    form.ohAGI,
    'formit1040.ohAGI',
    ohAGIInputs,
    'Ohio adjusted gross income',
  ))

  values.set('formit1040.ohTaxableIncome', tracedFromComputation(
    form.ohTaxableIncome,
    'formit1040.ohTaxableIncome',
    ['formit1040.ohAGI'],
    'Ohio taxable income',
  ))

  values.set('formit1040.ohTaxBeforeCredits', tracedFromComputation(
    form.ohTaxBeforeCredits,
    'formit1040.ohTaxBeforeCredits',
    ['formit1040.ohTaxableIncome'],
    'Ohio tax before credits',
  ))

  const taxAfterCreditsInputs = ['formit1040.ohTaxBeforeCredits']
  if (form.personalExemptionCredit > 0) {
    taxAfterCreditsInputs.push('formit1040.personalExemptionCredit')
    values.set('formit1040.personalExemptionCredit', tracedFromComputation(
      form.personalExemptionCredit,
      'formit1040.personalExemptionCredit',
      ['formit1040.ohAGI'],
      'Ohio personal exemption credit',
    ))
  }
  if (form.jointFilingCredit > 0) {
    taxAfterCreditsInputs.push('formit1040.jointFilingCredit')
    values.set('formit1040.jointFilingCredit', tracedFromComputation(
      form.jointFilingCredit,
      'formit1040.jointFilingCredit',
      ['formit1040.ohTaxBeforeCredits'],
      'Ohio joint filing credit',
    ))
  }
  if (form.ohEITC > 0) {
    taxAfterCreditsInputs.push('formit1040.ohEITC')
    values.set('formit1040.ohEITC', tracedFromComputation(
      form.ohEITC,
      'formit1040.ohEITC',
      [],
      'Ohio Earned Income Tax Credit (30% of federal EITC)',
    ))
  }

  values.set('formit1040.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'formit1040.taxAfterCredits',
    taxAfterCreditsInputs,
    'OH tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('formit1040.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'formit1040.stateWithholding',
      [],
      'OH state income tax withheld',
    ))
  }

  if (form.overpaid > 0) {
    values.set('formit1040.overpaid', tracedFromComputation(
      form.overpaid,
      'formit1040.overpaid',
      ['formit1040.taxAfterCredits', 'formit1040.stateWithholding'],
      'OH overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('formit1040.amountOwed', tracedFromComputation(
      form.amountOwed,
      'formit1040.amountOwed',
      ['formit1040.taxAfterCredits', 'formit1040.stateWithholding'],
      'OH amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormIT1040Result {
  return result.detail as FormIT1040Result
}

const OH_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Ohio starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'OH IT 1040 Instructions',
          pubUrl: 'https://tax.ohio.gov/individual/resources/annual-tax-rates',
        },
      },
      {
        label: 'OH Deductions (SS Exemption)',
        nodeId: 'formit1040.ohDeductions',
        getValue: (r) => d(r).ohDeductions,
        showWhen: (r) => d(r).ohDeductions > 0,
        tooltip: {
          explanation: 'Ohio fully exempts Social Security income. This deduction removes SS benefits from Ohio AGI.',
          pubName: 'OH IT 1040 Instructions',
          pubUrl: 'https://tax.ohio.gov/individual/resources/annual-tax-rates',
        },
      },
      {
        label: 'OH AGI',
        nodeId: 'formit1040.ohAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Ohio adjusted gross income: Federal AGI + OH additions \u2212 OH deductions.',
          pubName: 'OH IT 1040 Instructions',
          pubUrl: 'https://tax.ohio.gov/individual/resources/annual-tax-rates',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'OH Taxable Income',
        nodeId: 'formit1040.ohTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Ohio taxable income equals Ohio AGI (Ohio has no standard deduction).',
          pubName: 'OH IT 1040 Instructions',
          pubUrl: 'https://tax.ohio.gov/individual/resources/annual-tax-rates',
        },
      },
      {
        label: 'OH Tax Before Credits',
        nodeId: 'formit1040.ohTaxBeforeCredits',
        getValue: (r) => d(r).ohTaxBeforeCredits,
        tooltip: {
          explanation: 'Ohio income tax computed using the progressive bracket schedule.',
          pubName: 'OH IT 1040 Instructions',
          pubUrl: 'https://tax.ohio.gov/individual/resources/annual-tax-rates',
        },
      },
      {
        label: 'Personal Exemption Credit',
        nodeId: 'formit1040.personalExemptionCredit',
        getValue: (r) => d(r).personalExemptionCredit,
        showWhen: (r) => d(r).personalExemptionCredit > 0,
        tooltip: {
          explanation: 'Ohio personal exemption credit of $2,400 per exemption, phased out for Ohio AGI between $40,000 and $80,000.',
          pubName: 'OH IT 1040 Instructions',
          pubUrl: 'https://tax.ohio.gov/individual/resources/annual-tax-rates',
        },
      },
      {
        label: 'Joint Filing Credit',
        nodeId: 'formit1040.jointFilingCredit',
        getValue: (r) => d(r).jointFilingCredit,
        showWhen: (r) => d(r).jointFilingCredit > 0,
        tooltip: {
          explanation: 'Ohio joint filing credit (MFJ only): lesser of $650 or remaining tax liability after personal exemption credit.',
          pubName: 'OH IT 1040 Instructions',
          pubUrl: 'https://tax.ohio.gov/individual/resources/annual-tax-rates',
        },
      },
      {
        label: 'OH EITC',
        nodeId: 'formit1040.ohEITC',
        getValue: (r) => d(r).ohEITC,
        showWhen: (r) => d(r).ohEITC > 0,
        tooltip: {
          explanation: 'Ohio Earned Income Tax Credit equals 30% of the federal earned income credit. Nonrefundable — cannot exceed remaining tax liability.',
          pubName: 'OH IT 1040 Instructions',
          pubUrl: 'https://tax.ohio.gov/individual/resources/annual-tax-rates',
        },
      },
      {
        label: 'OH Tax After Credits',
        nodeId: 'formit1040.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Ohio income tax after all nonrefundable credits.',
          pubName: 'OH IT 1040 Instructions',
          pubUrl: 'https://tax.ohio.gov/individual/resources/annual-tax-rates',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'OH State Withholding',
        nodeId: 'formit1040.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Ohio tax withheld from W-2 Box 17 entries for OH.',
          pubName: 'OH IT 1040 Instructions',
          pubUrl: 'https://tax.ohio.gov/individual/resources/annual-tax-rates',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const OH_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'OH Refund',
    nodeId: 'formit1040.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'OH Amount You Owe',
    nodeId: 'formit1040.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'OH tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const ohModule: StateRulesModule = {
  stateCode: 'OH',
  stateName: 'Ohio',
  formLabel: 'OH Form IT 1040',
  sidebarLabel: 'OH IT 1040',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormIT1040(model, federal, config))
  },
  nodeLabels: OH_NODE_LABELS,
  collectTracedValues: collectOHTracedValues,
  reviewLayout: OH_REVIEW_LAYOUT,
  reviewResultLines: OH_REVIEW_RESULT_LINES,
}
