import { Link } from 'react-router-dom'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'

function formatCurrency(cents: number): string {
  const d = Math.abs(cents) / 100
  const formatted = d.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return cents < 0 ? `-${formatted}` : formatted
}

export function CreditsPage() {
  const dependents = useTaxStore((s) => s.taxReturn.dependents)
  const filingStatus = useTaxStore((s) => s.taxReturn.filingStatus)
  const form1040 = useTaxStore((s) => s.computeResult.form1040)
  const interview = useInterview()

  const ctc = form1040.childTaxCredit
  const eic = form1040.earnedIncomeCredit
  const hasDependentsWithoutDOB = dependents.some((d) => !d.dateOfBirth)

  return (
    <div data-testid="page-credits" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Credits</h1>
      <p className="mt-1 text-sm text-gray-600">
        Tax credits are computed automatically based on your dependents and income.
      </p>

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

      {ctc && (ctc.numQualifyingChildren > 0 || ctc.numOtherDependents > 0) ? (
        <div className="mt-6 flex flex-col gap-4">
          {/* Summary */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
              Child Tax Credit Summary
            </h2>
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 flex items-center">
                  Qualifying children (under 17)
                  <InfoTooltip
                    explanation="A qualifying child must be under age 17 at the end of the tax year, have a valid SSN, be your son/daughter/stepchild/foster child/sibling/grandchild, and have lived with you for more than half the year. Each qualifying child generates a $2,000 credit."
                    pubName="IRS Schedule 8812 Instructions"
                    pubUrl="https://www.irs.gov/instructions/i1040s8"
                  />
                </span>
                <span className="font-medium">{ctc.numQualifyingChildren}</span>
              </div>
              {ctc.numOtherDependents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Other dependents ($500 each)</span>
                  <span className="font-medium">{ctc.numOtherDependents}</span>
                </div>
              )}
            </div>
          </section>

          {/* Credit computation */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
              Credit Computation
            </h2>
            <div className="mt-2 flex flex-col gap-1">
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
              <div className="flex justify-between text-sm border-t border-gray-100 pt-1">
                <span className="text-gray-700 font-medium">Credit after phase-out</span>
                <span className="font-medium tabular-nums">{formatCurrency(ctc.creditAfterPhaseOut)}</span>
              </div>
            </div>
          </section>

          {/* Non-refundable & refundable split */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
              Credit Allocation
            </h2>
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 flex items-center">
                  Line 19 — Non-refundable CTC
                  <InfoTooltip
                    explanation="The non-refundable portion of the child tax credit directly reduces your tax liability but cannot reduce it below zero. Any excess may become the refundable Additional Child Tax Credit on Line 28."
                    pubName="Form 1040, Line 19"
                    pubUrl="https://www.irs.gov/instructions/i1040gi"
                  />
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium tabular-nums">{formatCurrency(form1040.line19.amount)}</span>
                  <Link
                    to="/explain/form1040.line19"
                    className="text-xs text-tax-blue hover:text-blue-700"
                    title="Why this number?"
                  >
                    ?
                  </Link>
                </div>
              </div>
              {form1040.line28.amount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 flex items-center">
                    Line 28 — Additional CTC (refundable)
                    <InfoTooltip
                      explanation="The Additional Child Tax Credit (Form 8812) is the refundable portion. It equals the lesser of: (a) $1,700 per qualifying child, and (b) 15% of earned income above $2,500. It cannot exceed the unused credit from Line 19."
                      pubName="Schedule 8812 — Additional CTC"
                      pubUrl="https://www.irs.gov/instructions/i1040s8"
                    />
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium tabular-nums text-tax-green">
                      {formatCurrency(form1040.line28.amount)}
                    </span>
                    <Link
                      to="/explain/form1040.line28"
                      className="text-xs text-tax-blue hover:text-blue-700"
                      title="Why this number?"
                    >
                      ?
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-6 text-sm text-gray-500">
          {dependents.length === 0
            ? 'No dependents on this return. Add dependents to compute credits.'
            : 'No dependents qualify for tax credits. Ensure date of birth, SSN, and relationship are filled in.'}
        </div>
      )}

      {/* ── Earned Income Credit ────────────────────────────── */}
      {eic && eic.eligible && eic.creditAmount > 0 ? (
        <div className="mt-6 flex flex-col gap-4">
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
              Earned Income Credit
            </h2>
            <div className="mt-2 flex flex-col gap-1">
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
                <span className="text-gray-700">Schedule used</span>
                <span className="font-medium">
                  {eic.scheduleIndex === 0 ? 'No children' : `${eic.scheduleIndex} child${eic.scheduleIndex > 1 ? 'ren' : ''}`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Credit at earned income</span>
                <span className="font-medium tabular-nums">{formatCurrency(eic.creditAtEarnedIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Credit at AGI</span>
                <span className="font-medium tabular-nums">{formatCurrency(eic.creditAtAGI)}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-1">
                <span className="text-gray-700 font-medium flex items-center">
                  Line 27 — Earned income credit
                  <InfoTooltip
                    explanation="The Earned Income Credit is computed at both earned income and AGI, taking the smaller amount. It is a refundable credit — it can reduce your tax below zero and result in a refund."
                    pubName="IRS Pub 596 — Earned Income Credit"
                    pubUrl="https://www.irs.gov/publications/p596"
                  />
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium tabular-nums text-tax-green">
                    {formatCurrency(eic.creditAmount)}
                  </span>
                  <Link
                    to="/explain/form1040.line27"
                    className="text-xs text-tax-blue hover:text-blue-700"
                    title="Why this number?"
                  >
                    ?
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : eic && !eic.eligible && eic.ineligibleReason ? (
        <div className="mt-6 text-sm text-gray-500">
          {eic.ineligibleReason === 'mfs' && 'Earned Income Credit is not available for Married Filing Separately.'}
          {eic.ineligibleReason === 'investment_income' && 'Investment income exceeds $11,950 — not eligible for the Earned Income Credit.'}
          {eic.ineligibleReason === 'age' && 'Without qualifying children, the EITC requires the filer to be age 25–64.'}
          {eic.ineligibleReason === 'no_income' && 'No earned income — the Earned Income Credit requires wages or self-employment income.'}
        </div>
      ) : filingStatus === 'mfs' ? (
        <div className="mt-6 text-sm text-gray-500">
          Earned Income Credit is not available for Married Filing Separately.
        </div>
      ) : null}

      <InterviewNav interview={interview} />
    </div>
  )
}
