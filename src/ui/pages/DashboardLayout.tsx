/**
 * Minimal dashboard layout — no sidebar, just a sticky header + scrollable content.
 * Mobile-friendly for viewing on phone via Tailscale.
 */

import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { autoConnect } from '../../store/syncAdapter.ts'

export function DashboardLayout() {
  useEffect(() => autoConnect(), [])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-gray-900 tracking-tight">OpenTax</span>
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 tracking-wide">
              2025
            </span>
          </div>
          <a
            href="/interview/filing-status"
            className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 active:text-blue-900 transition-colors py-2 -my-2 px-2 -mx-2 sm:py-0 sm:-my-0 sm:px-0 sm:-mx-0 rounded-md"
          >
            Open Interview
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}
