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

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

describe('LiveBalance', () => {
  it('shows placeholder message when no income entered', () => {
    renderLiveBalance()
    expect(screen.getByText('Enter your income to see your balance')).toBeDefined()
  })

  it('shows refund amount when overpaid', () => {
    // Add a W-2 with wages and withholding that exceeds tax
    useTaxStore.getState().addW2({
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
      box12: [],
      box13StatutoryEmployee: false,
      box13RetirementPlan: false,
      box13ThirdPartySickPay: false,
      box14: '',
    })

    renderLiveBalance()
    expect(screen.getByText('Estimated Refund')).toBeDefined()
    expect(screen.getByTestId('live-balance-amount')).toBeDefined()
    expect(screen.getByText('Why this number?')).toBeDefined()
  })

  it('shows amount owed when underpaid', () => {
    // Add a W-2 with wages but very little withholding
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Test Corp',
      box1: 10000000, // $100,000 wages
      box2: 100000, // $1,000 withheld (way too little)
      box3: 10000000,
      box4: 620000,
      box5: 10000000,
      box6: 145000,
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

    renderLiveBalance()
    expect(screen.getByText('Amount You Owe')).toBeDefined()
  })

  it('shows tax and withheld amounts', () => {
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

    renderLiveBalance()
    // Should show Tax: and Withheld: labels
    expect(screen.getByText(/^Tax:/)).toBeDefined()
    expect(screen.getByText(/^Withheld:/)).toBeDefined()
  })

  it('links to explain page', () => {
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

    renderLiveBalance()
    const link = screen.getByText('Why this number?')
    expect(link.getAttribute('href')).toMatch(/^\/explain\/form1040\.line/)
  })
})
