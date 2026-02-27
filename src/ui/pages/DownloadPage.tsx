import { useState } from 'react'
import { useTaxStore } from '../../store/taxStore.ts'
import { useInterview } from '../../interview/useInterview.ts'
import { InterviewNav } from './InterviewNav.tsx'
import { compileFilingPackage } from '../../forms/compiler.ts'
import type { FormTemplates, StatePackage } from '../../forms/types.ts'
import type { SupportedStateCode } from '../../model/types.ts'
import type { StateFormTemplates } from '../../forms/stateCompiler.ts'
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
  const [combinedPdfBytes, setCombinedPdfBytes] = useState<Uint8Array | null>(null)
  const [statePackages, setStatePackages] = useState<StatePackage[]>([])

  const generated = combinedPdfBytes !== null
  const hasStates = stateResults.length > 0
  const lastName = taxReturn.taxpayer.lastName || 'Return'

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      let templates: FormTemplates
      try {
        const [f1040, f1040sa, f1040sb, f1040sd, f8949, f1040s1, f1040s2, f1040s3, f8812, f8863, f6251, f8889, f1040se, f1040sc, f1040sse, f1116, f8995, f8995a, f8582, f2441, f4952, f5695, f8880, f8959, f8960] =
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
            loadTemplate('forms/f8995.pdf'),
            loadTemplate('forms/f8995a.pdf'),
            loadTemplate('forms/f8582.pdf'),
            loadTemplate('forms/f2441.pdf'),
            loadTemplate('forms/f4952.pdf'),
            loadTemplate('forms/f5695.pdf'),
            loadTemplate('forms/f8880.pdf'),
            loadTemplate('forms/f8959.pdf'),
            loadTemplate('forms/f8960.pdf'),
          ])
        templates = { f1040, f1040sa, f1040sb, f1040sd, f8949, f1040s1, f1040s2, f1040s3, f8812, f8863, f6251, f8889, f1040se, f1040sc, f1040sse, f1116, f8995, f8995a, f8582, f2441, f4952, f5695, f8880, f8959, f8960 }
      } catch {
        throw new Error(
          'Could not load IRS form templates. Make sure the PDF templates are installed in the /public/forms/ directory.',
        )
      }

      // Load optional form templates (non-fatal — features degrade gracefully)
      try {
        templates.f8606 = await loadTemplate('forms/f8606.pdf')
      } catch { /* Form 8606 template not available — PDF won't be generated but computation still works */ }

      // Load state templates (CA Form 540, MA Form 1, etc.) — failures are non-fatal (falls back to programmatic)
      const stateTemplateMap = new Map<SupportedStateCode, StateFormTemplates>()
      for (const config of taxReturn.stateReturns ?? []) {
        if (config.stateCode === 'CA') {
          try {
            const f540 = await loadTemplate('forms/state/CA/f540.pdf')
            stateTemplateMap.set('CA', { templates: new Map([['f540', f540]]) })
          } catch { /* fall back to programmatic */ }
        }
        if (config.stateCode === 'MA') {
          try {
            const form1 = await loadTemplate('forms/state/MA/form1.pdf')
            stateTemplateMap.set('MA', { templates: new Map([['form1', form1]]) })
          } catch { /* fall back to programmatic */ }
        }
        if (config.stateCode === 'NJ') {
          try {
            const nj1040 = await loadTemplate('forms/state/NJ/nj1040.pdf')
            stateTemplateMap.set('NJ', { templates: new Map([['nj1040', nj1040]]) })
          } catch { /* fall back to programmatic */ }
        }
        if (config.stateCode === 'NY') {
          try {
            const it201 = await loadTemplate('forms/state/NY/it201.pdf')
            stateTemplateMap.set('NY', { templates: new Map([['it201', it201]]) })
          } catch { /* fall back to programmatic */ }
        }
        if (config.stateCode === 'CT') {
          try {
            const ct1040 = await loadTemplate('forms/state/CT/ct1040.pdf')
            stateTemplateMap.set('CT', { templates: new Map([['ct1040', ct1040]]) })
          } catch { /* fall back to programmatic */ }
        }
        if (config.stateCode === 'MD') {
          try {
            const md502 = await loadTemplate('forms/state/MD/502.pdf')
            stateTemplateMap.set('MD', { templates: new Map([['502', md502]]) })
          } catch { /* fall back to programmatic */ }
        }
        if (config.stateCode === 'DC') {
          try {
            const d40 = await loadTemplate('forms/state/DC/d40.pdf')
            stateTemplateMap.set('DC', { templates: new Map([['d40', d40]]) })
          } catch { /* fall back to programmatic */ }
        }
        if (config.stateCode === 'GA') {
          try {
            const form500 = await loadTemplate('forms/state/GA/form500.pdf')
            stateTemplateMap.set('GA', { templates: new Map([['form500', form500]]) })
          } catch { /* fall back to programmatic */ }
        }
        if (config.stateCode === 'NC') {
          try {
            const d400 = await loadTemplate('forms/state/NC/d400.pdf')
            stateTemplateMap.set('NC', { templates: new Map([['d400', d400]]) })
          } catch { /* fall back to programmatic */ }
        }
        if (config.stateCode === 'OH') {
          try {
            const it1040 = await loadTemplate('forms/state/OH/it1040.pdf')
            stateTemplateMap.set('OH', { templates: new Map([['it1040', it1040]]) })
          } catch { /* fall back to programmatic */ }
        }
        if (config.stateCode === 'PA') {
          try {
            const pa40 = await loadTemplate('forms/state/PA/pa40.pdf')
            stateTemplateMap.set('PA', { templates: new Map([['pa40', pa40]]) })
          } catch { /* fall back to programmatic */ }
        }
        if (config.stateCode === 'VA') {
          try {
            const f760 = await loadTemplate('forms/state/VA/f760.pdf')
            stateTemplateMap.set('VA', { templates: new Map([['f760', f760]]) })
          } catch { /* fall back to programmatic */ }
        }
      }

      let compiled
      try {
        compiled = await compileFilingPackage(taxReturn, templates, stateTemplateMap)
      } catch {
        throw new Error(
          'Failed to fill form fields. This may indicate a data issue — try reviewing your return for missing information.',
        )
      }

      setCombinedPdfBytes(compiled.pdfBytes)
      setStatePackages(compiled.statePackages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadFederal = () => {
    if (combinedPdfBytes) downloadBlob(combinedPdfBytes, `OpenTax-2025-${lastName}.pdf`)
  }

  const handleDownloadState = (pkg: StatePackage) => {
    downloadBlob(pkg.pdfBytes, `OpenTax-2025-${lastName}-${pkg.stateCode}.pdf`)
  }

  const handleDownloadAll = () => {
    if (combinedPdfBytes) downloadBlob(combinedPdfBytes, `OpenTax-2025-${lastName}.pdf`)
  }

  const handleExportJSON = () => {
    const json = JSON.stringify(taxReturn, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `OpenTax-2025-${lastName}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div data-testid="page-download" className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Download Your Return</h1>

      {/* Compact return summary header */}
      <div className="mt-6 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
        <span className="font-semibold text-gray-900">Return Summary</span>
        <span className="text-gray-600">
          {taxReturn.taxYear} &middot; {FILING_STATUS_LABELS[taxReturn.filingStatus]} &middot;{' '}
          {taxReturn.taxpayer.firstName} {taxReturn.taxpayer.lastName}
        </span>
      </div>

      {/* Federal card */}
      <div className="mt-4 border border-gray-200 rounded-lg p-4 sm:p-6 flex flex-col gap-1 text-sm">
        <h2 className="font-semibold text-gray-900 mb-2">
          Federal ({taxReturn.isNonresidentAlien ? 'Form 1040-NR' : 'Form 1040'})
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">AGI</span>
            <span className="font-medium">{formatCurrency(form1040.line11.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Tax</span>
            <span className="font-medium">{formatCurrency(form1040.line24.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Payments</span>
            <span className="font-medium">{formatCurrency(form1040.line33.amount)}</span>
          </div>
          {form1040.line34.amount > 0 && (
            <div className="flex justify-between">
              <span className="text-tax-green font-medium">Refund</span>
              <span className="font-bold text-tax-green">{formatCurrency(form1040.line34.amount)}</span>
            </div>
          )}
          {form1040.line37.amount > 0 && (
            <div className="flex justify-between">
              <span className="text-tax-red font-medium">Amount Owed</span>
              <span className="font-bold text-tax-red">{formatCurrency(form1040.line37.amount)}</span>
            </div>
          )}
        </div>
        {executedSchedules.length > 0 && (
          <div className="text-xs text-gray-500 pt-2 mt-1 border-t border-gray-100">
            Forms: 1040, {executedSchedules.join(', ')}
          </div>
        )}
        {generated && (
          <div className="flex justify-end pt-2 mt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={handleDownloadFederal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:bg-blue-900 active:bg-blue-950 transition-colors"
              data-testid="download-federal-btn"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" /></svg>
              Download
            </button>
          </div>
        )}
      </div>

      {/* State return cards */}
      {stateResults.map(sr => {
        const pkg = statePackages.find(p => p.stateCode === sr.stateCode)
        return (
          <div key={sr.stateCode} className="mt-4 border border-gray-200 rounded-lg p-4 sm:p-6 flex flex-col gap-1 text-sm">
            <h2 className="font-semibold text-gray-900 mb-2">{sr.formLabel}</h2>
            {sr.requiresIncomeTaxFiling === false && (
              <div className="mb-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                No personal state income tax filing required.
              </div>
            )}
            {sr.residencyType === 'part-year' && sr.apportionmentRatio !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">{sr.stateCode} Residency</span>
                <span className="font-medium">Part-year ({Math.round(sr.apportionmentRatio * 100)}%)</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">{sr.stateCode} AGI</span>
                <span className="font-medium">{formatCurrency(sr.stateAGI)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{sr.stateCode} Tax</span>
                <span className="font-medium">{formatCurrency(sr.taxAfterCredits)}</span>
              </div>
              {sr.stateWithholding > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{sr.stateCode} Withholding</span>
                  <span className="font-medium">{formatCurrency(sr.stateWithholding)}</span>
                </div>
              )}
              {sr.overpaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-tax-green font-medium">{sr.stateCode} Refund</span>
                  <span className="font-bold text-tax-green">{formatCurrency(sr.overpaid)}</span>
                </div>
              )}
              {sr.amountOwed > 0 && (
                <div className="flex justify-between">
                  <span className="text-tax-red font-medium">{sr.stateCode} Owed</span>
                  <span className="font-bold text-tax-red">{formatCurrency(sr.amountOwed)}</span>
                </div>
              )}
            </div>
            {(sr.disclosures ?? []).length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-xs text-gray-600 space-y-0.5">
                {(sr.disclosures ?? []).map((d) => <li key={d}>{d}</li>)}
              </ul>
            )}
            {generated && pkg && (
              <div className="flex justify-end pt-2 mt-1 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => handleDownloadState(pkg)}
                  data-testid={`download-state-${sr.stateCode}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:bg-blue-900 active:bg-blue-950 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" /></svg>
                  Download
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Action bar */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        {!generated ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full sm:w-auto px-6 py-3.5 sm:py-3 text-sm font-medium text-white bg-brand rounded-md hover:bg-blue-900 active:bg-blue-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="download-pdf-btn"
          >
            {generating ? 'Generating...' : 'Generate PDFs'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDownloadAll}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-3.5 sm:py-3 text-sm font-medium text-white bg-brand rounded-md hover:bg-blue-900 active:bg-blue-950 transition-colors"
            data-testid="download-pdf-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" /></svg>
            {hasStates ? 'Download All' : 'Download PDF'}
          </button>
        )}
        <button
          type="button"
          onClick={handleExportJSON}
          className="w-full sm:w-auto px-6 py-3.5 sm:py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100 transition-colors"
          data-testid="export-json-btn"
        >
          Export JSON
        </button>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
        This PDF is for review only. E-file via IRS Free File or print and mail.
        {hasStates && ' State forms may need to be mailed to a different address than federal.'}
      </div>

      <InterviewNav interview={interview} />
    </div>
  )
}
