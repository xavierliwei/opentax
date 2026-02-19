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
              <div>
                <span className="text-sm font-semibold text-gray-800">Medical &amp; Dental</span>
                <span className="ml-2 text-xs text-gray-400">Lines 1–4</span>
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
              <div>
                <span className="text-sm font-semibold text-gray-800">State &amp; Local Taxes</span>
                <span className="ml-2 text-xs text-gray-400">Lines 5a–7</span>
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
              <div>
                <span className="text-sm font-semibold text-gray-800">Interest</span>
                <span className="ml-2 text-xs text-gray-400">Lines 8–10</span>
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
              <div>
                <span className="text-sm font-semibold text-gray-800">Charitable Contributions</span>
                <span className="ml-2 text-xs text-gray-400">Lines 11–14</span>
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
              <div>
                <span className="text-sm font-semibold text-gray-800">Other Deductions</span>
                <span className="ml-2 text-xs text-gray-400">Line 16</span>
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
