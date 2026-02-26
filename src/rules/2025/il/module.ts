/** IL state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeIL1040, type IL1040Result } from './il1040'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: IL1040Result): StateComputeResult {
  return {
    stateCode: 'IL',
    formLabel: 'IL Form IL-1040',
    residencyType: form.residencyType,
    stateAGI: form.ilBaseIncome,
    stateTaxableIncome: form.ilTaxableIncome,
    stateTax: form.ilTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const IL_NODE_LABELS: Record<string, string> = {
  'il1040.ilAdditions': 'IL additions (Schedule M)',
  'il1040.ilSubtractions': 'IL subtractions (Schedule M)',
  'il1040.ilBaseIncome': 'Illinois base income',
  'il1040.exemptionAllowance': 'IL personal exemption allowance',
  'il1040.ilNetIncome': 'Illinois net income',
  'il1040.ilTaxableIncome': 'Illinois taxable income',
  'il1040.ilTax': 'Illinois income tax (4.95%)',
  'il1040.ilEIC': 'IL Earned Income Credit',
  'il1040.totalCredits': 'IL total credits',
  'il1040.taxAfterCredits': 'IL tax after credits',
  'il1040.stateWithholding': 'IL state income tax withheld',
  'il1040.overpaid': 'IL overpaid (refund)',
  'il1040.amountOwed': 'IL amount you owe',
}

function collectILTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as IL1040Result
  const values = new Map<string, TracedValue>()

  // Additions
  if (form.ilAdditions > 0) {
    values.set('il1040.ilAdditions', tracedFromComputation(
      form.ilAdditions, 'il1040.ilAdditions', [],
      'IL additions (federally tax-exempt interest)',
    ))
  }

  // Subtractions
  if (form.ilSubtractions > 0) {
    values.set('il1040.ilSubtractions', tracedFromComputation(
      form.ilSubtractions, 'il1040.ilSubtractions', [],
      'IL subtractions (US gov interest, SS exemption, IL tax refund)',
    ))
  }

  // Base income
  const baseInputs = ['form1040.line11']
  if (form.ilAdditions > 0) baseInputs.push('il1040.ilAdditions')
  if (form.ilSubtractions > 0) baseInputs.push('il1040.ilSubtractions')
  values.set('il1040.ilBaseIncome', tracedFromComputation(
    form.ilBaseIncome,
    'il1040.ilBaseIncome',
    baseInputs,
    'Illinois base income (federal AGI + additions - subtractions)',
  ))

  // Exemption allowance
  values.set('il1040.exemptionAllowance', tracedFromComputation(
    form.exemptionAllowance,
    'il1040.exemptionAllowance',
    [],
    `IL exemption allowance ($2,625 x ${form.exemptionCount} persons)`,
  ))

  // Net income
  values.set('il1040.ilNetIncome', tracedFromComputation(
    form.ilNetIncome,
    'il1040.ilNetIncome',
    ['il1040.ilBaseIncome', 'il1040.exemptionAllowance'],
    'Illinois net income (base income minus exemption allowance)',
  ))

  // Taxable income
  values.set('il1040.ilTaxableIncome', tracedFromComputation(
    form.ilTaxableIncome,
    'il1040.ilTaxableIncome',
    ['il1040.ilNetIncome'],
    'Illinois taxable income',
  ))

  // Tax
  values.set('il1040.ilTax', tracedFromComputation(
    form.ilTax,
    'il1040.ilTax',
    ['il1040.ilTaxableIncome'],
    'Illinois income tax (4.95% flat rate)',
  ))

  // Credits
  const creditInputs: string[] = []
  if (form.ilEIC > 0) {
    values.set('il1040.ilEIC', tracedFromComputation(
      form.ilEIC,
      'il1040.ilEIC',
      [],
      'IL Earned Income Credit (20% of federal EITC)',
    ))
    creditInputs.push('il1040.ilEIC')
  }

  if (form.totalCredits > 0) {
    values.set('il1040.totalCredits', tracedFromComputation(
      form.totalCredits,
      'il1040.totalCredits',
      creditInputs,
      'IL total credits',
    ))
  }

  // Tax after credits
  const taxAfterInputs = ['il1040.ilTax']
  if (form.totalCredits > 0) taxAfterInputs.push('il1040.totalCredits')
  values.set('il1040.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'il1040.taxAfterCredits',
    taxAfterInputs,
    'IL tax after credits',
  ))

  // Withholding
  if (form.stateWithholding > 0) {
    values.set('il1040.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'il1040.stateWithholding',
      [],
      'IL state income tax withheld',
    ))
  }

  // Result
  const resultInputs = ['il1040.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('il1040.stateWithholding')

  if (form.overpaid > 0) {
    values.set('il1040.overpaid', tracedFromComputation(
      form.overpaid,
      'il1040.overpaid',
      resultInputs,
      'IL overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('il1040.amountOwed', tracedFromComputation(
      form.amountOwed,
      'il1040.amountOwed',
      resultInputs,
      'IL amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): IL1040Result {
  return result.detail as IL1040Result
}

const IL_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Illinois starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'IL-1040 Instructions',
          pubUrl: 'https://tax.illinois.gov/forms/incometax/individual/il-1040.html',
        },
      },
      {
        label: 'IL Additions',
        nodeId: 'il1040.ilAdditions',
        getValue: (r) => d(r).ilAdditions,
        showWhen: (r) => d(r).ilAdditions > 0,
        tooltip: {
          explanation: 'Illinois additions include federally tax-exempt interest income (municipal bonds from other states).',
          pubName: 'IL Schedule M',
          pubUrl: 'https://tax.illinois.gov/forms/incometax/individual/il-1040.html',
        },
      },
      {
        label: 'IL Subtractions',
        nodeId: 'il1040.ilSubtractions',
        getValue: (r) => d(r).ilSubtractions,
        showWhen: (r) => d(r).ilSubtractions > 0,
        tooltip: {
          explanation: 'Illinois subtractions include US government interest, Social Security benefits, and IL tax refunds included in federal AGI.',
          pubName: 'IL Schedule M',
          pubUrl: 'https://tax.illinois.gov/forms/incometax/individual/il-1040.html',
        },
      },
      {
        label: 'IL Base Income',
        nodeId: 'il1040.ilBaseIncome',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Illinois base income: Federal AGI + IL additions - IL subtractions.',
          pubName: 'IL-1040 Line 9',
          pubUrl: 'https://tax.illinois.gov/forms/incometax/individual/il-1040.html',
        },
      },
    ],
  },
  {
    title: 'Exemptions',
    items: [
      {
        label: 'Exemption Allowance',
        nodeId: 'il1040.exemptionAllowance',
        getValue: (r) => d(r).exemptionAllowance,
        tooltip: {
          explanation: 'Illinois allows a $2,625 exemption per person (taxpayer, spouse if MFJ, and each dependent).',
          pubName: 'IL-1040 Line 11',
          pubUrl: 'https://tax.illinois.gov/forms/incometax/individual/il-1040.html',
        },
      },
      {
        label: 'IL Net Income',
        nodeId: 'il1040.ilNetIncome',
        getValue: (r) => d(r).ilNetIncome,
        tooltip: {
          explanation: 'Illinois net income equals base income minus the personal exemption allowance.',
          pubName: 'IL-1040 Line 12',
          pubUrl: 'https://tax.illinois.gov/forms/incometax/individual/il-1040.html',
        },
      },
      {
        label: 'IL Taxable Income',
        nodeId: 'il1040.ilTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Illinois taxable income. For part-year residents and nonresidents, this is the apportioned amount.',
          pubName: 'IL-1040 Instructions',
          pubUrl: 'https://tax.illinois.gov/forms/incometax/individual/il-1040.html',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'IL Tax (4.95%)',
        nodeId: 'il1040.ilTax',
        getValue: (r) => d(r).ilTax,
        tooltip: {
          explanation: 'Illinois applies a flat 4.95% tax rate to taxable income.',
          pubName: 'IL-1040 Line 14',
          pubUrl: 'https://tax.illinois.gov/forms/incometax/individual/il-1040.html',
        },
      },
      {
        label: 'IL Earned Income Credit',
        nodeId: 'il1040.ilEIC',
        getValue: (r) => d(r).ilEIC,
        showWhen: (r) => d(r).ilEIC > 0,
        tooltip: {
          explanation: 'Illinois Earned Income Credit equals 20% of your federal Earned Income Tax Credit.',
          pubName: 'IL-1040 Schedule IL-E/EIC',
          pubUrl: 'https://tax.illinois.gov/forms/incometax/individual/il-1040.html',
        },
      },
      {
        label: 'IL Tax After Credits',
        nodeId: 'il1040.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Illinois income tax after all credits (EIC, property tax, child tax).',
          pubName: 'IL-1040 Instructions',
          pubUrl: 'https://tax.illinois.gov/forms/incometax/individual/il-1040.html',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'IL State Withholding',
        nodeId: 'il1040.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Illinois tax withheld from W-2 Box 17 entries for IL.',
          pubName: 'IL-1040 Instructions',
          pubUrl: 'https://tax.illinois.gov/forms/incometax/individual/il-1040.html',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const IL_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'IL Refund',
    nodeId: 'il1040.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'IL Amount You Owe',
    nodeId: 'il1040.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'IL tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const ilModule: StateRulesModule = {
  stateCode: 'IL',
  stateName: 'Illinois',
  formLabel: 'IL Form IL-1040',
  sidebarLabel: 'IL Form IL-1040',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeIL1040(model, federal, config))
  },
  nodeLabels: IL_NODE_LABELS,
  collectTracedValues: collectILTracedValues,
  reviewLayout: IL_REVIEW_LAYOUT,
  reviewResultLines: IL_REVIEW_RESULT_LINES,
}
