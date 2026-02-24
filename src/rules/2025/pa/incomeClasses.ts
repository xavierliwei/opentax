/**
 * PA Income Classification — Reclassifies income into PA's 8 classes
 *
 * PA does not conform to federal AGI. Instead, it independently classifies
 * income from source documents (W-2s, 1099s, etc.) into 8 classes.
 * Losses in one class cannot offset gains in another class.
 *
 * Source: 2025 PA-40 Instructions, Lines 1a–8
 * All amounts in integer cents.
 */

import type { TaxReturn, StateReturnConfig, W2, ScheduleC } from '../../../model/types'

// ── Result types ──────────────────────────────────────────────

/** PA's 8 income classes, each computed independently */
export interface PAIncomeClasses {
  compensation: number          // Line 1a: W-2 wages (PA state wages)
  unreimbursedExpenses: number  // Line 1b: Schedule UE (Phase 2)
  netCompensation: number       // Line 1a - Line 1b (floor 0)
  interest: number              // Line 2: 1099-INT taxable + tax-exempt non-PA
  dividends: number             // Line 3: 1099-DIV ordinary + qualified + cap gain dist
  netBusinessIncome: number     // Line 4: Schedule C net profit (floor 0)
  netGains: number              // Line 5: 1099-B net gains (floor 0 — no loss carryover)
  rentsRoyalties: number        // Line 6: Schedule E net (floor 0)
  estateTrustIncome: number     // Line 7: K-1 estate/trust (floor 0)
  gamblingWinnings: number      // Line 8: W-2G + other gambling (Phase 2)
}

// ── Helpers ───────────────────────────────────────────────────

/** Check if a W-2 is from a PA employer */
function isPAW2(w2: W2): boolean {
  return w2.box15State === 'PA'
}

/** Compute net profit/loss for a single Schedule C business (simplified for PA) */
function scheduleCNetProfit(sc: ScheduleC): number {
  const grossProfit = sc.grossReceipts - sc.returns - sc.costOfGoodsSold
  const mealsDeductible = Math.round(sc.meals * 0.50)
  const totalExpenses =
    sc.advertising + sc.carAndTruck + sc.commissions + sc.contractLabor +
    sc.depreciation + sc.insurance + sc.mortgageInterest + sc.otherInterest +
    sc.legal + sc.officeExpense + sc.rent + sc.repairs + sc.supplies +
    sc.taxes + sc.travel + mealsDeductible + sc.utilities + sc.wages +
    sc.otherExpenses
  return grossProfit - totalExpenses
}

/** Compute net rental income for a Schedule E property */
function scheduleENetIncome(p: {
  rentsReceived: number; royaltiesReceived: number
  advertising: number; auto: number; cleaning: number; commissions: number
  insurance: number; legal: number; management: number; mortgageInterest: number
  otherInterest: number; repairs: number; supplies: number; taxes: number
  utilities: number; depreciation: number; other: number
}): number {
  const income = p.rentsReceived + p.royaltiesReceived
  const expenses =
    p.advertising + p.auto + p.cleaning + p.commissions + p.insurance +
    p.legal + p.management + p.mortgageInterest + p.otherInterest +
    p.repairs + p.supplies + p.taxes + p.utilities + p.depreciation + p.other
  return income - expenses
}

// ── Core classification ───────────────────────────────────────

/**
 * Classify all income in the TaxReturn into PA's 8 classes.
 *
 * For full-year residents: all W-2s contribute to compensation.
 * For nonresidents: only PA W-2s (Box 15 = "PA") contribute.
 * For part-year: all W-2s contribute (apportionment handled separately).
 */
export function classifyPAIncome(
  model: TaxReturn,
  config: StateReturnConfig,
): PAIncomeClasses {
  // Class 1 — Compensation
  // Use W-2 Box 16 (state wages) where Box 15 = "PA", else fall back to Box 1
  // Full-year residents: all W-2s count
  // Nonresidents: only PA W-2s count
  const isNonresident = config.residencyType === 'nonresident'
  const relevantW2s = isNonresident
    ? model.w2s.filter(w2 => isPAW2(w2))
    : model.w2s

  const compensation = relevantW2s.reduce((sum, w2) => {
    // Prefer Box 16 (PA state wages) for PA W-2s, fall back to Box 1
    const wages = (isPAW2(w2) && w2.box16StateWages != null)
      ? w2.box16StateWages
      : w2.box1
    return sum + wages
  }, 0)

  // Line 1b — Unreimbursed employee expenses (Phase 2 — not yet modeled)
  const unreimbursedExpenses = 0
  const netCompensation = Math.max(0, compensation - unreimbursedExpenses)

  // Classes 2–8: For nonresidents, only PA-source income is taxable.
  // Since we cannot determine PA-source investment income without
  // additional source tracking, nonresidents report $0 for classes 2–8
  // (only PA-sourced compensation via W-2 Box 15 is included).

  // Class 2 — Interest
  // PA taxes ALL interest including federally tax-exempt (from non-PA issuers)
  const interest = isNonresident ? 0 : model.form1099INTs.reduce(
    (sum, f) => sum + f.box1 + (f.box8 ?? 0), 0,
  )

  // Class 3 — Dividends (ordinary + capital gain distributions from 1099-DIV)
  // Capital gain distributions go to Class 3, NOT Class 5
  const dividends = isNonresident ? 0 : model.form1099DIVs.reduce(
    (sum, f) => sum + f.box1a + f.box2a, 0,
  )

  // Class 4 — Net Business Income (Schedule C net profit, floor at 0)
  const netBusinessIncome = isNonresident ? 0 : Math.max(0,
    model.scheduleCBusinesses.reduce((sum, sc) => sum + scheduleCNetProfit(sc), 0),
  )

  // Class 5 — Net Gains from Property (floor at 0)
  // PA does NOT allow the federal $3K capital loss deduction
  // Use 1099-B data (not capitalTransactions which include adjustments)
  const netGains = isNonresident ? 0 : Math.max(0,
    model.form1099Bs.reduce((sum, f) => {
      const basis = f.costBasis ?? 0
      return sum + (f.proceeds - basis)
    }, 0),
  )

  // Class 6 — Rents, Royalties (Schedule E net, floor at 0)
  const rentsRoyalties = isNonresident ? 0 : Math.max(0,
    model.scheduleEProperties.reduce(
      (sum, p) => sum + scheduleENetIncome(p), 0,
    ),
  )

  // Class 7 — Estate/Trust Income (K-1 trust-estate, floor at 0)
  const estateTrustIncome = isNonresident ? 0 : Math.max(0,
    model.scheduleK1s
      .filter(k1 => k1.entityType === 'trust-estate')
      .reduce((sum, k1) => sum + k1.ordinaryIncome, 0),
  )

  // Class 8 — Gambling/Lottery (not yet captured in model — Phase 2)
  const gamblingWinnings = 0

  return {
    compensation,
    unreimbursedExpenses,
    netCompensation,
    interest,
    dividends,
    netBusinessIncome,
    netGains,
    rentsRoyalties,
    estateTrustIncome,
    gamblingWinnings,
  }
}

/**
 * Sum only positive income classes for PA Line 9 (Total PA Taxable Income).
 * Negative classes are floored at $0 — losses in one class cannot offset others.
 */
export function sumPositiveClasses(classes: PAIncomeClasses): number {
  return (
    Math.max(0, classes.netCompensation) +
    Math.max(0, classes.interest) +
    Math.max(0, classes.dividends) +
    Math.max(0, classes.netBusinessIncome) +
    Math.max(0, classes.netGains) +
    Math.max(0, classes.rentsRoyalties) +
    Math.max(0, classes.estateTrustIncome) +
    Math.max(0, classes.gamblingWinnings)
  )
}
