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

const NJ_TAX_GUIDE_URL = 'https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf'
const NJ_RESIDENCY_OVERVIEW_URL = 'https://www.nj.gov/treasury/taxation/njit24.shtml'

export function getPartYearDateError(
  moveInDate?: string,
  moveOutDate?: string,
): string | null {
  if (!moveInDate && !moveOutDate) {
    return 'Enter at least one date for part-year residency (move-in or move-out).'
  }
  if (moveInDate && moveOutDate && moveInDate > moveOutDate) {
    return 'Move-in date must be before move-out date.'
  }
  return null
}

export function StateReturnsPage() {
  const taxReturn = useTaxStore((s) => s.taxReturn)
  const stateReturns = taxReturn.stateReturns ?? []
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
        {supportedStates.map(({ code, stateName }) => (
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
                    explanation={`Check this to compute your ${stateName} state return alongside your federal return. You can choose full-year, part-year, or nonresident filing status below.`}
                    pubName={`${stateName} — Filing Requirements`}
                    pubUrl={code === 'CA'
                      ? 'https://www.ftb.ca.gov/file/personal/residency-status/index.html'
                      : code === 'GA'
                        ? 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet'
                      : code === 'MA'
                        ? 'https://www.mass.gov/guides/learn-about-legal-and-residency-status-in-massachusetts'
                      : code === 'MD'
                        ? 'https://www.marylandtaxes.gov/individual/income/tax-info/'
                      : code === 'NJ'
                        ? NJ_RESIDENCY_OVERVIEW_URL
                      : code === 'PA'
                        ? 'https://www.revenue.pa.gov/TaxTypes/PIT/Pages/default.aspx'
                      : code === 'CT'
                        ? 'https://portal.ct.gov/drs/individuals/residency-status'
                      : code === 'DC'
                        ? 'https://otr.cfo.dc.gov/page/individual-income-tax-filing-faqs'
                        : '#'
                    }
                  />
                </span>
                <p className="text-sm text-gray-500 mt-0.5">
                  Enables {stateName} state tax computation.
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
                      const disabled = opt.value === 'nonresident' && code !== 'DC'
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
                              {disabled && <span className="text-xs text-gray-400 ml-2">&mdash; coming soon</span>}
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
                    {code === 'NJ' && (
                      <p className="text-xs text-amber-700">
                        NJ part-year and nonresident filing uses Form NJ-1040NR. OpenTax currently provides a resident estimate only.
                      </p>
                    )}
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
                    {(() => {
                      const partYearDateError = getPartYearDateError(getConfig(code)?.moveInDate, getConfig(code)?.moveOutDate)
                      if (!partYearDateError) return null
                      return <p className="text-xs text-red-600">{partYearDateError}</p>
                    })()}
                  </div>
                )}

                {code === 'DC' && getConfig(code)?.residencyType === 'nonresident' && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <label className="block text-xs text-gray-600 mb-1">Home state for DC commuter reciprocity</label>
                    <select
                      value={getConfig(code)?.dcCommuterResidentState ?? 'OTHER'}
                      onChange={(e) => updateStateReturn(code as SupportedStateCode, {
                        dcCommuterResidentState: e.target.value as 'MD' | 'VA' | 'OTHER',
                      })}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                    >
                      <option value="OTHER">Other state</option>
                      <option value="MD">Maryland</option>
                      <option value="VA">Virginia</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      MD/VA residents who only commute into DC are generally exempt from DC income tax under reciprocity.
                    </p>
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

                {code === 'NJ' && (
                  <div className="mt-2 flex flex-col gap-3">
                    {/* Housing type */}
                    <fieldset>
                      <legend className="text-sm font-medium text-gray-700 mb-1 inline-flex items-center">
                        Housing
                        <InfoTooltip
                          explanation="NJ allows a property tax deduction (up to $15,000) or a $50 property tax credit. Renters use 18% of rent as deemed property tax. OpenTax auto-selects the better option."
                          pubName="NJ Property Tax Deduction/Credit"
                          pubUrl={NJ_TAX_GUIDE_URL}
                        />
                      </legend>
                      <div className="flex flex-col gap-1.5">
                        {([
                          { value: 'homeowner', label: 'Homeowner' },
                          { value: 'renter', label: 'Renter' },
                          { value: 'neither', label: 'Neither' },
                        ] as const).map((opt) => (
                          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`nj-housing-${code}`}
                              value={opt.value}
                              checked={
                                opt.value === 'homeowner' ? getConfig(code)?.njIsHomeowner === true
                                  : opt.value === 'renter' ? getConfig(code)?.njIsHomeowner === false
                                  : getConfig(code)?.njIsHomeowner === undefined
                              }
                              onChange={() =>
                                updateStateReturn(code as SupportedStateCode, {
                                  njIsHomeowner: opt.value === 'homeowner' ? true : opt.value === 'renter' ? false : undefined,
                                  ...(opt.value !== 'homeowner' ? { njPropertyTaxPaid: undefined } : {}),
                                  ...(opt.value !== 'renter' ? { njRentPaid: undefined } : {}),
                                })
                              }
                              className="mt-0.5"
                            />
                            <span className="text-sm text-gray-900">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {/* Property tax paid (homeowner) */}
                    {getConfig(code)?.njIsHomeowner === true && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-0.5">Property tax paid in 2025</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="e.g. 8500"
                          value={getConfig(code)?.njPropertyTaxPaid ? Math.round(getConfig(code)!.njPropertyTaxPaid! / 100) : ''}
                          onChange={(e) => {
                            const dollars = parseInt(e.target.value, 10)
                            updateStateReturn(code as SupportedStateCode, {
                              njPropertyTaxPaid: isNaN(dollars) ? undefined : dollars * 100,
                            })
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                          data-testid="nj-property-tax"
                        />
                        <p className="text-xs text-gray-400 mt-0.5">Deductible up to $15,000</p>
                      </div>
                    )}

                    {/* Rent paid (renter) */}
                    {getConfig(code)?.njIsHomeowner === false && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-0.5">Total rent paid in 2025</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="e.g. 24000"
                          value={getConfig(code)?.njRentPaid ? Math.round(getConfig(code)!.njRentPaid! / 100) : ''}
                          onChange={(e) => {
                            const dollars = parseInt(e.target.value, 10)
                            updateStateReturn(code as SupportedStateCode, {
                              njRentPaid: isNaN(dollars) ? undefined : dollars * 100,
                            })
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                          data-testid="nj-rent-paid"
                        />
                        <p className="text-xs text-gray-400 mt-0.5">18% of rent counts as deemed property tax</p>
                      </div>
                    )}

                    {/* Veteran status */}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={getConfig(code)?.njTaxpayerVeteran ?? false}
                        onChange={(e) =>
                          updateStateReturn(code as SupportedStateCode, { njTaxpayerVeteran: e.target.checked || undefined })
                        }
                        className="mt-1 w-5 h-5 sm:w-4 sm:h-4 shrink-0"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900 inline-flex items-center">
                          Taxpayer is a veteran
                          <InfoTooltip
                            explanation="Honorably discharged veterans of the U.S. Armed Forces qualify for a $6,000 NJ personal exemption."
                            pubName="NJ Veteran Exemption"
                            pubUrl={NJ_TAX_GUIDE_URL}
                          />
                        </span>
                        <p className="text-xs text-gray-500">$6,000 exemption</p>
                      </div>
                    </label>

                    {stateReturns.find(s => s.stateCode === code) && taxReturn.filingStatus === 'mfj' && (
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={getConfig(code)?.njSpouseVeteran ?? false}
                          onChange={(e) =>
                            updateStateReturn(code as SupportedStateCode, { njSpouseVeteran: e.target.checked || undefined })
                          }
                          className="mt-1 w-5 h-5 sm:w-4 sm:h-4 shrink-0"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Spouse is a veteran</span>
                          <p className="text-xs text-gray-500">$6,000 exemption</p>
                        </div>
                      </label>
                    )}

                    {/* Blind/disabled */}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={getConfig(code)?.njTaxpayerBlindDisabled ?? false}
                        onChange={(e) =>
                          updateStateReturn(code as SupportedStateCode, { njTaxpayerBlindDisabled: e.target.checked || undefined })
                        }
                        className="mt-1 w-5 h-5 sm:w-4 sm:h-4 shrink-0"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Taxpayer is blind or disabled</span>
                        <p className="text-xs text-gray-500">$1,000 exemption</p>
                      </div>
                    </label>

                    {stateReturns.find(s => s.stateCode === code) && taxReturn.filingStatus === 'mfj' && (
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={getConfig(code)?.njSpouseBlindDisabled ?? false}
                          onChange={(e) =>
                            updateStateReturn(code as SupportedStateCode, { njSpouseBlindDisabled: e.target.checked || undefined })
                          }
                          className="mt-1 w-5 h-5 sm:w-4 sm:h-4 shrink-0"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-900">Spouse is blind or disabled</span>
                          <p className="text-xs text-gray-500">$1,000 exemption</p>
                        </div>
                      </label>
                    )}
                  </div>
                )}

                {code === 'CT' && (
                  <div className="mt-1">
                    <label className="block text-sm font-medium text-gray-900 inline-flex items-center gap-1">
                      CT property tax paid
                      <InfoTooltip
                        explanation="Connecticut property tax credit is nonrefundable (up to $300) and phases out by AGI. Enter property taxes paid on your CT primary residence and motor vehicle taxes."
                        pubName="CT Schedule 3"
                        pubUrl="https://portal.ct.gov/drs/forms/ct-1040"
                      />
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={Math.round((getConfig(code)?.ctPropertyTaxPaid ?? 0) / 100)}
                      onChange={(e) => updateStateReturn(code as SupportedStateCode, { ctPropertyTaxPaid: Math.max(0, Number(e.target.value || 0)) * 100 })}
                      className="mt-1 w-full sm:w-64 px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                      data-testid="ct-property-tax-paid"
                    />
                    <p className="text-xs text-gray-500 mt-0.5">Enter whole dollars.</p>
                  </div>
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

      {supportedStates.length <= 2 && (
        <p className="mt-4 text-xs text-gray-400">
          More states coming soon. Currently supported: {supportedStates.map(s => s.stateName).join(', ')}.
        </p>
      )}

      <InterviewNav interview={interview} />
    </div>
  )
}
