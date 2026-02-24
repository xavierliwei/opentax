import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormD40, type FormD40Result } from './formd40'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(d40: FormD40Result): StateComputeResult {
  return {
    stateCode: 'DC',
    formLabel: 'DC Form D-40',
    residencyType: d40.residencyType,
    stateAGI: d40.dcAGI,
    stateTaxableIncome: d40.dcTaxableIncome,
    stateTax: d40.dcTax,
    stateCredits: 0,
    taxAfterCredits: d40.taxAfterCredits,
    stateWithholding: d40.stateWithholding,
    overpaid: d40.overpaid,
    amountOwed: d40.amountOwed,
    apportionmentRatio: d40.apportionmentRatio,
    detail: d40,
  }
}

const DC_NODE_LABELS: Record<string, string> = {
  'formd40.dcAGI': 'DC adjusted gross income',
  'formd40.dcDeduction': 'DC deduction',
  'formd40.dcTaxableIncome': 'DC taxable income',
  'formd40.dcTax': 'DC income tax',
  'formd40.taxAfterCredits': 'DC tax after credits',
  'formd40.stateWithholding': 'DC withholding',
  'formd40.overpaid': 'DC refund',
  'formd40.amountOwed': 'DC amount owed',
  'formd40.commuterExempt': 'DC MD/VA commuter exemption',
}

function collectDCTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const d40 = result.detail as FormD40Result
  const values = new Map<string, TracedValue>()

  values.set('formd40.dcAGI', tracedFromComputation(d40.dcAGI, 'formd40.dcAGI', ['form1040.line11'], 'DC adjusted gross income'))
  values.set('formd40.dcDeduction', tracedFromComputation(d40.deductionUsed, 'formd40.dcDeduction', [], `DC ${d40.deductionMethod} deduction`))
  values.set('formd40.dcTaxableIncome', tracedFromComputation(d40.dcTaxableIncome, 'formd40.dcTaxableIncome', ['formd40.dcAGI', 'formd40.dcDeduction'], 'DC taxable income'))
  values.set('formd40.dcTax', tracedFromComputation(d40.dcTax, 'formd40.dcTax', ['formd40.dcTaxableIncome'], 'DC income tax'))
  values.set('formd40.taxAfterCredits', tracedFromComputation(d40.taxAfterCredits, 'formd40.taxAfterCredits', ['formd40.dcTax'], 'DC tax after credits'))
  if (d40.stateWithholding > 0) {
    values.set('formd40.stateWithholding', tracedFromComputation(d40.stateWithholding, 'formd40.stateWithholding', [], 'DC withholding'))
  }
  if (d40.overpaid > 0) {
    values.set('formd40.overpaid', tracedFromComputation(d40.overpaid, 'formd40.overpaid', ['formd40.taxAfterCredits', 'formd40.stateWithholding'], 'DC refund'))
  }
  if (d40.amountOwed > 0) {
    values.set('formd40.amountOwed', tracedFromComputation(d40.amountOwed, 'formd40.amountOwed', ['formd40.taxAfterCredits', 'formd40.stateWithholding'], 'DC amount owed'))
  }
  return values
}

function d(result: StateComputeResult): FormD40Result { return result.detail as FormD40Result }

const DC_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      { label: 'Federal AGI', nodeId: 'form1040.line11', getValue: (r) => d(r).federalAGI, tooltip: { explanation: 'Starting point for DC return.', pubName: 'DC D-40 Instructions', pubUrl: 'https://otr.cfo.dc.gov/page/individual-income-tax-forms-and-instructions' } },
      { label: 'DC AGI', nodeId: 'formd40.dcAGI', getValue: (r) => r.stateAGI, tooltip: { explanation: 'DC AGI after residency apportionment for part-year returns.', pubName: 'DC D-40 Instructions', pubUrl: 'https://otr.cfo.dc.gov/page/individual-income-tax-forms-and-instructions' } },
    ],
  },
  {
    title: 'Deductions & Tax',
    items: [
      { label: 'DC Deduction', nodeId: 'formd40.dcDeduction', getValue: (r) => d(r).deductionUsed, tooltip: { explanation: 'Larger of DC standard deduction or itemized amount used in this simplified flow.', pubName: 'DC D-40 Instructions', pubUrl: 'https://otr.cfo.dc.gov/page/individual-income-tax-forms-and-instructions' } },
      { label: 'DC Taxable Income', nodeId: 'formd40.dcTaxableIncome', getValue: (r) => r.stateTaxableIncome, tooltip: { explanation: 'DC AGI minus deduction.', pubName: 'DC D-40 Instructions', pubUrl: 'https://otr.cfo.dc.gov/page/individual-income-tax-forms-and-instructions' } },
      { label: 'DC Tax', nodeId: 'formd40.dcTax', getValue: (r) => d(r).dcTax, tooltip: { explanation: 'Tax from DC bracket schedule. MD/VA nonresident commuters are exempt.', pubName: 'DC Reciprocity Rule', pubUrl: 'https://otr.cfo.dc.gov/release/office-tax-and-revenue-issues-guidance-reciprocity-agreement-virginia-and-maryland' } },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      { label: 'DC Withholding', nodeId: 'formd40.stateWithholding', getValue: (r) => r.stateWithholding, tooltip: { explanation: 'Sum of DC withholding from W-2 box 17 with DC in box 15.', pubName: 'Form W-2', pubUrl: 'https://www.irs.gov/forms-pubs/about-form-w-2' }, showWhen: (r) => r.stateWithholding > 0 },
    ],
  },
]

const DC_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  { type: 'refund', label: 'DC Refund', nodeId: 'formd40.overpaid', getValue: (r) => r.overpaid, showWhen: (r) => r.overpaid > 0 },
  { type: 'owed', label: 'DC Amount You Owe', nodeId: 'formd40.amountOwed', getValue: (r) => r.amountOwed, showWhen: (r) => r.amountOwed > 0 },
  { type: 'zero', label: 'DC tax balance', nodeId: '', getValue: () => 0, showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0 },
]

export const dcModule: StateRulesModule = {
  stateCode: 'DC',
  stateName: 'District of Columbia',
  formLabel: 'DC Form D-40',
  sidebarLabel: 'DC Form D-40',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormD40(model, federal, config))
  },
  nodeLabels: DC_NODE_LABELS,
  collectTracedValues: collectDCTracedValues,
  reviewLayout: DC_REVIEW_LAYOUT,
  reviewResultLines: DC_REVIEW_RESULT_LINES,
}
