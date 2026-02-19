import { Link } from 'react-router-dom'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import { SAVERS_CREDIT_THRESHOLDS } from '../../rules/2025/constants.ts'
import type { FilingStatus } from '../../model/types.ts'

function formatCurrency(cents: number): string {
  const d = Math.abs(cents) / 100
  const formatted = d.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
  return cents < 0 ? `-${formatted}` : formatted
}

export function CreditsPage() {
  const filingStatus = useTaxStore((s) => s.taxReturn.filingStatus) as FilingStatus
  const dependents = useTaxStore((s) => s.taxReturn.dependents)
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

  const ctc = form1040.childTaxCredit
  const eic = form1040.earnedIncomeCredit
  const iraDeduction = form1040.iraDeduction
  const dcCredit = form1040.dependentCareCredit
  const scCredit = form1040.saversCredit
  const ecCredit = form1040.energyCredit
  const hasDependentsWithoutDOB = dependents.some((d) => !d.dateOfBirth)

  // Compute W-2 Box 12 elective deferrals for display
  const deferralCodes = new Set(['D', 'E', 'AA', 'BB', 'G', 'H'])
  let electiveDeferrals = 0
  for (const w2 of w2s) {
    for (const entry of w2.box12) {
      if (deferralCodes.has(entry.code)) electiveDeferrals += entry.amount
    }
  }

  // Saver's Credit AGI eligibility
  const agi = form1040.line11.amount
  const saversMaxAGI = SAVERS_CREDIT_THRESHOLDS[filingStatus].rate10
  const saversIneligible = agi > saversMaxAGI

  const STATUS_LABELS: Record<string, string> = {
    single: 'Single', mfj: 'Married Filing Jointly', mfs: 'Married Filing Separately',
    hoh: 'Head of Household', qw: 'Qualifying Surviving Spouse',
  }

  return (
    <div data-testid="page-credits" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Credits</h1>
      <p className="mt-1 text-sm text-gray-600">
        Credits computed from your dependents and income, plus additional credits you can claim below.
      </p>

      {/* ── Missing DOB warning ─────────────────────────────── */}
      {hasDependentsWithoutDOB && (
        <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3">
          <p className="text-sm text-amber-800">
            Some dependents are missing a date of birth. Add DOB on the{' '}
            <Link to="/interview/dependents" className="font-medium text-amber-900 underline">
              Dependents page
            </Link>{' '}
            to compute child tax credits.
          </p>
        </div>
      )}

      {/* ── Child Tax Credit (auto-computed) ────────────────── */}
      {ctc && (ctc.numQualifyingChildren > 0 || ctc.numOtherDependents > 0) ? (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-gray-800">Child Tax Credit</span>
              <InfoTooltip
                explanation="A qualifying child must be under age 17 at the end of the tax year, have a valid SSN, be your son/daughter/stepchild/foster child/sibling/grandchild, and have lived with you for more than half the year. Each qualifying child generates a $2,000 credit."
                pubName="IRS Schedule 8812 Instructions"
                pubUrl="https://www.irs.gov/instructions/i1040s8"
              />
              <span className="text-xs text-gray-400">Schedule 8812</span>
            </div>
            {form1040.line19.amount > 0 && (
              <span className="text-sm font-semibold text-tax-green">{formatCurrency(form1040.line19.amount)}</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Qualifying children (under 17)</span>
              <span className="font-medium">{ctc.numQualifyingChildren}</span>
            </div>
            {ctc.numOtherDependents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Other dependents ($500 each)</span>
                <span className="font-medium">{ctc.numOtherDependents}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Initial credit</span>
              <span className="font-medium tabular-nums">{formatCurrency(ctc.initialCredit)}</span>
            </div>
            {ctc.phaseOutReduction > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 flex items-center">
                  Phase-out reduction
                  <InfoTooltip
                    explanation="The child tax credit phases out by $50 for each $1,000 (or fraction thereof) of AGI above the threshold. Thresholds: $200,000 (Single/HOH/MFS) or $400,000 (MFJ/QW). The phase-out applies to the total credit including the $500 other dependent credit."
                    pubName="IRC §24(b) — Phase-out"
                    pubUrl="https://www.irs.gov/instructions/i1040s8"
                  />
                </span>
                <span className="font-medium tabular-nums text-tax-red">
                  −{formatCurrency(ctc.phaseOutReduction)}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 border-t border-gray-100 pt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 font-medium flex items-center">
                Line 19 — Non-refundable CTC
                <InfoTooltip
                  explanation="The non-refundable portion of the child tax credit directly reduces your tax liability but cannot reduce it below zero. Any excess may become the refundable Additional Child Tax Credit on Line 28."
                  pubName="Form 1040, Line 19"
                  pubUrl="https://www.irs.gov/instructions/i1040gi"
                />
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-medium tabular-nums">{formatCurrency(form1040.line19.amount)}</span>
                <Link to="/explain/form1040.line19" className="text-xs text-tax-blue hover:text-blue-700" title="Why this number?">?</Link>
              </div>
            </div>
            {form1040.line28.amount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 font-medium flex items-center">
                  Line 28 — Additional CTC (refundable)
                  <InfoTooltip
                    explanation="The Additional Child Tax Credit (Form 8812) is the refundable portion. It equals the lesser of: (a) $1,700 per qualifying child, and (b) 15% of earned income above $2,500. It cannot exceed the unused credit from Line 19."
                    pubName="Schedule 8812 — Additional CTC"
                    pubUrl="https://www.irs.gov/instructions/i1040s8"
                  />
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium tabular-nums text-tax-green">{formatCurrency(form1040.line28.amount)}</span>
                  <Link to="/explain/form1040.line28" className="text-xs text-tax-blue hover:text-blue-700" title="Why this number?">?</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-semibold text-gray-400">Child Tax Credit</span>
            <span className="text-xs text-gray-400">Schedule 8812</span>
          </div>
          <p className="text-sm text-gray-500">
            {dependents.length === 0
              ? 'No dependents on this return. Add dependents to compute credits.'
              : 'No dependents qualify for child tax credits. Ensure date of birth, SSN, and relationship are filled in.'}
          </p>
        </div>
      )}

      {/* ── Earned Income Credit (auto-computed) ───────────── */}
      {eic && eic.eligible && eic.creditAmount > 0 ? (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-gray-800">Earned Income Credit</span>
              <InfoTooltip
                explanation="The Earned Income Credit is computed at both earned income and AGI, taking the smaller amount. It is a refundable credit — it can reduce your tax below zero and result in a refund."
                pubName="IRS Pub 596 — Earned Income Credit"
                pubUrl="https://www.irs.gov/publications/p596"
              />
            </div>
            <span className="text-sm font-semibold text-tax-green">{formatCurrency(eic.creditAmount)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700 flex items-center">
                Qualifying children (EITC)
                <InfoTooltip
                  explanation="For the EITC, a qualifying child must be under age 19 at the end of the tax year (or under 24 if a full-time student, or any age if permanently disabled), have a valid SSN, be your son/daughter/stepchild/foster child/sibling/grandchild, and have lived with you for more than half the year."
                  pubName="IRS Pub 596 — Earned Income Credit"
                  pubUrl="https://www.irs.gov/publications/p596"
                />
              </span>
              <span className="font-medium">{eic.numQualifyingChildren}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Credit at earned income</span>
              <span className="font-medium tabular-nums">{formatCurrency(eic.creditAtEarnedIncome)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Credit at AGI</span>
              <span className="font-medium tabular-nums">{formatCurrency(eic.creditAtAGI)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
            <span className="text-gray-700 font-medium">Line 27 — Earned income credit</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-medium tabular-nums text-tax-green">{formatCurrency(eic.creditAmount)}</span>
              <Link to="/explain/form1040.line27" className="text-xs text-tax-blue hover:text-blue-700" title="Why this number?">?</Link>
            </div>
          </div>
        </div>
      ) : eic && !eic.eligible && eic.ineligibleReason ? (
        <div className="mt-4 bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-semibold text-gray-400">Earned Income Credit</span>
          </div>
          <p className="text-sm text-gray-500">
            {eic.ineligibleReason === 'mfs' && 'Not available for Married Filing Separately.'}
            {eic.ineligibleReason === 'investment_income' && 'Investment income exceeds $11,950 — not eligible.'}
            {eic.ineligibleReason === 'age' && 'Without qualifying children, the EITC requires the filer to be age 25–64.'}
            {eic.ineligibleReason === 'no_income' && 'No earned income — requires wages or self-employment income.'}
          </p>
        </div>
      ) : filingStatus === 'mfs' ? (
        <div className="mt-4 bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm font-semibold text-gray-400">Earned Income Credit</span>
          </div>
          <p className="text-sm text-gray-500">Not available for Married Filing Separately.</p>
        </div>
      ) : null}

      {/* ── Dependent Care (Form 2441) ───────────────────── */}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
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

      {/* ── Credit Summary (Line 20) ───────────────────────── */}
      {form1040.line20.amount > 0 && (
        <div className="mt-4 bg-gray-50 rounded-xl border border-gray-200 p-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Other Non-refundable Credits (Line 20)
          </h2>
          <div className="flex flex-col gap-1">
            {dcCredit && dcCredit.creditAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Dependent care (Form 2441)</span>
                <span className="font-medium tabular-nums">{formatCurrency(dcCredit.creditAmount)}</span>
              </div>
            )}
            {scCredit && scCredit.creditAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Saver's credit (Form 8880)</span>
                <span className="font-medium tabular-nums">{formatCurrency(scCredit.creditAmount)}</span>
              </div>
            )}
            {ecCredit && ecCredit.totalCredit > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Energy credit (Form 5695)</span>
                <span className="font-medium tabular-nums">{formatCurrency(ecCredit.totalCredit)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm border-t border-gray-200 pt-1">
              <span className="text-gray-700 font-medium">Line 20 — Total other credits</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-medium tabular-nums">{formatCurrency(form1040.line20.amount)}</span>
                <Link to="/explain/form1040.line20" className="text-xs text-tax-blue hover:text-blue-700" title="Why this number?">?</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <InterviewNav interview={interview} />
    </div>
  )
}
