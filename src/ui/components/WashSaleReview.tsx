import type { WashSaleMatch } from '../../rules/2025/washSale.ts'
import type { CapitalTransaction } from '../../model/types.ts'

function formatCurrency(cents: number): string {
  const d = Math.abs(cents) / 100
  const formatted = d.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return cents < 0 ? `-${formatted}` : formatted
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

interface WashSaleReviewProps {
  matches: WashSaleMatch[]
  transactions: CapitalTransaction[]
  onAccept: (matchIndex: number) => void
  onOverride: (matchIndex: number) => void
  decisions: Array<'pending' | 'accepted' | 'overridden'>
}

export function WashSaleReview({
  matches,
  transactions,
  onAccept,
  onOverride,
  decisions,
}: WashSaleReviewProps) {
  if (matches.length === 0) return null

  const txMap = new Map(transactions.map((tx) => [tx.id, tx]))

  return (
    <div data-testid="wash-sale-review" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-yellow-600 text-lg">&#9888;</span>
        <h3 className="text-sm font-semibold text-gray-900">
          {matches.length} Wash Sale{matches.length > 1 ? 's' : ''} Detected
        </h3>
      </div>

      {matches.map((match, i) => {
        const lossTx = txMap.get(match.lossSaleId)
        const decision = decisions[i]

        return (
          <div
            key={match.lossSaleId}
            data-testid={`wash-sale-match-${i}`}
            className={`border rounded-lg p-4 flex flex-col gap-3 ${
              decision === 'overridden'
                ? 'border-gray-300 bg-gray-50'
                : 'border-yellow-200 bg-yellow-50'
            }`}
          >
            <div className="font-medium text-sm text-gray-900">{match.symbol}</div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {/* Loss sale */}
              <div className="flex flex-col gap-1">
                <span className="font-medium text-gray-700">Loss sale</span>
                <span className="text-gray-600">
                  Sold {formatDate(match.lossSaleDate)}
                </span>
                {lossTx && (
                  <>
                    <span className="text-gray-600">
                      Proceeds: {formatCurrency(lossTx.proceeds)}
                    </span>
                    <span className="text-gray-600">
                      Basis: {formatCurrency(lossTx.reportedBasis)}
                    </span>
                    <span className="text-red-600 font-medium">
                      Loss: {formatCurrency(-(match.disallowedLoss))}
                    </span>
                  </>
                )}
              </div>

              {/* Replacement */}
              <div className="flex flex-col gap-1">
                <span className="font-medium text-gray-700">Replacement</span>
                <span className="text-gray-600">
                  Bought {formatDate(match.replacementDate)}
                </span>
                <span className="text-gray-500 text-xs">(within 30 days)</span>
              </div>
            </div>

            <div className="text-sm text-gray-700">
              {decision === 'overridden' ? (
                <span className="text-gray-500">
                  Override applied — loss of {formatCurrency(match.disallowedLoss)} kept.
                </span>
              ) : (
                <span>
                  Result: {formatCurrency(match.disallowedLoss)} loss disallowed (code W).
                  Added to replacement basis.
                </span>
              )}
            </div>

            {decision === 'pending' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm font-medium text-white bg-brand rounded-md hover:bg-blue-900"
                  onClick={() => onAccept(i)}
                  data-testid={`wash-accept-${i}`}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  onClick={() => onOverride(i)}
                  data-testid={`wash-override-${i}`}
                >
                  Override — keep loss
                </button>
              </div>
            )}

            {decision === 'accepted' && (
              <span className="text-xs text-green-600 font-medium">Accepted</span>
            )}
            {decision === 'overridden' && (
              <span className="text-xs text-gray-500 font-medium">Overridden</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
