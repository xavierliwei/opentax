/**
 * State Form Compiler — Interface for generating state tax return PDFs
 *
 * Each state registers a compiler that knows how to fill its specific
 * form templates. The framework handles assembly into the filing package.
 */

import type { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../model/types'
import type { StateComputeResult } from '../rules/stateEngine'
import type { FormSummary } from './types'

/** PDF template bytes for a specific state's forms */
export interface StateFormTemplates {
  /** Map of template key to PDF bytes (e.g. 'f540' → Uint8Array) */
  templates: Map<string, Uint8Array>
}

/** Result of compiling a state's forms */
export interface StateCompiledForms {
  doc: PDFDocument
  forms: FormSummary[]
}

/** Contract that each state form compiler must implement */
export interface StateFormCompiler {
  stateCode: string

  /** List of template files this compiler needs (relative to public/forms/state/{CODE}/) */
  templateFiles: string[]

  /** Compile the state's forms into a filled PDF document */
  compile: (
    taxReturn: TaxReturn,
    stateResult: StateComputeResult,
    templates: StateFormTemplates,
  ) => Promise<StateCompiledForms>
}
