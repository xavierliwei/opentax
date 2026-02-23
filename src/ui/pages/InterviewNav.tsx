interface InterviewNavProps {
  interview: {
    canGoPrev: boolean
    canGoNext: boolean
    goNext: () => void
    goPrev: () => void
  }
}

export function InterviewNav({ interview }: InterviewNavProps) {
  return (
    <div
      className="sticky bottom-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white border-t border-gray-200 flex justify-between mt-8 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] sm:static sm:z-auto sm:mx-0 sm:px-0 sm:py-0 sm:pt-6 sm:mt-8 sm:bg-transparent sm:border-gray-100 sm:shadow-none"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        onClick={interview.goPrev}
        disabled={!interview.canGoPrev}
        className="flex items-center gap-1.5 px-4 py-3 sm:py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>
      <button
        type="button"
        onClick={interview.goNext}
        disabled={!interview.canGoNext}
        className="flex items-center gap-1.5 px-5 py-3 sm:py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        Continue
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
