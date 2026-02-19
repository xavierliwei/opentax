import { Link } from 'react-router-dom'
import { useTaxStore } from '../../store/taxStore.ts'

function formatCurrency(cents: number): string {
  const d = Math.abs(cents) / 100
  const formatted = d.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return cents < 0 ? `-${formatted}` : formatted
}

export function LiveBalance() {
  const line34 = useTaxStore((s) => s.computeResult.form1040.line34.amount)
  const line37 = useTaxStore((s) => s.computeResult.form1040.line37.amount)
  const line16 = useTaxStore((s) => s.computeResult.form1040.line16.amount)
  const line25 = useTaxStore((s) => s.computeResult.form1040.line25.amount)
  const hasIncome = useTaxStore((s) => s.computeResult.form1040.line9.amount > 0)

  if (!hasIncome) {
    return (
      <div
        data-testid="live-balance"
        className="sticky top-0 z-40 bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-3 text-sm text-gray-400 italic"
      >
        Enter your income to see your balance
      </div>
    )
  }

  const isRefund = line34 > 0
  const amount = isRefund ? line34 : line37
  const label = isRefund ? 'Estimated Refund' : amount === 0 ? 'Balanced' : 'Amount Owed'
  const explainNode = isRefund ? 'form1040.line34' : 'form1040.line37'

  // Color schemes
  const accent = isRefund
    ? { text: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-100', dot: 'bg-emerald-400', pill: 'bg-emerald-100 text-emerald-800' }
    : amount === 0
      ? { text: 'text-gray-500', bg: 'bg-gray-50/50', border: 'border-gray-200', dot: 'bg-gray-300', pill: 'bg-gray-100 text-gray-600' }
      : { text: 'text-red-700', bg: 'bg-red-50/50', border: 'border-red-100', dot: 'bg-red-400', pill: 'bg-red-100 text-red-800' }

  return (
    <div
      data-testid="live-balance"
      className={`sticky top-0 z-40 ${accent.bg} border-b ${accent.border} px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3`}
    >
      {/* Left: refund/owed indicator */}
      <div className="flex items-center gap-3 min-w-0">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${accent.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
          {label}
        </span>
        <span data-testid="live-balance-amount" className={`text-xl font-bold tabular-nums tracking-tight ${accent.text}`}>
          {formatCurrency(amount)}
        </span>
      </div>

      {/* Right: stats + explain link */}
      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Tax</span>
            <span className="text-sm font-semibold text-gray-700 tabular-nums">{formatCurrency(line16)}</span>
          </div>
          <div className="w-px h-7 bg-gray-200" />
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Withheld</span>
            <span className="text-sm font-semibold text-gray-700 tabular-nums">{formatCurrency(line25)}</span>
          </div>
        </div>
        <Link
          to={`/explain/${explainNode}`}
          className="ml-2 text-xs font-medium text-brand hover:text-blue-700 underline underline-offset-2 decoration-brand/40 hover:decoration-brand transition-colors"
        >
          Why?
        </Link>
      </div>
    </div>
  )
}
