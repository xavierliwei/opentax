import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm500 } from './form500'
import type { Form500Result } from './form500'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form500: Form500Result): StateComputeResult {
  const isPartYear = form500.residencyType === 'part-year'
  return {
    stateCode: 'GA',
    formLabel: isPartYear ? 'GA Form 500 (Part-Year)' : 'GA Form 500',
    residencyType: form500.residencyType,
    stateAGI: form500.gaAGI,
    stateTaxableIncome: form500.gaTaxableIncome,
    stateTax: form500.gaTax,
    stateCredits: form500.totalCredits,
    taxAfterCredits: form500.taxAfterCredits,
    stateWithholding: form500.stateWithholding,
    overpaid: form500.overpaid,
    amountOwed: form500.amountOwed,
    apportionmentRatio: form500.apportionmentRatio,
    detail: form500,
  }
}

const GA_NODE_LABELS: Record<string, string> = {
  'form500.gaAGI': 'Georgia adjusted gross income',
  'form500.gaSourceIncome': 'GA-source income (apportioned)',
  'form500.apportionmentRatio': 'GA residency apportionment ratio',
  'form500.gaDeduction': 'Georgia deduction',
  'form500.dependentExemption': 'Georgia dependent exemption',
  'form500.gaTaxableIncome': 'Georgia taxable income',
  'form500.gaTax': 'Georgia tax (5.19%)',
  'form500.lowIncomeCredit': 'GA low-income credit',
  'form500.taxAfterCredits': 'GA tax after credits',
  'form500.stateWithholding': 'GA state income tax withheld',
  'form500.overpaid': 'GA overpaid (refund)',
  'form500.amountOwed': 'GA amount you owe',
  'scheduleGA.additions': 'GA income additions (Schedule 1)',
  'scheduleGA.subtractions': 'GA income subtractions (Schedule 1)',
  'scheduleGA.socialSecuritySubtraction': 'Social Security exclusion (GA)',
  'scheduleGA.stateIncomeTaxAddBack': 'State income tax add-back (GA)',
}

function collectGATracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form500 = result.detail as Form500Result
  const values = new Map<string, TracedValue>()

  if (form500.gaAdjustments.stateIncomeTaxAddBack > 0) {
    values.set('scheduleGA.stateIncomeTaxAddBack', tracedFromComputation(
      form500.gaAdjustments.stateIncomeTaxAddBack,
      'scheduleGA.stateIncomeTaxAddBack',
      ['itemized.stateLocalIncomeTaxes'],
      'State income tax add-back (GA)',
    ))
  }

  if (form500.gaAdjustments.socialSecuritySubtraction > 0) {
    values.set('scheduleGA.socialSecuritySubtraction', tracedFromComputation(
      form500.gaAdjustments.socialSecuritySubtraction,
      'scheduleGA.socialSecuritySubtraction',
      ['form1040.line6b'],
      'Social Security exclusion (GA)',
    ))
  }

  if (form500.gaAdjustments.additions > 0) {
    values.set('scheduleGA.additions', tracedFromComputation(
      form500.gaAdjustments.additions,
      'scheduleGA.additions',
      form500.gaAdjustments.stateIncomeTaxAddBack > 0 ? ['scheduleGA.stateIncomeTaxAddBack'] : [],
      'GA income additions (Schedule 1)',
    ))
  }

  if (form500.gaAdjustments.subtractions > 0) {
    values.set('scheduleGA.subtractions', tracedFromComputation(
      form500.gaAdjustments.subtractions,
      'scheduleGA.subtractions',
      form500.gaAdjustments.socialSecuritySubtraction > 0 ? ['scheduleGA.socialSecuritySubtraction'] : [],
      'GA income subtractions (Schedule 1)',
    ))
  }

  const gaAgiInputs = ['form1040.line11']
  if (form500.gaAdjustments.additions > 0) gaAgiInputs.push('scheduleGA.additions')
  if (form500.gaAdjustments.subtractions > 0) gaAgiInputs.push('scheduleGA.subtractions')
  values.set('form500.gaAGI', tracedFromComputation(
    form500.gaAGI,
    'form500.gaAGI',
    gaAgiInputs,
    'Georgia adjusted gross income',
  ))

  values.set('form500.gaDeduction', tracedFromComputation(
    form500.deductionUsed,
    'form500.gaDeduction',
    [],
    `GA ${form500.deductionMethod} deduction`,
  ))

  if (form500.dependentExemption > 0) {
    values.set('form500.dependentExemption', tracedFromComputation(
      form500.dependentExemption,
      'form500.dependentExemption',
      [],
      'Georgia dependent exemption',
    ))
  }

  const taxableInputs = ['form500.gaAGI', 'form500.gaDeduction']
  if (form500.dependentExemption > 0) taxableInputs.push('form500.dependentExemption')
  values.set('form500.gaTaxableIncome', tracedFromComputation(
    form500.gaTaxableIncome,
    'form500.gaTaxableIncome',
    taxableInputs,
    'Georgia taxable income',
  ))

  values.set('form500.gaTax', tracedFromComputation(
    form500.gaTax,
    'form500.gaTax',
    ['form500.gaTaxableIncome'],
    'Georgia tax (5.19%)',
  ))

  if (form500.lowIncomeCredit > 0) {
    values.set('form500.lowIncomeCredit', tracedFromComputation(
      form500.lowIncomeCredit,
      'form500.lowIncomeCredit',
      ['form1040.line11'],
      'GA low-income credit',
    ))
  }

  const taxAfterInputs = ['form500.gaTax']
  if (form500.lowIncomeCredit > 0) taxAfterInputs.push('form500.lowIncomeCredit')
  values.set('form500.taxAfterCredits', tracedFromComputation(
    form500.taxAfterCredits,
    'form500.taxAfterCredits',
    taxAfterInputs,
    'GA tax after credits',
  ))

  if (form500.stateWithholding > 0) {
    values.set('form500.stateWithholding', tracedFromComputation(
      form500.stateWithholding,
      'form500.stateWithholding',
      [],
      'GA state income tax withheld',
    ))
  }

  const resultInputs = ['form500.taxAfterCredits']
  if (form500.stateWithholding > 0) resultInputs.push('form500.stateWithholding')

  if (form500.overpaid > 0) {
    values.set('form500.overpaid', tracedFromComputation(
      form500.overpaid,
      'form500.overpaid',
      resultInputs,
      'GA overpaid (refund)',
    ))
  }

  if (form500.amountOwed > 0) {
    values.set('form500.amountOwed', tracedFromComputation(
      form500.amountOwed,
      'form500.amountOwed',
      resultInputs,
      'GA amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form500Result {
  return result.detail as Form500Result
}

const GA_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for Georgia income tax.',
          pubName: 'GA IT-511 Instructions',
          pubUrl: 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet',
        },
      },
      {
        label: 'Schedule 1 Additions',
        nodeId: 'scheduleGA.additions',
        getValue: (r) => d(r).gaAdjustments.additions,
        tooltip: {
          explanation: 'Georgia additions to federal AGI, including state income tax add-back when itemizing federally.',
          pubName: 'GA Form 500 Schedule 1',
          pubUrl: 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet',
        },
        showWhen: (r) => d(r).gaAdjustments.additions > 0,
      },
      {
        label: 'Schedule 1 Subtractions',
        nodeId: 'scheduleGA.subtractions',
        getValue: (r) => d(r).gaAdjustments.subtractions,
        tooltip: {
          explanation: 'Georgia subtractions from federal AGI, including Social Security benefits excluded from GA tax.',
          pubName: 'GA Form 500 Schedule 1',
          pubUrl: 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet',
        },
        showWhen: (r) => d(r).gaAdjustments.subtractions > 0,
      },
      {
        label: 'GA AGI',
        nodeId: 'form500.gaAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Georgia adjusted gross income after Schedule 1 additions and subtractions.',
          pubName: 'GA Form 500 Line 9',
          pubUrl: 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'GA Deduction',
        nodeId: 'form500.gaDeduction',
        getValue: (r) => d(r).deductionUsed,
        tooltip: {
          explanation: 'Greater of Georgia standard deduction or Georgia-adjusted itemized deductions.',
          pubName: 'GA Form 500 Line 12',
          pubUrl: 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet',
        },
      },
      {
        label: 'Dependent Exemption',
        nodeId: 'form500.dependentExemption',
        getValue: (r) => d(r).dependentExemption,
        tooltip: {
          explanation: 'Georgia allows a $3,000 exemption for each dependent.',
          pubName: 'GA Form 500 Line 13',
          pubUrl: 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet',
        },
        showWhen: (r) => d(r).dependentExemption > 0,
      },
      {
        label: 'GA Taxable Income',
        nodeId: 'form500.gaTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Georgia taxable income equals GA AGI minus deductions and dependent exemptions.',
          pubName: 'GA Form 500 Line 15',
          pubUrl: 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'GA Tax (5.19%)',
        nodeId: 'form500.gaTax',
        getValue: (r) => d(r).gaTax,
        tooltip: {
          explanation: 'Georgia applies a flat 5.19% tax rate to taxable income.',
          pubName: 'GA Form 500 Line 16',
          pubUrl: 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet',
        },
      },
      {
        label: 'Low-Income Credit',
        nodeId: 'form500.lowIncomeCredit',
        getValue: (r) => d(r).lowIncomeCredit,
        tooltip: {
          explanation: 'Nonrefundable credit for filers with low federal AGI who are not claimed as dependents.',
          pubName: 'GA IT-511 Low Income Credit',
          pubUrl: 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet',
        },
        showWhen: (r) => d(r).lowIncomeCredit > 0,
      },
      {
        label: 'GA Tax After Credits',
        nodeId: 'form500.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Georgia tax after nonrefundable credits, compared against withholding to determine refund or balance due.',
          pubName: 'GA Form 500 Line 21',
          pubUrl: 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'GA State Withholding',
        nodeId: 'form500.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Georgia tax withheld from your W-2 forms (Box 17 when Box 15 is GA).',
          pubName: 'GA Form 500 Line 24',
          pubUrl: 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const GA_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'GA Refund',
    nodeId: 'form500.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'GA Amount You Owe',
    nodeId: 'form500.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'GA tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const gaModule: StateRulesModule = {
  stateCode: 'GA',
  stateName: 'Georgia',
  formLabel: 'GA Form 500',
  sidebarLabel: 'GA Form 500',

  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    const form500 = computeForm500(model, federal, config)
    return toStateResult(form500)
  },

  nodeLabels: GA_NODE_LABELS,
  collectTracedValues: collectGATracedValues,
  reviewLayout: GA_REVIEW_LAYOUT,
  reviewResultLines: GA_REVIEW_RESULT_LINES,
}
