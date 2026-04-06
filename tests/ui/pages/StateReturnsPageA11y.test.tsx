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
import { StateReturnsPage } from '../../../src/ui/pages/StateReturnsPage.tsx'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/interview/state-returns']}>
      <StateReturnsPage />
    </MemoryRouter>,
  )
}

// jsdom doesn't support scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

describe('StateReturnsPage accessibility', () => {
  it('renders with role="form" and aria-label', () => {
    renderPage()
    const form = screen.getByRole('form', { name: /state return selection/i })
    expect(form).toBeDefined()
  })

  it('has a combobox for state search', () => {
    renderPage()
    const combobox = screen.getByRole('combobox')
    expect(combobox).toBeDefined()
    expect(combobox.getAttribute('aria-autocomplete')).toBe('list')
  })

  it('shows listbox with state options when combobox is focused', async () => {
    const user = userEvent.setup()
    renderPage()

    const combobox = screen.getByRole('combobox')
    await user.click(combobox)

    const listbox = screen.getByRole('listbox', { name: /available states/i })
    expect(listbox).toBeDefined()

    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
  })

  it('shows residency fieldset with aria-label when state is selected', async () => {
    const user = userEvent.setup()
    renderPage()

    // Use combobox to select California
    const combobox = screen.getByRole('combobox')
    await user.click(combobox)
    await user.type(combobox, 'California')

    const options = screen.getAllByRole('option')
    const caOption = options.find(o => o.textContent?.includes('California'))
    if (caOption) await user.click(caOption)

    const fieldset = screen.getByRole('group', { name: /california residency status/i })
    expect(fieldset).toBeDefined()
  })

  it('date inputs have htmlFor/id linkage and aria-describedby', async () => {
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
