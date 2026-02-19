import { NavLink } from 'react-router-dom'

export interface SidebarStep {
  id: string
  label: string
  path: string
  status: 'completed' | 'current' | 'pending'
}

interface SidebarProps {
  steps: SidebarStep[]
  currentPath: string
}

function StepIndicator({ status }: { status: SidebarStep['status'] }) {
  if (status === 'completed') {
    return <span className="text-tax-green text-sm" aria-label="completed">✓</span>
  }
  if (status === 'current') {
    return <span className="text-tax-blue text-sm" aria-label="current">●</span>
  }
  return <span className="text-tax-gray text-sm" aria-label="pending">○</span>
}

export function Sidebar({ steps }: SidebarProps) {
  const completedCount = steps.filter((s) => s.status === 'completed').length
  const progress = steps.length > 0 ? completedCount / steps.length : 0

  return (
    <nav className="flex flex-col h-full" aria-label="Interview steps">
      <div className="px-4 py-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Tax Return
        </h2>
      </div>

      <div data-testid="live-balance" className="px-4 py-3 border-b border-gray-200">
        {/* LiveBalance placeholder — real implementation in P2.4 */}
      </div>

      <ul className="flex-1 overflow-y-auto py-2">
        {steps.map((step) => (
          <li key={step.id}>
            <NavLink
              to={step.path}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-tax-blue font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <StepIndicator status={step.status} />
              <span>{step.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-tax-blue rounded-full transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-200">
        <NavLink
          to="/dashboard"
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-tax-blue transition-colors"
        >
          <span>Dashboard</span>
        </NavLink>
      </div>
    </nav>
  )
}
