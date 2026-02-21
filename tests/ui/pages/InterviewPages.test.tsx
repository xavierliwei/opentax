import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// Mock idb for store
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
import { FilingStatusPage } from '../../../src/ui/pages/FilingStatusPage.tsx'
import { DependentsPage } from '../../../src/ui/pages/DependentsPage.tsx'

function renderWithRouter(ui: React.ReactElement, { route = '/' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

describe('FilingStatusPage', () => {
  it('renders all 5 filing status options', () => {
    renderWithRouter(<FilingStatusPage />, { route: '/interview/filing-status' })
    expect(screen.getByText('Single')).toBeDefined()
    expect(screen.getByText('Married Filing Jointly')).toBeDefined()
    expect(screen.getByText('Married Filing Separately')).toBeDefined()
    expect(screen.getByText('Head of Household')).toBeDefined()
    expect(screen.getByText('Qualifying Surviving Spouse')).toBeDefined()
  })

  it('selects MFJ and updates store', async () => {
    const user = userEvent.setup()
    renderWithRouter(<FilingStatusPage />, { route: '/interview/filing-status' })

    const mfjRadio = screen.getByDisplayValue('mfj')
    await user.click(mfjRadio)

    expect(useTaxStore.getState().taxReturn.filingStatus).toBe('mfj')
  })
})

describe('DependentsPage', () => {
  it('shows empty message when no dependents', () => {
    renderWithRouter(<DependentsPage />, { route: '/interview/dependents' })
    expect(
      screen.getByText(/No dependents added/),
    ).toBeDefined()
  })

  it('adds a dependent when clicking add button', async () => {
    const user = userEvent.setup()
    renderWithRouter(<DependentsPage />, { route: '/interview/dependents' })

    const addBtn = screen.getByRole('button', { name: /add dependent/i })
    await user.click(addBtn)

    expect(useTaxStore.getState().taxReturn.dependents).toHaveLength(1)
  })
})
