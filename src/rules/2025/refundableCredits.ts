/**
 * Line 31 — Other Refundable Credits Framework
 *
 * Extensible architecture for refundable credits that flow to Form 1040 Line 31.
 * Each credit is a separate computation module that implements RefundableCreditProvider.
 *
 * Currently supported:
 *   - Excess Social Security tax withholding (multiple employers)
 *
 * Placeholder (not yet implemented — validation warnings emitted):
 *   - Premium Tax Credit (Form 8962) — ACA marketplace reconciliation
 *   - Credit for tax on undistributed capital gains (Form 2439)
 *   - Credit for federal tax on fuels (Form 4136)
 *
 * Source: Form 1040, Line 31 / Schedule 3, Part II
 */

import type { TaxReturn } from '../../model/types'
import { SS_WAGE_BASE, SS_TAX_RATE } from './constants'
import { computePremiumTaxCredit } from './premiumTaxCredit'
import type { PremiumTaxCreditResult } from './premiumTaxCredit'

// ── Provider interface ─────────────────────────────────────────

export interface RefundableCreditItem {
  creditId: string         // unique identifier, e.g. 'excessSSWithholding'
  description: string      // human-readable label
  amount: number           // cents
  irsCitation: string      // e.g. 'Schedule 3, Line 11'
  formRef?: string         // e.g. 'Form 8962' (optional form reference)
}

export interface RefundableCreditsResult {
  items: RefundableCreditItem[]
  totalLine31: number      // sum of all items (cents)
  warnings: RefundableCreditWarning[]
  premiumTaxCredit: PremiumTaxCreditResult | null  // Form 8962 detail (null if no 1095-A)
  excessAPTCRepayment: number  // cents — excess APTC to repay (flows to Schedule 2, not Line 31)
}

export interface RefundableCreditWarning {
  code: string             // e.g. 'UNSUPPORTED_PTC'
  message: string          // user-facing message
  severity: 'info' | 'warning' | 'error'
}

// ── Excess Social Security Withholding ──────────────────────────
// When a taxpayer has multiple employers, each withholds SS tax on their
// own wages up to the wage base. If total wages exceed the wage base,
// the excess withholding is refundable on Schedule 3 → Line 31.

export function computeExcessSSWithholding(model: TaxReturn): RefundableCreditItem | null {
  if (model.w2s.length < 2) return null  // single employer can't over-withhold

  const totalSSWithheld = model.w2s.reduce((sum, w) => sum + w.box4, 0)
  const maxSSWithholding = Math.round(SS_WAGE_BASE * SS_TAX_RATE)

  if (totalSSWithheld <= maxSSWithholding) return null

  const excess = totalSSWithheld - maxSSWithholding
  return {
    creditId: 'excessSSWithholding',
    description: 'Excess Social Security tax withheld (multiple employers)',
    amount: excess,
    irsCitation: 'Schedule 3, Line 11',
  }
}

// ── Premium Tax Credit (Form 8962) ──────────────────────────────
// ACA marketplace premium reconciliation.
// Computes PTC based on Form 1095-A data and reconciles with APTC.
// Credit portion flows to Line 31; repayment flows to Schedule 2.

export function computePTC(
  model: TaxReturn,
  agi: number,
): { credit: RefundableCreditItem | null; ptcResult: PremiumTaxCreditResult | null; repayment: number } {
  const forms = model.form1095As ?? []
  if (forms.length === 0) {
    return { credit: null, ptcResult: null, repayment: 0 }
  }

  const hasSpouse = model.filingStatus === 'mfj'
  const ptcResult = computePremiumTaxCredit(
    forms,
    agi,
    model.filingStatus,
    model.dependents.length,
    hasSpouse,
  )

  let credit: RefundableCreditItem | null = null
  if (ptcResult.creditAmount > 0) {
    credit = {
      creditId: 'premiumTaxCredit',
      description: 'Premium Tax Credit (Form 8962)',
      amount: ptcResult.creditAmount,
      irsCitation: 'Schedule 3, Line 9',
      formRef: 'Form 8962',
    }
  }

  return {
    credit,
    ptcResult,
    repayment: ptcResult.repaymentAmount,
  }
}

// ── Main computation ──────────────────────────────────────────

/**
 * Compute all Line 31 refundable credits.
 *
 * Aggregates all implemented credit providers and collects warnings
 * for unsupported credit scenarios.
 *
 * @param model  Tax return model
 * @param agi    Adjusted gross income (cents) — needed for PTC computation
 */
export function computeRefundableCredits(model: TaxReturn, agi: number = 0): RefundableCreditsResult {
  const items: RefundableCreditItem[] = []
  const warnings: RefundableCreditWarning[] = []

  // 1. Excess Social Security withholding
  const excessSS = computeExcessSSWithholding(model)
  if (excessSS) items.push(excessSS)

  // 2. Premium Tax Credit (Form 8962) — ACA marketplace reconciliation
  const { credit: ptcCredit, ptcResult, repayment: excessAPTCRepayment } = computePTC(model, agi)
  if (ptcCredit) items.push(ptcCredit)

  // Framework: add additional credit providers here as they are implemented.
  // Each provider returns a RefundableCreditItem or null.

  const totalLine31 = items.reduce((sum, item) => sum + item.amount, 0)

  return { items, totalLine31, warnings, premiumTaxCredit: ptcResult, excessAPTCRepayment }
}
