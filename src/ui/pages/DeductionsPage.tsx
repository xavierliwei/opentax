import { useRef, useState } from 'react'
import { useTaxStore } from '../../store/taxStore.ts'
import type { ItemizedDeductions } from '../../model/types.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import {
  STANDARD_DEDUCTION,
  ADDITIONAL_STANDARD_DEDUCTION,
  MEDICAL_AGI_FLOOR_RATE,
  CHARITABLE_CASH_AGI_LIMIT,
  CHARITABLE_NONCASH_AGI_LIMIT,
  MORTGAGE_LIMIT_POST_TCJA,
  MORTGAGE_LIMIT_PRE_TCJA,
  STUDENT_LOAN_DEDUCTION_MAX,
  STUDENT_LOAN_PHASEOUT,
  HSA_LIMIT_SELF_ONLY,
  HSA_LIMIT_FAMILY,
  HSA_CATCHUP_AMOUNT,
} from '../../rules/2025/constants.ts'
import { computeSaltCap } from '../../rules/2025/scheduleA.ts'
import { dollars } from '../../model/traced.ts'
import { parseForm1098Pdf } from '../../intake/pdf/form1098PdfParser.ts'

function formatCurrency(cents: number): string {
  return dollars(cents).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  })
}

function LimitedBadge({ entered, deductible }: { entered: number; deductible: number }) {
  if (!entered || deductible >= entered) return null
  return (
    <p className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
      Limited to {formatCurrency(deductible)} (you entered {formatCurrency(entered)})
    </p>
  )
}

export function DeductionsPage() {
  const filingStatus = useTaxStore((s) => s.taxReturn.filingStatus)
  const deductions = useTaxStore((s) => s.taxReturn.deductions)
  const agi = useTaxStore((s) => s.computeResult.form1040.line11.amount)
  const computeResult = useTaxStore((s) => s.computeResult)
  const line2b = useTaxStore((s) => s.computeResult.form1040.line2b.amount)
  const line3a = useTaxStore((s) => s.computeResult.form1040.line3a.amount)
  const line3b = useTaxStore((s) => s.computeResult.form1040.line3b.amount)
  const scheduleD = useTaxStore((s) => s.computeResult.form1040.scheduleD)
  const setDeductionMethod = useTaxStore((s) => s.setDeductionMethod)
  const setDeductionFlags = useTaxStore((s) => s.setDeductionFlags)
  const setItemizedDeductions = useTaxStore((s) => s.setItemizedDeductions)
  const interview = useInterview()

  const additionalPer = ADDITIONAL_STANDARD_DEDUCTION[filingStatus]
  let additionalCount = 0
  if (deductions.taxpayerAge65) additionalCount++
  if (deductions.taxpayerBlind) additionalCount++
  if (filingStatus === 'mfj' || filingStatus === 'mfs') {
    if (deductions.spouseAge65) additionalCount++
    if (deductions.spouseBlind) additionalCount++
  }
  const additionalAmount = additionalPer * additionalCount
  const standardAmount = STANDARD_DEDUCTION[filingStatus] + additionalAmount
  const medicalFloor = Math.round(agi * MEDICAL_AGI_FLOOR_RATE)
  const effectiveSaltCap = computeSaltCap(filingStatus, agi)
  const cashAgiLimit = Math.round(agi * CHARITABLE_CASH_AGI_LIMIT)
  const noncashAgiLimit = Math.round(agi * CHARITABLE_NONCASH_AGI_LIMIT)

  // Net investment income for investment interest limit display
  const nonQualifiedDivs = Math.max(0, line3b - line3a)
  const netSTGain = Math.max(0, scheduleD?.line7.amount ?? 0)
  const netInvestmentIncome = line2b + nonQualifiedDivs + netSTGain

  const itemized = deductions.itemized ?? {
    medicalExpenses: 0,
    stateLocalIncomeTaxes: 0,
    stateLocalSalesTaxes: 0,
    realEstateTaxes: 0,
    personalPropertyTaxes: 0,
    mortgageInterest: 0,
    mortgagePrincipal: 0,
    mortgagePreTCJA: false,
    investmentInterest: 0,
    priorYearInvestmentInterestCarryforward: 0,
    charitableCash: 0,
    charitableNoncash: 0,
    gamblingLosses: 0,
    casualtyTheftLosses: 0,
    federalEstateTaxIRD: 0,
    otherMiscDeductions: 0,
  }

  // Use post-limit total from engine when available (method=itemized),
  // otherwise compute a rough estimate for comparison display.
  const itemizedTotal = computeResult.form1040.scheduleA?.line17.amount ?? (
    Math.max(0, itemized.medicalExpenses - medicalFloor) +
    Math.min(
      Math.max(itemized.stateLocalIncomeTaxes, itemized.stateLocalSalesTaxes) +
        itemized.realEstateTaxes + itemized.personalPropertyTaxes,
      effectiveSaltCap,
    ) +
    itemized.mortgageInterest +
    itemized.investmentInterest +
    itemized.charitableCash +
    itemized.charitableNoncash +
    itemized.gamblingLosses +
    itemized.casualtyTheftLosses +
    itemized.federalEstateTaxIRD +
    itemized.otherMiscDeductions
  )

  const diff = Math.abs(standardAmount - itemizedTotal)
  const standardBetter = standardAmount >= itemizedTotal

  // scheduleA data (only present when method=itemized)
  const scheduleA = computeResult.form1040.scheduleA
  const medicalDeductible    = scheduleA?.line4.amount  ?? 0
  const saltDeductible       = scheduleA?.line7.amount  ?? 0
  const interestDeductible   = scheduleA?.line10.amount ?? 0
  const charitableDeductible = scheduleA?.line14.amount ?? 0
  const otherDeductible      = scheduleA?.line16.amount ?? 0

  // SALT total before cap
  const totalSalt =
    Math.max(itemized.stateLocalIncomeTaxes, itemized.stateLocalSalesTaxes) +
    itemized.realEstateTaxes +
    itemized.personalPropertyTaxes

  // Mortgage loan limit check
  const loanLimit = itemized.mortgagePreTCJA
    ? MORTGAGE_LIMIT_PRE_TCJA[filingStatus]
    : MORTGAGE_LIMIT_POST_TCJA[filingStatus]
  const mortgageLimited = itemized.mortgagePrincipal > 0 && itemized.mortgagePrincipal > loanLimit

  // Form 1098 upload state
  const [form1098Status, setForm1098Status] = useState<'idle' | 'parsing' | 'imported' | 'error'>('idle')
  const [form1098Message, setForm1098Message] = useState('')
  const form1098InputRef = useRef<HTMLInputElement>(null)
  const [form1098Dragging, setForm1098Dragging] = useState(false)

  async function handleForm1098File(file: File) {
    setForm1098Status('parsing')
    setForm1098Message('')
    try {
      const buf = await file.arrayBuffer()
      const parsed = await parseForm1098Pdf(buf)
      if (parsed.errors.length > 0) {
        setForm1098Status('error')
        setForm1098Message(parsed.errors.join('; '))
        return
      }
      // Auto-switch to itemized if currently standard
      if (deductions.method === 'standard') {
        setDeductionMethod('itemized')
      }
      // Auto-fill the fields
      const updates: Record<string, number | boolean> = {}
      if (parsed.mortgageInterest > 0) updates.mortgageInterest = parsed.mortgageInterest
      if (parsed.mortgagePrincipal > 0) updates.mortgagePrincipal = parsed.mortgagePrincipal
      if (parsed.originationDate) updates.mortgagePreTCJA = parsed.mortgagePreTCJA
      setItemizedDeductions(updates)

      const lender = parsed.lenderName || 'your lender'
      const parts: string[] = []
      if (parsed.mortgageInterest > 0) parts.push(`interest ${formatCurrency(parsed.mortgageInterest)}`)
      if (parsed.mortgagePrincipal > 0) parts.push(`principal ${formatCurrency(parsed.mortgagePrincipal)}`)
      const detail = parts.length > 0 ? ` — ${parts.join(', ')}` : ''
      setForm1098Status('imported')
      setForm1098Message(`Form 1098 imported from ${lender}${detail}`)
      if (parsed.warnings.length > 0) {
        setForm1098Message((prev) => prev + '. ' + parsed.warnings.join('; '))
      }
    } catch (err) {
      setForm1098Status('error')
      setForm1098Message(err instanceof Error ? err.message : 'Failed to parse PDF')
    }
  }

  return (
    <div data-testid="page-deductions" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Deductions</h1>
      <p className="mt-1 text-sm text-gray-600">
        Choose between the standard deduction or itemizing your deductions.
      </p>

      {/* Method selection */}
      <fieldset className="mt-6 grid grid-cols-2 gap-3">
        <legend className="sr-only">Deduction method</legend>
        <label
          className={`flex flex-col items-center gap-1 border rounded-lg p-4 cursor-pointer transition-colors ${
            deductions.method === 'standard'
              ? 'border-tax-blue bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            name="deduction-method"
            value="standard"
            checked={deductions.method === 'standard'}
            onChange={() => setDeductionMethod('standard')}
            className="sr-only"
          />
          <span className="text-sm font-medium text-gray-900">Standard</span>
          <span className="text-lg font-bold text-gray-700">
            {formatCurrency(standardAmount)}
          </span>
          {standardBetter && diff > 0 && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              Best choice
            </span>
          )}
        </label>
        <label
          className={`flex flex-col items-center gap-1 border rounded-lg p-4 cursor-pointer transition-colors ${
            deductions.method === 'itemized'
              ? 'border-tax-blue bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            name="deduction-method"
            value="itemized"
            checked={deductions.method === 'itemized'}
            onChange={() => setDeductionMethod('itemized')}
            className="sr-only"
          />
          <span className="text-sm font-medium text-gray-900">Itemized</span>
          <span className="text-lg font-bold text-gray-700">
            {formatCurrency(itemizedTotal)}
          </span>
          {!standardBetter && diff > 0 && (
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              Best choice
            </span>
          )}
        </label>
      </fieldset>

      {/* Additional standard deduction for age 65+ / blind */}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-gray-800">Additional Standard Deduction</span>
          <InfoTooltip
            explanation={`If you or your spouse are age 65 or older or blind, you qualify for an additional standard deduction of ${formatCurrency(additionalPer)} per person per condition. These amounts increase your standard deduction whether you choose standard or itemized (they affect the standard deduction comparison).`}
            pubName="IRS Form 1040 Instructions — Standard Deduction Chart"
            pubUrl="https://www.irs.gov/instructions/i1040gi"
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Taxpayer</p>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={deductions.taxpayerAge65}
              onChange={(e) => setDeductionFlags({ taxpayerAge65: e.target.checked })}
              className="rounded border-gray-300"
            />
            Age 65 or older
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={deductions.taxpayerBlind}
              onChange={(e) => setDeductionFlags({ taxpayerBlind: e.target.checked })}
              className="rounded border-gray-300"
            />
            Legally blind
          </label>
        </div>
        {(filingStatus === 'mfj' || filingStatus === 'mfs') && (
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Spouse</p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={deductions.spouseAge65}
                onChange={(e) => setDeductionFlags({ spouseAge65: e.target.checked })}
                className="rounded border-gray-300"
              />
              Age 65 or older
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={deductions.spouseBlind}
                onChange={(e) => setDeductionFlags({ spouseBlind: e.target.checked })}
                className="rounded border-gray-300"
              />
              Legally blind
            </label>
          </div>
        )}
        {additionalAmount > 0 && (
          <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
            Additional deduction: {formatCurrency(additionalAmount)} ({additionalCount} &times; {formatCurrency(additionalPer)})
          </div>
        )}
      </div>

      {/* Itemized detail form */}
      {deductions.method === 'itemized' && (
        <div className="mt-6 flex flex-col gap-4">

          {/* Medical & Dental */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-800">Medical &amp; Dental</span>
                <InfoTooltip
                  explanation="Deductible medical and dental expenses include costs for diagnosis, treatment, and prevention of disease. Only the portion exceeding 7.5% of your AGI qualifies. Eligible expenses include doctor visits, prescriptions, dental and vision care, and long-term care premiums."
                  pubName="IRS Publication 502 — Medical and Dental Expenses"
                  pubUrl="https://www.irs.gov/publications/p502"
                />
                <span className="text-xs text-gray-400">Lines 1–4</span>
              </div>
              {scheduleA && (
                <span className="text-sm font-semibold text-gray-700">
                  {formatCurrency(medicalDeductible)}
                </span>
              )}
            </div>
            <CurrencyInput
              label="Medical expenses"
              value={itemized.medicalExpenses}
              onChange={(v) => setItemizedDeductions({ medicalExpenses: v })}
              helperText={`Only the amount above 7.5% of your AGI (${formatCurrency(medicalFloor)}) is deductible.`}
            />
            {scheduleA && (
              <LimitedBadge entered={itemized.medicalExpenses} deductible={medicalDeductible} />
            )}
          </div>

          {/* State & Local Taxes */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-800">State &amp; Local Taxes</span>
                <InfoTooltip
                  explanation="Deduct state/local income taxes OR general sales taxes — whichever is higher (not both). Add real estate taxes and personal property taxes. For 2025 the combined SALT deduction is capped at $40,000 (One Big Beautiful Bill Act §70120), with a 30% phase-out above $500,000 AGI and a $10,000 floor."
                  pubName="IRS Schedule A Instructions — Taxes You Paid (Lines 5–6)"
                  pubUrl="https://www.irs.gov/instructions/i1040sca"
                />
                <span className="text-xs text-gray-400">Lines 5a–7</span>
              </div>
              {scheduleA && (
                <span className="text-sm font-semibold text-gray-700">
                  {formatCurrency(saltDeductible)}
                </span>
              )}
            </div>
            <CurrencyInput
              label="State/local income taxes (Line 5a)"
              value={itemized.stateLocalIncomeTaxes}
              onChange={(v) => setItemizedDeductions({ stateLocalIncomeTaxes: v })}
              helperText="OR enter sales taxes below — the higher amount is used"
            />
            <CurrencyInput
              label="General sales taxes paid (Line 5a)"
              value={itemized.stateLocalSalesTaxes}
              onChange={(v) => setItemizedDeductions({ stateLocalSalesTaxes: v })}
            />
            {(itemized.stateLocalIncomeTaxes > 0 || itemized.stateLocalSalesTaxes > 0) && (
              <p className="text-xs text-blue-600">
                Using {itemized.stateLocalIncomeTaxes >= itemized.stateLocalSalesTaxes ? 'income taxes' : 'sales taxes'} for Line 5a
                ({formatCurrency(Math.max(itemized.stateLocalIncomeTaxes, itemized.stateLocalSalesTaxes))})
              </p>
            )}
            <CurrencyInput
              label="Real estate taxes (property taxes) (Line 5b)"
              value={itemized.realEstateTaxes}
              onChange={(v) => setItemizedDeductions({ realEstateTaxes: v })}
            />
            <CurrencyInput
              label="Personal property taxes (Line 5c)"
              value={itemized.personalPropertyTaxes}
              onChange={(v) => setItemizedDeductions({ personalPropertyTaxes: v })}
              helperText="e.g., vehicle registration fees based on value"
            />
            {scheduleA && (
              <LimitedBadge entered={totalSalt} deductible={saltDeductible} />
            )}
          </div>

          {/* Interest */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-800">Interest</span>
                <InfoTooltip
                  explanation="Home mortgage interest (Form 1098) is deductible on acquisition debt up to $750,000 for loans originated after Dec 15, 2017, or $1,000,000 for earlier loans (IRC §163(h)(3)). Investment interest expense is deductible only up to your net investment income for the year (IRC §163(d))."
                  pubName="IRS Publication 936 — Home Mortgage Interest Deduction"
                  pubUrl="https://www.irs.gov/publications/p936"
                />
                <span className="text-xs text-gray-400">Lines 8–10</span>
              </div>
              {scheduleA && (
                <span className="text-sm font-semibold text-gray-700">
                  {formatCurrency(interestDeductible)}
                </span>
              )}
            </div>

            {/* Form 1098 upload zone */}
            <div
              className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors select-none
                ${form1098Dragging ? 'border-tax-blue bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
              onClick={() => form1098InputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setForm1098Dragging(true) }}
              onDragLeave={() => setForm1098Dragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setForm1098Dragging(false)
                const file = e.dataTransfer.files[0]
                if (file) handleForm1098File(file)
              }}
            >
              <p className="text-sm font-medium text-gray-600">
                Drop Form 1098 PDF or <span className="text-blue-600 underline">click to upload</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Auto-fills interest &amp; principal from your mortgage lender
              </p>
              <input
                ref={form1098InputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleForm1098File(file)
                  e.target.value = ''
                }}
              />
            </div>

            {/* Form 1098 status banner */}
            {form1098Status === 'parsing' && (
              <p className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                Parsing Form 1098…
              </p>
            )}
            {form1098Status === 'imported' && (
              <p className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                {form1098Message}
              </p>
            )}
            {form1098Status === 'error' && (
              <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {form1098Message}
              </p>
            )}

            <CurrencyInput
              label="Home mortgage interest (Line 8a)"
              value={itemized.mortgageInterest}
              onChange={(v) => setItemizedDeductions({ mortgageInterest: v })}
              helperText="From Form 1098 Box 1"
            />
            <CurrencyInput
              label="Outstanding loan balance"
              value={itemized.mortgagePrincipal}
              onChange={(v) => setItemizedDeductions({ mortgagePrincipal: v })}
              helperText="From Form 1098 Box 2 — used to check the $750K/$1M limit"
            />
            {mortgageLimited && (
              <p className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Loan balance exceeds {formatCurrency(loanLimit)} limit — only the proportional share of interest is deductible.
              </p>
            )}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={itemized.mortgagePreTCJA}
                onChange={(e) => setItemizedDeductions({ mortgagePreTCJA: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">
                Loan originated before December 16, 2017?
                <span className="block text-xs text-gray-500 mt-0.5">
                  Yes → $1,000,000 limit; No → $750,000 limit
                </span>
              </span>
            </label>
            <CurrencyInput
              label="Margin / investment interest (Line 9)"
              value={itemized.investmentInterest}
              onChange={(v) => setItemizedDeductions({ investmentInterest: v })}
              helperText={`Limited to your net investment income (~${formatCurrency(netInvestmentIncome)} for this return)`}
            />
            <CurrencyInput
              label="Prior-year carryforward (Form 4952)"
              value={itemized.priorYearInvestmentInterestCarryforward}
              onChange={(v) => setItemizedDeductions({ priorYearInvestmentInterestCarryforward: v })}
              helperText="Disallowed investment interest expense carried forward from prior tax year(s)"
            />
          </div>

          {/* Charitable Contributions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-800">Charitable Contributions</span>
                <InfoTooltip
                  explanation="Donations to qualifying 501(c)(3) organizations are deductible. Cash contributions are limited to 60% of AGI; non-cash property donations to 30% of AGI (IRC §170(b)). Keep written acknowledgment for any single donation of $250 or more. Non-cash donations over $500 require Form 8283."
                  pubName="IRS Publication 526 — Charitable Contributions"
                  pubUrl="https://www.irs.gov/publications/p526"
                />
                <span className="text-xs text-gray-400">Lines 11–14</span>
              </div>
              {scheduleA && (
                <span className="text-sm font-semibold text-gray-700">
                  {formatCurrency(charitableDeductible)}
                </span>
              )}
            </div>
            <CurrencyInput
              label="Cash / check donations (Line 11)"
              value={itemized.charitableCash}
              onChange={(v) => setItemizedDeductions({ charitableCash: v })}
              helperText={`Limited to 60% of AGI (${formatCurrency(cashAgiLimit)})`}
            />
            <CurrencyInput
              label="Non-cash donations (Line 12)"
              value={itemized.charitableNoncash}
              onChange={(v) => setItemizedDeductions({ charitableNoncash: v })}
              helperText={`Limited to 30% of AGI (${formatCurrency(noncashAgiLimit)})`}
            />
            {scheduleA && (
              <LimitedBadge
                entered={itemized.charitableCash + itemized.charitableNoncash}
                deductible={charitableDeductible}
              />
            )}
          </div>

          {/* Other Deductions — collapsible */}
          <OtherDeductionsSection
            itemized={itemized}
            otherDeductible={otherDeductible}
            scheduleA={!!scheduleA}
            setItemizedDeductions={setItemizedDeductions}
          />
        </div>
      )}

      {/* Comparison */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-md p-4 text-sm">
        {deductions.method === 'itemized' && scheduleA ? (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-gray-600">
                <span>Medical (after 7.5% floor):</span>
                <span className="font-medium text-gray-700">{formatCurrency(medicalDeductible)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>State &amp; Local Taxes (capped):</span>
                <span className="font-medium text-gray-700">{formatCurrency(saltDeductible)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Interest:</span>
                <span className="font-medium text-gray-700">{formatCurrency(interestDeductible)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Charitable:</span>
                <span className="font-medium text-gray-700">{formatCurrency(charitableDeductible)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Other:</span>
                <span className="font-medium text-gray-700">{formatCurrency(otherDeductible)}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between font-semibold text-gray-800">
              <span>Total Itemized:</span>
              <span>{formatCurrency(itemizedTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600 mt-1">
              <span>Standard Deduction:</span>
              <span className="font-medium">{formatCurrency(standardAmount)}</span>
            </div>
            <div className={`mt-2 pt-2 border-t border-gray-200 font-semibold ${standardBetter ? 'text-amber-700' : 'text-emerald-700'}`}>
              {standardBetter
                ? `Standard is better by ${formatCurrency(diff)}`
                : `Itemized is better by ${formatCurrency(diff)}`}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-gray-600">Standard deduction:</span>
              <span className="font-medium">{formatCurrency(standardAmount)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-600">Total itemized:</span>
              <span className="font-medium">{formatCurrency(itemizedTotal)}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 font-medium text-gray-900">
              {standardBetter
                ? `Standard is better by ${formatCurrency(diff)}`
                : `Itemized is better by ${formatCurrency(diff)}`}
            </div>
          </>
        )}
      </div>

      {/* ── Above-the-line adjustments ─────────────────────────── */}
      <h2 className="mt-8 text-lg font-bold text-gray-900">Adjustments to Income</h2>
      <p className="mt-1 text-sm text-gray-600">
        These reduce your AGI regardless of standard or itemized deduction.
      </p>

      <StudentLoanSection />
      <HSASection />

      <InterviewNav interview={interview} />
    </div>
  )
}

// ── Student Loan Interest ──────────────────────────────────

function StudentLoanSection() {
  const filingStatus = useTaxStore((s) => s.taxReturn.filingStatus)
  const studentLoanInterest = useTaxStore((s) => s.taxReturn.studentLoanInterest ?? 0)
  const studentLoanDeduction = useTaxStore((s) => s.computeResult.form1040.studentLoanDeduction)
  const setStudentLoanInterest = useTaxStore((s) => s.setStudentLoanInterest)

  const phaseOut = STUDENT_LOAN_PHASEOUT[filingStatus]
  const isMFS = phaseOut === null

  return (
    <div className={`mt-4 rounded-xl border p-4 flex flex-col gap-3 ${
      isMFS ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-1">
          <span className={`text-sm font-semibold ${isMFS ? 'text-gray-400' : 'text-gray-800'}`}>
            Student Loan Interest
          </span>
          <InfoTooltip
            explanation="Deduct up to $2,500 of interest paid on qualified education loans (Form 1098-E). This is an above-the-line deduction — you can claim it even if you take the standard deduction. The deduction phases out at higher income levels and is not available for Married Filing Separately."
            pubName="IRS Publication 970 — Tax Benefits for Education"
            pubUrl="https://www.irs.gov/publications/p970"
          />
          <span className="text-xs text-gray-400">Schedule 1, Line 21</span>
        </div>
        {studentLoanDeduction && studentLoanDeduction.deductibleAmount > 0 && (
          <span className="text-sm font-semibold text-gray-700">
            {formatCurrency(studentLoanDeduction.deductibleAmount)}
          </span>
        )}
      </div>

      {isMFS ? (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Not available for Married Filing Separately.
        </div>
      ) : (
        <>
          <CurrencyInput
            label="Interest paid (Form 1098-E, Box 1)"
            value={studentLoanInterest}
            onChange={(v) => setStudentLoanInterest(v)}
            helperText={`Maximum deduction: ${formatCurrency(STUDENT_LOAN_DEDUCTION_MAX)}`}
          />
          {studentLoanDeduction && studentLoanDeduction.phaseOutApplies && studentLoanDeduction.deductibleAmount > 0 && (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Phase-out applied — MAGI {formatCurrency(studentLoanDeduction.magi)} is above {formatCurrency(studentLoanDeduction.phaseOutStart)}.
              Deduction reduced to {formatCurrency(studentLoanDeduction.deductibleAmount)}.
            </div>
          )}
          {studentLoanDeduction && studentLoanDeduction.phaseOutApplies && studentLoanDeduction.deductibleAmount === 0 && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Fully phased out — MAGI {formatCurrency(studentLoanDeduction.magi)} exceeds {formatCurrency(studentLoanDeduction.phaseOutEnd)}.
            </div>
          )}
          {phaseOut && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
              Phase-out range: {formatCurrency(phaseOut.start)}–{formatCurrency(phaseOut.end)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── HSA Section ────────────────────────────────────────────

function HSASection() {
  const hsa = useTaxStore((s) => s.taxReturn.hsa)
  const hsaResult = useTaxStore((s) => s.computeResult.form1040.hsaResult)
  const w2s = useTaxStore((s) => s.taxReturn.w2s)
  const setHSA = useTaxStore((s) => s.setHSA)

  const coverageType = hsa?.coverageType ?? 'self-only'
  const contributions = hsa?.contributions ?? 0
  const qualifiedExpenses = hsa?.qualifiedExpenses ?? 0
  const age55OrOlder = hsa?.age55OrOlder ?? false
  const age65OrDisabled = hsa?.age65OrDisabled ?? false

  // Employer contributions from W-2 Box 12 code W
  let employerContributions = 0
  for (const w2 of w2s) {
    for (const entry of w2.box12) {
      if (entry.code === 'W') employerContributions += entry.amount
    }
  }

  const limit = coverageType === 'family' ? HSA_LIMIT_FAMILY : HSA_LIMIT_SELF_ONLY
  const catchUp = age55OrOlder ? HSA_CATCHUP_AMOUNT : 0
  const totalLimit = limit + catchUp

  return (
    <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-gray-800">Health Savings Account</span>
          <InfoTooltip
            explanation="Contributions to an HSA are an above-the-line deduction. Employer contributions (W-2 Box 12 code W) count toward the limit but are not deductible by you. Non-qualified distributions are taxable and subject to a 20% penalty unless you are age 65+ or disabled."
            pubName="IRS Form 8889 — Health Savings Accounts"
            pubUrl="https://www.irs.gov/forms-pubs/about-form-8889"
          />
          <span className="text-xs text-gray-400">Form 8889</span>
        </div>
        {hsaResult && hsaResult.deductibleAmount > 0 && (
          <span className="text-sm font-semibold text-gray-700">
            {formatCurrency(hsaResult.deductibleAmount)}
          </span>
        )}
      </div>

      {/* Coverage type */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Coverage type</label>
        <select
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
          value={coverageType}
          onChange={(e) => setHSA({ coverageType: e.target.value as 'self-only' | 'family' })}
        >
          <option value="self-only">Self-only ({formatCurrency(HSA_LIMIT_SELF_ONLY)} limit)</option>
          <option value="family">Family ({formatCurrency(HSA_LIMIT_FAMILY)} limit)</option>
        </select>
      </div>

      {/* Contributions */}
      <CurrencyInput
        label="Your HSA contributions"
        value={contributions}
        onChange={(v) => setHSA({ contributions: v })}
        helperText={`Limit: ${formatCurrency(totalLimit)}${catchUp > 0 ? ` (includes ${formatCurrency(HSA_CATCHUP_AMOUNT)} catch-up)` : ''}`}
      />

      {employerContributions > 0 && (
        <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
          Employer HSA contributions (W-2 code W): {formatCurrency(employerContributions)} — counts toward limit, not deductible by you
        </div>
      )}

      {/* Qualified expenses */}
      <CurrencyInput
        label="Qualified medical expenses paid from HSA"
        value={qualifiedExpenses}
        onChange={(v) => setHSA({ qualifiedExpenses: v })}
        helperText="Distributions used for qualified expenses are tax-free"
      />

      {/* Age flags */}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={age55OrOlder}
          onChange={(e) => setHSA({ age55OrOlder: e.target.checked })}
          className="rounded border-gray-300"
        />
        Age 55 or older (extra {formatCurrency(HSA_CATCHUP_AMOUNT)} catch-up contribution)
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={age65OrDisabled}
          onChange={(e) => setHSA({ age65OrDisabled: e.target.checked })}
          className="rounded border-gray-300"
        />
        Age 65+ or disabled (exempt from 20% distribution penalty)
      </label>

      {/* Result details */}
      {hsaResult && hsaResult.deductibleAmount > 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
          HSA deduction: {formatCurrency(hsaResult.deductibleAmount)}
          {hsaResult.excessContributions > 0 && ` · Excess: ${formatCurrency(hsaResult.excessContributions)}`}
        </div>
      )}
      {hsaResult && hsaResult.taxableDistributions > 0 && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Taxable distributions: {formatCurrency(hsaResult.taxableDistributions)}
          {hsaResult.distributionPenalty > 0 && ` + ${formatCurrency(hsaResult.distributionPenalty)} penalty (20%)`}
        </div>
      )}
      {hsaResult && hsaResult.excessPenalty > 0 && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          Excess contribution penalty (6%): {formatCurrency(hsaResult.excessPenalty)}
        </div>
      )}
    </div>
  )
}

// ── Other Deductions (collapsible) ──────────────────────────

function OtherDeductionsSection({
  itemized,
  otherDeductible,
  scheduleA,
  setItemizedDeductions,
}: {
  itemized: ItemizedDeductions
  otherDeductible: number
  scheduleA: boolean
  setItemizedDeductions: (updates: Partial<ItemizedDeductions>) => void
}) {
  const [collapsed, setCollapsed] = useState(true)

  const otherTotal =
    itemized.gamblingLosses +
    itemized.casualtyTheftLosses +
    itemized.federalEstateTaxIRD +
    itemized.otherMiscDeductions

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between gap-2 p-4 w-full text-left"
      >
        <div className="flex items-center gap-1">
          <svg
            className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-gray-800">Other Deductions</span>
          <InfoTooltip
            explanation="Includes gambling losses (limited to gambling winnings reported on Schedule 1), casualty and theft losses from federally declared disaster areas (Form 4684), federal estate tax on income in respect of a decedent (IRC §691(c)), and certain other deductions listed in the Schedule A instructions."
            pubName="IRS Schedule A Instructions — Other Itemized Deductions (Line 16)"
            pubUrl="https://www.irs.gov/instructions/i1040sca"
          />
          <span className="text-xs text-gray-400">Line 16</span>
        </div>
        <span className="text-sm font-semibold text-gray-700">
          {formatCurrency(scheduleA ? otherDeductible : otherTotal)}
        </span>
      </button>

      {/* Expanded detail fields */}
      {!collapsed && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-100 pt-3">
          <CurrencyInput
            label="Gambling losses"
            value={itemized.gamblingLosses}
            onChange={(v) => setItemizedDeductions({ gamblingLosses: v })}
            helperText="Cannot exceed gambling winnings reported as income"
          />
          <CurrencyInput
            label="Casualty & theft losses"
            value={itemized.casualtyTheftLosses}
            onChange={(v) => setItemizedDeductions({ casualtyTheftLosses: v })}
            helperText="Form 4684 — only for federally declared disaster areas"
          />
          <CurrencyInput
            label="Federal estate tax on IRD"
            value={itemized.federalEstateTaxIRD}
            onChange={(v) => setItemizedDeductions({ federalEstateTaxIRD: v })}
            helperText="IRC §691(c) — estate tax attributable to income in respect of a decedent"
          />
          <CurrencyInput
            label="Other miscellaneous deductions"
            value={itemized.otherMiscDeductions}
            onChange={(v) => setItemizedDeductions({ otherMiscDeductions: v })}
            helperText="See Schedule A instructions for qualifying deductions"
          />
        </div>
      )}
    </div>
  )
}
