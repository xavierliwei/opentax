/**
 * Schedule CA (540) — California Adjustments
 *
 * Converts federal AGI → CA AGI by applying additions and subtractions.
 *
 * Phase 1 scope: HSA deduction add-back only.
 * CA does not recognize IRC §223 (HSA), so the federal HSA deduction
 * must be added back to arrive at CA AGI.
 *
 * Source: FTB Schedule CA (540) Instructions
 */

import type { Form1040Result } from '../form1040'

export interface ScheduleCAResult {
  federalAGI: number          // cents — Form 1040 Line 11
  additions: number           // cents — Column B total
  subtractions: number        // cents — Column C total
  caAGI: number               // cents — federalAGI + additions - subtractions

  // Detail
  hsaAddBack: number          // cents — HSA deduction added back (Column B)
}

/**
 * Compute Schedule CA adjustments from federal to CA AGI.
 *
 * Phase 1: only the HSA add-back matters for our target user
 * (W-2 tech employee with stock income). Most other adjustments
 * require income types we don't yet support (Social Security,
 * state refunds, educator expenses).
 */
export function computeScheduleCA(
  form1040: Form1040Result,
): ScheduleCAResult {
  const federalAGI = form1040.line11.amount

  // HSA deduction add-back: CA doesn't recognize IRC §223
  const hsaAddBack = form1040.hsaResult?.deductibleAmount ?? 0

  const additions = hsaAddBack
  const subtractions = 0

  const caAGI = federalAGI + additions - subtractions

  return {
    federalAGI,
    additions,
    subtractions,
    caAGI,
    hsaAddBack,
  }
}
