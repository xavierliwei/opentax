/**
 * PA State Module — Wraps PA-40 computation into the StateRulesModule interface
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computePA40 } from './pa40'
import type { PA40Result } from './pa40'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

// ── StateComputeResult adapter ──────────────────────────────

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

// ── Node labels for explainability ──────────────────────────

const PA_NODE_LABELS: Record<string, string> = {
  'pa40.compensation': 'PA compensation (W-2 state wages)',
  'pa40.interest': 'PA interest income',
  'pa40.dividends': 'PA dividends and capital gain distributions',
  'pa40.netBusinessIncome': 'PA net business income',
  'pa40.netGains': 'PA net gains from property',
  'pa40.rentsRoyalties': 'PA rents, royalties, patents, copyrights',
  'pa40.estateTrustIncome': 'PA estate or trust income',
  'pa40.gamblingWinnings': 'PA gambling and lottery winnings',
  'pa40.totalTaxableIncome': 'Total PA taxable income',
  'pa40.deductions529': 'PA IRC §529 deduction',
  'pa40.adjustedTaxableIncome': 'Adjusted PA taxable income',
  'pa40.paTax': 'Pennsylvania income tax (3.07%)',
  'pa40.taxForgiveness': 'PA tax forgiveness credit (Schedule SP)',
  'pa40.taxAfterCredits': 'PA tax after credits',
  'pa40.stateWithholding': 'PA state income tax withheld',
  'pa40.overpaid': 'PA overpaid (refund)',
  'pa40.amountOwed': 'PA amount you owe',
}

// ── Traced values for explainability graph ──────────────────

function collectPATracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const pa40 = result.detail as PA40Result
  const values = new Map<string, TracedValue>()
  const ic = pa40.incomeClasses

  const classInputs: string[] = []

  if (ic.netCompensation > 0) {
    values.set('pa40.compensation', tracedFromComputation(
      ic.netCompensation, 'pa40.compensation', [], 'PA compensation (W-2 state wages)',
    ))
    classInputs.push('pa40.compensation')
  }
  if (ic.interest > 0) {
    values.set('pa40.interest', tracedFromComputation(
      ic.interest, 'pa40.interest', [], 'PA interest income',
    ))
    classInputs.push('pa40.interest')
  }
  if (ic.dividends > 0) {
    values.set('pa40.dividends', tracedFromComputation(
      ic.dividends, 'pa40.dividends', [], 'PA dividends and capital gain distributions',
    ))
    classInputs.push('pa40.dividends')
  }
  if (ic.netBusinessIncome > 0) {
    values.set('pa40.netBusinessIncome', tracedFromComputation(
      ic.netBusinessIncome, 'pa40.netBusinessIncome', [], 'PA net business income',
    ))
    classInputs.push('pa40.netBusinessIncome')
  }
  if (ic.netGains > 0) {
    values.set('pa40.netGains', tracedFromComputation(
      ic.netGains, 'pa40.netGains', [], 'PA net gains from property',
    ))
    classInputs.push('pa40.netGains')
  }
  if (ic.rentsRoyalties > 0) {
    values.set('pa40.rentsRoyalties', tracedFromComputation(
      ic.rentsRoyalties, 'pa40.rentsRoyalties', [], 'PA rents, royalties, patents, copyrights',
    ))
    classInputs.push('pa40.rentsRoyalties')
  }
  if (ic.estateTrustIncome > 0) {
    values.set('pa40.estateTrustIncome', tracedFromComputation(
      ic.estateTrustIncome, 'pa40.estateTrustIncome', [], 'PA estate or trust income',
    ))
    classInputs.push('pa40.estateTrustIncome')
  }

  values.set('pa40.totalTaxableIncome', tracedFromComputation(
    pa40.totalPATaxableIncome, 'pa40.totalTaxableIncome', classInputs,
    'Total PA taxable income',
  ))

  const taxableInputs = ['pa40.totalTaxableIncome']
  if (pa40.deductions529 > 0) {
    values.set('pa40.deductions529', tracedFromComputation(
      pa40.deductions529, 'pa40.deductions529', [], 'PA IRC §529 deduction',
    ))
    taxableInputs.push('pa40.deductions529')
  }

  values.set('pa40.adjustedTaxableIncome', tracedFromComputation(
    pa40.adjustedTaxableIncome, 'pa40.adjustedTaxableIncome', taxableInputs,
    'Adjusted PA taxable income',
  ))

  values.set('pa40.paTax', tracedFromComputation(
    pa40.paTax, 'pa40.paTax', ['pa40.adjustedTaxableIncome'],
    'Pennsylvania income tax (3.07%)',
  ))

  const taxAfterInputs = ['pa40.paTax']
  if (pa40.taxForgiveness.qualifies) {
    values.set('pa40.taxForgiveness', tracedFromComputation(
      pa40.taxForgiveness.forgivenessCredit, 'pa40.taxForgiveness', ['pa40.paTax'],
      `PA tax forgiveness credit (${pa40.taxForgiveness.forgivenessPercentage}%)`,
    ))
    taxAfterInputs.push('pa40.taxForgiveness')
  }

  values.set('pa40.taxAfterCredits', tracedFromComputation(
    pa40.taxAfterCredits, 'pa40.taxAfterCredits', taxAfterInputs,
    'PA tax after credits',
  ))

  if (pa40.stateWithholding > 0) {
    values.set('pa40.stateWithholding', tracedFromComputation(
      pa40.stateWithholding, 'pa40.stateWithholding', [],
      'PA state income tax withheld',
    ))
  }

  const resultInputs = ['pa40.taxAfterCredits']
  if (pa40.stateWithholding > 0) resultInputs.push('pa40.stateWithholding')
  if (pa40.overpaid > 0) {
    values.set('pa40.overpaid', tracedFromComputation(
      pa40.overpaid, 'pa40.overpaid', resultInputs, 'PA overpaid (refund)',
    ))
  }
  if (pa40.amountOwed > 0) {
    values.set('pa40.amountOwed', tracedFromComputation(
      pa40.amountOwed, 'pa40.amountOwed', resultInputs, 'PA amount you owe',
    ))
  }

  return values
}

// ── Helper ──────────────────────────────────────────────────

function d(result: StateComputeResult): PA40Result {
  return result.detail as PA40Result
}

// ── Review layout ───────────────────────────────────────────

const PA_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income by Class',
    items: [
      {
        label: 'Compensation (Line 1a)',
        nodeId: 'pa40.compensation',
        getValue: (r) => d(r).incomeClasses.netCompensation,
        tooltip: {
          explanation: 'Wages, salaries, tips, and other employee compensation from W-2 Box 16 (PA state wages). PA taxes all compensation at a flat 3.07%.',
          pubName: 'PA-40 Instructions — Line 1a',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025_pa-40in.pdf',
        },
        showWhen: (r) => d(r).incomeClasses.netCompensation > 0,
      },
      {
        label: 'Interest (Line 2)',
        nodeId: 'pa40.interest',
        getValue: (r) => d(r).incomeClasses.interest,
        tooltip: {
          explanation: 'All interest income including federally tax-exempt interest from non-PA municipal bonds. PA taxes interest that the federal government exempts.',
          pubName: 'PA-40 Instructions — Line 2',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025_pa-40in.pdf',
        },
        showWhen: (r) => d(r).incomeClasses.interest > 0,
      },
      {
        label: 'Dividends (Line 3)',
        nodeId: 'pa40.dividends',
        getValue: (r) => d(r).incomeClasses.dividends,
        tooltip: {
          explanation: 'Ordinary dividends, qualified dividends, and capital gain distributions from 1099-DIV. Capital gain distributions are Class 3 (not Class 5).',
          pubName: 'PA-40 Instructions — Line 3',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025_pa-40in.pdf',
        },
        showWhen: (r) => d(r).incomeClasses.dividends > 0,
      },
      {
        label: 'Net Business Income (Line 4)',
        nodeId: 'pa40.netBusinessIncome',
        getValue: (r) => d(r).incomeClasses.netBusinessIncome,
        tooltip: {
          explanation: 'Net profit from sole proprietorship (Schedule C). Losses are floored at $0 and cannot offset other income classes.',
          pubName: 'PA-40 Instructions — Line 4',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025_pa-40in.pdf',
        },
        showWhen: (r) => d(r).incomeClasses.netBusinessIncome > 0,
      },
      {
        label: 'Net Gains (Line 5)',
        nodeId: 'pa40.netGains',
        getValue: (r) => d(r).incomeClasses.netGains,
        tooltip: {
          explanation: 'Capital gains from property sales. PA does not allow the federal $3,000 capital loss deduction against other income. Losses in this class cannot offset wages.',
          pubName: 'PA-40 Instructions — Line 5',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025_pa-40in.pdf',
        },
        showWhen: (r) => d(r).incomeClasses.netGains > 0,
      },
      {
        label: 'Rents & Royalties (Line 6)',
        nodeId: 'pa40.rentsRoyalties',
        getValue: (r) => d(r).incomeClasses.rentsRoyalties,
        tooltip: {
          explanation: 'Net income from rents, royalties, patents, and copyrights. Losses are floored at $0.',
          pubName: 'PA-40 Instructions — Line 6',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025_pa-40in.pdf',
        },
        showWhen: (r) => d(r).incomeClasses.rentsRoyalties > 0,
      },
      {
        label: 'Estate/Trust Income (Line 7)',
        nodeId: 'pa40.estateTrustIncome',
        getValue: (r) => d(r).incomeClasses.estateTrustIncome,
        tooltip: {
          explanation: 'Passthrough income from estates and trusts (K-1).',
          pubName: 'PA-40 Instructions — Line 7',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025_pa-40in.pdf',
        },
        showWhen: (r) => d(r).incomeClasses.estateTrustIncome > 0,
      },
      {
        label: 'Total PA Taxable Income (Line 9)',
        nodeId: 'pa40.totalTaxableIncome',
        getValue: (r) => d(r).totalPATaxableIncome,
        tooltip: {
          explanation: 'Sum of all positive income classes. PA does not allow losses in one class to offset gains in another.',
          pubName: 'PA-40 Instructions — Line 9',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025_pa-40in.pdf',
        },
      },
      {
        label: 'IRC §529 Deduction (Line 10)',
        nodeId: 'pa40.deductions529',
        getValue: (r) => d(r).deductions529,
        tooltip: {
          explanation: 'PA allows a deduction for contributions to IRC §529 tuition savings plans, up to $18,000 per beneficiary ($36,000 for MFJ).',
          pubName: 'PA-40 Instructions — Line 10',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025_pa-40in.pdf',
        },
        showWhen: (r) => d(r).deductions529 > 0,
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'PA Tax (3.07%)',
        nodeId: 'pa40.paTax',
        getValue: (r) => d(r).paTax,
        tooltip: {
          explanation: 'Pennsylvania personal income tax is a flat 3.07% rate on all taxable income. No brackets, no preferential rates.',
          pubName: 'PA Department of Revenue',
          pubUrl: 'https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/personal-income-tax',
        },
      },
      {
        label: 'Tax Forgiveness (Schedule SP)',
        nodeId: 'pa40.taxForgiveness',
        getValue: (r) => d(r).taxForgiveness.forgivenessCredit,
        tooltip: {
          explanation: 'PA Schedule SP credit for low/moderate-income filers. Based on eligibility income (which includes nontaxable income like Social Security). Percentage from 100% to 0% in 10% steps.',
          pubName: 'PA Schedule SP Instructions',
          pubUrl: 'https://www.pa.gov/agencies/revenue/forms-and-publications/pa-personal-income-tax-guide/tax-forgiveness',
        },
        showWhen: (r) => d(r).taxForgiveness.qualifies,
      },
      {
        label: 'PA Tax After Credits',
        nodeId: 'pa40.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'PA tax after subtracting all credits. Compared against PA withholding to determine refund or amount owed.',
          pubName: 'PA-40 Instructions — Line 18',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025_pa-40in.pdf',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'PA State Withholding',
        nodeId: 'pa40.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Pennsylvania state income tax withheld from W-2 Box 17 entries where Box 15 state is PA.',
          pubName: 'PA-40 Instructions — Line 23',
          pubUrl: 'https://www.revenue.pa.gov/FormsandPublications/FormsforIndividuals/PIT/Documents/2025_pa-40in.pdf',
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
