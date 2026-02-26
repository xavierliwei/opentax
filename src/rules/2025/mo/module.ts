import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeMO1040 } from './mo1040'
import type { MO1040Result } from './mo1040'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(mo1040: MO1040Result): StateComputeResult {
  const isPartYear = mo1040.residencyType === 'part-year'
  return {
    stateCode: 'MO',
    formLabel: isPartYear ? 'MO-1040 (Part-Year)' : 'MO-1040',
    residencyType: mo1040.residencyType,
    stateAGI: mo1040.moAGI,
    stateTaxableIncome: mo1040.moTaxableIncome,
    stateTax: mo1040.moTax,
    stateCredits: mo1040.totalCredits,
    taxAfterCredits: mo1040.taxAfterCredits,
    stateWithholding: mo1040.stateWithholding,
    overpaid: mo1040.overpaid,
    amountOwed: mo1040.amountOwed,
    apportionmentRatio: mo1040.apportionmentRatio,
    detail: mo1040,
  }
}

const MO_NODE_LABELS: Record<string, string> = {
  'mo1040.moAGI': 'Missouri adjusted gross income',
  'mo1040.moSourceIncome': 'MO-source income (apportioned)',
  'mo1040.apportionmentRatio': 'MO residency apportionment ratio',
  'mo1040.moStandardDeduction': 'Missouri standard deduction',
  'mo1040.federalTaxDeduction': 'Federal tax deduction (MO)',
  'mo1040.totalDeductions': 'Missouri total deductions',
  'mo1040.moTaxableIncome': 'Missouri taxable income',
  'mo1040.moTax': 'Missouri tax (graduated brackets)',
  'mo1040.taxAfterCredits': 'MO tax after credits',
  'mo1040.stateWithholding': 'MO state income tax withheld',
  'mo1040.overpaid': 'MO overpaid (refund)',
  'mo1040.amountOwed': 'MO amount you owe',
  'scheduleMO.additions': 'MO income additions',
  'scheduleMO.subtractions': 'MO income subtractions',
  'scheduleMO.socialSecuritySubtraction': 'Social Security exemption (MO)',
  'scheduleMO.stateIncomeTaxAddBack': 'State income tax add-back (MO)',
  'scheduleMO.usBondInterest': 'US bond interest subtraction (MO)',
}

function collectMOTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const mo1040 = result.detail as MO1040Result
  const values = new Map<string, TracedValue>()

  if (mo1040.moAdjustments.stateIncomeTaxAddBack > 0) {
    values.set('scheduleMO.stateIncomeTaxAddBack', tracedFromComputation(
      mo1040.moAdjustments.stateIncomeTaxAddBack,
      'scheduleMO.stateIncomeTaxAddBack',
      ['itemized.stateLocalIncomeTaxes'],
      'State income tax add-back (MO)',
    ))
  }

  if (mo1040.moAdjustments.socialSecuritySubtraction > 0) {
    values.set('scheduleMO.socialSecuritySubtraction', tracedFromComputation(
      mo1040.moAdjustments.socialSecuritySubtraction,
      'scheduleMO.socialSecuritySubtraction',
      ['form1040.line6b'],
      'Social Security exemption (MO)',
    ))
  }

  if (mo1040.moAdjustments.usBondInterestSubtraction > 0) {
    values.set('scheduleMO.usBondInterest', tracedFromComputation(
      mo1040.moAdjustments.usBondInterestSubtraction,
      'scheduleMO.usBondInterest',
      [],
      'US bond interest subtraction (MO)',
    ))
  }

  if (mo1040.moAdjustments.additions > 0) {
    values.set('scheduleMO.additions', tracedFromComputation(
      mo1040.moAdjustments.additions,
      'scheduleMO.additions',
      mo1040.moAdjustments.stateIncomeTaxAddBack > 0 ? ['scheduleMO.stateIncomeTaxAddBack'] : [],
      'MO income additions',
    ))
  }

  if (mo1040.moAdjustments.subtractions > 0) {
    const subInputs: string[] = []
    if (mo1040.moAdjustments.socialSecuritySubtraction > 0) subInputs.push('scheduleMO.socialSecuritySubtraction')
    if (mo1040.moAdjustments.usBondInterestSubtraction > 0) subInputs.push('scheduleMO.usBondInterest')
    values.set('scheduleMO.subtractions', tracedFromComputation(
      mo1040.moAdjustments.subtractions,
      'scheduleMO.subtractions',
      subInputs,
      'MO income subtractions',
    ))
  }

  const moAgiInputs = ['form1040.line11']
  if (mo1040.moAdjustments.additions > 0) moAgiInputs.push('scheduleMO.additions')
  if (mo1040.moAdjustments.subtractions > 0) moAgiInputs.push('scheduleMO.subtractions')
  values.set('mo1040.moAGI', tracedFromComputation(
    mo1040.moAGI,
    'mo1040.moAGI',
    moAgiInputs,
    'Missouri adjusted gross income',
  ))

  values.set('mo1040.moStandardDeduction', tracedFromComputation(
    mo1040.moStandardDeduction,
    'mo1040.moStandardDeduction',
    [],
    'Missouri standard deduction',
  ))

  values.set('mo1040.federalTaxDeduction', tracedFromComputation(
    mo1040.federalTaxDeduction,
    'mo1040.federalTaxDeduction',
    ['form1040.line24'],
    'Federal tax deduction (MO)',
  ))

  values.set('mo1040.totalDeductions', tracedFromComputation(
    mo1040.totalDeductions,
    'mo1040.totalDeductions',
    ['mo1040.moStandardDeduction', 'mo1040.federalTaxDeduction'],
    'Missouri total deductions',
  ))

  values.set('mo1040.moTaxableIncome', tracedFromComputation(
    mo1040.moTaxableIncome,
    'mo1040.moTaxableIncome',
    ['mo1040.moAGI', 'mo1040.totalDeductions'],
    'Missouri taxable income',
  ))

  values.set('mo1040.moTax', tracedFromComputation(
    mo1040.moTax,
    'mo1040.moTax',
    ['mo1040.moTaxableIncome'],
    'Missouri tax (graduated brackets)',
  ))

  values.set('mo1040.taxAfterCredits', tracedFromComputation(
    mo1040.taxAfterCredits,
    'mo1040.taxAfterCredits',
    ['mo1040.moTax'],
    'MO tax after credits',
  ))

  if (mo1040.stateWithholding > 0) {
    values.set('mo1040.stateWithholding', tracedFromComputation(
      mo1040.stateWithholding,
      'mo1040.stateWithholding',
      [],
      'MO state income tax withheld',
    ))
  }

  const resultInputs = ['mo1040.taxAfterCredits']
  if (mo1040.stateWithholding > 0) resultInputs.push('mo1040.stateWithholding')

  if (mo1040.overpaid > 0) {
    values.set('mo1040.overpaid', tracedFromComputation(
      mo1040.overpaid,
      'mo1040.overpaid',
      resultInputs,
      'MO overpaid (refund)',
    ))
  }

  if (mo1040.amountOwed > 0) {
    values.set('mo1040.amountOwed', tracedFromComputation(
      mo1040.amountOwed,
      'mo1040.amountOwed',
      resultInputs,
      'MO amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): MO1040Result {
  return result.detail as MO1040Result
}

const MO_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11, used as the starting point for Missouri income tax.',
          pubName: 'MO-1040 Instructions',
          pubUrl: 'https://dor.mo.gov/forms/',
        },
      },
      {
        label: 'MO Additions',
        nodeId: 'scheduleMO.additions',
        getValue: (r) => d(r).moAdjustments.additions,
        tooltip: {
          explanation: 'Missouri additions to federal AGI, including state income tax add-back when itemizing federally.',
          pubName: 'MO-1040 Instructions',
          pubUrl: 'https://dor.mo.gov/forms/',
        },
        showWhen: (r) => d(r).moAdjustments.additions > 0,
      },
      {
        label: 'MO Subtractions',
        nodeId: 'scheduleMO.subtractions',
        getValue: (r) => d(r).moAdjustments.subtractions,
        tooltip: {
          explanation: 'Missouri subtractions from federal AGI, including Social Security exemption (for AGI under $100K) and US government bond interest.',
          pubName: 'MO-1040 Instructions',
          pubUrl: 'https://dor.mo.gov/forms/',
        },
        showWhen: (r) => d(r).moAdjustments.subtractions > 0,
      },
      {
        label: 'MO AGI',
        nodeId: 'mo1040.moAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Missouri adjusted gross income after additions and subtractions.',
          pubName: 'MO-1040 Line 6',
          pubUrl: 'https://dor.mo.gov/forms/',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'MO Standard Deduction',
        nodeId: 'mo1040.moStandardDeduction',
        getValue: (r) => d(r).moStandardDeduction,
        tooltip: {
          explanation: 'Missouri uses the federal standard deduction amount.',
          pubName: 'MO-1040 Instructions',
          pubUrl: 'https://dor.mo.gov/forms/',
        },
      },
      {
        label: 'Federal Tax Deduction',
        nodeId: 'mo1040.federalTaxDeduction',
        getValue: (r) => d(r).federalTaxDeduction,
        tooltip: {
          explanation: 'Missouri allows a deduction for federal income tax paid, capped at $5,000 (single) or $10,000 (MFJ).',
          pubName: 'RSMo 143.171',
          pubUrl: 'https://dor.mo.gov/forms/',
        },
      },
      {
        label: 'MO Taxable Income',
        nodeId: 'mo1040.moTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Missouri taxable income equals MO AGI minus deductions.',
          pubName: 'MO-1040 Line 10',
          pubUrl: 'https://dor.mo.gov/forms/',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'MO Tax',
        nodeId: 'mo1040.moTax',
        getValue: (r) => d(r).moTax,
        tooltip: {
          explanation: 'Missouri tax computed using graduated brackets (2.0% to 4.8%).',
          pubName: 'MO-1040 Tax Table',
          pubUrl: 'https://dor.mo.gov/forms/',
        },
      },
      {
        label: 'MO Tax After Credits',
        nodeId: 'mo1040.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Missouri tax after nonrefundable credits.',
          pubName: 'MO-1040 Line 28',
          pubUrl: 'https://dor.mo.gov/forms/',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'MO State Withholding',
        nodeId: 'mo1040.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Missouri tax withheld from your W-2 forms (Box 17 when Box 15 is MO).',
          pubName: 'MO-1040 Line 32',
          pubUrl: 'https://dor.mo.gov/forms/',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const MO_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'MO Refund',
    nodeId: 'mo1040.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'MO Amount You Owe',
    nodeId: 'mo1040.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'MO tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const moModule: StateRulesModule = {
  stateCode: 'MO',
  stateName: 'Missouri',
  formLabel: 'MO-1040',
  sidebarLabel: 'MO-1040',

  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    const mo1040 = computeMO1040(model, federal, config)
    return toStateResult(mo1040)
  },

  nodeLabels: MO_NODE_LABELS,
  collectTracedValues: collectMOTracedValues,
  reviewLayout: MO_REVIEW_LAYOUT,
  reviewResultLines: MO_REVIEW_RESULT_LINES,
}
