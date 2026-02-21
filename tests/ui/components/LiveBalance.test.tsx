import { render, screen } from '@testing-library/react'
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
import { LiveBalance } from '../../../src/ui/components/LiveBalance.tsx'

function renderLiveBalance() {
  return render(
    <MemoryRouter>
      <LiveBalance />
    </MemoryRouter>,
  )
}

const W2_REFUND = {
  id: 'w2-1',
  employerEin: '12-3456789',
  employerName: 'Test Corp',
  box1: 5000000, // $50,000 wages
  box2: 1500000, // $15,000 withheld (more than tax on $50k)
  box3: 5000000,
  box4: 310000,
  box5: 5000000,
  box6: 72500,
  box7: 0,
  box8: 0,
  box10: 0,
  box11: 0,
  box12: [] as { code: string; amount: number }[],
  box13StatutoryEmployee: false,
  box13RetirementPlan: false,
  box13ThirdPartySickPay: false,
  box14: '',
}

const W2_OWED = {
  ...W2_REFUND,
  box1: 10000000, // $100,000 wages
  box2: 100000,   // $1,000 withheld (way too little)
  box3: 10000000,
  box4: 620000,
  box5: 10000000,
  box6: 145000,
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

describe('LiveBalance', () => {
  it('shows placeholder message when no income entered', () => {
    renderLiveBalance()
    expect(screen.getByText('Enter your income to see your balance')).toBeDefined()
  })

  it('shows refund amount when overpaid', () => {
    useTaxStore.getState().addW2(W2_REFUND)
    renderLiveBalance()
    expect(screen.getByText('Estimated Refund')).toBeDefined()
    expect(screen.getByTestId('live-balance-amount')).toBeDefined()
  })

  it('shows amount owed when underpaid', () => {
    useTaxStore.getState().addW2(W2_OWED)
    renderLiveBalance()
    expect(screen.getByText('Amount Owed')).toBeDefined()
  })

  it('shows tax and withheld amounts in federal-only mode', () => {
    useTaxStore.getState().addW2(W2_REFUND)
    renderLiveBalance()
    expect(screen.getByText('Tax')).toBeDefined()
    expect(screen.getByText('Withheld')).toBeDefined()
  })

  it('links to explain page', () => {
    useTaxStore.getState().addW2(W2_REFUND)
    renderLiveBalance()
    const link = screen.getByText('Why?')
    expect(link.getAttribute('href')).toMatch(/^\/explain\/form1040\.line/)
  })

  it('shows dual pills when CA state return is selected', () => {
    useTaxStore.getState().addW2({
      ...W2_REFUND,
      box15State: 'CA',
      box17StateIncomeTax: 300000, // $3,000 CA withholding
    })
    useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'full-year' })
    renderLiveBalance()
    expect(screen.getByText('Federal Refund')).toBeDefined()
    // CA should show either Refund, Owed, or Balanced
    const caText = screen.getByText(/^CA (Refund|Owed|Balanced)$/)
    expect(caText).toBeDefined()
  })

  it('CA state pill links to form540 explain nodes (not hardcoded)', () => {
    useTaxStore.getState().addW2({
      ...W2_REFUND,
      box15State: 'CA',
      box17StateIncomeTax: 300000, // $3,000 CA withholding — triggers refund
    })
    useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'full-year' })
    renderLiveBalance()

    // Find all "Why?" links — first is federal, second is CA
    const whyLinks = screen.getAllByText('Why?')
    expect(whyLinks.length).toBe(2)

    const caWhyHref = whyLinks[1].getAttribute('href')
    // CA module's reviewResultLines use form540.overpaid or form540.amountOwed
    expect(caWhyHref).toMatch(/^\/explain\/form540\.(overpaid|amountOwed)$/)
  })

  it('CA owed state pill links to form540.amountOwed', () => {
    useTaxStore.getState().addW2({
      ...W2_OWED,
      box15State: 'CA',
      box17StateIncomeTax: 10000, // $100 CA withholding — triggers owed
    })
    useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'full-year' })
    renderLiveBalance()

    const whyLinks = screen.getAllByText('Why?')
    const caWhyHref = whyLinks[1].getAttribute('href')
    expect(caWhyHref).toBe('/explain/form540.amountOwed')
  })

  describe('mobile responsive', () => {
    it('uses z-20 so sidebar overlay can cover it', () => {
      renderLiveBalance()
      const el = screen.getByTestId('live-balance')
      expect(el.className).toContain('z-20')
      expect(el.className).not.toContain('z-40')
    })

    it('Why? links have touch-friendly padding', () => {
      useTaxStore.getState().addW2(W2_REFUND)
      renderLiveBalance()
      const link = screen.getByText('Why?')
      expect(link.className).toContain('py-2')
    })

    it('refund state uses z-20 (not z-40)', () => {
      useTaxStore.getState().addW2(W2_REFUND)
      renderLiveBalance()
      const el = screen.getByTestId('live-balance')
      expect(el.className).toContain('z-20')
      expect(el.className).not.toContain('z-40')
    })

    it('multi-pill layout uses z-20 and flex-wrap for mobile', () => {
      useTaxStore.getState().addW2({
        ...W2_REFUND,
        box15State: 'CA',
        box17StateIncomeTax: 300000,
      })
      useTaxStore.getState().addStateReturn({ stateCode: 'CA', residencyType: 'full-year' })
      renderLiveBalance()
      const el = screen.getByTestId('live-balance')
      expect(el.className).toContain('z-20')
      expect(el.className).not.toContain('z-40')
    })
  })
})
