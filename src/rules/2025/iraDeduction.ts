/**
 * IRA Deduction — Traditional IRA Contribution (Schedule 1, Line 20)
 *
 * IRC §219 — Above-the-line deduction for traditional IRA contributions.
 * The deductible amount depends on whether the taxpayer (or spouse) is
 * covered by a workplace retirement plan (W-2 Box 13), which triggers
 * MAGI-based phase-out rules.
 *
 * Per IRC §219(g)(3)(A)(ii), MAGI for this purpose = total income (Line 9),
 * avoiding circular dependency since Line 10 hasn't been computed yet.
 *
 * Source: 2025 Form 1040 Schedule 1 instructions, Rev. Proc. 2024-40
 */

import type { TaxReturn } from '../../model/types'
import {
  IRA_CONTRIBUTION_LIMIT,
  IRA_CATCHUP_LIMIT,
  IRA_CATCHUP_AGE,
  IRA_PHASEOUT_COVERED,
  IRA_PHASEOUT_SPOUSE_COVERED,
  TAX_YEAR,
} from './constants'

// ── Result type ──────────────────────────────────────────────────

export interface IRADeductionResult {
  contribution: number          // cents — actual traditional IRA amount
  contributionLimit: number     // cents — $7K or $8K
  allowableContribution: number // cents — min(contribution, limit)
  coveredByEmployerPlan: boolean
  spouseCoveredByEmployerPlan: boolean
  phaseOutApplies: boolean
  phaseOutStart: number         // cents
  phaseOutEnd: number           // cents
  deductibleAmount: number      // cents — final deduction
}

// ── Main computation ─────────────────────────────────────────────

/**
 * Compute the Traditional IRA deduction.
 *
 * @param model - The tax return (for W-2s, retirement contributions, filing status, DOB)
 * @param magi - Modified AGI for IRA purposes (Line 9 total income, in cents)
 * @returns IRADeductionResult or null if no traditional IRA contributions
 */
export function computeIRADeduction(
  model: TaxReturn,
  magi: number,
): IRADeductionResult | null {
  const traditionalIRA = model.retirementContributions?.traditionalIRA ?? 0
  if (traditionalIRA <= 0) return null

  // Determine contribution limit based on age
  let filerAge: number | null = null
  if (model.taxpayer.dateOfBirth) {
    const dobParts = model.taxpayer.dateOfBirth.split('-')
    if (dobParts.length === 3) {
      const birthYear = parseInt(dobParts[0], 10)
      if (!isNaN(birthYear)) {
        filerAge = TAX_YEAR - birthYear
      }
    }
  }

  const contributionLimit = (filerAge !== null && filerAge >= IRA_CATCHUP_AGE)
    ? IRA_CATCHUP_LIMIT
    : IRA_CONTRIBUTION_LIMIT

  const allowableContribution = Math.min(traditionalIRA, contributionLimit)

  // Determine employer plan coverage using W-2 owner field.
  // W-2s with owner === 'spouse' belong to the spouse; all others belong to the taxpayer.
  const isMFJLike = model.filingStatus === 'mfj' || model.filingStatus === 'qw'
  const taxpayerW2s = model.w2s.filter(w => w.owner !== 'spouse')
  const spouseW2s = model.w2s.filter(w => w.owner === 'spouse')

  const coveredByEmployerPlan = taxpayerW2s.some(w => w.box13RetirementPlan === true)
  const spouseCoveredByEmployerPlan = isMFJLike && spouseW2s.some(w => w.box13RetirementPlan === true)

  // Determine phase-out range
  let phaseOutStart = 0
  let phaseOutEnd = 0
  let phaseOutApplies = false

  if (coveredByEmployerPlan) {
    // Taxpayer is covered by employer plan → use covered phase-out
    const range = IRA_PHASEOUT_COVERED[model.filingStatus]
    phaseOutStart = range.start
    phaseOutEnd = range.end
    phaseOutApplies = true
  } else if (spouseCoveredByEmployerPlan && (model.filingStatus === 'mfj' || model.filingStatus === 'qw')) {
    // Not covered but spouse is → use spouse phase-out range
    phaseOutStart = IRA_PHASEOUT_SPOUSE_COVERED.start
    phaseOutEnd = IRA_PHASEOUT_SPOUSE_COVERED.end
    phaseOutApplies = true
  }
  // If neither covered → full deduction, no phase-out

  // Compute deductible amount
  let deductibleAmount: number

  if (!phaseOutApplies) {
    // Full deduction
    deductibleAmount = allowableContribution
  } else if (magi <= phaseOutStart) {
    // Below phase-out start → full deduction
    deductibleAmount = allowableContribution
  } else if (magi >= phaseOutEnd) {
    // Above phase-out end → $0 deduction
    deductibleAmount = 0
  } else {
    // In phase-out range: reduce proportionally
    // Per IRS instructions: reduction = limit × (MAGI - start) / (end - start)
    // Round reduction UP to next $10, then subtract from limit
    const range = phaseOutEnd - phaseOutStart
    const excess = magi - phaseOutStart
    const rawReduction = (allowableContribution * excess) / range
    // Round UP to next $10 (= 1000 cents)
    const roundedReduction = Math.ceil(rawReduction / 1000) * 1000
    deductibleAmount = Math.max(0, allowableContribution - roundedReduction)
  }

  return {
    contribution: traditionalIRA,
    contributionLimit,
    allowableContribution,
    coveredByEmployerPlan,
    spouseCoveredByEmployerPlan,
    phaseOutApplies,
    phaseOutStart,
    phaseOutEnd,
    deductibleAmount,
  }
}
