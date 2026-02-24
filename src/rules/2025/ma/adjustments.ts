/**
 * Massachusetts Adjustments — Federal AGI → MA AGI
 *
 * Converts federal adjusted gross income to Massachusetts AGI by
 * applying MA-specific additions and subtractions.
 *
 * Key differences from federal:
 * - HSA add-back: MA does not conform to IRC §223
 * - Social Security exemption: fully exempt from MA tax
 * - US government interest: exempt from state taxation
 *
 * Source: MA Form 1 Schedule Y, 2025 Instructions
 */

import type { TaxReturn } from '../../../model/types'
import type { Form1040Result } from '../form1040'

export interface MAAdjustmentsResult {
  federalAGI: number          // cents — Form 1040 Line 11
  additions: number           // cents — total additions
  subtractions: number        // cents — total subtractions
  maAGI: number               // cents — federalAGI + additions - subtractions

  // Detail
  hsaAddBack: number          // cents — HSA deduction added back
  ssExemption: number         // cents — Social Security benefits subtracted
  usGovInterest: number       // cents — US government obligation interest subtracted
}

/**
 * Compute MA adjustments from federal to MA AGI.
 *
 * - HSA add-back: MA doesn't recognize IRC §223 (same as CA)
 * - Social Security: fully exempt from MA tax (subtract taxable SS from AGI)
 * - US government interest: exempt from state taxation (Treasury bonds, etc.)
 */
export function computeMAAdjustments(
  model: TaxReturn,
  form1040: Form1040Result,
): MAAdjustmentsResult {
  const federalAGI = form1040.line11.amount

  // ── Additions ──────────────────────────────────────────────
  // HSA deduction add-back: MA doesn't recognize IRC §223
  const hsaAddBack = form1040.hsaResult?.deductibleAmount ?? 0

  const additions = hsaAddBack

  // ── Subtractions ───────────────────────────────────────────
  // Social Security benefits: fully exempt from MA tax.
  // Federal taxable SS (Form 1040 Line 6b) was included in federal AGI;
  // subtract it for MA purposes.
  const ssExemption = form1040.line6b.amount

  // US government obligation interest (Treasury bonds, I-bonds, etc.)
  // Sum of 1099-INT Box 3 values from source documents.
  // These are already included in federal interest income; MA exempts them.
  const usGovInterest = model.form1099INTs.reduce(
    (sum, f) => sum + f.box3, 0,
  )

  const subtractions = ssExemption + usGovInterest

  const maAGI = federalAGI + additions - subtractions

  return {
    federalAGI,
    additions,
    subtractions,
    maAGI,
    hsaAddBack,
    ssExemption,
    usGovInterest,
  }
}
