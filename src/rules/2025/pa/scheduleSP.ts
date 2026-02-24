/**
 * PA Schedule SP — Tax Forgiveness Credit
 *
 * PA's equivalent of a low-income credit. A refundable credit that
 * reduces tax owed for qualifying filers based on eligibility income.
 *
 * Eligibility income = PA taxable income + nontaxable income
 * (Social Security, gifts, inheritances, tax-exempt interest).
 *
 * Source: 2025 Schedule SP Instructions
 * All amounts in integer cents.
 */

import type { TaxReturn } from '../../../model/types'
import {
  PA_FORGIVENESS_SINGLE_BASE,
  PA_FORGIVENESS_MARRIED_BASE,
  PA_FORGIVENESS_PER_DEPENDENT,
  PA_FORGIVENESS_STEP,
} from './constants'

// ── Result type ──────────────────────────────────────────────

export interface ScheduleSPResult {
  eligibilityIncome: number     // PA taxable + nontaxable income
  numberOfDependents: number
  filingCategory: 'single' | 'married'
  forgivenessPercentage: number // 0–100 in 10% increments
  forgivenessCredit: number     // PA tax × percentage
  qualifies: boolean            // true if any forgiveness applies
}

// ── Eligibility income ──────────────────────────────────────

/**
 * Compute eligibility income for Schedule SP.
 * Includes PA taxable income plus nontaxable sources.
 */
export function computeEligibilityIncome(
  model: TaxReturn,
  paTaxableIncome: number,
): number {
  // Nontaxable: Social Security benefits (net)
  const ssaBenefits = model.formSSA1099s.reduce(
    (sum, ssa) => sum + ssa.box5, 0,
  )

  // Tax-exempt interest (already included in PA taxable via Class 2,
  // but federal tax-exempt interest from PA munis is nontaxable by PA).
  // For simplicity in Phase 1: just add Social Security.
  return paTaxableIncome + Math.max(0, ssaBenefits)
}

// ── Forgiveness percentage lookup ───────────────────────────

/**
 * Determine the forgiveness percentage based on eligibility income,
 * filing category, and number of dependents.
 *
 * The table shifts up by $9,500 per dependent.
 * Married filers use double the single base ($13,000 vs $6,500).
 * Within each bracket, forgiveness drops by 10% per $250 step.
 */
export function lookupForgivenessPercentage(
  eligibilityIncome: number,
  filingCategory: 'single' | 'married',
  numberOfDependents: number,
): number {
  const baseThreshold = filingCategory === 'married'
    ? PA_FORGIVENESS_MARRIED_BASE
    : PA_FORGIVENESS_SINGLE_BASE

  const adjustedBase = baseThreshold + (numberOfDependents * PA_FORGIVENESS_PER_DEPENDENT)

  if (eligibilityIncome <= adjustedBase) return 100

  const excess = eligibilityIncome - adjustedBase
  // Each $250 step (in cents: 25000) reduces by 10%
  const steps = Math.ceil(excess / PA_FORGIVENESS_STEP)

  if (steps >= 10) return 0
  return 100 - (steps * 10)
}

// ── Main computation ────────────────────────────────────────

/**
 * Compute Schedule SP (Tax Forgiveness) for a PA return.
 *
 * @param model - The tax return model
 * @param paTaxableIncome - Adjusted PA taxable income (Line 11, cents)
 * @param paTax - PA tax amount (Line 12, cents)
 */
export function computeScheduleSP(
  model: TaxReturn,
  paTaxableIncome: number,
  paTax: number,
): ScheduleSPResult {
  const filingCategory = (model.filingStatus === 'mfj') ? 'married' : 'single'
  const numberOfDependents = model.dependents.length

  const eligibilityIncome = computeEligibilityIncome(model, paTaxableIncome)

  const forgivenessPercentage = lookupForgivenessPercentage(
    eligibilityIncome, filingCategory, numberOfDependents,
  )

  const forgivenessCredit = Math.round(paTax * forgivenessPercentage / 100)

  return {
    eligibilityIncome,
    numberOfDependents,
    filingCategory,
    forgivenessPercentage,
    forgivenessCredit,
    qualifies: forgivenessPercentage > 0,
  }
}
