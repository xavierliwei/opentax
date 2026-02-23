import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { ScheduleK1, K1EntityType } from '../../model/types.ts'

const ENTITY_TYPES: { value: K1EntityType; label: string }[] = [
  { value: 'partnership', label: 'Partnership (Form 1065)' },
  { value: 's-corp', label: 'S Corporation (Form 1120-S)' },
  { value: 'trust-estate', label: 'Trust or Estate (Form 1041)' },
]

function emptyK1(): ScheduleK1 {
  return {
    id: crypto.randomUUID(),
    entityType: 'partnership',
    entityName: '',
    entityEin: '',
    ordinaryIncome: 0,
    rentalIncome: 0,
    interestIncome: 0,
    dividendIncome: 0,
    shortTermCapitalGain: 0,
    longTermCapitalGain: 0,
    section199AQBI: 0,
    distributions: 0,
  }
}

function K1Card({ k1 }: { k1: ScheduleK1 }) {
  const updateScheduleK1 = useTaxStore((s) => s.updateScheduleK1)
  const filingStatus = useTaxStore((s) => s.taxReturn.filingStatus)

  const update = (fields: Partial<ScheduleK1>) => updateScheduleK1(k1.id, fields)

  const totalIncome =
    k1.ordinaryIncome + k1.rentalIncome + (k1.guaranteedPayments ?? 0) +
    k1.interestIncome + k1.dividendIncome +
    k1.shortTermCapitalGain + k1.longTermCapitalGain

  const isPartnership = k1.entityType === 'partnership'

  return (
    <div className="flex flex-col gap-4">
      {/* Entity Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Entity name
            <InfoTooltip
              explanation="Name of the partnership, S corporation, or trust/estate that issued the K-1."
              pubName="IRS Schedule K-1 Instructions"
              pubUrl="https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1065"
            />
          </label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={k1.entityName}
            onChange={(e) => update({ entityName: e.target.value })}
            placeholder="e.g., ABC Partners LP"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Entity EIN</label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={k1.entityEin}
            onChange={(e) => update({ entityEin: e.target.value })}
            placeholder="XX-XXXXXXX"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Entity type</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={k1.entityType}
            onChange={(e) => update({ entityType: e.target.value as K1EntityType })}
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {filingStatus === 'mfj' && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Whose K-1?</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={k1.owner ?? 'taxpayer'}
              onChange={(e) => update({ owner: e.target.value as 'taxpayer' | 'spouse' })}
            >
              <option value="taxpayer">Taxpayer</option>
              <option value="spouse">Spouse</option>
            </select>
          </div>
        )}
      </div>

      {/* Income Boxes */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Income Items
          <InfoTooltip
            explanation="Enter the key income amounts from your K-1. Box numbers differ by entity type. These amounts flow into your Form 1040: ordinary/rental income to Schedule 1 Line 5, interest to Line 2b, dividends to Line 3b, capital gains to Schedule D."
            pubName="IRS Schedule K-1 Instructions"
            pubUrl="https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1065"
          />
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CurrencyInput
            label="Ordinary business income"
            value={k1.ordinaryIncome}
            onChange={(v) => update({ ordinaryIncome: v })}
            helperText={k1.entityType === 'partnership' ? 'Box 1 (Form 1065)' : k1.entityType === 's-corp' ? 'Box 1 (Form 1120-S)' : 'Box 1'}
          />
          <CurrencyInput
            label="Rental income"
            value={k1.rentalIncome}
            onChange={(v) => update({ rentalIncome: v })}
            helperText={k1.entityType === 'partnership' ? 'Box 2 (Form 1065)' : 'Box 2'}
          />
          {isPartnership && (
            <CurrencyInput
              label={<>Guaranteed payments
                <InfoTooltip
                  explanation="Guaranteed payments to a partner for services or capital use. These are reported on Schedule 1 Line 5 and are always subject to self-employment tax, regardless of limited/general partner status."
                  pubName="K-1 Box 4 / IRC §707(c)"
                  pubUrl="https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1065"
                />
              </>}
              value={k1.guaranteedPayments ?? 0}
              onChange={(v) => update({ guaranteedPayments: v })}
              helperText="Box 4 (Form 1065)"
            />
          )}
          <CurrencyInput
            label="Interest income"
            value={k1.interestIncome}
            onChange={(v) => update({ interestIncome: v })}
            helperText={k1.entityType === 'partnership' ? 'Box 5 (Form 1065)' : 'Box 4 (Form 1120-S)'}
          />
          <CurrencyInput
            label="Dividend income"
            value={k1.dividendIncome}
            onChange={(v) => update({ dividendIncome: v })}
            helperText={k1.entityType === 'partnership' ? 'Box 6a (Form 1065)' : 'Box 5a (Form 1120-S)'}
          />
          <CurrencyInput
            label="Short-term capital gain"
            value={k1.shortTermCapitalGain}
            onChange={(v) => update({ shortTermCapitalGain: v })}
          />
          <CurrencyInput
            label="Long-term capital gain"
            value={k1.longTermCapitalGain}
            onChange={(v) => update({ longTermCapitalGain: v })}
          />
        </div>
      </div>

      {/* Partnership SE earnings */}
      {isPartnership && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Self-Employment
            <InfoTooltip
              explanation="If you are a general partner, your K-1 Box 14 Code A reports your net SE earnings subject to self-employment tax. Limited partners generally have $0 here. If left blank, SE tax is not computed for this K-1 (conservative)."
              pubName="K-1 Box 14 / Schedule SE"
              pubUrl="https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1065"
            />
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CurrencyInput
              label="SE earnings (Box 14, Code A)"
              value={k1.selfEmploymentEarnings ?? 0}
              onChange={(v) => update({ selfEmploymentEarnings: v })}
              helperText="Leave at $0 if you are a limited partner."
            />
          </div>
        </div>
      )}

      {/* QBI and Distributions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CurrencyInput
          label={<>Section 199A QBI
            <InfoTooltip
              explanation="Qualified Business Income for the Section 199A deduction. For partnerships, this is typically Box 20 Code Z. For S-corps, Box 17 Code V. This amount flows to the QBI deduction computation."
              pubName="IRC §199A / Form 8995"
              pubUrl="https://www.irs.gov/forms-pubs/about-form-8995"
            />
          </>}
          value={k1.section199AQBI}
          onChange={(v) => update({ section199AQBI: v })}
        />
        <CurrencyInput
          label="Distributions (reference only)"
          value={k1.distributions}
          onChange={(v) => update({ distributions: v })}
          helperText="Not used in computation; recorded for your records."
        />
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-600 flex justify-between">
        <span>Total reported income:</span>
        <strong className={totalIncome < 0 ? 'text-red-600' : 'text-green-700'}>
          {totalIncome < 0 ? '-' : ''}${(Math.abs(totalIncome) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </strong>
      </div>
    </div>
  )
}

export function ScheduleK1Page() {
  const k1s = useTaxStore((s) => s.taxReturn.scheduleK1s)
  const addScheduleK1 = useTaxStore((s) => s.addScheduleK1)
  const removeScheduleK1 = useTaxStore((s) => s.removeScheduleK1)
  const interview = useInterview()

  return (
    <div data-testid="page-schedule-k1" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Schedule K-1 (Passthrough Income)</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter Schedule K-1 forms received from partnerships, S corporations, or trusts/estates.
        K-1 income flows into your Form 1040 (ordinary/rental to Schedule 1, interest, dividends,
        capital gains, and QBI to their respective lines).
      </p>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
        <p className="text-xs text-blue-800 font-medium">
          K-1 income is included in your tax computation.
        </p>
        <p className="text-xs text-blue-700 mt-1">
          Partnerships: guaranteed payments (Box 4) and Box 14 Code A SE earnings are subject to
          self-employment tax. Rental losses are limited by a $25K PAL guardrail. Full basis tracking
          and at-risk rules are not yet modeled — consult a tax professional for complex situations.
        </p>
      </div>

      <div className="mt-6">
        <RepeatableSection
          label="K-1 Forms"
          items={k1s}
          addLabel="Add K-1"
          emptyMessage="No K-1 forms added. Click '+ Add K-1' if you received a Schedule K-1 from a partnership, S corp, or trust."
          onAdd={() => addScheduleK1(emptyK1())}
          onRemove={(index) => {
            const k1 = k1s[index]
            if (k1) removeScheduleK1(k1.id)
          }}
          renderItem={(k1) => <K1Card k1={k1} />}
        />
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
