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
  const [showSeparate, setShowSeparate] = useState(false)

  const handleDownloadPDF = async () => {
    setGenerating(true)
    setError(null)
    try {
      let templates: FormTemplates
      try {
        const [f1040, f1040sa, f1040sb, f1040sd, f8949, f1040s1, f1040s2, f1040s3, f8812, f8863, f6251, f8889, f1040se] =
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
          ])
        templates = { f1040, f1040sa, f1040sb, f1040sd, f8949, f1040s1, f1040s2, f1040s3, f8812, f8863, f6251, f8889, f1040se }
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
      <div className="mt-6 border border-gray-200 rounded-lg p-6 flex flex-col gap-3">
        <h2 className="font-semibold text-gray-900">Return Summary</h2>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Tax Year:</span>
            <span className="font-medium">{taxReturn.taxYear}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Filing Status:</span>
            <span className="font-medium">{FILING_STATUS_LABELS[taxReturn.filingStatus]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Name:</span>
            <span className="font-medium">
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
        <div key={sr.stateCode} className="mt-4 border border-gray-200 rounded-lg p-6 flex flex-col gap-1 text-sm">
          <h2 className="font-semibold text-gray-900 mb-2">{sr.formLabel}</h2>
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
        </div>
      ))}

      {/* Download buttons */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={generating}
          className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-white bg-brand rounded-md hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="download-pdf-btn"
        >
          {generating ? 'Generating...' : stateResults.length > 0 ? 'Download All (Federal + State)' : 'Download PDF'}
        </button>
        <button
          type="button"
          onClick={handleExportJSON}
          className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          data-testid="export-json-btn"
        >
          Export JSON
        </button>
      </div>

      {/* Separate download options — available after first generation */}
      {statePackages.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowSeparate(!showSeparate)}
            className="text-sm text-tax-blue hover:text-blue-700 underline"
          >
            {showSeparate ? 'Hide' : 'Download separately'}
          </button>
          {showSeparate && (
            <div className="mt-2 flex flex-col gap-2">
              {statePackages.map(pkg => (
                <button
                  key={pkg.stateCode}
                  type="button"
                  onClick={() => handleDownloadState(pkg)}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 text-left"
                >
                  {pkg.label} PDF
                </button>
              ))}
            </div>
          )}
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
