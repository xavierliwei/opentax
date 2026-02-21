/**
 * State Rules Engine — Interfaces for multi-state tax computation
 *
 * Each state implements StateRulesModule to plug into the engine.
 * The registry (stateRegistry.ts) maps state codes to modules.
 */

import type { SupportedStateCode, TaxReturn, StateReturnConfig } from '../model/types'
import type { Form1040Result } from './2025/form1040'
import type { TracedValue } from '../model/traced'

/** Standardised result from any state computation */
export interface StateComputeResult {
  stateCode: SupportedStateCode
  formLabel: string              // e.g. "CA Form 540", "NY IT-201"
  stateAGI: number
  stateTaxableIncome: number
  stateTax: number
  stateCredits: number
  taxAfterCredits: number
  stateWithholding: number
  overpaid: number
  amountOwed: number
  /** State-specific detail object (e.g. Form540Result) — opaque to the framework */
  detail: unknown
}

/** Contract that each state module must implement */
export interface StateRulesModule {
  stateCode: SupportedStateCode
  formLabel: string              // "CA Form 540", "NY IT-201"
  sidebarLabel: string           // "CA Form 540" — used in interview sidebar

  /** Compute the state return */
  compute: (
    model: TaxReturn,
    federal: Form1040Result,
    config: StateReturnConfig,
  ) => StateComputeResult

  /** Node labels for the explainability trace */
  nodeLabels: Record<string, string>

  /** Build traced values for the explainability graph */
  collectTracedValues: (result: StateComputeResult) => Map<string, TracedValue>
}
