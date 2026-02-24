/**
 * MA State Module — Wraps Form 1 computation into the StateRulesModule interface
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm1 } from './form1'
import type { Form1Result } from './form1'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

/** Map a Form1Result into the standardised StateComputeResult */
function toStateResult(form1: Form1Result): StateComputeResult {
  return {
    stateCode: 'MA',
    formLabel: form1.residencyType === 'part-year' ? 'MA Form 1-NR/PY' : 'MA Form 1',
    residencyType: form1.residencyType,
    stateAGI: form1.maAGI,
    stateTaxableIncome: form1.maTaxableIncome,
    stateTax: form1.maIncomeTax,
    stateCredits: form1.totalCredits,
    taxAfterCredits: form1.taxAfterCredits,
    stateWithholding: form1.stateWithholding,
    overpaid: form1.overpaid,
    amountOwed: form1.amountOwed,
    apportionmentRatio: form1.apportionmentRatio,
    detail: form1,
  }
}

/** Node labels for MA trace nodes */
const MA_NODE_LABELS: Record<string, string> = {
  'form1.maAGI': 'Massachusetts adjusted gross income',
  'form1.maSourceIncome': 'MA-source income (apportioned)',
  'form1.personalExemption': 'Massachusetts personal exemption',
  'form1.dependentExemption': 'Massachusetts dependent exemption',
  'form1.totalExemptions': 'Massachusetts total exemptions',
  'form1.rentDeduction': 'Massachusetts rent deduction',
  'form1.maTaxableIncome': 'Massachusetts taxable income',
  'form1.maBaseTax': 'Massachusetts income tax (5%)',
  'form1.maSurtax': 'Massachusetts surtax (4% over $1M)',
  'form1.maIncomeTax': 'Massachusetts total income tax',
  'form1.taxAfterCredits': 'MA tax after credits',
  'form1.stateWithholding': 'MA state income tax withheld',
  'form1.overpaid': 'MA overpaid (refund)',
  'form1.amountOwed': 'MA amount you owe',
  'maAdj.hsaAddBack': 'HSA deduction add-back (MA)',
  'maAdj.ssExemption': 'Social Security exemption (MA)',
  'maAdj.usGovInterest': 'US government interest exemption (MA)',
}

/** Build traced values for the MA explainability graph */
function collectMATracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const f = result.detail as Form1Result
  const values = new Map<string, TracedValue>()

  const maAGIInputs = ['form1040.line11']
  if (f.maAdjustments.hsaAddBack > 0) maAGIInputs.push('maAdj.hsaAddBack')

  if (f.maAdjustments.hsaAddBack > 0) {
    values.set('maAdj.hsaAddBack', tracedFromComputation(
      f.maAdjustments.hsaAddBack, 'maAdj.hsaAddBack', ['adjustments.hsa'],
      'HSA deduction add-back (MA)',
    ))
  }
  if (f.maAdjustments.ssExemption > 0) {
    values.set('maAdj.ssExemption', tracedFromComputation(
      f.maAdjustments.ssExemption, 'maAdj.ssExemption', ['form1040.line6b'],
      'Social Security exemption (MA)',
    ))
  }
  if (f.maAdjustments.usGovInterest > 0) {
    values.set('maAdj.usGovInterest', tracedFromComputation(
      f.maAdjustments.usGovInterest, 'maAdj.usGovInterest', [],
      'US government interest exemption (MA)',
    ))
  }

  values.set('form1.maAGI', tracedFromComputation(
    f.maAGI, 'form1.maAGI', maAGIInputs, 'Massachusetts adjusted gross income',
  ))

  if (f.maSourceIncome !== undefined) {
    values.set('form1.maSourceIncome', tracedFromComputation(
      f.maSourceIncome, 'form1.maSourceIncome', ['form1.maAGI'],
      `MA-source income (${Math.round(f.apportionmentRatio * 100)}% of MA AGI)`,
    ))
  }

  values.set('form1.totalExemptions', tracedFromComputation(
    f.totalExemptions, 'form1.totalExemptions', [],
    'Massachusetts total exemptions',
  ))

  if (f.rentDeduction > 0) {
    values.set('form1.rentDeduction', tracedFromComputation(
      f.rentDeduction, 'form1.rentDeduction', [],
      'Massachusetts rent deduction (50% of rent, max $4,000)',
    ))
  }

  const taxableInputs = [
    f.maSourceIncome !== undefined ? 'form1.maSourceIncome' : 'form1.maAGI',
    'form1.totalExemptions',
  ]
  if (f.rentDeduction > 0) taxableInputs.push('form1.rentDeduction')

  values.set('form1.maTaxableIncome', tracedFromComputation(
    f.maTaxableIncome, 'form1.maTaxableIncome', taxableInputs,
    'Massachusetts taxable income',
  ))

  values.set('form1.maBaseTax', tracedFromComputation(
    f.maBaseTax, 'form1.maBaseTax', ['form1.maTaxableIncome'],
    'Massachusetts income tax (5% flat rate)',
  ))

  if (f.maSurtax > 0) {
    values.set('form1.maSurtax', tracedFromComputation(
      f.maSurtax, 'form1.maSurtax', ['form1.maTaxableIncome'],
      'Massachusetts surtax (4% on income over $1M)',
    ))
  }

  const taxInputs = ['form1.maBaseTax']
  if (f.maSurtax > 0) taxInputs.push('form1.maSurtax')

  values.set('form1.maIncomeTax', tracedFromComputation(
    f.maIncomeTax, 'form1.maIncomeTax', taxInputs,
    'Massachusetts total income tax',
  ))

  values.set('form1.taxAfterCredits', tracedFromComputation(
    f.taxAfterCredits, 'form1.taxAfterCredits', ['form1.maIncomeTax'],
    'MA tax after credits',
  ))

  if (f.stateWithholding > 0) {
    values.set('form1.stateWithholding', tracedFromComputation(
      f.stateWithholding, 'form1.stateWithholding', [],
      'MA state income tax withheld',
    ))
  }

  const resultInputs = ['form1.taxAfterCredits']
  if (f.stateWithholding > 0) resultInputs.push('form1.stateWithholding')
  if (f.overpaid > 0) {
    values.set('form1.overpaid', tracedFromComputation(
      f.overpaid, 'form1.overpaid', resultInputs, 'MA overpaid (refund)',
    ))
  }
  if (f.amountOwed > 0) {
    values.set('form1.amountOwed', tracedFromComputation(
      f.amountOwed, 'form1.amountOwed', resultInputs, 'MA amount you owe',
    ))
  }

  return values
}

/** Helper to safely extract Form1Result from StateComputeResult.detail */
function d(result: StateComputeResult): Form1Result {
  return result.detail as Form1Result
}

/** Config-driven review layout for the generic StateReviewPage */
const MA_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11. Massachusetts starts with federal AGI and applies state-specific adjustments.',
          pubName: 'MA DOR Form 1 Instructions',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-personal-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'HSA Add-Back',
        nodeId: 'maAdj.hsaAddBack',
        getValue: (r) => d(r).maAdjustments.hsaAddBack,
        showWhen: (r) => d(r).maAdjustments.hsaAddBack > 0,
        tooltip: {
          explanation: 'Massachusetts does not conform to IRC §223 (HSA). The federal HSA deduction must be added back to arrive at MA AGI.',
          pubName: 'MA DOR Schedule Y Instructions',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-personal-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'Social Security Exemption',
        nodeId: 'maAdj.ssExemption',
        getValue: (r) => d(r).maAdjustments.ssExemption,
        showWhen: (r) => d(r).maAdjustments.ssExemption > 0,
        tooltip: {
          explanation: 'Social Security benefits are fully exempt from Massachusetts income tax. The federally taxable portion is subtracted from MA AGI.',
          pubName: 'MA DOR Form 1 Instructions — Line 2',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-personal-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MA AGI',
        nodeId: 'form1.maAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Massachusetts adjusted gross income equals federal AGI plus MA additions (HSA add-back) minus MA subtractions (Social Security, US government interest).',
          pubName: 'MA DOR Form 1 Instructions',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-personal-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MA-Source Income',
        nodeId: 'form1.maSourceIncome',
        getValue: (r) => d(r).maSourceIncome ?? r.stateAGI,
        showWhen: (r) => d(r).residencyType === 'part-year',
        tooltip: {
          explanation: 'For part-year residents, income is apportioned based on the number of days spent as an MA resident.',
          pubName: 'MA Form 1-NR/PY Instructions',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-personal-income-tax-forms-and-instructions',
        },
      },
    ],
  },
  {
    title: 'Exemptions & Deductions',
    items: [
      {
        label: 'Total Exemptions',
        nodeId: 'form1.totalExemptions',
        getValue: (r) => d(r).totalExemptions,
        tooltip: {
          explanation: 'Massachusetts uses personal exemptions instead of a standard deduction. Includes personal ($4,400 single / $8,800 MFJ), dependent ($1,000 each), age 65+ ($700), and blind ($2,200) exemptions.',
          pubName: 'MA DOR Form 1 Instructions — Exemptions',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-personal-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'Rent Deduction',
        nodeId: 'form1.rentDeduction',
        getValue: (r) => d(r).rentDeduction,
        showWhen: (r) => d(r).rentDeduction > 0,
        tooltip: {
          explanation: 'Deduction of 50% of rent paid for your principal residence in Massachusetts, up to $4,000 ($2,000 for MFS).',
          pubName: 'MA DOR Form 1 Instructions — Line 14',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-personal-income-tax-forms-and-instructions',
        },
      },
      {
        label: 'MA Taxable Income',
        nodeId: 'form1.maTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Massachusetts taxable income is MA AGI minus exemptions and deductions. Taxed at a flat 5% rate, with an additional 4% surtax on income over $1,000,000.',
          pubName: 'MA DOR Tax Rate Schedule',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-tax-rates',
        },
      },
    ],
  },
  {
    title: 'Tax',
    items: [
      {
        label: 'MA Base Tax (5%)',
        nodeId: 'form1.maBaseTax',
        getValue: (r) => d(r).maBaseTax,
        tooltip: {
          explanation: 'Massachusetts income tax at the flat 5.00% rate on all taxable income. Unlike most states, MA does not use progressive brackets.',
          pubName: 'MA DOR Tax Rates',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-tax-rates',
        },
      },
      {
        label: 'Millionaire Surtax (4%)',
        nodeId: 'form1.maSurtax',
        getValue: (r) => d(r).maSurtax,
        showWhen: (r) => d(r).maSurtax > 0,
        tooltip: {
          explanation: 'Additional 4% surtax on taxable income exceeding $1,000,000. Approved by voters in November 2022 as the Fair Share Amendment (Article XLIV). Not doubled for MFJ filers.',
          pubName: 'MA Fair Share Amendment',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-tax-rates',
        },
      },
      {
        label: 'MA Tax After Credits',
        nodeId: 'form1.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Total Massachusetts income tax after subtracting any credits. This is compared against your MA state withholding to determine your refund or amount owed.',
          pubName: 'MA DOR Form 1 Instructions',
          pubUrl: 'https://www.mass.gov/info-details/massachusetts-personal-income-tax-forms-and-instructions',
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
          explanation: 'Massachusetts state income tax withheld from your W-2(s) Box 17 where Box 15 state is MA.',
          pubName: 'MA DOR Withholding Guide',
          pubUrl: 'https://www.mass.gov/guides/withholding-tax-filing-requirements',
        },
      },
    ],
  },
]

const MA_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'MA Refund',
    nodeId: 'form1.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'MA Amount You Owe',
    nodeId: 'form1.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'MA tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const maModule: StateRulesModule = {
  stateCode: 'MA',
  stateName: 'Massachusetts',
  formLabel: 'MA Form 1',
  sidebarLabel: 'MA Form 1',

  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    const form1 = computeForm1(model, federal, config)
    return toStateResult(form1)
  },

  nodeLabels: MA_NODE_LABELS,
  collectTracedValues: collectMATracedValues,
  reviewLayout: MA_REVIEW_LAYOUT,
  reviewResultLines: MA_REVIEW_RESULT_LINES,
}

/** Extract Form1Result from an MA StateComputeResult */
export function extractForm1(result: StateComputeResult): Form1Result {
  return result.detail as Form1Result
}
