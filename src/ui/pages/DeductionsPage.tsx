import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import { STANDARD_DEDUCTION, SALT_BASE_CAP, MEDICAL_AGI_FLOOR_RATE } from '../../rules/2025/constants.ts'
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
  const setDeductionMethod = useTaxStore((s) => s.setDeductionMethod)
  const setItemizedDeductions = useTaxStore((s) => s.setItemizedDeductions)
  const interview = useInterview()

  const standardAmount = STANDARD_DEDUCTION[filingStatus]
  const saltCap = SALT_BASE_CAP[filingStatus]
  const medicalFloor = Math.round(agi * MEDICAL_AGI_FLOOR_RATE)

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

  // SALT: system uses max(income, sales) + real estate + personal property
  const salt =
    Math.max(itemized.stateLocalIncomeTaxes, itemized.stateLocalSalesTaxes) +
    itemized.realEstateTaxes +
    itemized.personalPropertyTaxes

  const itemizedTotal =
    itemized.medicalExpenses +
    salt +
    itemized.mortgageInterest +
    itemized.investmentInterest +
    itemized.charitableCash +
    itemized.charitableNoncash +
    itemized.otherDeductions

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
        <div className="mt-6 flex flex-col gap-4">
          <CurrencyInput
            label="Medical expenses"
            value={itemized.medicalExpenses}
            onChange={(v) => setItemizedDeductions({ medicalExpenses: v })}
            helperText={`Only the amount above 7.5% of your AGI (${formatCurrency(medicalFloor)}) is deductible.`}
          />
          <CurrencyInput
            label="State and local income taxes (SALT)"
            value={itemized.stateLocalIncomeTaxes}
            onChange={(v) => setItemizedDeductions({ stateLocalIncomeTaxes: v })}
            helperText={`Capped at ${formatCurrency(saltCap)} for ${filingStatus === 'mfj' ? 'married filing jointly' : 'your filing status'}. Also add real estate and personal property taxes below.`}
          />
          <CurrencyInput
            label="Real estate taxes"
            value={itemized.realEstateTaxes}
            onChange={(v) => setItemizedDeductions({ realEstateTaxes: v })}
            helperText="State and local real estate taxes on property you own."
          />
          <CurrencyInput
            label="Personal property taxes"
            value={itemized.personalPropertyTaxes}
            onChange={(v) => setItemizedDeductions({ personalPropertyTaxes: v })}
            helperText="Value-based taxes on vehicles or other personal property."
          />
          <CurrencyInput
            label="Mortgage interest"
            value={itemized.mortgageInterest}
            onChange={(v) => setItemizedDeductions({ mortgageInterest: v })}
          />
          <CurrencyInput
            label="Charitable contributions (cash)"
            value={itemized.charitableCash}
            onChange={(v) => setItemizedDeductions({ charitableCash: v })}
          />
          <CurrencyInput
            label="Charitable contributions (non-cash)"
            value={itemized.charitableNoncash}
            onChange={(v) => setItemizedDeductions({ charitableNoncash: v })}
          />
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
