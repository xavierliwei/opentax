import { NavLink } from 'react-router-dom'
import type { InterviewSection } from '../../interview/steps.ts'

export interface SidebarStep {
  id: string
  label: string
  path: string
  section: InterviewSection
  isComplete: boolean
  status: 'completed' | 'current' | 'pending'
}

interface SidebarProps {
  steps: SidebarStep[]
  currentPath: string
}

const SECTION_LABELS: Record<InterviewSection, string> = {
  'getting-started': 'Getting Started',
  'income': 'Income',
  'deductions-credits': 'Deductions & Credits',
  'review': 'Review',
  'download': 'Download',
}

function StepBadge({ status, index }: { status: SidebarStep['status']; index: number }) {
  if (status === 'completed') {
    return (
      <span
        className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white shrink-0"
        aria-label="completed"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (status === 'current') {
    return (
      <span
        className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0"
        aria-label="current"
      >
        {index + 1}
      </span>
    )
  }
  return (
    <span
      className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-gray-200 text-gray-400 text-[10px] font-medium shrink-0"
      aria-label="pending"
    >
      {index + 1}
    </span>
  )
}

export function Sidebar({ steps }: SidebarProps) {
  const completedCount = steps.filter((s) => s.isComplete).length
  const progress = steps.length > 0 ? completedCount / steps.length : 0

  // Group steps by section, preserving order
  let lastSection: InterviewSection | null = null

  return (
    <nav className="flex flex-col h-full" aria-label="Interview steps">
      {/* Brand header */}
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-gray-900 tracking-tight">OpenTax</span>
          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 tracking-wide">
            2025
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">Federal return</p>
      </div>

      {/* Steps */}
      <ul className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
        {steps.map((step, index) => {
          const effectiveStatus =
            step.isComplete && step.status === 'current' ? 'completed' : step.status

          // Render section header when section changes
          const showHeader = step.section !== lastSection
          lastSection = step.section

          return (
            <li key={step.id}>
              {showHeader && (
                <div className="px-3 pt-3 pb-1 first:pt-1">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {SECTION_LABELS[step.section]}
                  </span>
                </div>
              )}
              <NavLink
                to={step.path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : step.isComplete
                        ? 'text-gray-600 hover:bg-gray-100'
                        : 'text-gray-400 hover:bg-gray-50'
                  }`
                }
              >
                <StepBadge status={effectiveStatus} index={index} />
                <span className="leading-tight">{step.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>

      {/* Progress */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="text-gray-400">{completedCount} of {steps.length} complete</span>
          <span className="font-medium text-gray-500">{Math.round(progress * 100)}%</span>
        </div>
        <div
          className="h-1.5 bg-gray-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Interview progress: ${completedCount} of ${steps.length} steps complete`}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              progress === 1 ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Dashboard link */}
      <div className="px-4 py-3 border-t border-gray-200">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2.5 rounded-md text-xs font-medium transition-colors ${
              isActive
                ? 'bg-gray-100 text-gray-700'
                : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
            }`
          }
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Dashboard
        </NavLink>
      </div>
    </nav>
  )
}
