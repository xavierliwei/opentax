import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import {
  STANDARD_DEDUCTION,
  MEDICAL_AGI_FLOOR_RATE,
  CHARITABLE_CASH_AGI_LIMIT,
  CHARITABLE_NONCASH_AGI_LIMIT,
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
        </label>
      </div>

      {/* Itemized detail form */}
      {deductions.method === 'itemized' && (
        <div className="mt-6 flex flex-col gap-6">
          {/* Medical */}
          <CurrencyInput
            label="Medical expenses"
            value={itemized.medicalExpenses}
            onChange={(v) => setItemizedDeductions({ medicalExpenses: v })}
            helperText={`Only the amount above 7.5% of your AGI (${formatCurrency(medicalFloor)}) is deductible.`}
          />

          {/* State & Local Taxes */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-700 border-t border-gray-100 pt-4">
              State &amp; Local Taxes
            </p>
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
            <p className="text-xs text-gray-500">
              Combined SALT deductible:{' '}
              {formatCurrency(Math.min(
                Math.max(itemized.stateLocalIncomeTaxes, itemized.stateLocalSalesTaxes) +
                  itemized.realEstateTaxes + itemized.personalPropertyTaxes,
                effectiveSaltCap,
              ))}{' '}
              (cap: {formatCurrency(effectiveSaltCap)})
            </p>
          </div>

          {/* Interest */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-700 border-t border-gray-100 pt-4">
              Interest
            </p>
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
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-700 border-t border-gray-100 pt-4">
              Charitable Contributions
            </p>
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
          </div>

          {/* Other */}
          <CurrencyInput
            label="Other deductions"
            value={itemized.otherDeductions}
            onChange={(v) => setItemizedDeductions({ otherDeductions: v })}
          />
        </div>
      )}

      {/* Comparison */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-md p-4 text-sm">
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
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
