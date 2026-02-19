import { useRef, useMemo, useState } from 'react'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { CurrencyInput } from '../components/CurrencyInput.tsx'
import { RSUBasisBanner } from '../components/RSUBasisBanner.tsx'
import { InterviewNav } from './InterviewNav.tsx'
import { autoDetectBroker } from '../../intake/csv/autoDetect.ts'
import { parseRobinhoodPdf } from '../../intake/pdf/robinhoodPdfParser.ts'
import { processRSUAdjustments, estimateRSUImpact } from '../../rules/2025/rsuAdjustment.ts'
import type { ParseResult } from '../../intake/csv/types.ts'
import type { Form1099B, Form8949Category } from '../../model/types.ts'

// ── Formatting helpers ────────────────────────────────────────

function formatCents(cents: number): string {
  const abs = Math.abs(cents) / 100
  return abs.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Various'
  const [year, month, day] = iso.split('-')
  return `${month}/${day}/${year?.slice(2)}`
}

/** Convert ALL-CAPS brokerage names to readable title case. */
function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
  )
}

// ── Form 8949 category helpers ────────────────────────────────

function getCategory(b: Form1099B): Form8949Category {
  const basisReported = b.basisReportedToIrs && !b.noncoveredSecurity
  if (b.longTerm === true) return basisReported ? 'D' : 'E'
  if (b.longTerm === false) return basisReported ? 'A' : 'B'
  return basisReported ? 'A' : 'B'
}

const CATEGORY_LABEL: Record<Form8949Category, string> = {
  A: 'Short-term, basis reported to IRS',
  B: 'Short-term, basis NOT reported',
  D: 'Long-term, basis reported to IRS',
  E: 'Long-term, basis NOT reported',
}

const CATEGORY_ORDER: Form8949Category[] = ['A', 'B', 'D', 'E']

// ── CSV upload zone ───────────────────────────────────────────

function BrokerUploadZone({ onUpload }: { onUpload: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFile(file: File) {
    onUpload(file)
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors select-none
        ${isDragging ? 'border-tax-blue bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
    >
      <div className="text-3xl mb-2">📄</div>
      <p className="text-sm font-medium text-gray-700">
        Drop your 1099-B here or click to browse
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Supports Robinhood PDF (consolidated 1099) · CSV also accepted
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.csv,application/pdf,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Import result banner ──────────────────────────────────────

function ImportBanner({
  brokerName,
  result,
  onReplace,
}: {
  brokerName: string
  result: ParseResult
  onReplace: () => void
}) {
  // Fatal error = no transactions could be extracted at all
  const isFatal = result.errors.length > 0 && result.transactions.length === 0
  const isSuccess = result.transactions.length > 0

  return (
    <div
      className={`rounded-lg border px-4 py-3 mt-4 ${isFatal ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}
    >
      {isFatal ? (
        <div className="flex flex-col gap-1">
          {result.errors.map((err, i) => (
            <p key={i} className="text-sm font-medium text-red-700">Import failed: {err}</p>
          ))}
        </div>
      ) : isSuccess ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-green-800">
              ✓ {result.rowCounts.parsed} transaction{result.rowCounts.parsed !== 1 ? 's' : ''}{' '}
              imported from {brokerName}
            </p>
            {result.rowCounts.skipped > 0 && (
              <p className="text-xs text-amber-700 mt-1">
                {result.rowCounts.skipped} row{result.rowCounts.skipped !== 1 ? 's' : ''} skipped (non-1099B or unrecognized format)
              </p>
            )}
          </div>
          <button
            className="text-xs text-gray-500 hover:text-gray-700 underline whitespace-nowrap"
            onClick={onReplace}
          >
            Replace
          </button>
        </div>
      ) : null}
      {result.warnings.map((w, i) => (
        <p key={i} className="text-xs text-amber-700 mt-1">
          ⚠ {w}
        </p>
      ))}
    </div>
  )
}

// ── Transaction table row ─────────────────────────────────────

function TransactionRow({
  form,
  onRemove,
  even,
}: {
  form: Form1099B
  onRemove: () => void
  even: boolean
}) {
  const gain = form.gainLoss
  const isGain = gain >= 0

  return (
    <>
      <tr className={even ? 'bg-gray-50/60' : ''}>
        <td className="py-2 px-3 text-sm text-gray-900 truncate max-w-0">
          {titleCase(form.description)}
        </td>
        <td className="py-2 px-3 text-sm text-gray-500 whitespace-nowrap">
          <span className="hidden sm:inline">
            {formatDate(form.dateAcquired)} → {formatDate(form.dateSold)}
          </span>
          <span className="sm:hidden text-xs">
            {formatDate(form.dateAcquired)}
            <br />
            → {formatDate(form.dateSold)}
          </span>
        </td>
        <td className="py-2 px-3 text-sm text-gray-700 text-right whitespace-nowrap tabular-nums">
          {formatCents(form.proceeds)}
        </td>
        <td
          className={`py-2 px-3 text-sm font-semibold text-right whitespace-nowrap tabular-nums ${isGain ? 'text-emerald-600' : 'text-red-600'}`}
        >
          {isGain ? '+' : '−'}{formatCents(Math.abs(gain))}
        </td>
        <td className="py-2 px-2 text-center w-8">
          <button
            onClick={onRemove}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors text-sm leading-none"
            title="Remove"
          >
            ×
          </button>
        </td>
      </tr>
      {form.washSaleLossDisallowed > 0 && (
        <tr className={even ? 'bg-gray-50/60' : ''}>
          <td colSpan={5} className="pb-2 pt-0 px-3">
            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">
              ⚠ Wash sale: {formatCents(form.washSaleLossDisallowed)} disallowed
            </span>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Category section (collapsible) ──────────────────────────

function CategorySection({
  cat,
  forms,
  onRemove,
}: {
  cat: Form8949Category
  forms: Form1099B[]
  onRemove: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  const netGL = forms.reduce((sum, f) => sum + f.gainLoss, 0)
  const isNetGain = netGL >= 0

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* Clickable category header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-gray-700 truncate">
            {CATEGORY_LABEL[cat]}
          </span>
          <span className="text-xs text-gray-400 shrink-0">
            {forms.length} trade{forms.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span
          className={`text-sm font-bold tabular-nums shrink-0 ${isNetGain ? 'text-emerald-600' : 'text-red-600'}`}
        >
          {isNetGain ? '+' : '−'}{formatCents(Math.abs(netGL))}
        </span>
      </button>

      {/* Table (shown when expanded) */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <colgroup>
              <col className="w-[38%]" />
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[17%]" />
              <col className="w-8" />
            </colgroup>
            <thead>
              <tr className="border-t border-gray-200 text-xs text-gray-400 uppercase tracking-wide">
                <th className="py-2 px-3 text-left font-medium">Security</th>
                <th className="py-2 px-3 text-left font-medium">Dates</th>
                <th className="py-2 px-3 text-right font-medium">Proceeds</th>
                <th className="py-2 px-3 text-right font-medium">Gain / Loss</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f, i) => (
                <TransactionRow
                  key={f.id}
                  form={f}
                  onRemove={() => onRemove(f.id)}
                  even={i % 2 === 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Gain/loss summary ─────────────────────────────────────────

function GainLossSummary({ forms }: { forms: Form1099B[] }) {
  const shortTermNet = forms
    .filter((f) => f.longTerm === false || (f.longTerm === null && getCategory(f) === 'A') || (f.longTerm === null && getCategory(f) === 'B'))
    .reduce((sum, f) => sum + f.gainLoss, 0)

  const longTermNet = forms
    .filter((f) => f.longTerm === true)
    .reduce((sum, f) => sum + f.gainLoss, 0)

  const netTotal = shortTermNet + longTermNet

  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Summary</h3>
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Short-term net</span>
          <span className={`font-medium tabular-nums ${shortTermNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {shortTermNet >= 0 ? '+' : '−'}{formatCents(Math.abs(shortTermNet))}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Long-term net</span>
          <span className={`font-medium tabular-nums ${longTermNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {longTermNet >= 0 ? '+' : '−'}{formatCents(Math.abs(longTermNet))}
          </span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
          <span className="font-semibold text-gray-700">Net capital {netTotal >= 0 ? 'gain' : 'loss'}</span>
          <span className={`font-bold tabular-nums ${netTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {netTotal >= 0 ? '+' : '−'}{formatCents(Math.abs(netTotal))}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Manual entry form ─────────────────────────────────────────

function emptyForm1099B(): Form1099B {
  return {
    id: crypto.randomUUID(),
    brokerName: '',
    description: '',
    dateAcquired: null,
    dateSold: '',
    proceeds: 0,
    costBasis: null,
    washSaleLossDisallowed: 0,
    gainLoss: 0,
    basisReportedToIrs: true,
    longTerm: null,
    noncoveredSecurity: false,
    federalTaxWithheld: 0,
  }
}

function inputCls() {
  return 'border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent w-full'
}

function ManualEntryForm({
  onSave,
  onCancel,
}: {
  onSave: (form: Form1099B) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Form1099B>(emptyForm1099B)

  function update(fields: Partial<Form1099B>) {
    setForm((prev) => ({ ...prev, ...fields }))
  }

  function updateProceeds(v: number) {
    const basis = form.costBasis ?? 0
    update({ proceeds: v, gainLoss: v - basis + form.washSaleLossDisallowed })
  }

  function updateCostBasis(v: number) {
    update({ costBasis: v, gainLoss: form.proceeds - v + form.washSaleLossDisallowed })
  }

  function updateWashSale(v: number) {
    const basis = form.costBasis ?? 0
    update({ washSaleLossDisallowed: v, gainLoss: form.proceeds - basis + v })
  }

  const canSave = form.description.trim().length > 0 && form.dateSold.length > 0

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Add transaction</h3>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Security description</label>
            <input
              type="text"
              className={inputCls()}
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="AAPL"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Broker name</label>
            <input
              type="text"
              className={inputCls()}
              value={form.brokerName}
              onChange={(e) => update({ brokerName: e.target.value })}
              placeholder="Fidelity"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Date acquired</label>
            <input
              type="date"
              className={inputCls()}
              value={form.dateAcquired ?? ''}
              onChange={(e) => update({ dateAcquired: e.target.value || null })}
            />
            <p className="text-xs text-gray-400">Leave blank if "Various"</p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Date sold</label>
            <input
              type="date"
              className={inputCls()}
              value={form.dateSold}
              onChange={(e) => update({ dateSold: e.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Holding period</label>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
            {(
              [
                { label: 'Short-term (≤ 1 year)', value: false as boolean },
                { label: 'Long-term (> 1 year)', value: true as boolean },
              ] as const
            ).map(({ label, value }) => (
              <label key={String(value)} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="longTerm-new"
                  checked={form.longTerm === value}
                  onChange={() => update({ longTerm: value })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CurrencyInput label="Proceeds" value={form.proceeds} onChange={updateProceeds} />
          <CurrencyInput
            label="Cost basis"
            value={form.costBasis ?? 0}
            onChange={updateCostBasis}
          />
          <CurrencyInput
            label="Wash sale loss disallowed"
            value={form.washSaleLossDisallowed}
            onChange={updateWashSale}
          />
          <CurrencyInput
            label="Federal tax withheld"
            value={form.federalTaxWithheld}
            onChange={(v) => update({ federalTaxWithheld: v })}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="basisReported-new"
            checked={form.basisReportedToIrs}
            onChange={(e) => update({ basisReportedToIrs: e.target.checked })}
          />
          <label htmlFor="basisReported-new" className="text-sm text-gray-700">
            Basis reported to IRS (Box 12 checked)
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            disabled={!canSave}
            onClick={() => onSave(form)}
            className="px-4 py-2 bg-tax-blue text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save transaction
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export function StockSalesPage() {
  const forms = useTaxStore((s) => s.taxReturn.form1099Bs)
  const rsuVestEvents = useTaxStore((s) => s.taxReturn.rsuVestEvents)
  const setForm1099Bs = useTaxStore((s) => s.setForm1099Bs)
  const addForm1099B = useTaxStore((s) => s.addForm1099B)
  const removeForm1099B = useTaxStore((s) => s.removeForm1099B)
  const interview = useInterview()

  const rsuAnalysis = useMemo(() => {
    if (forms.length === 0 || rsuVestEvents.length === 0) return null
    const { analyses } = processRSUAdjustments(forms, rsuVestEvents)
    const adjustments = analyses.filter(a => a.status !== 'correct')
    if (adjustments.length === 0) return null
    return { analyses, impact: estimateRSUImpact(analyses) }
  }, [forms, rsuVestEvents])

  const [importBroker, setImportBroker] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ParseResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [showUpload, setShowUpload] = useState(true)
  const [showManualForm, setShowManualForm] = useState(false)

  async function handleFileUpload(file: File) {
    setImporting(true)
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        // PDF: Robinhood consolidated 1099
        const buf = await file.arrayBuffer()
        const result = await parseRobinhoodPdf(buf)
        setImportBroker('Robinhood')
        setImportResult(result)
        if (result.transactions.length > 0) {
          setForm1099Bs(result.transactions)
          setShowUpload(false)
        }
      } else {
        // CSV: auto-detect broker
        const csv = await file.text()
        const detected = autoDetectBroker(csv)
        setImportBroker(detected.parser.brokerName)
        setImportResult(detected.result)
        if (detected.result.transactions.length > 0) {
          setForm1099Bs(detected.result.transactions)
          setShowUpload(false)
        }
      }
    } catch (e) {
      setImportResult({
        transactions: [],
        warnings: [],
        errors: [e instanceof Error ? e.message : 'Failed to read file. The file may be corrupted or in an unsupported format.'],
        rowCounts: { total: 0, parsed: 0, skipped: 0 },
      })
      setImportBroker(file.name)
    } finally {
      setImporting(false)
    }
  }

  function handleManualSave(form: Form1099B) {
    addForm1099B(form)
    setShowManualForm(false)
  }

  // Group by category for display
  const grouped = new Map<Form8949Category, Form1099B[]>()
  for (const cat of CATEGORY_ORDER) {
    grouped.set(cat, [])
  }
  for (const f of forms) {
    const cat = getCategory(f)
    grouped.get(cat)!.push(f)
  }

  return (
    <div data-testid="page-stock-sales" className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Stock Sales (1099-B)</h1>
      <p className="mt-1 text-sm text-gray-600">
        Import your broker's CSV export or add transactions manually. Skip this step if you had no
        stock sales.
      </p>

      {/* Upload zone */}
      {showUpload ? (
        <div className="mt-6">
          {importing ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center bg-gray-50">
              <div className="text-2xl mb-2 animate-pulse">⏳</div>
              <p className="text-sm text-gray-500">Parsing PDF…</p>
            </div>
          ) : (
            <BrokerUploadZone onUpload={handleFileUpload} />
          )}
          {importResult && (
            <ImportBanner
              brokerName={importBroker ?? 'Broker'}
              result={importResult}
              onReplace={() => {
                setShowUpload(true)
                setImportResult(null)
              }}
            />
          )}
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-green-700 font-medium">
            ✓ {forms.length} transaction{forms.length !== 1 ? 's' : ''} loaded from{' '}
            {importBroker ?? 'import'}
          </span>
          <button
            className="text-gray-500 hover:text-gray-700 underline"
            onClick={() => setShowUpload(true)}
          >
            Replace
          </button>
        </div>
      )}

      {/* Per-transaction warnings (RSU basis, etc.) */}
      {!showUpload && importResult && importResult.warnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {importResult.warnings.map((w, i) => (
            <p
              key={i}
              className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5"
            >
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {/* RSU basis adjustment banner */}
      {rsuAnalysis && (
        <div className="mt-4">
          <RSUBasisBanner analyses={rsuAnalysis.analyses} impact={rsuAnalysis.impact} />
        </div>
      )}

      {/* Transaction categories */}
      {forms.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {CATEGORY_ORDER.map((cat) => {
            const catForms = grouped.get(cat)!
            if (catForms.length === 0) return null
            return (
              <CategorySection
                key={cat}
                cat={cat}
                forms={catForms}
                onRemove={removeForm1099B}
              />
            )
          })}

          <GainLossSummary forms={forms} />
        </div>
      )}

      {/* Manual entry */}
      {showManualForm ? (
        <ManualEntryForm
          onSave={handleManualSave}
          onCancel={() => setShowManualForm(false)}
        />
      ) : (
        <button
          className="mt-4 text-sm text-tax-blue hover:text-blue-700 font-medium"
          onClick={() => setShowManualForm(true)}
        >
          + Add transaction manually
        </button>
      )}

      <div className="mt-8">
        <InterviewNav interview={interview} />
      </div>
    </div>
  )
}
