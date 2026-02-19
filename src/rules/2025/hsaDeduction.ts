/**
 * HSA Deduction — Form 8889 (Health Savings Account)
 *
 * Above-the-line deduction for HSA contributions, flowing to Schedule 1, Line 13.
 * Also computes taxable distributions, excess contribution penalty (6%),
 * and non-qualified distribution penalty (20%).
 *
 * Key rules:
 * - Employer contributions (W-2 Box 12 code W) count toward the limit but are NOT deductible
 * - Taxpayer contributions are deductible up to (limit − employer contributions)
 * - 2025 limits: $4,300 self-only / $8,550 family + $1,000 catch-up if age 55+
 * - Excess contributions → 6% penalty
 * - Non-qualified distributions → taxable + 20% penalty (unless age 65+ or disabled)
 *
 * Source: IRC §223, Form 8889 instructions, Rev. Proc. 2024-25
 */

import type { TaxReturn } from '../../model/types'
import {
  HSA_LIMIT_SELF_ONLY,
  HSA_LIMIT_FAMILY,
  HSA_CATCHUP_AMOUNT,
  HSA_EXCESS_PENALTY_RATE,
  HSA_DISTRIBUTION_PENALTY_RATE,
} from './constants'

// ── Result type ──────────────────────────────────────────────────

export interface HSAResult {
  coverageType: 'self-only' | 'family'
  annualLimit: number               // base limit (cents)
  catchUpAmount: number             // $1,000 if age 55+ (cents)
  totalLimit: number                // annualLimit + catchUpAmount (cents)
  employerContributions: number     // W-2 Box 12 code W (cents)
  taxpayerContributions: number     // user-entered direct contributions (cents)
  totalContributions: number        // employer + taxpayer (cents)
  excessContributions: number       // max(0, total - totalLimit) (cents)
  deductibleAmount: number          // min(taxpayerContrib, totalLimit - employerContrib), ≥ 0 (cents)

  totalDistributions: number        // 1099-SA Box 1 total (cents)
  qualifiedMedicalExpenses: number  // user-entered (cents)
  taxableDistributions: number      // max(0, distributions - qualified expenses) (cents)
  distributionPenalty: number       // 20% of taxable (if not age65+/disabled) (cents)
  excessPenalty: number             // 6% of excess contributions (cents)
}

// ── Main computation ─────────────────────────────────────────────

/**
 * Compute the HSA deduction (Form 8889).
 *
 * @param model - The tax return
 * @returns HSAResult or null if no HSA activity
 */
export function computeHSADeduction(model: TaxReturn): HSAResult | null {
  if (!model.hsa) return null

  const { coverageType, contributions: taxpayerContributions, qualifiedExpenses, age55OrOlder, age65OrDisabled } = model.hsa

  // 1. Determine limits
  const annualLimit = coverageType === 'family' ? HSA_LIMIT_FAMILY : HSA_LIMIT_SELF_ONLY
  const catchUpAmount = age55OrOlder ? HSA_CATCHUP_AMOUNT : 0
  const totalLimit = annualLimit + catchUpAmount

  // 2. Extract employer HSA contributions from W-2 Box 12 code W
  let employerContributions = 0
  for (const w2 of model.w2s) {
    for (const entry of w2.box12) {
      if (entry.code === 'W') {
        employerContributions += entry.amount
      }
    }
  }

  // 3. Total contributions and excess
  const totalContributions = employerContributions + taxpayerContributions
  const excessContributions = Math.max(0, totalContributions - totalLimit)

  // 4. Deductible amount = min(taxpayer contributions, limit − employer contributions), floored at 0
  const roomAfterEmployer = Math.max(0, totalLimit - employerContributions)
  const deductibleAmount = Math.min(taxpayerContributions, roomAfterEmployer)

  // 5. Distributions from 1099-SA
  const totalDistributions = (model.form1099SAs ?? []).reduce((sum, f) => sum + f.box1, 0)

  // 6. Taxable distributions = max(0, distributions − qualified medical expenses)
  const taxableDistributions = Math.max(0, totalDistributions - qualifiedExpenses)

  // 7. Distribution penalty: 20% on taxable distributions (unless age 65+ or disabled)
  const distributionPenalty = age65OrDisabled
    ? 0
    : Math.round(taxableDistributions * HSA_DISTRIBUTION_PENALTY_RATE)

  // 8. Excess contribution penalty: 6% of excess
  const excessPenalty = Math.round(excessContributions * HSA_EXCESS_PENALTY_RATE)

  return {
    coverageType,
    annualLimit,
    catchUpAmount,
    totalLimit,
    employerContributions,
    taxpayerContributions,
    totalContributions,
    excessContributions,
    deductibleAmount,
    totalDistributions,
    qualifiedMedicalExpenses: qualifiedExpenses,
    taxableDistributions,
    distributionPenalty,
    excessPenalty,
  }
}
