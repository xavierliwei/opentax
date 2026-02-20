import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { OCRUpload } from '../components/OCRUpload.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { Form1099R } from '../../model/types.ts'

function empty1099R(): Form1099R {
  return {
    id: crypto.randomUUID(),
    payerName: '',
    box1: 0,
    box2a: 0,
    box2bTaxableNotDetermined: false,
    box2bTotalDistribution: false,
    box3: 0,
    box4: 0,
    box5: 0,
    box7: '',
    iraOrSep: false,
  }
}

/** Human-readable labels for common distribution codes */
const DIST_CODE_LABELS: Record<string, string> = {
  '1': 'Early distribution (under 59½), no exception',
  '2': 'Early distribution, exception applies',
  '3': 'Disability',
  '4': 'Death',
  '7': 'Normal distribution (age 59½ or older)',
  'G': 'Direct rollover to qualified plan/IRA',
  'H': 'Direct rollover of designated Roth',
  'T': 'Roth IRA distribution, exception applies',
}

function DistributionCodeHint({ code }: { code: string }) {
  const label = DIST_CODE_LABELS[code.toUpperCase()]
  if (!label) return null
  return <span className="text-xs text-gray-500 ml-1">— {label}</span>
}

function Form1099RCard({ form }: { form: Form1099R }) {
  const updateForm1099R = useTaxStore((s) => s.updateForm1099R)

  const update = (fields: Partial<Form1099R>) => updateForm1099R(form.id, fields)

  const isRollover = form.box7.toUpperCase().includes('G') || form.box7.toUpperCase().includes('H')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Payer name</label>
        <input
          type="text"
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
          value={form.payerName}
          onChange={(e) => update({ payerName: e.target.value })}
          placeholder="Fidelity Investments"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CurrencyInput
          label={<>Box 1 — Gross distribution<InfoTooltip
            explanation="Box 1 reports the total amount of the distribution before income tax or other deductions were withheld. This includes taxable and non-taxable amounts. For IRA/SEP/SIMPLE distributions, this flows to Form 1040 Line 4a. For pensions/401(k), it flows to Line 5a."
            pubName="IRS Instructions for 1099-R"
            pubUrl="https://www.irs.gov/instructions/i1099r"
          /></>}
          value={form.box1}
          onChange={(v) => update({ box1: v })}
        />
        <CurrencyInput
          label={<>Box 2a — Taxable amount<InfoTooltip
            explanation="Box 2a reports the taxable portion of the distribution. For a direct rollover (code G), this should be $0. If Box 2b 'Taxable amount not determined' is checked, you may need to compute the taxable portion using the General Rule or Simplified Method."
            pubName="IRS Publication 575 — Pension and Annuity Income"
            pubUrl="https://www.irs.gov/publications/p575"
          /></>}
          value={form.box2a}
          onChange={(v) => update({ box2a: v })}
        />
        <CurrencyInput
          label="Box 4 — Federal tax withheld"
          value={form.box4}
          onChange={(v) => update({ box4: v })}
        />
        <CurrencyInput
          label={<>Box 5 — Employee contributions<InfoTooltip
            explanation="Box 5 reports the employee's after-tax contributions or designated Roth contributions. This amount represents the non-taxable portion of the distribution (your basis that was already taxed)."
            pubName="IRS Publication 575 — Employee Contributions"
            pubUrl="https://www.irs.gov/publications/p575"
          /></>}
          value={form.box5}
          onChange={(v) => update({ box5: v })}
        />
      </div>

      {/* Distribution code + IRA checkbox */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Box 7 — Distribution code
            <InfoTooltip
              explanation="The distribution code tells the IRS (and OpenTax) what type of distribution this is. Common codes: 1 = early distribution, 7 = normal distribution, G = direct rollover (non-taxable). The code determines whether a 10% early withdrawal penalty applies."
              pubName="IRS 1099-R Distribution Codes"
              pubUrl="https://www.irs.gov/instructions/i1099r"
            />
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-20 uppercase focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={form.box7}
              maxLength={2}
              onChange={(e) => update({ box7: e.target.value.toUpperCase() })}
              placeholder="7"
            />
            <DistributionCodeHint code={form.box7} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            IRA/SEP/SIMPLE
            <InfoTooltip
              explanation="If this box is checked on your 1099-R, it means the distribution is from an IRA, SEP, or SIMPLE plan. It flows to Form 1040 Lines 4a/4b. If unchecked, the distribution is from a pension, 401(k), or annuity and flows to Lines 5a/5b."
              pubName="IRS Instructions for 1099-R"
              pubUrl="https://www.irs.gov/instructions/i1099r"
            />
          </label>
          <label className="flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-tax-blue"
              checked={form.iraOrSep}
              onChange={(e) => update({ iraOrSep: e.target.checked })}
            />
            <span className="text-sm text-gray-600">IRA/SEP/SIMPLE distribution</span>
          </label>
        </div>
      </div>

      {/* Rollover notice */}
      {isRollover && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-700">
          Code {form.box7} indicates a direct rollover — this distribution is not taxable.
        </div>
      )}
    </div>
  )
}

export function RetirementIncomePage() {
  const forms = useTaxStore((s) => s.taxReturn.form1099Rs ?? [])
  const addForm1099R = useTaxStore((s) => s.addForm1099R)
  const removeForm1099R = useTaxStore((s) => s.removeForm1099R)
  const interview = useInterview()

  return (
    <div data-testid="page-retirement-income" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Retirement Distributions (1099-R)</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter the information from each 1099-R you received for retirement account distributions,
        pensions, annuities, or rollovers. Skip this step if you had no retirement distributions.
      </p>

      <div className="mt-6 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Upload a 1099-R</h2>
        <OCRUpload formType="1099-R" />
      </div>

      <div className="mt-6">
        <RepeatableSection
          label="1099-R Forms"
          items={forms}
          addLabel="Add 1099-R"
          emptyMessage="No 1099-R forms added. Click '+ Add 1099-R' if you received retirement distributions."
          onAdd={() => addForm1099R(empty1099R())}
          onRemove={(index) => {
            const form = forms[index]
            if (form) removeForm1099R(form.id)
          }}
          renderItem={(form) => <Form1099RCard form={form} />}
        />
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
