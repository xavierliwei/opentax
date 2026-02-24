import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { InterviewNav } from './InterviewNav.tsx'
import type { IncomeSourceId } from '../../model/types.ts'

interface IncomeSourceOption {
  id: IncomeSourceId
  label: string
  description: string
}

const COMMON_SOURCES: IncomeSourceOption[] = [
  { id: 'w2', label: 'W-2 wages or salary', description: 'Employment income reported on Form W-2' },
  { id: 'interest', label: 'Interest income (1099-INT)', description: 'Bank interest, CD interest, Treasury bond interest' },
  { id: 'dividends', label: 'Dividend income (1099-DIV)', description: 'Stock dividends, mutual fund distributions' },
  { id: 'retirement', label: 'Retirement / pension / IRA (1099-R)', description: 'IRA distributions, pension, 401(k) withdrawals' },
  { id: 'unemployment', label: 'Unemployment compensation (1099-G)', description: 'State unemployment benefits' },
  { id: 'stocks', label: 'Stock sales / capital gains (1099-B)', description: 'Sold stocks, bonds, mutual funds, or crypto' },
  { id: 'other', label: 'Other income (1099-MISC)', description: 'Prizes, awards, jury duty pay, gambling winnings' },
]

const LESS_COMMON_SOURCES: IncomeSourceOption[] = [
  { id: 'rsu', label: 'RSU vest events', description: 'Restricted stock unit vesting from your employer' },
  { id: 'iso', label: 'ISO / stock option exercises', description: 'Incentive stock option exercises (AMT preference item)' },
  { id: 'rental', label: 'Rental property income (Schedule E)', description: 'Rental real estate income and expenses' },
  { id: 'business', label: 'Self-employment / business income (Schedule C)', description: 'Freelance, gig work, or sole proprietorship' },
  { id: 'k1', label: 'Partnership / S-Corp / Trust K-1 income', description: 'Schedule K-1 from partnerships, S-corps, or trusts' },
]

const OTHER_FORMS: IncomeSourceOption[] = [
  { id: 'health-marketplace', label: 'Health insurance from marketplace (1095-A)', description: 'Healthcare.gov or state marketplace coverage' },
]

export function IncomeSourcesPage() {
  const incomeSources = useTaxStore((s) => s.taxReturn.incomeSources ?? ['w2'])
  const setIncomeSources = useTaxStore((s) => s.setIncomeSources)
  const interview = useInterview()

  const isChecked = (id: IncomeSourceId) => incomeSources.includes(id)

  const toggle = (id: IncomeSourceId) => {
    if (isChecked(id)) {
      setIncomeSources(incomeSources.filter((s) => s !== id))
    } else {
      setIncomeSources([...incomeSources, id])
    }
  }

  const renderOption = (option: IncomeSourceOption) => (
    <label key={option.id} className="flex items-start gap-3 cursor-pointer py-2">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-tax-blue focus:ring-tax-blue"
        checked={isChecked(option.id)}
        onChange={() => toggle(option.id)}
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">{option.label}</span>
        <span className="text-xs text-gray-500">{option.description}</span>
      </div>
    </label>
  )

  return (
    <div data-testid="page-income-sources" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">What applies to you?</h1>
      <p className="mt-1 text-sm text-gray-600">
        Check all the income types and forms that apply to your {new Date().getFullYear() - 1} tax year. Only checked items will appear in the sidebar. You can always come back and change this.
      </p>

      <div className="mt-6 flex flex-col gap-1">
        {COMMON_SOURCES.map(renderOption)}
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Less common</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>
        <div className="flex flex-col gap-1">
          {LESS_COMMON_SOURCES.map(renderOption)}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Other forms</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>
        <div className="flex flex-col gap-1">
          {OTHER_FORMS.map(renderOption)}
        </div>
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
