import { useState, useCallback, useRef } from 'react'
import { autoDetectBroker, type DetectionResult } from '../../intake/csv/autoDetect.ts'
import { convertToCapitalTransactions } from '../../intake/csv/convert.ts'
import { useTaxStore } from '../../store/taxStore.ts'

type UploadState =
  | { status: 'idle' }
  | { status: 'parsing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detection: DetectionResult; fileName: string }
  | { status: 'imported'; count: number }

export function CSVUpload() {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const setCapitalTransactions = useTaxStore((s) => s.setCapitalTransactions)

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setState({ status: 'error', message: 'Please upload a CSV file.' })
      return
    }

    setState({ status: 'parsing' })

    try {
      const text = await file.text()
      const detection = autoDetectBroker(text)

      if (detection.result.errors.length > 0 && detection.result.transactions.length === 0) {
        setState({
          status: 'error',
          message: detection.result.errors.join('; '),
        })
        return
      }

      setState({ status: 'ready', detection, fileName: file.name })
    } catch {
      setState({ status: 'error', message: 'Failed to read file.' })
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleImport = useCallback(() => {
    if (state.status !== 'ready') return
    const transactions = convertToCapitalTransactions(state.detection.result.transactions)
    setCapitalTransactions(transactions)
    setState({ status: 'imported', count: transactions.length })
  }, [state, setCapitalTransactions])

  const handleReset = useCallback(() => {
    setState({ status: 'idle' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // Summaries for ready state
  const summary =
    state.status === 'ready'
      ? (() => {
          const txns = state.detection.result.transactions
          const shortTerm = txns.filter((t) => t.longTerm === false)
          const longTerm = txns.filter((t) => t.longTerm === true)
          const shortGain = shortTerm.reduce((s, t) => s + t.gainLoss, 0)
          const longGain = longTerm.reduce((s, t) => s + t.gainLoss, 0)
          return { shortTerm, longTerm, shortGain, longGain }
        })()
      : null

  return (
    <div data-testid="csv-upload" className="flex flex-col gap-4">
      {/* Drop zone (shown when idle or error) */}
      {(state.status === 'idle' || state.status === 'error') && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-tax-blue bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <p className="text-sm text-gray-600">Drag and drop your CSV file here</p>
          <p className="mt-1 text-sm text-gray-500">
            or{' '}
            <button
              type="button"
              className="text-tax-blue underline hover:text-blue-700"
              onClick={() => fileInputRef.current?.click()}
            >
              click to browse
            </button>
          </p>
          <p className="mt-2 text-xs text-gray-400">Supported: Robinhood</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileInput}
            data-testid="csv-file-input"
          />
        </div>
      )}

      {/* Error state */}
      {state.status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* Parsing state */}
      {state.status === 'parsing' && (
        <div className="text-sm text-gray-500 text-center py-4">Parsing CSV...</div>
      )}

      {/* Ready state — show summary */}
      {state.status === 'ready' && summary && (
        <div className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-medium">
                Detected: {state.detection.parser.brokerName}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                {state.detection.confidence} confidence
              </span>
            </div>
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-gray-600"
              onClick={handleReset}
            >
              Clear
            </button>
          </div>

          <div className="text-sm text-gray-700 flex flex-col gap-1">
            <span>
              Transactions: {state.detection.result.rowCounts.parsed} parsed
              {state.detection.result.rowCounts.skipped > 0 &&
                `, ${state.detection.result.rowCounts.skipped} skipped`}
            </span>
            <span>
              Short-term: {summary.shortTerm.length} trades (
              {formatGain(summary.shortGain)})
            </span>
            <span>
              Long-term: {summary.longTerm.length} trades (
              {formatGain(summary.longGain)})
            </span>
          </div>

          {/* Warnings */}
          {state.detection.result.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2 text-xs text-yellow-800">
              <p className="font-medium mb-1">Warnings:</p>
              <ul className="list-disc ml-4 flex flex-col gap-0.5">
                {state.detection.result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Errors */}
          {state.detection.result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2 text-xs text-red-700">
              <p className="font-medium mb-1">Errors:</p>
              <ul className="list-disc ml-4 flex flex-col gap-0.5">
                {state.detection.result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            className="self-start px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:bg-blue-900"
            onClick={handleImport}
            data-testid="csv-import-btn"
          >
            Import {state.detection.result.transactions.length} transactions
          </button>
        </div>
      )}

      {/* Imported state */}
      {state.status === 'imported' && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm text-green-700">
            {state.count} transactions imported successfully.
          </span>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-700"
            onClick={handleReset}
          >
            Upload another
          </button>
        </div>
      )}
    </div>
  )
}

function formatGain(cents: number): string {
  const d = Math.abs(cents) / 100
  const formatted = d.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
  return cents >= 0 ? `+${formatted}` : `-${formatted}`
}
