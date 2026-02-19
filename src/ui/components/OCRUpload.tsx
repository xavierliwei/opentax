/**
 * OCR upload pipeline component.
 *
 * Drag-and-drop zone → OCR scan → form detection → parsing → verification → store.
 * Reuses the upload UX pattern from CSVUpload.
 */

import { useState, useCallback, useRef } from 'react'
import { recognizeImage } from '../../intake/ocr/ocrEngine.ts'
import { detectFormType, type DetectedFormType } from '../../intake/ocr/formDetector.ts'
import { parseW2 } from '../../intake/ocr/w2Parser.ts'
import { parseForm1099Int } from '../../intake/ocr/form1099IntParser.ts'
import { parseForm1099Div } from '../../intake/ocr/form1099DivParser.ts'
import type { ExtractedField } from '../../intake/ocr/w2Parser.ts'
import {
  OCRVerification,
  buildVerificationFields,
  type VerificationField,
} from './OCRVerification.tsx'
import { useTaxStore } from '../../store/taxStore.ts'
import type { W2, Form1099INT, Form1099DIV } from '../../model/types.ts'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf']
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.pdf']

type UploadState =
  | { status: 'idle' }
  | { status: 'scanning'; progress: string }
  | { status: 'verification'; formType: DetectedFormType; imageUrl: string; fields: VerificationField[] }
  | { status: 'imported'; formType: DetectedFormType }
  | { status: 'error'; message: string }

interface OCRUploadProps {
  formType?: DetectedFormType
}

export function OCRUpload({ formType: expectedFormType }: OCRUploadProps) {
  const [state, setState] = useState<UploadState>({ status: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addW2 = useTaxStore((s) => s.addW2)
  const addForm1099INT = useTaxStore((s) => s.addForm1099INT)
  const addForm1099DIV = useTaxStore((s) => s.addForm1099DIV)

  const processFile = useCallback(async (file: File) => {
    // Validate file type
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_TYPES.includes(file.type)) {
      setState({ status: 'error', message: 'Unsupported file type. Please upload JPG, PNG, PDF, or HEIC.' })
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setState({ status: 'error', message: 'File is too large. Maximum size is 10MB.' })
      return
    }

    setState({ status: 'scanning', progress: 'Running OCR...' })

    try {
      const ocr = await recognizeImage(file)

      setState({ status: 'scanning', progress: 'Detecting form type...' })

      let detectedType = detectFormType(ocr)

      // If we expected a specific form type and detected unknown, use expected
      if (detectedType === 'unknown' && expectedFormType) {
        detectedType = expectedFormType
      }

      if (detectedType === 'unknown') {
        setState({ status: 'error', message: 'Could not detect form type. Please try a clearer image or enter data manually.' })
        return
      }

      // Parse based on detected type
      let extractedFields: Map<string, ExtractedField>

      switch (detectedType) {
        case 'W-2':
          extractedFields = parseW2(ocr).fields
          break
        case '1099-INT':
          extractedFields = parseForm1099Int(ocr).fields
          break
        case '1099-DIV':
          extractedFields = parseForm1099Div(ocr).fields
          break
        default:
          setState({ status: 'error', message: 'Unsupported form type detected.' })
          return
      }

      const imageUrl = URL.createObjectURL(file)
      const fields = buildVerificationFields(detectedType, extractedFields)

      setState({ status: 'verification', formType: detectedType, imageUrl, fields })
    } catch {
      setState({ status: 'error', message: 'OCR failed. Please try a clearer image.' })
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
            box12: [],
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
            box11: Number(fieldValues.get('box11')) || 0,
          }
          addForm1099DIV(form)
          break
        }
      }

      // Clean up image URL
      if (state.imageUrl) URL.revokeObjectURL(state.imageUrl)
      setState({ status: 'imported', formType })
    },
    [state, addW2, addForm1099INT, addForm1099DIV],
  )

  const handleDiscard = useCallback(() => {
    if (state.status === 'verification' && state.imageUrl) {
      URL.revokeObjectURL(state.imageUrl)
    }
    setState({ status: 'idle' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [state])

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
            Drag and drop a photo or scan of your {expectedFormType ?? 'tax form'}
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
            JPG, PNG, PDF, or HEIC (max 10MB). All processing is done locally.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.heic"
            className="hidden"
            onChange={handleFileInput}
            data-testid="ocr-file-input"
          />
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* Scanning */}
      {state.status === 'scanning' && (
        <div className="text-sm text-gray-500 text-center py-8" data-testid="ocr-scanning">
          <div className="inline-block animate-spin w-5 h-5 border-2 border-gray-300 border-t-tax-blue rounded-full mr-2 align-middle" />
          {state.progress}
        </div>
      )}

      {/* Verification */}
      {state.status === 'verification' && (
        <OCRVerification
          formType={state.formType}
          imageUrl={state.imageUrl}
          fields={state.fields}
          onConfirm={handleConfirm}
          onDiscard={handleDiscard}
        />
      )}

      {/* Imported */}
      {state.status === 'imported' && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm text-green-700">
            {state.formType} imported successfully from scan.
          </span>
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-gray-700"
            onClick={handleReset}
            data-testid="ocr-scan-another"
          >
            Scan another
          </button>
        </div>
      )}
    </div>
  )
}
