import { Link } from 'react-router-dom'
import { useTaxStore } from '../../store/taxStore.ts'

function formatCurrency(cents: number): string {
  const d = Math.abs(cents) / 100
  const formatted = d.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return cents < 0 ? `-${formatted}` : formatted
}

function BalancePill({ label, amount, explainNode, accent }: {
  label: string
  amount: number
  explainNode: string
  accent: { text: string; dot: string; pill: string }
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${accent.pill}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
        {label}
      </span>
      <span className={`text-lg font-bold tabular-nums tracking-tight ${accent.text}`}>
        {formatCurrency(amount)}
      </span>
      <Link
        to={`/explain/${explainNode}`}
        className="text-xs font-medium text-brand hover:text-blue-700 underline underline-offset-2 decoration-brand/40 hover:decoration-brand transition-colors"
      >
        Why?
      </Link>
    </div>
  )
}

function accentFor(isRefund: boolean, amount: number) {
  return isRefund
    ? { text: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-100', dot: 'bg-emerald-400', pill: 'bg-emerald-100 text-emerald-800' }
    : amount === 0
      ? { text: 'text-gray-500', bg: 'bg-gray-50/50', border: 'border-gray-200', dot: 'bg-gray-300', pill: 'bg-gray-100 text-gray-600' }
      : { text: 'text-red-700', bg: 'bg-red-50/50', border: 'border-red-100', dot: 'bg-red-400', pill: 'bg-red-100 text-red-800' }
}

export function LiveBalance() {
  const line34 = useTaxStore((s) => s.computeResult.form1040.line34.amount)
  const line37 = useTaxStore((s) => s.computeResult.form1040.line37.amount)
  const line16 = useTaxStore((s) => s.computeResult.form1040.line16.amount)
  const line25 = useTaxStore((s) => s.computeResult.form1040.line25.amount)
  const hasIncome = useTaxStore((s) => s.computeResult.form1040.line9.amount > 0)
  const form540 = useTaxStore((s) => s.computeResult.form540)

  if (!hasIncome) {
    return (
      <div
        data-testid="live-balance"
        className="sticky top-0 z-40 bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-3 text-sm text-gray-400 italic"
        aria-live="polite"
      >
        Enter your income to see your balance
      </div>
    )
  }

  const fedIsRefund = line34 > 0
  const fedAmount = fedIsRefund ? line34 : line37
  const fedLabel = fedIsRefund ? 'Federal Refund' : fedAmount === 0 ? 'Federal Balanced' : 'Federal Owed'
  const fedExplainNode = fedIsRefund ? 'form1040.line34' : 'form1040.line37'
  const fedAccent = accentFor(fedIsRefund, fedAmount)

  // CA state balance (only when CA resident)
  const caIsRefund = form540 ? form540.overpaid > 0 : false
  const caAmount = form540 ? (caIsRefund ? form540.overpaid : form540.amountOwed) : 0
  const caLabel = form540
    ? (caIsRefund ? 'CA Refund' : caAmount === 0 ? 'CA Balanced' : 'CA Owed')
    : ''
  const caExplainNode = caIsRefund ? 'form540.overpaid' : 'form540.amountOwed'
  const caAccent = accentFor(caIsRefund, caAmount)

  // When no CA, use original single-line layout with larger text
  if (!form540) {
    const label = fedIsRefund ? 'Estimated Refund' : fedAmount === 0 ? 'Balanced' : 'Amount Owed'
    return (
      <div
        data-testid="live-balance"
        className={`sticky top-0 z-40 ${fedAccent.bg} border-b ${fedAccent.border} px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3`}
        aria-live="polite"
        aria-label={`${label}: ${formatCurrency(fedAmount)}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${fedAccent.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${fedAccent.dot}`} />
            {label}
          </span>
          <span data-testid="live-balance-amount" className={`text-xl font-bold tabular-nums tracking-tight ${fedAccent.text}`}>
            {formatCurrency(fedAmount)}
          </span>
        </div>
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
            to={`/explain/${fedExplainNode}`}
            className="ml-2 text-xs font-medium text-brand hover:text-blue-700 underline underline-offset-2 decoration-brand/40 hover:decoration-brand transition-colors"
          >
            Why?
          </Link>
        </div>
      </div>
    )
  }

  // Dual federal + CA layout
  // Use the "worse" accent for the background (if either owes, show red bg)
  const combinedBg = (!fedIsRefund && fedAmount > 0) || (!caIsRefund && caAmount > 0)
    ? 'bg-red-50/50'
    : (fedIsRefund || caIsRefund) ? 'bg-emerald-50/50' : 'bg-gray-50/50'
  const combinedBorder = (!fedIsRefund && fedAmount > 0) || (!caIsRefund && caAmount > 0)
    ? 'border-red-100'
    : (fedIsRefund || caIsRefund) ? 'border-emerald-100' : 'border-gray-200'

  return (
    <div
      data-testid="live-balance"
      className={`sticky top-0 z-40 ${combinedBg} border-b ${combinedBorder} px-4 sm:px-6 py-2 flex items-center justify-between gap-3`}
      aria-live="polite"
      aria-label={`${fedLabel}: ${formatCurrency(fedAmount)}, ${caLabel}: ${formatCurrency(caAmount)}`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-wrap">
        <BalancePill label={fedLabel} amount={fedAmount} explainNode={fedExplainNode} accent={fedAccent} />
        <div className="w-px h-6 bg-gray-300 hidden sm:block" />
        <BalancePill label={caLabel} amount={caAmount} explainNode={caExplainNode} accent={caAccent} />
      </div>
    </div>
  )
}
