import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { OCRUpload } from '../components/OCRUpload.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { Form1099DIV } from '../../model/types.ts'

function empty1099DIV(): Form1099DIV {
  return {
    id: crypto.randomUUID(),
    payerName: '',
    box1a: 0,
    box1b: 0,
    box2a: 0,
    box3: 0,
    box4: 0,
    box5: 0,
    box11: 0,
  }
}

function Form1099DIVCard({ form }: { form: Form1099DIV }) {
  const updateForm1099DIV = useTaxStore((s) => s.updateForm1099DIV)

  const update = (fields: Partial<Form1099DIV>) => updateForm1099DIV(form.id, fields)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Payer name</label>
        <input
          type="text"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
          value={form.payerName}
          onChange={(e) => update({ payerName: e.target.value })}
          placeholder="Vanguard"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CurrencyInput
          label="Box 1a — Ordinary dividends"
          value={form.box1a}
          onChange={(v) => update({ box1a: v })}
        />
        <CurrencyInput
          label="Box 1b — Qualified dividends"
          value={form.box1b}
          onChange={(v) => update({ box1b: v })}
        />
        <CurrencyInput
          label="Box 2a — Capital gain distributions"
          value={form.box2a}
          onChange={(v) => update({ box2a: v })}
        />
        <CurrencyInput
          label="Box 4 — Federal tax withheld"
          value={form.box4}
          onChange={(v) => update({ box4: v })}
        />
      </div>
    </div>
  )
}

export function DividendIncomePage() {
  const forms = useTaxStore((s) => s.taxReturn.form1099DIVs)
  const addForm1099DIV = useTaxStore((s) => s.addForm1099DIV)
  const removeForm1099DIV = useTaxStore((s) => s.removeForm1099DIV)
  const interview = useInterview()

  return (
    <div data-testid="page-dividend-income" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Dividend Income (1099-DIV)</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter the information from each 1099-DIV you received. Skip this step if you had no dividend
        income.
      </p>

      <div className="mt-6 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Scan a 1099-DIV</h2>
        <OCRUpload formType="1099-DIV" />
      </div>

      <div className="mt-6">
        <RepeatableSection
          label="1099-DIV Forms"
          items={forms}
          addLabel="Add 1099-DIV"
          emptyMessage="No 1099-DIV forms added. Click '+ Add 1099-DIV' if you received dividend income."
          onAdd={() => addForm1099DIV(empty1099DIV())}
          onRemove={(index) => {
            const form = forms[index]
            if (form) removeForm1099DIV(form.id)
          }}
          renderItem={(form) => <Form1099DIVCard form={form} />}
        />
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
