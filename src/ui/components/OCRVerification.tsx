/**
 * OCR verification UI — side-by-side image + extracted fields.
 *
 * Each field shows an editable input pre-filled with the OCR value,
 * plus a confidence badge (green >= 90%, yellow 70-89%, red < 70%).
 * User reviews, corrects, then confirms or discards.
 */

import { useState } from 'react'
import { CurrencyInput } from './CurrencyInput.tsx'
import type { DetectedFormType, ExtractedField } from '../../intake/pdf/genericFormPdfParser.ts'

// ── Types ──────────────────────────────────────────────────────

export interface VerificationField {
  key: string
  label: string
  value: string        // For monetary: string of cents. For text: raw string.
  confidence: number   // 0–1
  type: 'monetary' | 'text'
}

interface OCRVerificationProps {
  formType: DetectedFormType
  imageUrl?: string
  isPdf?: boolean
  fields: VerificationField[]
  onConfirm: (fields: Map<string, string>) => void
  onDiscard: () => void
}

// ── Field definitions per form type ──────────────────────────

const W2_FIELD_DEFS: { key: string; label: string; type: 'monetary' | 'text' }[] = [
  { key: 'employerName', label: 'Employer name', type: 'text' },
  { key: 'employerEin', label: 'Employer EIN', type: 'text' },
  { key: 'box1', label: 'Box 1 — Wages', type: 'monetary' },
  { key: 'box2', label: 'Box 2 — Federal tax withheld', type: 'monetary' },
  { key: 'box3', label: 'Box 3 — Social Security wages', type: 'monetary' },
  { key: 'box4', label: 'Box 4 — Social Security tax', type: 'monetary' },
  { key: 'box5', label: 'Box 5 — Medicare wages', type: 'monetary' },
  { key: 'box6', label: 'Box 6 — Medicare tax', type: 'monetary' },
  { key: 'box15State', label: 'Box 15 — State', type: 'text' },
  { key: 'box16StateWages', label: 'Box 16 — State wages', type: 'monetary' },
  { key: 'box17StateIncomeTax', label: 'Box 17 — State income tax', type: 'monetary' },
]

const FORM_1099_INT_FIELD_DEFS: { key: string; label: string; type: 'monetary' | 'text' }[] = [
  { key: 'payerName', label: 'Payer name', type: 'text' },
  { key: 'box1', label: 'Box 1 — Interest income', type: 'monetary' },
  { key: 'box2', label: 'Box 2 — Early withdrawal penalty', type: 'monetary' },
  { key: 'box3', label: 'Box 3 — US Savings Bonds', type: 'monetary' },
  { key: 'box4', label: 'Box 4 — Federal tax withheld', type: 'monetary' },
  { key: 'box8', label: 'Box 8 — Tax-exempt interest', type: 'monetary' },
]

const FORM_1099_DIV_FIELD_DEFS: { key: string; label: string; type: 'monetary' | 'text' }[] = [
  { key: 'payerName', label: 'Payer name', type: 'text' },
  { key: 'box1a', label: 'Box 1a — Ordinary dividends', type: 'monetary' },
  { key: 'box1b', label: 'Box 1b — Qualified dividends', type: 'monetary' },
  { key: 'box2a', label: 'Box 2a — Capital gain distributions', type: 'monetary' },
  { key: 'box4', label: 'Box 4 — Federal tax withheld', type: 'monetary' },
  { key: 'box5', label: 'Box 5 — Section 199A dividends', type: 'monetary' },
  { key: 'box11', label: 'Box 11 — Exempt-interest dividends', type: 'monetary' },
]

export function getFieldDefsForType(formType: DetectedFormType) {
  switch (formType) {
    case 'W-2': return W2_FIELD_DEFS
    case '1099-INT': return FORM_1099_INT_FIELD_DEFS
    case '1099-DIV': return FORM_1099_DIV_FIELD_DEFS
    default: return []
  }
}

export function buildVerificationFields(
  formType: DetectedFormType,
  extractedFields: Map<string, ExtractedField>,
): VerificationField[] {
  const defs = getFieldDefsForType(formType)
  return defs.map((def) => {
    const extracted = extractedFields.get(def.key)
    return {
      key: def.key,
      label: def.label,
      value: extracted?.value ?? (def.type === 'monetary' ? '0' : ''),
      confidence: extracted?.confidence ?? 0,
      type: def.type,
    }
  })
}

// ── Component ──────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  let colorClass: string
  if (confidence >= 0.9) colorClass = 'bg-green-100 text-green-800'
  else if (confidence >= 0.7) colorClass = 'bg-yellow-100 text-yellow-800'
  else colorClass = 'bg-red-100 text-red-800'

  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded ${colorClass}`}
      data-testid="confidence-badge"
    >
      {pct}%
    </span>
  )
}

export function OCRVerification({
  formType,
  imageUrl,
  isPdf,
  fields: initialFields,
  onConfirm,
  onDiscard,
}: OCRVerificationProps) {
  const [fields, setFields] = useState<VerificationField[]>(initialFields)

  const updateField = (key: string, newValue: string) => {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value: newValue } : f)),
    )
  }

  const handleConfirm = () => {
    const result = new Map<string, string>()
    for (const field of fields) {
      result.set(field.key, field.value)
    }
    onConfirm(result)
  }

  return (
    <div data-testid="ocr-verification" className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">
          Detected: {formType}
        </span>
        <span className="text-xs text-gray-500 ml-2">Review and correct the extracted values</span>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* Left: original image or PDF placeholder */}
        <div className="md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50">
          {isPdf ? (
            <div className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg h-48" data-testid="ocr-preview-pdf">
              <div className="text-center text-gray-400">
                <div className="text-3xl mb-1">PDF</div>
                <div className="text-xs">Document uploaded</div>
              </div>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt="Uploaded tax form"
              className="w-full rounded shadow-sm"
              data-testid="ocr-preview-image"
            />
          )}
        </div>

        {/* Right: extracted fields */}
        <div className="md:w-1/2 p-4 flex flex-col gap-3">
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">{field.label}</label>
                {field.confidence > 0 && <ConfidenceBadge confidence={field.confidence} />}
              </div>
              {field.type === 'monetary' ? (
                <CurrencyInput
                  label=""
                  value={Number(field.value) || 0}
                  onChange={(cents) => updateField(field.key, String(cents))}
                />
              ) : (
                <input
                  type="text"
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tax-blue focus:border-transparent"
                  value={field.value}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  data-testid={`ocr-field-${field.key}`}
                />
              )}
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:bg-blue-900"
              onClick={handleConfirm}
              data-testid="ocr-confirm-btn"
            >
              Confirm & Add
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={onDiscard}
              data-testid="ocr-discard-btn"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
