import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// Mock idb (required by taxStore)
vi.mock('idb', () => ({
  openDB: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => Promise.resolve(undefined)),
      put: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    }),
  ),
}))

// Lazy import after mocks
const { DownloadPage } = await import('../../../src/ui/pages/DownloadPage.tsx')
const { useTaxStore } = await import('../../../src/store/taxStore.ts')

function renderDownload() {
  return render(
    <MemoryRouter>
      <DownloadPage />
    </MemoryRouter>,
  )
}

// Save original before spying so download doesn't break the DOM
const origCreateObjectURL = URL.createObjectURL
const origRevokeObjectURL = URL.revokeObjectURL

beforeEach(() => {
  useTaxStore.setState(useTaxStore.getInitialState())
  // Stub blob URL methods so the download path doesn't throw
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  URL.createObjectURL = origCreateObjectURL
  URL.revokeObjectURL = origRevokeObjectURL
})

describe('DownloadPage PII export warning', () => {
  it('shows PII warning dialog when Export JSON is clicked', async () => {
    const user = userEvent.setup()

    useTaxStore.getState().setTaxpayer({
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
    })

    renderDownload()
    await user.click(screen.getByTestId('export-json-btn'))

    expect(screen.getByTestId('pii-export-dialog')).toBeDefined()
    expect(screen.getByText('Sensitive Data Warning')).toBeDefined()
    expect(screen.getByText('Taxpayer SSN')).toBeDefined()
  })

  it('closes dialog on Cancel', async () => {
    const user = userEvent.setup()

    useTaxStore.getState().setTaxpayer({
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
    })

    renderDownload()
    await user.click(screen.getByTestId('export-json-btn'))
    expect(screen.getByTestId('pii-export-dialog')).toBeDefined()

    await user.click(screen.getByTestId('pii-cancel-btn'))
    expect(screen.queryByTestId('pii-export-dialog')).toBeNull()
  })

  it('defaults to redacted mode', async () => {
    const user = userEvent.setup()

    useTaxStore.getState().setTaxpayer({
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
    })

    renderDownload()
    await user.click(screen.getByTestId('export-json-btn'))

    const redactedRadio = screen.getByTestId('mode-redacted').querySelector('input')
    expect(redactedRadio).toBeDefined()
    expect((redactedRadio as HTMLInputElement).checked).toBe(true)
  })

  it('confirms export and closes dialog', async () => {
    const user = userEvent.setup()

    useTaxStore.getState().setTaxpayer({
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
    })

    renderDownload()
    await user.click(screen.getByTestId('export-json-btn'))
    await user.click(screen.getByTestId('pii-confirm-btn'))

    expect(screen.queryByTestId('pii-export-dialog')).toBeNull()
  })

  it('can switch to full export mode', async () => {
    const user = userEvent.setup()

    useTaxStore.getState().setTaxpayer({
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
    })

    renderDownload()
    await user.click(screen.getByTestId('export-json-btn'))

    const fullRadio = screen.getByTestId('mode-full').querySelector('input')!
    await user.click(fullRadio)
    expect((fullRadio as HTMLInputElement).checked).toBe(true)

    await user.click(screen.getByTestId('pii-confirm-btn'))
    expect(screen.queryByTestId('pii-export-dialog')).toBeNull()
  })

  it('closes dialog when Escape is pressed', async () => {
    const user = userEvent.setup()

    useTaxStore.getState().setTaxpayer({
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
    })

    renderDownload()
    await user.click(screen.getByTestId('export-json-btn'))
    expect(screen.getByTestId('pii-export-dialog')).toBeDefined()

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('pii-export-dialog')).toBeNull()
  })

  it('closes dialog when backdrop is clicked', async () => {
    const user = userEvent.setup()

    useTaxStore.getState().setTaxpayer({
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
    })

    renderDownload()
    await user.click(screen.getByTestId('export-json-btn'))
    expect(screen.getByTestId('pii-export-dialog')).toBeDefined()

    await user.click(screen.getByTestId('pii-export-backdrop'))
    expect(screen.queryByTestId('pii-export-dialog')).toBeNull()
  })

  it('lists multiple sensitive fields when present', async () => {
    const user = userEvent.setup()

    useTaxStore.getState().setTaxpayer({
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
      address: { street: '123 Main St', city: 'Anytown', state: 'CA', zip: '90210' },
    })
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Acme Corp',
      box1: 10000000,
      box2: 2000000,
      box3: 10000000,
      box4: 0,
      box5: 10000000,
      box6: 0,
      box7: 0,
      box8: 0,
      box10: 0,
      box11: 0,
      box12: [],
      box13StatutoryEmployee: false,
      box13RetirementPlan: false,
      box13ThirdPartySickPay: false,
      box14: '',
    })

    renderDownload()
    await user.click(screen.getByTestId('export-json-btn'))

    expect(screen.getByText('Taxpayer SSN')).toBeDefined()
    expect(screen.getByText('Employer EIN(s)')).toBeDefined()
    expect(screen.getByText('Taxpayer address')).toBeDefined()
  })
})
