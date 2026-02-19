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

// Mock tesseract.js entirely
vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
}))

// Mock the OCR engine module
vi.mock('../../../src/intake/ocr/ocrEngine.ts', () => ({
  recognizeImage: vi.fn(),
  getOCRWorker: vi.fn(),
  terminateOCRWorker: vi.fn(),
}))

const { recognizeImage } = await import('../../../src/intake/ocr/ocrEngine.ts')
const { useTaxStore } = await import('../../../src/store/taxStore.ts')
import { OCRUpload } from '../../../src/ui/components/OCRUpload.tsx'
import type { OCRResult, OCRWord } from '../../../src/intake/ocr/ocrEngine.ts'

// Mock URL.createObjectURL/revokeObjectURL (not available in jsdom)
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
}

// ── Helpers ──────────────────────────────────────────────────

function word(text: string, x0: number, y0: number, x1: number, y1: number, confidence = 95): OCRWord {
  return { text, bbox: { x0, y0, x1, y1 }, confidence }
}

function makeW2OCRResult(): OCRResult {
  return {
    words: [
      word('Wage', 10, 10, 50, 25),
      word('and', 55, 10, 75, 25),
      word('Tax', 80, 10, 105, 25),
      word('Statement', 110, 10, 180, 25),
      word('Employer', 10, 40, 80, 55),
      word('ACME', 85, 40, 135, 55, 93),
      word('EIN', 10, 70, 35, 85),
      word('12-3456789', 130, 70, 220, 85, 91),
      word('Box', 10, 90, 35, 105),
      word('1', 40, 90, 50, 105),
      word('$75,000.00', 130, 90, 230, 105, 88),
      word('Box', 10, 120, 35, 135),
      word('2', 40, 120, 50, 135),
      word('$12,500.00', 130, 120, 230, 135, 90),
      word('Box', 10, 150, 35, 165),
      word('3', 40, 150, 50, 165),
      word('$75,000.00', 130, 150, 230, 165),
      word('Box', 10, 180, 35, 195),
      word('4', 40, 180, 50, 195),
      word('$4,650.00', 130, 180, 220, 195),
      word('Box', 10, 210, 35, 225),
      word('5', 40, 210, 50, 225),
      word('$75,000.00', 130, 210, 230, 225),
      word('Box', 10, 240, 35, 255),
      word('6', 40, 240, 50, 255),
      word('$1,087.50', 130, 240, 220, 255),
    ],
    confidence: 90,
    rawText: 'Wage and Tax Statement Form W-2 Employer ACME EIN 12-3456789 Box 1 $75,000.00 Box 2 $12,500.00',
  }
}

function make1099IntOCRResult(): OCRResult {
  return {
    words: [
      word('Form', 10, 10, 50, 25),
      word('1099-INT', 55, 10, 130, 25),
      word('Interest', 10, 30, 75, 45),
      word('Income', 80, 30, 130, 45),
      word('Payer', 10, 60, 55, 75),
      word('Chase', 130, 60, 185, 75, 93),
      word('Box', 10, 90, 35, 105),
      word('1', 40, 90, 50, 105),
      word('$1,250.00', 130, 90, 220, 105, 91),
      word('Box', 10, 120, 35, 135),
      word('4', 40, 120, 50, 135),
      word('$125.00', 130, 120, 210, 135, 92),
    ],
    confidence: 90,
    rawText: 'Form 1099-INT Interest Income Payer Chase Box 1 $1,250.00 Box 4 $125.00',
  }
}

function make1099DivOCRResult(): OCRResult {
  return {
    words: [
      word('Form', 10, 10, 50, 25),
      word('1099-DIV', 55, 10, 130, 25),
      word('Dividends', 10, 30, 90, 45),
      word('and', 95, 30, 115, 45),
      word('Distributions', 120, 30, 220, 45),
      word('Payer', 10, 60, 55, 75),
      word('Vanguard', 130, 60, 210, 75, 94),
      word('Box', 10, 90, 35, 105),
      word('1a', 40, 90, 58, 105),
      word('$3,500.00', 130, 90, 220, 105, 91),
      word('Box', 10, 120, 35, 135),
      word('1b', 40, 120, 58, 135),
      word('$2,800.00', 130, 120, 220, 135, 90),
      word('Box', 10, 150, 35, 165),
      word('4', 40, 150, 50, 165),
      word('$350.00', 130, 150, 210, 165, 92),
    ],
    confidence: 90,
    rawText: 'Form 1099-DIV Dividends and Distributions Payer Vanguard Box 1a $3,500.00 Box 1b $2,800.00',
  }
}

function renderOCRUpload(formType?: 'W-2' | '1099-INT' | '1099-DIV') {
  return render(
    <MemoryRouter>
      <OCRUpload formType={formType} />
    </MemoryRouter>,
  )
}

function createImageFile(name = 'w2.jpg', type = 'image/jpeg') {
  return new File(['fake-image-data'], name, { type })
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
  vi.mocked(recognizeImage).mockReset()
})

describe('OCRUpload', () => {
  it('renders drop zone in idle state', () => {
    renderOCRUpload('W-2')
    expect(screen.getByText(/Drag and drop a photo or scan/)).toBeDefined()
    expect(screen.getByText(/JPG, PNG, PDF, or HEIC/)).toBeDefined()
  })

  it('shows custom form type in drop zone text', () => {
    renderOCRUpload('1099-INT')
    expect(screen.getByText(/your 1099-INT/)).toBeDefined()
  })

  it('rejects files that are too large', async () => {
    renderOCRUpload('W-2')
    const fileInput = screen.getByTestId('ocr-file-input')

    // Create a file that exceeds 10MB (fake it by checking size constraint)
    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [bigFile] } })

    await waitFor(() => {
      expect(screen.getByText(/too large/)).toBeDefined()
    })
  })

  it('rejects unsupported file types', async () => {
    renderOCRUpload('W-2')
    const fileInput = screen.getByTestId('ocr-file-input')

    const file = new File(['data'], 'doc.docx', { type: 'application/msword' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/Unsupported file type/)).toBeDefined()
    })
  })

  it('runs OCR and shows verification for W-2', async () => {
    vi.mocked(recognizeImage).mockResolvedValue(makeW2OCRResult())
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    const file = createImageFile()
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    expect(screen.getByText('Detected: W-2')).toBeDefined()
    expect(screen.getByTestId('ocr-confirm-btn')).toBeDefined()
    expect(screen.getByTestId('ocr-discard-btn')).toBeDefined()
  })

  it('confirms W-2 and adds to store', async () => {
    vi.mocked(recognizeImage).mockResolvedValue(makeW2OCRResult())
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createImageFile())

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('ocr-confirm-btn'))

    await waitFor(() => {
      expect(screen.getByText(/imported successfully/)).toBeDefined()
    })

    const store = useTaxStore.getState()
    expect(store.taxReturn.w2s).toHaveLength(1)
    expect(store.taxReturn.w2s[0].employerName).toBe('ACME')
    expect(store.taxReturn.w2s[0].box1).toBe(7500000)
  })

  it('discards returns to idle', async () => {
    vi.mocked(recognizeImage).mockResolvedValue(makeW2OCRResult())
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createImageFile())

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('ocr-discard-btn'))

    expect(screen.getByText(/Drag and drop a photo or scan/)).toBeDefined()
    expect(useTaxStore.getState().taxReturn.w2s).toHaveLength(0)
  })

  it('confirms 1099-INT and adds to store', async () => {
    vi.mocked(recognizeImage).mockResolvedValue(make1099IntOCRResult())
    renderOCRUpload('1099-INT')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createImageFile('1099int.png', 'image/png'))

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
    vi.mocked(recognizeImage).mockResolvedValue(make1099DivOCRResult())
    renderOCRUpload('1099-DIV')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createImageFile('1099div.jpg'))

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

  it('shows error when OCR fails', async () => {
    vi.mocked(recognizeImage).mockRejectedValue(new Error('WASM load failed'))
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createImageFile())

    await waitFor(() => {
      expect(screen.getByText(/OCR failed/)).toBeDefined()
    })
  })

  it('shows error when form type is unknown', async () => {
    vi.mocked(recognizeImage).mockResolvedValue({
      words: [],
      confidence: 50,
      rawText: 'random unrecognizable text',
    })
    // No expected form type — should fail detection
    renderOCRUpload()

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createImageFile())

    await waitFor(() => {
      expect(screen.getByText(/Could not detect form type/)).toBeDefined()
    })
  })

  it('falls back to expected form type when detection is unknown', async () => {
    vi.mocked(recognizeImage).mockResolvedValue({
      words: [
        word('Payer', 10, 10, 55, 25),
        word('SomeBank', 130, 10, 210, 25, 90),
        word('Box', 10, 50, 35, 65),
        word('1', 40, 50, 50, 65),
        word('$500.00', 130, 50, 210, 65, 88),
      ],
      confidence: 70,
      rawText: 'Payer SomeBank Box 1 $500.00',
    })
    renderOCRUpload('1099-INT')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createImageFile())

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    // Should detect as 1099-INT since we provided expectedFormType
    expect(screen.getByText('Detected: 1099-INT')).toBeDefined()
  })

  it('can scan another after import', async () => {
    vi.mocked(recognizeImage).mockResolvedValue(makeW2OCRResult())
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createImageFile())

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('ocr-confirm-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('ocr-scan-another')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('ocr-scan-another'))

    expect(screen.getByText(/Drag and drop a photo or scan/)).toBeDefined()
  })

  it('handles drag and drop', async () => {
    vi.mocked(recognizeImage).mockResolvedValue(makeW2OCRResult())
    renderOCRUpload('W-2')

    const dropZone = screen.getByText(/Drag and drop/).closest('div')!
    const file = createImageFile()

    fireEvent.dragOver(dropZone, { dataTransfer: { files: [file] } })
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })
  })

  it('shows confidence badges in verification', async () => {
    vi.mocked(recognizeImage).mockResolvedValue(makeW2OCRResult())
    renderOCRUpload('W-2')

    const fileInput = screen.getByTestId('ocr-file-input')
    await userEvent.upload(fileInput, createImageFile())

    await waitFor(() => {
      expect(screen.getByTestId('ocr-verification')).toBeDefined()
    })

    const badges = screen.getAllByTestId('confidence-badge')
    expect(badges.length).toBeGreaterThan(0)
  })
})
