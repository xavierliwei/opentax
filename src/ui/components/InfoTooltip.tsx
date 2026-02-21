import { useRef, useState, useEffect } from 'react'

export function InfoTooltip({ explanation, pubName, pubUrl }: {
  explanation: string
  pubName: string
  pubUrl: string
}) {
  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLSpanElement>(null)

  const show = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setVisible(true)
  }
  const hide = () => {
    hideTimer.current = setTimeout(() => setVisible(false), 120)
  }
  const toggle = () => {
    if (visible) hide()
    else show()
  }

  // Close on outside tap (mobile)
  useEffect(() => {
    if (!visible) return
    const onTouchOutside = (e: TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setVisible(false)
      }
    }
    document.addEventListener('touchstart', onTouchOutside)
    return () => document.removeEventListener('touchstart', onTouchOutside)
  }, [visible])

  return (
    <span ref={containerRef} className="relative inline-flex items-center ml-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={toggle}
        className="text-gray-400 hover:text-blue-500 transition-colors focus:outline-none p-3 -m-3 sm:p-1 sm:-m-1"
        aria-label="More information"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </button>
      {visible && (
        <div
          className="absolute left-0 bottom-full mb-2 w-[min(18rem,calc(100vw-3rem))] bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-50 text-left"
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <p className="text-xs text-gray-600 leading-relaxed">{explanation}</p>
          <p className="mt-2 text-xs font-medium text-blue-700 flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <a
              href={pubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {pubName}
            </a>
          </p>
          {/* Caret */}
          <span className="absolute left-3 top-full -mt-[5px] w-2.5 h-2.5 bg-white border-r border-b border-gray-200 rotate-45" />
        </div>
      )}
    </span>
  )
}
