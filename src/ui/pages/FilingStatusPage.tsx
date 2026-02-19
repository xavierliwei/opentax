import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import type { FilingStatus } from '../../model/types.ts'
import { InterviewNav } from './InterviewNav.tsx'

const FILING_OPTIONS: { value: FilingStatus; label: string; description: string }[] = [
  {
    value: 'single',
    label: 'Single',
    description: 'Unmarried, or legally separated/divorced on Dec 31.',
  },
  {
    value: 'mfj',
    label: 'Married Filing Jointly',
    description: 'Married and filing a combined return with your spouse.',
  },
  {
    value: 'mfs',
    label: 'Married Filing Separately',
    description: 'Married but each filing their own return.',
  },
  {
    value: 'hoh',
    label: 'Head of Household',
    description:
      'Unmarried and paying more than half the cost of keeping up a home for a qualifying person.',
  },
  {
    value: 'qw',
    label: 'Qualifying Surviving Spouse',
    description:
      'Spouse died in 2023 or 2024, and you have a dependent child.',
  },
]

export function FilingStatusPage() {
  const filingStatus = useTaxStore((s) => s.taxReturn.filingStatus)
  const setFilingStatus = useTaxStore((s) => s.setFilingStatus)
  const interview = useInterview()

  return (
    <div data-testid="page-filing-status" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Filing Status</h1>
      <p className="mt-1 text-sm text-gray-600">
        Select the filing status that applies to you.
      </p>

      <fieldset className="mt-6 flex flex-col gap-3">
        {FILING_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
              filingStatus === opt.value
                ? 'border-tax-blue bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="filingStatus"
              value={opt.value}
              checked={filingStatus === opt.value}
              onChange={() => setFilingStatus(opt.value)}
              className="mt-1"
            />
            <div>
              <span className="font-medium text-gray-900">{opt.label}</span>
              <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
            </div>
          </label>
        ))}
      </fieldset>

      <InterviewNav interview={interview} />
    </div>
  )
}
