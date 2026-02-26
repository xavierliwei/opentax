import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { Form8829Data } from '../../model/types.ts'

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function emptyForm8829(scheduleCId: string): Form8829Data {
  return {
    scheduleCId,
    method: 'simplified',
    businessSquareFootage: 0,
  }
}

function HomeOfficeCard({ data, businessName }: { data: Form8829Data; businessName: string }) {
  const updateForm8829 = useTaxStore((s) => s.updateForm8829)

  const update = (fields: Partial<Form8829Data>) => updateForm8829(data.scheduleCId, fields)

  // Computed values for display
  const isSimplified = data.method === 'simplified'
  const isRegular = data.method === 'regular'

  // Simplified calculation
  const simplifiedSqFt = Math.min(data.businessSquareFootage ?? 0, 300)
  const simplifiedDeduction = simplifiedSqFt * 500 // $5.00 per sq ft in cents

  // Regular calculation
  let businessPct = 0
  if (isRegular) {
    if ((data.businessUsePercentage ?? 0) > 0) {
      businessPct = Math.min(data.businessUsePercentage ?? 0, 100)
    } else {
      const total = data.totalHomeSquareFootage ?? 0
      const biz = data.businessUseSquareFootage ?? 0
      businessPct = total > 0 ? Math.min((biz / total) * 100, 100) : 0
    }
  }
  const pctFraction = businessPct / 100

  const directExpenses = (data.directRepairs ?? 0) + (data.directOther ?? 0)
  const indirectTotal = (data.mortgageInterest ?? 0) + (data.realEstateTaxes ?? 0) +
    (data.insurance ?? 0) + (data.rent ?? 0) + (data.utilities ?? 0) +
    (data.repairs ?? 0) + (data.other ?? 0)
  const indirectProrated = Math.round(indirectTotal * pctFraction)
  const regularTotal = directExpenses + indirectProrated

  return (
    <div className="flex flex-col gap-5">
      <div className="text-sm text-gray-600 font-medium">
        Home Office for: <span className="text-gray-900">{businessName || '(unnamed business)'}</span>
      </div>

      {/* Method selector */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-gray-700 mb-1">
          Deduction Method
          <InfoTooltip
            explanation="Choose simplified ($5/sq ft, max $1,500) for ease, or regular (actual expenses) for potentially larger deductions."
            pubName="IRS Form 8829 Instructions"
            pubUrl="https://www.irs.gov/instructions/i8829"
          />
        </legend>
        <label className="flex items-start gap-3 cursor-pointer p-2 rounded-md border border-gray-200 hover:bg-gray-50">
          <input
            type="radio"
            name={`method-${data.scheduleCId}`}
            value="simplified"
            checked={isSimplified}
            onChange={() => update({ method: 'simplified' })}
            className="mt-0.5"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">Simplified Method</span>
            <p className="text-xs text-gray-500">$5 per sq ft of home used for business, up to 300 sq ft ($1,500 max). No depreciation needed.</p>
          </div>
        </label>
        <label className="flex items-start gap-3 cursor-pointer p-2 rounded-md border border-gray-200 hover:bg-gray-50">
          <input
            type="radio"
            name={`method-${data.scheduleCId}`}
            value="regular"
            checked={isRegular}
            onChange={() => update({ method: 'regular' })}
            className="mt-0.5"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">Regular Method</span>
            <p className="text-xs text-gray-500">Compute actual expenses (prorated by business-use %). May give a larger deduction.</p>
          </div>
        </label>
      </fieldset>

      {/* Simplified method fields */}
      {isSimplified && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Square footage used for business (max 300)
            </label>
            <input
              type="number"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={data.businessSquareFootage ?? 0}
              min={0}
              max={300}
              onChange={(e) => update({ businessSquareFootage: Math.min(300, Math.max(0, parseInt(e.target.value) || 0)) })}
            />
          </div>
          <div className="bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Deduction: {simplifiedSqFt} sq ft x $5.00</span>
              <strong className="text-gray-900">${fmt(simplifiedDeduction)}</strong>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This amount will appear on Schedule C, Line 30. It cannot exceed your business's tentative profit.
            </p>
          </div>
        </div>
      )}

      {/* Regular method fields */}
      {isRegular && (
        <div className="flex flex-col gap-4">
          {/* Part I — Business use percentage */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Part I: Business Use of Home
              <InfoTooltip
                explanation="Enter the total area of your home and the area used regularly and exclusively for business. The percentage is calculated automatically."
                pubName="IRS Form 8829 Instructions — Part I"
                pubUrl="https://www.irs.gov/instructions/i8829"
              />
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600">Total home area (sq ft)</label>
                <input
                  type="number"
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                  value={data.totalHomeSquareFootage ?? 0}
                  min={0}
                  onChange={(e) => update({ totalHomeSquareFootage: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-600">Business-use area (sq ft)</label>
                <input
                  type="number"
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                  value={data.businessUseSquareFootage ?? 0}
                  min={0}
                  onChange={(e) => update({ businessUseSquareFootage: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <span>Business-use percentage:</span>
              <strong className="text-gray-900">{businessPct.toFixed(2)}%</strong>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Or enter a percentage directly (overrides sq ft calculation):
            </p>
            <input
              type="number"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-24 mt-1 focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={data.businessUsePercentage ?? ''}
              min={0}
              max={100}
              step={0.01}
              placeholder="%"
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                update({ businessUsePercentage: isNaN(val) ? undefined : Math.min(100, Math.max(0, val)) })
              }}
            />
          </div>

          {/* Direct expenses */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Direct Expenses
              <InfoTooltip
                explanation="Direct expenses benefit only the business part of your home (e.g., painting the office). These are deducted at 100%, not prorated."
                pubName="IRS Form 8829 Instructions — Part II"
                pubUrl="https://www.irs.gov/instructions/i8829"
              />
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CurrencyInput
                label="Repairs (direct — business area only)"
                value={data.directRepairs ?? 0}
                onChange={(v) => update({ directRepairs: v })}
              />
              <CurrencyInput
                label="Other direct expenses"
                value={data.directOther ?? 0}
                onChange={(v) => update({ directOther: v })}
              />
            </div>
          </div>

          {/* Indirect expenses */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Indirect Expenses
              <InfoTooltip
                explanation="Indirect expenses benefit the whole home (mortgage interest, taxes, utilities, etc.). They are prorated by the business-use percentage."
                pubName="IRS Form 8829 Instructions — Part II"
                pubUrl="https://www.irs.gov/instructions/i8829"
              />
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CurrencyInput
                label={<>Mortgage interest
                  <InfoTooltip
                    explanation="If you itemize deductions, the business-use portion of mortgage interest will be removed from Schedule A and claimed here instead (no double-counting)."
                    pubName="IRS Form 8829 Instructions"
                    pubUrl="https://www.irs.gov/instructions/i8829"
                  />
                </>}
                value={data.mortgageInterest ?? 0}
                onChange={(v) => update({ mortgageInterest: v })}
              />
              <CurrencyInput
                label={<>Real estate taxes
                  <InfoTooltip
                    explanation="If you itemize, the business-use portion of property taxes will be removed from Schedule A and claimed here instead."
                    pubName="IRS Form 8829 Instructions"
                    pubUrl="https://www.irs.gov/instructions/i8829"
                  />
                </>}
                value={data.realEstateTaxes ?? 0}
                onChange={(v) => update({ realEstateTaxes: v })}
              />
              <CurrencyInput label="Insurance" value={data.insurance ?? 0} onChange={(v) => update({ insurance: v })} />
              <CurrencyInput label="Rent (if renting)" value={data.rent ?? 0} onChange={(v) => update({ rent: v })} />
              <CurrencyInput label="Utilities" value={data.utilities ?? 0} onChange={(v) => update({ utilities: v })} />
              <CurrencyInput label="Repairs (whole house)" value={data.repairs ?? 0} onChange={(v) => update({ repairs: v })} />
              <CurrencyInput label="Other indirect expenses" value={data.other ?? 0} onChange={(v) => update({ other: v })} />
            </div>
          </div>

          {/* Depreciation */}
          {!(data.rent && data.rent > 0) && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Depreciation
                <InfoTooltip
                  explanation="If you own your home, you can depreciate the building (not land) over 39 years. Enter the adjusted basis of your home excluding land value."
                  pubName="IRS Form 8829 Instructions — Part III"
                  pubUrl="https://www.irs.gov/instructions/i8829"
                />
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CurrencyInput
                  label="Home value (excluding land)"
                  value={data.homeValue ?? 0}
                  onChange={(v) => update({ homeValue: v })}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-600">Date placed in service</label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                    value={data.datePlacedInService ?? ''}
                    onChange={(e) => update({ datePlacedInService: e.target.value || undefined })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Direct expenses</span>
              <span>${fmt(directExpenses)}</span>
            </div>
            <div className="flex justify-between">
              <span>Indirect expenses ({businessPct.toFixed(1)}% of ${fmt(indirectTotal)})</span>
              <span>${fmt(indirectProrated)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
              <strong>Estimated deduction (before profit limit)</strong>
              <strong className="text-gray-900">${fmt(regularTotal)}</strong>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The final deduction on Schedule C Line 30 cannot exceed the tentative profit from this business.
              Depreciation (if applicable) is computed automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export function Form8829Page() {
  const businesses = useTaxStore((s) => s.taxReturn.scheduleCBusinesses)
  const form8829s = useTaxStore((s) => s.taxReturn.form8829s ?? [])
  const addForm8829 = useTaxStore((s) => s.addForm8829)
  const removeForm8829 = useTaxStore((s) => s.removeForm8829)
  const interview = useInterview()

  // Only businesses that have hasHomeOffice checked, or already have a Form 8829
  const eligibleBusinesses = businesses.filter(biz =>
    biz.hasHomeOffice || form8829s.some(f => f.scheduleCId === biz.id),
  )

  // Ensure a Form 8829 entry exists for each eligible business
  const ensureForm8829 = (scheduleCId: string) => {
    if (!form8829s.some(f => f.scheduleCId === scheduleCId)) {
      addForm8829(emptyForm8829(scheduleCId))
    }
  }

  return (
    <div data-testid="page-form8829" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Home Office Deduction</h1>
      <p className="mt-1 text-sm text-gray-600">
        Deduct expenses for the business use of your home (Form 8829). To use this,
        check "Home office deduction" on your Schedule C business under Additional Features.
      </p>

      {eligibleBusinesses.length === 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
          No businesses have home office deduction enabled. Go to the Business Income (Schedule C) step
          and check "Home office deduction" under Additional Features for the applicable business.
        </div>
      )}

      {eligibleBusinesses.map(biz => {
        const existing = form8829s.find(f => f.scheduleCId === biz.id)
        if (!existing) {
          // Auto-create the Form 8829 entry
          ensureForm8829(biz.id)
          return null
        }
        return (
          <div key={biz.id} className="mt-6 border border-gray-200 rounded-lg p-4 sm:p-5">
            <HomeOfficeCard data={existing} businessName={biz.businessName} />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => removeForm8829(biz.id)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Remove home office for this business
              </button>
            </div>
          </div>
        )
      })}

      <InterviewNav interview={interview} />
    </div>
  )
}
