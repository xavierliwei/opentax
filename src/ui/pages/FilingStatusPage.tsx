import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import type { FilingStatus } from '../../model/types.ts'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'

const FILING_OPTIONS: {
  value: FilingStatus
  label: string
  description: string
  tooltip: { explanation: string; pubName: string; pubUrl: string }
}[] = [
  {
    value: 'single',
    label: 'Single',
    description: 'Unmarried, or legally separated/divorced on Dec 31.',
    tooltip: {
      explanation: 'You may file as Single if you are unmarried, legally separated, or divorced under a final decree as of December 31 of the tax year. If you may qualify for Head of Household (lower tax rate), check that status first.',
      pubName: 'IRS Publication 501 — Filing Status',
      pubUrl: 'https://www.irs.gov/publications/p501',
    },
  },
  {
    value: 'mfj',
    label: 'Married Filing Jointly',
    description: 'Married and filing a combined return with your spouse.',
    tooltip: {
      explanation: 'Married Filing Jointly combines both spouses\' income and deductions on one return. You must have been legally married on December 31 (or your spouse died during the year). MFJ typically gives the lowest tax rate and highest standard deduction for married couples.',
      pubName: 'IRS Publication 501 — Married Filing Jointly',
      pubUrl: 'https://www.irs.gov/publications/p501',
    },
  },
  {
    value: 'mfs',
    label: 'Married Filing Separately',
    description: 'Married but each filing their own return.',
    tooltip: {
      explanation: 'Married Filing Separately may reduce liability if one spouse has large deductible expenses. However, MFS disqualifies you from the Earned Income Credit, education credits, and student loan interest deduction, and subjects you to lower IRA contribution limits.',
      pubName: 'IRS Publication 501 — Married Filing Separately',
      pubUrl: 'https://www.irs.gov/publications/p501',
    },
  },
  {
    value: 'hoh',
    label: 'Head of Household',
    description:
      'Unmarried and paying more than half the cost of keeping up a home for a qualifying person.',
    tooltip: {
      explanation: 'Head of Household gives a higher standard deduction and lower rates than Single. You qualify if you are unmarried on December 31, paid more than half the cost of keeping up a home for the year, and a qualifying person (child, parent, or other relative) lived with you for more than half the year.',
      pubName: 'IRS Publication 501 — Head of Household',
      pubUrl: 'https://www.irs.gov/publications/p501',
    },
  },
  {
    value: 'qw',
    label: 'Qualifying Surviving Spouse',
    description:
      'Spouse died in 2023 or 2024, and you have a dependent child.',
    tooltip: {
      explanation: 'Qualifying Surviving Spouse lets you use Married Filing Jointly tax rates and standard deduction for up to two years after your spouse\'s death, provided you have a dependent child who lived with you all year and you paid more than half the cost of keeping up your home.',
      pubName: 'IRS Publication 501 — Qualifying Surviving Spouse',
      pubUrl: 'https://www.irs.gov/publications/p501',
    },
  },
]

export function FilingStatusPage() {
  const filingStatus = useTaxStore((s) => s.taxReturn.filingStatus)
  const setFilingStatus = useTaxStore((s) => s.setFilingStatus)
  const canBeClaimedAsDependent = useTaxStore((s) => s.taxReturn.canBeClaimedAsDependent ?? false)
  const setCanBeClaimedAsDependent = useTaxStore((s) => s.setCanBeClaimedAsDependent)
  const interview = useInterview()

  return (
    <div data-testid="page-filing-status" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Filing Status</h1>
      <p className="mt-1 text-sm text-gray-600">
        Select the filing status that applies to you.
      </p>

      <fieldset className="mt-6 flex flex-col gap-3">
        <legend className="sr-only">Filing status</legend>
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
              <span className="font-medium text-gray-900 inline-flex items-center">
                {opt.label}
                <InfoTooltip
                  explanation={opt.tooltip.explanation}
                  pubName={opt.tooltip.pubName}
                  pubUrl={opt.tooltip.pubUrl}
                />
              </span>
              <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
            </div>
          </label>
        ))}
      </fieldset>

      <div className="mt-6 border border-gray-200 rounded-lg p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={canBeClaimedAsDependent}
            onChange={(e) => setCanBeClaimedAsDependent(e.target.checked)}
            className="mt-1"
          />
          <div>
            <span className="font-medium text-gray-900 inline-flex items-center">
              Someone can claim me as a dependent
              <InfoTooltip
                explanation="Check this box if someone else (such as a parent) can claim you as a dependent on their tax return. This limits your standard deduction to the greater of $1,350 or your earned income plus $450."
                pubName="IRS Publication 501 — Dependents"
                pubUrl="https://www.irs.gov/publications/p501"
              />
            </span>
            <p className="text-sm text-gray-500 mt-0.5">
              This limits your standard deduction. Most adult filers leave this unchecked.
            </p>
          </div>
        </label>
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
