import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// Mock idb for the store
vi.mock('idb', () => ({
  openDB: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => Promise.resolve(undefined)),
      put: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    }),
  ),
}))

// Mock pdfjs-dist to avoid loading real WASM worker
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

// Mock the generic PDF parser
vi.mock('../../../src/intake/pdf/genericFormPdfParser.ts', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    parseGenericFormPdf: vi.fn(),
  }
})

// Mock the autoDetectPdf broker
vi.mock('../../../src/intake/pdf/autoDetectPdf.ts', () => ({
  autoDetectPdfBroker: vi.fn(),
}))

// Mock pdfUtils to avoid worker setup
vi.mock('../../../src/intake/pdf/pdfUtils', () => ({
  ensureWorker: vi.fn(() => Promise.resolve()),
  extractItems: vi.fn(() => Promise.resolve([])),
  groupLines: vi.fn(() => []),
}))

const { parseGenericFormPdf } = await import('../../../src/intake/pdf/genericFormPdfParser.ts')
const { autoDetectPdfBroker } = await import('../../../src/intake/pdf/autoDetectPdf.ts')
const { useTaxStore } = await import('../../../src/store/taxStore.ts')
import { OCRUpload } from '../../../src/ui/components/OCRUpload.tsx'
import type { ExtractedField } from '../../../src/intake/pdf/genericFormPdfParser.ts'
import type { PdfParseOutput } from '../../../src/intake/pdf/autoDetectPdf.ts'

// ── Helpers ──────────────────────────────────────────────────

function makeW2Fields(): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()
  fields.set('employerName', { value: 'ACME Corp', confidence: 1.0 })
  fields.set('employerEin', { value: '12-3456789', confidence: 1.0 })
  fields.set('box1', { value: '7500000', confidence: 1.0 })
  fields.set('box2', { value: '1250000', confidence: 1.0 })
  fields.set('box3', { value: '7500000', confidence: 1.0 })
  fields.set('box4', { value: '465000', confidence: 1.0 })
  fields.set('box5', { value: '7500000', confidence: 1.0 })
  fields.set('box6', { value: '108750', confidence: 1.0 })
  return fields
}

function make1099IntFields(): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()
  fields.set('payerName', { value: 'Chase', confidence: 1.0 })
  fields.set('box1', { value: '125000', confidence: 1.0 })
  fields.set('box4', { value: '12500', confidence: 1.0 })
  return fields
}

function make1099DivFields(): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()
  fields.set('payerName', { value: 'Vanguard', confidence: 1.0 })
  fields.set('box1a', { value: '350000', confidence: 1.0 })
  fields.set('box1b', { value: '280000', confidence: 1.0 })
  fields.set('box4', { value: '35000', confidence: 1.0 })
  return fields
}

function emptyBrokerResult(): PdfParseOutput {
  return {
    transactions: [],
    warnings: [],
    errors: ['Could not detect a supported broker or form type in this PDF.'],
    rowCounts: { total: 0, parsed: 0, skipped: 0 },
    form1099DIVs: [],
    form1099INTs: [],
    brokerName: 'Unknown Broker',
  }
}

function renderOCRUpload(formType?: 'W-2' | '1099-INT' | '1099-DIV') {
  return render(
    <MemoryRouter>
      <OCRUpload formType={formType} />
    </MemoryRouter>,
  )
}

function createPdfFile(name = 'w2.pdf') {
  return new File(['%PDF-1.4 fake data'], name, { type: 'application/pdf' })
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
  vi.mocked(parseGenericFormPdf).mockReset()
  vi.mocked(autoDetectPdfBroker).mockReset()
  // Default: broker detection returns empty (no broker found)
  vi.mocked(autoDetectPdfBroker).mockResolvedValue(emptyBrokerResult())
})

describe('OCRUpload', () => {
  it('renders drop zone in idle state', () => {
    renderOCRUpload('W-2')
    expect(screen.getByText(/Upload your W-2 PDF/)).toBeDefined()
    expect(screen.getByText(/PDF only/)).toBeDefined()
  })

  it('shows custom form type in drop zone text', () => {
    renderOCRUpload('1099-INT')
    expect(screen.getByText(/your 1099-INT/)).toBeDefined()
  })

  it('rejects non-PDF files', async () => {
    renderOCRUpload('W-2')
    const fileInput = screen.getByTestId('ocr-file-input')

    const file = new File(['data'], 'w2.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/Please upload a PDF file/)).toBeDefined()
    })
  })

  it('rejects files that are too large', async () => {
    renderOCRUpload('W-2')
    const fileInput = screen.getByTestId('ocr-file-input')

    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [bigFile] } })

    await waitFor(() => {
      expect(screen.getByText(/too large/)).toBeDefined()
    })
  })

  it('parses PDF and shows verification for W-2', async () => {
    vi.mocked(parseGenericFormPdf).mockResolvedValue({
      formType: 'W-2',
      fields: makeW2Fields(),
      warnings: [],
    })
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createPdfFile())

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    expect(screen.getByText('Detected: W-2')).toBeDefined()
    expect(screen.getByTestId('ocr-preview-pdf')).toBeDefined()
    expect(screen.getByTestId('ocr-confirm-btn')).toBeDefined()
    expect(screen.getByTestId('ocr-discard-btn')).toBeDefined()
  })

  it('confirms W-2 and adds to store', async () => {
    vi.mocked(parseGenericFormPdf).mockResolvedValue({
      formType: 'W-2',
      fields: makeW2Fields(),
      warnings: [],
    })
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createPdfFile())

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('ocr-confirm-btn'))

    await waitFor(() => {
      expect(screen.getByText(/imported successfully/)).toBeDefined()
    })

    const store = useTaxStore.getState()
    expect(store.taxReturn.w2s).toHaveLength(1)
    expect(store.taxReturn.w2s[0].employerName).toBe('ACME Corp')
    expect(store.taxReturn.w2s[0].box1).toBe(7500000)
  })

  it('discards returns to idle', async () => {
    vi.mocked(parseGenericFormPdf).mockResolvedValue({
      formType: 'W-2',
      fields: makeW2Fields(),
      warnings: [],
    })
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createPdfFile())

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('ocr-discard-btn'))

    expect(screen.getByText(/Upload your W-2 PDF/)).toBeDefined()
    expect(useTaxStore.getState().taxReturn.w2s).toHaveLength(0)
  })

  it('confirms 1099-INT and adds to store', async () => {
    vi.mocked(parseGenericFormPdf).mockResolvedValue({
      formType: '1099-INT',
      fields: make1099IntFields(),
      warnings: [],
    })
    renderOCRUpload('1099-INT')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createPdfFile('1099int.pdf'))

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('ocr-confirm-btn'))

    await waitFor(() => {
      expect(screen.getByText(/imported successfully/)).toBeDefined()
    })

    const store = useTaxStore.getState()
    expect(store.taxReturn.form1099INTs).toHaveLength(1)
    expect(store.taxReturn.form1099INTs[0].payerName).toBe('Chase')
    expect(store.taxReturn.form1099INTs[0].box1).toBe(125000)
  })

  it('confirms 1099-DIV and adds to store', async () => {
    vi.mocked(parseGenericFormPdf).mockResolvedValue({
      formType: '1099-DIV',
      fields: make1099DivFields(),
      warnings: [],
    })
    renderOCRUpload('1099-DIV')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createPdfFile('1099div.pdf'))

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('ocr-confirm-btn'))

    await waitFor(() => {
      expect(screen.getByText(/imported successfully/)).toBeDefined()
    })

    const store = useTaxStore.getState()
    expect(store.taxReturn.form1099DIVs).toHaveLength(1)
    expect(store.taxReturn.form1099DIVs[0].payerName).toBe('Vanguard')
    expect(store.taxReturn.form1099DIVs[0].box1a).toBe(350000)
  })

  it('shows error when PDF parsing fails', async () => {
    vi.mocked(autoDetectPdfBroker).mockRejectedValue(new Error('PDF load failed'))
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createPdfFile())

    await waitFor(() => {
      expect(screen.getByText(/Failed to read PDF/)).toBeDefined()
    })
  })

  it('shows error when form type is unknown', async () => {
    vi.mocked(parseGenericFormPdf).mockResolvedValue({
      formType: 'unknown',
      fields: new Map(),
      warnings: [],
    })
    renderOCRUpload()

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createPdfFile())

    await waitFor(() => {
      expect(screen.getByText(/Could not detect form type/)).toBeDefined()
    })
  })

  it('falls back to expected form type when detection is unknown', async () => {
    vi.mocked(parseGenericFormPdf).mockResolvedValue({
      formType: 'unknown',
      fields: make1099IntFields(),
      warnings: [],
    })
    renderOCRUpload('1099-INT')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createPdfFile())

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    expect(screen.getByText('Detected: 1099-INT')).toBeDefined()
  })

  it('handles consolidated broker PDF (Fidelity 1099-INT)', async () => {
    vi.mocked(autoDetectPdfBroker).mockResolvedValue({
      transactions: [],
      warnings: [],
      errors: [],
      rowCounts: { total: 0, parsed: 0, skipped: 0 },
      form1099DIVs: [],
      form1099INTs: [{
        id: 'test-id',
        payerName: 'Fidelity Brokerage Services LLC',
        box1: 5000,
        box2: 0,
        box3: 0,
        box4: 500,
        box8: 0,
      }],
      brokerName: 'Fidelity',
    })
    renderOCRUpload('1099-INT')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createPdfFile('fidelity-1099.pdf'))

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    expect(screen.getByText('Detected: 1099-INT')).toBeDefined()
    // parseGenericFormPdf should NOT be called when broker detection succeeds
    expect(parseGenericFormPdf).not.toHaveBeenCalled()
  })

  it('can upload another after import', async () => {
    vi.mocked(parseGenericFormPdf).mockResolvedValue({
      formType: 'W-2',
      fields: makeW2Fields(),
      warnings: [],
    })
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createPdfFile())

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('ocr-confirm-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('ocr-scan-another')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('ocr-scan-another'))

    expect(screen.getByText(/Upload your W-2 PDF/)).toBeDefined()
  })

  it('handles drag and drop', async () => {
    vi.mocked(parseGenericFormPdf).mockResolvedValue({
      formType: 'W-2',
      fields: makeW2Fields(),
      warnings: [],
    })
    renderOCRUpload('W-2')

    const dropZone = screen.getByText(/Upload your/).closest('div')!
    const file = createPdfFile()

    fireEvent.dragOver(dropZone, { dataTransfer: { files: [file] } })
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })
  })

  it('shows PDF placeholder instead of image preview', async () => {
    vi.mocked(parseGenericFormPdf).mockResolvedValue({
      formType: 'W-2',
      fields: makeW2Fields(),
      warnings: [],
    })
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createPdfFile())

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    expect(screen.getByTestId('ocr-preview-pdf')).toBeDefined()
    expect(screen.getByText('Document uploaded')).toBeDefined()
  })
})
