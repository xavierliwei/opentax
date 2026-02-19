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
          className="inline-flex items-center justify-center w-6 h-6 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent"
          title="Why this number?"
        >
          ?
        </Link>
      </div>
    </div>
  )
}

export function ReviewPage() {
  const taxReturn = useTaxStore((s) => s.taxReturn)
  const form1040 = useTaxStore((s) => s.computeResult.form1040)
  const executedSchedules = useTaxStore((s) => s.computeResult.executedSchedules)
  const interview = useInterview()

  const FILING_STATUS_LABELS: Record<string, string> = {
    single: 'Single',
    mfj: 'Married Filing Jointly',
    mfs: 'Married Filing Separately',
    hoh: 'Head of Household',
    qw: 'Qualifying Surviving Spouse',
  }

  return (
    <div data-testid="page-review" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Review Your Return</h1>
      <p className="mt-1 text-sm text-gray-600">
        Review your tax return summary. Click [?] to see how any number was calculated.
      </p>

      {/* Filing info */}
      <div className="mt-6 flex flex-col gap-2">
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-gray-600 shrink-0">Filing Status:</span>
          <div className="flex items-center gap-2 justify-end">
            <span className="font-medium text-right">{FILING_STATUS_LABELS[taxReturn.filingStatus]}</span>
            <Link to="/interview/filing-status" className="text-xs text-tax-blue hover:text-blue-700">
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
            <Link to="/interview/personal-info" className="text-xs text-tax-blue hover:text-blue-700">
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
                explanation: 'Line 10 is the total of above-the-line adjustments from Schedule 1 Part II. These include the Traditional IRA deduction, student loan interest, educator expenses, and HSA contributions. These adjustments reduce your total income to arrive at AGI.',
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
              explanation: 'Line 12 is the greater of your standard deduction or itemized deductions (Schedule A Line 17). For 2025: $15,000 (Single), $30,000 (MFJ), $22,500 (HOH), $15,000 (MFS). Additional amounts apply if you are 65 or older or blind.',
              pubName: 'IRS Form 1040 Instructions — Line 12',
              pubUrl: 'https://www.irs.gov/instructions/i1040gi',
            }}
          />
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
          <LineItem
            label="Line 33 — Total payments"
            nodeId="form1040.line33"
            amount={form1040.line33.amount}
            tooltip={{
              explanation: 'Line 33 sums all tax payments: federal withholding (Line 25), estimated tax payments (Line 26), and refundable credits (Lines 27–32) such as the Earned Income Credit, Additional Child Tax Credit, and American Opportunity Credit. Total payments are compared to total tax to determine your refund or amount owed.',
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
                  className="inline-flex items-center justify-center w-6 h-6 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent"
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
                  className="inline-flex items-center justify-center w-6 h-6 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent"
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

      {/* Schedules included */}
      {executedSchedules.length > 0 && (
        <div className="mt-4 text-xs text-gray-500">
          Schedules included: {executedSchedules.join(', ')}
        </div>
      )}

      <InterviewNav interview={interview} />
    </div>
  )
}
