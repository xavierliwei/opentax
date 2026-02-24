import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import type { StateComputeResult, StateReviewResultLine, StateReviewSection, StateRulesModule } from '../../stateEngine'
import { computeForm502, type Form502Result } from './form502'

function toStateResult(form502: Form502Result): StateComputeResult {
  const isNonresident = form502.residencyType === 'nonresident'
  return {
    stateCode: 'MD',
    formLabel: isNonresident ? 'MD Form 505' : 'MD Form 502',
    residencyType: form502.residencyType,
    stateAGI: form502.mdAGI,
    stateTaxableIncome: form502.mdTaxableIncome,
    stateTax: form502.mdStateTax + form502.mdLocalTax,
    stateCredits: 0,
    taxAfterCredits: form502.taxAfterCredits,
    stateWithholding: form502.stateWithholding,
    overpaid: form502.overpaid,
    amountOwed: form502.amountOwed,
    apportionmentRatio: form502.apportionmentRatio,
    detail: form502,
  }
}

const MD_NODE_LABELS: Record<string, string> = {
  'form502.mdAGI': 'Maryland adjusted gross income',
  'form502.mdSourceIncome': 'Maryland-source income (apportioned)',
  'form502.apportionmentRatio': 'Maryland residency apportionment ratio',
  'form502.mdDeduction': 'Maryland deduction',
  'form502.mdExemptions': 'Maryland personal/dependent exemptions',
  'form502.mdTaxableIncome': 'Maryland taxable income',
  'form502.mdStateTax': 'Maryland state income tax',
  'form502.mdLocalTax': 'Maryland local income tax',
  'form502.taxAfterCredits': 'Maryland total tax after credits',
  'form502.stateWithholding': 'Maryland state income tax withheld',
  'form502.overpaid': 'Maryland overpaid (refund)',
  'form502.amountOwed': 'Maryland amount you owe',
}

function collectMDTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const f = result.detail as Form502Result
  const values = new Map<string, TracedValue>()

  values.set('form502.mdAGI', tracedFromComputation(f.mdAGI, 'form502.mdAGI', ['form1040.line11'], 'Maryland adjusted gross income'))
  values.set('form502.mdDeduction', tracedFromComputation(f.deductionUsed, 'form502.mdDeduction', [], `MD ${f.deductionMethod} deduction`))
  values.set('form502.mdExemptions', tracedFromComputation(f.totalExemptions, 'form502.mdExemptions', [], 'MD exemptions after phase-out'))
  values.set('form502.mdTaxableIncome', tracedFromComputation(f.mdTaxableIncome, 'form502.mdTaxableIncome', ['form502.mdAGI', 'form502.mdDeduction', 'form502.mdExemptions'], 'Maryland taxable income'))
  values.set('form502.mdStateTax', tracedFromComputation(f.mdStateTax, 'form502.mdStateTax', ['form502.mdTaxableIncome'], 'Maryland state tax'))
  values.set('form502.mdLocalTax', tracedFromComputation(f.mdLocalTax, 'form502.mdLocalTax', ['form502.mdTaxableIncome'], 'Maryland local tax'))
  values.set('form502.taxAfterCredits', tracedFromComputation(f.taxAfterCredits, 'form502.taxAfterCredits', ['form502.mdStateTax', 'form502.mdLocalTax'], 'Maryland total tax after credits'))

  if (f.stateWithholding > 0) {
    values.set('form502.stateWithholding', tracedFromComputation(f.stateWithholding, 'form502.stateWithholding', [], 'Maryland state withholding'))
  }
  if (f.mdSourceIncome !== undefined) {
    values.set('form502.mdSourceIncome', tracedFromComputation(f.mdSourceIncome, 'form502.mdSourceIncome', ['form502.mdAGI'], 'Maryland-source income'))
  }
  if (f.overpaid > 0) values.set('form502.overpaid', tracedFromComputation(f.overpaid, 'form502.overpaid', ['form502.taxAfterCredits', 'form502.stateWithholding'], 'Maryland refund'))
  if (f.amountOwed > 0) values.set('form502.amountOwed', tracedFromComputation(f.amountOwed, 'form502.amountOwed', ['form502.taxAfterCredits', 'form502.stateWithholding'], 'Maryland amount owed'))

  return values
}

function d(result: StateComputeResult): Form502Result {
  return result.detail as Form502Result
}

const MD_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      { label: 'Federal AGI', nodeId: 'form1040.line11', getValue: (r) => d(r).federalAGI, tooltip: { explanation: 'Federal AGI is the starting point for Maryland income calculations.', pubName: 'Maryland Form 502 Instructions', pubUrl: 'https://www.marylandtaxes.gov/forms/Personal_Tax_Tips/' } },
      { label: 'Maryland AGI', nodeId: 'form502.mdAGI', getValue: (r) => r.stateAGI, tooltip: { explanation: 'Maryland AGI (v1) starts from federal AGI with no MD-specific adjustments modeled yet.', pubName: 'Maryland Form 502 Instructions', pubUrl: 'https://www.marylandtaxes.gov/forms/Personal_Tax_Tips/' } },
      { label: 'MD-Source Income', nodeId: 'form502.mdSourceIncome', getValue: (r) => d(r).mdSourceIncome ?? r.stateAGI, showWhen: (r) => d(r).mdSourceIncome !== undefined, tooltip: { explanation: 'For part-year/nonresident returns, Maryland-source income is apportionment-ratio adjusted AGI in v1.', pubName: 'Maryland Residency Guidance', pubUrl: 'https://www.marylandtaxes.gov/individual/income/tax-info/' } },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      { label: 'MD Deduction', nodeId: 'form502.mdDeduction', getValue: (r) => d(r).deductionUsed, tooltip: { explanation: 'Uses the larger of Maryland standard deduction or federal itemized deduction carryover.', pubName: 'Maryland Form 502 Instructions', pubUrl: 'https://www.marylandtaxes.gov/forms/Personal_Tax_Tips/' } },
      { label: 'MD Exemptions', nodeId: 'form502.mdExemptions', getValue: (r) => d(r).totalExemptions, tooltip: { explanation: 'Personal and dependent exemptions after AGI-based phase-down.', pubName: 'Maryland Form 502 Instructions', pubUrl: 'https://www.marylandtaxes.gov/forms/Personal_Tax_Tips/' } },
      { label: 'MD Taxable Income', nodeId: 'form502.mdTaxableIncome', getValue: (r) => r.stateTaxableIncome, tooltip: { explanation: 'Taxable income equals apportioned AGI minus apportioned deductions and exemptions.', pubName: 'Maryland Form 502 Instructions', pubUrl: 'https://www.marylandtaxes.gov/forms/Personal_Tax_Tips/' } },
    ],
  },
  {
    title: 'Tax & Payments',
    items: [
      { label: 'MD State Tax', nodeId: 'form502.mdStateTax', getValue: (r) => d(r).mdStateTax, tooltip: { explanation: 'Progressive Maryland state tax from taxable income brackets.', pubName: 'Maryland Tax Rate Schedules', pubUrl: 'https://www.marylandtaxes.gov/individual/income/tax-info/tax-rates.php' } },
      { label: 'MD Local Tax', nodeId: 'form502.mdLocalTax', getValue: (r) => d(r).mdLocalTax, tooltip: { explanation: 'Local income tax uses a default representative local rate in v1.', pubName: 'Maryland Local Tax Rates', pubUrl: 'https://www.marylandtaxes.gov/individual/income/tax-info/local-tax-rates.php' } },
      { label: 'MD Tax After Credits', nodeId: 'form502.taxAfterCredits', getValue: (r) => r.taxAfterCredits, tooltip: { explanation: 'Current v1 has no additional MD credits; equals state tax plus local tax.', pubName: 'Maryland Form 502 Instructions', pubUrl: 'https://www.marylandtaxes.gov/forms/Personal_Tax_Tips/' } },
      { label: 'MD Withholding', nodeId: 'form502.stateWithholding', getValue: (r) => r.stateWithholding, showWhen: (r) => r.stateWithholding > 0, tooltip: { explanation: 'Maryland withholding from W-2 Box 17 for MD state entries.', pubName: 'W-2 Instructions', pubUrl: 'https://www.irs.gov/forms-pubs/about-form-w-2' } },
    ],
  },
]

const MD_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  { type: 'refund', label: 'MD Refund', nodeId: 'form502.overpaid', getValue: (r) => r.overpaid, showWhen: (r) => r.overpaid > 0 },
  { type: 'owed', label: 'MD Amount You Owe', nodeId: 'form502.amountOwed', getValue: (r) => r.amountOwed, showWhen: (r) => r.amountOwed > 0 },
  { type: 'zero', label: 'MD tax balance', nodeId: '', getValue: () => 0, showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0 },
]

export const mdModule: StateRulesModule = {
  stateCode: 'MD',
  stateName: 'Maryland',
  formLabel: 'MD Form 502',
  sidebarLabel: 'MD Form 502',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm502(model, federal, config))
  },
  nodeLabels: MD_NODE_LABELS,
  collectTracedValues: collectMDTracedValues,
  reviewLayout: MD_REVIEW_LAYOUT,
  reviewResultLines: MD_REVIEW_RESULT_LINES,
}
