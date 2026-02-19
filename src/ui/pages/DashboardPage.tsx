/**
 * Dashboard page — live tax status view connected to the plugin HTTP API.
 *
 * Fetches status on mount, subscribes to SSE for real-time updates.
 * Shows completion, tax summary, gap items, and activity log.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { GapAnalysisResult } from '../../../openclaw-plugin/service/GapAnalysis.ts'
import type { TaxReturn } from '../../model/types.ts'
import type { SerializedComputeResult } from '../../model/serialize.ts'

const API_URL = import.meta.env.VITE_DASHBOARD_API ?? ''

interface StatusResponse {
  taxReturn: TaxReturn
  computeResult: SerializedComputeResult
  stateVersion: number
  gapAnalysis: GapAnalysisResult
}

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
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/status`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: StatusResponse = await res.json()
      setStatus(data)
      setError(null)
    } catch (err) {
      setError('Cannot reach API server')
    }
  }, [])

  useEffect(() => {
    fetchStatus()

    const es = new EventSource(`${API_URL}/api/events`)
    eventSourceRef.current = es

    es.onopen = () => setConnected(true)

    let lastSeenVersion = -1

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'connected') {
          setConnected(true)
          lastSeenVersion = data.stateVersion ?? -1
        } else if (data.type === 'stateChanged') {
          // Deduplicate — skip if we already saw this version
          if (data.stateVersion != null && data.stateVersion <= lastSeenVersion) return
          lastSeenVersion = data.stateVersion ?? lastSeenVersion
          setActivity((prev) => [
            { timestamp: data.timestamp ?? new Date().toISOString(), message: `State updated (v${data.stateVersion})` },
            ...prev.slice(0, 49),
          ])
          fetchStatus()
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
  }, [fetchStatus])

  if (error && !status) {
    return (
      <div className="space-y-4">
        <ConnectionDot connected={false} />
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
        <p className="text-sm text-gray-500">
          Make sure the OpenClaw plugin is running with the OpenTax plugin loaded.
        </p>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  const { gapAnalysis, computeResult, taxReturn } = status
  const f = computeResult.form1040

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* Connection status */}
      <ConnectionDot connected={connected} />

      {/* Completion bar */}
      <div data-testid="completion-bar">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">
            Completion: {gapAnalysis.completionPercent}%
          </span>
          <span className="text-sm text-gray-500">
            {gapAnalysis.readyToFile ? 'Ready to file' : 'Not ready'}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${gapAnalysis.completionPercent}%` }}
          />
        </div>
      </div>

      {/* Tax summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="tax-summary">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Tax Summary</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">AGI</span>
            <div className="font-medium">{formatCurrency(f.line11.amount)}</div>
          </div>
          <div>
            <span className="text-gray-500">Tax</span>
            <div className="font-medium">{formatCurrency(f.line24.amount)}</div>
          </div>
          <div>
            <span className="text-gray-500">Withheld</span>
            <div className="font-medium">{formatCurrency(f.line25.amount)}</div>
          </div>
          <div>
            <span className="text-gray-500">
              {f.line34.amount > 0 ? 'Refund' : 'Owed'}
            </span>
            <div className={`font-bold text-lg ${f.line34.amount > 0 ? 'text-green-600' : f.line37.amount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {formatCurrency(f.line34.amount > 0 ? f.line34.amount : f.line37.amount)}
            </div>
          </div>
        </div>
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
        <div data-testid="gap-items">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Missing Information</h2>
          <ul className="space-y-1">
            {gapAnalysis.items.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                  item.priority === 'required'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {item.priority}
                </span>
                <span className="text-gray-700">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {gapAnalysis.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h3 className="text-sm font-semibold text-yellow-800 mb-1">Warnings</h3>
          {gapAnalysis.warnings.map((w, i) => (
            <p key={i} className="text-sm text-yellow-700">{w}</p>
          ))}
        </div>
      )}

      {/* Activity log */}
      {activity.length > 0 && (
        <div data-testid="activity-log">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Activity</h2>
          <ul className="space-y-1 text-sm text-gray-500">
            {activity.map((entry, i) => (
              <li key={i}>
                <span className="font-mono text-xs text-gray-400">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>{' '}
                {entry.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm" data-testid="connection-status">
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-gray-500">{connected ? 'Connected' : 'Disconnected'}</span>
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
    <div className={`rounded-lg border p-3 ${complete ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{title}</span>
        <span className={`text-xs ${complete ? 'text-green-600' : 'text-gray-400'}`}>
          {complete ? 'Complete' : 'Incomplete'}
        </span>
      </div>
      <div className="text-xs text-gray-500">{detail}</div>
    </div>
  )
}

function IncomeCard({ complete, taxReturn }: { complete: boolean; taxReturn: TaxReturn }) {
  const hasAny = taxReturn.w2s.length > 0 || taxReturn.form1099INTs.length > 0 || taxReturn.form1099DIVs.length > 0

  return (
    <div className={`rounded-lg border p-3 ${complete ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">Income</span>
        <span className={`text-xs ${complete ? 'text-green-600' : 'text-gray-400'}`}>
          {complete ? 'Complete' : 'Incomplete'}
        </span>
      </div>

      {!hasAny && <div className="text-xs text-gray-500">None</div>}

      {taxReturn.w2s.length > 0 && (
        <div className="mt-1 space-y-1.5">
          {taxReturn.w2s.map((w2) => (
            <div key={w2.id} className="flex items-baseline justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 px-1 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">W-2</span>
                <span className="text-gray-700 truncate">{w2.employerName || 'Unknown employer'}</span>
              </div>
              <span className="shrink-0 font-medium text-gray-600">{formatCurrency(w2.box1)}</span>
            </div>
          ))}
        </div>
      )}

      {taxReturn.form1099INTs.length > 0 && (
        <div className="mt-1 space-y-1.5">
          {taxReturn.form1099INTs.map((f) => (
            <div key={f.id} className="flex items-baseline justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">1099-INT</span>
                <span className="text-gray-700 truncate">{f.payerName || 'Unknown payer'}</span>
              </div>
              <span className="shrink-0 font-medium text-gray-600">{formatCurrency(f.box1)}</span>
            </div>
          ))}
        </div>
      )}

      {taxReturn.form1099DIVs.length > 0 && (
        <div className="mt-1 space-y-1.5">
          {taxReturn.form1099DIVs.map((f) => (
            <div key={f.id} className="flex items-baseline justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">1099-DIV</span>
                <span className="text-gray-700 truncate">{f.payerName || 'Unknown payer'}</span>
              </div>
              <span className="shrink-0 font-medium text-gray-600">{formatCurrency(f.box1a)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
