/**
 * Dashboard page — tax status view.
 *
 * Primary data source: client-side Zustand store (always up to date).
 * Optional: connects to plugin HTTP API for SSE activity feed.
 */

import { useState, useEffect, useRef } from 'react'
import { useTaxStore } from '../../store/taxStore.ts'
import { analyzeGaps } from '../../rules/gapAnalysis.ts'
import type { GapAnalysisResult } from '../../rules/gapAnalysis.ts'
import type { TaxReturn } from '../../model/types.ts'

const API_URL = import.meta.env.VITE_DASHBOARD_API ?? ''

interface ActivityEntry {
  timestamp: string
  message: string
}

function formatCurrency(amountCents: number): string {
  const d = Math.abs(amountCents) / 100
  const formatted = d.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return amountCents < 0 ? `-${formatted}` : formatted
}

export function DashboardPage() {
  // Client-side data — always current
  const taxReturn = useTaxStore((s) => s.taxReturn)
  const computeResult = useTaxStore((s) => s.computeResult)
  const f = computeResult.form1040

  // Client-side gap analysis — recomputed on every store change
  const gapAnalysis: GapAnalysisResult = analyzeGaps(taxReturn, computeResult)

  // Optional server connection for activity feed
  const [connected, setConnected] = useState(false)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!API_URL) return

    const es = new EventSource(`${API_URL}/api/v1/events`)
    eventSourceRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'connected') {
          setConnected(true)
        } else if (data.type === 'stateChanged') {
          setActivity((prev) => [
            {
              timestamp: data.timestamp ?? new Date().toISOString(),
              message: `State updated (v${data.stateVersion})`,
            },
            ...prev.slice(0, 49),
          ])
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => setConnected(false)

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [])

  const isRefund = f.line34.amount > 0
  const isOwed = f.line37.amount > 0
  const heroAmount = isRefund ? f.line34.amount : f.line37.amount
  const heroLabel = isRefund ? 'Estimated Refund' : isOwed ? 'Amount Owed' : 'Balanced'
  const heroColor = isRefund ? 'text-emerald-600' : isOwed ? 'text-red-600' : 'text-gray-500'

  return (
    <div className="space-y-4 py-4" data-testid="dashboard">
      {/* Hero: refund / owed */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-8 text-center relative">
        {/* Connection pill */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1"
          data-testid="connection-status"
        >
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          {connected ? 'Live' : 'Local'}
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
          {heroLabel}
        </p>
        <p className={`text-5xl font-bold tabular-nums ${heroColor}`}>
          {formatCurrency(heroAmount)}
        </p>
        <p className="text-xs text-gray-400 mt-2">2025 Federal Income Tax</p>

        {/* Completion bar */}
        <div className="mt-6 max-w-xs mx-auto" data-testid="completion-bar">
          <div className="flex justify-between text-[11px] mb-1.5">
            <span className="text-gray-400">Return completion</span>
            <span className="font-medium text-gray-500">
              {gapAnalysis.completionPercent}%
              {gapAnalysis.readyToFile ? ' · Ready to file' : ''}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                gapAnalysis.completionPercent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${gapAnalysis.completionPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tax stats */}
      <div className="grid grid-cols-3 gap-3" data-testid="tax-summary">
        <StatTile label="AGI" value={formatCurrency(f.line11.amount)} />
        <StatTile label="Total Tax" value={formatCurrency(f.line24.amount)} />
        <StatTile label="Withheld" value={formatCurrency(f.line25.amount)} />
      </div>

      {/* Section status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SectionCard
          title="Personal"
          complete={!gapAnalysis.items.some((i) => i.category === 'personal')}
          detail={
            taxReturn.taxpayer.firstName
              ? `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`
              : 'Not entered'
          }
        />
        <IncomeCard
          complete={!gapAnalysis.items.some((i) => i.category === 'income')}
          taxReturn={taxReturn}
        />
        <SectionCard
          title="Deductions"
          complete={!gapAnalysis.items.some((i) => i.category === 'deductions')}
          detail={taxReturn.deductions.method === 'itemized' ? 'Itemized' : 'Standard'}
        />
      </div>

      {/* Gap items */}
      {gapAnalysis.items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="gap-items">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Missing Information</h2>
          </div>
          <ul className="divide-y divide-gray-50">
            {gapAnalysis.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  item.priority === 'required' ? 'bg-red-400' : 'bg-amber-400'
                }`} />
                <span className="text-sm text-gray-700 flex-1">{item.label}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${
                  item.priority === 'required' ? 'text-red-400' : 'text-amber-500'
                }`}>
                  {item.priority}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {gapAnalysis.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">Warnings</p>
          {gapAnalysis.warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-700">{w}</p>
          ))}
        </div>
      )}

      {/* Activity log */}
      {activity.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="activity-log">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Activity</h2>
          </div>
          <ul className="divide-y divide-gray-50">
            {activity.map((entry, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2">
                <span className="font-mono text-[11px] text-gray-400 shrink-0 tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span className="text-sm text-gray-600">{entry.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-base font-semibold text-gray-800 tabular-nums">{value}</p>
    </div>
  )
}

function SectionCard({
  title,
  complete,
  detail,
}: {
  title: string
  complete: boolean
  detail: string
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      complete ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <span className={`flex items-center gap-1 text-xs font-medium ${
          complete ? 'text-emerald-600' : 'text-gray-400'
        }`}>
          {complete ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
            </svg>
          )}
          {complete ? 'Complete' : 'Needed'}
        </span>
      </div>
      <div className="text-xs text-gray-500">{detail}</div>
    </div>
  )
}

function IncomeCard({ complete, taxReturn }: { complete: boolean; taxReturn: TaxReturn }) {
  const hasAny =
    taxReturn.w2s.length > 0 ||
    taxReturn.form1099INTs.length > 0 ||
    taxReturn.form1099DIVs.length > 0 ||
    taxReturn.form1099Bs.length > 0

  // Group 1099-Bs by broker
  const brokerGroups = new Map<string, { count: number; netGL: number }>()
  for (const b of taxReturn.form1099Bs) {
    const name = b.brokerName || 'Unknown broker'
    const existing = brokerGroups.get(name)
    if (existing) {
      existing.count++
      existing.netGL += b.gainLoss
    } else {
      brokerGroups.set(name, { count: 1, netGL: b.gainLoss })
    }
  }

  return (
    <div className={`rounded-xl border p-4 ${
      complete ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800">Income</span>
        <span className={`flex items-center gap-1 text-xs font-medium ${
          complete ? 'text-emerald-600' : 'text-gray-400'
        }`}>
          {complete ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
            </svg>
          )}
          {complete ? 'Complete' : 'Needed'}
        </span>
      </div>

      {!hasAny && <div className="text-xs text-gray-400">No income entered</div>}

      <div className="space-y-1.5">
        {taxReturn.w2s.map((w2) => (
          <div key={w2.id} className="flex items-baseline justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="shrink-0 px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold text-[10px]">
                W-2
              </span>
              <span className="text-gray-600 truncate">{w2.employerName || 'Unknown employer'}</span>
            </div>
            <span className="shrink-0 font-medium text-gray-700 tabular-nums">
              {formatCurrency(w2.box1)}
            </span>
          </div>
        ))}
        {taxReturn.form1099INTs.map((f) => (
          <div key={f.id} className="flex items-baseline justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="shrink-0 px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold text-[10px]">
                INT
              </span>
              <span className="text-gray-600 truncate">{f.payerName || 'Unknown payer'}</span>
            </div>
            <span className="shrink-0 font-medium text-gray-700 tabular-nums">
              {formatCurrency(f.box1)}
            </span>
          </div>
        ))}
        {taxReturn.form1099DIVs.map((f) => (
          <div key={f.id} className="flex items-baseline justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="shrink-0 px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold text-[10px]">
                DIV
              </span>
              <span className="text-gray-600 truncate">{f.payerName || 'Unknown payer'}</span>
            </div>
            <span className="shrink-0 font-medium text-gray-700 tabular-nums">
              {formatCurrency(f.box1a)}
            </span>
          </div>
        ))}
        {[...brokerGroups.entries()].map(([broker, { count, netGL }]) => (
          <div key={broker} className="flex items-baseline justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="shrink-0 px-1 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold text-[10px]">
                1099-B
              </span>
              <span className="text-gray-600 truncate">
                {broker} · {count} sale{count !== 1 ? 's' : ''}
              </span>
            </div>
            <span className={`shrink-0 font-medium tabular-nums ${netGL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {netGL >= 0 ? '+' : '−'}{formatCurrency(Math.abs(netGL))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
