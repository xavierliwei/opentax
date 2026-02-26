/** Indiana state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeIT40, type IT40Result } from './it40'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(it40: IT40Result): StateComputeResult {
  return {
    stateCode: 'IN',
    formLabel: 'IN Form IT-40',
    residencyType: it40.residencyType,
    stateAGI: it40.inAGI,
    stateTaxableIncome: it40.inTaxableIncome,
    stateTax: it40.inTax + it40.countyTax,
    stateCredits: it40.totalCredits,
    taxAfterCredits: it40.taxAfterCredits,
    stateWithholding: it40.stateWithholding + it40.countyWithholding,
    overpaid: it40.overpaid,
    amountOwed: it40.amountOwed,
    apportionmentRatio: it40.apportionmentRatio,
    detail: it40,
  }
}

const IN_NODE_LABELS: Record<string, string> = {
  'it40.federalAGI': 'Federal AGI (IT-40 starting point)',
  'it40.totalAdditions': 'IN additions to income',
  'it40.inAGI': 'Indiana adjusted gross income',
  'it40.totalExemptions': 'Indiana exemptions',
  'it40.totalSubtractions': 'Indiana total subtractions',
  'it40.inTaxableIncome': 'Indiana taxable income',
  'it40.inTax': 'Indiana state income tax (3.05%)',
  'it40.countyTax': 'Indiana county income tax',
  'it40.inEITC': 'Indiana earned income credit',
  'it40.elderlyCreditAmount': 'Unified tax credit for the elderly',
  'it40.totalCredits': 'IN total credits',
  'it40.taxAfterCredits': 'IN tax after credits',
  'it40.stateWithholding': 'IN state income tax withheld',
  'it40.countyWithholding': 'IN county income tax withheld',
  'it40.overpaid': 'IN overpaid (refund)',
  'it40.amountOwed': 'IN amount you owe',
}

function collectINTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const it40 = result.detail as IT40Result
  const values = new Map<string, TracedValue>()

  // Additions
  if (it40.totalAdditions > 0) {
    values.set('it40.totalAdditions', tracedFromComputation(
      it40.totalAdditions, 'it40.totalAdditions', [],
      'IN additions (SALT add-back)',
    ))
  }

  // Indiana AGI
  const inAGIInputs = ['form1040.line11']
  if (it40.totalAdditions > 0) inAGIInputs.push('it40.totalAdditions')
  values.set('it40.inAGI', tracedFromComputation(
    it40.inAGI,
    'it40.inAGI',
    inAGIInputs,
    'Indiana adjusted gross income',
  ))

  // Exemptions
  values.set('it40.totalExemptions', tracedFromComputation(
    it40.totalExemptions,
    'it40.totalExemptions',
    [],
    'Indiana exemptions ($1,000/person + $1,500/dependent + age 65+ / blind)',
  ))

  // Subtractions
  const subInputs = ['it40.totalExemptions']
  if (it40.ssExemption > 0) subInputs.push('form1040.line6b')
  values.set('it40.totalSubtractions', tracedFromComputation(
    it40.totalSubtractions,
    'it40.totalSubtractions',
    subInputs,
    'Indiana total subtractions (exemptions + SS + US gov interest)',
  ))

  // Taxable income
  values.set('it40.inTaxableIncome', tracedFromComputation(
    it40.inTaxableIncome,
    'it40.inTaxableIncome',
    ['it40.inAGI', 'it40.totalSubtractions'],
    'Indiana taxable income',
  ))

  // State tax
  values.set('it40.inTax', tracedFromComputation(
    it40.inTax,
    'it40.inTax',
    ['it40.inTaxableIncome'],
    'Indiana state income tax (3.05%)',
  ))

  // County tax
  if (it40.countyTax > 0) {
    values.set('it40.countyTax', tracedFromComputation(
      it40.countyTax,
      'it40.countyTax',
      ['it40.inTaxableIncome'],
      'Indiana county income tax',
    ))
  }

  // Credits
  if (it40.inEITC > 0) {
    values.set('it40.inEITC', tracedFromComputation(
      it40.inEITC,
      'it40.inEITC',
      [],
      'Indiana earned income credit (10% of federal EITC)',
    ))
  }

  if (it40.elderlyCreditAmount > 0) {
    values.set('it40.elderlyCreditAmount', tracedFromComputation(
      it40.elderlyCreditAmount,
      'it40.elderlyCreditAmount',
      [],
      'Unified tax credit for the elderly',
    ))
  }

  if (it40.totalCredits > 0) {
    const creditInputs: string[] = []
    if (it40.inEITC > 0) creditInputs.push('it40.inEITC')
    if (it40.elderlyCreditAmount > 0) creditInputs.push('it40.elderlyCreditAmount')
    values.set('it40.totalCredits', tracedFromComputation(
      it40.totalCredits,
      'it40.totalCredits',
      creditInputs,
      'IN total credits',
    ))
  }

  // Tax after credits
  const taxAfterInputs = ['it40.inTax']
  if (it40.countyTax > 0) taxAfterInputs.push('it40.countyTax')
  if (it40.totalCredits > 0) taxAfterInputs.push('it40.totalCredits')
  values.set('it40.taxAfterCredits', tracedFromComputation(
    it40.taxAfterCredits,
    'it40.taxAfterCredits',
    taxAfterInputs,
    'IN tax after credits',
  ))

  // Withholding
  if (it40.stateWithholding > 0) {
    values.set('it40.stateWithholding', tracedFromComputation(
      it40.stateWithholding,
      'it40.stateWithholding',
      [],
      'IN state income tax withheld',
    ))
  }

  if (it40.countyWithholding > 0) {
    values.set('it40.countyWithholding', tracedFromComputation(
      it40.countyWithholding,
      'it40.countyWithholding',
      [],
      'IN county income tax withheld',
    ))
  }

  // Result
  const resultInputs = ['it40.taxAfterCredits']
  if (it40.stateWithholding > 0) resultInputs.push('it40.stateWithholding')
  if (it40.countyWithholding > 0) resultInputs.push('it40.countyWithholding')

  if (it40.overpaid > 0) {
    values.set('it40.overpaid', tracedFromComputation(
      it40.overpaid,
      'it40.overpaid',
      resultInputs,
      'IN overpaid (refund)',
    ))
  }

  if (it40.amountOwed > 0) {
    values.set('it40.amountOwed', tracedFromComputation(
      it40.amountOwed,
      'it40.amountOwed',
      resultInputs,
      'IN amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): IT40Result {
  return result.detail as IT40Result
}

const IN_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'Indiana starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'IN IT-40 Instructions',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
      {
        label: 'IN Additions',
        nodeId: 'it40.totalAdditions',
        getValue: (r) => d(r).totalAdditions,
        showWhen: (r) => d(r).totalAdditions > 0,
        tooltip: {
          explanation: 'Indiana additions to federal AGI, including state/local income tax add-back when itemizing federally.',
          pubName: 'IN IT-40 Schedule 1',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
      {
        label: 'Indiana AGI',
        nodeId: 'it40.inAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'Indiana adjusted gross income: Federal AGI plus Indiana additions.',
          pubName: 'IN IT-40 Line 1',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
    ],
  },
  {
    title: 'Exemptions & Subtractions',
    items: [
      {
        label: 'Personal/Dependent Exemptions',
        nodeId: 'it40.totalExemptions',
        getValue: (r) => d(r).totalExemptions,
        tooltip: {
          explanation: 'Indiana personal exemptions: $1,000 per taxpayer/spouse, $1,500 per dependent, plus $1,000 for age 65+ and $1,000 for blind.',
          pubName: 'IN IT-40 Instructions',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
      {
        label: 'Social Security Exemption',
        nodeId: 'it40.ssExemption',
        getValue: (r) => d(r).ssExemption,
        showWhen: (r) => d(r).ssExemption > 0,
        tooltip: {
          explanation: 'Indiana fully exempts Social Security benefits from state income tax.',
          pubName: 'IN IT-40 Schedule 2',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
      {
        label: 'US Gov Interest Subtraction',
        nodeId: 'it40.usGovInterest',
        getValue: (r) => d(r).usGovInterest,
        showWhen: (r) => d(r).usGovInterest > 0,
        tooltip: {
          explanation: 'Interest on US government obligations (Treasury bonds, I-bonds) is exempt from Indiana income tax.',
          pubName: 'IN IT-40 Schedule 2',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
      {
        label: 'IN Taxable Income',
        nodeId: 'it40.inTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Indiana taxable income equals Indiana AGI minus all exemptions and subtractions.',
          pubName: 'IN IT-40 Line 7',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'IN State Tax (3.05%)',
        nodeId: 'it40.inTax',
        getValue: (r) => d(r).inTax,
        tooltip: {
          explanation: 'Indiana applies a flat 3.05% tax rate to taxable income.',
          pubName: 'IN IT-40 Line 8',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
      {
        label: 'County Tax',
        nodeId: 'it40.countyTax',
        getValue: (r) => d(r).countyTax,
        showWhen: (r) => d(r).countyTax > 0,
        tooltip: {
          explanation: 'Indiana county income tax is filed on the IT-40. County rates vary by county (0.5%–3.38%).',
          pubName: 'IN IT-40 Schedule CT-40',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
      {
        label: 'IN Earned Income Credit',
        nodeId: 'it40.inEITC',
        getValue: (r) => d(r).inEITC,
        showWhen: (r) => d(r).inEITC > 0,
        tooltip: {
          explanation: 'Indiana earned income credit equals 10% of the federal EITC.',
          pubName: 'IN IT-40 Schedule 6',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
      {
        label: 'Elderly Credit',
        nodeId: 'it40.elderlyCreditAmount',
        getValue: (r) => d(r).elderlyCreditAmount,
        showWhen: (r) => d(r).elderlyCreditAmount > 0,
        tooltip: {
          explanation: 'Unified tax credit for the elderly: $100 single / $200 MFJ if age 65+ and Indiana AGI <= $10,000.',
          pubName: 'IN IT-40 Schedule 6',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
      {
        label: 'IN Tax After Credits',
        nodeId: 'it40.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Total Indiana tax (state + county) minus credits.',
          pubName: 'IN IT-40 Instructions',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'IN State Withholding',
        nodeId: 'it40.stateWithholding',
        getValue: (r) => d(r).stateWithholding,
        tooltip: {
          explanation: 'Indiana state tax withheld from W-2 Box 17 entries for IN.',
          pubName: 'IN IT-40 Instructions',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
        showWhen: (r) => d(r).stateWithholding > 0,
      },
      {
        label: 'County Withholding',
        nodeId: 'it40.countyWithholding',
        getValue: (r) => d(r).countyWithholding,
        tooltip: {
          explanation: 'Indiana county tax withheld from W-2 Box 19 entries for IN.',
          pubName: 'IN IT-40 Instructions',
          pubUrl: 'https://www.in.gov/dor/tax-forms/individual-income-tax-forms/',
        },
        showWhen: (r) => d(r).countyWithholding > 0,
      },
    ],
  },
]

const IN_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'IN Refund',
    nodeId: 'it40.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'IN Amount You Owe',
    nodeId: 'it40.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'IN tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const inModule: StateRulesModule = {
  stateCode: 'IN',
  stateName: 'Indiana',
  formLabel: 'IN Form IT-40',
  sidebarLabel: 'IN Form IT-40',

  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeIT40(model, federal, config))
  },

  nodeLabels: IN_NODE_LABELS,
  collectTracedValues: collectINTracedValues,
  reviewLayout: IN_REVIEW_LAYOUT,
  reviewResultLines: IN_REVIEW_RESULT_LINES,
}
