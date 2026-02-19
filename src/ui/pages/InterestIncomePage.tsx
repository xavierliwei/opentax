import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { OCRUpload } from '../components/OCRUpload.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { Form1099INT } from '../../model/types.ts'

function empty1099INT(): Form1099INT {
  return {
    id: crypto.randomUUID(),
    payerName: '',
    box1: 0,
    box2: 0,
    box3: 0,
    box4: 0,
    box8: 0,
  }
}

function Form1099INTCard({ form }: { form: Form1099INT }) {
  const updateForm1099INT = useTaxStore((s) => s.updateForm1099INT)

  const update = (fields: Partial<Form1099INT>) => updateForm1099INT(form.id, fields)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Payer name</label>
        <input
          type="text"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
          value={form.payerName}
          onChange={(e) => update({ payerName: e.target.value })}
          placeholder="Savings Bank"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CurrencyInput
          label={<>Box 1 — Interest income<InfoTooltip
            explanation="Box 1 reports taxable interest income from bank accounts, money market funds, CDs, and most bonds. It is fully taxable as ordinary income and flows to Form 1040 Line 2b (taxable interest)."
            pubName="IRS Publication 550 — Interest Income"
            pubUrl="https://www.irs.gov/publications/p550"
          /></>}
          value={form.box1}
          onChange={(v) => update({ box1: v })}
        />
        <CurrencyInput
          label={<>Box 3 — US Savings Bonds<InfoTooltip
            explanation="Box 3 reports interest on U.S. Savings Bonds (Series EE, E, I) and U.S. Treasury obligations. This interest is taxable federally but exempt from state and local income taxes. It flows to Form 1040 Line 2b along with Box 1 interest."
            pubName="IRS Publication 550 — U.S. Savings Bonds Interest"
            pubUrl="https://www.irs.gov/publications/p550"
          /></>}
          value={form.box3}
          onChange={(v) => update({ box3: v })}
        />
        <CurrencyInput
          label="Box 4 — Federal tax withheld"
          value={form.box4}
          onChange={(v) => update({ box4: v })}
        />
        <CurrencyInput
          label={<>Box 8 — Tax-exempt interest<InfoTooltip
            explanation="Box 8 reports tax-exempt interest, typically from municipal bonds or municipal bond funds. It is not subject to federal income tax and is reported on Form 1040 Line 2a (not added to taxable income). However, it may still be subject to the Alternative Minimum Tax (AMT) if it is from private activity bonds."
            pubName="IRS Publication 550 — Tax-Exempt Interest"
            pubUrl="https://www.irs.gov/publications/p550"
          /></>}
          value={form.box8}
          onChange={(v) => update({ box8: v })}
        />
      </div>
    </div>
  )
}

export function InterestIncomePage() {
  const forms = useTaxStore((s) => s.taxReturn.form1099INTs)
  const addForm1099INT = useTaxStore((s) => s.addForm1099INT)
  const removeForm1099INT = useTaxStore((s) => s.removeForm1099INT)
  const interview = useInterview()

  return (
    <div data-testid="page-interest-income" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Interest Income (1099-INT)</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter the information from each 1099-INT you received. Skip this step if you had no interest
        income.
      </p>

      <div className="mt-6 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Upload a 1099-INT</h2>
        <OCRUpload formType="1099-INT" />
      </div>

      <div className="mt-6">
        <RepeatableSection
          label="1099-INT Forms"
          items={forms}
          addLabel="Add 1099-INT"
          emptyMessage="No 1099-INT forms added. Click '+ Add 1099-INT' if you received interest income."
          onAdd={() => addForm1099INT(empty1099INT())}
          onRemove={(index) => {
            const form = forms[index]
            if (form) removeForm1099INT(form.id)
          }}
          renderItem={(form) => <Form1099INTCard form={form} />}
        />
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
