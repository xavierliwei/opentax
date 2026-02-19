import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar.tsx'
import type { SidebarStep } from './Sidebar.tsx'
import { LiveBalance } from './LiveBalance.tsx'
import { useInterview } from '../../interview/useInterview.ts'
import { useTaxStore } from '../../store/taxStore.ts'
import { autoConnect } from '../../store/syncAdapter.ts'

export function AppShell() {
  useEffect(() => autoConnect(), [])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { steps } = useInterview()
  const taxReturn = useTaxStore((s) => s.taxReturn)

  const sidebarSteps: SidebarStep[] = steps.map((step) => ({
    id: step.id,
    label: step.label,
    path: step.path,
    status:
      step.path === location.pathname
        ? 'current'
        : step.isComplete(taxReturn)
          ? 'completed'
          : 'pending',
  }))

  return (
    <div className="flex h-screen bg-white">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 bg-sidebar border-r border-gray-200 transition-transform lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar steps={sidebarSteps} currentPath={location.pathname} />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 -ml-1 text-gray-600 hover:text-gray-900"
            aria-label="Open sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900">OpenTax</span>
        </header>

        {/* Live balance bar */}
        <LiveBalance />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
