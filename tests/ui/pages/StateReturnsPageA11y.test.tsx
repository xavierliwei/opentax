import { render, screen, within } from '@testing-library/react'
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
import { StateReturnsPage } from '../../../src/ui/pages/StateReturnsPage.tsx'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/interview/state-returns']}>
      <StateReturnsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

describe('StateReturnsPage accessibility', () => {
  it('renders with role="form" and aria-label', () => {
    renderPage()
    const form = screen.getByRole('form', { name: /state return selection/i })
    expect(form).toBeDefined()
  })

  it('has aria-label on each state group', () => {
    renderPage()
    const groups = screen.getAllByRole('group')
    // The first group is the "Available states" wrapper, the rest are per-state groups
    const availableStates = groups.find((g) => g.getAttribute('aria-label') === 'Available states')
    expect(availableStates).toBeDefined()

    // Each state card should have an aria-label like "California state return options"
    const stateGroups = groups.filter((g) =>
      g.getAttribute('aria-label')?.endsWith('state return options'),
    )
    expect(stateGroups.length).toBeGreaterThan(0)
  })

  it('checkboxes have aria-label for state filing', () => {
    renderPage()
    const caCheckbox = screen.getByRole('checkbox', { name: /file california state return/i })
    expect(caCheckbox).toBeDefined()
  })

  it('shows residency fieldset with aria-label when state is selected', async () => {
    const user = userEvent.setup()
    renderPage()

    const caCheckbox = screen.getByRole('checkbox', { name: /file california state return/i })
    await user.click(caCheckbox)

    const fieldset = screen.getByRole('group', { name: /california residency status/i })
    expect(fieldset).toBeDefined()
  })

  it('date inputs have htmlFor/id linkage and aria-describedby', async () => {
    const user = userEvent.setup()
    useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'part-year' })
    renderPage()

    const moveInInput = screen.getByTestId('move-in-date-CA')
    expect(moveInInput.getAttribute('id')).toBe('move-in-date-CA')
    expect(moveInInput.getAttribute('aria-describedby')).toContain('move-in-hint-CA')
    expect(moveInInput.getAttribute('aria-describedby')).toContain('part-year-error-CA')

    const moveOutInput = screen.getByTestId('move-out-date-CA')
    expect(moveOutInput.getAttribute('id')).toBe('move-out-date-CA')
    expect(moveOutInput.getAttribute('aria-describedby')).toContain('move-out-hint-CA')
  })

  it('part-year date error region has aria-live="polite"', async () => {
    useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'part-year' })
    renderPage()

    const errorRegion = document.getElementById('part-year-error-CA')
    expect(errorRegion).not.toBeNull()
    expect(errorRegion!.getAttribute('aria-live')).toBe('polite')
  })

  it('shows error with role="alert" when part-year dates are missing', () => {
    useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'part-year' })
    renderPage()

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Enter at least one date')
  })
})
