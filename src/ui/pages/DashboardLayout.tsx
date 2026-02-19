/**
 * Minimal dashboard layout — no sidebar, just header + scrollable content.
 * Mobile-friendly for viewing on phone via Tailscale.
 */

import { Outlet } from 'react-router-dom'

export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">OpenTax Dashboard</h1>
          <a
            href="/interview/filing-status"
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Open Interview
          </a>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}
