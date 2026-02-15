export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh'

export interface TaxpayerProfile {
  firstName: string
  lastName: string
  ssnLast4: string
  email: string
  filingStatus: FilingStatus
  state: string
}

export interface IncomeEvent {
  id: string
  type: 'w2' | 'interest' | 'dividend' | 'capital_gain' | 'rsu_vest' | 'rsu_sale'
  label: string
  amountCents: number
  sourceDocumentId?: string
}

export interface TaxDocument {
  id: string
  kind: 'W-2' | '1099-INT' | '1099-DIV' | '1099-B' | 'RSU-STATEMENT'
  filename: string
  status: 'uploaded' | 'placeholder' | 'review-needed'
  confidence: number
}

export interface Adjustment {
  id: string
  kind: 'student_loan_interest' | 'ira' | 'hsa' | 'other'
  label: string
  amountCents: number
}

export interface FormMapping {
  id: string
  sourceKey: string
  form: string
  line: string
  valueCents: number
}

export interface ComputationNode {
  id: string
  label: string
  formula: string
  inputKeys: string[]
  outputCents: number
  explanation: string
}

export interface InterviewAnswer {
  id: string
  question: string
  answer: string
}

export interface OpenTaxModel {
  taxYear: number
  taxpayer: TaxpayerProfile
  incomeEvents: IncomeEvent[]
  documents: TaxDocument[]
  adjustments: Adjustment[]
  mappings: FormMapping[]
  computationNodes: ComputationNode[]
  interviewAnswers: InterviewAnswer[]
}

export interface ComputationSummary {
  grossIncomeCents: number
  totalAdjustmentsCents: number
  adjustedGrossIncomeCents: number
  standardDeductionCents: number
  taxableIncomeCents: number
  estimatedTaxCents: number
  withholdingCents: number
  estimatedRefundOrDueCents: number
  resultLabel: 'estimated_refund' | 'estimated_amount_due'
}
