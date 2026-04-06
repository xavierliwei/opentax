/**
 * NRA Info Page — Nonresident Alien specific information.
 *
 * Shown only when isNonresidentAlien is true. Collects:
 * - Country of residence, visa type
 * - Tax treaty information
 * - FDAP income (dividends, interest, royalties)
 * - Scholarship income
 * - Days in U.S.
 */

import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'

/** Treaty dividend withholding rates by country */
const TREATY_RATES: Record<string, number> = {
  'Australia': 0.15, 'Austria': 0.15, 'Belgium': 0.15, 'Canada': 0.15,
  'China': 0.10, 'Czech Republic': 0.10, 'Denmark': 0.15, 'Finland': 0.15,
  'France': 0.15, 'Germany': 0.15, 'India': 0.25, 'Ireland': 0.15,
  'Israel': 0.25, 'Italy': 0.15, 'Japan': 0.10, 'Korea (South)': 0.15,
  'Luxembourg': 0.15, 'Mexico': 0.10, 'Netherlands': 0.15, 'New Zealand': 0.15,
  'Norway': 0.15, 'Poland': 0.15, 'Spain': 0.15, 'Sweden': 0.15,
  'Switzerland': 0.15, 'United Kingdom': 0.15,
}

/** Countries where Social Security benefits are treaty-exempt */
const SS_EXEMPT_COUNTRIES = [
  'Australia', 'Austria', 'Belgium', 'Canada', 'Czech Republic', 'Denmark',
  'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy',
  'Japan', 'Korea (South)', 'Luxembourg', 'Netherlands', 'Norway', 'Poland',
  'Portugal', 'Slovakia', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom',
]

/** Countries with U.S. income tax treaties */
const TREATY_COUNTRIES = [
  '', 'Australia', 'Austria', 'Bangladesh', 'Barbados', 'Belgium',
  'Bulgaria', 'Canada', 'China', 'Cyprus', 'Czech Republic',
  'Denmark', 'Egypt', 'Estonia', 'Finland', 'France', 'Germany',
  'Greece', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Ireland',
  'Israel', 'Italy', 'Jamaica', 'Japan', 'Kazakhstan', 'Korea (South)',
  'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Mexico', 'Morocco',
  'Netherlands', 'New Zealand', 'Norway', 'Pakistan', 'Philippines',
  'Poland', 'Portugal', 'Romania', 'Russia', 'Slovakia', 'Slovenia',
  'South Africa', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland',
  'Thailand', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Ukraine',
  'United Kingdom', 'Venezuela',
]

function centsToString(cents: number | undefined): string {
  if (cents === undefined || cents === 0) return ''
  return (cents / 100).toFixed(2)
}

function stringToCents(value: string): number {
  const num = parseFloat(value)
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

export function NRAInfoPage() {
  const nraInfo = useTaxStore((s) => s.taxReturn.nraInfo)
  const setNRAInfo = useTaxStore((s) => s.setNRAInfo)
  const scheduleEProperties = useTaxStore((s) => s.taxReturn.scheduleEProperties)
  const interview = useInterview()

  const info = nraInfo ?? { countryOfResidence: '' }
  const treatyCountry = info.treatyCountry ?? ''
  const treatyRate = treatyCountry ? TREATY_RATES[treatyCountry] : undefined
  const isSSTreatyExempt = treatyCountry ? SS_EXEMPT_COUNTRIES.includes(treatyCountry) : false

  return (
    <div data-testid="page-nra-info" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Nonresident Alien Information</h1>
      <p className="mt-1 text-sm text-gray-600">
        Provide details about your residency and NRA-specific income.
      </p>

      {/* Basic Info */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
          Residency Details
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Country of residence</label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={info.countryOfResidence}
              onChange={(e) => setNRAInfo({ countryOfResidence: e.target.value })}
              placeholder="e.g., India, China, Canada"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Visa type
              <span className="text-gray-400 ml-1">(optional)</span>
            </label>
            <input
              type="text"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={info.visaType ?? ''}
              onChange={(e) => setNRAInfo({ visaType: e.target.value || undefined })}
              placeholder="e.g., F-1, J-1, H-1B, OPT"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Days present in U.S. during tax year
              <span className="text-gray-400 ml-1">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              max="366"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={info.daysInUS ?? ''}
              onChange={(e) => setNRAInfo({ daysInUS: e.target.value ? parseInt(e.target.value, 10) : undefined })}
            />
          </div>
        </div>
      </section>

      {/* Treaty Benefits */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1 inline-flex items-center">
          Tax Treaty Benefits
          <InfoTooltip
            explanation="If your country has a tax treaty with the U.S., certain income may be exempt or taxed at a reduced rate. Common treaty benefits include exemptions for students (Article 21) and reduced FDAP withholding rates."
            pubName="IRS Publication 901 — Tax Treaties"
            pubUrl="https://www.irs.gov/publications/p901"
          />
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Treaty country</label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
              value={info.treatyCountry ?? ''}
              onChange={(e) => {
                const country = e.target.value || undefined
                const updates: Record<string, unknown> = { treatyCountry: country }
                // Auto-fill FDAP withholding rate from treaty table
                if (country && TREATY_RATES[country] !== undefined) {
                  updates.fdapWithholdingRate = TREATY_RATES[country]
                }
                // Auto-detect SS treaty exemption
                if (country && SS_EXEMPT_COUNTRIES.includes(country)) {
                  updates.socialSecurityTreatyExempt = true
                } else {
                  updates.socialSecurityTreatyExempt = false
                }
                setNRAInfo(updates)
              }}
            >
              <option value="">None / Not claiming treaty benefits</option>
              {TREATY_COUNTRIES.filter(c => c).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {info.treatyCountry && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Treaty article number</label>
                <input
                  type="text"
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                  value={info.treatyArticle ?? ''}
                  onChange={(e) => setNRAInfo({ treatyArticle: e.target.value || undefined })}
                  placeholder="e.g., 21"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Income exempt under treaty ($)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                  value={centsToString(info.treatyExemptIncome)}
                  onChange={(e) => setNRAInfo({ treatyExemptIncome: stringToCents(e.target.value) })}
                  placeholder="0.00"
                />
              </div>
              {isSSTreatyExempt && (
                <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                  <p className="text-xs text-blue-800">
                    Social Security benefits are exempt from U.S. tax under the US-{treatyCountry} treaty.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* FDAP Income */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1 inline-flex items-center">
          FDAP Income (Schedule NEC)
          <InfoTooltip
            explanation="Fixed, Determinable, Annual, Periodic (FDAP) income is U.S.-source income that is NOT effectively connected with a U.S. trade or business. It is taxed at a flat 30% rate (or lower treaty rate). Common FDAP income includes dividends, interest, and royalties from U.S. sources."
            pubName="IRS Publication 519 — Chapter 4"
            pubUrl="https://www.irs.gov/publications/p519"
          />
        </h2>
        <p className="mt-2 text-xs text-gray-500">
          Enter U.S.-source income NOT connected with a U.S. trade or business.
          This income is taxed at a flat rate (default 30%, or your treaty rate).
        </p>
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          <p className="text-xs text-blue-800">
            Dividends and interest from your 1099-DIV and 1099-INT forms are automatically classified
            as FDAP income. Only enter additional FDAP amounts not captured by your 1099 forms below.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Additional FDAP dividends ($)</label>
              <input
                type="text"
                inputMode="decimal"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                value={centsToString(info.fdapDividends)}
                onChange={(e) => setNRAInfo({ fdapDividends: stringToCents(e.target.value) })}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Additional FDAP interest ($)</label>
              <input
                type="text"
                inputMode="decimal"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                value={centsToString(info.fdapInterest)}
                onChange={(e) => setNRAInfo({ fdapInterest: stringToCents(e.target.value) })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Additional FDAP royalties ($)</label>
              <input
                type="text"
                inputMode="decimal"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                value={centsToString(info.fdapRoyalties)}
                onChange={(e) => setNRAInfo({ fdapRoyalties: stringToCents(e.target.value) })}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Other FDAP ($)</label>
              <input
                type="text"
                inputMode="decimal"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                value={centsToString(info.fdapOtherIncome)}
                onChange={(e) => setNRAInfo({ fdapOtherIncome: stringToCents(e.target.value) })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 inline-flex items-center">
              FDAP withholding rate
              <InfoTooltip
                explanation="The default FDAP tax rate is 30%. If your country has a tax treaty with the U.S. that provides a lower rate for certain income types, enter that rate here. For example, many treaties reduce the dividend withholding rate to 15% or 10%."
                pubName="IRS Publication 515"
                pubUrl="https://www.irs.gov/publications/p515"
              />
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                value={((info.fdapWithholdingRate ?? 0.30) * 100).toFixed(0)}
                onChange={(e) => {
                  const pct = parseFloat(e.target.value)
                  if (!isNaN(pct)) setNRAInfo({ fdapWithholdingRate: pct / 100 })
                }}
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            {treatyRate !== undefined && (
              <p className="text-xs text-green-700 mt-1">
                Auto-set to {(treatyRate * 100).toFixed(0)}% per US-{treatyCountry} treaty
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Rental Income Election (IRC §871(d)) — only when user has Schedule E properties */}
      {scheduleEProperties.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1 inline-flex items-center">
            Rental Income Election (IRC &sect;871(d))
            <InfoTooltip
              explanation="As a nonresident alien, your U.S. rental income is normally taxed at a flat 30% rate on gross rents (FDAP). You may elect under IRC §871(d) to treat real property income as effectively connected income (ECI), which allows you to deduct rental expenses and pay tax at graduated rates. This election is generally beneficial if you have significant rental expenses."
              pubName="IRS Publication 519 — Real Property Income"
              pubUrl="https://www.irs.gov/publications/p519"
            />
          </h2>
          <p className="mt-2 text-xs text-gray-500">
            As a nonresident alien, your U.S. rental income is normally taxed at a flat 30% rate
            on gross rents (FDAP). You may elect under IRC &sect;871(d) to treat real property income
            as effectively connected income (ECI), which allows you to deduct rental expenses and
            pay tax at graduated rates.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={info.rentalElectECI ?? false}
                onChange={(e) => setNRAInfo({ rentalElectECI: e.target.checked })}
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-tax-blue rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-tax-blue"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">
              Elect to treat rental income as ECI
            </span>
          </div>
          {(info.rentalElectECI ?? false) && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              <p className="text-xs text-green-800">
                Your rental income from {scheduleEProperties.length} propert{scheduleEProperties.length > 1 ? 'ies' : 'y'} will
                be treated as ECI. Rental expenses will be deductible and income taxed at graduated rates.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Scholarship Income */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1 inline-flex items-center">
          Scholarship / Fellowship Income
          <InfoTooltip
            explanation="If you received a scholarship or fellowship grant, the portion used for room, board, travel, or other non-qualifying expenses is taxable. Amounts used for tuition and required fees/books are generally tax-free."
            pubName="IRS Publication 519 — Scholarships"
            pubUrl="https://www.irs.gov/publications/p519"
          />
        </h2>
        <div className="mt-4 flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Taxable scholarship income ($)</label>
          <input
            type="text"
            inputMode="decimal"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={centsToString(info.scholarshipIncome)}
            onChange={(e) => setNRAInfo({ scholarshipIncome: stringToCents(e.target.value) })}
            placeholder="0.00"
          />
        </div>
      </section>

      <InterviewNav interview={interview} />
    </div>
  )
}
