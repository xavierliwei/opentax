/**
 * OBBBA Senior Standard Deduction Enhancement (§70104)
 *
 * The One Big Beautiful Bill Act (signed 2025-07-04) doubled the additional
 * standard deduction for taxpayers age 65 or older for tax years 2025–2028.
 *
 * Pre-OBBBA (Rev. Proc. 2024-40):
 *   Single/HOH: $2,000 per condition (age 65+ or blind)
 *   MFJ/MFS/QW: $1,600 per condition
 *
 * Post-OBBBA (§70104):
 *   Single/HOH: $4,000 per qualifying senior (age 65+)
 *   MFJ/MFS/QW: $3,200 per qualifying senior (age 65+)
 *
 * The blind additional amount remains unchanged at the pre-OBBBA level.
 * The OBBBA enhancement only applies to the age 65+ additional amount.
 *
 * Source: One Big Beautiful Bill Act, §70104
 * Source: IRC §63(f) as amended
 */

import type { FilingStatus } from '../../model/types'
import { ADDITIONAL_STANDARD_DEDUCTION } from './constants'

// ── Constants ──────────────────────────────────────────────────

/** OBBBA-enhanced additional standard deduction for age 65+ (per qualifying person) */
export const OBBBA_SENIOR_ADDITIONAL: Record<FilingStatus, number> = {
  single: 400_000,   // $4,000
  hoh:    400_000,   // $4,000
  mfj:    320_000,   // $3,200
  mfs:    320_000,   // $3,200
  qw:     320_000,   // $3,200
}

// ── Result ─────────────────────────────────────────────────────

export interface SeniorDeductionResult {
  seniorCount: number          // Number of qualifying seniors (0, 1, or 2)
  blindCount: number           // Number of qualifying blind (0–2)
  seniorPerPerson: number      // OBBBA-enhanced amount per senior (cents)
  blindPerPerson: number       // Unchanged amount per blind person (cents)
  totalSeniorAmount: number    // seniorCount × seniorPerPerson (cents)
  totalBlindAmount: number     // blindCount × blindPerPerson (cents)
  totalAdditional: number      // totalSeniorAmount + totalBlindAmount (cents)
}

// ── Computation ────────────────────────────────────────────────

/**
 * Compute the OBBBA-enhanced additional standard deduction.
 *
 * Under OBBBA §70104, the additional standard deduction for age 65+
 * is doubled ($4,000 single/$3,200 married). The blind additional
 * remains at the pre-OBBBA level ($2,000/$1,600).
 */
export function computeSeniorDeduction(
  filingStatus: FilingStatus,
  taxpayerAge65: boolean,
  taxpayerBlind: boolean,
  spouseAge65: boolean,
  spouseBlind: boolean,
): SeniorDeductionResult {
  let seniorCount = 0
  let blindCount = 0

  if (taxpayerAge65) seniorCount++
  if (taxpayerBlind) blindCount++

  // Spouse counts only for MFJ/MFS
  if (filingStatus === 'mfj' || filingStatus === 'mfs') {
    if (spouseAge65) seniorCount++
    if (spouseBlind) blindCount++
  }

  const seniorPerPerson = OBBBA_SENIOR_ADDITIONAL[filingStatus]
  const blindPerPerson = ADDITIONAL_STANDARD_DEDUCTION[filingStatus]

  const totalSeniorAmount = seniorCount * seniorPerPerson
  const totalBlindAmount = blindCount * blindPerPerson
  const totalAdditional = totalSeniorAmount + totalBlindAmount

  return {
    seniorCount,
    blindCount,
    seniorPerPerson,
    blindPerPerson,
    totalSeniorAmount,
    totalBlindAmount,
    totalAdditional,
  }
}
