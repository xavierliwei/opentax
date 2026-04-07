import { useState } from 'react'

interface CollapsibleCardProps {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  className?: string
  children: React.ReactNode
}

export function CollapsibleCard({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  className = '',
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`mt-4 bg-white rounded-xl border border-gray-200 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-gray-50 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
        </div>
        {badge && <div className="flex-shrink-0 ml-2">{badge}</div>}
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  )
}
