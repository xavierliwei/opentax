/**
 * CA State Module — Wraps existing Form 540 computation into the StateRulesModule interface
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm540 } from './form540'
import type { Form540Result } from './form540'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

/** Map a Form540Result into the standardised StateComputeResult */
function toStateResult(form540: Form540Result): StateComputeResult {
  return {
    stateCode: 'CA',
    formLabel: 'CA Form 540',
    stateAGI: form540.caAGI,
    stateTaxableIncome: form540.caTaxableIncome,
    stateTax: form540.caTax + form540.mentalHealthTax,
    stateCredits: form540.totalExemptionCredits + form540.rentersCredit,
    taxAfterCredits: form540.taxAfterCredits,
    stateWithholding: form540.stateWithholding,
    overpaid: form540.overpaid,
    amountOwed: form540.amountOwed,
    detail: form540,
  }
}

/** Node labels for CA trace nodes */
const CA_NODE_LABELS: Record<string, string> = {
  'form540.caAGI': 'California adjusted gross income',
  'form540.caDeduction': 'California deduction',
  'form540.caTaxableIncome': 'California taxable income',
  'form540.caTax': 'California tax',
  'form540.mentalHealthTax': 'Mental health services tax (1%)',
  'form540.exemptionCredits': 'CA exemption credits',
  'form540.rentersCredit': "CA renter's credit",
  'form540.taxAfterCredits': 'CA tax after credits',
  'form540.stateWithholding': 'CA state income tax withheld',
  'form540.overpaid': 'CA overpaid (refund)',
  'form540.amountOwed': 'CA amount you owe',
  'scheduleCA.hsaAddBack': 'HSA deduction add-back (CA)',
  'scheduleCA.additions': 'CA income additions',
  'scheduleCA.subtractions': 'CA income subtractions',
}

/** Build traced values for the CA explainability graph */
function collectCATracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form540 = result.detail as Form540Result
  const values = new Map<string, TracedValue>()

  const caInputs = ['form1040.line11']
  if (form540.caAdjustments.hsaAddBack > 0) caInputs.push('scheduleCA.hsaAddBack')

  if (form540.caAdjustments.hsaAddBack > 0) {
    values.set('scheduleCA.hsaAddBack', tracedFromComputation(
      form540.caAdjustments.hsaAddBack, 'scheduleCA.hsaAddBack', ['adjustments.hsa'],
      'HSA deduction add-back (CA)',
    ))
  }
  if (form540.caAdjustments.additions > 0) {
    values.set('scheduleCA.additions', tracedFromComputation(
      form540.caAdjustments.additions, 'scheduleCA.additions',
      form540.caAdjustments.hsaAddBack > 0 ? ['scheduleCA.hsaAddBack'] : [],
      'CA income additions',
    ))
  }

  values.set('form540.caAGI', tracedFromComputation(
    form540.caAGI, 'form540.caAGI', caInputs, 'California adjusted gross income',
  ))
  values.set('form540.caDeduction', tracedFromComputation(
    form540.deductionUsed, 'form540.caDeduction', [],
    `CA ${form540.deductionMethod} deduction`,
  ))
  values.set('form540.caTaxableIncome', tracedFromComputation(
    form540.caTaxableIncome, 'form540.caTaxableIncome',
    ['form540.caAGI', 'form540.caDeduction'],
    'California taxable income',
  ))
  values.set('form540.caTax', tracedFromComputation(
    form540.caTax, 'form540.caTax', ['form540.caTaxableIncome'], 'California tax',
  ))

  if (form540.totalExemptionCredits > 0) {
    values.set('form540.exemptionCredits', tracedFromComputation(
      form540.totalExemptionCredits, 'form540.exemptionCredits', [],
      'CA exemption credits',
    ))
  }

  if (form540.mentalHealthTax > 0) {
    values.set('form540.mentalHealthTax', tracedFromComputation(
      form540.mentalHealthTax, 'form540.mentalHealthTax', ['form540.caTaxableIncome'],
      'Mental health services tax (1%)',
    ))
  }

  if (form540.rentersCredit > 0) {
    values.set('form540.rentersCredit', tracedFromComputation(
      form540.rentersCredit, 'form540.rentersCredit', [],
      "CA renter's credit",
    ))
  }

  const taxAfterInputs = ['form540.caTax']
  if (form540.totalExemptionCredits > 0) taxAfterInputs.push('form540.exemptionCredits')
  if (form540.mentalHealthTax > 0) taxAfterInputs.push('form540.mentalHealthTax')
  if (form540.rentersCredit > 0) taxAfterInputs.push('form540.rentersCredit')
  values.set('form540.taxAfterCredits', tracedFromComputation(
    form540.taxAfterCredits, 'form540.taxAfterCredits', taxAfterInputs,
    'CA tax after credits',
  ))

  if (form540.stateWithholding > 0) {
    values.set('form540.stateWithholding', tracedFromComputation(
      form540.stateWithholding, 'form540.stateWithholding', [],
      'CA state income tax withheld',
    ))
  }

  const resultInputs = ['form540.taxAfterCredits']
  if (form540.stateWithholding > 0) resultInputs.push('form540.stateWithholding')
  if (form540.overpaid > 0) {
    values.set('form540.overpaid', tracedFromComputation(
      form540.overpaid, 'form540.overpaid', resultInputs, 'CA overpaid (refund)',
    ))
  }
  if (form540.amountOwed > 0) {
    values.set('form540.amountOwed', tracedFromComputation(
      form540.amountOwed, 'form540.amountOwed', resultInputs, 'CA amount you owe',
    ))
  }

  return values
}

/** Helper to safely extract Form540Result from StateComputeResult.detail */
function d(result: StateComputeResult): Form540Result {
  return result.detail as Form540Result
}

/** Config-driven review layout for the generic StateReviewPage */
const CA_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11. This is the starting point for computing California AGI.',
          pubName: 'FTB Form 540 Instructions — Line 13',
          pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
        },
      },
      {
        label: 'Schedule CA Additions',
        nodeId: 'scheduleCA.additions',
        getValue: (r) => d(r).caAdjustments.additions,
        tooltip: {
          explanation: 'California requires adding back certain federal deductions it does not recognize. The main addition is HSA contributions — California did not adopt IRC §223, so the federal HSA deduction must be added back to income.',
          pubName: 'FTB Schedule CA Instructions',
          pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-ca-instructions.html',
        },
        showWhen: (r) => d(r).caAdjustments.additions > 0,
      },
      {
        label: 'CA AGI',
        nodeId: 'form540.caAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'California adjusted gross income starts with federal AGI and applies Schedule CA adjustments. CA does not recognize HSA deductions (IRC §223), so HSA contributions are added back. Most other federal adjustments (IRA, student loan) conform to federal treatment.',
          pubName: 'FTB Form 540 Instructions — Line 17',
          pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'CA Deduction',
        nodeId: 'form540.caDeduction',
        getValue: (r) => d(r).deductionUsed,
        tooltip: {
          explanation: 'California uses the larger of the CA standard deduction or CA-adjusted itemized deductions. CA differences from federal: no SALT cap, $1M mortgage limit (not $750K), home equity interest still deductible, and state income tax cannot be deducted from the CA return.',
          pubName: 'FTB Form 540 Instructions — Line 18',
          pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
        },
      },
      {
        label: 'CA Taxable Income',
        nodeId: 'form540.caTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: "California taxable income is CA AGI minus your CA deduction. This is taxed using California's 9-bracket progressive rate schedule (1% to 12.3%).",
          pubName: 'FTB 2025 Tax Rate Schedules',
          pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'CA Tax',
        nodeId: 'form540.caTax',
        getValue: (r) => d(r).caTax,
        tooltip: {
          explanation: 'California income tax computed from the 9-bracket rate schedule. All income is taxed at ordinary rates — California has no preferential rate for long-term capital gains or qualified dividends.',
          pubName: 'FTB 2025 Tax Rate Schedules',
          pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf',
        },
      },
      {
        label: 'Mental Health Services Tax',
        nodeId: 'form540.mentalHealthTax',
        getValue: (r) => d(r).mentalHealthTax,
        tooltip: {
          explanation: "An additional 1% tax on California taxable income exceeding $1,000,000. This threshold is not doubled for MFJ filers. The revenue funds California's Mental Health Services Act (Proposition 63).",
          pubName: 'FTB Form 540 Instructions — Line 36',
          pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
        },
        showWhen: (r) => d(r).mentalHealthTax > 0,
      },
      {
        label: 'Exemption Credits',
        nodeId: 'form540.exemptionCredits',
        getValue: (r) => d(r).totalExemptionCredits,
        tooltip: {
          explanation: 'Personal exemption credit: $153 per filer. Dependent exemption credit: $475 per dependent. These credits phase out for high-income filers (reduced by 6% for each $2,500 of CA AGI above the threshold).',
          pubName: 'FTB Form 540 Instructions — Line 32',
          pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
        },
        showWhen: (r) => d(r).totalExemptionCredits > 0,
      },
      {
        label: "Renter's Credit",
        nodeId: 'form540.rentersCredit',
        getValue: (r) => d(r).rentersCredit,
        tooltip: {
          explanation: "Nonrefundable renter's credit: $60 for single/MFS filers (CA AGI ≤ $53,994), $120 for MFJ/HOH/QW filers (CA AGI ≤ $107,987). You must have paid rent for at least half the year on your principal California residence.",
          pubName: "FTB — Nonrefundable Renter's Credit",
          pubUrl: 'https://www.ftb.ca.gov/file/personal/credits/nonrefundable-renters-credit.html',
        },
        showWhen: (r) => d(r).rentersCredit > 0,
      },
      {
        label: 'CA Tax After Credits',
        nodeId: 'form540.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: "California tax after subtracting exemption credits and other nonrefundable credits (including renter's credit). This is compared against your CA state withholding to determine your CA refund or amount owed.",
          pubName: 'FTB Form 540 Instructions — Line 48',
          pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'CA State Withholding',
        nodeId: 'form540.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'California state income tax withheld from your W-2(s) Box 17. This is tax you already paid to the FTB through payroll withholding during the year.',
          pubName: 'FTB Form 540 Instructions — Line 71',
          pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const CA_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'CA Refund',
    nodeId: 'form540.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'CA Amount You Owe',
    nodeId: 'form540.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'CA tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const caModule: StateRulesModule = {
  stateCode: 'CA',
  stateName: 'California',
  formLabel: 'CA Form 540',
  sidebarLabel: 'CA Form 540',

  compute(model: TaxReturn, federal: Form1040Result, _config: StateReturnConfig): StateComputeResult {
    const form540 = computeForm540(model, federal)
    return toStateResult(form540)
  },

  nodeLabels: CA_NODE_LABELS,
  collectTracedValues: collectCATracedValues,
  reviewLayout: CA_REVIEW_LAYOUT,
  reviewResultLines: CA_REVIEW_RESULT_LINES,
}

/** Extract Form540Result from a CA StateComputeResult (for backward compat) */
export function extractForm540(result: StateComputeResult): Form540Result {
  return result.detail as Form540Result
}
