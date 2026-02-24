import type { StateReturnConfig, TaxReturn } from '../../../model/types'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import type { Form1040Result } from '../form1040'
import type { StateComputeResult, StateReviewResultLine, StateReviewSection, StateRulesModule } from '../../stateEngine'
import { computeNJ1040, type NJ1040Result } from './form1040'

function d(result: StateComputeResult): NJ1040Result {
  return result.detail as NJ1040Result
}

function toStateResult(nj: NJ1040Result): StateComputeResult {
  return {
    stateCode: 'NJ',
    formLabel: 'NJ Form NJ-1040',
    residencyType: nj.residencyType,
    stateAGI: nj.njGrossIncome,
    stateTaxableIncome: nj.njTaxableIncome,
    stateTax: nj.njTax,
    stateCredits: 0,
    taxAfterCredits: nj.njTax,
    stateWithholding: nj.stateWithholding,
    overpaid: nj.overpaid,
    amountOwed: nj.amountOwed,
    apportionmentRatio: nj.apportionmentRatio,
    detail: nj,
  }
}

const NJ_NODE_LABELS: Record<string, string> = {
  'formNJ1040.grossIncome': 'New Jersey gross income',
  'formNJ1040.exemptions': 'NJ personal/dependent exemptions',
  'formNJ1040.taxableIncome': 'NJ taxable income',
  'formNJ1040.tax': 'NJ income tax',
  'formNJ1040.withholding': 'NJ state income tax withheld',
  'formNJ1040.overpaid': 'NJ overpaid (refund)',
  'formNJ1040.amountOwed': 'NJ amount you owe',
}

function collectNJTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const nj = d(result)
  const values = new Map<string, TracedValue>()

  values.set('formNJ1040.grossIncome', tracedFromComputation(nj.njGrossIncome, 'formNJ1040.grossIncome', ['form1040.line11'], 'New Jersey gross income'))
  values.set('formNJ1040.exemptions', tracedFromComputation(nj.exemptionAmount, 'formNJ1040.exemptions', [], 'NJ exemptions'))
  values.set('formNJ1040.taxableIncome', tracedFromComputation(nj.njTaxableIncome, 'formNJ1040.taxableIncome', ['formNJ1040.grossIncome', 'formNJ1040.exemptions'], 'NJ taxable income'))
  values.set('formNJ1040.tax', tracedFromComputation(nj.njTax, 'formNJ1040.tax', ['formNJ1040.taxableIncome'], 'NJ income tax'))

  if (nj.stateWithholding > 0) {
    values.set('formNJ1040.withholding', tracedFromComputation(nj.stateWithholding, 'formNJ1040.withholding', [], 'NJ withholding'))
  }

  const resultInputs = ['formNJ1040.tax']
  if (nj.stateWithholding > 0) resultInputs.push('formNJ1040.withholding')
  if (nj.overpaid > 0) values.set('formNJ1040.overpaid', tracedFromComputation(nj.overpaid, 'formNJ1040.overpaid', resultInputs, 'NJ overpaid'))
  if (nj.amountOwed > 0) values.set('formNJ1040.amountOwed', tracedFromComputation(nj.amountOwed, 'formNJ1040.amountOwed', resultInputs, 'NJ amount owed'))

  return values
}

const NJ_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      { label: 'Federal AGI', nodeId: 'form1040.line11', getValue: (r) => d(r).federalAGI, tooltip: { explanation: 'Federal AGI from Form 1040 line 11 is the starting point for NJ income.', pubName: 'NJ-1040 Instructions', pubUrl: 'https://www.nj.gov/treasury/taxation/' } },
      { label: 'NJ Gross Income', nodeId: 'formNJ1040.grossIncome', getValue: (r) => d(r).njGrossIncome, tooltip: { explanation: 'For full-year residents, gross income starts from federal AGI. For part-year returns, it is apportioned by residency days.', pubName: 'NJ-1040 Instructions', pubUrl: 'https://www.nj.gov/treasury/taxation/' } },
    ],
  },
  {
    title: 'Deductions',
    items: [
      { label: 'NJ Exemptions', nodeId: 'formNJ1040.exemptions', getValue: (r) => d(r).exemptionAmount, tooltip: { explanation: 'NJ personal and dependent exemptions reduce taxable income.', pubName: 'NJ-1040 Instructions', pubUrl: 'https://www.nj.gov/treasury/taxation/' } },
      { label: 'NJ Taxable Income', nodeId: 'formNJ1040.taxableIncome', getValue: (r) => d(r).njTaxableIncome, tooltip: { explanation: 'NJ taxable income equals NJ gross income minus exemptions.', pubName: 'NJ-1040 Instructions', pubUrl: 'https://www.nj.gov/treasury/taxation/' } },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      { label: 'NJ Tax After Credits', nodeId: 'formNJ1040.tax', getValue: (r) => r.taxAfterCredits, tooltip: { explanation: 'Income tax computed from NJ progressive brackets.', pubName: 'NJ Tax Rate Table', pubUrl: 'https://www.nj.gov/treasury/taxation/' } },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      { label: 'NJ State Withholding', nodeId: 'formNJ1040.withholding', getValue: (r) => r.stateWithholding, tooltip: { explanation: 'NJ tax withheld from W-2 wages (Box 17 for NJ entries).', pubName: 'NJ-1040 Instructions', pubUrl: 'https://www.nj.gov/treasury/taxation/' }, showWhen: (r) => r.stateWithholding > 0 },
    ],
  },
]

const NJ_REVIEW_RESULTS: StateReviewResultLine[] = [
  { type: 'refund', label: 'NJ Refund', nodeId: 'formNJ1040.overpaid', getValue: (r) => r.overpaid, showWhen: (r) => r.overpaid > 0 },
  { type: 'owed', label: 'NJ Amount Owed', nodeId: 'formNJ1040.amountOwed', getValue: (r) => r.amountOwed, showWhen: (r) => r.amountOwed > 0 },
  { type: 'zero', label: 'NJ Balance Due', nodeId: 'formNJ1040.amountOwed', getValue: () => 0, showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0 },
]

export const njModule: StateRulesModule = {
  stateCode: 'NJ',
  stateName: 'New Jersey',
  formLabel: 'NJ Form NJ-1040',
  sidebarLabel: 'NJ Form NJ-1040',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeNJ1040(model, federal, config))
  },
  nodeLabels: NJ_NODE_LABELS,
  collectTracedValues: collectNJTracedValues,
  reviewLayout: NJ_REVIEW_LAYOUT,
  reviewResultLines: NJ_REVIEW_RESULTS,
}
