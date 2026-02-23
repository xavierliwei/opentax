import { useState } from 'react'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { ScheduleC, ScheduleCAccountingMethod } from '../../model/types.ts'

function emptyBusiness(): ScheduleC {
  return {
    id: crypto.randomUUID(),
    businessName: '',
    principalBusinessCode: '',
    accountingMethod: 'cash',
    grossReceipts: 0,
    returns: 0,
    costOfGoodsSold: 0,
    advertising: 0,
    carAndTruck: 0,
    commissions: 0,
    contractLabor: 0,
    depreciation: 0,
    insurance: 0,
    mortgageInterest: 0,
    otherInterest: 0,
    legal: 0,
    officeExpense: 0,
    rent: 0,
    repairs: 0,
    supplies: 0,
    taxes: 0,
    travel: 0,
    meals: 0,
    utilities: 0,
    wages: 0,
    otherExpenses: 0,
  }
}

function BusinessCard({ biz }: { biz: ScheduleC }) {
  const updateScheduleC = useTaxStore((s) => s.updateScheduleC)
  const filingStatus = useTaxStore((s) => s.taxReturn.filingStatus)
  const [expensesOpen, setExpensesOpen] = useState(false)
  const [flagsOpen, setFlagsOpen] = useState(false)

  const update = (fields: Partial<ScheduleC>) => updateScheduleC(biz.id, fields)

  const grossIncome = biz.grossReceipts - biz.returns
  const grossProfit = grossIncome - biz.costOfGoodsSold
  const totalExpenses =
    biz.advertising + biz.carAndTruck + biz.commissions + biz.contractLabor +
    biz.depreciation + biz.insurance + biz.mortgageInterest + biz.otherInterest +
    biz.legal + biz.officeExpense + biz.rent + biz.repairs + biz.supplies +
    biz.taxes + biz.travel + biz.meals + biz.utilities + biz.wages + biz.otherExpenses
  const netProfit = grossProfit - totalExpenses

  return (
    <div className="flex flex-col gap-4">
      {/* Business Info */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Business name
              <InfoTooltip
                explanation="Enter the legal name of your business as shown on Schedule C, Part I."
                pubName="IRS Schedule C Instructions"
                pubUrl="https://www.irs.gov/instructions/i1040sc"
              />
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={biz.businessName}
              onChange={(e) => update({ businessName: e.target.value })}
              placeholder="e.g., Jane's Consulting LLC"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              EIN (optional)
              <InfoTooltip
                explanation="Employer Identification Number. Required if you have employees or a Keogh plan. Sole proprietors without employees may leave this blank."
                pubName="IRS Schedule C Instructions"
                pubUrl="https://www.irs.gov/instructions/i1040sc"
              />
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={biz.businessEin ?? ''}
              onChange={(e) => update({ businessEin: e.target.value })}
              placeholder="XX-XXXXXXX"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Principal business code (NAICS)
              <InfoTooltip
                explanation="6-digit code from the NAICS list that best describes your business activity. For example: 541511 (Custom Computer Programming) or 711510 (Independent Artists). See Schedule C instructions for the full list."
                pubName="IRS Schedule C — Principal Business Codes"
                pubUrl="https://www.irs.gov/instructions/i1040sc"
              />
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={biz.principalBusinessCode}
              onChange={(e) => update({ principalBusinessCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              placeholder="e.g., 541511"
              inputMode="numeric"
              maxLength={6}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Accounting method</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={biz.accountingMethod}
              onChange={(e) => update({ accountingMethod: e.target.value as ScheduleCAccountingMethod })}
            >
              <option value="cash">Cash</option>
              <option value="accrual">Accrual</option>
            </select>
          </div>
        </div>

        {filingStatus === 'mfj' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Whose business?</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent w-full sm:w-48"
              value={biz.owner ?? 'taxpayer'}
              onChange={(e) => update({ owner: e.target.value as 'taxpayer' | 'spouse' })}
            >
              <option value="taxpayer">Taxpayer</option>
              <option value="spouse">Spouse</option>
            </select>
          </div>
        )}
      </div>

      {/* Gross Income */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Gross Income (Part I)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CurrencyInput
            label={<>Gross receipts (Line 1)
              <InfoTooltip
                explanation="Total income received from your business before any deductions. Include all 1099-NEC and 1099-MISC Box 7 amounts, plus cash and other payments."
                pubName="IRS Schedule C Instructions — Line 1"
                pubUrl="https://www.irs.gov/instructions/i1040sc"
              />
            </>}
            value={biz.grossReceipts}
            onChange={(v) => update({ grossReceipts: v })}
          />
          <CurrencyInput
            label="Returns & allowances (Line 2)"
            value={biz.returns}
            onChange={(v) => update({ returns: v })}
          />
          <CurrencyInput
            label={<>Cost of goods sold (Line 4)
              <InfoTooltip
                explanation="If you sell products, enter the cost of goods sold. Detailed Part III computation is not yet supported — enter the final COGS amount here."
                pubName="IRS Schedule C Instructions — Line 4"
                pubUrl="https://www.irs.gov/instructions/i1040sc"
              />
            </>}
            value={biz.costOfGoodsSold}
            onChange={(v) => update({ costOfGoodsSold: v })}
          />
        </div>
      </div>

      {/* Expenses — collapsible */}
      <div className="border border-gray-200 rounded-md">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setExpensesOpen(!expensesOpen)}
        >
          <span>Expenses (Part II, Lines 8–27)</span>
          <span className="text-gray-400">{expensesOpen ? '▲' : '▼'}</span>
        </button>
        {expensesOpen && (
          <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CurrencyInput label="Advertising (Line 8)" value={biz.advertising} onChange={(v) => update({ advertising: v })} />
            <CurrencyInput
              label={<>Car & truck expenses (Line 9)
                <InfoTooltip
                  explanation="Standard mileage rate for 2025 is 70¢/mile for business use. Alternatively, enter actual expenses. Vehicle detail (Form 4562 Part V) is not yet computed."
                  pubName="IRS Schedule C Instructions — Line 9"
                  pubUrl="https://www.irs.gov/instructions/i1040sc"
                />
              </>}
              value={biz.carAndTruck}
              onChange={(v) => update({ carAndTruck: v })}
            />
            <CurrencyInput label="Commissions & fees (Line 10)" value={biz.commissions} onChange={(v) => update({ commissions: v })} />
            <CurrencyInput label="Contract labor (Line 11)" value={biz.contractLabor} onChange={(v) => update({ contractLabor: v })} />
            <CurrencyInput label="Depreciation (Line 13)" value={biz.depreciation} onChange={(v) => update({ depreciation: v })} />
            <CurrencyInput label="Insurance (Line 15)" value={biz.insurance} onChange={(v) => update({ insurance: v })} />
            <CurrencyInput label="Mortgage interest (Line 16a)" value={biz.mortgageInterest} onChange={(v) => update({ mortgageInterest: v })} />
            <CurrencyInput label="Other interest (Line 16b)" value={biz.otherInterest} onChange={(v) => update({ otherInterest: v })} />
            <CurrencyInput label="Legal & professional (Line 17)" value={biz.legal} onChange={(v) => update({ legal: v })} />
            <CurrencyInput label="Office expense (Line 18)" value={biz.officeExpense} onChange={(v) => update({ officeExpense: v })} />
            <CurrencyInput label="Rent — machinery/equipment (Line 20b)" value={biz.rent} onChange={(v) => update({ rent: v })} />
            <CurrencyInput label="Repairs & maintenance (Line 21)" value={biz.repairs} onChange={(v) => update({ repairs: v })} />
            <CurrencyInput label="Supplies (Line 22)" value={biz.supplies} onChange={(v) => update({ supplies: v })} />
            <CurrencyInput label="Taxes & licenses (Line 23)" value={biz.taxes} onChange={(v) => update({ taxes: v })} />
            <CurrencyInput label="Travel (Line 24a)" value={biz.travel} onChange={(v) => update({ travel: v })} />
            <CurrencyInput
              label={<>Meals (Line 24b)
                <InfoTooltip
                  explanation="Business meals are 50% deductible. Enter the full amount — OpenTax automatically applies the 50% limitation."
                  pubName="IRS Schedule C Instructions — Line 24b"
                  pubUrl="https://www.irs.gov/instructions/i1040sc"
                />
              </>}
              value={biz.meals}
              onChange={(v) => update({ meals: v })}
            />
            <CurrencyInput label="Utilities (Line 25)" value={biz.utilities} onChange={(v) => update({ utilities: v })} />
            <CurrencyInput label="Wages (Line 26)" value={biz.wages} onChange={(v) => update({ wages: v })} />
            <CurrencyInput label="Other expenses (Line 27a)" value={biz.otherExpenses} onChange={(v) => update({ otherExpenses: v })} />
          </div>
        )}
      </div>

      {/* Unsupported feature flags — collapsible */}
      <div className="border border-gray-200 rounded-md">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          onClick={() => setFlagsOpen(!flagsOpen)}
        >
          <span>Additional Features</span>
          <span className="text-gray-400">{flagsOpen ? '▲' : '▼'}</span>
        </button>
        {flagsOpen && (
          <div className="px-3 pb-3 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={biz.hasInventory ?? false}
                onChange={(e) => update({ hasInventory: e.target.checked })}
                className="rounded border-gray-300"
              />
              Business has inventory (Part III required)
            </label>
            {biz.hasInventory && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
                Schedule C Part III (Cost of Goods Sold detail) is not yet supported. COGS is used as entered above. For accurate inventory accounting, consult a tax professional.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={biz.hasHomeOffice ?? false}
                onChange={(e) => update({ hasHomeOffice: e.target.checked })}
                className="rounded border-gray-300"
              />
              Home office deduction (Form 8829)
            </label>
            {biz.hasHomeOffice && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
                Home office deduction (Form 8829) is not yet supported. You may be eligible for the simplified method ($5/sq ft, up to 300 sq ft = $1,500 max) or actual expenses. The deduction is currently $0 on this return.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={biz.hasVehicleExpenses ?? false}
                onChange={(e) => update({ hasVehicleExpenses: e.target.checked })}
                className="rounded border-gray-300"
              />
              Vehicle expense detail (Form 4562 Part V)
            </label>
            {biz.hasVehicleExpenses && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
                Vehicle expense detail (Form 4562 Part V) is not yet computed. Car/truck expenses above are used as entered. Enter either standard mileage (70¢/mile for 2025) or actual expenses.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Gross profit: <strong>${(grossProfit / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
          <span>Total expenses: <strong>${(totalExpenses / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
        </div>
        <div className="flex justify-end mt-1">
          <span>Net profit/loss (Line 31): <strong className={netProfit < 0 ? 'text-red-600' : 'text-green-700'}>
            {netProfit < 0 ? '-' : ''}${(Math.abs(netProfit) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </strong></span>
        </div>
      </div>

      {netProfit > 0 && (
        <p className="text-xs text-gray-500">
          Net profit flows to Schedule 1 Line 3 (business income). Self-employment tax (Schedule SE) is computed automatically at 15.3% (up to the Social Security wage base). The deductible half of SE tax reduces your AGI.
        </p>
      )}
    </div>
  )
}

export function ScheduleCPage() {
  const businesses = useTaxStore((s) => s.taxReturn.scheduleCBusinesses)
  const addScheduleC = useTaxStore((s) => s.addScheduleC)
  const removeScheduleC = useTaxStore((s) => s.removeScheduleC)
  const interview = useInterview()

  return (
    <div data-testid="page-schedule-c" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Business Income (Schedule C)</h1>
      <p className="mt-1 text-sm text-gray-600">
        Report profit or loss from a sole proprietorship or single-member LLC. Each business
        you operate gets its own Schedule C. Net profit is subject to self-employment tax (Schedule SE)
        and may qualify for the QBI deduction (Section 199A).
      </p>

      <div className="mt-6">
        <RepeatableSection
          label="Businesses"
          items={businesses}
          addLabel="Add Business"
          emptyMessage="No businesses added. Click '+ Add Business' if you had self-employment or freelance income."
          onAdd={() => addScheduleC(emptyBusiness())}
          onRemove={(index) => {
            const biz = businesses[index]
            if (biz) removeScheduleC(biz.id)
          }}
          renderItem={(biz) => <BusinessCard biz={biz} />}
        />
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
