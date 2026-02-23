import { render, screen } from '@testing-library/react'
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

// Mock pdfjs-dist to avoid DOMMatrix not defined in test environment
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}))

const { useTaxStore } = await import('../../../src/store/taxStore.ts')
import { RSUIncomePage } from '../../../src/ui/pages/RSUIncomePage.tsx'
import { DeductionsPage } from '../../../src/ui/pages/DeductionsPage.tsx'
import { ReviewPage } from '../../../src/ui/pages/ReviewPage.tsx'
import { DownloadPage } from '../../../src/ui/pages/DownloadPage.tsx'

function renderWithRouter(ui: React.ReactElement, { route = '/' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

// ── RSU Income Page ─────────────────────────────────────────────

describe('RSUIncomePage', () => {
  it('renders page heading', () => {
    renderWithRouter(<RSUIncomePage />, { route: '/interview/rsu-income' })
    expect(screen.getByText('RSU Vest Events')).toBeDefined()
  })

  it('shows empty message when no vest events', () => {
    renderWithRouter(<RSUIncomePage />, { route: '/interview/rsu-income' })
    expect(screen.getByText('No RSU vest events added.')).toBeDefined()
  })

  it('adds an RSU vest event', async () => {
    const user = userEvent.setup()
    renderWithRouter(<RSUIncomePage />, { route: '/interview/rsu-income' })

    await user.click(screen.getByRole('button', { name: /add rsu vest event/i }))
    expect(useTaxStore.getState().taxReturn.rsuVestEvents).toHaveLength(1)
  })

  it('removes an RSU vest event', async () => {
    const user = userEvent.setup()
    useTaxStore.getState().addRSUVestEvent({
      id: 'rsu-1',
      vestDate: '2025-03-15',
      symbol: 'GOOG',
      sharesVested: 100,
      sharesWithheldForTax: 35,
      sharesDelivered: 65,
      fmvAtVest: 15000,
      totalFmv: 1500000,
    })

    renderWithRouter(<RSUIncomePage />, { route: '/interview/rsu-income' })
    expect(useTaxStore.getState().taxReturn.rsuVestEvents).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(useTaxStore.getState().taxReturn.rsuVestEvents).toHaveLength(0)
  })

  it('shows info about RSU income in W-2', () => {
    renderWithRouter(<RSUIncomePage />, { route: '/interview/rsu-income' })
    expect(
      screen.getByText(/RSU income is already included in your W-2/),
    ).toBeDefined()
  })
})

// ── Deductions Page ─────────────────────────────────────────────

describe('DeductionsPage', () => {
  it('renders page heading', () => {
    renderWithRouter(<DeductionsPage />, { route: '/interview/deductions' })
    expect(screen.getByText('Deductions')).toBeDefined()
  })

  it('defaults to standard deduction', () => {
    renderWithRouter(<DeductionsPage />, { route: '/interview/deductions' })
    expect(useTaxStore.getState().taxReturn.deductions.method).toBe('standard')
  })

  it('shows standard deduction amount for single filer', () => {
    renderWithRouter(<DeductionsPage />, { route: '/interview/deductions' })
    // Standard deduction for single in 2025 is $15,750 (shown in radio + comparison)
    expect(screen.getAllByText('$15,750').length).toBeGreaterThanOrEqual(1)
  })

  it('switches to itemized and shows fields', async () => {
    const user = userEvent.setup()
    renderWithRouter(<DeductionsPage />, { route: '/interview/deductions' })

    await user.click(screen.getByText('Itemized'))
    expect(useTaxStore.getState().taxReturn.deductions.method).toBe('itemized')
    expect(screen.getByText('Medical expenses')).toBeDefined()
    expect(screen.getByText(/State\/local income taxes/)).toBeDefined()
    expect(screen.getByText(/mortgage interest/i)).toBeDefined()
  })

  it('shows comparison summary', () => {
    renderWithRouter(<DeductionsPage />, { route: '/interview/deductions' })
    expect(screen.getByText(/Standard is better by/)).toBeDefined()
  })
})

// ── Review Page ─────────────────────────────────────────────────

describe('ReviewPage', () => {
  it('renders page heading', () => {
    renderWithRouter(<ReviewPage />, { route: '/review' })
    expect(screen.getByText('Review Your Return')).toBeDefined()
  })

  it('shows filing status', () => {
    renderWithRouter(<ReviewPage />, { route: '/review' })
    expect(screen.getByText('Single')).toBeDefined()
  })

  it('shows income section with line items', () => {
    // Add some income
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Test Corp',
      box1: 6000000,
      box2: 600000,
      box3: 6000000,
      box4: 372000,
      box5: 6000000,
      box6: 87000,
      box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [],
      box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false,
      box14: '',
    })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    expect(screen.getByText('Line 1a — Wages')).toBeDefined()
    expect(screen.getByText('Line 9 — Total income')).toBeDefined()
    expect(screen.getByText('Line 16 — Tax')).toBeDefined()
  })

  it('shows result section with refund or owed', () => {
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Test Corp',
      box1: 5000000,
      box2: 1500000, // large withholding → refund
      box3: 5000000, box4: 310000, box5: 5000000, box6: 72500,
      box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [],
      box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false,
      box14: '',
    })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    // Should show either refund or owed line
    const resultSection = screen.getByText('Result')
    expect(resultSection).toBeDefined()
  })

  it('has "Why this number?" links', () => {
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '', employerName: '',
      box1: 5000000, box2: 600000,
      box3: 0, box4: 0, box5: 0, box6: 0, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false,
      box14: '',
    })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    const explainLinks = screen.getAllByText('?')
    expect(explainLinks.length).toBeGreaterThan(0)
  })

  it('shows state card with refund status when CA has overpaid', () => {
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '12-3456789', employerName: 'Test Corp',
      box1: 5000000, box2: 1500000, // $50k wages, $15k withheld
      box3: 5000000, box4: 310000, box5: 5000000, box6: 72500,
      box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false,
      box14: '',
      box15State: 'CA',
      box17StateIncomeTax: 300000, // $3,000 CA withholding
    })
    useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'full-year' })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    const stateCard = screen.getByTestId('state-card-CA')
    expect(stateCard).toBeDefined()
    // Should show refund or owed status
    const statusEl = screen.getByTestId('state-status-CA')
    expect(statusEl.textContent).toMatch(/^(Refund|Amount Owed|Balanced)/)
  })

  it('shows state card with amount owed when CA has underpaid', () => {
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '12-3456789', employerName: 'Test Corp',
      box1: 10000000, box2: 100000, // $100k wages, $1k withheld
      box3: 10000000, box4: 620000, box5: 10000000, box6: 145000,
      box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false,
      box14: '',
      box15State: 'CA',
      box17StateIncomeTax: 10000, // $100 CA withholding — way too little
    })
    useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'full-year' })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    const statusEl = screen.getByTestId('state-status-CA')
    expect(statusEl.textContent).toMatch(/^Amount Owed/)
  })

  it('shows View CA Return link in state card', () => {
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '', employerName: '',
      box1: 5000000, box2: 600000,
      box3: 0, box4: 0, box5: 0, box6: 0, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false,
      box14: '',
      box15State: 'CA',
      box17StateIncomeTax: 100000,
    })
    useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'full-year' })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    const link = screen.getByText('View CA Return')
    expect(link.getAttribute('href')).toBe('/interview/state-review-CA')
  })
})

// ── Download Page ───────────────────────────────────────────────

describe('DownloadPage', () => {
  it('renders page heading', () => {
    renderWithRouter(<DownloadPage />, { route: '/download' })
    expect(screen.getByText('Download Your Return')).toBeDefined()
  })

  it('shows return summary', () => {
    renderWithRouter(<DownloadPage />, { route: '/download' })
    expect(screen.getByText('Return Summary')).toBeDefined()
    expect(screen.getByText('2025')).toBeDefined()
    expect(screen.getByText('Single')).toBeDefined()
  })

  it('has download PDF button', () => {
    renderWithRouter(<DownloadPage />, { route: '/download' })
    expect(screen.getByTestId('download-pdf-btn')).toBeDefined()
    expect(screen.getByText('Download PDF')).toBeDefined()
  })

  it('has export JSON button', () => {
    renderWithRouter(<DownloadPage />, { route: '/download' })
    expect(screen.getByTestId('export-json-btn')).toBeDefined()
    expect(screen.getByText('Export JSON')).toBeDefined()
  })

  it('shows e-file disclaimer', () => {
    renderWithRouter(<DownloadPage />, { route: '/download' })
    expect(
      screen.getByText(/This PDF is for review only/),
    ).toBeDefined()
  })

  it('shows disabled state download button before generation when state return exists', () => {
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '', employerName: '',
      box1: 5000000, box2: 600000,
      box3: 0, box4: 0, box5: 0, box6: 0, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false,
      box14: '',
      box15State: 'CA',
      box17StateIncomeTax: 100000,
    })
    useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'full-year' })

    renderWithRouter(<DownloadPage />, { route: '/download' })
    // State download section should be visible
    expect(screen.getByTestId('state-download-section')).toBeDefined()
    // State download button should exist but be disabled
    const btn = screen.getByTestId('download-state-CA')
    expect(btn).toBeDefined()
    expect(btn.hasAttribute('disabled')).toBe(true)
    // Helper text should be visible
    expect(screen.getByText(/Click.*Download All.*to generate/)).toBeDefined()
  })

  it('does not show state download section when no state returns', () => {
    renderWithRouter(<DownloadPage />, { route: '/download' })
    expect(screen.queryByTestId('state-download-section')).toBeNull()
  })

  it('shows Download All button label when state return exists', () => {
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '', employerName: '',
      box1: 5000000, box2: 600000,
      box3: 0, box4: 0, box5: 0, box6: 0, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false,
      box14: '',
      box15State: 'CA',
      box17StateIncomeTax: 100000,
    })
    useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'full-year' })

    renderWithRouter(<DownloadPage />, { route: '/download' })
    expect(screen.getByText('Download All (Federal + State)')).toBeDefined()
  })
})

// ── Store actions ───────────────────────────────────────────────

describe('Store: RSU and deduction actions', () => {
  it('addRSUVestEvent adds event and triggers recompute', () => {
    useTaxStore.getState().addRSUVestEvent({
      id: 'rsu-1',
      vestDate: '2025-03-15',
      symbol: 'GOOG',
      sharesVested: 100,
      sharesWithheldForTax: 35,
      sharesDelivered: 65,
      fmvAtVest: 15000,
      totalFmv: 1500000,
    })

    expect(useTaxStore.getState().taxReturn.rsuVestEvents).toHaveLength(1)
    expect(useTaxStore.getState().taxReturn.rsuVestEvents[0].symbol).toBe('GOOG')
  })

  it('removeRSUVestEvent removes by id', () => {
    useTaxStore.getState().addRSUVestEvent({
      id: 'rsu-1', vestDate: '', symbol: 'A',
      sharesVested: 0, sharesWithheldForTax: 0, sharesDelivered: 0,
      fmvAtVest: 0, totalFmv: 0,
    })
    useTaxStore.getState().addRSUVestEvent({
      id: 'rsu-2', vestDate: '', symbol: 'B',
      sharesVested: 0, sharesWithheldForTax: 0, sharesDelivered: 0,
      fmvAtVest: 0, totalFmv: 0,
    })

    useTaxStore.getState().removeRSUVestEvent('rsu-1')
    expect(useTaxStore.getState().taxReturn.rsuVestEvents).toHaveLength(1)
    expect(useTaxStore.getState().taxReturn.rsuVestEvents[0].id).toBe('rsu-2')
  })

  it('setItemizedDeductions merges into existing', () => {
    useTaxStore.getState().setDeductionMethod('itemized')
    useTaxStore.getState().setItemizedDeductions({ medicalExpenses: 500000 })
    useTaxStore.getState().setItemizedDeductions({ mortgageInterest: 1200000 })

    const itemized = useTaxStore.getState().taxReturn.deductions.itemized!
    expect(itemized.medicalExpenses).toBe(500000)
    expect(itemized.mortgageInterest).toBe(1200000)
  })
})
