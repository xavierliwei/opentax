import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { Form1095A, Form1095AMonthlyRow } from '../../model/types.ts'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function emptyForm1095A(): Form1095A {
  return {
    id: crypto.randomUUID(),
    marketplaceName: '',
    recipientName: '',
    rows: [],
  }
}

function emptyMonthlyRow(month: number): Form1095AMonthlyRow {
  return {
    month,
    enrollmentPremium: 0,
    slcspPremium: 0,
    advancePTC: 0,
  }
}

function MonthlyGrid({ form }: { form: Form1095A }) {
  const updateForm1095A = useTaxStore((s) => s.updateForm1095A)

  const rowMap = new Map(form.rows.map((r) => [r.month, r]))

  const updateRow = (month: number, field: keyof Form1095AMonthlyRow, value: number) => {
    const existing = rowMap.get(month) ?? emptyMonthlyRow(month)
    const updated = { ...existing, [field]: value }

    const newRows = form.rows.some((r) => r.month === month)
      ? form.rows.map((r) => (r.month === month ? updated : r))
      : [...form.rows, updated]

    updateForm1095A(form.id, { rows: newRows })
  }

  const hasAnyData = form.rows.some(
    (r) => r.enrollmentPremium > 0 || r.slcspPremium > 0 || r.advancePTC > 0,
  )

  const totalEnrollment = form.rows.reduce((s, r) => s + r.enrollmentPremium, 0)
  const totalSLCSP = form.rows.reduce((s, r) => s + r.slcspPremium, 0)
  const totalAPTC = form.rows.reduce((s, r) => s + r.advancePTC, 0)

  const applyAllMonths = () => {
    // Copy January to all months
    const jan = rowMap.get(1)
    if (!jan) return
    const newRows: Form1095AMonthlyRow[] = []
    for (let m = 1; m <= 12; m++) {
      newRows.push({ ...jan, month: m })
    }
    updateForm1095A(form.id, { rows: newRows })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          Monthly Amounts (Parts III & IV)
          <InfoTooltip
            explanation="Enter the monthly premium amounts from your 1095-A. Column A is the enrollment premium, Column B is the second lowest cost silver plan (SLCSP) premium, and Column C is the advance payment of PTC. These figures are used to reconcile your Premium Tax Credit on Form 8962."
            pubName="IRS Form 1095-A / Form 8962 Instructions"
            pubUrl="https://www.irs.gov/forms-pubs/about-form-1095-a"
          />
        </h4>
        {form.rows.some((r) => r.month === 1 && (r.enrollmentPremium > 0 || r.slcspPremium > 0)) && (
          <button
            type="button"
            className="text-xs text-tax-blue hover:text-blue-700 py-2 -my-2 px-2 -mx-1"
            onClick={applyAllMonths}
          >
            Copy Jan to all months
          </button>
        )}
      </div>

      {/* Desktop table header */}
      <div className="hidden sm:grid sm:grid-cols-[7rem_1fr_1fr_1fr] gap-2 text-xs font-medium text-gray-500 px-1">
        <span>Month</span>
        <span>Enrollment Premium (A)</span>
        <span>SLCSP Premium (B)</span>
        <span>Advance PTC (C)</span>
      </div>

      {/* Monthly rows */}
      {MONTHS.map((name, i) => {
        const month = i + 1
        const row = rowMap.get(month)
        return (
          <div key={month} className="grid grid-cols-1 sm:grid-cols-[7rem_1fr_1fr_1fr] gap-2 items-end border-b border-gray-100 pb-2 sm:border-0 sm:pb-0">
            <span className="text-sm font-medium text-gray-600 sm:self-center">{name}</span>
            <CurrencyInput
              label={<span className="sm:hidden">Enrollment Premium (A)</span>}
              value={row?.enrollmentPremium ?? 0}
              onChange={(v) => updateRow(month, 'enrollmentPremium', v)}
            />
            <CurrencyInput
              label={<span className="sm:hidden">SLCSP Premium (B)</span>}
              value={row?.slcspPremium ?? 0}
              onChange={(v) => updateRow(month, 'slcspPremium', v)}
            />
            <CurrencyInput
              label={<span className="sm:hidden">Advance PTC (C)</span>}
              value={row?.advancePTC ?? 0}
              onChange={(v) => updateRow(month, 'advancePTC', v)}
            />
          </div>
        )
      })}

      {/* Totals */}
      {hasAnyData && (
        <div className="grid grid-cols-1 sm:grid-cols-[7rem_1fr_1fr_1fr] gap-2 bg-gray-50 rounded-md px-1 py-2 text-sm font-medium text-gray-700">
          <span>Annual Total</span>
          <span>${(totalEnrollment / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span>${(totalSLCSP / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span>${(totalAPTC / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      )}
    </div>
  )
}

function Form1095ACard({ form }: { form: Form1095A }) {
  const updateForm1095A = useTaxStore((s) => s.updateForm1095A)

  return (
    <div className="flex flex-col gap-4">
      {/* Policy Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Marketplace name
            <InfoTooltip
              explanation="The name of the Health Insurance Marketplace (e.g., HealthCare.gov or your state marketplace) shown on Part I of your 1095-A."
              pubName="IRS Form 1095-A"
              pubUrl="https://www.irs.gov/forms-pubs/about-form-1095-a"
            />
          </label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={form.marketplaceName}
            onChange={(e) => updateForm1095A(form.id, { marketplaceName: e.target.value })}
            placeholder="e.g., HealthCare.gov"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Recipient name</label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={form.recipientName}
            onChange={(e) => updateForm1095A(form.id, { recipientName: e.target.value })}
            placeholder="Name on the policy"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Policy number (optional)</label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={form.policyNumber ?? ''}
            onChange={(e) => updateForm1095A(form.id, { policyNumber: e.target.value })}
          />
        </div>
      </div>

      {/* Monthly Grid */}
      <MonthlyGrid form={form} />
    </div>
  )
}

export function Form1095APage() {
  const forms = useTaxStore((s) => s.taxReturn.form1095As)
  const addForm1095A = useTaxStore((s) => s.addForm1095A)
  const removeForm1095A = useTaxStore((s) => s.removeForm1095A)
  const interview = useInterview()

  return (
    <div data-testid="page-form-1095a" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Health Insurance Marketplace (1095-A)</h1>
      <p className="mt-1 text-sm text-gray-600">
        If you or your family enrolled in health insurance through the Marketplace (e.g., HealthCare.gov),
        you should have received Form 1095-A. Enter the monthly amounts to reconcile your
        Premium Tax Credit (Form 8962).
      </p>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
        <p className="text-xs text-blue-800 font-medium">
          How Premium Tax Credit works
        </p>
        <p className="text-xs text-blue-700 mt-1">
          The PTC helps pay for Marketplace insurance based on your household income relative to the
          Federal Poverty Level. If advance payments (Column C) were more than the actual credit,
          you may owe the excess back. If less, you get an additional refund. OpenTax computes
          Form 8962 automatically from the data below.
        </p>
      </div>

      <div className="mt-6">
        <RepeatableSection
          label="1095-A Statements"
          items={forms}
          addLabel="Add 1095-A"
          emptyMessage="No 1095-A forms added. Click '+ Add 1095-A' if you had Marketplace health insurance."
          onAdd={() => addForm1095A(emptyForm1095A())}
          onRemove={(index) => {
            const form = forms[index]
            if (form) removeForm1095A(form.id)
          }}
          renderItem={(form) => <Form1095ACard form={form} />}
        />
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
