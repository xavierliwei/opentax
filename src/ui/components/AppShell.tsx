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
    section: step.section,
    isComplete: step.isComplete(taxReturn),
    status:
      step.path === location.pathname
        ? 'current'
        : step.isComplete(taxReturn)
          ? 'completed'
          : 'pending',
  }))

  return (
    <div className="flex h-screen bg-white">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-blue-700 focus:border focus:border-blue-300 focus:rounded-md focus:shadow-md">
        Skip to main content
      </a>
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
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center h-11 w-11 -ml-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Open sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-gray-900">OpenTax</span>
          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
            2025
          </span>
        </header>

        {/* Live balance bar */}
        <LiveBalance />

        {/* Page content */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
