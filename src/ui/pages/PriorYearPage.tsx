import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'

export function PriorYearPage() {
  const priorYear = useTaxStore((s) => s.taxReturn.priorYear)
  const investmentInterestCarryforward = useTaxStore(
    (s) => s.taxReturn.deductions.itemized?.priorYearInvestmentInterestCarryforward ?? 0,
  )
  const setPriorYear = useTaxStore((s) => s.setPriorYear)
  const setItemizedDeductions = useTaxStore((s) => s.setItemizedDeductions)
  const interview = useInterview()

  const agi = priorYear?.agi ?? 0
  const stCarryforward = priorYear?.capitalLossCarryforwardST ?? 0
  const ltCarryforward = priorYear?.capitalLossCarryforwardLT ?? 0

  return (
    <div data-testid="page-prior-year" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Prior Year Info</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter carry-forward amounts from your 2024 tax return.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {/* Prior-Year AGI */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-gray-800">Prior-Year AGI</span>
            <InfoTooltip
              explanation="Your prior-year adjusted gross income (AGI) is used for e-file identity verification. You can find it on your 2024 Form 1040 Line 11."
              pubName="IRS — How to Find Your AGI"
              pubUrl="https://www.irs.gov/e-file-providers/definition-of-adjusted-gross-income"
            />
          </div>
          <CurrencyInput
            label="2024 Adjusted Gross Income (Form 1040 Line 11)"
            value={agi}
            onChange={(v) => setPriorYear({ agi: v })}
            helperText="Required for e-filing identity verification"
          />
        </div>

        {/* Capital Loss Carryforward */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-gray-800">Capital Loss Carryforward</span>
            <InfoTooltip
              explanation="If your 2024 capital losses exceeded the $3,000 deduction limit, the excess carries forward to 2025. Enter positive amounts from the Capital Loss Carryover Worksheet in your 2024 Schedule D instructions."
              pubName="IRS Schedule D Instructions — Capital Loss Carryover Worksheet"
              pubUrl="https://www.irs.gov/instructions/i1040sd"
            />
          </div>
          <CurrencyInput
            label="Short-term capital loss carryover (Schedule D Line 6)"
            value={stCarryforward}
            onChange={(v) => setPriorYear({ capitalLossCarryforwardST: v })}
            helperText="Enter as a positive amount"
          />
          <CurrencyInput
            label="Long-term capital loss carryover (Schedule D Line 14)"
            value={ltCarryforward}
            onChange={(v) => setPriorYear({ capitalLossCarryforwardLT: v })}
            helperText="Enter as a positive amount"
          />
        </div>

        {/* Investment Interest Carryforward */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-gray-800">Investment Interest Carryforward</span>
            <InfoTooltip
              explanation="If your investment interest expense exceeded your net investment income in a prior year, the disallowed portion carries forward. This amount is added to your current-year investment interest deduction on Form 4952."
              pubName="IRS Form 4952 — Investment Interest Expense Deduction"
              pubUrl="https://www.irs.gov/forms-pubs/about-form-4952"
            />
          </div>
          <CurrencyInput
            label="Prior-year investment interest carryforward (Form 4952)"
            value={investmentInterestCarryforward}
            onChange={(v) => setItemizedDeductions({ priorYearInvestmentInterestCarryforward: v })}
            helperText="Disallowed investment interest expense from prior year(s)"
          />
        </div>
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
