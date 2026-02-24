/**
 * PDF upload pipeline component.
 *
 * Drag-and-drop zone → pdfjs-dist text extraction → form detection → parsing → verification → store.
 * Supports both broker consolidated PDFs (Fidelity/Robinhood) and standalone form PDFs
 * (W-2, 1099-INT, 1099-DIV).
 */

import { useState, useCallback, useRef } from 'react'
import { parseGenericFormPdf, type DetectedFormType, type ExtractedField } from '../../intake/pdf/genericFormPdfParser.ts'
import { autoDetectPdfBroker } from '../../intake/pdf/autoDetectPdf.ts'
import type { Form1099INT, Form1099DIV, Form1099R } from '../../model/types.ts'
import {
  OCRVerification,
  buildVerificationFields,
  type VerificationField,
} from './OCRVerification.tsx'
import { useTaxStore } from '../../store/taxStore.ts'
import type { W2 } from '../../model/types.ts'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

type UploadState =
  | { status: 'idle' }
  | { status: 'scanning'; progress: string }
  | { status: 'verification'; formType: DetectedFormType; isPdf: true; fields: VerificationField[] }
  | { status: 'imported'; formType: DetectedFormType }
  | { status: 'error'; message: string }

interface OCRUploadProps {
  formType?: DetectedFormType
}

/**
 * Try to extract forms from a broker consolidated PDF (Fidelity, Robinhood).
 * Returns extracted fields if successful, null otherwise.
 */
async function tryConsolidatedPdf(
  data: ArrayBuffer,
  expectedFormType?: DetectedFormType,
): Promise<{ formType: DetectedFormType; fields: Map<string, ExtractedField> } | null> {
  const result = await autoDetectPdfBroker(data)

  // Check if this broker PDF has the form type we're looking for
  if (expectedFormType === '1099-INT' && result.form1099INTs.length > 0) {
    return { formType: '1099-INT', fields: form1099IntToFields(result.form1099INTs[0]) }
  }
  if (expectedFormType === '1099-DIV' && result.form1099DIVs.length > 0) {
    return { formType: '1099-DIV', fields: form1099DivToFields(result.form1099DIVs[0]) }
  }

  // If no specific type expected, try to find any form
  if (!expectedFormType) {
    if (result.form1099INTs.length > 0) {
      return { formType: '1099-INT', fields: form1099IntToFields(result.form1099INTs[0]) }
    }
    if (result.form1099DIVs.length > 0) {
      return { formType: '1099-DIV', fields: form1099DivToFields(result.form1099DIVs[0]) }
    }
  }

  // Check for actionable error messages from broker detection
  if (result.errors.length > 0 && result.brokerName && result.brokerName !== 'Unknown Broker') {
    // Return null but let the standalone parser try
    return null
  }

  return null
}

function form1099IntToFields(form: Form1099INT): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()
  if (form.payerName) fields.set('payerName', { value: form.payerName, confidence: 1.0 })
  if (form.box1) fields.set('box1', { value: String(form.box1), confidence: 1.0 })
  if (form.box2) fields.set('box2', { value: String(form.box2), confidence: 1.0 })
  if (form.box3) fields.set('box3', { value: String(form.box3), confidence: 1.0 })
  if (form.box4) fields.set('box4', { value: String(form.box4), confidence: 1.0 })
  if (form.box8) fields.set('box8', { value: String(form.box8), confidence: 1.0 })
  return fields
}

function form1099DivToFields(form: Form1099DIV): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()
  if (form.payerName) fields.set('payerName', { value: form.payerName, confidence: 1.0 })
  if (form.box1a) fields.set('box1a', { value: String(form.box1a), confidence: 1.0 })
  if (form.box1b) fields.set('box1b', { value: String(form.box1b), confidence: 1.0 })
  if (form.box2a) fields.set('box2a', { value: String(form.box2a), confidence: 1.0 })
  if (form.box4) fields.set('box4', { value: String(form.box4), confidence: 1.0 })
  if (form.box5) fields.set('box5', { value: String(form.box5), confidence: 1.0 })
  if (form.box11) fields.set('box11', { value: String(form.box11), confidence: 1.0 })
  return fields
}

export function OCRUpload({ formType: expectedFormType }: OCRUploadProps) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addW2 = useTaxStore((s) => s.addW2)
  const addForm1099INT = useTaxStore((s) => s.addForm1099INT)
  const addForm1099DIV = useTaxStore((s) => s.addForm1099DIV)
  const addForm1099R = useTaxStore((s) => s.addForm1099R)

  const processFile = useCallback(async (file: File) => {
    // Validate: accept only PDF
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setState({ status: 'error', message: 'Please upload a PDF file.' })
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setState({ status: 'error', message: 'File is too large. Maximum size is 10MB.' })
      return
    }

    setState({ status: 'scanning', progress: 'Extracting text from PDF...' })

    try {
      const buf = await file.arrayBuffer()

      // Try consolidated broker PDF first (Fidelity/Robinhood)
      const consolidated = await tryConsolidatedPdf(buf.slice(0), expectedFormType)
      if (consolidated) {
        const fields = buildVerificationFields(consolidated.formType, consolidated.fields)
        setState({ status: 'verification', formType: consolidated.formType, fields, isPdf: true })
        return
      }

      // Standalone form PDF (bank 1099-INT, individual 1099-DIV, W-2)
      const result = await parseGenericFormPdf(buf)

      // If standalone detection is unknown but we have an expected type, retry with that hint
      let detectedType = result.formType
      if (detectedType === 'unknown' && expectedFormType) {
        detectedType = expectedFormType
      }

      if (detectedType === 'unknown') {
        setState({ status: 'error', message: 'Could not detect form type in this PDF. Supported: W-2, 1099-INT, 1099-DIV.' })
        return
      }

      const fields = buildVerificationFields(detectedType, result.fields)
      setState({ status: 'verification', formType: detectedType, fields, isPdf: true })
    } catch {
      setState({ status: 'error', message: 'Failed to read PDF. The file may be corrupted or password-protected.' })
    }
  }, [expectedFormType])

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

  const handleConfirm = useCallback(
    (fieldValues: Map<string, string>) => {
      if (state.status !== 'verification') return

      const { formType } = state

      switch (formType) {
        case 'W-2': {
          const w2: W2 = {
            id: crypto.randomUUID(),
            employerEin: fieldValues.get('employerEin') ?? '',
            employerName: fieldValues.get('employerName') ?? '',
            box1: Number(fieldValues.get('box1')) || 0,
            box2: Number(fieldValues.get('box2')) || 0,
            box3: Number(fieldValues.get('box3')) || 0,
            box4: Number(fieldValues.get('box4')) || 0,
            box5: Number(fieldValues.get('box5')) || 0,
            box6: Number(fieldValues.get('box6')) || 0,
            box7: 0,
            box8: 0,
            box10: 0,
            box11: 0,
            box12: (['a', 'b', 'c', 'd'] as const)
              .map(slot => ({
                code: fieldValues.get(`box12${slot}_code`) ?? '',
                amount: Number(fieldValues.get(`box12${slot}_amount`)) || 0,
              }))
              .filter(e => e.code !== ''),
            box13StatutoryEmployee: false,
            box13RetirementPlan: false,
            box13ThirdPartySickPay: false,
            box14: '',
            box15State: fieldValues.get('box15State'),
            box16StateWages: Number(fieldValues.get('box16StateWages')) || 0,
            box17StateIncomeTax: Number(fieldValues.get('box17StateIncomeTax')) || 0,
          }
          addW2(w2)
          break
        }
        case '1099-INT': {
          const form: Form1099INT = {
            id: crypto.randomUUID(),
            payerName: fieldValues.get('payerName') ?? '',
            box1: Number(fieldValues.get('box1')) || 0,
            box2: Number(fieldValues.get('box2')) || 0,
            box3: Number(fieldValues.get('box3')) || 0,
            box4: Number(fieldValues.get('box4')) || 0,
            box6: Number(fieldValues.get('box6')) || 0,
            box8: Number(fieldValues.get('box8')) || 0,
          }
          addForm1099INT(form)
          break
        }
        case '1099-DIV': {
          const form: Form1099DIV = {
            id: crypto.randomUUID(),
            payerName: fieldValues.get('payerName') ?? '',
            box1a: Number(fieldValues.get('box1a')) || 0,
            box1b: Number(fieldValues.get('box1b')) || 0,
            box2a: Number(fieldValues.get('box2a')) || 0,
            box3: 0,
            box4: Number(fieldValues.get('box4')) || 0,
            box5: Number(fieldValues.get('box5')) || 0,
            box7: Number(fieldValues.get('box7')) || 0,
            box11: Number(fieldValues.get('box11')) || 0,
          }
          addForm1099DIV(form)
          break
        }
        case '1099-R': {
          const form: Form1099R = {
            id: crypto.randomUUID(),
            payerName: fieldValues.get('payerName') ?? '',
            box1: Number(fieldValues.get('box1')) || 0,
            box2a: Number(fieldValues.get('box2a')) || 0,
            box2bTaxableNotDetermined: false,
            box2bTotalDistribution: false,
            box3: Number(fieldValues.get('box3')) || 0,
            box4: Number(fieldValues.get('box4')) || 0,
            box5: Number(fieldValues.get('box5')) || 0,
            box7: fieldValues.get('box7') ?? '',
            iraOrSep: fieldValues.get('iraOrSep') === 'true',
          }
          addForm1099R(form)
          break
        }
      }

      setState({ status: 'imported', formType })
    },
    [state, addW2, addForm1099INT, addForm1099DIV, addForm1099R],
  )

  const handleDiscard = useCallback(() => {
    setState({ status: 'idle' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleReset = useCallback(() => {
    setState({ status: 'idle' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  return (
    <div data-testid="ocr-upload" className="flex flex-col gap-4">
      {/* Drop zone (idle or error) */}
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
          <p className="text-sm text-gray-600">
            Upload your {expectedFormType ?? 'tax form'} PDF
          </p>
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
          <p className="mt-2 text-xs text-gray-400">
            PDF only (max 10MB). All processing is local.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileInput}
            data-testid="ocr-file-input"
          />
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* Scanning */}
      {state.status === 'scanning' && (
        <div role="status" aria-live="polite" className="text-sm text-gray-500 text-center py-8" data-testid="ocr-scanning">
          <div className="inline-block animate-spin w-5 h-5 border-2 border-gray-300 border-t-tax-blue rounded-full mr-2 align-middle" />
          {state.progress}
        </div>
      )}

      {/* Verification */}
      {state.status === 'verification' && (
        <OCRVerification
          formType={state.formType}
          isPdf={state.isPdf}
          fields={state.fields}
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
        />
      )}

      {/* Imported */}
      {state.status === 'imported' && (
        <div role="status" className="border border-green-200 bg-green-50 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm text-green-700">
            {state.formType} imported successfully from PDF.
          </span>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-700"
            onClick={handleReset}
            data-testid="ocr-scan-another"
          >
            Upload another
          </button>
        </div>
      )}
    </div>
  )
}
