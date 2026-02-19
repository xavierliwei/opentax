import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { OCRUpload } from '../components/OCRUpload.tsx'
import { Button } from '../components/Button.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { W2 } from '../../model/types.ts'

function emptyW2(): W2 {
  return {
    id: crypto.randomUUID(),
    employerEin: '',
    employerName: '',
    box1: 0,
    box2: 0,
    box3: 0,
    box4: 0,
    box5: 0,
    box6: 0,
    box7: 0,
    box8: 0,
    box10: 0,
    box11: 0,
    box12: [],
    box13StatutoryEmployee: false,
    box13RetirementPlan: false,
    box13ThirdPartySickPay: false,
    box14: '',
  }
}

const CARD_ACCENTS = [
  { border: 'border-l-blue-500',   bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700' },
  { border: 'border-l-emerald-500', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
  { border: 'border-l-amber-500',  bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700' },
  { border: 'border-l-rose-500',   bg: 'bg-rose-50',   badge: 'bg-rose-100 text-rose-700' },
  { border: 'border-l-purple-500', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
]

function W2Card({ w2, index }: { w2: W2; index: number }) {
  const updateW2 = useTaxStore((s) => s.updateW2)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const update = (fields: Partial<W2>) => updateW2(w2.id, fields)
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length]

  return (
    <div className="flex flex-col gap-4">
      {/* Card header */}
      <div className={`-mx-3 -mt-3 px-3 py-2 rounded-t-md flex items-center gap-2 pr-16 ${accent.bg}`}>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${accent.badge}`}>
          W-2 #{index + 1}
        </span>
        <span className="text-sm font-medium text-gray-700 truncate">
          {w2.employerName || <span className="text-gray-400 font-normal">Employer name not entered</span>}
        </span>
      </div>
      {/* Employer info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Employer name</label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={w2.employerName}
            onChange={(e) => update({ employerName: e.target.value })}
            placeholder="Acme Corp"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Employer EIN</label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={w2.employerEin}
            onChange={(e) => update({ employerEin: e.target.value })}
            placeholder="12-3456789"
          />
        </div>
      </div>

      {/* Primary boxes */}
      <div className="grid grid-cols-2 gap-3">
        <CurrencyInput
          label="Box 1 — Wages"
          value={w2.box1}
          onChange={(v) => update({ box1: v })}
        />
        <CurrencyInput
          label="Box 2 — Federal tax withheld"
          value={w2.box2}
          onChange={(v) => update({ box2: v })}
        />
        <CurrencyInput
          label="Box 3 — Social Security wages"
          value={w2.box3}
          onChange={(v) => update({ box3: v })}
        />
        <CurrencyInput
          label="Box 4 — Social Security tax"
          value={w2.box4}
          onChange={(v) => update({ box4: v })}
        />
        <CurrencyInput
          label="Box 5 — Medicare wages"
          value={w2.box5}
          onChange={(v) => update({ box5: v })}
        />
        <CurrencyInput
          label="Box 6 — Medicare tax"
          value={w2.box6}
          onChange={(v) => update({ box6: v })}
        />
      </div>

      {/* Advanced boxes toggle */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start -ml-2 text-gray-500"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Box 7–20 (advanced)
      </Button>

      {showAdvanced && (
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <CurrencyInput
              label="Box 7 — Social Security tips"
              value={w2.box7}
              onChange={(v) => update({ box7: v })}
            />
            <CurrencyInput
              label="Box 8 — Allocated tips"
              value={w2.box8}
              onChange={(v) => update({ box8: v })}
            />
            <CurrencyInput
              label="Box 10 — Dependent care benefits"
              value={w2.box10}
              onChange={(v) => update({ box10: v })}
            />
            <CurrencyInput
              label="Box 11 — Nonqualified plans"
              value={w2.box11}
              onChange={(v) => update({ box11: v })}
            />
          </div>

          {/* Box 13 checkboxes */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-700">Box 13</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={w2.box13StatutoryEmployee}
                  onChange={(e) => update({ box13StatutoryEmployee: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Statutory employee
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={w2.box13RetirementPlan}
                  onChange={(e) => update({ box13RetirementPlan: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Retirement plan
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={w2.box13ThirdPartySickPay}
                  onChange={(e) => update({ box13ThirdPartySickPay: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Third-party sick pay
              </label>
            </div>
          </div>

          {/* Box 14 */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Box 14 — Other</label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={w2.box14}
              onChange={(e) => update({ box14: e.target.value })}
            />
          </div>

          {/* State/local boxes 15-20 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Box 15 — State</label>
              <input
                type="text"
                maxLength={2}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent uppercase"
                value={w2.box15State ?? ''}
                onChange={(e) => update({ box15State: e.target.value.toUpperCase() })}
                placeholder="CA"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Box 15 — Employer state ID</label>
              <input
                type="text"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                value={w2.box15EmployerStateId ?? ''}
                onChange={(e) => update({ box15EmployerStateId: e.target.value })}
              />
            </div>
            <CurrencyInput
              label="Box 16 — State wages"
              value={w2.box16StateWages ?? 0}
              onChange={(v) => update({ box16StateWages: v })}
            />
            <CurrencyInput
              label="Box 17 — State income tax"
              value={w2.box17StateIncomeTax ?? 0}
              onChange={(v) => update({ box17StateIncomeTax: v })}
            />
            <CurrencyInput
              label="Box 18 — Local wages"
              value={w2.box18LocalWages ?? 0}
              onChange={(v) => update({ box18LocalWages: v })}
            />
            <CurrencyInput
              label="Box 19 — Local income tax"
              value={w2.box19LocalIncomeTax ?? 0}
              onChange={(v) => update({ box19LocalIncomeTax: v })}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Box 20 — Locality name</label>
              <input
                type="text"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                value={w2.box20LocalityName ?? ''}
                onChange={(e) => update({ box20LocalityName: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function W2IncomePage() {
  const w2s = useTaxStore((s) => s.taxReturn.w2s)
  const addW2 = useTaxStore((s) => s.addW2)
  const removeW2 = useTaxStore((s) => s.removeW2)
  const interview = useInterview()

  return (
    <div data-testid="page-w2-income" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">W-2 Wage and Tax Statements</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter the information from each W-2 you received. You can add multiple W-2s if you had more
        than one employer.
      </p>

      <div className="mt-6 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">Scan a W-2</h2>
        <OCRUpload formType="W-2" />
      </div>

      <div className="mt-6">
        <RepeatableSection
          label="W-2 Forms"
          items={w2s}
          addLabel="Add another W-2"
          emptyMessage="No W-2s added yet. Click '+ Add another W-2' to enter your wage information."
          onAdd={() => addW2(emptyW2())}
          onRemove={(index) => {
            const w2 = w2s[index]
            if (w2) removeW2(w2.id)
          }}
          renderItem={(w2, index) => <W2Card w2={w2} index={index} />}
        />
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
