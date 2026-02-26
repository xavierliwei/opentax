/** SC state module — South Carolina SC1040 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeSC1040, type SC1040Result } from './sc1040'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: SC1040Result): StateComputeResult {
  return {
    stateCode: 'SC',
    formLabel: 'SC Form SC1040',
    residencyType: form.residencyType,
    stateAGI: form.scAGI,
    stateTaxableIncome: form.scTaxableIncome,
    stateTax: form.scTax,
    stateCredits: form.totalNonrefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const SC_NODE_LABELS: Record<string, string> = {
  'sc1040.federalTaxableIncome': 'Federal taxable income (1040 Line 15)',
  'sc1040.scAdditions': 'SC additions to income',
  'sc1040.scSubtractions': 'SC subtractions from income',
  'sc1040.scAGI': 'South Carolina adjusted gross income',
  'sc1040.exemptionAmount': 'SC personal exemption allowance',
  'sc1040.scTaxableIncome': 'South Carolina taxable income',
  'sc1040.scTax': 'South Carolina income tax (3.99%)',
  'sc1040.scEITC': 'SC Earned Income Tax Credit (41.67% of federal)',
  'sc1040.twoWageEarnerCredit': 'SC two-wage earner credit',
  'sc1040.totalNonrefundableCredits': 'SC total nonrefundable credits',
  'sc1040.taxAfterCredits': 'SC tax after credits',
  'sc1040.stateWithholding': 'SC state income tax withheld',
  'sc1040.overpaid': 'SC overpaid (refund)',
  'sc1040.amountOwed': 'SC amount you owe',
}

function collectSCTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as SC1040Result
  const values = new Map<string, TracedValue>()

  // Federal taxable income — SC starts here, not AGI
  values.set('sc1040.federalTaxableIncome', tracedFromComputation(
    form.federalTaxableIncome,
    'sc1040.federalTaxableIncome',
    ['form1040.line15'],
    'Federal taxable income (Form 1040 Line 15) — SC starting point',
  ))

  const agiInputs = ['sc1040.federalTaxableIncome']

  // Additions
  if (form.scAdditions > 0) {
    agiInputs.push('sc1040.scAdditions')
    values.set('sc1040.scAdditions', tracedFromComputation(
      form.scAdditions, 'sc1040.scAdditions', [],
      'SC additions to income',
    ))
  }

  // Subtractions
  if (form.scSubtractions > 0) {
    agiInputs.push('sc1040.scSubtractions')
    values.set('sc1040.scSubtractions', tracedFromComputation(
      form.scSubtractions, 'sc1040.scSubtractions', [],
      'SC subtractions (SS exemption, retirement deduction, US gov interest, state refund)',
    ))
  }

  // SC AGI
  values.set('sc1040.scAGI', tracedFromComputation(
    form.scAGI,
    'sc1040.scAGI',
    agiInputs,
    'South Carolina adjusted gross income (federal taxable income + additions - subtractions)',
  ))

  // Exemption allowance
  values.set('sc1040.exemptionAmount', tracedFromComputation(
    form.exemptionAmount,
    'sc1040.exemptionAmount',
    [],
    `SC personal exemption allowance ($4,700 x ${form.exemptionCount} persons)`,
  ))

  // SC taxable income
  values.set('sc1040.scTaxableIncome', tracedFromComputation(
    form.scTaxableIncome,
    'sc1040.scTaxableIncome',
    ['sc1040.scAGI', 'sc1040.exemptionAmount'],
    'South Carolina taxable income (SC AGI minus personal exemptions)',
  ))

  // SC tax
  values.set('sc1040.scTax', tracedFromComputation(
    form.scTax,
    'sc1040.scTax',
    ['sc1040.scTaxableIncome'],
    'South Carolina income tax (3.99% flat rate)',
  ))

  // Credits
  const creditInputs: string[] = []
  if (form.scEITC > 0) {
    values.set('sc1040.scEITC', tracedFromComputation(
      form.scEITC,
      'sc1040.scEITC',
      [],
      'SC Earned Income Tax Credit (41.67% of federal EITC)',
    ))
    creditInputs.push('sc1040.scEITC')
  }

  if (form.twoWageEarnerCredit > 0) {
    values.set('sc1040.twoWageEarnerCredit', tracedFromComputation(
      form.twoWageEarnerCredit,
      'sc1040.twoWageEarnerCredit',
      [],
      'SC two-wage earner credit (MFJ only, max $350)',
    ))
    creditInputs.push('sc1040.twoWageEarnerCredit')
  }

  if (form.totalNonrefundableCredits > 0) {
    values.set('sc1040.totalNonrefundableCredits', tracedFromComputation(
      form.totalNonrefundableCredits,
      'sc1040.totalNonrefundableCredits',
      creditInputs,
      'SC total nonrefundable credits',
    ))
  }

  // Tax after credits
  const taxAfterInputs = ['sc1040.scTax']
  if (form.totalNonrefundableCredits > 0) taxAfterInputs.push('sc1040.totalNonrefundableCredits')
  values.set('sc1040.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'sc1040.taxAfterCredits',
    taxAfterInputs,
    'SC tax after credits',
  ))

  // Withholding
  if (form.stateWithholding > 0) {
    values.set('sc1040.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'sc1040.stateWithholding',
      [],
      'SC state income tax withheld',
    ))
  }

  // Result
  const resultInputs = ['sc1040.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('sc1040.stateWithholding')

  if (form.overpaid > 0) {
    values.set('sc1040.overpaid', tracedFromComputation(
      form.overpaid,
      'sc1040.overpaid',
      resultInputs,
      'SC overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('sc1040.amountOwed', tracedFromComputation(
      form.amountOwed,
      'sc1040.amountOwed',
      resultInputs,
      'SC amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): SC1040Result {
  return result.detail as SC1040Result
}

const SC_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal Taxable Income',
        nodeId: 'sc1040.federalTaxableIncome',
        getValue: (r) => d(r).federalTaxableIncome,
        tooltip: {
          explanation: 'South Carolina starts from federal taxable income (Form 1040 Line 15), which already includes the standard or itemized deduction.',
          pubName: 'SC1040 Instructions',
          pubUrl: 'https://dor.sc.gov/tax/individual-income-tax',
        },
      },
      {
        label: 'SC Additions',
        nodeId: 'sc1040.scAdditions',
        getValue: (r) => d(r).scAdditions,
        showWhen: (r) => d(r).scAdditions > 0,
        tooltip: {
          explanation: 'South Carolina additions to federal taxable income.',
          pubName: 'SC1040 Instructions',
          pubUrl: 'https://dor.sc.gov/tax/individual-income-tax',
        },
      },
      {
        label: 'SC Subtractions',
        nodeId: 'sc1040.scSubtractions',
        getValue: (r) => d(r).scSubtractions,
        showWhen: (r) => d(r).scSubtractions > 0,
        tooltip: {
          explanation: 'South Carolina subtractions include Social Security exemption (fully exempt), retirement income deduction ($10,000 under 65; full if 65+), US government interest, and state/local tax refunds.',
          pubName: 'SC1040 Instructions',
          pubUrl: 'https://dor.sc.gov/tax/individual-income-tax',
        },
      },
      {
        label: 'SC Adjusted Gross Income',
        nodeId: 'sc1040.scAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'South Carolina adjusted gross income: Federal taxable income + SC additions - SC subtractions.',
          pubName: 'SC1040 Instructions',
          pubUrl: 'https://dor.sc.gov/tax/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Exemptions',
    items: [
      {
        label: 'Personal Exemptions',
        nodeId: 'sc1040.exemptionAmount',
        getValue: (r) => d(r).exemptionAmount,
        tooltip: {
          explanation: 'South Carolina allows a $4,700 personal exemption per person (taxpayer, spouse if MFJ, and each dependent). SC kept personal exemptions even after the 2025 flat tax reform.',
          pubName: 'SC1040 Instructions',
          pubUrl: 'https://dor.sc.gov/tax/individual-income-tax',
        },
      },
      {
        label: 'SC Taxable Income',
        nodeId: 'sc1040.scTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'South Carolina taxable income equals SC AGI minus personal exemptions. For part-year residents and nonresidents, this is the apportioned amount.',
          pubName: 'SC1040 Instructions',
          pubUrl: 'https://dor.sc.gov/tax/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'SC Tax (3.99%)',
        nodeId: 'sc1040.scTax',
        getValue: (r) => d(r).scTax,
        tooltip: {
          explanation: 'South Carolina applies a flat 3.99% income tax rate (2025 reform, previously graduated 0-6.4%).',
          pubName: 'SC1040 Instructions',
          pubUrl: 'https://dor.sc.gov/tax/individual-income-tax',
        },
      },
      {
        label: 'SC Earned Income Credit',
        nodeId: 'sc1040.scEITC',
        getValue: (r) => d(r).scEITC,
        showWhen: (r) => d(r).scEITC > 0,
        tooltip: {
          explanation: 'SC Earned Income Tax Credit equals 41.67% of the federal EITC — one of the highest state EITC rates in the country.',
          pubName: 'SC1040 Instructions',
          pubUrl: 'https://dor.sc.gov/tax/individual-income-tax',
        },
      },
      {
        label: 'Two-Wage Earner Credit',
        nodeId: 'sc1040.twoWageEarnerCredit',
        getValue: (r) => d(r).twoWageEarnerCredit,
        showWhen: (r) => d(r).twoWageEarnerCredit > 0,
        tooltip: {
          explanation: 'SC two-wage earner credit for MFJ filers: lesser of $350 or the lower-earning spouse\'s qualified earned income.',
          pubName: 'SC1040 Instructions',
          pubUrl: 'https://dor.sc.gov/tax/individual-income-tax',
        },
      },
      {
        label: 'SC Tax After Credits',
        nodeId: 'sc1040.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'South Carolina tax after all nonrefundable credits applied.',
          pubName: 'SC1040 Instructions',
          pubUrl: 'https://dor.sc.gov/tax/individual-income-tax',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'SC State Withholding',
        nodeId: 'sc1040.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'South Carolina tax withheld from W-2 Box 17 entries for SC.',
          pubName: 'SC1040 Instructions',
          pubUrl: 'https://dor.sc.gov/tax/individual-income-tax',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const SC_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'SC Refund',
    nodeId: 'sc1040.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'SC Amount You Owe',
    nodeId: 'sc1040.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'SC tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const scModule: StateRulesModule = {
  stateCode: 'SC',
  stateName: 'South Carolina',
  formLabel: 'SC Form SC1040',
  sidebarLabel: 'SC Form SC1040',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeSC1040(model, federal, config))
  },
  nodeLabels: SC_NODE_LABELS,
  collectTracedValues: collectSCTracedValues,
  reviewLayout: SC_REVIEW_LAYOUT,
  reviewResultLines: SC_REVIEW_RESULT_LINES,
}
