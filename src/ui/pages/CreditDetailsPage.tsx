import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import { dollars } from '../../model/traced.ts'
import { SAVERS_CREDIT_THRESHOLDS } from '../../rules/2025/constants.ts'
import type { FilingStatus } from '../../model/types.ts'

function formatCurrency(cents: number): string {
  return dollars(cents).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  })
}

export function CreditDetailsPage() {
  const filingStatus = useTaxStore((s) => s.taxReturn.filingStatus) as FilingStatus
  const dependentCare = useTaxStore((s) => s.taxReturn.dependentCare)
  const retirementContributions = useTaxStore((s) => s.taxReturn.retirementContributions)
  const energyCredits = useTaxStore((s) => s.taxReturn.energyCredits)
  const w2s = useTaxStore((s) => s.taxReturn.w2s)
  const form1040 = useTaxStore((s) => s.computeResult.form1040)
  const setDependentCare = useTaxStore((s) => s.setDependentCare)
  const setRetirementContributions = useTaxStore((s) => s.setRetirementContributions)
  const setEnergyCredits = useTaxStore((s) => s.setEnergyCredits)
  const interview = useInterview()

  const care = dependentCare ?? { totalExpenses: 0, numQualifyingPersons: 0 }
  const retire = retirementContributions ?? { traditionalIRA: 0, rothIRA: 0 }
  const energy = energyCredits ?? {
    solarElectric: 0, solarWaterHeating: 0, batteryStorage: 0, geothermal: 0,
    insulation: 0, windows: 0, exteriorDoors: 0, centralAC: 0,
    waterHeater: 0, heatPump: 0, homeEnergyAudit: 0, biomassStove: 0,
  }

  // Compute W-2 Box 12 elective deferrals for display
  const deferralCodes = new Set(['D', 'E', 'AA', 'BB', 'G', 'H'])
  let electiveDeferrals = 0
  for (const w2 of w2s) {
    for (const entry of w2.box12) {
      if (deferralCodes.has(entry.code)) electiveDeferrals += entry.amount
    }
  }

  const iraDeduction = form1040.iraDeduction
  const dcCredit = form1040.dependentCareCredit
  const scCredit = form1040.saversCredit
  const ecCredit = form1040.energyCredit

  // Saver's Credit AGI eligibility
  const agi = form1040.line11.amount
  const saversMaxAGI = SAVERS_CREDIT_THRESHOLDS[filingStatus].rate10
  const saversIneligible = agi > saversMaxAGI

  const STATUS_LABELS: Record<string, string> = {
    single: 'Single', mfj: 'Married Filing Jointly', mfs: 'Married Filing Separately',
    hoh: 'Head of Household', qw: 'Qualifying Surviving Spouse',
  }

  return (
    <div data-testid="page-credit-details" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Credit Details</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter expenses and contributions to compute additional tax credits.
      </p>

      {/* ── Dependent Care (Form 2441) ───────────────────── */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-gray-800">Dependent Care</span>
            <InfoTooltip
              explanation="Credit for expenses paid to a care provider so you (and your spouse) could work or look for work. The qualifying person must be your dependent child under age 13, or a dependent or spouse who is physically or mentally incapable of self-care."
              pubName="IRS Form 2441 — Child and Dependent Care Expenses"
              pubUrl="https://www.irs.gov/forms-pubs/about-form-2441"
            />
            <span className="text-xs text-gray-400">Form 2441</span>
          </div>
          {dcCredit && dcCredit.creditAmount > 0 && (
            <span className="text-sm font-semibold text-tax-green">{formatCurrency(dcCredit.creditAmount)}</span>
          )}
        </div>
        <CurrencyInput
          label="Total expenses paid to care providers"
          value={care.totalExpenses}
          onChange={(v) => setDependentCare({ totalExpenses: v })}
          helperText="Include daycare, babysitter, and day camp costs"
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Qualifying persons</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
            value={care.numQualifyingPersons}
            onChange={(e) => setDependentCare({ numQualifyingPersons: parseInt(e.target.value, 10) })}
          >
            <option value={0}>Auto-detect from dependents</option>
            <option value={1}>1 person ($3,000 limit)</option>
            <option value={2}>2 or more ($6,000 limit)</option>
          </select>
          <span className="text-xs text-gray-500">
            Children under 13 are automatically counted from your dependents
          </span>
        </div>
        {dcCredit && dcCredit.creditAmount > 0 && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
            {dcCredit.numQualifyingPersons} qualifying person{dcCredit.numQualifyingPersons !== 1 ? 's' : ''}
            {' '}&middot; Limit {formatCurrency(dcCredit.expenseLimit)}
            {' '}&middot; Rate {Math.round(dcCredit.creditRate * 100)}%
          </div>
        )}
      </div>

      {/* ── Retirement Savings (Form 8880) ───────────────── */}
      <div className={`mt-4 rounded-xl border p-4 flex flex-col gap-3 ${
        saversIneligible ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-1">
            <span className={`text-sm font-semibold ${saversIneligible ? 'text-gray-400' : 'text-gray-800'}`}>
              Retirement Savings
            </span>
            <InfoTooltip
              explanation="The Saver's Credit rewards low- and moderate-income taxpayers for contributing to retirement accounts. It applies to IRA contributions and elective deferrals (401(k), 403(b), SIMPLE, etc.). The credit rate (50%, 20%, or 10%) depends on your AGI and filing status."
              pubName="IRS Form 8880 — Credit for Qualified Retirement Savings"
              pubUrl="https://www.irs.gov/forms-pubs/about-form-8880"
            />
            <span className="text-xs text-gray-400">Form 8880</span>
          </div>
          {saversIneligible ? (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              Not eligible
            </span>
          ) : scCredit && scCredit.creditAmount > 0 ? (
            <span className="text-sm font-semibold text-tax-green">{formatCurrency(scCredit.creditAmount)}</span>
          ) : null}
        </div>
        {saversIneligible && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Your AGI of {formatCurrency(agi)} exceeds the {formatCurrency(saversMaxAGI)} limit
            for {STATUS_LABELS[filingStatus]} filers. The Saver's Credit is not available.
          </div>
        )}
        {!saversIneligible && electiveDeferrals > 0 && (
          <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
            W-2 Box 12 elective deferrals: {formatCurrency(electiveDeferrals)} (auto-derived)
          </div>
        )}
        <CurrencyInput
          label="Traditional IRA contributions"
          value={retire.traditionalIRA}
          onChange={(v) => setRetirementContributions({ traditionalIRA: v })}
        />
        {iraDeduction && iraDeduction.deductibleAmount > 0 && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
            IRA deduction: {formatCurrency(iraDeduction.deductibleAmount)}
            {iraDeduction.phaseOutApplies && ' (phase-out applied)'}
          </div>
        )}
        {iraDeduction && iraDeduction.contribution > 0 && iraDeduction.deductibleAmount === 0 && iraDeduction.phaseOutApplies && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            IRA deduction fully phased out &mdash; MAGI exceeds {formatCurrency(iraDeduction.phaseOutEnd)} for {STATUS_LABELS[filingStatus]} filers covered by an employer plan.
          </div>
        )}
        <CurrencyInput
          label="Roth IRA contributions"
          value={retire.rothIRA}
          onChange={(v) => setRetirementContributions({ rothIRA: v })}
          disabled={saversIneligible}
        />
        {!saversIneligible && scCredit && scCredit.creditAmount > 0 && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
            Eligible: {formatCurrency(scCredit.eligibleContributions)}
            {' '}&middot; Rate {Math.round(scCredit.creditRate * 100)}%
          </div>
        )}
      </div>

      {/* ── Residential Energy (Form 5695) ───────────────── */}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-gray-800">Residential Energy</span>
            <InfoTooltip
              explanation="Two credits: (1) Residential Clean Energy Credit (§25D) — 30% of solar, battery, and geothermal costs with no annual cap. (2) Energy Efficient Home Improvement Credit (§25C) — 30% of insulation, windows, HVAC, etc., with a $1,200 annual cap and a separate $2,000 cap for heat pumps."
              pubName="IRS Form 5695 — Residential Energy Credits"
              pubUrl="https://www.irs.gov/forms-pubs/about-form-5695"
            />
            <span className="text-xs text-gray-400">Form 5695</span>
          </div>
          {ecCredit && ecCredit.totalCredit > 0 && (
            <span className="text-sm font-semibold text-tax-green">{formatCurrency(ecCredit.totalCredit)}</span>
          )}
        </div>

        {/* Part I — Clean Energy */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">
          Part I — Residential Clean Energy (30%, no cap)
        </p>
        <CurrencyInput
          label="Solar electric (photovoltaic)"
          value={energy.solarElectric}
          onChange={(v) => setEnergyCredits({ solarElectric: v })}
        />
        <CurrencyInput
          label="Solar water heating"
          value={energy.solarWaterHeating}
          onChange={(v) => setEnergyCredits({ solarWaterHeating: v })}
        />
        <CurrencyInput
          label="Battery storage (≥3 kWh)"
          value={energy.batteryStorage}
          onChange={(v) => setEnergyCredits({ batteryStorage: v })}
        />
        <CurrencyInput
          label="Geothermal heat pump"
          value={energy.geothermal}
          onChange={(v) => setEnergyCredits({ geothermal: v })}
        />
        {ecCredit && ecCredit.partICredit > 0 && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
            Part I credit: {formatCurrency(ecCredit.partICredit)}
          </div>
        )}

        {/* Part II — Home Improvement */}
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">
          Part II — Energy Efficient Home Improvement (30%, capped)
        </p>
        <CurrencyInput
          label="Insulation / air sealing"
          value={energy.insulation}
          onChange={(v) => setEnergyCredits({ insulation: v })}
        />
        <CurrencyInput
          label={<>Windows <span className="text-xs text-gray-400">($600 cap)</span></>}
          value={energy.windows}
          onChange={(v) => setEnergyCredits({ windows: v })}
        />
        <CurrencyInput
          label={<>Exterior doors <span className="text-xs text-gray-400">($500 cap)</span></>}
          value={energy.exteriorDoors}
          onChange={(v) => setEnergyCredits({ exteriorDoors: v })}
        />
        <CurrencyInput
          label="Central air conditioning"
          value={energy.centralAC}
          onChange={(v) => setEnergyCredits({ centralAC: v })}
        />
        <CurrencyInput
          label="Water heater"
          value={energy.waterHeater}
          onChange={(v) => setEnergyCredits({ waterHeater: v })}
        />
        <CurrencyInput
          label={<>Heat pump <span className="text-xs text-gray-400">(separate $2,000 cap)</span></>}
          value={energy.heatPump}
          onChange={(v) => setEnergyCredits({ heatPump: v })}
        />
        <CurrencyInput
          label={<>Home energy audit <span className="text-xs text-gray-400">($150 cap)</span></>}
          value={energy.homeEnergyAudit}
          onChange={(v) => setEnergyCredits({ homeEnergyAudit: v })}
        />
        <CurrencyInput
          label="Biomass stove / boiler"
          value={energy.biomassStove}
          onChange={(v) => setEnergyCredits({ biomassStove: v })}
        />
        {ecCredit && ecCredit.partIICredit > 0 && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
            Part II credit: {formatCurrency(ecCredit.partIICredit)}
            {ecCredit.partIIHeatPumpCredit > 0 && ` (heat pump ${formatCurrency(ecCredit.partIIHeatPumpCredit)} + general ${formatCurrency(ecCredit.partIIGeneralCredit)})`}
          </div>
        )}
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
