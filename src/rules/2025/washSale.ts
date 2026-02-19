/**
 * Wash Sale Detection — IRC §1091
 *
 * A wash sale occurs when a security is sold at a loss and a
 * "substantially identical" security is purchased within 30 days
 * before or after the sale (61-day window).
 *
 * The loss is disallowed and added to the cost basis of the
 * replacement purchase.
 */

import type { CapitalTransaction } from '../../model/types'

// ── Types ──────────────────────────────────────────────────────

export interface WashSaleMatch {
  lossSaleId: string
  replacementId: string
  disallowedLoss: number // cents
  symbol: string
  lossSaleDate: string
  replacementDate: string
}

export interface WashSaleResult {
  matches: WashSaleMatch[]
  adjustedTransactions: CapitalTransaction[]
}

// ── Detection ──────────────────────────────────────────────────

export function detectWashSales(
  transactions: CapitalTransaction[],
): WashSaleResult {
  const matches: WashSaleMatch[] = []
  const adjusted = transactions.map((tx) => ({ ...tx }))

  // Find all loss sales not already flagged with code W
  const lossSales = adjusted.filter(
    (tx) => tx.gainLoss < 0 && tx.adjustmentCode !== 'W',
  )

  for (const lossSale of lossSales) {
    const lossSaleDate = new Date(lossSale.dateSold)
    const windowStart = addDays(lossSaleDate, -30)
    const windowEnd = addDays(lossSaleDate, 30)

    // Find substantially identical purchases within 61-day window
    const replacements = adjusted.filter(
      (tx) =>
        tx.id !== lossSale.id &&
        isSubstantiallyIdentical(lossSale, tx) &&
        tx.dateAcquired !== null &&
        isWithinWindow(new Date(tx.dateAcquired), windowStart, windowEnd),
    )

    if (replacements.length > 0) {
      // Use the earliest replacement
      const replacement = replacements.sort((a, b) =>
        a.dateAcquired!.localeCompare(b.dateAcquired!),
      )[0]

      const disallowedLoss = Math.abs(lossSale.gainLoss)

      matches.push({
        lossSaleId: lossSale.id,
        replacementId: replacement.id,
        disallowedLoss,
        symbol: lossSale.description,
        lossSaleDate: lossSale.dateSold,
        replacementDate: replacement.dateAcquired!,
      })

      // Adjust the loss sale
      const txToAdjust = adjusted.find((tx) => tx.id === lossSale.id)!
      txToAdjust.adjustmentCode = 'W'
      txToAdjust.washSaleLossDisallowed = disallowedLoss
      txToAdjust.adjustmentAmount = disallowedLoss
      txToAdjust.gainLoss = 0 // loss fully disallowed

      // Add disallowed loss to replacement basis
      const repToAdjust = adjusted.find((tx) => tx.id === replacement.id)!
      repToAdjust.adjustedBasis += disallowedLoss
      repToAdjust.gainLoss = repToAdjust.proceeds - repToAdjust.adjustedBasis
    }
  }

  return { matches, adjustedTransactions: adjusted }
}

// ── Helpers ────────────────────────────────────────────────────

function isSubstantiallyIdentical(
  sale: CapitalTransaction,
  candidate: CapitalTransaction,
): boolean {
  const saleDesc = sale.description.toUpperCase().trim()
  const candDesc = candidate.description.toUpperCase().trim()
  return saleDesc === candDesc
}

function isWithinWindow(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
