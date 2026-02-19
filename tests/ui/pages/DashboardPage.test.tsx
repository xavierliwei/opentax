import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
const { DashboardPage } = await import('../../../src/ui/pages/DashboardPage.tsx')
const { useTaxStore } = await import('../../../src/store/taxStore.ts')

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // Reset store to defaults
  useTaxStore.setState(useTaxStore.getInitialState())
})

describe('DashboardPage', () => {
  it('renders dashboard with default state', () => {
    renderDashboard()
    expect(screen.getByTestId('dashboard')).toBeDefined()
  })

  it('shows completion bar', () => {
    renderDashboard()
    expect(screen.getByTestId('completion-bar')).toBeDefined()
  })

  it('shows tax summary section', () => {
    renderDashboard()
    expect(screen.getByTestId('tax-summary')).toBeDefined()
    expect(screen.getByText('AGI')).toBeDefined()
  })

  it('shows gap items for missing personal info', () => {
    renderDashboard()
    expect(screen.getByTestId('gap-items')).toBeDefined()
    expect(screen.getByText('Taxpayer SSN')).toBeDefined()
    expect(screen.getByText('Taxpayer name')).toBeDefined()
  })

  it('removes SSN gap when SSN is entered in store', () => {
    useTaxStore.getState().setTaxpayer({
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
    })

    renderDashboard()
    // SSN should no longer appear as a gap item
    expect(screen.queryByText('Taxpayer SSN')).toBeNull()
    // Name should no longer appear
    expect(screen.queryByText('Taxpayer name')).toBeNull()
  })

  it('shows Estimated Refund when withheld > tax', () => {
    // Add a W-2 with wages and withholding to produce a refund
    useTaxStore.getState().addW2({
      id: 'w2-test',
      employerEin: '',
      employerName: 'Test Corp',
      box1: 6000000,
      box2: 900000,
      box3: 6000000,
      box4: 0,
      box5: 6000000,
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

    renderDashboard()
    expect(screen.getByText('Estimated Refund')).toBeDefined()
  })
})
