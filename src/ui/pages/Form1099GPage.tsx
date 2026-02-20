import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { Form1099G } from '../../model/types.ts'

function empty1099G(): Form1099G {
  return {
    id: crypto.randomUUID(),
    payerName: '',
    box1: 0,
    box2: 0,
    box3: 0,
    box4: 0,
    box5: 0,
    box10a: 0,
    box10b: 0,
    box11: 0,
  }
}

function Form1099GCard({ form }: { form: Form1099G }) {
  const updateForm1099G = useTaxStore((s) => s.updateForm1099G)

  const update = (fields: Partial<Form1099G>) => updateForm1099G(form.id, fields)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Payer name</label>
        <input
          type="text"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
          value={form.payerName}
          onChange={(e) => update({ payerName: e.target.value })}
          placeholder="State Department of Labor"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CurrencyInput
          label={<>Box 1 — Unemployment compensation<InfoTooltip
            explanation="Box 1 reports unemployment compensation paid to you. This amount is fully taxable and flows to Schedule 1 Line 7, then to Form 1040 Line 8 (other income)."
            pubName="IRS Instructions for Form 1099-G"
            pubUrl="https://www.irs.gov/instructions/i1099g"
          /></>}
          value={form.box1}
          onChange={(v) => update({ box1: v })}
        />
        <CurrencyInput
          label={<>Box 2 — State/local tax refunds<InfoTooltip
            explanation="Box 2 reports state or local income tax refunds, credits, or offsets. This is only taxable if you itemized deductions on your prior-year federal return AND deducted state/local income taxes (tax benefit rule, IRC &sect;111). If you took the standard deduction last year, this amount is not taxable."
            pubName="IRS Pub 525 — Taxable and Nontaxable Income"
            pubUrl="https://www.irs.gov/publications/p525"
          /></>}
          value={form.box2}
          onChange={(v) => update({ box2: v })}
        />
        <CurrencyInput
          label="Box 4 — Federal tax withheld"
          value={form.box4}
          onChange={(v) => update({ box4: v })}
        />
        <CurrencyInput
          label="Box 11 — State tax withheld"
          value={form.box11}
          onChange={(v) => update({ box11: v })}
        />
      </div>
    </div>
  )
}

export function Form1099GPage() {
  const forms = useTaxStore((s) => s.taxReturn.form1099Gs ?? [])
  const itemizedLastYear = useTaxStore((s) => s.taxReturn.priorYear?.itemizedLastYear ?? false)
  const addForm1099G = useTaxStore((s) => s.addForm1099G)
  const removeForm1099G = useTaxStore((s) => s.removeForm1099G)
  const setPriorYear = useTaxStore((s) => s.setPriorYear)
  const interview = useInterview()

  return (
    <div data-testid="page-1099g" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Government Payments (1099-G)</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter information from each 1099-G you received for unemployment compensation or
        state/local tax refunds. Skip this step if you had none.
      </p>

      <div className="mt-6">
        <RepeatableSection
          label="1099-G Forms"
          items={forms}
          addLabel="Add 1099-G"
          emptyMessage="No 1099-G forms added. Click '+ Add 1099-G' if you received unemployment or a state tax refund."
          onAdd={() => addForm1099G(empty1099G())}
          onRemove={(index) => {
            const form = forms[index]
            if (form) removeForm1099G(form.id)
          }}
          renderItem={(form) => <Form1099GCard form={form} />}
        />
      </div>

      {/* Prior-year itemization toggle — affects taxable refund computation */}
      {forms.some(f => f.box2 > 0) && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-md p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={itemizedLastYear}
              onChange={(e) => setPriorYear({ itemizedLastYear: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium text-amber-900">
                I itemized deductions on my 2024 federal return
              </span>
              <p className="text-xs text-amber-700 mt-0.5">
                Your state tax refund (Box 2) is only taxable if you itemized last year and
                deducted state/local income taxes. If you took the standard deduction in 2024,
                leave this unchecked — the refund is not taxable.
              </p>
            </div>
          </label>
        </div>
      )}

      <InterviewNav interview={interview} />
    </div>
  )
}
