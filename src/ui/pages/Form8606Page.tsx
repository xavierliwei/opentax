import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'

function formatCurrency(cents: number): string {
  const d = Math.abs(cents) / 100
  const formatted = d.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
  return cents < 0 ? `-${formatted}` : formatted
}

export function Form8606Page() {
  const form8606 = useTaxStore((s) => s.taxReturn.form8606)
  const form1040 = useTaxStore((s) => s.computeResult.form1040)
  const setForm8606 = useTaxStore((s) => s.setForm8606)
  const interview = useInterview()

  const data = form8606 ?? {
    nondeductibleContributions: 0,
    priorYearBasis: 0,
    traditionalIRAValueYearEnd: 0,
    distributionsInYear: 0,
    rothConversionAmount: 0,
  }

  const result = form1040.form8606Result

  // Show auto-detected nondeductible contribution hint from IRA deduction phaseout
  const iraDeduction = form1040.iraDeduction
  let autoDetectedNondeductible = 0
  if (iraDeduction) {
    const diff = iraDeduction.allowableContribution - iraDeduction.deductibleAmount
    if (diff > 0) autoDetectedNondeductible = diff
  }

  return (
    <div data-testid="page-form8606" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Nondeductible IRA & Roth Conversions</h1>
      <p className="mt-1 text-sm text-gray-600">
        Track your IRA basis and compute taxes on conversions (backdoor Roth).
        Form 8606 is required when you make nondeductible IRA contributions or convert
        traditional IRA funds to a Roth IRA.
      </p>

      {/* Auto-detection hint */}
      {autoDetectedNondeductible > 0 && data.nondeductibleContributions === 0 && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700">
          Based on your IRA deduction phaseout, {formatCurrency(autoDetectedNondeductible)} of your
          traditional IRA contribution appears to be nondeductible. Enter this amount below if you
          want to track your basis for future distributions or conversions.
        </div>
      )}

      {/* Part I — Nondeductible Contributions */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-800">Part I — Nondeductible Contributions</h2>
        <p className="mt-1 text-xs text-gray-500">
          Enter your nondeductible IRA contributions and prior year basis to track
          the after-tax portion of your traditional IRA.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <CurrencyInput
            label={<>Nondeductible IRA contributions for 2025<InfoTooltip
              explanation="Enter the amount of your traditional IRA contributions that are NOT deductible. This is common when your MAGI exceeds the deduction phase-out threshold because you or your spouse is covered by a workplace retirement plan. This amount becomes your 'basis' in the IRA — it won't be taxed again when you withdraw or convert it."
              pubName="IRS Publication 590-A — Contributions to IRAs"
              pubUrl="https://www.irs.gov/publications/p590a"
            /></>}
            value={data.nondeductibleContributions}
            onChange={(v) => setForm8606({ nondeductibleContributions: v })}
          />

          <CurrencyInput
            label={<>Prior year IRA basis (from last year's Form 8606, Line 14)<InfoTooltip
              explanation="This is your total basis in traditional IRAs from all prior years. You can find this on Line 14 of your most recent Form 8606. If you've never filed Form 8606 before, enter $0. This basis represents after-tax contributions that have already been taxed and won't be taxed again."
              pubName="IRS Form 8606 Instructions"
              pubUrl="https://www.irs.gov/instructions/i8606"
            /></>}
            value={data.priorYearBasis}
            onChange={(v) => setForm8606({ priorYearBasis: v })}
          />
        </div>
      </div>

      {/* Pro-rata rule inputs */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-800">IRA Values & Distributions</h2>
        <p className="mt-1 text-xs text-gray-500">
          These values are needed for the pro-rata rule, which determines the taxable portion
          of any distributions or conversions.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <CurrencyInput
            label={<>Year-end value of ALL traditional/SEP/SIMPLE IRAs (Dec 31, 2025)<InfoTooltip
              explanation="Enter the total value of all your traditional, SEP, and SIMPLE IRAs as of December 31, 2025. Get this from your brokerage year-end statements. This is critical for the pro-rata rule — you cannot just convert your nondeductible basis tax-free if you have other pre-tax IRA money."
              pubName="IRS Form 8606 Instructions — Line 6"
              pubUrl="https://www.irs.gov/instructions/i8606"
            /></>}
            value={data.traditionalIRAValueYearEnd}
            onChange={(v) => setForm8606({ traditionalIRAValueYearEnd: v })}
          />

          <CurrencyInput
            label={<>Distributions from traditional IRAs in 2025<InfoTooltip
              explanation="Enter total distributions you received from traditional IRAs during 2025 (not including conversions to Roth or rollovers). This should match your 1099-R forms where the IRA/SEP/SIMPLE box is checked and the distribution code is not G (rollover)."
              pubName="IRS Form 8606 Instructions — Line 7"
              pubUrl="https://www.irs.gov/instructions/i8606"
            /></>}
            value={data.distributionsInYear}
            onChange={(v) => setForm8606({ distributionsInYear: v })}
          />

          <CurrencyInput
            label={<>Amount converted to Roth IRA in 2025<InfoTooltip
              explanation="Enter the total amount you converted from a traditional/SEP/SIMPLE IRA to a Roth IRA during 2025. This is the 'backdoor Roth' step — the taxable portion is computed using the pro-rata rule based on your total IRA basis and value."
              pubName="IRS Publication 590-B — Distributions from IRAs"
              pubUrl="https://www.irs.gov/publications/p590b"
            /></>}
            value={data.rothConversionAmount}
            onChange={(v) => setForm8606({ rothConversionAmount: v })}
          />
        </div>
      </div>

      {/* Computed Summary */}
      {result && (
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800">Computed Summary</h2>
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total basis (Line 3)</span>
              <span className="font-medium text-gray-900">{formatCurrency(result.line3)}</span>
            </div>
            {result.line9 > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total IRA value for pro-rata (Line 9)</span>
                <span className="font-medium text-gray-900">{formatCurrency(result.line9)}</span>
              </div>
            )}
            {result.line9 > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pro-rata ratio (nontaxable %)</span>
                <span className="font-medium text-gray-900">
                  {(result.line10 / 10000).toFixed(2)}%
                </span>
              </div>
            )}
            {result.hasConversion && (
              <>
                <div className="border-t border-gray-200 mt-1 pt-1" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Roth conversion amount (Line 16)</span>
                  <span className="font-medium text-gray-900">{formatCurrency(result.line16)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Nontaxable portion (Line 17)</span>
                  <span className="font-medium text-green-700">{formatCurrency(result.line17)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-700">Taxable conversion amount (Line 18)</span>
                  <span className="text-red-700">{formatCurrency(result.line18)}</span>
                </div>
              </>
            )}
            {result.hasDistributions && (
              <>
                <div className="border-t border-gray-200 mt-1 pt-1" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Taxable distributions</span>
                  <span className="font-medium text-gray-900">{formatCurrency(result.taxableDistributions)}</span>
                </div>
              </>
            )}
            <div className="border-t border-gray-200 mt-1 pt-1" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Remaining basis carried forward (Line 14)</span>
              <span className="font-medium text-gray-900">{formatCurrency(result.remainingBasis)}</span>
            </div>
            {result.totalTaxableIRA > 0 && (
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Total taxable IRA amount (Form 1040, Line 4b)</span>
                <span className="text-gray-900">{formatCurrency(result.totalTaxableIRA)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdoor Roth explanation */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
        <strong>Pro-rata rule:</strong> When you convert traditional IRA funds to Roth, the IRS treats
        ALL your traditional IRA money as one pool. You cannot selectively convert just the
        nondeductible (after-tax) portion. The nontaxable percentage is based on your total basis
        divided by the total value of all your traditional/SEP/SIMPLE IRAs.
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
