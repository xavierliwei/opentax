import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { Form1099NEC } from '../../model/types.ts'

function empty1099NEC(): Form1099NEC {
  return {
    id: crypto.randomUUID(),
    payerName: '',
    nonemployeeCompensation: 0,
    federalTaxWithheld: 0,
  }
}

function Form1099NECCard({ form }: { form: Form1099NEC }) {
  const updateForm1099NEC = useTaxStore((s) => s.updateForm1099NEC)

  const update = (fields: Partial<Form1099NEC>) => updateForm1099NEC(form.id, fields)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-gray-700">Payer name</label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={form.payerName}
            onChange={(e) => update({ payerName: e.target.value })}
            placeholder="Acme Corp"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Payer TIN (optional)</label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={form.payerTIN ?? ''}
            onChange={(e) => update({ payerTIN: e.target.value || undefined })}
            placeholder="XX-XXXXXXX"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CurrencyInput
          label={<>Box 1 — Nonemployee compensation<InfoTooltip
            explanation="Box 1 reports nonemployee compensation of $600 or more. This is income from freelance work, gig economy jobs, or contract work. It flows to Schedule C as gross receipts and is subject to self-employment tax."
            pubName="IRS Instructions for Form 1099-NEC"
            pubUrl="https://www.irs.gov/instructions/i1099mec"
          /></>}
          value={form.nonemployeeCompensation}
          onChange={(v) => update({ nonemployeeCompensation: v })}
        />
        <CurrencyInput
          label="Box 4 — Federal tax withheld"
          value={form.federalTaxWithheld ?? 0}
          onChange={(v) => update({ federalTaxWithheld: v })}
        />
      </div>
    </div>
  )
}

export function Form1099NECPage() {
  const forms = useTaxStore((s) => s.taxReturn.form1099NECs ?? [])
  const addForm1099NEC = useTaxStore((s) => s.addForm1099NEC)
  const removeForm1099NEC = useTaxStore((s) => s.removeForm1099NEC)
  const interview = useInterview()

  return (
    <div data-testid="page-1099-nec-income" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">1099-NEC Income</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter your 1099-NEC forms for nonemployee compensation (freelance, gig, contract work).
        This income flows to Schedule C and is subject to self-employment tax.
      </p>

      <div className="mt-6">
        <RepeatableSection
          label="1099-NEC Forms"
          items={forms}
          addLabel="Add 1099-NEC"
          emptyMessage="No 1099-NEC forms added. Click '+ Add 1099-NEC' if you received nonemployee compensation."
          onAdd={() => addForm1099NEC(empty1099NEC())}
          onRemove={(index) => {
            const form = forms[index]
            if (form) removeForm1099NEC(form.id)
          }}
          renderItem={(form) => <Form1099NECCard form={form} />}
        />
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
