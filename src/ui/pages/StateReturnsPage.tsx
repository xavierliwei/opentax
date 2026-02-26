import { useState, useRef, useEffect, useCallback } from 'react'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { getSupportedStates } from '../../rules/stateRegistry.ts'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { SupportedStateCode, ResidencyType } from '../../model/types.ts'
import { MD_COUNTIES, MD_DEFAULT_COUNTY } from '../../rules/2025/md/constants.ts'

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

function getInfoTooltipUrl(code: string): string {
  switch (code) {
    case 'CA': return 'https://www.ftb.ca.gov/file/personal/residency-status/index.html'
    case 'GA': return 'https://dor.georgia.gov/it-511-individual-income-tax-instruction-booklet'
    case 'MA': return 'https://www.mass.gov/guides/learn-about-legal-and-residency-status-in-massachusetts'
    case 'MD': return 'https://www.marylandtaxes.gov/individual/income/tax-info/'
    case 'NJ': return NJ_RESIDENCY_OVERVIEW_URL
    case 'PA': return 'https://www.revenue.pa.gov/TaxTypes/PIT/Pages/default.aspx'
    case 'CT': return 'https://portal.ct.gov/drs/individuals/residency-status'
    case 'DC': return 'https://otr.cfo.dc.gov/page/individual-income-tax-filing-faqs'
    default: return '#'
  }
}

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

/* ------------------------------------------------------------------ */
/*  State configuration panel (extracted for readability)              */
/* ------------------------------------------------------------------ */

function StateConfigPanel({
  code,
  stateName,
  collapsed,
  onToggle,
  onRemove,
}: {
  code: string
  stateName: string
  collapsed: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const taxReturn = useTaxStore((s) => s.taxReturn)
  const stateReturns = taxReturn.stateReturns ?? []
  const updateStateReturn = useTaxStore((s) => s.updateStateReturn)

  const getConfig = (c: string) =>
    stateReturns.find((s) => s.stateCode === c)

  return (
    <div
      className="border border-gray-200 rounded-lg overflow-hidden"
      role="group"
      aria-label={`${stateName} state return options`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
          aria-expanded={!collapsed}
          aria-controls={`state-panel-${code}`}
        >
          <svg
            className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-gray-900">{stateName}</span>
          <span className="text-xs text-gray-400 uppercase">{code}</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
          aria-label={`Remove ${stateName}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Panel body */}
      {!collapsed && (
        <div id={`state-panel-${code}`} className="px-4 py-3 flex flex-col gap-3">
          {/* Residency type selector */}
          <fieldset aria-label={`${stateName} residency status`}>
            <legend className="text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
              Residency status
              <InfoTooltip
                explanation={`Choose your residency status for ${stateName}. This determines which form is filed and how income is taxed.`}
                pubName={`${stateName} — Filing Requirements`}
                pubUrl={getInfoTooltipUrl(code)}
              />
            </legend>
            <div className="flex flex-col gap-1.5">
              {RESIDENCY_OPTIONS.map((opt) => {
                const isNonresidentDisabled = opt.value === 'nonresident' && code !== 'DC'
                const isNJPartYear = opt.value === 'part-year' && code === 'NJ'
                const isNJNonresident = opt.value === 'nonresident' && code === 'NJ'
                const disabled = isNonresidentDisabled || isNJNonresident
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
                        {isNonresidentDisabled && code === 'CA' && (
                          <span className="text-xs text-gray-400 ml-2">&mdash; CA 540NR not yet supported</span>
                        )}
                        {isNJPartYear && (
                          <span className="text-xs text-amber-500 ml-2">&mdash; resident estimate only</span>
                        )}
                        {isNJNonresident && (
                          <span className="text-xs text-gray-400 ml-2">&mdash; NJ-1040NR not yet supported</span>
                        )}
                        {disabled && code !== 'CA' && code !== 'NJ' && (
                          <span className="text-xs text-gray-400 ml-2">&mdash; coming soon</span>
                        )}
                      </span>
                      <p className="text-xs text-gray-500">{opt.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {/* Part-year date inputs */}
          {getConfig(code)?.residencyType === 'part-year' && (
            <div className="flex flex-col gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
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
                  <label htmlFor={`move-in-date-${code}`} className="block text-xs text-gray-600 mb-0.5">Moved in</label>
                  <input
                    id={`move-in-date-${code}`}
                    type="date"
                    value={getConfig(code)?.moveInDate ?? ''}
                    min="2025-01-01"
                    max="2025-12-31"
                    onChange={(e) =>
                      updateStateReturn(code as SupportedStateCode, { moveInDate: e.target.value || undefined })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                    data-testid={`move-in-date-${code}`}
                    aria-describedby={`move-in-hint-${code} part-year-error-${code}`}
                  />
                  <p id={`move-in-hint-${code}`} className="text-xs text-gray-400 mt-0.5">Leave blank if Jan 1</p>
                </div>
                <div className="flex-1">
                  <label htmlFor={`move-out-date-${code}`} className="block text-xs text-gray-600 mb-0.5">Moved out</label>
                  <input
                    id={`move-out-date-${code}`}
                    type="date"
                    value={getConfig(code)?.moveOutDate ?? ''}
                    min="2025-01-01"
                    max="2025-12-31"
                    onChange={(e) =>
                      updateStateReturn(code as SupportedStateCode, { moveOutDate: e.target.value || undefined })
                    }
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                    data-testid={`move-out-date-${code}`}
                    aria-describedby={`move-out-hint-${code} part-year-error-${code}`}
                  />
                  <p id={`move-out-hint-${code}`} className="text-xs text-gray-400 mt-0.5">Leave blank if Dec 31</p>
                </div>
              </div>
              <div aria-live="polite" id={`part-year-error-${code}`}>
                {(() => {
                  const partYearDateError = getPartYearDateError(getConfig(code)?.moveInDate, getConfig(code)?.moveOutDate)
                  if (!partYearDateError) return null
                  return <p className="text-xs text-red-600" role="alert">{partYearDateError}</p>
                })()}
              </div>
            </div>
          )}

          {/* DC nonresident commuter */}
          {code === 'DC' && getConfig(code)?.residencyType === 'nonresident' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <label htmlFor={`dc-commuter-state`} className="block text-xs text-gray-600 mb-1">Home state for DC commuter reciprocity</label>
              <select
                id="dc-commuter-state"
                value={getConfig(code)?.dcCommuterResidentState ?? 'OTHER'}
                onChange={(e) => updateStateReturn(code as SupportedStateCode, {
                  dcCommuterResidentState: e.target.value as 'MD' | 'VA' | 'OTHER',
                })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                aria-describedby="dc-commuter-hint"
              >
                <option value="OTHER">Other state</option>
                <option value="MD">Maryland</option>
                <option value="VA">Virginia</option>
              </select>
              <p id="dc-commuter-hint" className="text-xs text-gray-500 mt-1">
                MD/VA residents who only commute into DC are generally exempt from DC income tax under reciprocity.
              </p>
            </div>
          )}

          {/* CA rent credit */}
          {code === 'CA' && (
            <label className="flex items-start gap-3 cursor-pointer">
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

          {/* MD county selector */}
          {code === 'MD' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 inline-flex items-center gap-1">
                County / city
                <InfoTooltip
                  explanation="Maryland levies a local income tax on top of the state tax. The rate varies by county from 2.25% (Worcester) to 3.20% (several counties). Baltimore City has its own rate."
                  pubName="MD Local Tax Rates"
                  pubUrl="https://www.marylandtaxes.gov/individual/income/tax-info/local-tax-rates.php"
                />
              </label>
              <select
                value={getConfig(code)?.county ?? MD_DEFAULT_COUNTY}
                onChange={(e) => updateStateReturn(code as SupportedStateCode, { county: e.target.value })}
                className="mt-1 w-full sm:w-72 px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                data-testid="md-county-select"
              >
                {Object.entries(MD_COUNTIES).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.name} ({(info.rate * 100).toFixed(2)}%)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* MA rent deduction */}
          {code === 'MA' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 inline-flex items-center gap-1">
                Rent paid in Massachusetts
                <InfoTooltip
                  explanation="Massachusetts allows a deduction of 50% of rent paid for your principal residence, capped at $4,000 ($2,000 for MFS). Enter the total annual rent you paid in 2025."
                  pubName="MA Rent Deduction"
                  pubUrl="https://www.mass.gov/info-details/massachusetts-income-tax-deductions"
                />
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 24000"
                value={getConfig(code)?.rentAmount ? Math.round(getConfig(code)!.rentAmount! / 100) : ''}
                onChange={(e) => {
                  const dollars = parseInt(e.target.value, 10)
                  updateStateReturn(code as SupportedStateCode, {
                    rentAmount: isNaN(dollars) ? undefined : dollars * 100,
                  })
                }}
                className="mt-1 w-full sm:w-64 px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                data-testid="ma-rent-amount"
              />
              <p className="text-xs text-gray-500 mt-0.5">
                Enter whole dollars. Deduction = 50% of rent, up to $4,000.
              </p>
            </div>
          )}

          {/* PA 529 contributions */}
          {code === 'PA' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 inline-flex items-center gap-1">
                IRC &sect;529 contributions
                <InfoTooltip
                  explanation="Pennsylvania allows a deduction for contributions to IRC §529 education savings plans, up to $18,000 per beneficiary ($36,000 MFJ). Enter total contributions made in 2025."
                  pubName="PA §529 Deduction"
                  pubUrl="https://www.revenue.pa.gov/TaxTypes/PIT/Pages/default.aspx"
                />
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 5000"
                value={getConfig(code)?.contributions529 ? Math.round(getConfig(code)!.contributions529! / 100) : ''}
                onChange={(e) => {
                  const dollars = parseInt(e.target.value, 10)
                  updateStateReturn(code as SupportedStateCode, {
                    contributions529: isNaN(dollars) ? undefined : dollars * 100,
                  })
                }}
                className="mt-1 w-full sm:w-64 px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                data-testid="pa-529-contributions"
              />
              <p className="text-xs text-gray-500 mt-0.5">
                Enter whole dollars. Deductible up to $18,000 per beneficiary.
              </p>
            </div>
          )}

          {/* NJ-specific config */}
          {code === 'NJ' && (
            <div className="flex flex-col gap-3">
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

              {/* College-student dependents */}
              {(() => {
                const collegeEligible = taxReturn.dependents.filter((dep) => {
                  if (!dep.dateOfBirth) return false
                  const birthYear = parseInt(dep.dateOfBirth.split('-')[0], 10)
                  if (isNaN(birthYear)) return false
                  return taxReturn.taxYear - birthYear < 22
                })
                if (collegeEligible.length > 0) {
                  const selected = getConfig(code)?.njDependentCollegeStudents ?? []
                  return (
                    <fieldset>
                      <legend className="text-sm font-medium text-gray-700 mb-1 inline-flex items-center">
                        Full-time college students (under 22)
                        <InfoTooltip
                          explanation="NJ provides an additional $1,000 exemption for each dependent who is a full-time college student under age 22. Check all that apply."
                          pubName="NJ Dependent Exemptions"
                          pubUrl={NJ_TAX_GUIDE_URL}
                        />
                      </legend>
                      <div className="flex flex-col gap-1.5">
                        {collegeEligible.map((dep) => {
                          const depId = dep.ssn || `${dep.firstName}-${dep.lastName}`
                          const isChecked = selected.includes(depId)
                          return (
                            <label key={depId} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...selected, depId]
                                    : selected.filter((id) => id !== depId)
                                  updateStateReturn(code as SupportedStateCode, {
                                    njDependentCollegeStudents: next.length > 0 ? next : undefined,
                                  })
                                }}
                                className="w-4 h-4 shrink-0"
                                data-testid={`nj-college-student-${depId}`}
                              />
                              <span className="text-sm text-gray-900">
                                {dep.firstName} {dep.lastName}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">$1,000 additional exemption each</p>
                    </fieldset>
                  )
                }
                return (
                  <div>
                    <label htmlFor="nj-college-student-count" className="block text-sm font-medium text-gray-900 inline-flex items-center gap-1">
                      Full-time college students (under 22)
                      <InfoTooltip
                        explanation="NJ provides an additional $1,000 exemption for each dependent who is a full-time college student under age 22. Enter the number of qualifying dependents."
                        pubName="NJ Dependent Exemptions"
                        pubUrl={NJ_TAX_GUIDE_URL}
                      />
                    </label>
                    <input
                      id="nj-college-student-count"
                      type="number"
                      min="0"
                      max={Math.max(taxReturn.dependents.length, 10)}
                      step="1"
                      placeholder="0"
                      value={getConfig(code)?.njCollegeStudentDependentCount ?? ''}
                      onChange={(e) => {
                        const count = parseInt(e.target.value, 10)
                        updateStateReturn(code as SupportedStateCode, {
                          njCollegeStudentDependentCount: isNaN(count) || count <= 0 ? undefined : count,
                        })
                      }}
                      className="mt-1 w-full sm:w-48 px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                      data-testid="nj-college-student-count"
                    />
                    <p className="text-xs text-gray-500 mt-0.5">
                      $1,000 additional exemption each. Enter dependent DOBs on the Dependents page for per-dependent selection.
                    </p>
                  </div>
                )
              })()}
            </div>
          )}

          {/* CT property tax credit */}
          {code === 'CT' && (
            <div>
              <label htmlFor="ct-property-tax-input" className="block text-sm font-medium text-gray-900 inline-flex items-center gap-1">
                CT property tax paid
                <InfoTooltip
                  explanation="Connecticut property tax credit is nonrefundable (up to $300) and phases out by AGI. Enter property taxes paid on your CT primary residence and motor vehicle taxes."
                  pubName="CT Schedule 3"
                  pubUrl="https://portal.ct.gov/drs/forms/ct-1040"
                />
              </label>
              <input
                id="ct-property-tax-input"
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
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export function StateReturnsPage() {
  const taxReturn = useTaxStore((s) => s.taxReturn)
  const stateReturns = taxReturn.stateReturns ?? []
  const addStateReturn = useTaxStore((s) => s.addStateReturn)
  const removeStateReturn = useTaxStore((s) => s.removeStateReturn)
  const interview = useInterview()

  const supportedStates = getSupportedStates()

  // Combobox state
  const [searchText, setSearchText] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const comboboxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Track which panels are collapsed (default: expanded)
  const [collapsedPanels, setCollapsedPanels] = useState<Set<string>>(new Set())

  const selectedCodes = new Set(stateReturns.map((s) => s.stateCode))

  // Filter states for the dropdown: exclude already-selected, match by name or code
  const filteredStates = supportedStates.filter(({ code, stateName }) => {
    if (selectedCodes.has(code)) return false
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return stateName.toLowerCase().includes(q) || code.toLowerCase().includes(q)
  })

  // Sort selected states alphabetically by code for chips and config panels
  const selectedStatesSorted = supportedStates
    .filter(({ code }) => selectedCodes.has(code))
    .sort((a, b) => a.code.localeCompare(b.code))

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(-1)
  }, [searchText])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]')
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  const selectState = useCallback((code: SupportedStateCode) => {
    addStateReturn({ stateCode: code, residencyType: 'full-year' })
    setSearchText('')
    setDropdownOpen(false)
    setHighlightIndex(-1)
    // Ensure the new panel is expanded
    setCollapsedPanels((prev) => {
      const next = new Set(prev)
      next.delete(code)
      return next
    })
    // Refocus the input so user can add more
    inputRef.current?.focus()
  }, [addStateReturn])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!dropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setDropdownOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex((prev) =>
          prev < filteredStates.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : filteredStates.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIndex >= 0 && highlightIndex < filteredStates.length) {
          selectState(filteredStates[highlightIndex].code)
        }
        break
      case 'Escape':
        e.preventDefault()
        setDropdownOpen(false)
        setHighlightIndex(-1)
        break
    }
  }, [dropdownOpen, filteredStates, highlightIndex, selectState])

  const togglePanel = (code: string) => {
    setCollapsedPanels((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <div data-testid="page-state-returns" className="max-w-xl mx-auto" role="form" aria-label="State return selection">
      <h1 className="text-2xl font-bold text-gray-900">State Returns</h1>
      <p className="mt-1 text-sm text-gray-600">
        Select the states you need to file for. Skip this page if you only file a federal return.
      </p>

      {/* Selected state chips */}
      <div className="mt-4" role="group" aria-label="Selected states">
        {selectedStatesSorted.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No states selected — you can skip this page if you only file federal.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedStatesSorted.map(({ code, stateName }) => (
              <span
                key={code}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-800 text-sm font-medium rounded-full border border-blue-200"
              >
                {stateName}
                <button
                  type="button"
                  onClick={() => removeStateReturn(code)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-blue-200 transition-colors"
                  aria-label={`Remove ${stateName}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Searchable combobox to add states */}
      <div className="mt-4 relative" ref={comboboxRef}>
        <label htmlFor="state-search-input" className="sr-only">Search states to add</label>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="state-search-input"
            ref={inputRef}
            type="text"
            value={searchText}
            placeholder="Search states to add..."
            onChange={(e) => {
              setSearchText(e.target.value)
              setDropdownOpen(true)
            }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={dropdownOpen}
            aria-controls="state-search-listbox"
            aria-activedescendant={highlightIndex >= 0 ? `state-option-${filteredStates[highlightIndex]?.code}` : undefined}
            aria-autocomplete="list"
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoComplete="off"
          />
        </div>

        {dropdownOpen && (
          <ul
            id="state-search-listbox"
            ref={listRef}
            role="listbox"
            aria-label="Available states"
            className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg"
          >
            {filteredStates.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-gray-400 text-center">
                {searchText
                  ? 'No matching states found.'
                  : 'All supported states are already selected.'}
              </li>
            ) : (
              filteredStates.map(({ code, stateName }, index) => (
                <li
                  key={code}
                  id={`state-option-${code}`}
                  role="option"
                  aria-selected={index === highlightIndex}
                  className={`flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    index === highlightIndex
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault() // prevent blur on input
                    selectState(code)
                  }}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
                  <span>{stateName}</span>
                  <span className="text-xs text-gray-400 uppercase">{code}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Configuration panels for selected states */}
      {selectedStatesSorted.length > 0 && (
        <div className="mt-6 flex flex-col gap-4" role="group" aria-label="State return configuration">
          {selectedStatesSorted.map(({ code, stateName }) => (
            <StateConfigPanel
              key={code}
              code={code}
              stateName={stateName}
              collapsed={collapsedPanels.has(code)}
              onToggle={() => togglePanel(code)}
              onRemove={() => removeStateReturn(code)}
            />
          ))}
        </div>
      )}

      {supportedStates.length <= 2 && (
        <p className="mt-4 text-xs text-gray-400">
          More states coming soon. Currently supported: {supportedStates.map(s => s.stateName).join(', ')}.
        </p>
      )}

      <InterviewNav interview={interview} />
    </div>
  )
}
