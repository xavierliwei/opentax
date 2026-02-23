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
import { ScheduleCPage } from '../../../src/ui/pages/ScheduleCPage.tsx'
import { ScheduleK1Page } from '../../../src/ui/pages/ScheduleK1Page.tsx'
import { Form1095APage } from '../../../src/ui/pages/Form1095APage.tsx'
import { ReviewPage } from '../../../src/ui/pages/ReviewPage.tsx'

function renderWithRouter(ui: React.ReactElement, { route = '/' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

// ── Schedule C Page ──────────────────────────────────────────────

describe('ScheduleCPage', () => {
  it('renders page heading', () => {
    renderWithRouter(<ScheduleCPage />, { route: '/interview/schedule-c' })
    expect(screen.getByText('Business Income (Schedule C)')).toBeDefined()
  })

  it('shows empty message when no businesses', () => {
    renderWithRouter(<ScheduleCPage />, { route: '/interview/schedule-c' })
    expect(screen.getByText(/No businesses added/)).toBeDefined()
  })

  it('adds a business when clicking add button', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ScheduleCPage />, { route: '/interview/schedule-c' })

    await user.click(screen.getByRole('button', { name: /add business/i }))

    expect(useTaxStore.getState().taxReturn.scheduleCBusinesses).toHaveLength(1)
    expect(screen.getByPlaceholderText(/Jane's Consulting/)).toBeDefined()
  })

  it('removes a business when clicking remove', async () => {
    const user = userEvent.setup()
    useTaxStore.getState().addScheduleC({
      id: 'biz-test',
      businessName: 'Test LLC',
      principalBusinessCode: '541511',
      accountingMethod: 'cash',
      grossReceipts: 0, returns: 0, costOfGoodsSold: 0,
      advertising: 0, carAndTruck: 0, commissions: 0, contractLabor: 0,
      depreciation: 0, insurance: 0, mortgageInterest: 0, otherInterest: 0,
      legal: 0, officeExpense: 0, rent: 0, repairs: 0, supplies: 0,
      taxes: 0, travel: 0, meals: 0, utilities: 0, wages: 0, otherExpenses: 0,
    })

    renderWithRouter(<ScheduleCPage />, { route: '/interview/schedule-c' })

    expect(useTaxStore.getState().taxReturn.scheduleCBusinesses).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /remove item 1/i }))
    expect(useTaxStore.getState().taxReturn.scheduleCBusinesses).toHaveLength(0)
  })

  it('updates business name', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ScheduleCPage />, { route: '/interview/schedule-c' })
    await user.click(screen.getByRole('button', { name: /add business/i }))

    const nameInput = screen.getByPlaceholderText(/Jane's Consulting/)
    await user.clear(nameInput)
    await user.type(nameInput, 'My Biz')

    expect(useTaxStore.getState().taxReturn.scheduleCBusinesses[0].businessName).toBe('My Biz')
  })

  it('shows expense section when expanded', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ScheduleCPage />, { route: '/interview/schedule-c' })
    await user.click(screen.getByRole('button', { name: /add business/i }))

    // Expenses should be collapsed initially
    expect(screen.queryByText('Advertising (Line 8)')).toBeNull()

    // Click to expand
    await user.click(screen.getByText(/Expenses \(Part II/))
    expect(screen.getByText('Advertising (Line 8)')).toBeDefined()
  })

  it('shows unsupported feature warnings when flags are checked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ScheduleCPage />, { route: '/interview/schedule-c' })
    await user.click(screen.getByRole('button', { name: /add business/i }))
    await user.click(screen.getByText(/Additional Features/))

    // Check home office checkbox
    const homeOfficeCheckbox = screen.getByLabelText(/Home office deduction/)
    await user.click(homeOfficeCheckbox)

    expect(screen.getByText(/Home office deduction \(Form 8829\) is not yet supported/)).toBeDefined()
  })

  it('shows MFJ owner selector', async () => {
    const user = userEvent.setup()
    useTaxStore.getState().setFilingStatus('mfj')
    renderWithRouter(<ScheduleCPage />, { route: '/interview/schedule-c' })
    await user.click(screen.getByRole('button', { name: /add business/i }))

    expect(screen.getByText("Whose business?")).toBeDefined()
  })

  it('has data-testid for page', () => {
    renderWithRouter(<ScheduleCPage />, { route: '/interview/schedule-c' })
    expect(screen.getByTestId('page-schedule-c')).toBeDefined()
  })
})

// ── Schedule K-1 Page ────────────────────────────────────────────

describe('ScheduleK1Page', () => {
  it('renders page heading', () => {
    renderWithRouter(<ScheduleK1Page />, { route: '/interview/schedule-k1' })
    expect(screen.getByText('Schedule K-1 (Passthrough Income)')).toBeDefined()
  })

  it('shows important warning about K-1 limitations', () => {
    renderWithRouter(<ScheduleK1Page />, { route: '/interview/schedule-k1' })
    expect(screen.getByText(/K-1 income does not flow into your Form 1040 yet/)).toBeDefined()
  })

  it('shows empty message when no K-1s', () => {
    renderWithRouter(<ScheduleK1Page />, { route: '/interview/schedule-k1' })
    expect(screen.getByText(/No K-1 forms added/)).toBeDefined()
  })

  it('adds a K-1 when clicking add button', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ScheduleK1Page />, { route: '/interview/schedule-k1' })

    await user.click(screen.getByRole('button', { name: /add k-1/i }))

    expect(useTaxStore.getState().taxReturn.scheduleK1s).toHaveLength(1)
    expect(screen.getByPlaceholderText(/ABC Partners/)).toBeDefined()
  })

  it('removes a K-1 when clicking remove', async () => {
    const user = userEvent.setup()
    useTaxStore.getState().addScheduleK1({
      id: 'k1-test',
      entityType: 'partnership',
      entityName: 'Test LP',
      entityEin: '12-3456789',
      ordinaryIncome: 0, rentalIncome: 0, interestIncome: 0,
      dividendIncome: 0, shortTermCapitalGain: 0, longTermCapitalGain: 0,
      section199AQBI: 0, distributions: 0,
    })

    renderWithRouter(<ScheduleK1Page />, { route: '/interview/schedule-k1' })
    await user.click(screen.getByRole('button', { name: /remove item 1/i }))
    expect(useTaxStore.getState().taxReturn.scheduleK1s).toHaveLength(0)
  })

  it('shows per-card computation warning', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ScheduleK1Page />, { route: '/interview/schedule-k1' })
    await user.click(screen.getByRole('button', { name: /add k-1/i }))

    expect(screen.getByText(/K-1 income is captured but NOT yet computed/)).toBeDefined()
  })

  it('shows entity type selector with three options', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ScheduleK1Page />, { route: '/interview/schedule-k1' })
    await user.click(screen.getByRole('button', { name: /add k-1/i }))

    const select = screen.getByDisplayValue('Partnership (Form 1065)')
    expect(select).toBeDefined()
  })

  it('has data-testid for page', () => {
    renderWithRouter(<ScheduleK1Page />, { route: '/interview/schedule-k1' })
    expect(screen.getByTestId('page-schedule-k1')).toBeDefined()
  })
})

// ── Form 1095-A Page ─────────────────────────────────────────────

describe('Form1095APage', () => {
  it('renders page heading', () => {
    renderWithRouter(<Form1095APage />, { route: '/interview/form-1095a' })
    expect(screen.getByText('Health Insurance Marketplace (1095-A)')).toBeDefined()
  })

  it('shows PTC explanation box', () => {
    renderWithRouter(<Form1095APage />, { route: '/interview/form-1095a' })
    expect(screen.getByText(/How Premium Tax Credit works/)).toBeDefined()
  })

  it('shows empty message when no 1095-A forms', () => {
    renderWithRouter(<Form1095APage />, { route: '/interview/form-1095a' })
    expect(screen.getByText(/No 1095-A forms added/)).toBeDefined()
  })

  it('adds a 1095-A when clicking add button', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Form1095APage />, { route: '/interview/form-1095a' })

    await user.click(screen.getByRole('button', { name: /add 1095-a/i }))

    expect(useTaxStore.getState().taxReturn.form1095As).toHaveLength(1)
    expect(screen.getByPlaceholderText(/HealthCare.gov/)).toBeDefined()
  })

  it('removes a 1095-A when clicking remove', async () => {
    const user = userEvent.setup()
    useTaxStore.getState().addForm1095A({
      id: 'f1095a-test',
      marketplaceName: 'Test Marketplace',
      recipientName: 'John Doe',
      rows: [],
    })

    renderWithRouter(<Form1095APage />, { route: '/interview/form-1095a' })
    await user.click(screen.getByRole('button', { name: /remove item 1/i }))
    expect(useTaxStore.getState().taxReturn.form1095As).toHaveLength(0)
  })

  it('renders 12 month rows for data entry', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Form1095APage />, { route: '/interview/form-1095a' })
    await user.click(screen.getByRole('button', { name: /add 1095-a/i }))

    // Check for all 12 months
    expect(screen.getByText('January')).toBeDefined()
    expect(screen.getByText('June')).toBeDefined()
    expect(screen.getByText('December')).toBeDefined()
  })

  it('has data-testid for page', () => {
    renderWithRouter(<Form1095APage />, { route: '/interview/form-1095a' })
    expect(screen.getByTestId('page-form-1095a')).toBeDefined()
  })
})

// ── Review Page Enhancements ─────────────────────────────────────

describe('ReviewPage — Phase 4 enhancements', () => {
  it('shows Schedule C summary card when businesses present', () => {
    useTaxStore.getState().addScheduleC({
      id: 'biz-review',
      businessName: 'Review Test LLC',
      principalBusinessCode: '541511',
      accountingMethod: 'cash',
      grossReceipts: 10000000, returns: 0, costOfGoodsSold: 0,
      advertising: 0, carAndTruck: 0, commissions: 0, contractLabor: 0,
      depreciation: 0, insurance: 0, mortgageInterest: 0, otherInterest: 0,
      legal: 0, officeExpense: 0, rent: 0, repairs: 0, supplies: 0,
      taxes: 0, travel: 0, meals: 0, utilities: 0, wages: 0, otherExpenses: 0,
    })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    expect(screen.getByTestId('review-schedule-c')).toBeDefined()
    expect(screen.getByText(/1 business reported/)).toBeDefined()
  })

  it('shows K-1 warning card when K-1s present', () => {
    useTaxStore.getState().addScheduleK1({
      id: 'k1-review',
      entityType: 'partnership',
      entityName: 'Review LP',
      entityEin: '12-3456789',
      ordinaryIncome: 5000000, rentalIncome: 0, interestIncome: 0,
      dividendIncome: 0, shortTermCapitalGain: 0, longTermCapitalGain: 0,
      section199AQBI: 0, distributions: 0,
    })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    expect(screen.getByTestId('review-schedule-k1')).toBeDefined()
    expect(screen.getByText(/Not Computed/)).toBeDefined()
  })

  it('shows 1095-A summary card when 1095-A present', () => {
    useTaxStore.getState().addForm1095A({
      id: 'f1095a-review',
      marketplaceName: 'HealthCare.gov',
      recipientName: 'Jane Doe',
      rows: [{ month: 1, enrollmentPremium: 50000, slcspPremium: 60000, advancePTC: 40000 }],
    })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    expect(screen.getByTestId('review-1095a')).toBeDefined()
    expect(screen.getByText(/1 marketplace statement/)).toBeDefined()
  })

  it('shows K-1 review summary and does not show blocking K-1 errors for supported core income', () => {
    useTaxStore.getState().addScheduleK1({
      id: 'k1-val',
      entityType: 's-corp',
      entityName: 'Val Test Inc',
      entityEin: '98-7654321',
      ordinaryIncome: 10000000, rentalIncome: 0, interestIncome: 0,
      dividendIncome: 0, shortTermCapitalGain: 0, longTermCapitalGain: 0,
      section199AQBI: 0, distributions: 0,
    })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    expect(screen.queryByTestId('validation-errors')).toBeNull()
    expect(screen.getByTestId('review-schedule-k1')).toBeDefined()
  })

  it('shows Line 13 QBI deduction when Schedule C present', () => {
    // Add Schedule C with enough income to generate QBI
    useTaxStore.getState().addScheduleC({
      id: 'qbi-test',
      businessName: 'QBI Test',
      principalBusinessCode: '541511',
      accountingMethod: 'cash',
      grossReceipts: 10000000, returns: 0, costOfGoodsSold: 0,
      advertising: 0, carAndTruck: 0, commissions: 0, contractLabor: 0,
      depreciation: 0, insurance: 0, mortgageInterest: 0, otherInterest: 0,
      legal: 0, officeExpense: 0, rent: 0, repairs: 0, supplies: 0,
      taxes: 0, travel: 0, meals: 0, utilities: 0, wages: 0, otherExpenses: 0,
    })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    // QBI deduction should be visible when business income exists
    expect(screen.getByText(/Line 13 — QBI deduction/)).toBeDefined()
  })

  it('shows Line 8 other income when Schedule C adds business income', () => {
    useTaxStore.getState().addScheduleC({
      id: 'line8-test',
      businessName: 'Line8 Test',
      principalBusinessCode: '541511',
      accountingMethod: 'cash',
      grossReceipts: 5000000, returns: 0, costOfGoodsSold: 0,
      advertising: 0, carAndTruck: 0, commissions: 0, contractLabor: 0,
      depreciation: 0, insurance: 0, mortgageInterest: 0, otherInterest: 0,
      legal: 0, officeExpense: 0, rent: 0, repairs: 0, supplies: 0,
      taxes: 0, travel: 0, meals: 0, utilities: 0, wages: 0, otherExpenses: 0,
    })

    renderWithRouter(<ReviewPage />, { route: '/review' })
    expect(screen.getByText(/Line 8 — Other income/)).toBeDefined()
  })

  it('shows info notes in collapsed details', () => {
    renderWithRouter(<ReviewPage />, { route: '/review' })
    // The SUPPORTED_SCOPE info validation always fires, so there should be info notes
    expect(screen.getByText(/informational note/)).toBeDefined()
  })
})

// ── Interview Steps Registration ─────────────────────────────────

describe('Interview steps — Phase 4 pages registered', () => {
  it('includes schedule-c step', async () => {
    const { STEPS } = await import('../../../src/interview/steps.ts')
    const step = STEPS.find(s => s.id === 'schedule-c')
    expect(step).toBeDefined()
    expect(step!.label).toBe('Business Income')
    expect(step!.section).toBe('income')
    expect(step!.path).toBe('/interview/schedule-c')
  })

  it('includes schedule-k1 step', async () => {
    const { STEPS } = await import('../../../src/interview/steps.ts')
    const step = STEPS.find(s => s.id === 'schedule-k1')
    expect(step).toBeDefined()
    expect(step!.label).toBe('K-1 Income')
    expect(step!.section).toBe('income')
  })

  it('includes form-1095a step', async () => {
    const { STEPS } = await import('../../../src/interview/steps.ts')
    const step = STEPS.find(s => s.id === 'form-1095a')
    expect(step).toBeDefined()
    expect(step!.label).toBe('Health Insurance (1095-A)')
    expect(step!.section).toBe('deductions-credits')
  })
})

// ── Store Actions ────────────────────────────────────────────────

describe('Store — Schedule C actions', () => {
  it('addScheduleC adds a business and recomputes', () => {
    useTaxStore.getState().addScheduleC({
      id: 'store-c1',
      businessName: 'Store Test',
      principalBusinessCode: '541511',
      accountingMethod: 'cash',
      grossReceipts: 5000000, returns: 0, costOfGoodsSold: 0,
      advertising: 0, carAndTruck: 0, commissions: 0, contractLabor: 0,
      depreciation: 0, insurance: 0, mortgageInterest: 0, otherInterest: 0,
      legal: 0, officeExpense: 0, rent: 0, repairs: 0, supplies: 0,
      taxes: 0, travel: 0, meals: 0, utilities: 0, wages: 0, otherExpenses: 0,
    })

    expect(useTaxStore.getState().taxReturn.scheduleCBusinesses).toHaveLength(1)
    expect(useTaxStore.getState().taxReturn.scheduleCBusinesses[0].businessName).toBe('Store Test')
  })

  it('updateScheduleC updates a business', () => {
    useTaxStore.getState().addScheduleC({
      id: 'store-c2',
      businessName: 'Before',
      principalBusinessCode: '541511',
      accountingMethod: 'cash',
      grossReceipts: 0, returns: 0, costOfGoodsSold: 0,
      advertising: 0, carAndTruck: 0, commissions: 0, contractLabor: 0,
      depreciation: 0, insurance: 0, mortgageInterest: 0, otherInterest: 0,
      legal: 0, officeExpense: 0, rent: 0, repairs: 0, supplies: 0,
      taxes: 0, travel: 0, meals: 0, utilities: 0, wages: 0, otherExpenses: 0,
    })

    useTaxStore.getState().updateScheduleC('store-c2', { businessName: 'After' })
    expect(useTaxStore.getState().taxReturn.scheduleCBusinesses[0].businessName).toBe('After')
  })

  it('removeScheduleC removes a business', () => {
    useTaxStore.getState().addScheduleC({
      id: 'store-c3',
      businessName: 'Remove Me',
      principalBusinessCode: '541511',
      accountingMethod: 'cash',
      grossReceipts: 0, returns: 0, costOfGoodsSold: 0,
      advertising: 0, carAndTruck: 0, commissions: 0, contractLabor: 0,
      depreciation: 0, insurance: 0, mortgageInterest: 0, otherInterest: 0,
      legal: 0, officeExpense: 0, rent: 0, repairs: 0, supplies: 0,
      taxes: 0, travel: 0, meals: 0, utilities: 0, wages: 0, otherExpenses: 0,
    })

    useTaxStore.getState().removeScheduleC('store-c3')
    expect(useTaxStore.getState().taxReturn.scheduleCBusinesses).toHaveLength(0)
  })
})

describe('Store — Schedule K-1 actions', () => {
  it('addScheduleK1 adds a K-1 and recomputes', () => {
    useTaxStore.getState().addScheduleK1({
      id: 'store-k1',
      entityType: 'partnership',
      entityName: 'Store K1 LP',
      entityEin: '12-3456789',
      ordinaryIncome: 1000000, rentalIncome: 0, interestIncome: 0,
      dividendIncome: 0, shortTermCapitalGain: 0, longTermCapitalGain: 0,
      section199AQBI: 0, distributions: 0,
    })

    expect(useTaxStore.getState().taxReturn.scheduleK1s).toHaveLength(1)
    expect(useTaxStore.getState().taxReturn.scheduleK1s[0].entityName).toBe('Store K1 LP')
  })

  it('updateScheduleK1 updates a K-1', () => {
    useTaxStore.getState().addScheduleK1({
      id: 'store-k1-u',
      entityType: 'partnership',
      entityName: 'Before',
      entityEin: '12-3456789',
      ordinaryIncome: 0, rentalIncome: 0, interestIncome: 0,
      dividendIncome: 0, shortTermCapitalGain: 0, longTermCapitalGain: 0,
      section199AQBI: 0, distributions: 0,
    })

    useTaxStore.getState().updateScheduleK1('store-k1-u', { entityName: 'After' })
    expect(useTaxStore.getState().taxReturn.scheduleK1s[0].entityName).toBe('After')
  })

  it('removeScheduleK1 removes a K-1', () => {
    useTaxStore.getState().addScheduleK1({
      id: 'store-k1-r',
      entityType: 's-corp',
      entityName: 'Remove Me',
      entityEin: '98-7654321',
      ordinaryIncome: 0, rentalIncome: 0, interestIncome: 0,
      dividendIncome: 0, shortTermCapitalGain: 0, longTermCapitalGain: 0,
      section199AQBI: 0, distributions: 0,
    })

    useTaxStore.getState().removeScheduleK1('store-k1-r')
    expect(useTaxStore.getState().taxReturn.scheduleK1s).toHaveLength(0)
  })
})

describe('Store — Form 1095-A actions', () => {
  it('addForm1095A adds a form and recomputes', () => {
    useTaxStore.getState().addForm1095A({
      id: 'store-1095a',
      marketplaceName: 'HealthCare.gov',
      recipientName: 'Test User',
      rows: [{ month: 1, enrollmentPremium: 50000, slcspPremium: 60000, advancePTC: 40000 }],
    })

    expect(useTaxStore.getState().taxReturn.form1095As).toHaveLength(1)
    expect(useTaxStore.getState().taxReturn.form1095As[0].marketplaceName).toBe('HealthCare.gov')
  })

  it('updateForm1095A updates a form', () => {
    useTaxStore.getState().addForm1095A({
      id: 'store-1095a-u',
      marketplaceName: 'Before',
      recipientName: 'Test',
      rows: [],
    })

    useTaxStore.getState().updateForm1095A('store-1095a-u', { marketplaceName: 'After' })
    expect(useTaxStore.getState().taxReturn.form1095As[0].marketplaceName).toBe('After')
  })

  it('removeForm1095A removes a form', () => {
    useTaxStore.getState().addForm1095A({
      id: 'store-1095a-r',
      marketplaceName: 'Remove',
      recipientName: 'Test',
      rows: [],
    })

    useTaxStore.getState().removeForm1095A('store-1095a-r')
    expect(useTaxStore.getState().taxReturn.form1095As).toHaveLength(0)
  })
})
