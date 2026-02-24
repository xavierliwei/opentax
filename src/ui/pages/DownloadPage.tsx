import { useState } from 'react'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { InterviewNav } from './InterviewNav.tsx'
import { compileFilingPackage } from '../../forms/compiler.ts'
import type { FormTemplates, StatePackage } from '../../forms/types.ts'
import { dollars } from '../../model/traced.ts'

function formatCurrency(cents: number): string {
  return dollars(cents).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

const FILING_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  mfj: 'Married Filing Jointly',
  mfs: 'Married Filing Separately',
  hoh: 'Head of Household',
  qw: 'Qualifying Surviving Spouse',
}

async function loadTemplate(path: string): Promise<Uint8Array> {
  const resp = await fetch(`/${path}`)
  if (!resp.ok) throw new Error(`Failed to load ${path}`)
  return new Uint8Array(await resp.arrayBuffer())
}

function downloadBlob(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function DownloadPage() {
  const taxReturn = useTaxStore((s) => s.taxReturn)
  const form1040 = useTaxStore((s) => s.computeResult.form1040)
  const executedSchedules = useTaxStore((s) => s.computeResult.executedSchedules)
  const stateResults = useTaxStore((s) => s.computeResult.stateResults)
  const interview = useInterview()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statePackages, setStatePackages] = useState<StatePackage[]>([])

  const handleDownloadPDF = async () => {
    setGenerating(true)
    setError(null)
    try {
      let templates: FormTemplates
      try {
        const [f1040, f1040sa, f1040sb, f1040sd, f8949, f1040s1, f1040s2, f1040s3, f8812, f8863, f6251, f8889, f1040se, f1040sc, f1040sse, f1116] =
          await Promise.all([
            loadTemplate('forms/f1040.pdf'),
            loadTemplate('forms/f1040sa.pdf'),
            loadTemplate('forms/f1040sb.pdf'),
            loadTemplate('forms/f1040sd.pdf'),
            loadTemplate('forms/f8949.pdf'),
            loadTemplate('forms/f1040s1.pdf'),
            loadTemplate('forms/f1040s2.pdf'),
            loadTemplate('forms/f1040s3.pdf'),
            loadTemplate('forms/f8812.pdf'),
            loadTemplate('forms/f8863.pdf'),
            loadTemplate('forms/f6251.pdf'),
            loadTemplate('forms/f8889.pdf'),
            loadTemplate('forms/f1040se.pdf'),
            loadTemplate('forms/f1040sc.pdf'),
            loadTemplate('forms/f1040sse.pdf'),
            loadTemplate('forms/f1116.pdf'),
          ])
        templates = { f1040, f1040sa, f1040sb, f1040sd, f8949, f1040s1, f1040s2, f1040s3, f8812, f8863, f6251, f8889, f1040se, f1040sc, f1040sse, f1116 }
      } catch {
        throw new Error(
          'Could not load IRS form templates. Make sure the PDF templates are installed in the /public/forms/ directory.',
        )
      }

      let compiled
      try {
        compiled = await compileFilingPackage(taxReturn, templates)
      } catch {
        throw new Error(
          'Failed to fill form fields. This may indicate a data issue — try reviewing your return for missing information.',
        )
      }

      // Save state packages for separate download
      setStatePackages(compiled.statePackages)

      const lastName = taxReturn.taxpayer.lastName || 'Return'
      downloadBlob(compiled.pdfBytes, `OpenTax-2025-${lastName}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadState = (pkg: StatePackage) => {
    const lastName = taxReturn.taxpayer.lastName || 'Return'
    downloadBlob(pkg.pdfBytes, `OpenTax-2025-${lastName}-${pkg.stateCode}.pdf`)
  }

  const handleExportJSON = () => {
    const json = JSON.stringify(taxReturn, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `OpenTax-2025-${taxReturn.taxpayer.lastName || 'Return'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div data-testid="page-download" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Download Your Return</h1>

      {/* Summary card */}
      <div className="mt-6 border border-gray-200 rounded-lg p-4 sm:p-6 flex flex-col gap-3">
        <h2 className="font-semibold text-gray-900">Return Summary</h2>
        <div className="flex flex-col gap-1.5 sm:gap-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-gray-600 shrink-0">Tax Year:</span>
            <span className="font-medium text-right">{taxReturn.taxYear}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-600 shrink-0">Filing Status:</span>
            <span className="font-medium text-right">{FILING_STATUS_LABELS[taxReturn.filingStatus]}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-600 shrink-0">Name:</span>
            <span className="font-medium text-right">
              {taxReturn.taxpayer.firstName} {taxReturn.taxpayer.lastName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">AGI:</span>
            <span className="font-medium">{formatCurrency(form1040.line11.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Tax:</span>
            <span className="font-medium">{formatCurrency(form1040.line24.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Payments:</span>
            <span className="font-medium">{formatCurrency(form1040.line33.amount)}</span>
          </div>
          {form1040.line34.amount > 0 && (
            <div className="flex justify-between">
              <span className="text-tax-green font-medium">Refund:</span>
              <span className="font-bold text-tax-green">{formatCurrency(form1040.line34.amount)}</span>
            </div>
          )}
          {form1040.line37.amount > 0 && (
            <div className="flex justify-between">
              <span className="text-tax-red font-medium">Amount Owed:</span>
              <span className="font-bold text-tax-red">{formatCurrency(form1040.line37.amount)}</span>
            </div>
          )}
        </div>
        {executedSchedules.length > 0 && (
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            Forms: 1040{executedSchedules.length > 0 ? `, ${executedSchedules.join(', ')}` : ''}
          </div>
        )}
      </div>

      {/* State return summaries */}
      {stateResults.map(sr => (
        <div key={sr.stateCode} className="mt-4 border border-gray-200 rounded-lg p-4 sm:p-6 flex flex-col gap-1 text-sm">
          <h2 className="font-semibold text-gray-900 mb-2">{sr.formLabel}</h2>
          {sr.requiresIncomeTaxFiling === false && (
            <div className="mb-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded px-2 py-1">
              No personal state income tax filing required.
            </div>
          )}
          {sr.residencyType === 'part-year' && sr.apportionmentRatio !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-600">{sr.stateCode} Residency:</span>
              <span className="font-medium">Part-year ({Math.round(sr.apportionmentRatio * 100)}%)</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">{sr.stateCode} AGI:</span>
            <span className="font-medium">{formatCurrency(sr.stateAGI)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">{sr.stateCode} Tax:</span>
            <span className="font-medium">{formatCurrency(sr.taxAfterCredits)}</span>
          </div>
          {sr.stateWithholding > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">{sr.stateCode} Withholding:</span>
              <span className="font-medium">{formatCurrency(sr.stateWithholding)}</span>
            </div>
          )}
          {sr.overpaid > 0 && (
            <div className="flex justify-between">
              <span className="text-tax-green font-medium">{sr.stateCode} Refund:</span>
              <span className="font-bold text-tax-green">{formatCurrency(sr.overpaid)}</span>
            </div>
          )}
          {sr.amountOwed > 0 && (
            <div className="flex justify-between">
              <span className="text-tax-red font-medium">{sr.stateCode} Amount Owed:</span>
              <span className="font-bold text-tax-red">{formatCurrency(sr.amountOwed)}</span>
            </div>
          )}
          {(sr.disclosures ?? []).length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs text-gray-600 space-y-0.5">
              {(sr.disclosures ?? []).map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </div>
      ))}

      {/* Download buttons */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={generating}
          className="w-full sm:w-auto px-6 py-3.5 sm:py-3 text-sm font-medium text-white bg-brand rounded-md hover:bg-blue-900 active:bg-blue-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="download-pdf-btn"
        >
          {generating ? 'Generating...' : stateResults.length > 0 ? 'Download All (Federal + State)' : 'Download PDF'}
        </button>
        <button
          type="button"
          onClick={handleExportJSON}
          className="w-full sm:w-auto px-6 py-3.5 sm:py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100 transition-colors"
          data-testid="export-json-btn"
        >
          Export JSON
        </button>
      </div>

      {/* Separate state download options — always visible when states exist */}
      {stateResults.length > 0 && (
        <div className="mt-4" data-testid="state-download-section">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">State Returns</h3>
          <div className="flex flex-col gap-2">
            {stateResults.map(sr => {
              const pkg = statePackages.find(p => p.stateCode === sr.stateCode)
              const isReady = !!pkg
              return (
                <div key={sr.stateCode} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => isReady && handleDownloadState(pkg)}
                    disabled={!isReady}
                    data-testid={`download-state-${sr.stateCode}`}
                    className={`w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium border rounded-md text-left transition-colors ${
                      isReady
                        ? 'text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer'
                        : 'text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed'
                    }`}
                  >
                    {sr.formLabel} PDF
                  </button>
                  {!isReady && (
                    <span className="text-xs text-gray-400">Click &ldquo;Download All&rdquo; above to generate</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
        This PDF is for review only. E-file via IRS Free File or print and mail.
        {stateResults.length > 0 && ' State forms may need to be mailed to a different address than federal.'}
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
