import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { getSupportedStates } from '../../rules/stateRegistry.ts'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { SupportedStateCode, ResidencyType } from '../../model/types.ts'

const RESIDENCY_OPTIONS: { value: ResidencyType; label: string; description: string }[] = [
  {
    value: 'full-year',
    label: 'Full-year resident',
    description: 'You lived in this state for the entire tax year.',
  },
  {
    value: 'part-year',
    label: 'Part-year resident',
    description: 'You moved into or out of this state during the tax year.',
  },
  {
    value: 'nonresident',
    label: 'Nonresident',
    description: 'You earned income in this state but did not live there.',
  },
]

export function StateReturnsPage() {
  const stateReturns = useTaxStore((s) => s.taxReturn.stateReturns ?? [])
  const addStateReturn = useTaxStore((s) => s.addStateReturn)
  const removeStateReturn = useTaxStore((s) => s.removeStateReturn)
  const updateStateReturn = useTaxStore((s) => s.updateStateReturn)
  const interview = useInterview()

  const supportedStates = getSupportedStates()

  const isSelected = (code: string) =>
    stateReturns.some((s) => s.stateCode === code)

  const getConfig = (code: string) =>
    stateReturns.find((s) => s.stateCode === code)

  return (
    <div data-testid="page-state-returns" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">State Returns</h1>
      <p className="mt-1 text-sm text-gray-600">
        Select the states you need to file for. Skip this page if you only file a federal return.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {supportedStates.map(({ code, label, stateName }) => (
          <div key={code} className="border border-gray-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isSelected(code)}
                onChange={(e) => {
                  if (e.target.checked) {
                    addStateReturn({ stateCode: code as SupportedStateCode, residencyType: 'full-year' })
                  } else {
                    removeStateReturn(code as SupportedStateCode)
                  }
                }}
                className="mt-1 w-5 h-5 sm:w-4 sm:h-4 shrink-0"
              />
              <div>
                <span className="font-medium text-gray-900 inline-flex items-center">
                  File {stateName} state return
                  <InfoTooltip
                    explanation={`Check this to compute your ${label} state return alongside your federal return. You can choose full-year, part-year, or nonresident filing status below.`}
                    pubName={`${stateName} — Filing Requirements`}
                    pubUrl={code === 'CA'
                      ? 'https://www.ftb.ca.gov/file/personal/residency-status/index.html'
                      : '#'
                    }
                  />
                </span>
                <p className="text-sm text-gray-500 mt-0.5">
                  Enables {label} computation.
                </p>
              </div>
            </label>

            {/* Residency type selector — shown when state is selected */}
            {isSelected(code) && (
              <div className="mt-3 ml-6 flex flex-col gap-2">
                <fieldset>
                  <legend className="text-sm font-medium text-gray-700 mb-1">Residency status</legend>
                  <div className="flex flex-col gap-1.5">
                    {RESIDENCY_OPTIONS.map((opt) => {
                      const disabled = opt.value === 'nonresident' && code === 'CA'
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-start gap-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`residency-${code}`}
                            value={opt.value}
                            checked={getConfig(code)?.residencyType === opt.value}
                            disabled={disabled}
                            onChange={() =>
                              updateStateReturn(code as SupportedStateCode, {
                                residencyType: opt.value,
                                ...(opt.value !== 'part-year' ? { moveInDate: undefined, moveOutDate: undefined } : {}),
                              })
                            }
                            className="mt-0.5"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {opt.label}
                              {disabled && <span className="text-xs text-gray-400 ml-1">(coming soon)</span>}
                            </span>
                            <p className="text-xs text-gray-500">{opt.description}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                {getConfig(code)?.residencyType === 'part-year' && (
                  <div className="mt-2 flex flex-col gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-xs text-amber-800 font-medium">
                      Enter the dates you lived in {stateName} during the tax year.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-0.5">Moved in</label>
                        <input
                          type="date"
                          value={getConfig(code)?.moveInDate ?? ''}
                          min="2025-01-01"
                          max="2025-12-31"
                          onChange={(e) =>
                            updateStateReturn(code as SupportedStateCode, { moveInDate: e.target.value || undefined })
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                          data-testid={`move-in-date-${code}`}
                        />
                        <p className="text-xs text-gray-400 mt-0.5">Leave blank if Jan 1</p>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-600 mb-0.5">Moved out</label>
                        <input
                          type="date"
                          value={getConfig(code)?.moveOutDate ?? ''}
                          min="2025-01-01"
                          max="2025-12-31"
                          onChange={(e) =>
                            updateStateReturn(code as SupportedStateCode, { moveOutDate: e.target.value || undefined })
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                          data-testid={`move-out-date-${code}`}
                        />
                        <p className="text-xs text-gray-400 mt-0.5">Leave blank if Dec 31</p>
                      </div>
                    </div>
                    {getConfig(code)?.moveInDate && getConfig(code)?.moveOutDate &&
                     getConfig(code)!.moveInDate! > getConfig(code)!.moveOutDate! && (
                      <p className="text-xs text-red-600">Move-in date must be before move-out date.</p>
                    )}
                  </div>
                )}

                {code === 'CA' && (
                  <label className="flex items-start gap-3 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={getConfig(code)?.rentPaid ?? false}
                      onChange={(e) =>
                        updateStateReturn(code as SupportedStateCode, { rentPaid: e.target.checked })
                      }
                      className="mt-1 w-5 h-5 sm:w-4 sm:h-4 shrink-0"
                    />
                    <div>
                      <span className="font-medium text-gray-900 inline-flex items-center">
                        I paid rent in {stateName}
                        <InfoTooltip
                          explanation={
                            getConfig(code)?.residencyType === 'part-year'
                              ? "The CA renter's credit requires paying rent for at least half the year on your principal CA residence. Part-year residents may qualify if they were in CA for 6+ months."
                              : "The California nonrefundable renter's credit is $60 for single/MFS filers (CA AGI ≤ $53,994) or $120 for MFJ/HOH/QW filers (CA AGI ≤ $107,987). You must have paid rent for at least half the year on your principal residence in California."
                          }
                          pubName="FTB — Renter's Credit"
                          pubUrl="https://www.ftb.ca.gov/file/personal/credits/nonrefundable-renters-credit.html"
                        />
                      </span>
                      <p className="text-sm text-gray-500 mt-0.5">
                        May qualify for a $60/$120 nonrefundable renter's credit.
                      </p>
                    </div>
                  </label>
                )}

                {code === 'FL' && (
                  <div className="mt-1 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                    Florida does not have a personal income tax. This selection tracks residency/interstate context and adds an informational PDF page to your filing packet.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {supportedStates.length === 1 && (
        <p className="mt-4 text-xs text-gray-400">
          More states coming soon. Currently only {supportedStates[0].stateName} is supported.
        </p>
      )}

      <InterviewNav interview={interview} />
    </div>
  )
}
