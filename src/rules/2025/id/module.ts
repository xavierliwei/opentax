/** ID state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeForm40, type Form40Result } from './form40'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: Form40Result): StateComputeResult {
  return {
    stateCode: 'ID',
    formLabel: 'ID Form 40',
    residencyType: form.residencyType,
    stateAGI: form.idTaxableIncome, // ID starts from federal taxable income, no separate "AGI"
    stateTaxableIncome: form.idTaxableIncome,
    stateTax: form.idTax,
    stateCredits: form.totalNonrefundableCredits + form.totalRefundableCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const ID_NODE_LABELS: Record<string, string> = {
  'form40.federalTaxableIncome': 'Federal taxable income (Form 1040 Line 15)',
  'form40.idAdditions': 'Idaho additions',
  'form40.idSubtractions': 'Idaho subtractions',
  'form40.idTaxableIncome': 'Idaho taxable income',
  'form40.idTax': 'Idaho income tax (5.695%)',
  'form40.idChildTaxCredit': 'Idaho child tax credit',
  'form40.groceryCredit': 'Idaho grocery credit',
  'form40.taxAfterCredits': 'ID tax after credits',
  'form40.stateWithholding': 'ID state income tax withheld',
  'form40.overpaid': 'ID overpaid (refund)',
  'form40.amountOwed': 'ID amount you owe',
}

function collectIDTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as Form40Result
  const values = new Map<string, TracedValue>()

  // Federal taxable income
  values.set('form40.federalTaxableIncome', tracedFromComputation(
    form.federalTaxableIncome,
    'form40.federalTaxableIncome',
    ['form1040.line15'],
    'Federal taxable income (Form 1040 Line 15)',
  ))

  // Additions
  if (form.idAdditions > 0) {
    values.set('form40.idAdditions', tracedFromComputation(
      form.idAdditions, 'form40.idAdditions', [],
      'Idaho additions (state/local tax refund add-back)',
    ))
  }

  // Subtractions
  if (form.idSubtractions > 0) {
    values.set('form40.idSubtractions', tracedFromComputation(
      form.idSubtractions, 'form40.idSubtractions', [],
      'Idaho subtractions (US gov interest, Social Security exemption)',
    ))
  }

  // Taxable income
  const taxableInputs = ['form40.federalTaxableIncome']
  if (form.idAdditions > 0) taxableInputs.push('form40.idAdditions')
  if (form.idSubtractions > 0) taxableInputs.push('form40.idSubtractions')
  values.set('form40.idTaxableIncome', tracedFromComputation(
    form.idTaxableIncome,
    'form40.idTaxableIncome',
    taxableInputs,
    'Idaho taxable income (federal taxable income + additions - subtractions)',
  ))

  // Tax
  values.set('form40.idTax', tracedFromComputation(
    form.idTax,
    'form40.idTax',
    ['form40.idTaxableIncome'],
    'Idaho income tax (5.695% flat rate)',
  ))

  // Credits
  const creditInputs: string[] = []
  if (form.idChildTaxCredit > 0) {
    values.set('form40.idChildTaxCredit', tracedFromComputation(
      form.idChildTaxCredit,
      'form40.idChildTaxCredit',
      [],
      'Idaho child tax credit ($205 per qualifying child)',
    ))
    creditInputs.push('form40.idChildTaxCredit')
  }

  if (form.groceryCredit > 0) {
    values.set('form40.groceryCredit', tracedFromComputation(
      form.groceryCredit,
      'form40.groceryCredit',
      [],
      'Idaho grocery credit ($100/person, $120 if 65+)',
    ))
    creditInputs.push('form40.groceryCredit')
  }

  // Tax after credits
  const taxAfterInputs = ['form40.idTax']
  if (creditInputs.length > 0) taxAfterInputs.push(...creditInputs)
  values.set('form40.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'form40.taxAfterCredits',
    taxAfterInputs,
    'ID tax after credits',
  ))

  // Withholding
  if (form.stateWithholding > 0) {
    values.set('form40.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'form40.stateWithholding',
      [],
      'ID state income tax withheld',
    ))
  }

  // Result
  const resultInputs = ['form40.taxAfterCredits']
  if (form.stateWithholding > 0) resultInputs.push('form40.stateWithholding')
  if (form.groceryCredit > 0) resultInputs.push('form40.groceryCredit')

  if (form.overpaid > 0) {
    values.set('form40.overpaid', tracedFromComputation(
      form.overpaid,
      'form40.overpaid',
      resultInputs,
      'ID overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('form40.amountOwed', tracedFromComputation(
      form.amountOwed,
      'form40.amountOwed',
      resultInputs,
      'ID amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): Form40Result {
  return result.detail as Form40Result
}

const ID_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal Taxable Income',
        nodeId: 'form1040.line15',
        getValue: (r) => d(r).federalTaxableIncome,
        tooltip: {
          explanation: 'Idaho starts from your federal taxable income on Form 1040 Line 15. This already includes the federal standard or itemized deduction.',
          pubName: 'ID Form 40 Instructions',
          pubUrl: 'https://tax.idaho.gov/forms/individual-income-tax/',
        },
      },
      {
        label: 'ID Additions',
        nodeId: 'form40.idAdditions',
        getValue: (r) => d(r).idAdditions,
        showWhen: (r) => d(r).idAdditions > 0,
        tooltip: {
          explanation: 'Idaho additions include state/local income tax refund add-back if you itemized deductions last year.',
          pubName: 'ID Form 40 Instructions',
          pubUrl: 'https://tax.idaho.gov/forms/individual-income-tax/',
        },
      },
      {
        label: 'ID Subtractions',
        nodeId: 'form40.idSubtractions',
        getValue: (r) => d(r).idSubtractions,
        showWhen: (r) => d(r).idSubtractions > 0,
        tooltip: {
          explanation: 'Idaho subtractions include US government obligation interest and the Idaho Social Security benefits exemption.',
          pubName: 'ID Form 40 Instructions',
          pubUrl: 'https://tax.idaho.gov/forms/individual-income-tax/',
        },
      },
      {
        label: 'ID Taxable Income',
        nodeId: 'form40.idTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'Idaho taxable income: federal taxable income + additions - subtractions.',
          pubName: 'ID Form 40 Instructions',
          pubUrl: 'https://tax.idaho.gov/forms/individual-income-tax/',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'ID Tax (5.695%)',
        nodeId: 'form40.idTax',
        getValue: (r) => d(r).idTax,
        tooltip: {
          explanation: 'Idaho applies a flat 5.695% tax rate to Idaho taxable income.',
          pubName: 'ID Form 40 Instructions',
          pubUrl: 'https://tax.idaho.gov/forms/individual-income-tax/',
        },
      },
      {
        label: 'ID Child Tax Credit',
        nodeId: 'form40.idChildTaxCredit',
        getValue: (r) => d(r).idChildTaxCredit,
        showWhen: (r) => d(r).idChildTaxCredit > 0,
        tooltip: {
          explanation: 'Idaho child tax credit: $205 per qualifying child. Nonrefundable credit that reduces tax owed.',
          pubName: 'ID Form 40 Instructions',
          pubUrl: 'https://tax.idaho.gov/forms/individual-income-tax/',
        },
      },
      {
        label: 'Grocery Credit',
        nodeId: 'form40.groceryCredit',
        getValue: (r) => d(r).groceryCredit,
        showWhen: (r) => d(r).groceryCredit > 0,
        tooltip: {
          explanation: 'Idaho grocery credit: $100 per person ($120 if age 65+). This is a refundable credit available to all Idaho taxpayers.',
          pubName: 'ID Form 40 Instructions',
          pubUrl: 'https://tax.idaho.gov/forms/individual-income-tax/',
        },
      },
      {
        label: 'ID Tax After Credits',
        nodeId: 'form40.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net Idaho income tax after nonrefundable credits (child tax credit). The grocery credit is refundable and applied as a payment.',
          pubName: 'ID Form 40 Instructions',
          pubUrl: 'https://tax.idaho.gov/forms/individual-income-tax/',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'ID State Withholding',
        nodeId: 'form40.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Idaho tax withheld from W-2 Box 17 entries for ID.',
          pubName: 'ID Form 40 Instructions',
          pubUrl: 'https://tax.idaho.gov/forms/individual-income-tax/',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const ID_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'ID Refund',
    nodeId: 'form40.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'ID Amount You Owe',
    nodeId: 'form40.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'ID tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const idModule: StateRulesModule = {
  stateCode: 'ID',
  stateName: 'Idaho',
  formLabel: 'ID Form 40',
  sidebarLabel: 'ID Form 40',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeForm40(model, federal, config))
  },
  nodeLabels: ID_NODE_LABELS,
  collectTracedValues: collectIDTracedValues,
  reviewLayout: ID_REVIEW_LAYOUT,
  reviewResultLines: ID_REVIEW_RESULT_LINES,
}
