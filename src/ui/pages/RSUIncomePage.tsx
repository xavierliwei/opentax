import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { DateInput } from '../components/DateInput.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { RSUVestEvent } from '../../model/types.ts'
import { dollars } from '../../model/traced.ts'

function emptyRSUVestEvent(): RSUVestEvent {
  return {
    id: crypto.randomUUID(),
    vestDate: '',
    symbol: '',
    sharesVested: 0,
    sharesWithheldForTax: 0,
    sharesDelivered: 0,
    fmvAtVest: 0,
    totalFmv: 0,
  }
}

function RSUVestCard({ event }: { event: RSUVestEvent }) {
  const importReturn = useTaxStore((s) => s.importReturn)
  const w2s = useTaxStore((s) => s.taxReturn.w2s)

  const update = (fields: Partial<RSUVestEvent>) => {
    const updated = { ...event, ...fields }
    updated.totalFmv = updated.sharesVested * updated.fmvAtVest
    updated.sharesDelivered = updated.sharesVested - updated.sharesWithheldForTax

    const tr = {
      ...useTaxStore.getState().taxReturn,
      rsuVestEvents: useTaxStore.getState().taxReturn.rsuVestEvents.map((e) =>
        e.id === event.id ? updated : e,
      ),
    }
    importReturn(tr)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <DateInput
          label="Vest date"
          value={event.vestDate}
          onChange={(v) => update({ vestDate: v })}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Symbol</label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent uppercase"
            value={event.symbol}
            onChange={(e) => update({ symbol: e.target.value.toUpperCase() })}
            placeholder="GOOG"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Shares vested</label>
          <input
            type="number"
            min={0}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={event.sharesVested || ''}
            onChange={(e) => update({ sharesVested: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Shares withheld for tax</label>
          <input
            type="number"
            min={0}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={event.sharesWithheldForTax || ''}
            onChange={(e) => update({ sharesWithheldForTax: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Shares delivered</label>
          <input
            type="number"
            readOnly
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-600"
            value={event.sharesVested - event.sharesWithheldForTax}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CurrencyInput
          label="FMV at vest (per share)"
          value={event.fmvAtVest}
          onChange={(v) => update({ fmvAtVest: v })}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Total FMV</label>
          <div className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-600">
            ${dollars(event.sharesVested * event.fmvAtVest).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {w2s.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Linked W-2</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={event.linkedW2Id ?? ''}
            onChange={(e) => update({ linkedW2Id: e.target.value || undefined })}
          >
            <option value="">None</option>
            {w2s.map((w2) => (
              <option key={w2.id} value={w2.id}>
                {w2.employerName || 'Unnamed W-2'}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

export function RSUIncomePage() {
  const rsuVestEvents = useTaxStore((s) => s.taxReturn.rsuVestEvents)
  const addRSUVestEvent = useTaxStore((s) => s.addRSUVestEvent)
  const removeRSUVestEvent = useTaxStore((s) => s.removeRSUVestEvent)
  const interview = useInterview()

  return (
    <div data-testid="page-rsu-income" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">RSU Vest Events</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter your RSU (Restricted Stock Unit) vest events. This helps track cost basis for when you sell these shares.
      </p>

      <div className="mt-6">
        <RepeatableSection
          label="Vest Events"
          items={rsuVestEvents}
          addLabel="Add RSU vest event"
          emptyMessage="No RSU vest events added."
          onAdd={() => addRSUVestEvent(emptyRSUVestEvent())}
          onRemove={(index) => {
            const event = rsuVestEvents[index]
            if (event) removeRSUVestEvent(event.id)
          }}
          renderItem={(event) => <RSUVestCard event={event} />}
        />
      </div>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
        RSU income is already included in your W-2 Box 1 wages. The cost basis for your shares equals the FMV at vest.
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
