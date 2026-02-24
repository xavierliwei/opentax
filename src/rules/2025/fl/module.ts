/**
 * FL State Module — Florida has no personal state income tax.
 */

import type { TaxReturn, StateReturnConfig } from '../../../model/types'
import type { Form1040Result } from '../form1040'
import type { TracedValue } from '../../../model/traced'
import { tracedFromComputation } from '../../../model/traced'
import type { StateRulesModule, StateComputeResult, StateReviewSection, StateReviewResultLine } from '../../stateEngine'

interface FloridaNoTaxResult {
  residencyType: 'full-year' | 'part-year' | 'nonresident'
  apportionmentRatio: number
  stateWithholding: number
}

function parseISODateUTC(iso: string): Date | null {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
}

function computeApportionmentRatio(config: StateReturnConfig, taxYear: number): number {
  if (config.residencyType === 'full-year') return 1.0
  if (config.residencyType === 'nonresident') return 0.0

  const yearStart = new Date(Date.UTC(taxYear, 0, 1))
  const yearEnd = new Date(Date.UTC(taxYear, 11, 31))

  let start = yearStart
  let end = yearEnd

  if (config.moveInDate) {
    const parsed = parseISODateUTC(config.moveInDate)
    if (parsed) start = parsed
  }
  if (config.moveOutDate) {
    const parsed = parseISODateUTC(config.moveOutDate)
    if (parsed) end = parsed
  }

  if (start < yearStart) start = yearStart
  if (end > yearEnd) end = yearEnd
  if (end < start) return 0

  const msPerDay = 24 * 60 * 60 * 1000
  const daysInState = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1
  const daysInYear = Math.floor((yearEnd.getTime() - yearStart.getTime()) / msPerDay) + 1
  return Math.max(0, Math.min(1, daysInState / daysInYear))
}

function computeFloridaNoTax(model: TaxReturn, config: StateReturnConfig): FloridaNoTaxResult {
  const stateWithholding = model.w2s.reduce((sum, w2) => {
    if (w2.box15State !== 'FL') return sum
    return sum + (w2.box17StateIncomeTax ?? 0)
  }, 0)

  return {
    residencyType: config.residencyType,
    apportionmentRatio: computeApportionmentRatio(config, model.taxYear),
    stateWithholding,
  }
}

function toStateResult(detail: FloridaNoTaxResult): StateComputeResult {
  const disclosures = [
    'Florida does not impose a personal state income tax. No Florida income tax return is required.',
  ]
  if (detail.stateWithholding > 0) {
    disclosures.push('We detected W-2 state withholding tagged FL. Florida has no wage withholding system, so verify your W-2 Box 15/17 entries.')
  }

  return {
    stateCode: 'FL',
    formLabel: 'Florida — No Income Tax',
    residencyType: detail.residencyType,
    stateAGI: 0,
    stateTaxableIncome: 0,
    stateTax: 0,
    stateCredits: 0,
    taxAfterCredits: 0,
    stateWithholding: detail.stateWithholding,
    overpaid: detail.stateWithholding,
    amountOwed: 0,
    apportionmentRatio: detail.apportionmentRatio,
    requiresIncomeTaxFiling: false,
    disclosures,
    detail,
  }
}

const FL_NODE_LABELS: Record<string, string> = {
  'fl.noIncomeTax': 'Florida has no personal income tax',
  'fl.stateWithholding': 'W-2 state withholding tagged Florida',
  'fl.overpaid': 'Potential Florida withholding mismatch',
}

function collectFLTracedValues(result: StateComputeResult): Map<string, TracedValue> {
  const values = new Map<string, TracedValue>()
  values.set('fl.noIncomeTax', tracedFromComputation(
    0,
    'fl.noIncomeTax',
    [],
    'Florida has no personal income tax',
  ))

  if (result.stateWithholding > 0) {
    values.set('fl.stateWithholding', tracedFromComputation(
      result.stateWithholding,
      'fl.stateWithholding',
      [],
      'W-2 state withholding tagged Florida',
    ))
    values.set('fl.overpaid', tracedFromComputation(
      result.overpaid,
      'fl.overpaid',
      ['fl.stateWithholding'],
      'Potential Florida withholding mismatch',
    ))
  }

  return values
}

const FL_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Florida Income Tax Status',
    items: [
      {
        label: 'Florida Personal Income Tax',
        nodeId: 'fl.noIncomeTax',
        getValue: () => 0,
        tooltip: {
          explanation: 'Florida does not levy a personal income tax on wage, retirement, or investment income.',
          pubName: 'Florida Department of Revenue',
          pubUrl: 'https://floridarevenue.com/',
        },
      },
      {
        label: 'W-2 State Withholding Tagged FL',
        nodeId: 'fl.stateWithholding',
        getValue: (r) => r.stateWithholding,
        tooltip: {
          explanation: 'Florida has no personal income tax withholding. Amounts reported under FL in W-2 Box 17 are typically data-entry issues or should belong to another state.',
          pubName: 'IRS Form W-2 Instructions (Boxes 15-20)',
          pubUrl: 'https://www.irs.gov/instructions/iw2w3',
        },
        showWhen: (r) => r.stateWithholding > 0,
      },
    ],
  },
]

const FL_REVIEW_RESULT_LINES: StateReviewResultLine[] = [
  {
    type: 'refund',
    label: 'Potential FL Withholding Mismatch',
    nodeId: 'fl.overpaid',
    getValue: (r) => r.overpaid,
    showWhen: (r) => r.overpaid > 0,
  },
  {
    type: 'zero',
    label: 'No Florida income tax due',
    nodeId: '',
    getValue: () => 0,
    showWhen: (r) => r.overpaid === 0,
  },
]

export const flModule: StateRulesModule = {
  stateCode: 'FL',
  stateName: 'Florida',
  formLabel: 'Florida — No Income Tax',
  sidebarLabel: 'Florida (No Income Tax)',

  compute(model: TaxReturn, _federal: Form1040Result, config: StateReturnConfig): StateComputeResult {
    const detail = computeFloridaNoTax(model, config)
    return toStateResult(detail)
  },

  nodeLabels: FL_NODE_LABELS,
  collectTracedValues: collectFLTracedValues,
  reviewLayout: FL_REVIEW_LAYOUT,
  reviewResultLines: FL_REVIEW_RESULT_LINES,
}
