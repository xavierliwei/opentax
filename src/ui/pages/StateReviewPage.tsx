/**
 * Generic config-driven state review page.
 *
 * Renders any state's review layout from its StateRulesModule.reviewLayout
 * config, so adding a new state doesn't require a new React component.
 */

import { Link, useLocation } from 'react-router-dom'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { getStateModule } from '../../rules/stateRegistry.ts'
import { InfoTooltip } from '../components/InfoTooltip.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import type { SupportedStateCode } from '../../model/types.ts'
import type { StateComputeResult, StateReviewLineItem, StateReviewResultLine } from '../../rules/stateEngine.ts'

function formatCurrency(cents: number): string {
  const d = Math.abs(cents) / 100
  const formatted = d.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return cents < 0 ? `-${formatted}` : formatted
}

interface LineItemProps {
  item: StateReviewLineItem
  result: StateComputeResult
}

function LineItem({ item, result }: LineItemProps) {
  const amount = item.getValue(result)
  return (
    <div className="flex items-baseline justify-between gap-2 sm:gap-3 py-1.5 sm:py-1">
      <span className="text-sm text-gray-700 min-w-0 inline-flex items-center flex-wrap">
        <span className="break-words">{item.label}</span>
        {item.tooltip && <InfoTooltip {...item.tooltip} />}
      </span>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <span className="text-sm font-medium tabular-nums">{formatCurrency(amount)}</span>
        <Link
          to={`/explain/${item.nodeId}`}
          className="inline-flex items-center justify-center w-6 h-6 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent"
          title="Why this number?"
        >
          ?
        </Link>
      </div>
    </div>
  )
}

interface ResultLineProps {
  line: StateReviewResultLine
  result: StateComputeResult
}

function ResultLine({ line, result }: ResultLineProps) {
  if (line.type === 'zero') {
    return (
      <div className="py-1 text-sm text-gray-500 mt-2 pt-2 border-t border-amber-100">
        {line.label}: $0.00
      </div>
    )
  }

  const amount = line.getValue(result)
  const colorClass = line.type === 'refund' ? 'text-tax-green' : 'text-tax-red'

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 sm:py-1 mt-2 pt-2 border-t border-amber-100">
      <span className={`text-sm font-medium ${colorClass}`}>{line.label}</span>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <span className={`text-base sm:text-lg font-bold ${colorClass} tabular-nums`}>
          {formatCurrency(amount)}
        </span>
        {line.nodeId && (
          <Link
            to={`/explain/${line.nodeId}`}
            className="inline-flex items-center justify-center w-6 h-6 sm:w-auto sm:h-auto text-xs text-tax-blue hover:text-blue-700 rounded-full sm:rounded-none hover:bg-blue-50 sm:hover:bg-transparent"
          >
            ?
          </Link>
        )}
      </div>
    </div>
  )
}

/** Extract state code from path like /interview/state-review-CA */
function useStateCodeFromPath(): SupportedStateCode {
  const { pathname } = useLocation()
  const match = pathname.match(/state-review-([A-Z]{2})$/i)
  return (match ? match[1].toUpperCase() : '') as SupportedStateCode
}

export function StateReviewPage() {
  const stateCode = useStateCodeFromPath()
  const stateModule = getStateModule(stateCode)

  const stateResult = useTaxStore((s) =>
    s.computeResult.stateResults.find((r) => r.stateCode === stateCode),
  )
  const interview = useInterview()

  if (!stateModule) {
    return (
      <div data-testid="page-state-review" className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">State Review</h1>
        <p className="mt-2 text-sm text-gray-500">
          State &quot;{stateCode}&quot; is not supported.
        </p>
        <InterviewNav interview={interview} />
      </div>
    )
  }

  if (!stateResult) {
    return (
      <div data-testid="page-state-review" className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">{stateModule.formLabel}</h1>
        <p className="mt-2 text-sm text-gray-500">
          Enable {stateModule.formLabel.split(' ')[0]} on the{' '}
          <Link to="/interview/state-returns" className="text-tax-blue hover:text-blue-700 underline">
            State Returns
          </Link>{' '}
          page to compute your state return.
        </p>
        <InterviewNav interview={interview} />
      </div>
    )
  }

  return (
    <div data-testid="page-state-review" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">{stateResult.formLabel}</h1>
      <p className="mt-1 text-sm text-gray-600">
        Your {stateResult.formLabel.split(' ')[0]} state return
        {stateResult.residencyType === 'part-year' && stateResult.apportionmentRatio !== undefined
          ? ` (part-year resident — ${Math.round(stateResult.apportionmentRatio * 100)}% ${stateResult.stateCode})`
          ? ` (part-year resident \u2014 ${Math.round(stateResult.apportionmentRatio * 100)}% ${stateResult.stateCode})`
          : ''
        }. Click [?] to see how any number was calculated.
      </p>

      {stateModule.reviewLayout.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !item.showWhen || item.showWhen(stateResult),
        )
        if (visibleItems.length === 0) return null

        return (
          <section key={section.title} className="mt-6">
            <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide border-b border-amber-200 pb-1">
              {section.title}
            </h2>
            <div className="mt-2 flex flex-col">
              {visibleItems.map((item) => (
                <LineItem key={item.nodeId} item={item} result={stateResult} />
              ))}
            </div>
          </section>
        )
      })}

      {/* Result lines (refund/owed/zero) */}
      {stateModule.reviewResultLines
        .filter((line) => line.showWhen(stateResult))
        .map((line) => (
          <ResultLine key={line.nodeId || line.type} line={line} result={stateResult} />
        ))}

      <InterviewNav interview={interview} />
    </div>
  )
}
