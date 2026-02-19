/**
 * Convert Form1099B[] (from broker CSV parsers) to CapitalTransaction[]
 * (the format used by the tax store and rules engine).
 */

import type { Form1099B } from '../../model/types'
import type { CapitalTransaction, Form8949Category } from '../../model/types'

function getCategory(b: Form1099B): Form8949Category {
  const basisReported = b.basisReportedToIrs && !b.noncoveredSecurity
  if (b.longTerm) return basisReported ? 'D' : 'E'
  return basisReported ? 'A' : 'B'
}

export function convertToCapitalTransactions(
  form1099Bs: Form1099B[],
): CapitalTransaction[] {
  return form1099Bs.map((b, i) => {
    const category = getCategory(b)
    return {
      id: `csv-${i}`,
      description: b.description,
      dateAcquired: b.dateAcquired,
      dateSold: b.dateSold,
      proceeds: b.proceeds,
      reportedBasis: b.costBasis ?? 0,
      adjustedBasis: b.costBasis ?? 0,
      adjustmentCode: b.costBasis === null ? 'B' : null,
      adjustmentAmount: 0,
      gainLoss: b.gainLoss,
      washSaleLossDisallowed: b.washSaleLossDisallowed,
      longTerm: b.longTerm ?? false,
      category,
      source1099BId: b.id,
    }
  })
}
