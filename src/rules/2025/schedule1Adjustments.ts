/**
 * Schedule 1 — Additional adjustments to income not covered by other modules.
 *
 * Line 2a — Alimony received (income, pre-2019 agreements only)
 * Line 11 — Educator expenses ($300 per educator, $600 MFJ if both qualify)
 * Line 16 — Self-employed SEP/SIMPLE/qualified plans
 * Line 17 — Self-employed health insurance deduction
 *
 * All monetary amounts are in integer cents.
 */

import type { TaxReturn } from '../../model/types'

// ── Constants (2025 tax year) ────────────────────────────────────

/** Maximum educator expense deduction per qualifying educator (IRC §62(a)(2)(D)) */
export const EDUCATOR_EXPENSES_MAX = 30000 // $300

// ── Alimony Received (Line 2a) ──────────────────────────────────

export interface AlimonyReceivedResult {
  amount: number          // cents — taxable alimony received
  payerSSN: string
  agreementDate: string
}

/**
 * Alimony received is taxable income ONLY for divorce/separation agreements
 * executed before January 1, 2019 (TCJA §11051).
 * Post-2018 agreements: alimony is neither income to the recipient
 * nor deductible by the payer.
 */
export function computeAlimonyReceived(model: TaxReturn): AlimonyReceivedResult | null {
  const amount = model.alimonyReceived ?? 0
  if (amount <= 0) return null

  const agreementDate = model.alimonyAgreementDate ?? ''
  // Only taxable for pre-2019 agreements
  if (agreementDate && agreementDate >= '2019-01-01') return null

  return {
    amount,
    payerSSN: model.alimonyPayerSSN ?? '',
    agreementDate,
  }
}

// ── Educator Expenses (Line 11) ──────────────────────────────────

export interface EducatorExpensesResult {
  taxpayerAmount: number    // cents — taxpayer's deductible amount (capped at $300)
  spouseAmount: number      // cents — spouse's deductible amount (capped at $300, MFJ only)
  totalDeduction: number    // cents — sum of both
}

/**
 * Eligible educators can deduct up to $300 of unreimbursed expenses for
 * books, supplies, equipment, and professional development courses.
 * MFJ: each spouse can claim up to $300 if both are educators ($600 total).
 * IRC §62(a)(2)(D), indexed for inflation.
 */
export function computeEducatorExpenses(model: TaxReturn): EducatorExpensesResult | null {
  const taxpayerRaw = model.educatorExpenses ?? 0
  const spouseRaw = model.spouseEducatorExpenses ?? 0
  if (taxpayerRaw <= 0 && spouseRaw <= 0) return null

  const taxpayerAmount = Math.min(taxpayerRaw, EDUCATOR_EXPENSES_MAX)
  const spouseAmount = (model.filingStatus === 'mfj' || model.filingStatus === 'mfs')
    ? Math.min(spouseRaw, EDUCATOR_EXPENSES_MAX)
    : 0
  const totalDeduction = taxpayerAmount + spouseAmount

  if (totalDeduction <= 0) return null
  return { taxpayerAmount, spouseAmount, totalDeduction }
}

// ── Self-Employed Health Insurance (Line 17) ─────────────────────

export interface SEHealthInsuranceResult {
  premiumsPaid: number        // cents — total premiums entered
  netSEProfit: number         // cents — net SE earnings (cap)
  deductibleAmount: number    // cents — min(premiums, net SE profit)
}

/**
 * Self-employed individuals can deduct health, dental, and long-term care
 * insurance premiums for themselves, their spouse, and dependents.
 *
 * Limitations (IRC §162(l)):
 * - Cannot exceed net SE profit (Schedule C line 31, minus deductible SE tax)
 * - Not available for months where employer-subsidized coverage was available
 * - Cannot be taken if the taxpayer is eligible for employer-subsidized plan
 *
 * We simplify: deduction = min(premiums entered, total Schedule C net profit).
 * The user is responsible for excluding months with employer coverage.
 */
export function computeSEHealthInsurance(
  model: TaxReturn,
  scheduleCNetProfit: number,
): SEHealthInsuranceResult | null {
  const premiums = model.seHealthInsurancePremiums ?? 0
  if (premiums <= 0) return null

  // Deduction limited to net SE earnings
  const deductibleAmount = Math.min(premiums, Math.max(0, scheduleCNetProfit))

  return {
    premiumsPaid: premiums,
    netSEProfit: scheduleCNetProfit,
    deductibleAmount,
  }
}

// ── Self-Employed SEP/SIMPLE/Qualified Plans (Line 16) ───────────

export interface SESepSimpleResult {
  contributionAmount: number  // cents — amount entered
  deductibleAmount: number    // cents — allowed deduction
}

/**
 * Self-employed individuals can deduct contributions to:
 * - SEP-IRA (up to 25% of net SE earnings, max $69,000 for 2025)
 * - SIMPLE-IRA (up to $16,500 for 2025, $20,000 if 50+)
 * - Solo 401(k) / Keogh
 *
 * We simplify: the user enters the contribution amount, and we take it as-is.
 * Full SEP limit calculation (25% of net SE earnings minus deductible SE tax)
 * is complex and best handled by the plan administrator. The user is responsible
 * for not exceeding their plan's limit.
 */
export function computeSESepSimple(model: TaxReturn): SESepSimpleResult | null {
  const amount = model.seSepSimpleContributions ?? 0
  if (amount <= 0) return null

  return {
    contributionAmount: amount,
    deductibleAmount: amount,
  }
}
