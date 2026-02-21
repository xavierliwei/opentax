import type { BasisAnalysis, RSUImpactEstimate } from '../../rules/2025/rsuAdjustment.ts'

function formatCurrency(cents: number): string {
  const d = Math.abs(cents) / 100
  return d.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/** Full banner shown on StockSalesPage with per-lot detail. */
export function RSUBasisBanner({
  analyses,
  impact,
}: {
  analyses: BasisAnalysis[]
  impact: RSUImpactEstimate
}) {
  const adjustments = analyses.filter(a => a.status !== 'correct')
  if (adjustments.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <h3 className="text-sm font-semibold text-amber-800">
        RSU Cost Basis Adjustments
      </h3>
      <p className="text-xs text-amber-700 mt-1">
        {adjustments.length} transaction{adjustments.length !== 1 ? 's' : ''} had
        broker-reported basis that differs from FMV at vest. OpenTax adjusts the
        basis so you are not double-taxed on income already included in your W-2.
      </p>
      <div className="mt-2 flex flex-col gap-1 text-xs text-amber-800">
        <div className="flex justify-between">
          <span>Total basis adjustment</span>
          <span className="font-medium tabular-nums">
            {formatCurrency(impact.totalAdjustmentAmount)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Estimated tax savings</span>
          <span className="font-medium tabular-nums text-emerald-700">
            ~{formatCurrency(impact.estimatedTaxSaved)}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Compact summary shown on RSUIncomePage (no per-lot detail). */
export function RSUBasisSummary({
  adjustmentCount,
  totalAdjustment,
  estimatedTaxSaved,
}: {
  adjustmentCount: number
  totalAdjustment: number
  estimatedTaxSaved: number
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <h3 className="text-sm font-semibold text-amber-800">
        Basis Adjustment Preview
      </h3>
      <p className="text-xs text-amber-700 mt-1">
        {adjustmentCount} stock sale{adjustmentCount !== 1 ? 's' : ''} may need
        cost basis correction based on your vest events.
      </p>
      <div className="mt-2 flex flex-col gap-1 text-xs text-amber-800">
        <div className="flex justify-between">
          <span>Total adjustment</span>
          <span className="font-medium tabular-nums">
            {formatCurrency(totalAdjustment)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Estimated tax savings</span>
          <span className="font-medium tabular-nums text-emerald-700">
            ~{formatCurrency(estimatedTaxSaved)}
          </span>
        </div>
      </div>
    </div>
  )
}
