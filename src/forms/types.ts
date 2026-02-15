/**
 * Shared types for the PDF form filling layer.
 */

/** PDF template bytes needed by the compiler. Loaded by the caller. */
export interface FormTemplates {
  f1040: Uint8Array
  f1040sa: Uint8Array
  f1040sb: Uint8Array
  f1040sd: Uint8Array
  f8949: Uint8Array
}

/** Result of compiling all forms for a tax return. */
export interface CompiledForms {
  pdfBytes: Uint8Array
  formsIncluded: FormSummary[]
  summary: ReturnSummary
}

export interface FormSummary {
  formId: string
  sequenceNumber: string
  pageCount: number
}

export interface ReturnSummary {
  taxYear: number
  filingStatus: string
  taxpayerName: string
  agi: number
  totalTax: number
  totalPayments: number
  refund: number
  amountOwed: number
}
