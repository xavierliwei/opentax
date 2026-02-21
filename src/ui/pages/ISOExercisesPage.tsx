import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { RepeatableSection } from '../components/RepeatableSection.tsx'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { DateInput } from '../components/DateInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { ISOExercise } from '../../model/types.ts'
import { dollars } from '../../model/traced.ts'

function formatCurrency(cents: number): string {
  return dollars(cents).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  })
}

function emptyISOExercise(): ISOExercise {
  return {
    id: crypto.randomUUID(),
    exerciseDate: '',
    symbol: '',
    sharesExercised: 0,
    exercisePrice: 0,
    fmvAtExercise: 0,
  }
}

function ISOExerciseCard({ exercise }: { exercise: ISOExercise }) {
  const importReturn = useTaxStore((s) => s.importReturn)

  const update = (fields: Partial<ISOExercise>) => {
    const updated = { ...exercise, ...fields }
    const tr = {
      ...useTaxStore.getState().taxReturn,
      isoExercises: useTaxStore.getState().taxReturn.isoExercises.map((e) =>
        e.id === exercise.id ? updated : e,
      ),
    }
    importReturn(tr)
  }

  const spread = Math.max(0, exercise.fmvAtExercise - exercise.exercisePrice)
  const totalSpread = spread * exercise.sharesExercised

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DateInput
          label="Exercise date"
          value={exercise.exerciseDate}
          onChange={(v) => update({ exerciseDate: v })}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Symbol</label>
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent uppercase"
            value={exercise.symbol}
            onChange={(e) => update({ symbol: e.target.value.toUpperCase() })}
            placeholder="AAPL"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Shares exercised</label>
        <input
          type="number"
          min={0}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
          value={exercise.sharesExercised || ''}
          onChange={(e) => update({ sharesExercised: Number(e.target.value) || 0 })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CurrencyInput
          label="Exercise price (per share)"
          value={exercise.exercisePrice}
          onChange={(v) => update({ exercisePrice: v })}
          helperText="The strike price from your option grant"
        />
        <CurrencyInput
          label={<>FMV at exercise (per share)<InfoTooltip
            explanation="Fair market value on the exercise date. The difference between FMV and exercise price is the 'bargain element' or spread, which is an AMT preference item for ISOs (IRC §56(b)(3)). This spread is added to your Alternative Minimum Taxable Income on Form 6251, Line 2i."
            pubName="IRS Form 6251 — Alternative Minimum Tax"
            pubUrl="https://www.irs.gov/forms-pubs/about-form-6251"
          /></>}
          value={exercise.fmvAtExercise}
          onChange={(v) => update({ fmvAtExercise: v })}
        />
      </div>

      {exercise.sharesExercised > 0 && spread > 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
          Spread: {formatCurrency(spread)}/share &times; {exercise.sharesExercised} shares = {formatCurrency(totalSpread)} AMT preference
        </div>
      )}
    </div>
  )
}

export function ISOExercisesPage() {
  const isoExercises = useTaxStore((s) => s.taxReturn.isoExercises)
  const addISOExercise = useTaxStore((s) => s.addISOExercise)
  const removeISOExercise = useTaxStore((s) => s.removeISOExercise)
  const amtResult = useTaxStore((s) => s.computeResult.form1040.amtResult)
  const interview = useInterview()

  const totalSpread = isoExercises.reduce((sum, ex) => {
    const s = Math.max(0, ex.fmvAtExercise - ex.exercisePrice)
    return sum + s * ex.sharesExercised
  }, 0)

  return (
    <div data-testid="page-iso-exercises" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">ISO Exercises</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter Incentive Stock Option exercises. The spread (FMV minus exercise price) is an AMT preference item on Form 6251.
      </p>

      <div className="mt-6">
        <RepeatableSection
          label="Exercise Events"
          items={isoExercises}
          addLabel="Add ISO exercise"
          emptyMessage="No ISO exercises added. Add one if you exercised incentive stock options this year."
          onAdd={() => addISOExercise(emptyISOExercise())}
          onRemove={(index) => {
            const ex = isoExercises[index]
            if (ex) removeISOExercise(ex.id)
          }}
          renderItem={(exercise) => <ISOExerciseCard exercise={exercise} />}
        />
      </div>

      {totalSpread > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800 flex flex-col gap-1">
          <span className="font-medium">
            Total ISO spread (AMT preference): {formatCurrency(totalSpread)}
          </span>
          {amtResult && amtResult.amt > 0 ? (
            <span>
              This triggers {formatCurrency(amtResult.amt)} in Alternative Minimum Tax on Form 6251.
            </span>
          ) : amtResult ? (
            <span>
              No AMT owed — your regular tax exceeds the tentative minimum tax.
            </span>
          ) : null}
        </div>
      )}

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
        ISOs exercised and held (not sold in the same year) create an AMT adjustment but are not taxed as ordinary income.
        If you sold ISO shares in the same year you exercised, it may be treated as a disqualifying disposition — report it on your 1099-B / Stock Sales page instead.
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
