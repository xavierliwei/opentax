/**
 * PA Income Classification — Reclassifies income into PA's 8 classes
 *
 * PA does not conform to federal AGI. Instead, it independently classifies
 * income from source documents (W-2s, 1099s, etc.) into 8 classes.
 * Losses in one class cannot offset gains in another class.
 *
 * Nonresident source apportionment:
 *   PA nonresidents are only taxed on PA-source income. Each income class
 *   uses the most specific source data available:
 *   - Class 1 (Compensation): W-2 Box 15 = "PA"
 *   - Class 2 (Interest): Not PA-source for nonresidents (intangible/mobile income)
 *   - Class 3 (Dividends): Not PA-source for nonresidents (intangible/mobile income)
 *   - Class 4 (Business): Schedule C businessState = "PA"
 *   - Class 5 (Net Gains): Form 1099-B propertyState = "PA" (real property in PA)
 *   - Class 6 (Rents/Royalties): Schedule E propertyState = "PA"
 *   - Class 7 (Estate/Trust): K-1 entityState = "PA"
 *   - Class 8 (Gambling): Phase 2 — not yet modeled
 *
 * Source: 2025 PA-40 Instructions, Lines 1a–8; PA-40 NRC Instructions
 * All amounts in integer cents.
 */

import type { TaxReturn, StateReturnConfig, W2, ScheduleC, ScheduleEProperty } from '../../../model/types'

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

/** Check if a Schedule E property is located in PA */
function isPAProperty(p: ScheduleEProperty): boolean {
  return (p.propertyState ?? '') === 'PA'
}

/** Check if a Schedule C business operates in PA */
function isPABusiness(sc: ScheduleC): boolean {
  return (sc.businessState ?? '') === 'PA'
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
 * For full-year residents: all income sources contribute.
 * For nonresidents: only PA-source income is included per PA-40 NRC rules.
 *   - Class 1: W-2 Box 15 = "PA"
 *   - Class 2: $0 (interest is intangible income, not PA-source for NR)
 *   - Class 3: $0 (dividends are intangible income, not PA-source for NR)
 *   - Class 4: Only Schedule C businesses with businessState = "PA"
 *   - Class 5: Only 1099-B transactions with propertyState = "PA"
 *   - Class 6: Only Schedule E properties with propertyState = "PA"
 *   - Class 7: Only K-1 trust-estate with entityState = "PA"
 *   - Class 8: Phase 2 (not yet modeled)
 * For part-year: all income contributes (apportionment handled separately in pa40.ts).
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

  // Class 2 — Interest
  // PA taxes ALL interest including federally tax-exempt (from non-PA issuers).
  // For nonresidents: Interest is intangible/mobile income and is NOT PA-source.
  // Per PA-40 NRC instructions, nonresidents do not report interest income.
  const interest = isNonresident ? 0 : model.form1099INTs.reduce(
    (sum, f) => sum + f.box1 + (f.box8 ?? 0), 0,
  )

  // Class 3 — Dividends (ordinary + capital gain distributions from 1099-DIV)
  // Capital gain distributions go to Class 3, NOT Class 5.
  // For nonresidents: Dividends are intangible/mobile income and NOT PA-source.
  const dividends = isNonresident ? 0 : model.form1099DIVs.reduce(
    (sum, f) => sum + f.box1a + f.box2a, 0,
  )

  // Class 4 — Net Business Income (Schedule C net profit, floor at 0)
  // For nonresidents: only businesses operating in PA (businessState = "PA") are included.
  const relevantBusinesses = isNonresident
    ? model.scheduleCBusinesses.filter(sc => isPABusiness(sc))
    : model.scheduleCBusinesses
  const netBusinessIncome = Math.max(0,
    relevantBusinesses.reduce((sum, sc) => sum + scheduleCNetProfit(sc), 0),
  )

  // Class 5 — Net Gains from Property (floor at 0)
  // PA does NOT allow the federal $3K capital loss deduction
  // Use 1099-B data (not capitalTransactions which include adjustments)
  // For nonresidents: only gains from property located in PA (propertyState = "PA").
  // This primarily applies to real property sales; publicly traded securities are
  // intangible property and NOT PA-source for nonresidents.
  const relevant1099Bs = isNonresident
    ? model.form1099Bs.filter(f => (f.propertyState ?? '') === 'PA')
    : model.form1099Bs
  const netGains = Math.max(0,
    relevant1099Bs.reduce((sum, f) => {
      const basis = f.costBasis ?? 0
      return sum + (f.proceeds - basis)
    }, 0),
  )

  // Class 6 — Rents, Royalties (Schedule E net, floor at 0)
  // For nonresidents: only properties located in PA (propertyState = "PA") are included.
  // Rental income from PA real property is PA-source income.
  const relevantProperties = isNonresident
    ? model.scheduleEProperties.filter(p => isPAProperty(p))
    : model.scheduleEProperties
  const rentsRoyalties = Math.max(0,
    relevantProperties.reduce(
      (sum, p) => sum + scheduleENetIncome(p), 0,
    ),
  )

  // Class 7 — Estate/Trust Income (K-1 trust-estate, floor at 0)
  // For nonresidents: only PA-situs trusts/estates (entityState = "PA") are included.
  const relevantK1s = model.scheduleK1s
    .filter(k1 => k1.entityType === 'trust-estate')
    .filter(k1 => !isNonresident || (k1.entityState ?? '') === 'PA')
  const estateTrustIncome = Math.max(0,
    relevantK1s.reduce((sum, k1) => sum + k1.ordinaryIncome, 0),
  )

  // Class 8 — Gambling/Lottery (not yet captured in model — Phase 2)
  // For nonresidents, only gambling winnings from PA sources would be taxable.
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
