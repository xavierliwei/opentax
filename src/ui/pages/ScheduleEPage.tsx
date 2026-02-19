import { useState } from 'react'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { ScheduleEProperty, ScheduleEPropertyType } from '../../model/types.ts'
import { getEffectiveDepreciation } from '../../rules/2025/scheduleE.ts'

const PROPERTY_TYPES: { value: ScheduleEPropertyType; label: string }[] = [
  { value: 'single-family', label: 'Single Family Residence' },
  { value: 'multi-family', label: 'Multi-Family Residence' },
  { value: 'vacation', label: 'Vacation / Short-Term Rental' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land', label: 'Land' },
  { value: 'royalties', label: 'Royalties' },
  { value: 'other', label: 'Other' },
]

function emptyProperty(): ScheduleEProperty {
  return {
    id: crypto.randomUUID(),
    address: '',
    propertyType: 'single-family',
    fairRentalDays: 0,
    personalUseDays: 0,
    rentsReceived: 0,
    royaltiesReceived: 0,
    advertising: 0,
    auto: 0,
    cleaning: 0,
    commissions: 0,
    insurance: 0,
    legal: 0,
    management: 0,
    mortgageInterest: 0,
    otherInterest: 0,
    repairs: 0,
    supplies: 0,
    taxes: 0,
    utilities: 0,
    depreciation: 0,
    other: 0,
    depreciableBasis: 0,
    placedInServiceMonth: 0,
    placedInServiceYear: 0,
  }
}

function PropertyCard({ prop }: { prop: ScheduleEProperty }) {
  const updateScheduleEProperty = useTaxStore((s) => s.updateScheduleEProperty)
  const [expensesOpen, setExpensesOpen] = useState(false)

  const update = (fields: Partial<ScheduleEProperty>) => updateScheduleEProperty(prop.id, fields)

  const depBasis = prop.depreciableBasis ?? 0
  const pisMonth = prop.placedInServiceMonth ?? 0
  const pisYear = prop.placedInServiceYear ?? 0

  const effectiveDep = getEffectiveDepreciation(prop)
  const hasAutoDepreciation = depBasis > 0 && pisYear > 0 && pisMonth > 0
  const isDepreciableType = !['land', 'royalties'].includes(prop.propertyType)

  const totalExpenses =
    prop.advertising + prop.auto + prop.cleaning + prop.commissions +
    prop.insurance + prop.legal + prop.management + prop.mortgageInterest +
    prop.otherInterest + prop.repairs + prop.supplies + prop.taxes +
    prop.utilities + effectiveDep + prop.other
  const totalIncome = prop.rentsReceived + prop.royaltiesReceived
  const netIncome = totalIncome - totalExpenses

  return (
    <div className="flex flex-col gap-4">
      {/* Property Info */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Property address</label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={prop.address}
            onChange={(e) => update({ address: e.target.value })}
            placeholder="123 Main St, City, ST 12345"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Property type</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={prop.propertyType}
              onChange={(e) => update({ propertyType: e.target.value as ScheduleEPropertyType })}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Fair rental days
              <InfoTooltip explanation="Number of days during the year the property was rented at fair rental price." pubName="IRS Schedule E Instructions" pubUrl="https://www.irs.gov/instructions/i1040se" />
            </label>
            <input
              type="number"
              min={0}
              max={365}
              className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={prop.fairRentalDays || ''}
              onChange={(e) => update({ fairRentalDays: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Personal use days
              <InfoTooltip explanation="Number of days during the year you used the property for personal purposes." pubName="IRS Schedule E Instructions" pubUrl="https://www.irs.gov/instructions/i1040se" />
            </label>
            <input
              type="number"
              min={0}
              max={365}
              className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={prop.personalUseDays || ''}
              onChange={(e) => update({ personalUseDays: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      {/* Income */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CurrencyInput
          label={<>Rents received (Line 3)<InfoTooltip
            explanation="Total rents received for this property during the tax year."
            pubName="IRS Schedule E Instructions"
            pubUrl="https://www.irs.gov/instructions/i1040se"
          /></>}
          value={prop.rentsReceived}
          onChange={(v) => update({ rentsReceived: v })}
        />
        {prop.propertyType === 'royalties' && (
          <CurrencyInput
            label={<>Royalties received (Line 4)<InfoTooltip
              explanation="Royalty income from oil, gas, mineral properties, copyrights, or patents."
              pubName="IRS Schedule E Instructions"
              pubUrl="https://www.irs.gov/instructions/i1040se"
            /></>}
            value={prop.royaltiesReceived}
            onChange={(v) => update({ royaltiesReceived: v })}
          />
        )}
      </div>

      {/* Expenses — collapsible */}
      <div className="border border-gray-200 rounded-md">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setExpensesOpen(!expensesOpen)}
        >
          <span>Expenses (Lines 5–19)</span>
          <span className="text-gray-400">{expensesOpen ? '▲' : '▼'}</span>
        </button>

        {expensesOpen && (
          <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CurrencyInput label="Advertising" value={prop.advertising} onChange={(v) => update({ advertising: v })} />
            <CurrencyInput label="Auto and travel" value={prop.auto} onChange={(v) => update({ auto: v })} />
            <CurrencyInput label="Cleaning and maintenance" value={prop.cleaning} onChange={(v) => update({ cleaning: v })} />
            <CurrencyInput label="Commissions" value={prop.commissions} onChange={(v) => update({ commissions: v })} />
            <CurrencyInput label="Insurance" value={prop.insurance} onChange={(v) => update({ insurance: v })} />
            <CurrencyInput label="Legal and professional fees" value={prop.legal} onChange={(v) => update({ legal: v })} />
            <CurrencyInput label="Management fees" value={prop.management} onChange={(v) => update({ management: v })} />
            <CurrencyInput label="Mortgage interest" value={prop.mortgageInterest} onChange={(v) => update({ mortgageInterest: v })} />
            <CurrencyInput label="Other interest" value={prop.otherInterest} onChange={(v) => update({ otherInterest: v })} />
            <CurrencyInput label="Repairs" value={prop.repairs} onChange={(v) => update({ repairs: v })} />
            <CurrencyInput label="Supplies" value={prop.supplies} onChange={(v) => update({ supplies: v })} />
            <CurrencyInput label="Taxes" value={prop.taxes} onChange={(v) => update({ taxes: v })} />
            <CurrencyInput label="Utilities" value={prop.utilities} onChange={(v) => update({ utilities: v })} />
            {/* Depreciation — calculator or manual */}
            {isDepreciableType ? (
              <div className="sm:col-span-2 border border-gray-200 rounded-md p-3 flex flex-col gap-3">
                <div className="text-sm font-medium text-gray-700">
                  Depreciation (Line 18)
                  <InfoTooltip
                    explanation="Enter the building cost (excluding land) and placed-in-service date for automatic straight-line depreciation, or enter the amount manually below."
                    pubName="IRS Schedule E Instructions"
                    pubUrl="https://www.irs.gov/instructions/i1040se"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <CurrencyInput
                    label="Depreciable basis (building cost)"
                    value={depBasis}
                    onChange={(v) => update({ depreciableBasis: v })}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Month placed in service</label>
                    <select
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                      value={pisMonth || ''}
                      onChange={(e) => update({ placedInServiceMonth: parseInt(e.target.value) || 0 })}
                    >
                      <option value="">--</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2025, i).toLocaleString('en-US', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Year placed in service</label>
                    <input
                      type="number"
                      min={1900}
                      max={2025}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                      value={pisYear || ''}
                      onChange={(e) => update({ placedInServiceYear: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {hasAutoDepreciation ? (
                  <div className="text-sm text-gray-600 bg-blue-50 rounded px-3 py-2">
                    Computed depreciation: <strong>${(effectiveDep / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    {' '}(straight-line, {prop.propertyType === 'commercial' ? '39' : '27.5'}-year, mid-month convention)
                    <p className="mt-1 text-xs text-gray-500">
                      This uses simplified straight-line depreciation. For MACRS percentage tables, Section 179 expensing,
                      or bonus depreciation, clear the fields above and enter the amount manually instead.
                    </p>
                  </div>
                ) : (
                  <CurrencyInput
                    label="Depreciation amount (manual)"
                    value={prop.depreciation}
                    onChange={(v) => update({ depreciation: v })}
                  />
                )}
              </div>
            ) : (
              <CurrencyInput
                label={<>Depreciation (Line 18)<InfoTooltip
                  explanation="Enter the depreciation amount for this property."
                  pubName="IRS Schedule E Instructions"
                  pubUrl="https://www.irs.gov/instructions/i1040se"
                /></>}
                value={prop.depreciation}
                onChange={(v) => update({ depreciation: v })}
              />
            )}
            <CurrencyInput label="Other expenses" value={prop.other} onChange={(v) => update({ other: v })} />
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-600 flex justify-between">
        <span>Total expenses: <strong>${(totalExpenses / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
        <span>Net income: <strong className={netIncome < 0 ? 'text-red-600' : 'text-green-700'}>
          {netIncome < 0 ? '-' : ''}${(Math.abs(netIncome) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </strong></span>
      </div>
    </div>
  )
}

export function ScheduleEPage() {
  const properties = useTaxStore((s) => s.taxReturn.scheduleEProperties)
  const addScheduleEProperty = useTaxStore((s) => s.addScheduleEProperty)
  const removeScheduleEProperty = useTaxStore((s) => s.removeScheduleEProperty)
  const interview = useInterview()

  return (
    <div data-testid="page-rental-income" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Rental Income (Schedule E)</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter information for each rental property you own. Report rental income, expenses
        (insurance, repairs, depreciation, etc.), and the net income will flow to your Form 1040
        via Schedule 1.
      </p>

      <div className="mt-6">
        <RepeatableSection
          label="Rental Properties"
          items={properties}
          addLabel="Add Property"
          emptyMessage="No rental properties added. Click '+ Add Property' if you had rental real estate or royalty income."
          onAdd={() => addScheduleEProperty(emptyProperty())}
          onRemove={(index) => {
            const prop = properties[index]
            if (prop) removeScheduleEProperty(prop.id)
          }}
          renderItem={(prop) => <PropertyCard prop={prop} />}
        />
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
