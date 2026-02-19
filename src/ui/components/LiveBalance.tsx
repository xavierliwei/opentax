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
        className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 text-sm text-gray-400"
      >
        Enter your income to see your balance
      </div>
    )
  }

  const isRefund = line34 > 0
  const amount = isRefund ? line34 : line37
  const label = isRefund ? 'Est. Refund' : amount === 0 ? 'Balanced' : 'Amount Owed'
  const color = isRefund ? 'text-tax-green' : amount === 0 ? 'text-gray-500' : 'text-tax-red'
  const explainNode = isRefund ? 'form1040.line34' : 'form1040.line37'

  return (
    <div
      data-testid="live-balance"
      className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3"
    >
      {/* Label + amount */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-gray-500 shrink-0">{label}</span>
        <span data-testid="live-balance-amount" className={`text-xl font-bold tabular-nums ${color}`}>
          {formatCurrency(amount)}
        </span>
      </div>

      {/* Right side: stats (hidden on mobile) + why link */}
      <div className="flex items-center gap-4 shrink-0">
        <span className="hidden sm:inline text-sm text-gray-500">
          Tax: {formatCurrency(line16)}
        </span>
        <span className="hidden sm:inline text-sm text-gray-500">
          Withheld: {formatCurrency(line25)}
        </span>
        <Link to={`/explain/${explainNode}`} className="text-xs text-brand underline">
          Why?
        </Link>
      </div>
    </div>
  )
}
