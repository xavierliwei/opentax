/**
 * Pennsylvania 2025 Tax Year Constants (PA-40)
 *
 * All monetary amounts are in integer cents.
 *
 * Primary sources:
 *   PA Department of Revenue — Personal Income Tax
 *   2025 PA-40 Instructions
 *   Schedule SP (Tax Forgiveness) Instructions
 */

/** Convert dollars to cents for readability in this file. */
function c(dollars: number): number {
  return Math.round(dollars * 100)
}

// ── Flat Tax Rate ─────────────────────────────────────────────
export const PA_TAX_RATE = 0.0307

// ── IRC §529 Deduction Limits ─────────────────────────────────
export const PA_529_DEDUCTION_LIMIT_PER_BENEFICIARY = c(18000)
export const PA_529_DEDUCTION_LIMIT_MFJ = c(36000) // per beneficiary for MFJ

// ── Tax Forgiveness Thresholds (Schedule SP) ──────────────────
// Base thresholds for 0 dependents
export const PA_FORGIVENESS_SINGLE_BASE = c(6500)
export const PA_FORGIVENESS_MARRIED_BASE = c(13000)
export const PA_FORGIVENESS_PER_DEPENDENT = c(9500)

// Each $250 step reduces forgiveness by 10%
export const PA_FORGIVENESS_STEP = c(250)

/** Forgiveness lookup table (unmarried, 0 dependents) */
export const PA_FORGIVENESS_TABLE: { maxIncome: number; percentage: number }[] = [
  { maxIncome: c(6500),  percentage: 100 },
  { maxIncome: c(6750),  percentage: 90 },
  { maxIncome: c(7000),  percentage: 80 },
  { maxIncome: c(7250),  percentage: 70 },
  { maxIncome: c(7500),  percentage: 60 },
  { maxIncome: c(7750),  percentage: 50 },
  { maxIncome: c(8000),  percentage: 40 },
  { maxIncome: c(8250),  percentage: 30 },
  { maxIncome: c(8500),  percentage: 20 },
  { maxIncome: c(8750),  percentage: 10 },
  // Above $8,750: 0%
]

// ── Reciprocal States ─────────────────────────────────────────
// PA has reciprocal agreements with these states — wages earned
// there are exempt from PA tax if taxed by the other state.
export const PA_RECIPROCAL_STATES = ['IN', 'MD', 'NJ', 'OH', 'VA', 'WV'] as const
