import { Link } from 'react-router-dom'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { InterviewNav } from './InterviewNav.tsx'
function formatCurrency(cents: number): string {
  const d = Math.abs(cents) / 100
  const formatted = d.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return cents < 0 ? `-${formatted}` : formatted
}

function maskSSN(ssn: string): string {
  if (ssn.length < 4) return ssn
  return `***-**-${ssn.slice(-4)}`
}

interface LineItemProps {
  label: string
  nodeId: string
  amount: number
}

function LineItem({ label, nodeId, amount }: LineItemProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-gray-700 min-w-0">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-medium tabular-nums">{formatCurrency(amount)}</span>
        <Link
          to={`/explain/${nodeId}`}
          className="text-xs text-tax-blue hover:text-blue-700"
          title="Why this number?"
        >
          ?
        </Link>
      </div>
    </div>
  )
}

export function ReviewPage() {
  const taxReturn = useTaxStore((s) => s.taxReturn)
  const form1040 = useTaxStore((s) => s.computeResult.form1040)
  const executedSchedules = useTaxStore((s) => s.computeResult.executedSchedules)
  const interview = useInterview()

  const FILING_STATUS_LABELS: Record<string, string> = {
    single: 'Single',
    mfj: 'Married Filing Jointly',
    mfs: 'Married Filing Separately',
    hoh: 'Head of Household',
    qw: 'Qualifying Surviving Spouse',
  }

  return (
    <div data-testid="page-review" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Review Your Return</h1>
      <p className="mt-1 text-sm text-gray-600">
        Review your tax return summary. Click [?] to see how any number was calculated.
      </p>

      {/* Filing info */}
      <div className="mt-6 flex flex-col gap-2">
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-gray-600 shrink-0">Filing Status:</span>
          <div className="flex items-center gap-2 justify-end">
            <span className="font-medium text-right">{FILING_STATUS_LABELS[taxReturn.filingStatus]}</span>
            <Link to="/interview/filing-status" className="text-xs text-tax-blue hover:text-blue-700">
              Edit
            </Link>
          </div>
        </div>
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-gray-600 shrink-0">Taxpayer:</span>
          <div className="flex items-center gap-2 justify-end min-w-0">
            <span className="font-medium text-right truncate">
              {taxReturn.taxpayer.firstName} {taxReturn.taxpayer.lastName}
              {taxReturn.taxpayer.ssn && ` (${maskSSN(taxReturn.taxpayer.ssn)})`}
            </span>
            <Link to="/interview/personal-info" className="text-xs text-tax-blue hover:text-blue-700">
              Edit
            </Link>
          </div>
        </div>
      </div>

      {/* Income */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
          Income
        </h2>
        <div className="mt-2 flex flex-col">
          <LineItem label="Line 1a — Wages" nodeId="form1040.line1a" amount={form1040.line1a.amount} />
          <LineItem label="Line 2b — Taxable interest" nodeId="form1040.line2b" amount={form1040.line2b.amount} />
          <LineItem label="Line 3b — Ordinary dividends" nodeId="form1040.line3b" amount={form1040.line3b.amount} />
          <LineItem label="Line 7 — Capital gain/loss" nodeId="form1040.line7" amount={form1040.line7.amount} />
          <LineItem label="Line 9 — Total income" nodeId="form1040.line9" amount={form1040.line9.amount} />
        </div>
      </section>

      {/* Deductions */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
          Deductions
        </h2>
        <div className="mt-2 flex flex-col">
          <LineItem label="Line 11 — AGI" nodeId="form1040.line11" amount={form1040.line11.amount} />
          <LineItem label="Line 12 — Deductions" nodeId="form1040.line12" amount={form1040.line12.amount} />
          <LineItem label="Line 15 — Taxable income" nodeId="form1040.line15" amount={form1040.line15.amount} />
        </div>
      </section>

      {/* Tax & Payments */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
          Tax & Payments
        </h2>
        <div className="mt-2 flex flex-col">
          <LineItem label="Line 16 — Tax" nodeId="form1040.line16" amount={form1040.line16.amount} />
          <LineItem label="Line 24 — Total tax" nodeId="form1040.line24" amount={form1040.line24.amount} />
          <LineItem label="Line 25 — Withheld" nodeId="form1040.line25" amount={form1040.line25.amount} />
          <LineItem label="Line 33 — Total payments" nodeId="form1040.line33" amount={form1040.line33.amount} />
        </div>
      </section>

      {/* Result */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
          Result
        </h2>
        <div className="mt-2 flex flex-col">
          {form1040.line34.amount > 0 && (
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-medium text-tax-green">Line 34 — Refund</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-tax-green">
                  {formatCurrency(form1040.line34.amount)}
                </span>
                <Link to="/explain/form1040.line34" className="text-xs text-tax-blue hover:text-blue-700">
                  ?
                </Link>
              </div>
            </div>
          )}
          {form1040.line37.amount > 0 && (
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-medium text-tax-red">Line 37 — Amount you owe</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-tax-red">
                  {formatCurrency(form1040.line37.amount)}
                </span>
                <Link to="/explain/form1040.line37" className="text-xs text-tax-blue hover:text-blue-700">
                  ?
                </Link>
              </div>
            </div>
          )}
          {form1040.line34.amount === 0 && form1040.line37.amount === 0 && (
            <div className="py-1 text-sm text-gray-500">Tax balance: $0.00</div>
          )}
        </div>
      </section>

      {/* Schedules included */}
      {executedSchedules.length > 0 && (
        <div className="mt-4 text-xs text-gray-500">
          Schedules included: {executedSchedules.join(', ')}
        </div>
      )}

      <InterviewNav interview={interview} />
    </div>
  )
}
