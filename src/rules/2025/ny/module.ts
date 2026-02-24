/** NY state module */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import { computeFormIT201, type FormIT201Result } from './formIT201'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

function toStateResult(form: FormIT201Result): StateComputeResult {
  return {
    stateCode: 'NY',
    formLabel: 'NY Form IT-201',
    residencyType: form.residencyType,
    stateAGI: form.nyAGI,
    stateTaxableIncome: form.nyTaxableIncome,
    stateTax: form.nyTax,
    stateCredits: form.totalCredits,
    taxAfterCredits: form.taxAfterCredits,
    stateWithholding: form.stateWithholding,
    overpaid: form.overpaid,
    amountOwed: form.amountOwed,
    apportionmentRatio: form.apportionmentRatio,
    detail: form,
  }
}

const NY_NODE_LABELS: Record<string, string> = {
  'it201.nyAdditions': 'NY additions to federal AGI',
  'it201.nySubtractions': 'NY subtractions from federal AGI',
  'it201.nyAGI': 'New York adjusted gross income',
  'it201.deductionUsed': 'NY deduction (standard or itemized)',
  'it201.dependentExemption': 'NY dependent exemption',
  'it201.nyTaxableIncome': 'New York taxable income',
  'it201.nyTax': 'New York income tax',
  'it201.nyEITC': 'NY Earned Income Tax Credit',
  'it201.taxAfterCredits': 'NY tax after credits',
  'it201.stateWithholding': 'NY state income tax withheld',
  'it201.overpaid': 'NY overpaid (refund)',
  'it201.amountOwed': 'NY amount you owe',
}

function collectNYTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const form = result.detail as FormIT201Result
  const values = new Map<string, TracedValue>()

  const nyAGIInputs = ['form1040.line11']
  if (form.nyAdditions > 0) {
    nyAGIInputs.push('it201.nyAdditions')
    values.set('it201.nyAdditions', tracedFromComputation(
      form.nyAdditions, 'it201.nyAdditions', [],
      'NY additions to federal AGI',
    ))
  }
  if (form.nySubtractions > 0) {
    nyAGIInputs.push('it201.nySubtractions')
    values.set('it201.nySubtractions', tracedFromComputation(
      form.nySubtractions, 'it201.nySubtractions', [],
      'NY subtractions (SS exemption, US gov interest)',
    ))
  }

  values.set('it201.nyAGI', tracedFromComputation(
    form.nyAGI,
    'it201.nyAGI',
    nyAGIInputs,
    'New York adjusted gross income',
  ))

  values.set('it201.deductionUsed', tracedFromComputation(
    form.deductionUsed,
    'it201.deductionUsed',
    [],
    `NY ${form.deductionMethod} deduction`,
  ))

  if (form.dependentExemption > 0) {
    values.set('it201.dependentExemption', tracedFromComputation(
      form.dependentExemption,
      'it201.dependentExemption',
      [],
      'NY dependent exemption',
    ))
  }

  const taxableInputs = ['it201.nyAGI', 'it201.deductionUsed']
  if (form.dependentExemption > 0) taxableInputs.push('it201.dependentExemption')
  values.set('it201.nyTaxableIncome', tracedFromComputation(
    form.nyTaxableIncome,
    'it201.nyTaxableIncome',
    taxableInputs,
    'New York taxable income',
  ))

  values.set('it201.nyTax', tracedFromComputation(
    form.nyTax,
    'it201.nyTax',
    ['it201.nyTaxableIncome'],
    'New York income tax',
  ))

  const taxAfterInputs = ['it201.nyTax']
  if (form.nyEITC > 0) {
    values.set('it201.nyEITC', tracedFromComputation(
      form.nyEITC,
      'it201.nyEITC',
      [],
      'NY Earned Income Tax Credit (30% of federal EITC)',
    ))
    taxAfterInputs.push('it201.nyEITC')
  }

  values.set('it201.taxAfterCredits', tracedFromComputation(
    form.taxAfterCredits,
    'it201.taxAfterCredits',
    taxAfterInputs,
    'NY tax after credits',
  ))

  if (form.stateWithholding > 0) {
    values.set('it201.stateWithholding', tracedFromComputation(
      form.stateWithholding,
      'it201.stateWithholding',
      [],
      'NY state income tax withheld',
    ))
  }

  if (form.overpaid > 0) {
    values.set('it201.overpaid', tracedFromComputation(
      form.overpaid,
      'it201.overpaid',
      ['it201.taxAfterCredits', 'it201.stateWithholding'],
      'NY overpaid (refund)',
    ))
  }

  if (form.amountOwed > 0) {
    values.set('it201.amountOwed', tracedFromComputation(
      form.amountOwed,
      'it201.amountOwed',
      ['it201.taxAfterCredits', 'it201.stateWithholding'],
      'NY amount you owe',
    ))
  }

  return values
}

function d(result: StateComputeResult): FormIT201Result {
  return result.detail as FormIT201Result
}

const NY_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      {
        label: 'Federal AGI',
        nodeId: 'form1040.line11',
        getValue: (r) => d(r).federalAGI,
        tooltip: {
          explanation: 'New York starts from your federal adjusted gross income on Form 1040 Line 11.',
          pubName: 'NY IT-201 Instructions',
          pubUrl: 'https://www.tax.ny.gov/forms/income-cur-forms.htm',
        },
      },
      {
        label: 'NY Additions',
        nodeId: 'it201.nyAdditions',
        getValue: (r) => d(r).nyAdditions,
        showWhen: (r) => d(r).nyAdditions > 0,
        tooltip: {
          explanation: 'NY additions to federal AGI for items where NY does not conform to federal treatment.',
          pubName: 'NY IT-201 Instructions',
          pubUrl: 'https://www.tax.ny.gov/forms/income-cur-forms.htm',
        },
      },
      {
        label: 'NY Subtractions',
        nodeId: 'it201.nySubtractions',
        getValue: (r) => d(r).nySubtractions,
        showWhen: (r) => d(r).nySubtractions > 0,
        tooltip: {
          explanation: 'NY subtractions include Social Security exemption (NY fully exempts SS) and US government obligation interest.',
          pubName: 'NY IT-201 Instructions',
          pubUrl: 'https://www.tax.ny.gov/forms/income-cur-forms.htm',
        },
      },
      {
        label: 'NY AGI',
        nodeId: 'it201.nyAGI',
        getValue: (r) => r.stateAGI,
        tooltip: {
          explanation: 'New York adjusted gross income: Federal AGI + NY additions − NY subtractions.',
          pubName: 'NY IT-201 Instructions',
          pubUrl: 'https://www.tax.ny.gov/forms/income-cur-forms.htm',
        },
      },
    ],
  },
  {
    title: 'Deductions',
    items: [
      {
        label: 'NY Deduction',
        nodeId: 'it201.deductionUsed',
        getValue: (r) => d(r).deductionUsed,
        tooltip: {
          explanation: 'NY standard deduction or NY itemized deduction, whichever is larger. NY itemized deductions follow federal Schedule A but remove the federal $10K SALT cap.',
          pubName: 'NY IT-201 Instructions',
          pubUrl: 'https://www.tax.ny.gov/forms/income-cur-forms.htm',
        },
      },
      {
        label: 'Dependent Exemption',
        nodeId: 'it201.dependentExemption',
        getValue: (r) => d(r).dependentExemption,
        showWhen: (r) => d(r).dependentExemption > 0,
        tooltip: {
          explanation: 'NY allows a $1,000 exemption for each dependent claimed on the federal return.',
          pubName: 'NY IT-201 Instructions',
          pubUrl: 'https://www.tax.ny.gov/forms/income-cur-forms.htm',
        },
      },
      {
        label: 'NY Taxable Income',
        nodeId: 'it201.nyTaxableIncome',
        getValue: (r) => r.stateTaxableIncome,
        tooltip: {
          explanation: 'New York taxable income equals NY AGI minus the deduction and dependent exemptions.',
          pubName: 'NY IT-201 Instructions',
          pubUrl: 'https://www.tax.ny.gov/forms/income-cur-forms.htm',
        },
      },
    ],
  },
  {
    title: 'Tax & Credits',
    items: [
      {
        label: 'NY Tax',
        nodeId: 'it201.nyTax',
        getValue: (r) => d(r).nyTax,
        tooltip: {
          explanation: 'New York income tax computed using the progressive rate schedule (4% to 10.9%).',
          pubName: 'NY IT-201 Instructions',
          pubUrl: 'https://www.tax.ny.gov/forms/income-cur-forms.htm',
        },
      },
      {
        label: 'NY EITC',
        nodeId: 'it201.nyEITC',
        getValue: (r) => d(r).nyEITC,
        showWhen: (r) => d(r).nyEITC > 0,
        tooltip: {
          explanation: 'New York Earned Income Tax Credit equals 30% of the federal earned income credit.',
          pubName: 'NY IT-201 Instructions',
          pubUrl: 'https://www.tax.ny.gov/forms/income-cur-forms.htm',
        },
      },
      {
        label: 'NY Tax After Credits',
        nodeId: 'it201.taxAfterCredits',
        getValue: (r) => r.taxAfterCredits,
        tooltip: {
          explanation: 'Net New York income tax after all credits.',
          pubName: 'NY IT-201 Instructions',
          pubUrl: 'https://www.tax.ny.gov/forms/income-cur-forms.htm',
        },
      },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      {
        label: 'NY State Withholding',
        nodeId: 'it201.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'New York tax withheld from W-2 Box 17 entries for NY.',
          pubName: 'NY IT-201 Instructions',
          pubUrl: 'https://www.tax.ny.gov/forms/income-cur-forms.htm',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const NY_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'NY Refund',
    nodeId: 'it201.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'owed',
    label: 'NY Amount You Owe',
    nodeId: 'it201.amountOwed',
    getValue: (r) => r.amountOwed,
    showWhen: (r) => r.amountOwed > 0,
  },
  {
    type: 'zero',
    label: 'NY tax balance',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0,
  },
]

export const nyModule: StateRulesModule = {
  stateCode: 'NY',
  stateName: 'New York',
  formLabel: 'NY Form IT-201',
  sidebarLabel: 'NY Form IT-201',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormIT201(model, federal, config))
  },
  nodeLabels: NY_NODE_LABELS,
  collectTracedValues: collectNYTracedValues,
  reviewLayout: NY_REVIEW_LAYOUT,
  reviewResultLines: NY_REVIEW_RESULT_LINES,
}
