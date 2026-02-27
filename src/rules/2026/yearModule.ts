/**
 * 2026 Year Rules Module
 *
 * Demonstrates the delta-override pattern: reuses all 2025 computation
 * logic (form1040, scheduleB, state modules) and overrides only the
 * constants that change year-over-year.
 *
 * When adding 2026-specific rule changes:
 * 1. Create the new rule file in this directory (e.g. ./childTaxCredit.ts)
 * 2. Import the override here instead of the 2025 version
 * 3. If a rule file needs different constants, create it here and import
 *    from ./constants instead of ../2025/constants
 *
 * Everything not overridden delegates to the 2025 module automatically.
 */

import type { YearRulesModule } from '../yearModules'
import { STANDARD_DEDUCTION } from './constants'

// Reuse 2025 computation logic — these functions import their own
// constants internally, so for a true 2026 override you'd create
// local versions that import from ./constants instead.
import { computeForm1040 } from '../2025/form1040'
import { computeScheduleB } from '../2025/scheduleB'
import { extractForm540 } from '../2025/ca/module'
import { getStateModule, getSupportedStates, getAllStateNodeLabels } from '../stateRegistry'

export const yearModule2026: YearRulesModule = {
  taxYear: 2026,
  computeForm1040,
  computeScheduleB,
  standardDeduction: STANDARD_DEDUCTION,
  getStateModule,
  getSupportedStates,
  getAllStateNodeLabels,
  extractForm540,
}
