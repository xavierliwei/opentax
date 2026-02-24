/**
 * NJ State Module — Wraps NJ-1040 computation into the StateRulesModule interface
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeNJ1040 } from './formNJ1040'
import type { NJ1040Result } from './formNJ1040'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

/** Map a NJ1040Result into the standardised StateComputeResult */
function toStateResult(nj: NJ1040Result): StateComputeResult {
  return {
    stateCode: 'NJ',
    formLabel: 'NJ Form NJ-1040',
    residencyType: nj.residencyType,
    stateAGI: nj.line29_njGrossIncome,
    stateTaxableIncome: nj.line38_njTaxableIncome,
    stateTax: nj.line39_njTax,
    stateCredits: nj.line48_totalCredits,
    taxAfterCredits: nj.line49_taxAfterCredits,
    stateWithholding: nj.line52_njWithholding,
    overpaid: nj.line56_overpaid,
    amountOwed: nj.line57_amountOwed,
    detail: nj,
  }
}

/** Node labels for NJ trace nodes */
const NJ_NODE_LABELS: Record<string, string> = {
  'nj1040.wages': 'NJ wages (Line 15)',
  'nj1040.interest': 'NJ taxable interest (Line 16a)',
  'nj1040.dividends': 'NJ dividends (Line 17)',
  'nj1040.businessIncome': 'NJ business income (Line 18)',
  'nj1040.capitalGains': 'NJ capital gains (Line 19)',
  'nj1040.pensions': 'NJ pensions (Line 20a)',
  'nj1040.pensionExclusion': 'NJ pension exclusion (Line 20b)',
  'nj1040.totalIncome': 'NJ total income (Line 27)',
  'nj1040.totalExclusions': 'NJ total exclusions (Line 28c)',
  'nj1040.njGrossIncome': 'NJ gross income (Line 29)',
  'nj1040.propertyTaxDeduction': 'NJ property tax deduction (Line 30)',
  'nj1040.medicalExpenses': 'NJ medical expense deduction (Line 31)',
  'nj1040.totalDeductions': 'NJ total deductions (Line 36)',
  'nj1040.exemptions': 'NJ personal exemptions (Line 37)',
  'nj1040.taxableIncome': 'NJ taxable income (Line 38)',
  'nj1040.njTax': 'NJ tax (Line 39)',
  'nj1040.propertyTaxCredit': 'NJ property tax credit (Line 43)',
  'nj1040.njEITC': 'NJ Earned Income Tax Credit (Line 44)',
  'nj1040.njChildTaxCredit': 'NJ Child Tax Credit (Line 45)',
  'nj1040.totalCredits': 'NJ total credits (Line 48)',
  'nj1040.taxAfterCredits': 'NJ tax after credits (Line 49)',
  'nj1040.njWithholding': 'NJ state income tax withheld (Line 52)',
  'nj1040.overpaid': 'NJ overpaid (refund)',
  'nj1040.amountOwed': 'NJ amount you owe',
}

/** Build traced values for the NJ explainability graph */
function collectNJTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const nj = result.detail as NJ1040Result
  const values = new Map<string, TracedValue>()

  // Income lines
  if (nj.line15_wages > 0) {
    values.set('nj1040.wages', tracedFromComputation(
      nj.line15_wages, 'nj1040.wages', [], 'NJ wages (Line 15)',
    ))
  }
  if (nj.line16a_taxableInterest > 0) {
    values.set('nj1040.interest', tracedFromComputation(
      nj.line16a_taxableInterest, 'nj1040.interest', [], 'NJ taxable interest (Line 16a)',
    ))
  }
  if (nj.line17_dividends > 0) {
    values.set('nj1040.dividends', tracedFromComputation(
      nj.line17_dividends, 'nj1040.dividends', [], 'NJ dividends (Line 17)',
    ))
  }

  values.set('nj1040.njGrossIncome', tracedFromComputation(
    nj.line29_njGrossIncome, 'nj1040.njGrossIncome',
    ['nj1040.wages', 'nj1040.interest', 'nj1040.dividends'],
    'NJ gross income (Line 29)',
  ))

  if (nj.line20b_pensionExclusion > 0) {
    values.set('nj1040.pensionExclusion', tracedFromComputation(
      nj.line20b_pensionExclusion, 'nj1040.pensionExclusion', ['nj1040.pensions'],
      'NJ pension exclusion (Line 20b)',
    ))
  }

  if (nj.line30_propertyTaxDeduction > 0) {
    values.set('nj1040.propertyTaxDeduction', tracedFromComputation(
      nj.line30_propertyTaxDeduction, 'nj1040.propertyTaxDeduction', [],
      'NJ property tax deduction (Line 30)',
    ))
  }

  values.set('nj1040.exemptions', tracedFromComputation(
    nj.line37_exemptions, 'nj1040.exemptions', [], 'NJ personal exemptions (Line 37)',
  ))

  values.set('nj1040.taxableIncome', tracedFromComputation(
    nj.line38_njTaxableIncome, 'nj1040.taxableIncome',
    ['nj1040.njGrossIncome', 'nj1040.exemptions'],
    'NJ taxable income (Line 38)',
  ))

  values.set('nj1040.njTax', tracedFromComputation(
    nj.line39_njTax, 'nj1040.njTax', ['nj1040.taxableIncome'], 'NJ tax (Line 39)',
  ))

  // Credits
  if (nj.line43_propertyTaxCredit > 0) {
    values.set('nj1040.propertyTaxCredit', tracedFromComputation(
      nj.line43_propertyTaxCredit, 'nj1040.propertyTaxCredit', [],
      'NJ property tax credit ($50)',
    ))
  }
  if (nj.line44_njEITC > 0) {
    values.set('nj1040.njEITC', tracedFromComputation(
      nj.line44_njEITC, 'nj1040.njEITC', [], 'NJ EITC (40% of federal)',
    ))
  }
  if (nj.line45_njChildTaxCredit > 0) {
    values.set('nj1040.njChildTaxCredit', tracedFromComputation(
      nj.line45_njChildTaxCredit, 'nj1040.njChildTaxCredit', [],
      'NJ Child Tax Credit',
    ))
  }

  // Tax after credits
  const taxAfterInputs = ['nj1040.njTax']
  if (nj.line48_totalCredits > 0) taxAfterInputs.push('nj1040.totalCredits')
  values.set('nj1040.taxAfterCredits', tracedFromComputation(
    nj.line49_taxAfterCredits, 'nj1040.taxAfterCredits', taxAfterInputs,
    'NJ tax after credits (Line 49)',
  ))

  if (nj.line52_njWithholding > 0) {
    values.set('nj1040.njWithholding', tracedFromComputation(
      nj.line52_njWithholding, 'nj1040.njWithholding', [],
      'NJ state income tax withheld',
    ))
  }

  const resultInputs = ['nj1040.taxAfterCredits']
  if (nj.line52_njWithholding > 0) resultInputs.push('nj1040.njWithholding')
  if (nj.line56_overpaid > 0) {
    values.set('nj1040.overpaid', tracedFromComputation(
      nj.line56_overpaid, 'nj1040.overpaid', resultInputs, 'NJ overpaid (refund)',
    ))
  }
  if (nj.line57_amountOwed > 0) {
    values.set('nj1040.amountOwed', tracedFromComputation(
      nj.line57_amountOwed, 'nj1040.amountOwed', resultInputs, 'NJ amount you owe',
    ))
  }

  return values
}

/** Helper to extract NJ1040Result from StateComputeResult.detail */
function d(result: StateComputeResult): NJ1040Result {
  return result.detail as NJ1040Result
}

/** Config-driven review layout for the generic StateReviewPage */
const NJ_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'NJ Wages',
        nodeId: 'nj1040.wages',
        getValue: (r) => d(r).line15_wages,
        tooltip: {
          explanation: 'Wages from W-2 Box 16 (NJ state wages). Falls back to Box 1 if Box 16 is not reported.',
          pubName: 'NJ-1040 Instructions — Line 15',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
        showWhen: (r) => d(r).line15_wages > 0,
      },
      {
        label: 'Interest Income',
        nodeId: 'nj1040.interest',
        getValue: (r) => d(r).line16a_taxableInterest,
        tooltip: {
          explanation: 'Taxable interest from all 1099-INT forms. NJ taxes all interest income.',
          pubName: 'NJ-1040 Instructions — Line 16a',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
        showWhen: (r) => d(r).line16a_taxableInterest > 0,
      },
      {
        label: 'Dividends',
        nodeId: 'nj1040.dividends',
        getValue: (r) => d(r).line17_dividends,
        tooltip: {
          explanation: 'Total ordinary dividends. NJ does not have a preferential rate for qualified dividends.',
          pubName: 'NJ-1040 Instructions — Line 17',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
        showWhen: (r) => d(r).line17_dividends > 0,
      },
      {
        label: 'Pension Exclusion',
        nodeId: 'nj1040.pensionExclusion',
        getValue: (r) => d(r).line20b_pensionExclusion,
        tooltip: {
          explanation: 'NJ allows an exclusion on pension income up to $100,000 (MFJ) / $75,000 (single), if NJ income is below the eligibility limit.',
          pubName: 'NJ-1040 Instructions — Line 20b',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
        showWhen: (r) => d(r).line20b_pensionExclusion > 0,
      },
      {
        label: 'NJ Gross Income',
        nodeId: 'nj1040.njGrossIncome',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'NJ computes gross income from source documents — not from federal AGI. Social Security is fully exempt and pension exclusions apply.',
          pubName: 'NJ-1040 Instructions — Line 29',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'Property Tax Deduction',
        nodeId: 'nj1040.propertyTaxDeduction',
        getValue: (r) => d(r).line30_propertyTaxDeduction,
        tooltip: {
          explanation: 'Property taxes paid (or 18% of rent), up to $15,000. Auto-optimized vs the $50 property tax credit.',
          pubName: 'NJ-1040 Instructions — Line 30',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
        showWhen: (r) => d(r).line30_propertyTaxDeduction > 0,
      },
      {
        label: 'Medical Expenses',
        nodeId: 'nj1040.medicalExpenses',
        getValue: (r) => d(r).line31_medicalExpenses,
        tooltip: {
          explanation: 'Medical expenses exceeding 2% of NJ gross income (lower than federal 7.5% threshold).',
          pubName: 'NJ-1040 Instructions — Line 31',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
        showWhen: (r) => d(r).line31_medicalExpenses > 0,
      },
      {
        label: 'Personal Exemptions',
        nodeId: 'nj1040.exemptions',
        getValue: (r) => d(r).line37_exemptions,
        tooltip: {
          explanation: 'NJ uses exemptions instead of a standard deduction: $1,000/filer, $1,500/dependent, plus veteran ($6,000), age 65+, blind/disabled.',
          pubName: 'NJ-1040 Instructions — Line 37',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
      },
      {
        label: 'NJ Taxable Income',
        nodeId: 'nj1040.taxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: "NJ gross income minus deductions and exemptions, taxed using NJ's progressive brackets (1.4%–10.75%).",
          pubName: 'NJ-1040 Instructions — Line 38',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'NJ Tax',
        nodeId: 'nj1040.njTax',
        getValue: (r) => d(r).line39_njTax,
        tooltip: {
          explanation: 'NJ income tax from the progressive bracket schedule (1.4%–10.75%). All income taxed at ordinary rates.',
          pubName: 'NJ Tax Rate Schedule',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
      },
      {
        label: 'Property Tax Credit',
        nodeId: 'nj1040.propertyTaxCredit',
        getValue: (r) => d(r).line43_propertyTaxCredit,
        tooltip: {
          explanation: 'A $50 refundable credit used when the property tax deduction provides less benefit.',
          pubName: 'NJ-1040 Instructions — Line 43',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
        showWhen: (r) => d(r).line43_propertyTaxCredit > 0,
      },
      {
        label: 'NJ EITC',
        nodeId: 'nj1040.njEITC',
        getValue: (r) => d(r).line44_njEITC,
        tooltip: {
          explanation: 'NJ EITC is 40% of your federal Earned Income Credit. Refundable.',
          pubName: 'NJ-1040 Instructions — Line 44',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
        showWhen: (r) => d(r).line44_njEITC > 0,
      },
      {
        label: 'NJ Child Tax Credit',
        nodeId: 'nj1040.njChildTaxCredit',
        getValue: (r) => d(r).line45_njChildTaxCredit,
        tooltip: {
          explanation: 'Up to $1,000 per child age ≤5 if NJ gross income ≤ $80,000. Refundable.',
          pubName: 'NJ-1040 Instructions — Line 45',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
        showWhen: (r) => d(r).line45_njChildTaxCredit > 0,
      },
      {
        label: 'NJ Tax After Credits',
        nodeId: 'nj1040.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'NJ tax minus nonrefundable credits. Refundable credits are applied as payments.',
          pubName: 'NJ-1040 Instructions — Line 49',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'NJ State Withholding',
        nodeId: 'nj1040.njWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'NJ state income tax withheld from W-2(s) Box 17 where Box 15 = NJ.',
          pubName: 'NJ-1040 Instructions — Line 52',
          pubUrl: 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const NJ_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'NJ Refund',
    nodeId: 'nj1040.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'NJ Amount You Owe',
    nodeId: 'nj1040.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'NJ tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const njModule: StateRulesModule = {
  stateCode: 'NJ',
  stateName: 'New Jersey',
  formLabel: 'NJ Form NJ-1040',
  sidebarLabel: 'NJ-1040',

  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    const nj1040 = computeNJ1040(model, federal, config)
    return toStateResult(nj1040)
  },

  nodeLabels: NJ_NODE_LABELS,
  collectTracedValues: collectNJTracedValues,
  reviewLayout: NJ_REVIEW_LAYOUT,
  reviewResultLines: NJ_REVIEW_RESULT_LINES,
}
