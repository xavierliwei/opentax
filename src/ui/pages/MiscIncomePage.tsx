import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { Form1099MISC } from '../../model/types.ts'

function empty1099MISC(): Form1099MISC {
  return {
    id: crypto.randomUUID(),
    payerName: '',
    box1: 0,
    box2: 0,
    box3: 0,
    box4: 0,
  }
}

function Form1099MISCCard({ form }: { form: Form1099MISC }) {
  const updateForm1099MISC = useTaxStore((s) => s.updateForm1099MISC)

  const update = (fields: Partial<Form1099MISC>) => updateForm1099MISC(form.id, fields)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Payer name</label>
        <input
          type="text"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
          value={form.payerName}
          onChange={(e) => update({ payerName: e.target.value })}
          placeholder="Rental Agency LLC"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CurrencyInput
          label={<>Box 1 — Rents<InfoTooltip
            explanation="Box 1 reports rental income you received from real property. This flows to Schedule 1 Line 5 and then to Form 1040 Line 8 (other income)."
            pubName="IRS Instructions for Form 1099-MISC"
            pubUrl="https://www.irs.gov/instructions/i1099mec"
          /></>}
          value={form.box1}
          onChange={(v) => update({ box1: v })}
        />
        <CurrencyInput
          label={<>Box 2 — Royalties<InfoTooltip
            explanation="Box 2 reports royalty payments of $10 or more from oil, gas, mineral properties, copyrights, and patents. This flows to Schedule 1 Line 5 and then to Form 1040 Line 8."
            pubName="IRS Instructions for Form 1099-MISC"
            pubUrl="https://www.irs.gov/instructions/i1099mec"
          /></>}
          value={form.box2}
          onChange={(v) => update({ box2: v })}
        />
        <CurrencyInput
          label={<>Box 3 — Other income<InfoTooltip
            explanation="Box 3 reports prizes, awards, and other miscellaneous income not covered by other boxes. This flows to Schedule 1 Line 8z and then to Form 1040 Line 8."
            pubName="IRS Instructions for Form 1099-MISC"
            pubUrl="https://www.irs.gov/instructions/i1099mec"
          /></>}
          value={form.box3}
          onChange={(v) => update({ box3: v })}
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

export function MiscIncomePage() {
  const forms = useTaxStore((s) => s.taxReturn.form1099MISCs)
  const addForm1099MISC = useTaxStore((s) => s.addForm1099MISC)
  const removeForm1099MISC = useTaxStore((s) => s.removeForm1099MISC)
  const interview = useInterview()

  return (
    <div data-testid="page-misc-income" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Other Income (1099-MISC)</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter the information from each 1099-MISC you received for rents, royalties, prizes, or
        other miscellaneous income. Skip this step if you had none.
      </p>

      <div className="mt-6">
        <RepeatableSection
          label="1099-MISC Forms"
          items={forms}
          addLabel="Add 1099-MISC"
          emptyMessage="No 1099-MISC forms added. Click '+ Add 1099-MISC' if you received miscellaneous income."
          onAdd={() => addForm1099MISC(empty1099MISC())}
          onRemove={(index) => {
            const form = forms[index]
            if (form) removeForm1099MISC(form.id)
          }}
          renderItem={(form) => <Form1099MISCCard form={form} />}
        />
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
