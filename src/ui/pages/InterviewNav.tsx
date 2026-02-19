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
    <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
      <button
        type="button"
        onClick={interview.goPrev}
        disabled={!interview.canGoPrev}
        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Back
      </button>
      <button
        type="button"
        onClick={interview.goNext}
        disabled={!interview.canGoNext}
        className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  )
}
