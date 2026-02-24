import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import type { StateComputeResult, StateRulesModule, StateReviewResultLine, StateReviewSection } from '../../stateEngine'
import { computeFormCT1040, type FormCT1040Result } from './formCT1040'

function toStateResult(ct: FormCT1040Result): StateComputeResult {
  return {
    stateCode: 'CT',
    formLabel: 'CT Form CT-1040',
    residencyType: ct.residencyType,
    stateAGI: ct.ctAGI,
    stateTaxableIncome: ct.ctTaxableIncome,
    stateTax: ct.ctIncomeTax,
    stateCredits: ct.totalNonrefundableCredits + ct.totalRefundableCredits,
    taxAfterCredits: ct.taxAfterCredits,
    stateWithholding: ct.stateWithholding,
    overpaid: ct.overpaid,
    amountOwed: ct.amountOwed,
    detail: ct,
  }
}

const CT_NODE_LABELS: Record<string, string> = {
  'scheduleCT1.subtractions': 'CT Schedule 1 subtractions',
  'formCT1040.ctAGI': 'Connecticut AGI',
  'formCT1040.personalExemption': 'CT personal exemption',
  'formCT1040.ctTaxableIncome': 'CT taxable income',
  'formCT1040.bracketTax': 'CT tax from brackets (Table B)',
  'formCT1040.tableCAddBack': 'CT 2% rate phase-out add-back (Table C)',
  'formCT1040.tableDRecapture': 'CT benefit recapture (Table D)',
  'formCT1040.ctIncomeTax': 'CT income tax',
  'formCT1040.propertyTaxCredit': 'CT property tax credit',
  'formCT1040.ctEITC': 'CT Earned Income Tax Credit',
  'formCT1040.taxAfterCredits': 'CT tax after credits',
  'formCT1040.stateWithholding': 'CT withholding',
  'formCT1040.overpaid': 'CT refund',
  'formCT1040.amountOwed': 'CT amount owed',
}

function collectCTTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const r = result.detail as FormCT1040Result
  const values = new Map<string, TracedValue>()
  values.set('formCT1040.ctAGI', tracedFromComputation(r.ctAGI, 'formCT1040.ctAGI', ['form1040.line11', 'scheduleCT1.subtractions'], 'Connecticut AGI'))
  if (r.ctSchedule1.subtractions > 0) values.set('scheduleCT1.subtractions', tracedFromComputation(r.ctSchedule1.subtractions, 'scheduleCT1.subtractions', [], 'CT Schedule 1 subtractions'))
  values.set('formCT1040.personalExemption', tracedFromComputation(r.effectiveExemption, 'formCT1040.personalExemption', ['formCT1040.ctAGI'], 'CT personal exemption'))
  values.set('formCT1040.ctTaxableIncome', tracedFromComputation(r.ctTaxableIncome, 'formCT1040.ctTaxableIncome', ['formCT1040.ctAGI', 'formCT1040.personalExemption'], 'CT taxable income'))
  values.set('formCT1040.bracketTax', tracedFromComputation(r.bracketTax, 'formCT1040.bracketTax', ['formCT1040.ctTaxableIncome'], 'CT tax from brackets (Table B)'))
  values.set('formCT1040.tableCAddBack', tracedFromComputation(r.tableC_addBack, 'formCT1040.tableCAddBack', ['formCT1040.ctAGI'], 'CT 2% rate phase-out add-back (Table C)'))
  values.set('formCT1040.tableDRecapture', tracedFromComputation(r.tableD_recapture, 'formCT1040.tableDRecapture', ['formCT1040.ctAGI'], 'CT benefit recapture (Table D)'))
  values.set('formCT1040.ctIncomeTax', tracedFromComputation(r.ctIncomeTax, 'formCT1040.ctIncomeTax', ['formCT1040.bracketTax', 'formCT1040.tableCAddBack', 'formCT1040.tableDRecapture'], 'CT income tax'))
  return values
}

function d(result: StateComputeResult): FormCT1040Result { return result.detail as FormCT1040Result }

const CT_REVIEW_LAYOUT: StateReviewSection[] = [
  { title: 'Income', items: [
    { label: 'CT AGI', nodeId: 'formCT1040.ctAGI', getValue: (r) => d(r).ctAGI, tooltip: { explanation: 'Federal AGI with CT Schedule 1 adjustments.', pubName: 'CT-1040 Instructions', pubUrl: 'https://portal.ct.gov/drs/forms/ct-1040' } },
    { label: 'Personal exemption (Table A)', nodeId: 'formCT1040.personalExemption', getValue: (r) => d(r).effectiveExemption, tooltip: { explanation: 'CT has no standard deduction; personal exemption phases out with AGI.', pubName: 'CT-1040 TCS Table A', pubUrl: 'https://portal.ct.gov/drs/forms/ct-1040' } },
    { label: 'CT taxable income', nodeId: 'formCT1040.ctTaxableIncome', getValue: (r) => d(r).ctTaxableIncome, tooltip: { explanation: 'CT AGI minus personal exemption.', pubName: 'CT-1040', pubUrl: 'https://portal.ct.gov/drs/forms/ct-1040' } },
  ] },
  { title: 'Tax & Credits', items: [
    { label: 'Tax from brackets (Table B)', nodeId: 'formCT1040.bracketTax', getValue: (r) => d(r).bracketTax, tooltip: { explanation: 'Progressive CT income tax.', pubName: 'CT-1040 TCS Table B', pubUrl: 'https://portal.ct.gov/drs/forms/ct-1040' } },
    { label: '2% rate phase-out (Table C)', nodeId: 'formCT1040.tableCAddBack', getValue: (r) => d(r).tableC_addBack, tooltip: { explanation: 'Recapture add-back based on CT AGI.', pubName: 'CT-1040 TCS Table C', pubUrl: 'https://portal.ct.gov/drs/forms/ct-1040' }, showWhen: (r) => d(r).tableC_addBack > 0 },
    { label: 'Benefit recapture (Table D)', nodeId: 'formCT1040.tableDRecapture', getValue: (r) => d(r).tableD_recapture, tooltip: { explanation: 'High-income recapture based on CT AGI.', pubName: 'CT-1040 TCS Table D', pubUrl: 'https://portal.ct.gov/drs/forms/ct-1040' }, showWhen: (r) => d(r).tableD_recapture > 0 },
    { label: 'Property tax credit', nodeId: 'formCT1040.propertyTaxCredit', getValue: (r) => d(r).propertyTaxCredit, tooltip: { explanation: 'Nonrefundable credit up to $300, subject to AGI phase-out.', pubName: 'CT Schedule 3', pubUrl: 'https://portal.ct.gov/drs/forms/ct-1040' }, showWhen: (r) => d(r).propertyTaxCredit > 0 },
    { label: 'CT EITC', nodeId: 'formCT1040.ctEITC', getValue: (r) => d(r).ctEITC, tooltip: { explanation: 'Refundable credit based on federal EITC.', pubName: 'CT-EITC', pubUrl: 'https://portal.ct.gov/drs/forms/ct-1040' }, showWhen: (r) => d(r).ctEITC > 0 },
  ] },
]

const CT_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  { type: 'refund', label: 'CT Refund', nodeId: 'formCT1040.overpaid', getValue: (r) => r.overpaid, showWhen: (r) => r.overpaid > 0 },
  { type: 'owed', label: 'CT Amount You Owe', nodeId: 'formCT1040.amountOwed', getValue: (r) => r.amountOwed, showWhen: (r) => r.amountOwed > 0 },
  { type: 'zero', label: 'CT tax balance', nodeId: '', getValue: () => 0, showWhen: (r) => r.overpaid === 0 && r.amountOwed === 0 },
]

export const ctModule: StateRulesModule = {
  stateCode: 'CT',
  stateName: 'Connecticut',
  formLabel: 'CT Form CT-1040',
  sidebarLabel: 'CT Form CT-1040',
  compute(model: TaxReturn, federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    return toStateResult(computeFormCT1040(model, federal, config))
  },
  nodeLabels: CT_NODE_LABELS,
  collectTracedValues: collectCTTracedValues,
  reviewLayout: CT_REVIEW_LAYOUT,
  reviewResultLines: CT_REVIEW_RESULT_LINES,
}
