/**
 * RSU Basis Adjustment
 *
 * Detects and corrects the common double-taxation trap where brokers
 * report $0 (or incorrect) cost basis on 1099-B for RSU share sales.
 *
 * The correct basis is FMV at vest date × shares sold, because that
 * income was already taxed as ordinary income on the W-2.
 *
 * Produces CapitalTransaction[] with proper basis, adjustment codes,
 * and linkage to RSU vest events.
 */

import type {
  Form1099B,
  RSUVestEvent,
  CapitalTransaction,
  Form8949Category,
} from '../../model/types'

// ── Match result ───────────────────────────────────────────────

export interface RSUMatch {
  form1099B: Form1099B
  vestEvent: RSUVestEvent
  confidence: number         // 0–1
  matchReason: string        // human-readable explanation
}

export interface RSUMatchResult {
  matched: RSUMatch[]
  unmatched1099Bs: Form1099B[]
}

// ── Basis analysis ─────────────────────────────────────────────

export type BasisStatus = 'zero' | 'incorrect' | 'correct'

export interface BasisAnalysis {
  match: RSUMatch
  status: BasisStatus
  reportedBasis: number      // cents (from 1099-B)
  correctBasis: number       // cents (FMV at vest × shares)
  discrepancy: number        // cents (correct - reported)
}

// ── Processing result ──────────────────────────────────────────

export interface RSUProcessingResult {
  transactions: CapitalTransaction[]
  analyses: BasisAnalysis[]
}

// ── Impact estimate ────────────────────────────────────────────

export interface RSUImpactEstimate {
  totalAdjustmentAmount: number  // cents
  estimatedTaxSaved: number      // cents (at estimated marginal rate)
  marginalRateUsed: number       // decimal rate used for estimate
}

// ── Matching ───────────────────────────────────────────────────

/**
 * Days of tolerance when matching acquisition date to vest date.
 * Brokers sometimes report the trade date instead of vest date,
 * or dates may be off by a day due to settlement.
 */
const DATE_TOLERANCE_DAYS = 3

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA)
  const b = new Date(dateB)
  return Math.abs(Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)))
}

function datesMatch(date1099B: string | null, vestDate: string): boolean {
  if (!date1099B) return false
  return daysBetween(date1099B, vestDate) <= DATE_TOLERANCE_DAYS
}

function symbolOrCusipMatch(form1099B: Form1099B, vest: RSUVestEvent): boolean {
  // CUSIP match is strongest
  if (form1099B.cusip && vest.cusip && form1099B.cusip === vest.cusip) {
    return true
  }
  // Fall back to symbol in description (case-insensitive)
  if (vest.symbol && form1099B.description.toUpperCase().includes(vest.symbol.toUpperCase())) {
    return true
  }
  return false
}

/**
 * Match 1099-B entries to RSU vest events.
 *
 * Matching criteria (in priority order):
 * 1. CUSIP or symbol match
 * 2. Acquisition date ≈ vest date (within tolerance)
 * 3. Description contains "RSU" hint (bonus confidence)
 *
 * Each 1099-B is matched to at most one vest event.
 * Each vest event can match multiple 1099-Bs (partial sales).
 */
export function matchRSUToSales(
  form1099Bs: Form1099B[],
  vestEvents: RSUVestEvent[],
): RSUMatchResult {
  const matched: RSUMatch[] = []
  const unmatched1099Bs: Form1099B[] = []

  for (const sale of form1099Bs) {
    let bestMatch: RSUMatch | null = null

    for (const vest of vestEvents) {
      let confidence = 0
      const reasons: string[] = []

      // Security match (required)
      if (!symbolOrCusipMatch(sale, vest)) continue

      // Date match
      if (datesMatch(sale.dateAcquired, vest.vestDate)) {
        confidence += 0.6
        reasons.push(`acquisition date matches vest date`)
      } else if (sale.dateAcquired === null) {
        // "Various" date — weaker signal, but CUSIP match is still meaningful
        confidence += 0.3
        reasons.push(`date is "Various", matched by security`)
      } else {
        // Date doesn't match — not this vest lot
        continue
      }

      // CUSIP vs symbol
      if (sale.cusip && vest.cusip && sale.cusip === vest.cusip) {
        confidence += 0.3
        reasons.push(`CUSIP match (${sale.cusip})`)
      } else {
        confidence += 0.1
        reasons.push(`symbol match (${vest.symbol})`)
      }

      // RSU hint in description
      if (sale.description.toUpperCase().includes('RSU')) {
        confidence += 0.1
        reasons.push(`description contains "RSU"`)
      }

      confidence = Math.min(confidence, 1.0)

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          form1099B: sale,
          vestEvent: vest,
          confidence,
          matchReason: reasons.join('; '),
        }
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.4) {
      matched.push(bestMatch)
    } else {
      unmatched1099Bs.push(sale)
    }
  }

  return { matched, unmatched1099Bs }
}

// ── Basis analysis ─────────────────────────────────────────────

/**
 * Analyze whether a matched 1099-B has correct RSU basis.
 */
export function analyzeBasis(match: RSUMatch): BasisAnalysis {
  const reportedBasis = match.form1099B.costBasis ?? 0

  // Correct basis = FMV at vest × sharesDelivered
  // (assuming full sale of delivered shares — most common RSU pattern)
  const correctBasisFromVest = match.vestEvent.fmvAtVest * match.vestEvent.sharesDelivered

  let status: BasisStatus
  // Allow 1% tolerance for rounding
  const tolerance = Math.max(Math.abs(correctBasisFromVest) * 0.01, 100) // at least $1
  if (reportedBasis === 0) {
    status = 'zero'
  } else if (Math.abs(reportedBasis - correctBasisFromVest) > tolerance) {
    status = 'incorrect'
  } else {
    status = 'correct'
  }

  return {
    match,
    status,
    reportedBasis,
    correctBasis: correctBasisFromVest,
    discrepancy: correctBasisFromVest - reportedBasis,
  }
}

// ── Transaction generation ─────────────────────────────────────

function isLongTerm(dateAcquired: string | null, dateSold: string): boolean {
  if (!dateAcquired) return false  // default to short-term if unknown
  const acquired = new Date(dateAcquired)
  const sold = new Date(dateSold)
  // Long-term = held more than 1 year
  const oneYearLater = new Date(acquired)
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
  return sold > oneYearLater
}

function classifyCategory(longTerm: boolean, basisReportedToIrs: boolean): Form8949Category {
  if (longTerm) {
    return basisReportedToIrs ? 'D' : 'E'
  } else {
    return basisReportedToIrs ? 'A' : 'B'
  }
}

/**
 * Convert a 1099-B into a CapitalTransaction (no RSU adjustment).
 */
export function form1099BToTransaction(sale: Form1099B): CapitalTransaction {
  const reportedBasis = sale.costBasis ?? 0
  const longTerm = sale.longTerm ?? isLongTerm(sale.dateAcquired, sale.dateSold)
  const category = classifyCategory(longTerm, sale.basisReportedToIrs)

  // Wash sale: disallowed loss is added back in column g of Form 8949,
  // increasing gain (or reducing loss). gainLoss = proceeds − basis + washSale.
  const washSale = sale.washSaleLossDisallowed ?? 0

  return {
    id: `tx-${sale.id}`,
    description: sale.description,
    dateAcquired: sale.dateAcquired,
    dateSold: sale.dateSold,
    proceeds: sale.proceeds,
    reportedBasis,
    adjustedBasis: reportedBasis,
    adjustmentCode: washSale > 0 ? 'W' : null,
    adjustmentAmount: washSale,
    gainLoss: sale.proceeds - reportedBasis + washSale,
    washSaleLossDisallowed: washSale,
    longTerm,
    category,
    source1099BId: sale.id,
  }
}

/**
 * Convert a matched RSU sale into a CapitalTransaction with basis adjustment.
 */
export function rsuMatchToTransaction(analysis: BasisAnalysis): CapitalTransaction {
  const sale = analysis.match.form1099B
  const longTerm = sale.longTerm ?? isLongTerm(sale.dateAcquired, sale.dateSold)

  // RSU with basis adjustment → basis was NOT correctly reported
  // Use category B (short-term) or E (long-term) since basis is wrong on 1099-B
  const needsAdjustment = analysis.status !== 'correct'
  const category = needsAdjustment
    ? classifyCategory(longTerm, false)  // basis NOT correctly reported
    : classifyCategory(longTerm, sale.basisReportedToIrs)

  const adjustedBasis = needsAdjustment ? analysis.correctBasis : analysis.reportedBasis
  const adjustmentAmount = adjustedBasis - analysis.reportedBasis

  return {
    id: `tx-rsu-${sale.id}`,
    description: sale.description,
    dateAcquired: sale.dateAcquired,
    dateSold: sale.dateSold,
    proceeds: sale.proceeds,
    reportedBasis: analysis.reportedBasis,
    adjustedBasis,
    adjustmentCode: needsAdjustment ? 'B' : null,
    adjustmentAmount,
    gainLoss: sale.proceeds - adjustedBasis,
    washSaleLossDisallowed: sale.washSaleLossDisallowed,
    longTerm,
    category,
    source1099BId: sale.id,
    linkedRsuVestId: analysis.match.vestEvent.id,
  }
}

// ── Main processing pipeline ───────────────────────────────────

/**
 * Process all 1099-B entries against RSU vest events.
 *
 * 1. Match 1099-Bs to vest events
 * 2. Analyze basis for matches
 * 3. Generate CapitalTransactions (with adjustments for RSU, plain for non-RSU)
 */
export function processRSUAdjustments(
  form1099Bs: Form1099B[],
  vestEvents: RSUVestEvent[],
): RSUProcessingResult {
  const matchResult = matchRSUToSales(form1099Bs, vestEvents)

  const analyses: BasisAnalysis[] = matchResult.matched.map(m => analyzeBasis(m))

  const rsuTransactions = analyses.map(a => rsuMatchToTransaction(a))
  const plainTransactions = matchResult.unmatched1099Bs.map(s => form1099BToTransaction(s))

  return {
    transactions: [...rsuTransactions, ...plainTransactions],
    analyses,
  }
}

// ── Impact calculator ──────────────────────────────────────────

/**
 * Estimate the tax savings from RSU basis adjustments.
 *
 * Uses a rough marginal rate estimate. The actual tax impact depends
 * on the full return, but this gives the user a ballpark motivation.
 */
export function estimateRSUImpact(
  analyses: BasisAnalysis[],
  estimatedMarginalRate: number = 0.24,
): RSUImpactEstimate {
  const totalAdjustment = analyses
    .filter(a => a.status !== 'correct')
    .reduce((sum, a) => sum + a.discrepancy, 0)

  return {
    totalAdjustmentAmount: totalAdjustment,
    estimatedTaxSaved: Math.round(totalAdjustment * estimatedMarginalRate),
    marginalRateUsed: estimatedMarginalRate,
  }
}
