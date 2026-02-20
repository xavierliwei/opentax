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
          className="inline-flex items-center justify-center w-6 h-6 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent"
          title="Why this number?"
        >
          ?
        </Link>
      </div>
    </div>
  )
}

export function CAReviewPage() {
  const form540 = useTaxStore((s) => s.computeResult.form540)
  const interview = useInterview()

  if (!form540) {
    return (
      <div data-testid="page-ca-review" className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">California Form 540</h1>
        <p className="mt-2 text-sm text-gray-500">
          Enable the California resident checkbox on the{' '}
          <Link to="/interview/filing-status" className="text-tax-blue hover:text-blue-700 underline">
            Filing Status
          </Link>{' '}
          page to compute your CA state return.
        </p>
        <InterviewNav interview={interview} />
      </div>
    )
  }

  return (
    <div data-testid="page-ca-review" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">California Form 540</h1>
      <p className="mt-1 text-sm text-gray-600">
        Your California state return. Click [?] to see how any number was calculated.
      </p>

      {/* Income */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide border-b border-amber-200 pb-1">
          Income
        </h2>
        <div className="mt-2 flex flex-col">
          <LineItem
            label="Federal AGI"
            nodeId="form1040.line11"
            amount={form540.federalAGI}
            tooltip={{
              explanation: 'Your federal adjusted gross income from Form 1040 Line 11. This is the starting point for computing California AGI.',
              pubName: 'FTB Form 540 Instructions — Line 13',
              pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
            }}
          />
          {form540.caAdjustments.additions > 0 && (
            <LineItem
              label="Schedule CA Additions"
              nodeId="scheduleCA.additions"
              amount={form540.caAdjustments.additions}
              tooltip={{
                explanation: 'California requires adding back certain federal deductions it does not recognize. The main addition is HSA contributions — California did not adopt IRC §223, so the federal HSA deduction must be added back to income.',
                pubName: 'FTB Schedule CA Instructions',
                pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-ca-instructions.html',
              }}
            />
          )}
          <LineItem
            label="CA AGI"
            nodeId="form540.caAGI"
            amount={form540.caAGI}
            tooltip={{
              explanation: 'California adjusted gross income starts with federal AGI and applies Schedule CA adjustments. CA does not recognize HSA deductions (IRC §223), so HSA contributions are added back. Most other federal adjustments (IRA, student loan) conform to federal treatment.',
              pubName: 'FTB Form 540 Instructions — Line 17',
              pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
            }}
          />
        </div>
      </section>

      {/* Deductions */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide border-b border-amber-200 pb-1">
          Deductions
        </h2>
        <div className="mt-2 flex flex-col">
          <LineItem
            label={`CA Deduction (${form540.deductionMethod})`}
            nodeId="form540.caDeduction"
            amount={form540.deductionUsed}
            tooltip={{
              explanation: 'California uses the larger of the CA standard deduction or CA-adjusted itemized deductions. CA differences from federal: no SALT cap, $1M mortgage limit (not $750K), home equity interest still deductible, and state income tax cannot be deducted from the CA return.',
              pubName: 'FTB Form 540 Instructions — Line 18',
              pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
            }}
          />
          {form540.deductionMethod === 'itemized' && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 mt-1">
              Standard: {formatCurrency(form540.caStandardDeduction)} vs Itemized: {formatCurrency(form540.caItemizedDeduction)}
            </div>
          )}
          <LineItem
            label="CA Taxable Income"
            nodeId="form540.caTaxableIncome"
            amount={form540.caTaxableIncome}
            tooltip={{
              explanation: 'California taxable income is CA AGI minus your CA deduction. This is taxed using California\'s 9-bracket progressive rate schedule (1% to 12.3%).',
              pubName: 'FTB 2025 Tax Rate Schedules',
              pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf',
            }}
          />
        </div>
      </section>

      {/* Tax & Credits */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide border-b border-amber-200 pb-1">
          Tax & Credits
        </h2>
        <div className="mt-2 flex flex-col">
          <LineItem
            label="CA Tax"
            nodeId="form540.caTax"
            amount={form540.caTax}
            tooltip={{
              explanation: 'California income tax computed from the 9-bracket rate schedule. All income is taxed at ordinary rates — California has no preferential rate for long-term capital gains or qualified dividends.',
              pubName: 'FTB 2025 Tax Rate Schedules',
              pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf',
            }}
          />
          {form540.mentalHealthTax > 0 && (
            <LineItem
              label="Mental Health Services Tax"
              nodeId="form540.mentalHealthTax"
              amount={form540.mentalHealthTax}
              tooltip={{
                explanation: 'An additional 1% tax on California taxable income exceeding $1,000,000. This threshold is not doubled for MFJ filers. The revenue funds California\'s Mental Health Services Act (Proposition 63).',
                pubName: 'FTB Form 540 Instructions — Line 36',
                pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
              }}
            />
          )}
          {form540.totalExemptionCredits > 0 && (
            <LineItem
              label="Exemption Credits"
              nodeId="form540.exemptionCredits"
              amount={form540.totalExemptionCredits}
              tooltip={{
                explanation: 'Personal exemption credit: $153 per filer. Dependent exemption credit: $475 per dependent. These credits phase out for high-income filers (reduced by 6% for each $2,500 of CA AGI above the threshold).',
                pubName: 'FTB Form 540 Instructions — Line 32',
                pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
              }}
            />
          )}
          {form540.rentersCredit > 0 && (
            <LineItem
              label="Renter's Credit"
              nodeId="form540.rentersCredit"
              amount={form540.rentersCredit}
              tooltip={{
                explanation: 'Nonrefundable renter\'s credit: $60 for single/MFS filers (CA AGI ≤ $53,994), $120 for MFJ/HOH/QW filers (CA AGI ≤ $107,987). You must have paid rent for at least half the year on your principal California residence.',
                pubName: 'FTB — Nonrefundable Renter\'s Credit',
                pubUrl: 'https://www.ftb.ca.gov/file/personal/credits/nonrefundable-renters-credit.html',
              }}
            />
          )}
          <LineItem
            label="CA Tax After Credits"
            nodeId="form540.taxAfterCredits"
            amount={form540.taxAfterCredits}
            tooltip={{
              explanation: 'California tax after subtracting exemption credits and other nonrefundable credits (including renter\'s credit). This is compared against your CA state withholding to determine your CA refund or amount owed.',
              pubName: 'FTB Form 540 Instructions — Line 48',
              pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
            }}
          />
        </div>
      </section>

      {/* Payments & Result */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide border-b border-amber-200 pb-1">
          Payments & Result
        </h2>
        <div className="mt-2 flex flex-col">
          {form540.stateWithholding > 0 && (
            <LineItem
              label="CA State Withholding"
              nodeId="form540.stateWithholding"
              amount={form540.stateWithholding}
              tooltip={{
                explanation: 'California state income tax withheld from your W-2(s) Box 17. This is tax you already paid to the FTB through payroll withholding during the year.',
                pubName: 'FTB Form 540 Instructions — Line 71',
                pubUrl: 'https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html',
              }}
            />
          )}

          {form540.overpaid > 0 && (
            <div className="flex items-center justify-between gap-2 py-1.5 sm:py-1 mt-2 pt-2 border-t border-amber-100">
              <span className="text-sm font-medium text-tax-green">CA Refund</span>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="text-base sm:text-lg font-bold text-tax-green tabular-nums">
                  {formatCurrency(form540.overpaid)}
                </span>
                <Link
                  to="/explain/form540.overpaid"
                  className="inline-flex items-center justify-center w-6 h-6 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent"
                >
                  ?
                </Link>
              </div>
            </div>
          )}
          {form540.amountOwed > 0 && (
            <div className="flex items-center justify-between gap-2 py-1.5 sm:py-1 mt-2 pt-2 border-t border-amber-100">
              <span className="text-sm font-medium text-tax-red">CA Amount You Owe</span>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="text-base sm:text-lg font-bold text-tax-red tabular-nums">
                  {formatCurrency(form540.amountOwed)}
                </span>
                <Link
                  to="/explain/form540.amountOwed"
                  className="inline-flex items-center justify-center w-6 h-6 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent"
                >
                  ?
                </Link>
              </div>
            </div>
          )}
          {form540.overpaid === 0 && form540.amountOwed === 0 && (
            <div className="py-1 text-sm text-gray-500 mt-2 pt-2 border-t border-amber-100">
              CA tax balance: $0.00
            </div>
          )}
        </div>
      </section>

      <InterviewNav interview={interview} />
    </div>
  )
}
