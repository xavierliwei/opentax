/**
 * State Rules Engine — Interfaces for multi-state tax computation
 *
 * Each state implements StateRulesModule to plug into the engine.
 * The registry (stateRegistry.ts) maps state codes to modules.
 */

import type { SupportedStateCode, ResidencyType, TaxReturn, StateReturnConfig } from '../model/types'
import type { Form1040Result } from './2025/form1040'
import type { TracedValue } from '../model/traced'

/** Standardised result from any state computation */
export interface StateComputeResult {
  stateCode: SupportedStateCode
  formLabel: string              // e.g. "CA Form 540", "CA Form 540NR", "NY IT-201"
  residencyType: ResidencyType
  stateAGI: number
  stateTaxableIncome: number
  stateTax: number
  stateCredits: number
  taxAfterCredits: number
  stateWithholding: number
  overpaid: number
  amountOwed: number
  /** For part-year/nonresident: fraction of the year spent in the state (0–1) */
  apportionmentRatio?: number
  /** State-specific detail object (e.g. Form540Result) — opaque to the framework */
  detail: unknown
}

// ── Config-driven review layout ─────────────────────────────────

/** A single line item in a state review section */
export interface StateReviewLineItem {
  label: string
  nodeId: string
  /** Dot-path into the detail object, or a standard StateComputeResult key */
  getValue: (result: StateComputeResult) => number
  tooltip: { explanation: string; pubName: string; pubUrl: string }
  /** Only show this line when the predicate returns true */
  showWhen?: (result: StateComputeResult) => boolean
}

/** A section in the state review page (e.g. "Income", "Deductions") */
export interface StateReviewSection {
  title: string
  items: StateReviewLineItem[]
}

/** A result line in the state review page (refund/owed) */
export interface StateReviewResultLine {
  type: 'refund' | 'owed' | 'zero'
  label: string
  nodeId: string
  getValue: (result: StateComputeResult) => number
  showWhen: (result: StateComputeResult) => boolean
}

/** Contract that each state module must implement */
export interface StateRulesModule {
  stateCode: SupportedStateCode
  stateName: string              // "California", "New York"
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

  /** Config-driven layout for the generic state review page */
  reviewLayout: StateReviewSection[]

  /** Result lines (refund/owed) for the review page */
  reviewResultLines: StateReviewResultLine[]
}
