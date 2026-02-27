/**
 * Multi-Year Tax Rules Registry
 *
 * Maps tax year → YearRulesModule, so engine.ts can dispatch to the
 * correct year's computation logic based on TaxReturn.taxYear.
 *
 * Adding a new tax year:
 * 1. Create src/rules/<year>/constants.ts — year-specific thresholds/brackets
 * 2. Create src/rules/<year>/yearModule.ts — re-export shared logic, override delta rules
 * 3. Import & register the module in this file
 *
 * All existing years remain untouched.
 */

import type { TaxReturn, FilingStatus, SupportedStateCode } from '../model/types'
import type { Form1040Result } from './2025/form1040'
import type { ScheduleBResult } from './2025/scheduleB'
import type { Form540Result } from './2025/ca/form540'
import type { StateComputeResult, StateRulesModule } from './stateEngine'

// ── Interface ────────────────────────────────────────────────────

export interface YearRulesModule {
  taxYear: number

  /** Compute the federal Form 1040. */
  computeForm1040: (model: TaxReturn) => Form1040Result

  /** Compute Schedule B (interest & dividends). */
  computeScheduleB: (model: TaxReturn) => ScheduleBResult

  /** Standard deduction by filing status (cents). */
  standardDeduction: Record<FilingStatus, number>

  /** Look up a state rules module by state code. */
  getStateModule: (code: SupportedStateCode) => StateRulesModule | undefined

  /** All supported states for this year. */
  getSupportedStates: () => { code: SupportedStateCode; label: string; stateName: string }[]

  /** Aggregated state node labels for explainability. */
  getAllStateNodeLabels: () => Record<string, string>

  /** Extract CA Form 540 from a state result (backward compat). */
  extractForm540: (result: StateComputeResult) => Form540Result | null
}

// ── Registry ─────────────────────────────────────────────────────

import { yearModule2025 } from './2025/yearModule'
import { yearModule2026 } from './2026/yearModule'

const YEAR_MODULES: Map<number, YearRulesModule> = new Map([
  [2025, yearModule2025],
  [2026, yearModule2026],
])

/**
 * Resolve the rules module for a given tax year.
 * Throws if the year is not registered.
 */
export function getYearModule(year: number): YearRulesModule {
  const mod = YEAR_MODULES.get(year)
  if (!mod) {
    const supported = [...YEAR_MODULES.keys()].sort().join(', ')
    throw new Error(
      `No rules module registered for tax year ${year}. Supported years: ${supported}`,
    )
  }
  return mod
}

/** List all tax years with registered rules modules. */
export function getSupportedTaxYears(): number[] {
  return [...YEAR_MODULES.keys()].sort()
}
