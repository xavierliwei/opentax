import { useState, useEffect, useRef } from 'react'
import { Button } from './Button.tsx'

export type ExportMode = 'full' | 'redacted'

interface PIIExportDialogProps {
  open: boolean
  onConfirm: (mode: ExportMode) => void
  onCancel: () => void
  /** PII field descriptions found in the export (e.g., "Taxpayer SSN", "Employer EIN") */
  sensitiveFields: string[]
}

export function PIIExportDialog({
  open,
  onConfirm,
  onCancel,
  sensitiveFields,
}: PIIExportDialogProps) {
  const [mode, setMode] = useState<ExportMode>('redacted')
  const dialogRef = useRef<HTMLDivElement>(null)

  // Trap focus and handle Escape
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    // Focus the dialog for accessibility
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
      data-testid="pii-export-backdrop"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pii-dialog-title"
        aria-describedby="pii-dialog-desc"
        tabIndex={-1}
        className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        data-testid="pii-export-dialog"
      >
        {/* Warning icon + title */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 id="pii-dialog-title" className="text-base font-semibold text-gray-900">
              Sensitive Data Warning
            </h2>
            <p id="pii-dialog-desc" className="mt-1 text-sm text-gray-600">
              This export contains personally identifiable information. Avoid
              saving it to cloud storage, email, or other insecure locations.
            </p>
          </div>
        </div>

        {/* Sensitive fields list */}
        <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-xs font-medium text-amber-800 mb-1">Included sensitive fields:</p>
          <ul className="list-disc pl-4 text-xs text-amber-700 space-y-0.5">
            {sensitiveFields.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>

        {/* Export mode selector */}
        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm font-medium text-gray-700">Export mode</legend>
          <label className="flex items-start gap-2 cursor-pointer" data-testid="mode-redacted">
            <input
              type="radio"
              name="exportMode"
              value="redacted"
              checked={mode === 'redacted'}
              onChange={() => setMode('redacted')}
              className="mt-0.5 accent-brand"
            />
            <span className="text-sm">
              <span className="font-medium text-gray-900">Masked</span>
              <span className="text-gray-500"> — SSNs become ***-**-1234, EINs become **-***1234</span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer" data-testid="mode-full">
            <input
              type="radio"
              name="exportMode"
              value="full"
              checked={mode === 'full'}
              onChange={() => setMode('full')}
              className="mt-0.5 accent-brand"
            />
            <span className="text-sm">
              <span className="font-medium text-gray-900">Full (unredacted)</span>
              <span className="text-gray-500"> — all data exported as-is</span>
            </span>
          </label>
        </fieldset>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="md" onClick={onCancel} data-testid="pii-cancel-btn">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => onConfirm(mode)}
            data-testid="pii-confirm-btn"
          >
            Export JSON
          </Button>
        </div>
      </div>
    </div>
  )
}
