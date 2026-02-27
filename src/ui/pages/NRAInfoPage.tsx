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
  const interview = useInterview()

  const info = nraInfo ?? { countryOfResidence: '' }

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
              onChange={(e) => setNRAInfo({ treatyCountry: e.target.value || undefined })}
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
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Dividends ($)</label>
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
              <label className="text-sm font-medium text-gray-700">Interest ($)</label>
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
              <label className="text-sm font-medium text-gray-700">Royalties ($)</label>
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
          </div>
        </div>
      </section>

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
