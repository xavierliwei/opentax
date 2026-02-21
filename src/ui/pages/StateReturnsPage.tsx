import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { getSupportedStates } from '../../rules/stateRegistry.ts'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { SupportedStateCode } from '../../model/types.ts'

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
                  {stateName} resident (full year)
                  <InfoTooltip
                    explanation={`Check this if you lived in ${stateName} for the entire tax year. OpenTax will compute your ${label} state return alongside your federal return.`}
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

            {/* CA-specific follow-up options */}
            {code === 'CA' && isSelected(code) && (
              <label className="flex items-start gap-3 cursor-pointer mt-3 ml-4 sm:ml-6">
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
                      explanation="The California nonrefundable renter's credit is $60 for single/MFS filers (CA AGI ≤ $53,994) or $120 for MFJ/HOH/QW filers (CA AGI ≤ $107,987). You must have paid rent for at least half the year on your principal residence in California."
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
