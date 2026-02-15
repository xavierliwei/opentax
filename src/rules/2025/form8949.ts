/**
 * Form 8949 — Sales and Other Dispositions of Capital Assets
 *
 * Groups CapitalTransactions by category (A/B/D/E) and computes
 * per-category totals for proceeds, basis, adjustments, and gain/loss.
 *
 * Source: 2025 Form 8949 instructions
 */

import type { CapitalTransaction, Form8949Category } from '../../model/types'
import type { TracedValue } from '../../model/traced'
import { tracedFromComputation } from '../../model/traced'

// ── Per-category totals ────────────────────────────────────────

export interface Form8949CategoryTotals {
  category: Form8949Category
  transactions: CapitalTransaction[]
  totalProceeds: TracedValue
  totalBasis: TracedValue
  totalAdjustments: TracedValue
  totalGainLoss: TracedValue
}

// ── Full Form 8949 result ──────────────────────────────────────

export interface Form8949Result {
  /** All categories that have at least one transaction */
  categories: Form8949CategoryTotals[]

  /** Quick lookup by category code */
  byCategory: Partial<Record<Form8949Category, Form8949CategoryTotals>>
}

// ── Computation ────────────────────────────────────────────────

function computeCategoryTotals(
  category: Form8949Category,
  transactions: CapitalTransaction[],
): Form8949CategoryTotals {
  const proceeds = transactions.reduce((s, t) => s + t.proceeds, 0)
  const basis = transactions.reduce((s, t) => s + t.adjustedBasis, 0)
  const adjustments = transactions.reduce((s, t) => s + t.adjustmentAmount, 0)
  const gainLoss = transactions.reduce((s, t) => s + t.gainLoss, 0)

  const txIds = transactions.map(t => `tx:${t.id}`)

  return {
    category,
    transactions,
    totalProceeds: tracedFromComputation(
      proceeds,
      `form8949.${category}.proceeds`,
      txIds,
      `Form 8949, Box ${category} — Total Proceeds`,
    ),
    totalBasis: tracedFromComputation(
      basis,
      `form8949.${category}.basis`,
      txIds,
      `Form 8949, Box ${category} — Total Basis`,
    ),
    totalAdjustments: tracedFromComputation(
      adjustments,
      `form8949.${category}.adjustments`,
      txIds,
      `Form 8949, Box ${category} — Total Adjustments`,
    ),
    totalGainLoss: tracedFromComputation(
      gainLoss,
      `form8949.${category}.gainLoss`,
      txIds,
      `Form 8949, Box ${category} — Total Gain/Loss`,
    ),
  }
}

function emptyCategoryTotals(category: Form8949Category): Form8949CategoryTotals {
  return computeCategoryTotals(category, [])
}

/**
 * Compute Form 8949 from capital transactions.
 * Transactions must already have their category assigned (done during intake/RSU step).
 */
export function computeForm8949(transactions: CapitalTransaction[]): Form8949Result {
  const grouped: Record<Form8949Category, CapitalTransaction[]> = {
    A: [], B: [], D: [], E: [],
  }

  for (const tx of transactions) {
    grouped[tx.category].push(tx)
  }

  const allCategories: Form8949Category[] = ['A', 'B', 'D', 'E']
  const categories = allCategories
    .filter(cat => grouped[cat].length > 0)
    .map(cat => computeCategoryTotals(cat, grouped[cat]))

  const byCategory: Partial<Record<Form8949Category, Form8949CategoryTotals>> = {}
  for (const cat of categories) {
    byCategory[cat.category] = cat
  }

  return { categories, byCategory }
}

/**
 * Get totals for a specific category, returning zeros if no transactions.
 */
export function getCategoryTotals(
  result: Form8949Result,
  category: Form8949Category,
): Form8949CategoryTotals {
  return result.byCategory[category] ?? emptyCategoryTotals(category)
}
