import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm1, type Form1Result } from './form1'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form1: Form1Result): StateComputeResult {
  return {
    stateCode: 'MA',
    formLabel: form1.residencyType === 'part-year' ? 'MA Form 1-NR/PY' : 'MA Form 1',
    residencyType: form1.residencyType,
    stateAGI: form1.maAGI,
    stateTaxableIncome: form1.maTaxableIncome,
    stateTax: form1.maIncomeTax,
    stateCredits: 0,
    taxAfterCredits: form1.taxAfterCredits,
    stateWithholding: form1.stateWithholding,
    overpaid: form1.overpaid,
    amountOwed: form1.amountOwed,
    apportionmentRatio: form1.apportionmentRatio,
    detail: form1,
  }
}

const MA_NODE_LABELS: Record<string, string> = {
  'form1.maAGI': 'Massachusetts adjusted gross income',
  'form1.maSourceIncome': 'MA-source income (apportioned)',
  'form1.personalExemption': 'Massachusetts personal exemption',
  'form1.maTaxableIncome': 'Massachusetts taxable income',
  'form1.maIncomeTax': 'Massachusetts income tax (5%)',
  'form1.taxAfterCredits': 'Massachusetts tax after credits',
  'form1.stateWithholding': 'MA state income tax withheld',
  'form1.overpaid': 'MA overpaid (refund)',
  'form1.amountOwed': 'MA amount you owe',
}

function collectMATracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const f = result.detail as Form1Result
  const out = new Map<string, TracedValue>()

  out.set('form1.maAGI', tracedFromComputation(
    f.maAGI, 'form1.maAGI', ['form1040.line11'], 'Massachusetts adjusted gross income',
  ))

  if (f.maSourceIncome !== undefined) {
    out.set('form1.maSourceIncome', tracedFromComputation(
      f.maSourceIncome, 'form1.maSourceIncome', ['form1.maAGI'], 'MA-source income (apportioned)',
    ))
  }

  out.set('form1.personalExemption', tracedFromComputation(
    f.personalExemption, 'form1.personalExemption', [], 'Massachusetts personal exemption',
  ))
  out.set('form1.maTaxableIncome', tracedFromComputation(
    f.maTaxableIncome,
    'form1.maTaxableIncome',
    [f.maSourceIncome !== undefined ? 'form1.maSourceIncome' : 'form1.maAGI', 'form1.personalExemption'],
    'Massachusetts taxable income',
  ))
  out.set('form1.maIncomeTax', tracedFromComputation(
    f.maIncomeTax, 'form1.maIncomeTax', ['form1.maTaxableIncome'], 'Massachusetts income tax (5%)',
  ))
  out.set('form1.taxAfterCredits', tracedFromComputation(
    f.taxAfterCredits, 'form1.taxAfterCredits', ['form1.maIncomeTax'], 'Massachusetts tax after credits',
  ))

  if (f.stateWithholding > 0) {
    out.set('form1.stateWithholding', tracedFromComputation(
      f.stateWithholding, 'form1.stateWithholding', [], 'MA state income tax withheld',
    ))
  }

  const inputs = ['form1.taxAfterCredits']
  if (f.stateWithholding > 0) inputs.push('form1.stateWithholding')
  if (f.overpaid > 0) {
    out.set('form1.overpaid', tracedFromComputation(f.overpaid, 'form1.overpaid', inputs, 'MA overpaid (refund)'))
  }
  if (f.amountOwed > 0) {
    out.set('form1.amountOwed', tracedFromComputation(f.amountOwed, 'form1.amountOwed', inputs, 'MA amount you owe'))
  }

  return out
}

function d(result: StateComputeResult): Form1Result {
  return result.detail as Form1Result
}

const MA_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Massachusetts starts from federal adjusted gross income in this simplified implementation.',
          pubName: 'Mass.gov — Personal Income Tax',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-tax-information-for-individuals',
        },
      },
      {
        label: 'MA AGI',
        nodeId: 'form1.maAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Massachusetts adjusted gross income used as the base for Form 1 computation.',
          pubName: 'Mass.gov — Form 1 Instructions',
          pubUrl: 'https://www.mass.gov/lists/current-year-personal-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MA-Source Income',
        nodeId: 'form1.maSourceIncome',
        getValue: (r) => d(r).maSourceIncome ?? r.stateAGI,
        showWhen: (r) => d(r).residencyType === 'part-year',
        tooltip: {
          explanation: 'For part-year returns, income is apportioned by in-state residency period.',
          pubName: 'Mass.gov — Nonresident/Part-Year Return',
          pubUrl: 'https://www.mass.gov/forms/form-1-nrpy-massachusetts-nonresidentpart-year-tax-return',
        },
      },
    ],
  },
  {
    title: 'Tax',
    items: [
      {
        label: 'Personal Exemption',
        nodeId: 'form1.personalExemption',
        getValue: (r) => d(r).personalExemption,
        tooltip: {
          explanation: 'Personal exemption amount based on filing status (prorated for part-year in this implementation).',
          pubName: 'Mass.gov — Form 1 Instructions',
          pubUrl: 'https://www.mass.gov/lists/current-year-personal-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MA Taxable Income',
        nodeId: 'form1.maTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Taxable income equals MA income base minus personal exemption.',
          pubName: 'Mass.gov — Form 1',
          pubUrl: 'https://www.mass.gov/forms/form-1-massachusetts-resident-income-tax-return',
        },
      },
      {
        label: 'MA Income Tax',
        nodeId: 'form1.maIncomeTax',
        getValue: (r) => r.stateTax,
        tooltip: {
          explanation: 'Massachusetts income tax computed at 5% flat rate for this baseline implementation.',
          pubName: 'Mass.gov — Tax Rates',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-tax-rates',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'MA State Withholding',
        nodeId: 'form1.stateWithholding',
        getValue: (r) => r.stateWithholding,
        showWhen: (r) => r.stateWithholding > 0,
        tooltip: {
          explanation: 'Massachusetts withholding from W-2 Box 17 where Box 15 state is MA.',
          pubName: 'Mass.gov — Form W-2 guidance',
          pubUrl: 'https://www.mass.gov/guides/withholding-tax-filing-requirements',
        },
      },
      {
        label: 'MA Tax After Credits',
        nodeId: 'form1.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Current Massachusetts baseline includes no additional credits in this phase.',
          pubName: 'Mass.gov — Form 1',
          pubUrl: 'https://www.mass.gov/forms/form-1-massachusetts-resident-income-tax-return',
        },
      },
    ],
  },
]

const MA_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  { type: 'refund', label: 'MA Refund', nodeId: 'form1.overpaid', getValue: (r) => r.overpaid, showWhen: (r) => r.overpaid > 0 },
  { type: 'owed', label: 'MA Amount You Owe', nodeId: 'form1.amountOwed', getValue: (r) => r.amountOwed, showWhen: (r) => r.amountOwed > 0 },
  { type: 'zero', label: 'MA tax balance', nodeId: '', getValue: () => 0, showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0 },
]

export const maModule: StateRulesModule = {
  stateCode: 'MA',
  stateName: 'Massachusetts',
  formLabel: 'MA Form 1',
  sidebarLabel: 'MA Form 1',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm1(model, federal, config))
  },
  nodeLabels: MA_NODE_LABELS,
  collectTracedValues: collectMATracedValues,
  reviewLayout: MA_REVIEW_LAYOUT,
  reviewResultLines: MA_REVIEW_RESULT_LINES,
}
