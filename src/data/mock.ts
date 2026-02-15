import type { ComputationNode, ComputationSummary, OpenTaxModel } from '../types/opentax'

export const initialModel: OpenTaxModel = {
  taxYear: 2025,
  taxpayer: {
    firstName: 'Alex',
    lastName: 'Lee',
    ssnLast4: '1234',
    email: 'alex@example.com',
    filingStatus: 'single',
    state: 'CA',
  },
  documents: [
    { id: 'doc-w2-1', kind: 'W-2', filename: 'acme-w2.pdf', status: 'uploaded', confidence: 0.99 },
    { id: 'doc-1099b-1', kind: '1099-B', filename: 'broker-1099b.pdf', status: 'uploaded', confidence: 0.97 },
    { id: 'doc-1099int-1', kind: '1099-INT', filename: 'bank-1099int.pdf', status: 'placeholder', confidence: 0.0 },
    { id: 'doc-rsu-1', kind: 'RSU-STATEMENT', filename: 'equity-rsu.csv', status: 'uploaded', confidence: 0.95 },
  ],
  incomeEvents: [
    { id: 'inc-1', type: 'w2', label: 'W-2 wages', amountCents: 18500000, sourceDocumentId: 'doc-w2-1' },
    { id: 'inc-2', type: 'interest', label: 'Bank interest', amountCents: 12500, sourceDocumentId: 'doc-1099int-1' },
    { id: 'inc-3', type: 'capital_gain', label: 'Broker realized gain/loss', amountCents: -340000, sourceDocumentId: 'doc-1099b-1' },
    { id: 'inc-4', type: 'rsu_vest', label: 'RSU ordinary income at vest', amountCents: 1200000, sourceDocumentId: 'doc-rsu-1' },
    { id: 'inc-5', type: 'rsu_sale', label: 'RSU sale gain/loss', amountCents: 80000, sourceDocumentId: 'doc-1099b-1' },
  ],
  adjustments: [
    { id: 'adj-1', kind: 'hsa', label: 'HSA deduction', amountCents: 120000 },
    { id: 'adj-2', kind: 'ira', label: 'Traditional IRA deduction', amountCents: 250000 },
  ],
  mappings: [],
  computationNodes: [],
  interviewAnswers: [
    { id: 'q1', question: 'Do you have dependents?', answer: 'No' },
    { id: 'q2', question: 'Any student loan interest paid?', answer: 'No' },
    { id: 'q3', question: 'Did you sell RSUs this year?', answer: 'Yes' },
  ],
}

export function computeDeterministicSummary(model: OpenTaxModel): { summary: ComputationSummary; nodes: ComputationNode[]; mappings: OpenTaxModel['mappings'] } {
  const grossIncomeCents = model.incomeEvents.reduce((sum, event) => sum + event.amountCents, 0)
  const totalAdjustmentsCents = model.adjustments.reduce((sum, adj) => sum + adj.amountCents, 0)
  const adjustedGrossIncomeCents = Math.max(0, grossIncomeCents - totalAdjustmentsCents)
  const standardDeductionCents = model.taxpayer.filingStatus === 'mfj' ? 2920000 : 1460000
  const taxableIncomeCents = Math.max(0, adjustedGrossIncomeCents - standardDeductionCents)

  // Deterministic mock bracket (NOT real tax logic)
  const estimatedTaxCents = Math.round(taxableIncomeCents * 0.19)
  const withholdingCents = Math.round(model.incomeEvents
    .filter((x) => x.type === 'w2' || x.type === 'rsu_vest')
    .reduce((sum, x) => sum + x.amountCents, 0) * 0.16)

  const diff = withholdingCents - estimatedTaxCents
  const summary: ComputationSummary = {
    grossIncomeCents,
    totalAdjustmentsCents,
    adjustedGrossIncomeCents,
    standardDeductionCents,
    taxableIncomeCents,
    estimatedTaxCents,
    withholdingCents,
    estimatedRefundOrDueCents: Math.abs(diff),
    resultLabel: diff >= 0 ? 'estimated_refund' : 'estimated_amount_due',
  }

  const nodes: ComputationNode[] = [
    {
      id: 'node.grossIncome',
      label: 'Gross Income',
      formula: 'sum(incomeEvents.amountCents)',
      inputKeys: model.incomeEvents.map((x) => x.id),
      outputCents: grossIncomeCents,
      explanation: 'Adds wages, investment income, and RSU events from uploaded/placeholder documents.',
    },
    {
      id: 'node.agi',
      label: 'Adjusted Gross Income (AGI)',
      formula: 'grossIncome - sum(adjustments)',
      inputKeys: ['node.grossIncome', ...model.adjustments.map((x) => x.id)],
      outputCents: adjustedGrossIncomeCents,
      explanation: 'Subtracts user-confirmed adjustments from gross income.',
    },
    {
      id: 'node.taxableIncome',
      label: 'Taxable Income',
      formula: 'max(0, AGI - standardDeduction)',
      inputKeys: ['node.agi'],
      outputCents: taxableIncomeCents,
      explanation: 'Uses a fixed standard deduction constant for this MVP.',
    },
    {
      id: 'node.estimatedTax',
      label: 'Estimated Tax (Mock)',
      formula: 'round(taxableIncome * 0.19)',
      inputKeys: ['node.taxableIncome'],
      outputCents: estimatedTaxCents,
      explanation: 'Mock deterministic tax estimate. Not IRS-accurate.',
    },
  ]

  const mappings = [
    { id: 'map-1', sourceKey: 'node.grossIncome', form: 'Form 1040', line: '1', valueCents: grossIncomeCents },
    { id: 'map-2', sourceKey: 'node.agi', form: 'Form 1040', line: '11', valueCents: adjustedGrossIncomeCents },
    { id: 'map-3', sourceKey: 'node.taxableIncome', form: 'Form 1040', line: '15', valueCents: taxableIncomeCents },
    { id: 'map-4', sourceKey: 'node.estimatedTax', form: 'Form 1040', line: '16', valueCents: estimatedTaxCents },
  ]

  return { summary, nodes, mappings }
}

export const fmtCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(cents / 100)
