/** AL state module — Alabama Form 40 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm40, type Form40Result } from './form40'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: Form40Result): StateComputeResult {
  return {
    stateCode: 'AL',
    formLabel: 'AL Form 40',
    residencyType: form.residencyType,
    stateAGI: form.alAGI,
    stateTaxableIncome: form.alTaxableIncome,
    stateTax: form.alTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const AL_NODE_LABELS: Record<string, string> = {
  'form40.alAdditions': 'AL additions',
  'form40.alSubtractions': 'AL subtractions',
  'form40.federalTaxDeduction': 'Federal income tax deduction (AL)',
  'form40.alAGI': 'Alabama adjusted gross income',
  'form40.standardDeduction': 'AL standard deduction',
  'form40.personalExemption': 'AL personal exemption',
  'form40.dependentExemption': 'AL dependent exemption',
  'form40.alTaxableIncome': 'Alabama taxable income',
  'form40.alTax': 'Alabama income tax (2%/4%/5%)',
  'form40.taxAfterCredits': 'AL tax after credits',
  'form40.stateWithholding': 'AL state income tax withheld',
  'form40.overpaid': 'AL overpaid (refund)',
  'form40.amountOwed': 'AL amount you owe',
}

function collectALTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as Form40Result
  const values = new Map<string, TracedValue>()

  // Additions
  if (form.alAdditions > 0) {
    values.set('form40.alAdditions', tracedFromComputation(
      form.alAdditions, 'form40.alAdditions', [],
      'AL additions (non-AL municipal bond interest)',
    ))
  }

  // Subtractions
  if (form.alSubtractions > 0) {
    values.set('form40.alSubtractions', tracedFromComputation(
      form.alSubtractions, 'form40.alSubtractions', [],
      'AL subtractions (US gov interest, SS exemption, state refund)',
    ))
  }

  // Federal tax deduction
  if (form.federalTaxDeduction > 0) {
    values.set('form40.federalTaxDeduction', tracedFromComputation(
      form.federalTaxDeduction, 'form40.federalTaxDeduction', ['form1040.line24'],
      'Federal income tax deduction (AL allows deducting federal tax paid)',
    ))
  }

  // AL AGI
  const agiInputs = ['form1040.line11']
  if (form.alAdditions > 0) agiInputs.push('form40.alAdditions')
  if (form.alSubtractions > 0) agiInputs.push('form40.alSubtractions')
  if (form.federalTaxDeduction > 0) agiInputs.push('form40.federalTaxDeduction')
  values.set('form40.alAGI', tracedFromComputation(
    form.alAGI,
    'form40.alAGI',
    agiInputs,
    'Alabama adjusted gross income (federal AGI + additions - subtractions - federal tax deduction)',
  ))

  // Standard deduction
  values.set('form40.standardDeduction', tracedFromComputation(
    form.standardDeduction,
    'form40.standardDeduction',
    [],
    'Alabama standard deduction',
  ))

  // Personal exemption
  values.set('form40.personalExemption', tracedFromComputation(
    form.personalExemption,
    'form40.personalExemption',
    [],
    'Alabama personal exemption',
  ))

  // Dependent exemption
  if (form.dependentExemption > 0) {
    values.set('form40.dependentExemption', tracedFromComputation(
      form.dependentExemption,
      'form40.dependentExemption',
      [],
      'Alabama dependent exemption ($1,000 per dependent)',
    ))
  }

  // Taxable income
  const taxableInputs = ['form40.alAGI', 'form40.standardDeduction', 'form40.personalExemption']
  if (form.dependentExemption > 0) taxableInputs.push('form40.dependentExemption')
  values.set('form40.alTaxableIncome', tracedFromComputation(
    form.alTaxableIncome,
    'form40.alTaxableIncome',
    taxableInputs,
    'Alabama taxable income',
  ))

  // Tax
  values.set('form40.alTax', tracedFromComputation(
    form.alTax,
    'form40.alTax',
    ['form40.alTaxableIncome'],
    'Alabama income tax (graduated 2%/4%/5%)',
  ))

  // Tax after credits
  values.set('form40.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'form40.taxAfterCredits',
    ['form40.alTax'],
    'AL tax after credits',
  ))

  // Withholding
  if (form.stateWithholding > 0) {
    values.set('form40.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'form40.stateWithholding',
      [],
      'AL state income tax withheld',
    ))
  }

  // Result
  const resultInputs = ['form40.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('form40.stateWithholding')

  if (form.overpaid > 0) {
    values.set('form40.overpaid', tracedFromComputation(
      form.overpaid,
      'form40.overpaid',
      resultInputs,
      'AL overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('form40.amountOwed', tracedFromComputation(
      form.amountOwed,
      'form40.amountOwed',
      resultInputs,
      'AL amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form40Result {
  return result.detail as Form40Result
}

const AL_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for Alabama income tax.',
          pubName: 'AL Form 40 Instructions',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
      },
      {
        label: 'AL Additions',
        nodeId: 'form40.alAdditions',
        getValue: (r) => d(r).alAdditions,
        showWhen: (r) => d(r).alAdditions > 0,
        tooltip: {
          explanation: 'Alabama additions include non-Alabama municipal bond interest that is federally tax-exempt but taxable by Alabama.',
          pubName: 'AL Form 40 Instructions',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
      },
      {
        label: 'AL Subtractions',
        nodeId: 'form40.alSubtractions',
        getValue: (r) => d(r).alSubtractions,
        showWhen: (r) => d(r).alSubtractions > 0,
        tooltip: {
          explanation: 'Alabama subtractions include US government obligation interest, Social Security benefits (fully exempt), and state tax refunds included in federal AGI.',
          pubName: 'AL Form 40 Instructions',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
      },
      {
        label: 'Federal Tax Deduction',
        nodeId: 'form40.federalTaxDeduction',
        getValue: (r) => d(r).federalTaxDeduction,
        showWhen: (r) => d(r).federalTaxDeduction > 0,
        tooltip: {
          explanation: 'Alabama is one of only a few states that allows a deduction for federal income tax paid (Form 1040 Line 24). This significantly reduces your Alabama taxable income.',
          pubName: 'AL Form 40 Line 11',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
      },
      {
        label: 'AL AGI',
        nodeId: 'form40.alAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Alabama adjusted gross income: Federal AGI + additions - subtractions - federal tax deduction.',
          pubName: 'AL Form 40',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'AL Standard Deduction',
        nodeId: 'form40.standardDeduction',
        getValue: (r) => d(r).standardDeduction,
        tooltip: {
          explanation: 'Alabama standard deduction: $2,500 (Single), $7,500 (MFJ), $3,750 (MFS), $4,700 (HOH).',
          pubName: 'AL Form 40',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
      },
      {
        label: 'Personal Exemption',
        nodeId: 'form40.personalExemption',
        getValue: (r) => d(r).personalExemption,
        tooltip: {
          explanation: 'Alabama personal exemption: $1,500 (Single/MFS), $3,000 (MFJ/HOH/QW).',
          pubName: 'AL Form 40',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
      },
      {
        label: 'Dependent Exemption',
        nodeId: 'form40.dependentExemption',
        getValue: (r) => d(r).dependentExemption,
        showWhen: (r) => d(r).dependentExemption > 0,
        tooltip: {
          explanation: 'Alabama allows a $1,000 exemption for each qualifying dependent.',
          pubName: 'AL Form 40',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
      },
      {
        label: 'AL Taxable Income',
        nodeId: 'form40.alTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Alabama taxable income equals AL AGI minus standard deduction and personal/dependent exemptions.',
          pubName: 'AL Form 40',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'AL Tax (2%/4%/5%)',
        nodeId: 'form40.alTax',
        getValue: (r) => d(r).alTax,
        tooltip: {
          explanation: 'Alabama uses graduated tax rates: 2% on the first bracket, 4% on the middle bracket, and 5% on the remainder. Bracket widths vary by filing status.',
          pubName: 'AL Form 40 Tax Table',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
      },
      {
        label: 'AL Tax After Credits',
        nodeId: 'form40.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Alabama income tax after any applicable credits.',
          pubName: 'AL Form 40',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'AL State Withholding',
        nodeId: 'form40.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Alabama tax withheld from W-2 Box 17 entries for AL.',
          pubName: 'AL Form 40',
          pubUrl: 'https://revenue.alabama.gov/individual-corporate/taxes-individual-income-tax/forms/',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const AL_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'AL Refund',
    nodeId: 'form40.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'AL Amount You Owe',
    nodeId: 'form40.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'AL tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const alModule: StateRulesModule = {
  stateCode: 'AL',
  stateName: 'Alabama',
  formLabel: 'AL Form 40',
  sidebarLabel: 'AL Form 40',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm40(model, federal, config))
  },
  nodeLabels: AL_NODE_LABELS,
  collectTracedValues: collectALTracedValues,
  reviewLayout: AL_REVIEW_LAYOUT,
  reviewResultLines: AL_REVIEW_RESULT_LINES,
}
