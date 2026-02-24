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

const { useTaxStore } = await import('../../src/store/taxStore.ts')
import { FilingStatusPage } from '../../src/ui/pages/FilingStatusPage.tsx'
import { DependentsPage } from '../../src/ui/pages/DependentsPage.tsx'
import { WelcomePage } from '../../src/ui/pages/WelcomePage.tsx'
import { InterviewNav } from '../../src/ui/pages/InterviewNav.tsx'
import { Button } from '../../src/ui/components/Button.tsx'
import { InfoTooltip } from '../../src/ui/components/InfoTooltip.tsx'
import { ScheduleCPage } from '../../src/ui/pages/ScheduleCPage.tsx'
import { ScheduleK1Page } from '../../src/ui/pages/ScheduleK1Page.tsx'
import { Form1095APage } from '../../src/ui/pages/Form1095APage.tsx'

function renderWithRouter(ui: React.ReactElement, { route = '/' } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

describe('Mobile touch target sizing', () => {
  it('Button md variant has mobile-first h-11 class', () => {
    render(<Button>Click</Button>)
    const btn = screen.getByRole('button', { name: 'Click' })
    expect(btn.className).toContain('h-11')
    expect(btn.className).toContain('sm:h-9')
  })

  it('Button sm variant has mobile-first h-9 class', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button', { name: 'Small' })
    expect(btn.className).toContain('h-9')
    expect(btn.className).toContain('sm:h-7')
  })

  it('Button icon variant has mobile-first h-9 w-9 class', () => {
    render(<Button size="icon" aria-label="Icon">X</Button>)
    const btn = screen.getByRole('button', { name: 'Icon' })
    expect(btn.className).toContain('h-9')
    expect(btn.className).toContain('w-9')
    expect(btn.className).toContain('sm:h-7')
    expect(btn.className).toContain('sm:w-7')
  })

  it('InfoTooltip button has mobile-enlarged padding', () => {
    renderWithRouter(
      <InfoTooltip
        explanation="Test explanation"
        pubName="Test Pub"
        pubUrl="https://example.com"
      />,
    )
    const btn = screen.getByRole('button', { name: 'More information' })
    expect(btn.className).toContain('p-3')
    expect(btn.className).toContain('-m-3')
    expect(btn.className).toContain('sm:p-1')
    expect(btn.className).toContain('sm:-m-1')
  })
})

describe('Responsive grid layouts', () => {
  it('DependentsPage grids are responsive (single-col on mobile)', async () => {
    const user = userEvent.setup()
    renderWithRouter(<DependentsPage />, { route: '/interview/dependents' })

    const addBtn = screen.getByRole('button', { name: /add dependent/i })
    await user.click(addBtn)

    // Verify that grids use responsive classes
    const { container } = renderWithRouter(<DependentsPage />, { route: '/interview/dependents' })
    // Need to re-add since it's a fresh render
    useTaxStore.getState().addDependent({
      firstName: '', lastName: '', ssn: '', relationship: '', monthsLived: 12, dateOfBirth: '',
    })
    const { container: c2 } = renderWithRouter(<DependentsPage />, { route: '/interview/dependents' })
    const grids = c2.querySelectorAll('.grid')
    for (const grid of grids) {
      // All grids in DependentsPage should use sm:grid-cols-2, not hardcoded grid-cols-2
      if (grid.className.includes('grid-cols-2')) {
        expect(grid.className).toContain('sm:grid-cols-2')
        expect(grid.className).toContain('grid-cols-1')
      }
    }
  })
})

describe('InterviewNav sticky positioning', () => {
  it('has sticky bottom positioning classes for mobile', () => {
    const mockInterview = {
      canGoPrev: true,
      canGoNext: true,
      goNext: vi.fn(),
      goPrev: vi.fn(),
    }
    renderWithRouter(<InterviewNav interview={mockInterview} />)

    // Find the nav container
    const backBtn = screen.getByRole('button', { name: /back/i })
    const navContainer = backBtn.parentElement!
    expect(navContainer.className).toContain('fixed')
    expect(navContainer.className).toContain('bottom-0')
    expect(navContainer.className).toContain('sm:static')
  })

  it('Back and Continue buttons have mobile-enlarged padding', () => {
    const mockInterview = {
      canGoPrev: true,
      canGoNext: true,
      goNext: vi.fn(),
      goPrev: vi.fn(),
    }
    renderWithRouter(<InterviewNav interview={mockInterview} />)

    const backBtn = screen.getByRole('button', { name: /back/i })
    const continueBtn = screen.getByRole('button', { name: /continue/i })
    expect(backBtn.className).toContain('py-3')
    expect(backBtn.className).toContain('sm:py-2.5')
    expect(continueBtn.className).toContain('py-3')
    expect(continueBtn.className).toContain('sm:py-2.5')
  })
})

describe('WelcomePage mobile responsiveness', () => {
  it('CTA button is full-width on mobile', () => {
    renderWithRouter(<WelcomePage />, { route: '/' })
    const btn = screen.getByRole('button', { name: /let's start/i })
    expect(btn.className).toContain('w-full')
    expect(btn.className).toContain('sm:w-auto')
  })

  it('heading uses responsive text size', () => {
    renderWithRouter(<WelcomePage />, { route: '/' })
    const heading = screen.getByRole('heading', { name: /welcome to opentax/i })
    expect(heading.className).toContain('text-2xl')
    expect(heading.className).toContain('sm:text-3xl')
  })
})

describe('Phase 4 pages mobile responsiveness', () => {
  it('ScheduleCPage uses max-w-xl constraint', () => {
    renderWithRouter(<ScheduleCPage />, { route: '/interview/schedule-c' })
    const container = screen.getByTestId('page-schedule-c')
    expect(container.className).toContain('max-w-xl')
    expect(container.className).toContain('mx-auto')
  })

  it('ScheduleCPage grids are responsive', async () => {
    const user = userEvent.setup()
    renderWithRouter(<ScheduleCPage />, { route: '/interview/schedule-c' })
    await user.click(screen.getByRole('button', { name: /add business/i }))

    const container = screen.getByTestId('page-schedule-c')
    const grids = container.querySelectorAll('.grid')
    for (const grid of grids) {
      // All grids should use responsive col classes
      expect(grid.className).toContain('grid-cols-1')
    }
  })

  it('ScheduleK1Page uses max-w-xl constraint', () => {
    renderWithRouter(<ScheduleK1Page />, { route: '/interview/schedule-k1' })
    const container = screen.getByTestId('page-schedule-k1')
    expect(container.className).toContain('max-w-xl')
    expect(container.className).toContain('mx-auto')
  })

  it('Form1095APage uses max-w-xl constraint', () => {
    renderWithRouter(<Form1095APage />, { route: '/interview/form-1095a' })
    const container = screen.getByTestId('page-form-1095a')
    expect(container.className).toContain('max-w-xl')
    expect(container.className).toContain('mx-auto')
  })

  it('Form1095APage monthly grid is responsive', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Form1095APage />, { route: '/interview/form-1095a' })
    await user.click(screen.getByRole('button', { name: /add 1095-a/i }))

    const container = screen.getByTestId('page-form-1095a')
    const grids = container.querySelectorAll('.grid')
    for (const grid of grids) {
      // Should have mobile-first single column
      expect(grid.className).toContain('grid-cols-1')
    }
  })
})

describe('ReviewPage mobile touch targets', () => {
  it('explain links have 40px touch targets on mobile', async () => {
    // Set up some income for the review page to render line items
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Test Corp',
      box1: 5000000,
      box2: 1500000,
      box3: 5000000,
      box4: 310000,
      box5: 5000000,
      box6: 72500,
      box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [],
      box13StatutoryEmployee: false,
      box13RetirementPlan: false,
      box13ThirdPartySickPay: false,
      box14: '',
    })

    const { ReviewPage } = await import('../../src/ui/pages/ReviewPage.tsx')
    renderWithRouter(<ReviewPage />, { route: '/review' })

    // Check that "?" links have w-10 h-10 classes for mobile
    const explainLinks = screen.getAllByText('?')
    for (const link of explainLinks) {
      expect(link.className).toContain('w-10')
      expect(link.className).toContain('h-10')
    }
  })
})
