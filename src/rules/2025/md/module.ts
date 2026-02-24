/**
 * MD State Module — Wraps Form 502 computation into the StateRulesModule interface
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import type { StateComputeResult, StateReviewResultLine, StateReviewSection, StateRulesModule } from '../../stateEngine'
import { computeForm502, type Form502Result } from './form502'
import { MD_COUNTIES } from './constants'

/** Map a Form502Result into the standardised StateComputeResult */
function toStateResult(form502: Form502Result): StateComputeResult {
  const isNonresident = form502.residencyType === 'nonresident'
  return {
    stateCode: 'MD',
    formLabel: isNonresident ? 'MD Form 505' : 'MD Form 502',
    residencyType: form502.residencyType,
    stateAGI: form502.mdAGI,
    stateTaxableIncome: form502.mdTaxableIncome,
    stateTax: form502.mdStateTax + form502.mdLocalTax,
    stateCredits: form502.mdEIC,
    taxAfterCredits: form502.taxAfterCredits,
    stateWithholding: form502.stateWithholding,
    overpaid: form502.overpaid,
    amountOwed: form502.amountOwed,
    apportionmentRatio: form502.apportionmentRatio,
    detail: form502,
  }
}

/** Node labels for MD trace nodes */
const MD_NODE_LABELS: Record<string, string> = {
  'form502.mdAGI': 'Maryland adjusted gross income',
  'form502.ssSubtraction': 'Social Security subtraction (MD exempt)',
  'form502.mdSourceIncome': 'Maryland-source income (apportioned)',
  'form502.mdDeduction': 'Maryland deduction',
  'form502.mdExemptions': 'Maryland personal/dependent exemptions',
  'form502.mdTaxableIncome': 'Maryland taxable income',
  'form502.mdStateTax': 'Maryland state income tax',
  'form502.mdLocalTax': 'Maryland local income tax',
  'form502.mdEIC': 'Maryland earned income credit',
  'form502.taxAfterCredits': 'Maryland total tax after credits',
  'form502.stateWithholding': 'Maryland state income tax withheld',
  'form502.overpaid': 'Maryland overpaid (refund)',
  'form502.amountOwed': 'Maryland amount you owe',
}

/** Build traced values for the MD explainability graph */
function collectMDTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const f = result.detail as Form502Result
  const values = new Map<string, TracedValue>()

  const agiInputs = ['form1040.line11']
  if (f.ssSubtraction > 0) agiInputs.push('form502.ssSubtraction')

  if (f.ssSubtraction > 0) {
    values.set('form502.ssSubtraction', tracedFromComputation(
      f.ssSubtraction, 'form502.ssSubtraction', ['form1040.line6b'],
      'Social Security benefits (exempt from MD tax)',
    ))
  }

  values.set('form502.mdAGI', tracedFromComputation(
    f.mdAGI, 'form502.mdAGI', agiInputs, 'Maryland adjusted gross income',
  ))

  if (f.mdSourceIncome !== undefined) {
    values.set('form502.mdSourceIncome', tracedFromComputation(
      f.mdSourceIncome, 'form502.mdSourceIncome', ['form502.mdAGI'],
      `MD-source income (${Math.round(f.apportionmentRatio * 100)}% of MD AGI)`,
    ))
  }

  values.set('form502.mdDeduction', tracedFromComputation(
    f.deductionUsed, 'form502.mdDeduction', [],
    `MD ${f.deductionMethod} deduction`,
  ))

  values.set('form502.mdExemptions', tracedFromComputation(
    f.totalExemptions, 'form502.mdExemptions', [],
    `MD exemptions ($${Math.round(f.exemptionPerPerson / 100)} per person after phase-down)`,
  ))

  values.set('form502.mdTaxableIncome', tracedFromComputation(
    f.mdTaxableIncome, 'form502.mdTaxableIncome',
    ['form502.mdAGI', 'form502.mdDeduction', 'form502.mdExemptions'],
    'Maryland taxable income',
  ))

  values.set('form502.mdStateTax', tracedFromComputation(
    f.mdStateTax, 'form502.mdStateTax', ['form502.mdTaxableIncome'],
    'Maryland state income tax',
  ))

  const countyName = MD_COUNTIES[f.countyCode]?.name ?? f.countyCode
  values.set('form502.mdLocalTax', tracedFromComputation(
    f.mdLocalTax, 'form502.mdLocalTax', ['form502.mdTaxableIncome'],
    `${countyName} local tax (${(f.countyRate * 100).toFixed(2)}%)`,
  ))

  if (f.mdEIC > 0) {
    values.set('form502.mdEIC', tracedFromComputation(
      f.mdEIC, 'form502.mdEIC', [],
      'Maryland earned income credit',
    ))
  }

  const taxAfterInputs = ['form502.mdStateTax', 'form502.mdLocalTax']
  if (f.mdEIC > 0) taxAfterInputs.push('form502.mdEIC')
  values.set('form502.taxAfterCredits', tracedFromComputation(
    f.taxAfterCredits, 'form502.taxAfterCredits', taxAfterInputs,
    'Maryland total tax after credits',
  ))

  if (f.stateWithholding > 0) {
    values.set('form502.stateWithholding', tracedFromComputation(
      f.stateWithholding, 'form502.stateWithholding', [],
      'Maryland state income tax withheld',
    ))
  }

  const resultInputs = ['form502.taxAfterCredits']
  if (f.stateWithholding > 0) resultInputs.push('form502.stateWithholding')
  if (f.overpaid > 0) {
    values.set('form502.overpaid', tracedFromComputation(
      f.overpaid, 'form502.overpaid', resultInputs, 'Maryland refund',
    ))
  }
  if (f.amountOwed > 0) {
    values.set('form502.amountOwed', tracedFromComputation(
      f.amountOwed, 'form502.amountOwed', resultInputs, 'Maryland amount owed',
    ))
  }

  return values
}

/** Helper to safely extract Form502Result from StateComputeResult.detail */
function d(result: StateComputeResult): Form502Result {
  return result.detail as Form502Result
}

/** Config-driven review layout for the generic StateReviewPage */
const MD_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Your federal adjusted gross income from Form 1040 Line 11. This is the starting point for computing Maryland AGI.',
          pubName: 'Maryland Form 502 Instructions',
          pubUrl: 'https://www.marylandtaxes.gov/forms/current_forms/',
        },
      },
      {
        label: 'Social Security Subtraction',
        nodeId: 'form502.ssSubtraction',
        getValue: (r) => d(r).ssSubtraction,
        tooltip: {
          explanation: 'Maryland fully exempts Social Security benefits from state income tax. The taxable Social Security amount included in federal AGI is subtracted to arrive at Maryland AGI.',
          pubName: 'Maryland Form 502 Instructions — Subtractions',
          pubUrl: 'https://www.marylandtaxes.gov/forms/current_forms/',
        },
        showWhen: (r) => d(r).ssSubtraction > 0,
      },
      {
        label: 'Maryland AGI',
        nodeId: 'form502.mdAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Maryland AGI starts with federal AGI and subtracts items Maryland exempts from tax, including Social Security benefits. Most other federal adjustments conform to federal treatment.',
          pubName: 'Maryland Form 502 Instructions',
          pubUrl: 'https://www.marylandtaxes.gov/forms/current_forms/',
        },
      },
      {
        label: 'MD-Source Income',
        nodeId: 'form502.mdSourceIncome',
        getValue: (r) => d(r).mdSourceIncome ?? r.stateAGI,
        tooltip: {
          explanation: 'For part-year residents, this is the portion of your MD AGI allocated to Maryland based on the number of days you were a MD resident.',
          pubName: 'Maryland Residency Guidance',
          pubUrl: 'https://www.marylandtaxes.gov/individual/income/tax-info/',
        },
        showWhen: (r) => d(r).residencyType === 'part-year',
      },
    ],
  },
  {
    title: 'Deductions & Exemptions',
    items: [
      {
        label: 'MD Deduction',
        nodeId: 'form502.mdDeduction',
        getValue: (r) => d(r).deductionUsed,
        tooltip: {
          explanation: 'Maryland uses the larger of the flat standard deduction ($3,350 single / $6,700 MFJ for 2025) or MD-adjusted itemized deductions. State income tax cannot be deducted on the MD return.',
          pubName: 'Maryland Form 502 Instructions — Line 17',
          pubUrl: 'https://www.marylandtaxes.gov/forms/current_forms/',
        },
      },
      {
        label: 'MD Exemptions',
        nodeId: 'form502.mdExemptions',
        getValue: (r) => d(r).totalExemptions,
        tooltip: {
          explanation: '$3,200 per person (filer + dependents). Exemptions phase down with AGI: full at lower AGIs, then $1,600 → $800 → $0 at higher thresholds that vary by filing status.',
          pubName: 'Maryland Form 502 Instructions — Exemptions',
          pubUrl: 'https://www.marylandtaxes.gov/forms/current_forms/',
        },
      },
      {
        label: 'MD Taxable Income',
        nodeId: 'form502.mdTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: "Maryland taxable income is MD AGI minus deductions and exemptions. This is taxed using Maryland's 10-bracket progressive rate schedule (2% to 6.50% for 2025).",
          pubName: 'Maryland Tax Rate Schedules',
          pubUrl: 'https://www.marylandtaxes.gov/individual/income/tax-info/tax-rates.php',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'MD State Tax',
        nodeId: 'form502.mdStateTax',
        getValue: (r) => d(r).mdStateTax,
        tooltip: {
          explanation: 'Maryland state income tax computed from the 10-bracket rate schedule (2% to 6.50% for 2025). Two new top brackets (6.25% and 6.50%) were added by HB350.',
          pubName: 'Maryland Tax Rate Schedules',
          pubUrl: 'https://www.marylandtaxes.gov/individual/income/tax-info/tax-rates.php',
        },
      },
      {
        label: 'MD Local Tax',
        nodeId: 'form502.mdLocalTax',
        getValue: (r) => d(r).mdLocalTax,
        tooltip: {
          explanation: 'County/city local income tax applied to MD taxable income. Rate varies by jurisdiction (2.25% to 3.20%). The rate is determined by your county of residence.',
          pubName: 'Maryland Local Tax Rates',
          pubUrl: 'https://www.marylandtaxes.gov/individual/income/tax-info/local-tax-rates.php',
        },
      },
      {
        label: 'MD Earned Income Credit',
        nodeId: 'form502.mdEIC',
        getValue: (r) => d(r).mdEIC,
        tooltip: {
          explanation: 'Maryland EIC equals 45% of federal EIC for filers with qualifying children, or 100% of federal EIC for filers without qualifying children.',
          pubName: 'Maryland Form 502 Instructions — Line 43',
          pubUrl: 'https://www.marylandtaxes.gov/forms/current_forms/',
        },
        showWhen: (r) => d(r).mdEIC > 0,
      },
      {
        label: 'MD Tax After Credits',
        nodeId: 'form502.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Maryland tax after subtracting credits (including EIC). This is state tax plus local tax minus credits, compared against withholding to determine refund or amount owed.',
          pubName: 'Maryland Form 502 Instructions',
          pubUrl: 'https://www.marylandtaxes.gov/forms/current_forms/',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'MD State Withholding',
        nodeId: 'form502.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Maryland state income tax withheld from your W-2(s) Box 17. This is tax you already paid to the Comptroller through payroll withholding during the year.',
          pubName: 'Maryland Form 502 Instructions — Line 40',
          pubUrl: 'https://www.marylandtaxes.gov/forms/current_forms/',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const MD_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'MD Refund',
    nodeId: 'form502.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'MD Amount You Owe',
    nodeId: 'form502.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'MD tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
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

/** Extract Form502Result from a MD StateComputeResult */
export function extractForm502(result: StateComputeResult): Form502Result {
  return result.detail as Form502Result
}
