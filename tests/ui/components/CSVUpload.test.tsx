import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('idb', () => ({
  openDB: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => Promise.resolve(undefined)),
      put: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    }),
  ),
}))

const { useTaxStore } = await import('../../../src/store/taxStore.ts')
import { CSVUpload } from '../../../src/ui/components/CSVUpload.tsx'

const ROBINHOOD_CSV = `Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Wash Sale Loss Disallowed,Gain/Loss,Term,Box
AAPL,01/15/2025,06/10/2025,"$6,500.00","$5,000.00",$0.00,"$1,500.00",Short Term,A
MSFT,02/01/2025,07/01/2025,"$2,500.00","$3,000.00",$0.00,"-$500.00",Short Term,A
GOOG,05/01/2023,08/10/2025,"$12,000.00","$8,000.00",$0.00,"$4,000.00",Long Term,D
`

function renderCSVUpload() {
  return render(
    <MemoryRouter>
      <CSVUpload />
    </MemoryRouter>,
  )
}

function createCSVFile(content: string, name = 'trades.csv') {
  return new File([content], name, { type: 'text/csv' })
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

describe('CSVUpload', () => {
  it('renders drop zone in idle state', () => {
    renderCSVUpload()
    expect(screen.getByText('Drag and drop your CSV file here')).toBeDefined()
    expect(screen.getByText('Supported: Robinhood')).toBeDefined()
  })

  it('parses CSV via file input and shows summary', async () => {
    renderCSVUpload()
    const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement

    const file = createCSVFile(ROBINHOOD_CSV)
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText(/Detected: Robinhood/)).toBeDefined()
    })

    expect(screen.getByText(/3 parsed/)).toBeDefined()
    expect(screen.getByText(/Short-term: 2 trades/)).toBeDefined()
    expect(screen.getByText(/Long-term: 1 trades/)).toBeDefined()
  })

  it('imports transactions into the store', async () => {
    renderCSVUpload()
    const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement

    const file = createCSVFile(ROBINHOOD_CSV)
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByTestId('csv-import-btn')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('csv-import-btn'))

    expect(useTaxStore.getState().taxReturn.capitalTransactions).toHaveLength(3)
    expect(screen.getByText(/3 transactions imported/)).toBeDefined()
  })

  it('shows error for non-CSV file', async () => {
    renderCSVUpload()
    const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement

    // Use fireEvent.change to bypass the accept=".csv" filter
    const file = new File(['hello'], 'document.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('Please upload a CSV file.')).toBeDefined()
    })
  })

  it('shows error for CSV with missing required columns', async () => {
    renderCSVUpload()
    const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement

    const badCSV = 'foo,bar,baz\n1,2,3\n'
    const file = createCSVFile(badCSV)
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText(/Missing required columns/)).toBeDefined()
    })
  })

  it('handles drag and drop', async () => {
    renderCSVUpload()
    const dropZone = screen.getByText('Drag and drop your CSV file here').closest('div')!

    const file = createCSVFile(ROBINHOOD_CSV)

    fireEvent.dragOver(dropZone, { dataTransfer: { files: [file] } })
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/Detected: Robinhood/)).toBeDefined()
    })
  })

  it('can reset after import and upload again', async () => {
    renderCSVUpload()
    const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement

    const file = createCSVFile(ROBINHOOD_CSV)
    await userEvent.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByTestId('csv-import-btn')).toBeDefined()
    })

    await userEvent.click(screen.getByTestId('csv-import-btn'))

    await waitFor(() => {
      expect(screen.getByText(/3 transactions imported/)).toBeDefined()
    })

    await userEvent.click(screen.getByText('Upload another'))
    expect(screen.getByText('Drag and drop your CSV file here')).toBeDefined()
  })
})
