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

const { useTaxStore } = await import('../../../src/store/taxStore.ts')
import { W2IncomePage } from '../../../src/ui/pages/W2IncomePage.tsx'
import { InterestIncomePage } from '../../../src/ui/pages/InterestIncomePage.tsx'
import { DividendIncomePage } from '../../../src/ui/pages/DividendIncomePage.tsx'

function renderWithRouter(ui: React.ReactElement, { route = '/' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

// ── W-2 Income Page ─────────────────────────────────────────────

describe('W2IncomePage', () => {
  it('renders page heading', () => {
    renderWithRouter(<W2IncomePage />, { route: '/interview/w2-income' })
    expect(screen.getByText('W-2 Wage and Tax Statements')).toBeDefined()
  })

  it('shows empty message when no W-2s', () => {
    renderWithRouter(<W2IncomePage />, { route: '/interview/w2-income' })
    expect(
      screen.getByText(/No W-2s added yet/),
    ).toBeDefined()
  })

  it('adds a W-2 when clicking add button', async () => {
    const user = userEvent.setup()
    renderWithRouter(<W2IncomePage />, { route: '/interview/w2-income' })

    await user.click(screen.getByRole('button', { name: /add another w-2/i }))

    expect(useTaxStore.getState().taxReturn.w2s).toHaveLength(1)
    // Should see employer name input
    expect(screen.getByPlaceholderText('Acme Corp')).toBeDefined()
  })

  it('removes a W-2 when clicking remove', async () => {
    const user = userEvent.setup()
    useTaxStore.getState().addW2({
      id: 'w2-test',
      employerEin: '',
      employerName: '',
      box1: 0, box2: 0, box3: 0, box4: 0, box5: 0, box6: 0,
      box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [],
      box13StatutoryEmployee: false, box13RetirementPlan: false, box13ThirdPartySickPay: false,
      box14: '',
    })

    renderWithRouter(<W2IncomePage />, { route: '/interview/w2-income' })
    expect(useTaxStore.getState().taxReturn.w2s).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(useTaxStore.getState().taxReturn.w2s).toHaveLength(0)
  })

  it('updates employer name in store', async () => {
    const user = userEvent.setup()
    renderWithRouter(<W2IncomePage />, { route: '/interview/w2-income' })

    await user.click(screen.getByRole('button', { name: /add another w-2/i }))
    const employerInput = screen.getByPlaceholderText('Acme Corp')
    await user.type(employerInput, 'Google')

    expect(useTaxStore.getState().taxReturn.w2s[0].employerName).toBe('Google')
  })

  it('shows advanced fields when toggled', async () => {
    const user = userEvent.setup()
    renderWithRouter(<W2IncomePage />, { route: '/interview/w2-income' })

    await user.click(screen.getByRole('button', { name: /add another w-2/i }))
    // Advanced fields should be hidden initially
    expect(screen.queryByText('Box 13')).toBeNull()

    await user.click(screen.getByText(/Box 7.*20.*advanced/i))
    expect(screen.getByText('Box 13')).toBeDefined()
  })
})

// ── Interest Income Page ────────────────────────────────────────

describe('InterestIncomePage', () => {
  it('renders page heading', () => {
    renderWithRouter(<InterestIncomePage />, { route: '/interview/interest-income' })
    expect(screen.getByText('Interest Income (1099-INT)')).toBeDefined()
  })

  it('shows empty message when no forms', () => {
    renderWithRouter(<InterestIncomePage />, { route: '/interview/interest-income' })
    expect(
      screen.getByText(/No 1099-INT forms added/),
    ).toBeDefined()
  })

  it('adds a 1099-INT when clicking add', async () => {
    const user = userEvent.setup()
    renderWithRouter(<InterestIncomePage />, { route: '/interview/interest-income' })

    await user.click(screen.getByRole('button', { name: /add 1099-int/i }))

    expect(useTaxStore.getState().taxReturn.form1099INTs).toHaveLength(1)
    expect(screen.getByPlaceholderText('Savings Bank')).toBeDefined()
  })

  it('removes a 1099-INT when clicking remove', async () => {
    const user = userEvent.setup()
    useTaxStore.getState().addForm1099INT({
      id: 'int-test',
      payerName: 'Test Bank',
      box1: 0, box2: 0, box3: 0, box4: 0, box8: 0,
    })

    renderWithRouter(<InterestIncomePage />, { route: '/interview/interest-income' })
    expect(useTaxStore.getState().taxReturn.form1099INTs).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(useTaxStore.getState().taxReturn.form1099INTs).toHaveLength(0)
  })

  it('updates payer name in store', async () => {
    const user = userEvent.setup()
    renderWithRouter(<InterestIncomePage />, { route: '/interview/interest-income' })

    await user.click(screen.getByRole('button', { name: /add 1099-int/i }))
    const payerInput = screen.getByPlaceholderText('Savings Bank')
    await user.type(payerInput, 'Chase')

    expect(useTaxStore.getState().taxReturn.form1099INTs[0].payerName).toBe('Chase')
  })
})

// ── Dividend Income Page ────────────────────────────────────────

describe('DividendIncomePage', () => {
  it('renders page heading', () => {
    renderWithRouter(<DividendIncomePage />, { route: '/interview/dividend-income' })
    expect(screen.getByText('Dividend Income (1099-DIV)')).toBeDefined()
  })

  it('shows empty message when no forms', () => {
    renderWithRouter(<DividendIncomePage />, { route: '/interview/dividend-income' })
    expect(
      screen.getByText(/No 1099-DIV forms added/),
    ).toBeDefined()
  })

  it('adds a 1099-DIV when clicking add', async () => {
    const user = userEvent.setup()
    renderWithRouter(<DividendIncomePage />, { route: '/interview/dividend-income' })

    await user.click(screen.getByRole('button', { name: /add 1099-div/i }))

    expect(useTaxStore.getState().taxReturn.form1099DIVs).toHaveLength(1)
    expect(screen.getByPlaceholderText('Vanguard')).toBeDefined()
  })

  it('removes a 1099-DIV when clicking remove', async () => {
    const user = userEvent.setup()
    useTaxStore.getState().addForm1099DIV({
      id: 'div-test',
      payerName: 'Vanguard',
      box1a: 0, box1b: 0, box2a: 0, box3: 0, box4: 0, box5: 0, box11: 0,
    })

    renderWithRouter(<DividendIncomePage />, { route: '/interview/dividend-income' })
    expect(useTaxStore.getState().taxReturn.form1099DIVs).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(useTaxStore.getState().taxReturn.form1099DIVs).toHaveLength(0)
  })

  it('updates payer name in store', async () => {
    const user = userEvent.setup()
    renderWithRouter(<DividendIncomePage />, { route: '/interview/dividend-income' })

    await user.click(screen.getByRole('button', { name: /add 1099-div/i }))
    const payerInput = screen.getByPlaceholderText('Vanguard')
    await user.type(payerInput, 'Fidelity')

    expect(useTaxStore.getState().taxReturn.form1099DIVs[0].payerName).toBe('Fidelity')
  })
})
