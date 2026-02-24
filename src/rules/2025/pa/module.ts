import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computePA40, type PA40Result } from './pa40'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(pa40: PA40Result): StateComputeResult {
  return {
    stateCode: 'PA',
    formLabel: 'PA-40',
    residencyType: pa40.residencyType,
    stateAGI: pa40.totalPATaxableIncome,
    stateTaxableIncome: pa40.adjustedTaxableIncome,
    stateTax: pa40.paTax,
    stateCredits: pa40.totalCredits,
    taxAfterCredits: pa40.taxAfterCredits,
    stateWithholding: pa40.stateWithholding,
    overpaid: pa40.overpaid,
    amountOwed: pa40.amountOwed,
    apportionmentRatio: pa40.apportionmentRatio,
    detail: pa40,
  }
}

const PA_NODE_LABELS: Record<string, string> = {
  'pa40.totalIncome': 'PA total taxable income (sum of classes)',
  'pa40.taxableIncome': 'PA taxable income',
  'pa40.tax': 'PA tax (flat 3.07%)',
  'pa40.withholding': 'PA state withholding',
  'pa40.overpaid': 'PA refund',
  'pa40.amountOwed': 'PA amount owed',
}

function collectPATracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const pa40 = result.detail as PA40Result
  const values = new Map<string, TracedValue>()

  values.set('pa40.totalIncome', tracedFromComputation(
    pa40.totalPATaxableIncome,
    'pa40.totalIncome',
    [],
    'PA total taxable income (sum of classes)',
  ))

  values.set('pa40.taxableIncome', tracedFromComputation(
    pa40.adjustedTaxableIncome,
    'pa40.taxableIncome',
    ['pa40.totalIncome'],
    'PA adjusted taxable income',
  ))

  values.set('pa40.tax', tracedFromComputation(
    pa40.paTax,
    'pa40.tax',
    ['pa40.taxableIncome'],
    'PA tax (flat 3.07%)',
  ))

  if (pa40.stateWithholding > 0) {
    values.set('pa40.withholding', tracedFromComputation(
      pa40.stateWithholding,
      'pa40.withholding',
      [],
      'PA state withholding',
    ))
  }

  if (pa40.overpaid > 0) {
    values.set('pa40.overpaid', tracedFromComputation(
      pa40.overpaid,
      'pa40.overpaid',
      ['pa40.tax', 'pa40.withholding'],
      'PA refund',
    ))
  }

  if (pa40.amountOwed > 0) {
    values.set('pa40.amountOwed', tracedFromComputation(
      pa40.amountOwed,
      'pa40.amountOwed',
      ['pa40.tax', 'pa40.withholding'],
      'PA amount owed',
    ))
  }

  return values
}

function d(result: StateComputeResult): PA40Result {
  return result.detail as PA40Result
}

const PA_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'PA Total Taxable Income',
        nodeId: 'pa40.totalIncome',
        getValue: (r) => d(r).totalPATaxableIncome,
        tooltip: {
          explanation: 'PA taxes income by class. This line is the sum of positive PA income classes (compensation, interest, dividends, business, rents/royalties, gains, etc.).',
          pubName: 'PA-40 Instructions',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025/2025_pa-40in.pdf',
        },
      },
      {
        label: 'PA Taxable Income',
        nodeId: 'pa40.taxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Taxable income used for PA flat tax computation. For part-year residents, income is prorated by in-state residency days.',
          pubName: 'PA-40 Instructions',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025/2025_pa-40in.pdf',
        },
      },
    ],
  },
  {
    title: 'Tax & Payments',
    items: [
      {
        label: 'PA Tax (3.07%)',
        nodeId: 'pa40.tax',
        getValue: (r) => r.stateTax,
        tooltip: {
          explanation: 'Pennsylvania personal income tax is a flat 3.07% rate.',
          pubName: 'PA Department of Revenue',
          pubUrl: 'https://www.revenue.pa.gov/TaxTypes/PIT/Pages/default.aspx',
        },
      },
      {
        label: 'PA State Withholding',
        nodeId: 'pa40.withholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Withholding from W-2 Box 17 entries where Box 15 state is PA.',
          pubName: 'PA-40 Instructions',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025/2025_pa-40in.pdf',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const PA_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'PA Refund',
    nodeId: 'pa40.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'PA Amount You Owe',
    nodeId: 'pa40.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'PA tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const paModule: StateRulesModule = {
  stateCode: 'PA',
  stateName: 'Pennsylvania',
  formLabel: 'PA-40',
  sidebarLabel: 'PA-40',

  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computePA40(model, federal, config))
  },

  nodeLabels: PA_NODE_LABELS,
  collectTracedValues: collectPATracedValues,
  reviewLayout: PA_REVIEW_LAYOUT,
  reviewResultLines: PA_REVIEW_RESULT_LINES,
}
