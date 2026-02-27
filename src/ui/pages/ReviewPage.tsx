import { Link } from 'react-router-dom'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { FederalValidationItem } from '../../rules/2025/federalValidation.ts'

function formatCurrency(cents: number): string {
  const d = Math.abs(cents) / 100
  const formatted = d.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return cents < 0 ? `-${formatted}` : formatted
}

function maskSSN(ssn: string): string {
  if (ssn.length < 4) return ssn
  return `***-**-${ssn.slice(-4)}`
}

interface LineItemProps {
  label: string
  nodeId: string
  amount: number
  tooltip?: { explanation: string; pubName: string; pubUrl: string }
}

function LineItem({ label, nodeId, amount, tooltip }: LineItemProps) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:gap-3 py-1.5 sm:py-1">
      <span className="text-sm text-gray-700 min-w-0 inline-flex items-center flex-wrap">
        <span className="break-words">{label}</span>
        {tooltip && <InfoTooltip {...tooltip} />}
      </span>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <span className="text-sm font-medium tabular-nums">{formatCurrency(amount)}</span>
        <Link
          to={`/explain/${nodeId}`}
          className="inline-flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent"
          title="Why this number?"
        >
          ?
        </Link>
      </div>
    </div>
  )
}

function ValidationAlert({ item }: { item: FederalValidationItem }) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  const icons = {
    error: '!',
    warning: '!',
    info: 'i',
  }
  const iconBg = {
    error: 'bg-red-200 text-red-700',
    warning: 'bg-amber-200 text-amber-700',
    info: 'bg-blue-200 text-blue-700',
  }

  return (
    <div data-testid={`validation-${item.code}`} className={`border rounded-md px-3 py-2 ${styles[item.severity]}`}>
      <div className="flex gap-2 items-start">
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 mt-0.5 ${iconBg[item.severity]}`}>
          {icons[item.severity]}
        </span>
        <div className="min-w-0">
          <p className="text-xs leading-relaxed">{item.message}</p>
          {item.irsCitation && (
            <p className="text-xs opacity-70 mt-1">Ref: {item.irsCitation}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function ReviewPage() {
  const taxReturn = useTaxStore((s) => s.taxReturn)
  const form1040 = useTaxStore((s) => s.computeResult.form1040)
  const form1040NR = useTaxStore((s) => s.computeResult.form1040NR)
  const executedSchedules = useTaxStore((s) => s.computeResult.executedSchedules)
  const stateResults = useTaxStore((s) => s.computeResult.stateResults)
  const interview = useInterview()

  const isNRA = taxReturn.isNonresidentAlien === true
  const validation = form1040.validation
  const errors = validation?.items.filter(i => i.severity === 'error') ?? []
  const warnings = validation?.items.filter(i => i.severity === 'warning') ?? []
  const infos = validation?.items.filter(i => i.severity === 'info') ?? []

  const has1099NEC = (taxReturn.form1099NECs ?? []).length > 0
  const hasScheduleC = taxReturn.scheduleCBusinesses.length > 0
  const hasScheduleE = taxReturn.scheduleEProperties.length > 0
  const hasPALLimitation = form1040.form8582Result?.required === true
  const hasK1 = taxReturn.scheduleK1s.length > 0
  const has1095A = taxReturn.form1095As.length > 0

  const FILING_STATUS_LABELS: Record<string, string> = {
    single: 'Single',
    mfj: 'Married Filing Jointly',
    mfs: 'Married Filing Separately',
    hoh: 'Head of Household',
    qw: 'Qualifying Surviving Spouse',
  }

  // If NRA, render a specialized review page
  if (isNRA && form1040NR) {
    return (
      <div data-testid="page-review" className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">Review Your Return</h1>
        <p className="mt-1 text-sm text-gray-600">
          Form 1040-NR — U.S. Nonresident Alien Income Tax Return
        </p>

        {/* NRA badge */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-blue-800">Form 1040-NR</span>
            {taxReturn.nraInfo?.treatyCountry && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Treaty: {taxReturn.nraInfo.treatyCountry}
              </span>
            )}
          </div>
          <p className="text-xs text-blue-700 mt-1">
            Country: {taxReturn.nraInfo?.countryOfResidence || 'Not specified'}
            {taxReturn.nraInfo?.visaType && ` | Visa: ${taxReturn.nraInfo.visaType}`}
          </p>
        </div>

        {/* Filing info */}
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex justify-between gap-2 text-sm">
            <span className="text-gray-600 shrink-0">Filing Status:</span>
            <span className="font-medium">{FILING_STATUS_LABELS[taxReturn.filingStatus]}</span>
          </div>
          <div className="flex justify-between gap-2 text-sm">
            <span className="text-gray-600 shrink-0">Taxpayer:</span>
            <span className="font-medium truncate">
              {taxReturn.taxpayer.firstName} {taxReturn.taxpayer.lastName}
              {taxReturn.taxpayer.ssn && ` (${maskSSN(taxReturn.taxpayer.ssn)})`}
            </span>
          </div>
        </div>

        {/* ECI Income */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
            Effectively Connected Income (ECI)
          </h2>
          <div className="mt-2 flex flex-col">
            <LineItem label="Wages" nodeId="form1040nr.eciWages" amount={form1040NR.eciWages.amount} />
            {form1040NR.eciInterest.amount > 0 && (
              <LineItem label="Interest (ECI)" nodeId="form1040nr.eciInterest" amount={form1040NR.eciInterest.amount} />
            )}
            {form1040NR.eciDividends.amount > 0 && (
              <LineItem label="Dividends (ECI)" nodeId="form1040nr.eciDividends" amount={form1040NR.eciDividends.amount} />
            )}
            {form1040NR.eciCapitalGains.amount !== 0 && (
              <LineItem label="Capital gains/losses" nodeId="form1040nr.eciCapitalGains" amount={form1040NR.eciCapitalGains.amount} />
            )}
            {form1040NR.eciBusinessIncome.amount !== 0 && (
              <LineItem label="Business income" nodeId="form1040nr.eciBusinessIncome" amount={form1040NR.eciBusinessIncome.amount} />
            )}
            {(form1040NR.eciRetirement?.amount ?? 0) > 0 && (
              <LineItem label="Retirement income (ECI)" nodeId="form1040nr.eciRetirement" amount={form1040NR.eciRetirement?.amount ?? 0} />
            )}
            {(form1040NR.eciRentalIncome?.amount ?? 0) !== 0 && (
              <LineItem label="Rental income (ECI)" nodeId="form1040nr.eciRentalIncome" amount={form1040NR.eciRentalIncome?.amount ?? 0} />
            )}
            {form1040NR.eciScholarship.amount > 0 && (
              <LineItem label="Scholarship income" nodeId="form1040nr.eciScholarship" amount={form1040NR.eciScholarship.amount} />
            )}
            {form1040NR.eciOtherIncome.amount > 0 && (
              <LineItem label="Other ECI" nodeId="form1040nr.eciOtherIncome" amount={form1040NR.eciOtherIncome.amount} />
            )}
            {(form1040NR.ssaBenefits?.amount ?? 0) > 0 && (
              <div className="flex flex-col">
                <LineItem label="Social Security benefits" nodeId="form1040nr.ssaBenefits" amount={form1040NR.ssaBenefits?.amount ?? 0} />
                {taxReturn.nraInfo?.socialSecurityTreatyExempt && taxReturn.nraInfo?.treatyCountry && (
                  <p className="text-xs text-blue-700 ml-1 -mt-1 mb-1">
                    (Exempt under US-{taxReturn.nraInfo.treatyCountry} treaty)
                  </p>
                )}
              </div>
            )}
            {form1040NR.treatyExemption.amount > 0 && (
              <LineItem label="Treaty exempt income" nodeId="form1040nr.treatyExemption" amount={-form1040NR.treatyExemption.amount} />
            )}
            <LineItem label="Total ECI" nodeId="form1040nr.totalECI" amount={form1040NR.totalECI.amount} />
          </div>
        </section>

        {/* Deductions */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
            Deductions & AGI
          </h2>
          <div className="mt-2 flex flex-col">
            {form1040NR.adjustments.amount > 0 && (
              <LineItem label="Adjustments" nodeId="form1040nr.adjustments" amount={form1040NR.adjustments.amount} />
            )}
            <LineItem label="AGI" nodeId="form1040nr.agi" amount={form1040NR.agi.amount} />
            <LineItem label="Itemized deductions" nodeId="form1040nr.deductions" amount={form1040NR.deductions.amount} />
            <LineItem label="Taxable income" nodeId="form1040nr.taxableIncome" amount={form1040NR.taxableIncome.amount} />
          </div>
        </section>

        {/* ECI Tax */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
            Tax on ECI (Graduated Rates)
          </h2>
          <div className="mt-2 flex flex-col">
            <LineItem label="Tax on ECI" nodeId="form1040nr.eciTax" amount={form1040NR.eciTax.amount} />
          </div>
        </section>

        {/* Credits */}
        {(form1040NR.creditTotal?.amount ?? 0) > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
              Credits
            </h2>
            <div className="mt-2 flex flex-col">
              {(form1040NR.foreignTaxCredit?.amount ?? 0) > 0 && (
                <LineItem label="Foreign tax credit" nodeId="form1040nr.foreignTaxCredit" amount={form1040NR.foreignTaxCredit?.amount ?? 0} />
              )}
              {(form1040NR.childTaxCredit?.amount ?? 0) > 0 && (
                <LineItem label="Child tax credit" nodeId="form1040nr.childTaxCredit" amount={form1040NR.childTaxCredit?.amount ?? 0} />
              )}
              <LineItem label="Total credits" nodeId="form1040nr.creditTotal" amount={form1040NR.creditTotal?.amount ?? 0} />
            </div>
          </section>
        )}

        {/* FDAP Income */}
        {form1040NR.totalFDAP.amount > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
              FDAP Income (Schedule NEC — {(form1040NR.fdapTaxRate * 100).toFixed(0)}% Rate)
            </h2>
            <div className="mt-2 flex flex-col">
              {form1040NR.fdapDividends.amount > 0 && (
                <LineItem label="FDAP Dividends" nodeId="form1040nr.fdapDividends" amount={form1040NR.fdapDividends.amount} />
              )}
              {form1040NR.fdapInterest.amount > 0 && (
                <LineItem label="FDAP Interest" nodeId="form1040nr.fdapInterest" amount={form1040NR.fdapInterest.amount} />
              )}
              {form1040NR.fdapRoyalties.amount > 0 && (
                <LineItem label="FDAP Royalties" nodeId="form1040nr.fdapRoyalties" amount={form1040NR.fdapRoyalties.amount} />
              )}
              {form1040NR.fdapOther.amount > 0 && (
                <LineItem label="FDAP Other" nodeId="form1040nr.fdapOther" amount={form1040NR.fdapOther.amount} />
              )}
              {(form1040NR.fdapRetirement?.amount ?? 0) > 0 && (
                <LineItem label="FDAP Retirement" nodeId="form1040nr.fdapRetirement" amount={form1040NR.fdapRetirement?.amount ?? 0} />
              )}
              {(form1040NR.fdapRentalIncome?.amount ?? 0) > 0 && (
                <LineItem label="FDAP Rental" nodeId="form1040nr.fdapRentalIncome" amount={form1040NR.fdapRentalIncome?.amount ?? 0} />
              )}
              {(form1040NR.fdapSocialSecurity?.amount ?? 0) > 0 && (
                <LineItem label="FDAP Social Security (85%)" nodeId="form1040nr.fdapSocialSecurity" amount={form1040NR.fdapSocialSecurity?.amount ?? 0} />
              )}
              <LineItem label="Total FDAP" nodeId="form1040nr.totalFDAP" amount={form1040NR.totalFDAP.amount} />
              <LineItem label="Tax on FDAP" nodeId="form1040nr.fdapTax" amount={form1040NR.fdapTax.amount} />
            </div>
          </section>
        )}

        {/* Tax & Payments */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
            Tax & Payments
          </h2>
          <div className="mt-2 flex flex-col">
            <LineItem label="Total tax" nodeId="form1040nr.totalTax" amount={form1040NR.totalTax.amount} />
            {(form1040NR.creditTotal?.amount ?? 0) > 0 && (
              <p className="text-xs text-green-700 ml-1 -mt-1 mb-1">
                (After {formatCurrency(form1040NR.creditTotal?.amount ?? 0)} in credits applied)
              </p>
            )}
            <LineItem label="Federal tax withheld" nodeId="form1040nr.withheld" amount={form1040NR.withheld.amount} />
            {form1040NR.estimatedPayments.amount > 0 && (
              <LineItem label="Estimated payments" nodeId="form1040nr.estimatedPayments" amount={form1040NR.estimatedPayments.amount} />
            )}
            <LineItem label="Total payments" nodeId="form1040nr.totalPayments" amount={form1040NR.totalPayments.amount} />
          </div>
        </section>

        {/* Result */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
            Result
          </h2>
          <div className="mt-2 flex flex-col">
            {form1040NR.refund.amount > 0 && (
              <div className="flex items-center justify-between gap-2 py-1.5 sm:py-1">
                <span className="text-sm font-medium text-tax-green">Refund</span>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <span className="text-base sm:text-lg font-bold text-tax-green tabular-nums">
                    {formatCurrency(form1040NR.refund.amount)}
                  </span>
                  <Link to="/explain/form1040nr.refund" className="inline-flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent">?</Link>
                </div>
              </div>
            )}
            {form1040NR.amountOwed.amount > 0 && (
              <div className="flex items-center justify-between gap-2 py-1.5 sm:py-1">
                <span className="text-sm font-medium text-tax-red">Amount you owe</span>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <span className="text-base sm:text-lg font-bold text-tax-red tabular-nums">
                    {formatCurrency(form1040NR.amountOwed.amount)}
                  </span>
                  <Link to="/explain/form1040nr.amountOwed" className="inline-flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent">?</Link>
                </div>
              </div>
            )}
            {form1040NR.refund.amount === 0 && form1040NR.amountOwed.amount === 0 && (
              <div className="py-1 text-sm text-gray-500">Tax balance: $0.00</div>
            )}
          </div>
        </section>

        {/* State return links */}
        {stateResults.length > 0 && stateResults.map(sr => {
          const isRefund = sr.overpaid > 0
          const isOwed = sr.amountOwed > 0
          const statusLabel = isRefund ? 'Refund' : isOwed ? 'Amount Owed' : 'Balanced'
          const statusAmount = isRefund ? sr.overpaid : isOwed ? sr.amountOwed : 0
          const statusColor = isRefund ? 'text-tax-green' : isOwed ? 'text-tax-red' : 'text-gray-500'
          const borderColor = isRefund ? 'border-emerald-200' : isOwed ? 'border-red-200' : 'border-amber-200'
          const bgColor = isRefund ? 'bg-emerald-50/50' : isOwed ? 'bg-red-50/50' : 'bg-amber-50/50'
          return (
            <div key={sr.stateCode} className={`mt-6 border ${borderColor} ${bgColor} rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
              <div>
                <span className="text-sm font-semibold text-gray-800">{sr.formLabel}</span>
                <div className={`text-sm font-semibold ${statusColor} mt-1`}>
                  {statusLabel}{statusAmount > 0 ? `: ${formatCurrency(statusAmount)}` : ''}
                </div>
              </div>
              <Link to={`/interview/state-review-${sr.stateCode}`} className="text-sm font-medium text-brand hover:text-blue-700 underline underline-offset-2 shrink-0">
                View {sr.stateCode} Return
              </Link>
            </div>
          )
        })}

        {executedSchedules.length > 0 && (
          <div className="mt-4 text-xs text-gray-500">
            Schedules included: {executedSchedules.join(', ')}
          </div>
        )}

        <InterviewNav interview={interview} />
      </div>
    )
  }

  return (
    <div data-testid="page-review" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Review Your Return</h1>
      <p className="mt-1 text-sm text-gray-600">
        Review your tax return summary. Click [?] to see how any number was calculated.
      </p>

      {/* Validation Errors — blocking issues at top */}
      {errors.length > 0 && (
        <section data-testid="validation-errors" className="mt-4 flex flex-col gap-2">
          {errors.map((item) => (
            <ValidationAlert key={item.code} item={item} />
          ))}
        </section>
      )}

      {/* Validation Warnings */}
      {warnings.length > 0 && (
        <section data-testid="validation-warnings" className="mt-4 flex flex-col gap-2">
          {warnings.map((item) => (
            <ValidationAlert key={item.code} item={item} />
          ))}
        </section>
      )}

      {/* Filing info */}
      <div className="mt-6 flex flex-col gap-2">
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-gray-600 shrink-0">Filing Status:</span>
          <div className="flex items-center gap-2 justify-end">
            <span className="font-medium text-right">{FILING_STATUS_LABELS[taxReturn.filingStatus]}</span>
            <Link to="/interview/filing-status" className="text-xs text-tax-blue hover:text-blue-700 py-2 -my-2 px-2 -mx-1 sm:py-0 sm:-my-0 sm:px-0 sm:-mx-0">
              Edit
            </Link>
          </div>
        </div>
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-gray-600 shrink-0">Taxpayer:</span>
          <div className="flex items-center gap-2 justify-end min-w-0">
            <span className="font-medium text-right truncate">
              {taxReturn.taxpayer.firstName} {taxReturn.taxpayer.lastName}
              {taxReturn.taxpayer.ssn && ` (${maskSSN(taxReturn.taxpayer.ssn)})`}
            </span>
            <Link to="/interview/personal-info" className="text-xs text-tax-blue hover:text-blue-700 py-2 -my-2 px-2 -mx-1 sm:py-0 sm:-my-0 sm:px-0 sm:-mx-0">
              Edit
            </Link>
          </div>
        </div>
      </div>

      {/* Income */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
          Income
        </h2>
        <div className="mt-2 flex flex-col">
          <LineItem
            label="Line 1a — Wages"
            nodeId="form1040.line1a"
            amount={form1040.line1a.amount}
            tooltip={{
              explanation: 'Line 1a is the sum of all W-2 Box 1 wages, salaries, tips, and other compensation. RSU income, severance pay, and taxable fringe benefits are all included here. This flows directly from your W-2 forms.',
              pubName: 'IRS Form 1040 Instructions — Line 1a',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
          <LineItem
            label="Line 2b — Taxable interest"
            nodeId="form1040.line2b"
            amount={form1040.line2b.amount}
            tooltip={{
              explanation: 'Line 2b is total taxable interest from Form(s) 1099-INT Box 1 and Box 3. Tax-exempt interest (Box 8) is reported on Line 2a but not included in taxable income.',
              pubName: 'IRS Form 1040 Instructions — Line 2b',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
          <LineItem
            label="Line 3b — Ordinary dividends"
            nodeId="form1040.line3b"
            amount={form1040.line3b.amount}
            tooltip={{
              explanation: 'Line 3b is total ordinary dividends from Form(s) 1099-DIV Box 1a. Qualified dividends (Box 1b) are a subset taxed at preferential rates — they are tracked on Line 3a and reduce your tax via the Qualified Dividends and Capital Gain Tax Worksheet.',
              pubName: 'IRS Form 1040 Instructions — Line 3b',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
          <LineItem
            label="Line 7 — Capital gain/loss"
            nodeId="form1040.line7"
            amount={form1040.line7.amount}
            tooltip={{
              explanation: 'Line 7 comes from Schedule D. Net capital losses are limited to $3,000 per year ($1,500 if MFS); unused losses carry forward to future years. Long-term gains and qualified dividends are taxed at preferential rates via the QDCGT Worksheet.',
              pubName: 'IRS Form 1040 Instructions — Line 7 / Schedule D',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
          {form1040.line8.amount !== 0 && (
            <LineItem
              label="Line 8 — Other income"
              nodeId="form1040.line8"
              amount={form1040.line8.amount}
              tooltip={{
                explanation: 'Line 8 includes additional income from Schedule 1: business income (Schedule C), rental income (Schedule E), unemployment, alimony received, and other income sources. This is the net of all Schedule 1 Part I items.',
                pubName: 'IRS Form 1040 Instructions — Line 8',
                pubUrl: 'https://www.irs.gov/instructions/i1040gi',
              }}
            />
          )}
          <LineItem
            label="Line 9 — Total income"
            nodeId="form1040.line9"
            amount={form1040.line9.amount}
            tooltip={{
              explanation: 'Line 9 is the sum of Lines 1z through 8 — your gross income before any adjustments. It includes wages, interest, dividends, capital gains, business income (Schedule C), retirement distributions, and other income from Schedule 1.',
              pubName: 'IRS Form 1040 Instructions — Line 9',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
        </div>
      </section>

      {/* Schedule Summaries — after income, before deductions */}
      {(has1099NEC || hasScheduleC || hasScheduleE || hasK1 || has1095A) && (
        <section className="mt-4 flex flex-col gap-2">
          {has1099NEC && (
            <div data-testid="review-1099-nec" className="border border-gray-200 rounded-md px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-800">1099-NEC — Nonemployee Compensation</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(taxReturn.form1099NECs ?? []).length} form{(taxReturn.form1099NECs ?? []).length > 1 ? 's' : ''} reported. Income flows to Schedule 1 Line 3 as self-employment income. SE tax computed on Schedule SE.
                </p>
              </div>
              <Link
                to="/interview/form-1099-nec"
                className="text-xs text-tax-blue hover:text-blue-700 shrink-0 py-2 sm:py-0"
              >
                Edit
              </Link>
            </div>
          )}
          {hasScheduleE && (
            <div data-testid="review-schedule-e" className={`border rounded-md px-3 py-2 flex flex-col gap-1 ${hasPALLimitation ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-800">Schedule E — Rental Real Estate</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {taxReturn.scheduleEProperties.length} rental propert{taxReturn.scheduleEProperties.length > 1 ? 'ies' : 'y'} reported.
                    {form1040.scheduleE && ` Net: ${formatCurrency(form1040.scheduleE.line23a.amount)}.`}
                    {form1040.scheduleE && form1040.scheduleE.line26.amount !== form1040.scheduleE.line23a.amount && ` Allowed: ${formatCurrency(form1040.scheduleE.line26.amount)}.`}
                  </p>
                </div>
                <Link
                  to="/interview/schedule-e"
                  className="text-xs text-tax-blue hover:text-blue-700 shrink-0 py-2 sm:py-0"
                >
                  Edit
                </Link>
              </div>
              {hasPALLimitation && form1040.form8582Result && (
                <div className="text-xs text-amber-800 border-t border-amber-200 pt-1 mt-1">
                  <span className="font-medium">Passive Activity Loss Limitation (Form 8582):</span>{' '}
                  Your {formatCurrency(Math.abs(form1040.form8582Result.totalNetPassiveActivity))} rental loss is limited to{' '}
                  {formatCurrency(form1040.form8582Result.allowableLoss)} by the IRC &sect;469 special allowance.
                  {form1040.form8582Result.suspendedLoss > 0 && (
                    <> {formatCurrency(form1040.form8582Result.suspendedLoss)} is suspended and carries forward to future years.</>
                  )}
                </div>
              )}
            </div>
          )}
          {hasScheduleC && (
            <div data-testid="review-schedule-c" className="border border-gray-200 rounded-md px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-800">Schedule C — Business Income</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  {taxReturn.scheduleCBusinesses.length} business{taxReturn.scheduleCBusinesses.length > 1 ? 'es' : ''} reported. Net profit flows to Schedule 1 Line 3. SE tax computed on Schedule SE.
                </p>
              </div>
              <Link
                to="/interview/schedule-c"
                className="text-xs text-tax-blue hover:text-blue-700 shrink-0 py-2 sm:py-0"
              >
                Edit
              </Link>
            </div>
          )}
          {hasK1 && (
            <div data-testid="review-schedule-k1" className="border border-red-200 bg-red-50/50 rounded-md px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-sm font-medium text-red-800">Schedule K-1 — Not Computed</span>
                <p className="text-xs text-red-700 mt-0.5">
                  {taxReturn.scheduleK1s.length} K-1 form{taxReturn.scheduleK1s.length > 1 ? 's' : ''} captured. Income is NOT included in this return. Do not file without professional review.
                </p>
              </div>
              <Link
                to="/interview/schedule-k1"
                className="text-xs text-tax-blue hover:text-blue-700 shrink-0 py-2 sm:py-0"
              >
                Edit
              </Link>
            </div>
          )}
          {has1095A && (
            <div data-testid="review-1095a" className="border border-gray-200 rounded-md px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-800">Form 1095-A / PTC (Form 8962)</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  {taxReturn.form1095As.length} marketplace statement{taxReturn.form1095As.length > 1 ? 's' : ''}. Premium Tax Credit reconciliation computed on Form 8962.
                </p>
              </div>
              <Link
                to="/interview/form-1095a"
                className="text-xs text-tax-blue hover:text-blue-700 shrink-0 py-2 sm:py-0"
              >
                Edit
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Deductions */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
          Deductions
        </h2>
        <div className="mt-2 flex flex-col">
          {form1040.line10.amount > 0 && (
            <LineItem
              label="Line 10 — Adjustments"
              nodeId="form1040.line10"
              amount={form1040.line10.amount}
              tooltip={{
                explanation: 'Line 10 is the total of above-the-line adjustments from Schedule 1 Part II. These include the Traditional IRA deduction, student loan interest, educator expenses, HSA contributions, and the deductible half of self-employment tax. These adjustments reduce your total income to arrive at AGI.',
                pubName: 'IRS Form 1040 Instructions — Line 10',
                pubUrl: 'https://www.irs.gov/instructions/i1040gi',
              }}
            />
          )}
          <LineItem
            label="Line 11 — AGI"
            nodeId="form1040.line11"
            amount={form1040.line11.amount}
            tooltip={{
              explanation: 'Adjusted Gross Income (AGI) is Total Income minus above-the-line deductions from Schedule 1 Part II (student loan interest, educator expenses, HSA contributions, self-employment tax deduction, etc.). AGI is the baseline for many phase-outs such as the 7.5% medical floor and the SALT cap phase-out.',
              pubName: 'IRS Form 1040 Instructions — Line 11 (AGI)',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
          <LineItem
            label="Line 12 — Deductions"
            nodeId="form1040.line12"
            amount={form1040.line12.amount}
            tooltip={{
              explanation: 'Line 12 is the greater of your standard deduction or itemized deductions (Schedule A Line 17). For 2025: $15,750 (Single), $31,500 (MFJ), $23,625 (HOH), $15,750 (MFS). Additional amounts apply if you are 65 or older or blind.',
              pubName: 'IRS Form 1040 Instructions — Line 12',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
          {form1040.line13.amount > 0 && (
            <LineItem
              label="Line 13 — QBI deduction"
              nodeId="form1040.line13"
              amount={form1040.line13.amount}
              tooltip={{
                explanation: 'Line 13 is the Qualified Business Income (QBI) deduction under IRC §199A. For below-threshold taxpayers, this is 20% of qualified business income from Schedule C and/or K-1 Section 199A amounts, limited to 20% of taxable income before the QBI deduction. Above-threshold limitations are not yet supported.',
                pubName: 'Form 8995 / IRC §199A',
                pubUrl: 'https://www.irs.gov/forms-pubs/about-form-8995',
              }}
            />
          )}
          <LineItem
            label="Line 15 — Taxable income"
            nodeId="form1040.line15"
            amount={form1040.line15.amount}
            tooltip={{
              explanation: 'Taxable income is AGI minus your deductions (Line 12) and the qualified business income deduction (Line 13, if applicable). This is the base on which your income tax is calculated using the tax brackets or the Qualified Dividends and Capital Gain Tax Worksheet.',
              pubName: 'IRS Form 1040 Instructions — Line 15',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
        </div>
      </section>

      {/* Tax & Payments */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
          Tax & Payments
        </h2>
        <div className="mt-2 flex flex-col">
          <LineItem
            label="Line 16 — Tax"
            nodeId="form1040.line16"
            amount={form1040.line16.amount}
            tooltip={{
              explanation: 'Line 16 is your regular income tax from the tax tables or rate schedules (or the QDCGT Worksheet if you have qualified dividends or long-term capital gains). It does not include the Net Investment Income Tax (NIIT), self-employment tax, or AMT — those appear on Schedule 2.',
              pubName: 'IRS Form 1040 Instructions — Line 16',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
          {form1040.line19.amount > 0 && (
            <LineItem
              label="Line 19 — Child tax credit"
              nodeId="form1040.line19"
              amount={form1040.line19.amount}
              tooltip={{
                explanation: 'Line 19 is the non-refundable Child Tax Credit ($2,000 per qualifying child under 17) plus the Credit for Other Dependents ($500 per other dependent). This credit directly reduces your tax but cannot reduce it below zero. Any excess may be claimed as the refundable Additional Child Tax Credit on Line 28.',
                pubName: 'IRS Schedule 8812 — Child Tax Credit',
                pubUrl: 'https://www.irs.gov/instructions/i1040s8',
              }}
            />
          )}
          {form1040.line20.amount > 0 && (
            <LineItem
              label="Line 20 — Other credits"
              nodeId="form1040.line20"
              amount={form1040.line20.amount}
              tooltip={{
                explanation: 'Line 20 is other non-refundable credits from Schedule 3, including the Dependent Care Credit (Form 2441), Saver\'s Credit (Form 8880), and Residential Energy Credits (Form 5695). These credits reduce your tax liability but cannot reduce it below zero.',
                pubName: 'IRS Form 1040 Instructions — Line 20',
                pubUrl: 'https://www.irs.gov/instructions/i1040gi',
              }}
            />
          )}
          {form1040.line23.amount > 0 && (
            <LineItem
              label="Line 23 — Other taxes"
              nodeId="form1040.line23"
              amount={form1040.line23.amount}
              tooltip={{
                explanation: 'Line 23 includes additional taxes from Schedule 2, Part II: self-employment tax (Schedule SE), the Net Investment Income Tax (3.8% surtax, Form 8960), Additional Medicare Tax (0.9% on high wages, Form 8959), early withdrawal penalties (Form 5329), HSA penalties, and excess advance PTC repayment (Form 8962).',
                pubName: 'IRS Schedule 2 — Additional Taxes',
                pubUrl: 'https://www.irs.gov/forms-pubs/about-schedule-2-form-1040',
              }}
            />
          )}
          <LineItem
            label="Line 24 — Total tax"
            nodeId="form1040.line24"
            amount={form1040.line24.amount}
            tooltip={{
              explanation: 'Line 24 is your total tax liability including regular income tax (Line 16), self-employment tax, the Net Investment Income Tax (Form 8960), the Additional Medicare Tax (Form 8959), and any other taxes from Schedule 2. This is your total federal tax before payments and credits.',
              pubName: 'IRS Form 1040 Instructions — Line 24',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
          <LineItem
            label="Line 25 — Withheld"
            nodeId="form1040.line25"
            amount={form1040.line25.amount}
            tooltip={{
              explanation: 'Line 25 is federal income tax withheld from your W-2 Box 2 and 1099 forms. This is tax you already paid during the year through payroll withholding. If withholding exceeds your total tax (Line 24), you receive a refund for the difference.',
              pubName: 'IRS Form 1040 Instructions — Line 25',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
          {form1040.line26.amount > 0 && (
            <LineItem
              label="Line 26 — Estimated tax payments"
              nodeId="form1040.line26"
              amount={form1040.line26.amount}
              tooltip={{
                explanation: 'Line 26 is the total of your quarterly estimated tax payments (Form 1040-ES) made during the tax year. These payments reduce the amount you owe or increase your refund.',
                pubName: 'IRS Form 1040-ES',
                pubUrl: 'https://www.irs.gov/forms-pubs/about-form-1040-es',
              }}
            />
          )}
          {form1040.line27.amount > 0 && (
            <LineItem
              label="Line 27 — Earned income credit"
              nodeId="form1040.line27"
              amount={form1040.line27.amount}
              tooltip={{
                explanation: 'Line 27 is the Earned Income Credit (EITC). It is computed as a piecewise linear function at both earned income and AGI, taking the smaller result. The EITC is a refundable credit — it can increase your refund even if you owe no tax.',
                pubName: 'IRS Pub 596 — Earned Income Credit',
                pubUrl: 'https://www.irs.gov/publications/p596',
              }}
            />
          )}
          {form1040.line28.amount > 0 && (
            <LineItem
              label="Line 28 — Additional child tax credit"
              nodeId="form1040.line28"
              amount={form1040.line28.amount}
              tooltip={{
                explanation: 'Line 28 is the refundable Additional Child Tax Credit from Form 8812. It equals the lesser of $1,700 per qualifying child, or 15% of earned income above $2,500, capped at the unused portion of the child tax credit. This amount is added to your total payments even if you owe no tax.',
                pubName: 'Schedule 8812 — Additional CTC',
                pubUrl: 'https://www.irs.gov/instructions/i1040s8',
              }}
            />
          )}
          {form1040.line31.amount > 0 && (
            <LineItem
              label="Line 31 — Other refundable credits"
              nodeId="form1040.line31"
              amount={form1040.line31.amount}
              tooltip={{
                explanation: 'Line 31 includes other refundable credits such as the net Premium Tax Credit (Form 8962) and excess Social Security withholding. If your PTC exceeds the advance payments you received, the net amount appears here as an additional refund.',
                pubName: 'IRS Form 1040 Instructions — Line 31',
                pubUrl: 'https://www.irs.gov/instructions/i1040gi',
              }}
            />
          )}
          <LineItem
            label="Line 33 — Total payments"
            nodeId="form1040.line33"
            amount={form1040.line33.amount}
            tooltip={{
              explanation: 'Line 33 sums all tax payments: federal withholding (Line 25), estimated tax payments (Line 26), and refundable credits (Lines 27–32) such as the Earned Income Credit, Additional Child Tax Credit, American Opportunity Credit, and net Premium Tax Credit. Total payments are compared to total tax to determine your refund or amount owed.',
              pubName: 'IRS Form 1040 Instructions — Line 33',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
        </div>
      </section>

      {/* Result */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
          Result
        </h2>
        <div className="mt-2 flex flex-col">
          {form1040.line34.amount > 0 && (
            <div className="flex items-center justify-between gap-2 py-1.5 sm:py-1">
              <span className="text-sm font-medium text-tax-green">Line 34 — Refund</span>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="text-base sm:text-lg font-bold text-tax-green tabular-nums">
                  {formatCurrency(form1040.line34.amount)}
                </span>
                <Link
                  to="/explain/form1040.line34"
                  className="inline-flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent"
                >
                  ?
                </Link>
              </div>
            </div>
          )}
          {form1040.line37.amount > 0 && (
            <div className="flex items-center justify-between gap-2 py-1.5 sm:py-1">
              <span className="text-sm font-medium text-tax-red">Line 37 — Amount you owe</span>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="text-base sm:text-lg font-bold text-tax-red tabular-nums">
                  {formatCurrency(form1040.line37.amount)}
                </span>
                <Link
                  to="/explain/form1040.line37"
                  className="inline-flex items-center justify-center w-10 h-10 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent"
                >
                  ?
                </Link>
              </div>
            </div>
          )}
          {form1040.line34.amount === 0 && form1040.line37.amount === 0 && (
            <div className="py-1 text-sm text-gray-500">Tax balance: $0.00</div>
          )}
        </div>
      </section>

      {/* State return links */}
      {stateResults.length > 0 && stateResults.map(sr => {
        const isRefund = sr.overpaid > 0
        const isOwed = sr.amountOwed > 0
        const statusLabel = isRefund ? 'Refund' : isOwed ? 'Amount Owed' : 'Balanced'
        const statusAmount = isRefund ? sr.overpaid : isOwed ? sr.amountOwed : 0
        const statusColor = isRefund ? 'text-tax-green' : isOwed ? 'text-tax-red' : 'text-gray-500'
        const borderColor = isRefund ? 'border-emerald-200' : isOwed ? 'border-red-200' : 'border-amber-200'
        const bgColor = isRefund ? 'bg-emerald-50/50' : isOwed ? 'bg-red-50/50' : 'bg-amber-50/50'

        return (
          <div key={sr.stateCode} data-testid={`state-card-${sr.stateCode}`} className={`mt-6 border ${borderColor} ${bgColor} rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-gray-800">{sr.formLabel}</span>
              <div className="flex items-center gap-2 mt-1">
                <span data-testid={`state-status-${sr.stateCode}`} className={`text-sm font-semibold ${statusColor}`}>
                  {statusLabel}{statusAmount > 0 ? `: ${formatCurrency(statusAmount)}` : ''}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Review your {sr.stateCode} state return on the next page.</p>
            </div>
            <Link
              to={`/interview/state-review-${sr.stateCode}`}
              className="text-sm font-medium text-brand hover:text-blue-700 underline underline-offset-2 shrink-0 py-2 sm:py-0"
            >
              View {sr.stateCode} Return
            </Link>
          </div>
        )
      })}

      {/* Schedules included */}
      {executedSchedules.length > 0 && (
        <div className="mt-4 text-xs text-gray-500">
          Schedules included: {executedSchedules.join(', ')}
        </div>
      )}

      {/* Info-level validation (collapsed) */}
      {infos.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            {infos.length} informational note{infos.length > 1 ? 's' : ''} — click to expand
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {infos.map((item) => (
              <ValidationAlert key={item.code} item={item} />
            ))}
          </div>
        </details>
      )}

      <InterviewNav interview={interview} />
    </div>
  )
}
