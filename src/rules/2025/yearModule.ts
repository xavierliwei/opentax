/**
 * 2025 Year Rules Module
 *
 * Bundles all 2025 federal and state computation entry points
 * into a single YearRulesModule for the year registry.
 */

import type { YearRulesModule } from '../yearModules'
import { computeForm1040 } from './form1040'
import { computeScheduleB } from './scheduleB'
import { STANDARD_DEDUCTION } from './constants'
import { extractForm540 } from './ca/module'
import { getStateModule, getSupportedStates, getAllStateNodeLabels } from '../stateRegistry'

export const yearModule2025: YearRulesModule = {
  taxYear: 2025,
  computeForm1040,
  computeScheduleB,
  standardDeduction: STANDARD_DEDUCTION,
  getStateModule,
  getSupportedStates,
  getAllStateNodeLabels,
  extractForm540,
}
