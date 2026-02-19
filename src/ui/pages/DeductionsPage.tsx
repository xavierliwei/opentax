import { useRef, useState } from 'react'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import {
  STANDARD_DEDUCTION,
  MEDICAL_AGI_FLOOR_RATE,
  CHARITABLE_CASH_AGI_LIMIT,
  CHARITABLE_NONCASH_AGI_LIMIT,
  MORTGAGE_LIMIT_POST_TCJA,
  MORTGAGE_LIMIT_PRE_TCJA,
} from '../../rules/2025/constants.ts'
import { computeSaltCap } from '../../rules/2025/scheduleA.ts'
import { dollars } from '../../model/traced.ts'

function formatCurrency(cents: number): string {
  return dollars(cents).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  })
}

function LimitedBadge({ entered, deductible }: { entered: number; deductible: number }) {
  if (!entered || deductible >= entered) return null
  return (
    <p className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
      Limited to {formatCurrency(deductible)} (you entered {formatCurrency(entered)})
    </p>
  )
}

function InfoTooltip({ explanation, pubName, pubUrl }: {
  explanation: string
  pubName: string
  pubUrl: string
}) {
  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setVisible(true)
  }
  const hide = () => {
    hideTimer.current = setTimeout(() => setVisible(false), 120)
  }

  return (
    <span className="relative inline-flex items-center ml-1.5">
      <button
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="text-gray-400 hover:text-blue-500 transition-colors focus:outline-none"
        aria-label="More information"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </button>
      {visible && (
        <div
          className="absolute left-0 bottom-full mb-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-50 text-left"
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

export function DeductionsPage() {
  const filingStatus = useTaxStore((s) => s.taxReturn.filingStatus)
  const deductions = useTaxStore((s) => s.taxReturn.deductions)
  const agi = useTaxStore((s) => s.computeResult.form1040.line11.amount)
  const computeResult = useTaxStore((s) => s.computeResult)
  const line2b = useTaxStore((s) => s.computeResult.form1040.line2b.amount)
  const line3a = useTaxStore((s) => s.computeResult.form1040.line3a.amount)
  const line3b = useTaxStore((s) => s.computeResult.form1040.line3b.amount)
  const scheduleD = useTaxStore((s) => s.computeResult.form1040.scheduleD)
  const setDeductionMethod = useTaxStore((s) => s.setDeductionMethod)
  const setItemizedDeductions = useTaxStore((s) => s.setItemizedDeductions)
  const interview = useInterview()

  const standardAmount = STANDARD_DEDUCTION[filingStatus]
  const medicalFloor = Math.round(agi * MEDICAL_AGI_FLOOR_RATE)
  const effectiveSaltCap = computeSaltCap(filingStatus, agi)
  const cashAgiLimit = Math.round(agi * CHARITABLE_CASH_AGI_LIMIT)
  const noncashAgiLimit = Math.round(agi * CHARITABLE_NONCASH_AGI_LIMIT)

  // Net investment income for investment interest limit display
  const nonQualifiedDivs = Math.max(0, line3b - line3a)
  const netSTGain = Math.max(0, scheduleD?.line7.amount ?? 0)
  const netInvestmentIncome = line2b + nonQualifiedDivs + netSTGain

  const itemized = deductions.itemized ?? {
    medicalExpenses: 0,
    stateLocalIncomeTaxes: 0,
    stateLocalSalesTaxes: 0,
    realEstateTaxes: 0,
    personalPropertyTaxes: 0,
    mortgageInterest: 0,
    mortgagePrincipal: 0,
    mortgagePreTCJA: false,
    investmentInterest: 0,
    charitableCash: 0,
    charitableNoncash: 0,
    otherDeductions: 0,
  }

  // Use post-limit total from engine when available (method=itemized),
  // otherwise compute a rough estimate for comparison display.
  const itemizedTotal = computeResult.form1040.scheduleA?.line17.amount ?? (
    Math.max(0, itemized.medicalExpenses - medicalFloor) +
    Math.min(
      Math.max(itemized.stateLocalIncomeTaxes, itemized.stateLocalSalesTaxes) +
        itemized.realEstateTaxes + itemized.personalPropertyTaxes,
      effectiveSaltCap,
    ) +
    itemized.mortgageInterest +
    itemized.investmentInterest +
    itemized.charitableCash +
    itemized.charitableNoncash +
    itemized.otherDeductions
  )

  const diff = Math.abs(standardAmount - itemizedTotal)
  const standardBetter = standardAmount >= itemizedTotal

  // scheduleA data (only present when method=itemized)
  const scheduleA = computeResult.form1040.scheduleA
  const medicalDeductible    = scheduleA?.line4.amount  ?? 0
  const saltDeductible       = scheduleA?.line7.amount  ?? 0
  const interestDeductible   = scheduleA?.line10.amount ?? 0
  const charitableDeductible = scheduleA?.line14.amount ?? 0
  const otherDeductible      = scheduleA?.line16.amount ?? 0

  // SALT total before cap
  const totalSalt =
    Math.max(itemized.stateLocalIncomeTaxes, itemized.stateLocalSalesTaxes) +
    itemized.realEstateTaxes +
    itemized.personalPropertyTaxes

  // Mortgage loan limit check
  const loanLimit = itemized.mortgagePreTCJA
    ? MORTGAGE_LIMIT_PRE_TCJA[filingStatus]
    : MORTGAGE_LIMIT_POST_TCJA[filingStatus]
  const mortgageLimited = itemized.mortgagePrincipal > 0 && itemized.mortgagePrincipal > loanLimit

  return (
    <div data-testid="page-deductions" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Deductions</h1>
      <p className="mt-1 text-sm text-gray-600">
        Choose between the standard deduction or itemizing your deductions.
      </p>

      {/* Method selection */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <label
          className={`flex flex-col items-center gap-1 border rounded-lg p-4 cursor-pointer transition-colors ${
            deductions.method === 'standard'
              ? 'border-tax-blue bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            name="deduction-method"
            value="standard"
            checked={deductions.method === 'standard'}
            onChange={() => setDeductionMethod('standard')}
            className="sr-only"
          />
          <span className="text-sm font-medium text-gray-900">Standard</span>
          <span className="text-lg font-bold text-gray-700">
            {formatCurrency(standardAmount)}
          </span>
          {standardBetter && diff > 0 && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              Best choice
            </span>
          )}
        </label>
        <label
          className={`flex flex-col items-center gap-1 border rounded-lg p-4 cursor-pointer transition-colors ${
            deductions.method === 'itemized'
              ? 'border-tax-blue bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            name="deduction-method"
            value="itemized"
            checked={deductions.method === 'itemized'}
            onChange={() => setDeductionMethod('itemized')}
            className="sr-only"
          />
          <span className="text-sm font-medium text-gray-900">Itemized</span>
          <span className="text-lg font-bold text-gray-700">
            {formatCurrency(itemizedTotal)}
          </span>
          {!standardBetter && diff > 0 && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              Best choice
            </span>
          )}
        </label>
      </div>

      {/* Itemized detail form */}
      {deductions.method === 'itemized' && (
        <div className="mt-6 flex flex-col gap-4">

          {/* Medical & Dental */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-800">Medical &amp; Dental</span>
                <InfoTooltip
                  explanation="Deductible medical and dental expenses include costs for diagnosis, treatment, and prevention of disease. Only the portion exceeding 7.5% of your AGI qualifies. Eligible expenses include doctor visits, prescriptions, dental and vision care, and long-term care premiums."
                  pubName="IRS Publication 502 — Medical and Dental Expenses"
                  pubUrl="https://www.irs.gov/publications/p502"
                />
                <span className="text-xs text-gray-400">Lines 1–4</span>
              </div>
              {scheduleA && (
                <span className="text-sm font-semibold text-gray-700">
                  {formatCurrency(medicalDeductible)}
                </span>
              )}
            </div>
            <CurrencyInput
              label="Medical expenses"
              value={itemized.medicalExpenses}
              onChange={(v) => setItemizedDeductions({ medicalExpenses: v })}
              helperText={`Only the amount above 7.5% of your AGI (${formatCurrency(medicalFloor)}) is deductible.`}
            />
            {scheduleA && (
              <LimitedBadge entered={itemized.medicalExpenses} deductible={medicalDeductible} />
            )}
          </div>

          {/* State & Local Taxes */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-800">State &amp; Local Taxes</span>
                <InfoTooltip
                  explanation="Deduct state/local income taxes OR general sales taxes — whichever is higher (not both). Add real estate taxes and personal property taxes. For 2025 the combined SALT deduction is capped at $40,000 (One Big Beautiful Bill Act §70120), with a 30% phase-out above $500,000 AGI and a $10,000 floor."
                  pubName="IRS Schedule A Instructions — Taxes You Paid (Lines 5–6)"
                  pubUrl="https://www.irs.gov/instructions/i1040sca"
                />
                <span className="text-xs text-gray-400">Lines 5a–7</span>
              </div>
              {scheduleA && (
                <span className="text-sm font-semibold text-gray-700">
                  {formatCurrency(saltDeductible)}
                </span>
              )}
            </div>
            <CurrencyInput
              label="State/local income taxes (Line 5a)"
              value={itemized.stateLocalIncomeTaxes}
              onChange={(v) => setItemizedDeductions({ stateLocalIncomeTaxes: v })}
              helperText="OR enter sales taxes below — the higher amount is used"
            />
            <CurrencyInput
              label="General sales taxes paid (Line 5a)"
              value={itemized.stateLocalSalesTaxes}
              onChange={(v) => setItemizedDeductions({ stateLocalSalesTaxes: v })}
            />
            {(itemized.stateLocalIncomeTaxes > 0 || itemized.stateLocalSalesTaxes > 0) && (
              <p className="text-xs text-blue-600">
                Using {itemized.stateLocalIncomeTaxes >= itemized.stateLocalSalesTaxes ? 'income taxes' : 'sales taxes'} for Line 5a
                ({formatCurrency(Math.max(itemized.stateLocalIncomeTaxes, itemized.stateLocalSalesTaxes))})
              </p>
            )}
            <CurrencyInput
              label="Real estate taxes (property taxes) (Line 5b)"
              value={itemized.realEstateTaxes}
              onChange={(v) => setItemizedDeductions({ realEstateTaxes: v })}
            />
            <CurrencyInput
              label="Personal property taxes (Line 5c)"
              value={itemized.personalPropertyTaxes}
              onChange={(v) => setItemizedDeductions({ personalPropertyTaxes: v })}
              helperText="e.g., vehicle registration fees based on value"
            />
            {scheduleA && (
              <LimitedBadge entered={totalSalt} deductible={saltDeductible} />
            )}
          </div>

          {/* Interest */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-800">Interest</span>
                <InfoTooltip
                  explanation="Home mortgage interest (Form 1098) is deductible on acquisition debt up to $750,000 for loans originated after Dec 15, 2017, or $1,000,000 for earlier loans (IRC §163(h)(3)). Investment interest expense is deductible only up to your net investment income for the year (IRC §163(d))."
                  pubName="IRS Publication 936 — Home Mortgage Interest Deduction"
                  pubUrl="https://www.irs.gov/publications/p936"
                />
                <span className="text-xs text-gray-400">Lines 8–10</span>
              </div>
              {scheduleA && (
                <span className="text-sm font-semibold text-gray-700">
                  {formatCurrency(interestDeductible)}
                </span>
              )}
            </div>
            <CurrencyInput
              label="Home mortgage interest (Line 8a)"
              value={itemized.mortgageInterest}
              onChange={(v) => setItemizedDeductions({ mortgageInterest: v })}
              helperText="From Form 1098 Box 1"
            />
            <CurrencyInput
              label="Outstanding loan balance"
              value={itemized.mortgagePrincipal}
              onChange={(v) => setItemizedDeductions({ mortgagePrincipal: v })}
              helperText="From Form 1098 Box 2 — used to check the $750K/$1M limit"
            />
            {mortgageLimited && (
              <p className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Loan balance exceeds {formatCurrency(loanLimit)} limit — only the proportional share of interest is deductible.
              </p>
            )}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={itemized.mortgagePreTCJA}
                onChange={(e) => setItemizedDeductions({ mortgagePreTCJA: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">
                Loan originated before December 16, 2017?
                <span className="block text-xs text-gray-500 mt-0.5">
                  Yes → $1,000,000 limit; No → $750,000 limit
                </span>
              </span>
            </label>
            <CurrencyInput
              label="Margin / investment interest (Line 9)"
              value={itemized.investmentInterest}
              onChange={(v) => setItemizedDeductions({ investmentInterest: v })}
              helperText={`Limited to your net investment income (~${formatCurrency(netInvestmentIncome)} for this return)`}
            />
          </div>

          {/* Charitable Contributions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-800">Charitable Contributions</span>
                <InfoTooltip
                  explanation="Donations to qualifying 501(c)(3) organizations are deductible. Cash contributions are limited to 60% of AGI; non-cash property donations to 30% of AGI (IRC §170(b)). Keep written acknowledgment for any single donation of $250 or more. Non-cash donations over $500 require Form 8283."
                  pubName="IRS Publication 526 — Charitable Contributions"
                  pubUrl="https://www.irs.gov/publications/p526"
                />
                <span className="text-xs text-gray-400">Lines 11–14</span>
              </div>
              {scheduleA && (
                <span className="text-sm font-semibold text-gray-700">
                  {formatCurrency(charitableDeductible)}
                </span>
              )}
            </div>
            <CurrencyInput
              label="Cash / check donations (Line 11)"
              value={itemized.charitableCash}
              onChange={(v) => setItemizedDeductions({ charitableCash: v })}
              helperText={`Limited to 60% of AGI (${formatCurrency(cashAgiLimit)})`}
            />
            <CurrencyInput
              label="Non-cash donations (Line 12)"
              value={itemized.charitableNoncash}
              onChange={(v) => setItemizedDeductions({ charitableNoncash: v })}
              helperText={`Limited to 30% of AGI (${formatCurrency(noncashAgiLimit)})`}
            />
            {scheduleA && (
              <LimitedBadge
                entered={itemized.charitableCash + itemized.charitableNoncash}
                deductible={charitableDeductible}
              />
            )}
          </div>

          {/* Other Deductions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-800">Other Deductions</span>
                <InfoTooltip
                  explanation="Includes gambling losses (limited to gambling winnings reported on Schedule 1), casualty and theft losses from federally declared disaster areas (Form 4684), federal estate tax on income in respect of a decedent, and certain other deductions listed in the Schedule A instructions."
                  pubName="IRS Schedule A Instructions — Other Itemized Deductions (Line 16)"
                  pubUrl="https://www.irs.gov/instructions/i1040sca"
                />
                <span className="text-xs text-gray-400">Line 16</span>
              </div>
              {scheduleA && (
                <span className="text-sm font-semibold text-gray-700">
                  {formatCurrency(otherDeductible)}
                </span>
              )}
            </div>
            <CurrencyInput
              label="Other deductions"
              value={itemized.otherDeductions}
              onChange={(v) => setItemizedDeductions({ otherDeductions: v })}
            />
          </div>
        </div>
      )}

      {/* Comparison */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-md p-4 text-sm">
        {deductions.method === 'itemized' && scheduleA ? (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-gray-600">
                <span>Medical (after 7.5% floor):</span>
                <span className="font-medium text-gray-700">{formatCurrency(medicalDeductible)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>State &amp; Local Taxes (capped):</span>
                <span className="font-medium text-gray-700">{formatCurrency(saltDeductible)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Interest:</span>
                <span className="font-medium text-gray-700">{formatCurrency(interestDeductible)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Charitable:</span>
                <span className="font-medium text-gray-700">{formatCurrency(charitableDeductible)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Other:</span>
                <span className="font-medium text-gray-700">{formatCurrency(otherDeductible)}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between font-semibold text-gray-800">
              <span>Total Itemized:</span>
              <span>{formatCurrency(itemizedTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600 mt-1">
              <span>Standard Deduction:</span>
              <span className="font-medium">{formatCurrency(standardAmount)}</span>
            </div>
            <div className={`mt-2 pt-2 border-t border-gray-200 font-semibold ${standardBetter ? 'text-amber-700' : 'text-emerald-700'}`}>
              {standardBetter
                ? `Standard is better by ${formatCurrency(diff)}`
                : `Itemized is better by ${formatCurrency(diff)}`}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">Standard deduction:</span>
              <span className="font-medium">{formatCurrency(standardAmount)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-600">Total itemized:</span>
              <span className="font-medium">{formatCurrency(itemizedTotal)}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 font-medium text-gray-900">
              {standardBetter
                ? `Standard is better by ${formatCurrency(diff)}`
                : `Itemized is better by ${formatCurrency(diff)}`}
            </div>
          </>
        )}
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
