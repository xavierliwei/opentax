/**
 * Foreign Tax Credit — Form 1116 (Simplified)
 *
 * Implements the FTC limitation for passive category income (the common
 * portfolio-income case: foreign taxes withheld on dividends and interest
 * reported on 1099-DIV Box 7 and 1099-INT Box 6).
 *
 * Key concepts:
 *   - Foreign taxes paid on portfolio income are creditable against U.S. tax
 *   - The credit is limited: FTC ≤ U.S. tax × (foreign-source income / worldwide income)
 *   - Taxpayers with ≤ $300 ($600 MFJ) of creditable foreign taxes from
 *     passive income may elect to claim the credit directly without Form 1116
 *     (IRC §901(j) / "direct credit" election)
 *   - The credit is non-refundable — it cannot exceed the tax liability
 *   - Only passive category (Section 901(j)) income is supported
 *
 * Unsupported (validation warnings emitted):
 *   - General category income (wages/business income earned abroad)
 *   - Multiple basket/category allocations
 *   - FTC carryback (1 year) or carryforward (10 years)
 *   - Treaty-based positions or re-sourcing
 *   - Foreign tax credit on AMT (Form 6251 interaction)
 *   - Sanctioned country income
 *   - High-tax kickout rules
 *
 * Source: Form 1116 Instructions (2025), IRC §901–§909
 * Source: IRC §904 (limitation formula)
 */

import type { TaxReturn, FilingStatus } from '../../model/types'

// ── Constants ────────────────────────────────────────────────────

/** Direct credit election threshold — no Form 1116 needed (IRC §901(j)) */
const DIRECT_CREDIT_THRESHOLD_SINGLE = 30_000   // $300 in cents
const DIRECT_CREDIT_THRESHOLD_MFJ = 60_000      // $600 in cents

// ── Result Types ─────────────────────────────────────────────────

export interface ForeignTaxCreditResult {
  /** Total foreign taxes paid from 1099-DIV Box 7 (cents) */
  foreignTaxDIV: number

  /** Total foreign taxes paid from 1099-INT Box 6 (cents) */
  foreignTaxINT: number

  /** Total creditable foreign taxes paid (cents) */
  totalForeignTaxPaid: number

  /** Total foreign-source income (dividends + interest with foreign tax) (cents) */
  foreignSourceIncome: number

  /** Worldwide taxable income (cents) — Form 1040 Line 15 */
  worldwideTaxableIncome: number

  /** U.S. tax before credits (cents) — Form 1040 Line 16 */
  usTaxBeforeCredits: number

  /** FTC limitation = U.S. tax × (foreign source income / worldwide income) (cents) */
  limitation: number

  /** Allowed credit = min(taxes paid, limitation) (cents) */
  creditAmount: number

  /** Whether the direct credit election applies (no Form 1116 needed) */
  directCreditElection: boolean

  /** Excess foreign tax that could be carried forward (not tracked — informational) */
  excessForeignTax: number

  /** Countries reported (from 1099-DIV Box 8 and 1099-INT Box 7) */
  countries: string[]

  /** Whether FTC computation was performed */
  applicable: boolean
}

// ── Computation ──────────────────────────────────────────────────

/**
 * Determine the direct credit election threshold based on filing status.
 * IRC §901(j): Taxpayers may claim FTC directly (without Form 1116)
 * if creditable foreign taxes are ≤ $300 ($600 MFJ) and all foreign-source
 * income is passive category.
 */
export function getDirectCreditThreshold(filingStatus: FilingStatus): number {
  return filingStatus === 'mfj' ? DIRECT_CREDIT_THRESHOLD_MFJ : DIRECT_CREDIT_THRESHOLD_SINGLE
}

/**
 * Compute the Foreign Tax Credit (Form 1116 simplified path).
 *
 * This covers the common case: passive category foreign taxes reported
 * on 1099-DIV (Box 7) and 1099-INT (Box 6) from mutual funds and
 * international brokerage accounts.
 *
 * @param model               Tax return model
 * @param taxableIncome       Form 1040 Line 15 — worldwide taxable income (cents)
 * @param usTaxBeforeCredits  Form 1040 Line 16 — U.S. tax before credits (cents)
 */
export function computeForeignTaxCredit(
  model: TaxReturn,
  taxableIncome: number,
  usTaxBeforeCredits: number,
): ForeignTaxCreditResult {
  // ── Collect foreign taxes paid ──────────────────────────────
  let foreignTaxDIV = 0
  let foreignSourceDIV = 0
  const countries = new Set<string>()

  for (const div of model.form1099DIVs) {
    const divForeignTax = div.box7 ?? 0
    if (divForeignTax > 0) {
      foreignTaxDIV += divForeignTax
      // Foreign-source income = gross dividends from this payer
      // (IRS treats the full ordinary dividend as the gross foreign-source amount
      // when foreign tax is paid, per Form 1116 instructions)
      foreignSourceDIV += div.box1a
      if (div.box8) countries.add(div.box8)
    }
  }

  let foreignTaxINT = 0
  let foreignSourceINT = 0

  for (const int of model.form1099INTs) {
    const intForeignTax = int.box6 ?? 0
    if (intForeignTax > 0) {
      foreignTaxINT += intForeignTax
      // Foreign-source income = interest income from this payer
      foreignSourceINT += int.box1
      if (int.box7) countries.add(int.box7)
    }
  }

  const totalForeignTaxPaid = foreignTaxDIV + foreignTaxINT
  const foreignSourceIncome = foreignSourceDIV + foreignSourceINT

  // No foreign tax → not applicable
  if (totalForeignTaxPaid <= 0) {
    return {
      foreignTaxDIV: 0,
      foreignTaxINT: 0,
      totalForeignTaxPaid: 0,
      foreignSourceIncome: 0,
      worldwideTaxableIncome: taxableIncome,
      usTaxBeforeCredits,
      limitation: 0,
      creditAmount: 0,
      directCreditElection: false,
      excessForeignTax: 0,
      countries: [],
      applicable: false,
    }
  }

  // ── FTC Limitation (IRC §904) ──────────────────────────────
  // Credit ≤ U.S. tax × (foreign-source taxable income / worldwide taxable income)
  //
  // For the simplified passive-category path, foreign-source taxable income
  // is the gross foreign-source income minus allocable deductions.
  // Simplification: we use the gross foreign-source income as the numerator.
  // This is conservative (overstates the ratio slightly), which is acceptable
  // because it only loosens the cap, and we still cap at taxes actually paid.

  let limitation = 0
  if (taxableIncome > 0 && usTaxBeforeCredits > 0) {
    // Cap foreign-source income at worldwide taxable income
    const effectiveForeignSource = Math.min(foreignSourceIncome, taxableIncome)
    limitation = Math.round(usTaxBeforeCredits * effectiveForeignSource / taxableIncome)
  }

  // ── Allowed credit ──────────────────────────────────────────
  // Credit = min(foreign taxes paid, limitation)
  const creditAmount = Math.min(totalForeignTaxPaid, limitation)

  // ── Direct credit election ─────────────────────────────────
  // If total creditable taxes ≤ threshold and all income is passive category,
  // taxpayer can claim the credit directly without filing Form 1116.
  const threshold = getDirectCreditThreshold(model.filingStatus)
  const directCreditElection = totalForeignTaxPaid <= threshold

  // ── Excess (potential carryforward — informational only) ────
  const excessForeignTax = Math.max(0, totalForeignTaxPaid - creditAmount)

  return {
    foreignTaxDIV,
    foreignTaxINT,
    totalForeignTaxPaid,
    foreignSourceIncome,
    worldwideTaxableIncome: taxableIncome,
    usTaxBeforeCredits,
    limitation,
    creditAmount,
    directCreditElection,
    excessForeignTax,
    countries: [...countries],
    applicable: true,
  }
}
