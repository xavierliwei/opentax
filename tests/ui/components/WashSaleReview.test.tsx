import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { WashSaleReview } from '../../../src/ui/components/WashSaleReview.tsx'
import type { WashSaleMatch } from '../../../src/rules/2025/washSale.ts'
import type { CapitalTransaction } from '../../../src/model/types.ts'
import { cents } from '../../../src/model/traced.ts'

function makeTx(overrides: Partial<CapitalTransaction>): CapitalTransaction {
  return {
    id: 'tx-1',
    description: 'AAPL',
    dateAcquired: '2025-01-01',
    dateSold: '2025-06-15',
    proceeds: cents(1800),
    reportedBasis: cents(2500),
    adjustedBasis: cents(2500),
    adjustmentCode: null,
    adjustmentAmount: 0,
    gainLoss: cents(-700),
    washSaleLossDisallowed: 0,
    longTerm: false,
    category: 'A',
    source1099BId: 'src-1',
    ...overrides,
  }
}

const MATCH: WashSaleMatch = {
  lossSaleId: '1',
  replacementId: '2',
  disallowedLoss: cents(700),
  symbol: 'KO',
  lossSaleDate: '2025-08-10',
  replacementDate: '2025-08-25',
}

const TRANSACTIONS: CapitalTransaction[] = [
  makeTx({ id: '1', description: 'KO', dateSold: '2025-08-10', proceeds: cents(1800), reportedBasis: cents(2500), gainLoss: cents(-700) }),
  makeTx({ id: '2', description: 'KO', dateAcquired: '2025-08-25', dateSold: '2025-12-01', proceeds: cents(2000), reportedBasis: cents(1800), gainLoss: cents(200) }),
]

describe('WashSaleReview', () => {
  it('renders nothing when no matches', () => {
    const { container } = render(
      <WashSaleReview
        matches={[]}
        transactions={[]}
        onAccept={vi.fn()}
        onOverride={vi.fn()}
        decisions={[]}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders match details', () => {
    render(
      <WashSaleReview
        matches={[MATCH]}
        transactions={TRANSACTIONS}
        onAccept={vi.fn()}
        onOverride={vi.fn()}
        decisions={['pending']}
      />,
    )

    expect(screen.getByText('1 Wash Sale Detected')).toBeDefined()
    expect(screen.getByText('KO')).toBeDefined()
    expect(screen.getByText(/Sold 08\/10\/2025/)).toBeDefined()
    expect(screen.getByText(/Bought 08\/25\/2025/)).toBeDefined()
    expect(screen.getByText(/\$700\.00 loss disallowed/)).toBeDefined()
  })

  it('shows accept and override buttons when pending', () => {
    render(
      <WashSaleReview
        matches={[MATCH]}
        transactions={TRANSACTIONS}
        onAccept={vi.fn()}
        onOverride={vi.fn()}
        decisions={['pending']}
      />,
    )

    expect(screen.getByTestId('wash-accept-0')).toBeDefined()
    expect(screen.getByTestId('wash-override-0')).toBeDefined()
  })

  it('calls onAccept when accept button clicked', async () => {
    const onAccept = vi.fn()
    render(
      <WashSaleReview
        matches={[MATCH]}
        transactions={TRANSACTIONS}
        onAccept={onAccept}
        onOverride={vi.fn()}
        decisions={['pending']}
      />,
    )

    await userEvent.click(screen.getByTestId('wash-accept-0'))
    expect(onAccept).toHaveBeenCalledWith(0)
  })

  it('calls onOverride when override button clicked', async () => {
    const onOverride = vi.fn()
    render(
      <WashSaleReview
        matches={[MATCH]}
        transactions={TRANSACTIONS}
        onAccept={vi.fn()}
        onOverride={onOverride}
        decisions={['pending']}
      />,
    )

    await userEvent.click(screen.getByTestId('wash-override-0'))
    expect(onOverride).toHaveBeenCalledWith(0)
  })

  it('shows accepted state', () => {
    render(
      <WashSaleReview
        matches={[MATCH]}
        transactions={TRANSACTIONS}
        onAccept={vi.fn()}
        onOverride={vi.fn()}
        decisions={['accepted']}
      />,
    )

    expect(screen.getByText('Accepted')).toBeDefined()
    expect(screen.queryByTestId('wash-accept-0')).toBeNull()
  })

  it('shows overridden state', () => {
    render(
      <WashSaleReview
        matches={[MATCH]}
        transactions={TRANSACTIONS}
        onAccept={vi.fn()}
        onOverride={vi.fn()}
        decisions={['overridden']}
      />,
    )

    expect(screen.getByText('Overridden')).toBeDefined()
    expect(screen.getByText(/loss of \$700\.00 kept/)).toBeDefined()
  })

  it('renders multiple matches with plural heading', () => {
    const match2: WashSaleMatch = {
      lossSaleId: '3',
      replacementId: '4',
      disallowedLoss: cents(200),
      symbol: 'MSFT',
      lossSaleDate: '2025-09-01',
      replacementDate: '2025-09-15',
    }

    const extraTxns = [
      ...TRANSACTIONS,
      makeTx({ id: '3', description: 'MSFT', dateSold: '2025-09-01', gainLoss: cents(-200) }),
      makeTx({ id: '4', description: 'MSFT', dateAcquired: '2025-09-15', dateSold: '2025-12-01' }),
    ]

    render(
      <WashSaleReview
        matches={[MATCH, match2]}
        transactions={extraTxns}
        onAccept={vi.fn()}
        onOverride={vi.fn()}
        decisions={['pending', 'pending']}
      />,
    )

    expect(screen.getByText('2 Wash Sales Detected')).toBeDefined()
    expect(screen.getByTestId('wash-sale-match-0')).toBeDefined()
    expect(screen.getByTestId('wash-sale-match-1')).toBeDefined()
  })
})
