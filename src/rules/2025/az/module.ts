/** AZ state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm140, type Form140Result } from './az140'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form140: Form140Result): StateComputeResult {
  return {
    stateCode: 'AZ',
    formLabel: 'AZ Form 140',
    residencyType: form140.residencyType,
    stateAGI: form140.azAGI,
    stateTaxableIncome: form140.azTaxableIncome,
    stateTax: form140.azTax,
    stateCredits: form140.totalCredits,
    taxAfterCredits: form140.taxAfterCredits,
    stateWithholding: form140.stateWithholding,
    overpaid: form140.overpaid,
    amountOwed: form140.amountOwed,
    apportionmentRatio: form140.apportionmentRatio,
    detail: form140,
  }
}

const AZ_NODE_LABELS: Record<string, string> = {
  'az140.additions': 'AZ additions to federal AGI',
  'az140.subtractions': 'AZ subtractions from federal AGI',
  'az140.azAGI': 'Arizona adjusted gross income',
  'az140.standardDeduction': 'Arizona standard deduction',
  'az140.dependentExemption': 'Arizona dependent exemption',
  'az140.azTaxableIncome': 'Arizona taxable income',
  'az140.azTax': 'Arizona income tax (2.5%)',
  'az140.familyTaxCredit': 'AZ Family Tax Credit',
  'az140.taxAfterCredits': 'AZ tax after credits',
  'az140.stateWithholding': 'AZ state income tax withheld',
  'az140.overpaid': 'AZ overpaid (refund)',
  'az140.amountOwed': 'AZ amount you owe',
}

function collectAZTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as Form140Result
  const values = new Map<string, TracedValue>()

  // ── Additions ─────────────────────────────────────────────────
  if (form.additions > 0) {
    values.set('az140.additions', tracedFromComputation(
      form.additions,
      'az140.additions',
      [],
      'AZ additions (non-AZ municipal interest, state tax add-back)',
    ))
  }

  // ── Subtractions ──────────────────────────────────────────────
  if (form.subtractions > 0) {
    values.set('az140.subtractions', tracedFromComputation(
      form.subtractions,
      'az140.subtractions',
      [],
      'AZ subtractions (US gov interest, state refund, Social Security)',
    ))
  }

  // ── Arizona AGI ───────────────────────────────────────────────
  const agiInputs = ['form1040.line11']
  if (form.additions > 0) agiInputs.push('az140.additions')
  if (form.subtractions > 0) agiInputs.push('az140.subtractions')
  values.set('az140.azAGI', tracedFromComputation(
    form.azAGI,
    'az140.azAGI',
    agiInputs,
    'Arizona adjusted gross income',
  ))

  // ── Standard Deduction ────────────────────────────────────────
  values.set('az140.standardDeduction', tracedFromComputation(
    form.standardDeduction,
    'az140.standardDeduction',
    [],
    'Arizona standard deduction',
  ))

  // ── Dependent Exemption ───────────────────────────────────────
  if (form.dependentExemption > 0) {
    values.set('az140.dependentExemption', tracedFromComputation(
      form.dependentExemption,
      'az140.dependentExemption',
      [],
      'Arizona dependent exemption ($100 per dependent)',
    ))
  }

  // ── Taxable Income ────────────────────────────────────────────
  const taxableInputs = ['az140.azAGI', 'az140.standardDeduction']
  if (form.dependentExemption > 0) taxableInputs.push('az140.dependentExemption')
  values.set('az140.azTaxableIncome', tracedFromComputation(
    form.azTaxableIncome,
    'az140.azTaxableIncome',
    taxableInputs,
    'Arizona taxable income',
  ))

  // ── Tax ───────────────────────────────────────────────────────
  values.set('az140.azTax', tracedFromComputation(
    form.azTax,
    'az140.azTax',
    ['az140.azTaxableIncome'],
    'Arizona income tax (2.5%)',
  ))

  // ── Family Tax Credit ─────────────────────────────────────────
  if (form.familyTaxCredit > 0) {
    values.set('az140.familyTaxCredit', tracedFromComputation(
      form.familyTaxCredit,
      'az140.familyTaxCredit',
      ['form1040.line11'],
      'AZ Family Tax Credit',
    ))
  }

  // ── Tax After Credits ─────────────────────────────────────────
  const taxAfterInputs = ['az140.azTax']
  if (form.familyTaxCredit > 0) taxAfterInputs.push('az140.familyTaxCredit')
  values.set('az140.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'az140.taxAfterCredits',
    taxAfterInputs,
    'AZ tax after credits',
  ))

  // ── Withholding ───────────────────────────────────────────────
  if (form.stateWithholding > 0) {
    values.set('az140.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'az140.stateWithholding',
      [],
      'AZ state income tax withheld',
    ))
  }

  // ── Result ────────────────────────────────────────────────────
  const resultInputs = ['az140.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('az140.stateWithholding')

  if (form.overpaid > 0) {
    values.set('az140.overpaid', tracedFromComputation(
      form.overpaid,
      'az140.overpaid',
      resultInputs,
      'AZ overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('az140.amountOwed', tracedFromComputation(
      form.amountOwed,
      'az140.amountOwed',
      resultInputs,
      'AZ amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form140Result {
  return result.detail as Form140Result
}

const AZ_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Arizona starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'AZ Form 140 Instructions',
          pubUrl: 'https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet',
        },
      },
      {
        label: 'AZ Additions',
        nodeId: 'az140.additions',
        getValue: (r) => d(r).additions,
        showWhen: (r) => d(r).additions > 0,
        tooltip: {
          explanation: 'Arizona additions include non-AZ municipal bond interest and previously deducted state income taxes.',
          pubName: 'AZ Form 140 Instructions',
          pubUrl: 'https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet',
        },
      },
      {
        label: 'AZ Subtractions',
        nodeId: 'az140.subtractions',
        getValue: (r) => d(r).subtractions,
        showWhen: (r) => d(r).subtractions > 0,
        tooltip: {
          explanation: 'Arizona subtractions include US government interest, AZ state tax refund, and Social Security benefits (fully exempt in AZ).',
          pubName: 'AZ Form 140 Instructions',
          pubUrl: 'https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet',
        },
      },
      {
        label: 'AZ AGI',
        nodeId: 'az140.azAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Arizona adjusted gross income: Federal AGI + AZ additions - AZ subtractions.',
          pubName: 'AZ Form 140 Instructions',
          pubUrl: 'https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'Standard Deduction',
        nodeId: 'az140.standardDeduction',
        getValue: (r) => d(r).standardDeduction,
        tooltip: {
          explanation: 'Arizona standard deduction matches federal amounts: $14,600 single/MFS, $29,200 MFJ/QSS, $21,900 HOH.',
          pubName: 'AZ Form 140 Instructions',
          pubUrl: 'https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet',
        },
      },
      {
        label: 'Dependent Exemption',
        nodeId: 'az140.dependentExemption',
        getValue: (r) => d(r).dependentExemption,
        showWhen: (r) => d(r).dependentExemption > 0,
        tooltip: {
          explanation: 'Arizona allows $100 per dependent exemption.',
          pubName: 'AZ Form 140 Instructions',
          pubUrl: 'https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet',
        },
      },
      {
        label: 'AZ Taxable Income',
        nodeId: 'az140.azTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Arizona taxable income equals AZ AGI minus standard deduction and dependent exemptions.',
          pubName: 'AZ Form 140 Instructions',
          pubUrl: 'https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'AZ Tax (2.5%)',
        nodeId: 'az140.azTax',
        getValue: (r) => d(r).azTax,
        tooltip: {
          explanation: 'Arizona applies a flat 2.5% tax rate to taxable income.',
          pubName: 'AZ Form 140 Instructions',
          pubUrl: 'https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet',
        },
      },
      {
        label: 'Family Tax Credit',
        nodeId: 'az140.familyTaxCredit',
        getValue: (r) => d(r).familyTaxCredit,
        showWhen: (r) => d(r).familyTaxCredit > 0,
        tooltip: {
          explanation: 'Arizona Family Tax Credit for filers with federal AGI under $50,000. $40 single/$60 MFJ.',
          pubName: 'AZ Form 140 Instructions',
          pubUrl: 'https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet',
        },
      },
      {
        label: 'AZ Tax After Credits',
        nodeId: 'az140.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Arizona tax after all nonrefundable credits, compared against withholding to determine refund or balance due.',
          pubName: 'AZ Form 140 Instructions',
          pubUrl: 'https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'AZ State Withholding',
        nodeId: 'az140.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Arizona tax withheld from your W-2 forms (Box 17 when Box 15 is AZ).',
          pubName: 'AZ Form 140 Instructions',
          pubUrl: 'https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const AZ_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'AZ Refund',
    nodeId: 'az140.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'AZ Amount You Owe',
    nodeId: 'az140.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'AZ tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const azModule: StateRulesModule = {
  stateCode: 'AZ',
  stateName: 'Arizona',
  formLabel: 'AZ Form 140',
  sidebarLabel: 'AZ Form 140',

  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    const form140 = computeForm140(model, federal, config)
    return toStateResult(form140)
  },

  nodeLabels: AZ_NODE_LABELS,
  collectTracedValues: collectAZTracedValues,
  reviewLayout: AZ_REVIEW_LAYOUT,
  reviewResultLines: AZ_REVIEW_RESULT_LINES,
}
