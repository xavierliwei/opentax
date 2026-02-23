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
  f1040s1: Uint8Array
  f1040s2: Uint8Array
  f1040s3: Uint8Array
  f8812: Uint8Array
  f8863: Uint8Array
  f6251: Uint8Array
  f8889: Uint8Array
  f1040se: Uint8Array
  f1040sc: Uint8Array
  f1040sse: Uint8Array
  f1116: Uint8Array
}

/** Result of compiling all forms for a tax return. */
export interface CompiledForms {
  pdfBytes: Uint8Array
  formsIncluded: FormSummary[]
  summary: ReturnSummary
  /** State form PDFs (for separate download). Empty if no states selected. */
  statePackages: StatePackage[]
}

/** A compiled state form package (one per state) */
export interface StatePackage {
  stateCode: string
  label: string
  pdfBytes: Uint8Array
  forms: FormSummary[]
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
