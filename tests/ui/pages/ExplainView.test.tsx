import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

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
import { ExplainView } from '../../../src/ui/pages/ExplainView.tsx'

function renderAtRoute(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="explain/:nodeId" element={<ExplainView />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useTaxStore.getState().resetReturn()
})

describe('ExplainView', () => {
  it('renders heading and SVG for a computed node with W-2 data', () => {
    // Populate store with a W-2
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Acme Corp',
      box1: 5_000_000,
      box2: 750_000,
    })

    renderAtRoute('/explain/form1040.line9')

    expect(screen.getByRole('heading', { name: 'Total income' })).toBeDefined()
    expect(screen.getByTestId('trace-svg')).toBeDefined()
    expect(screen.getByTestId('trace-text-fallback')).toBeDefined()
  })

  it('shows text fallback content in details element', () => {
    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Acme Corp',
      box1: 5_000_000,
      box2: 750_000,
    })

    renderAtRoute('/explain/form1040.line1a')

    const details = screen.getByTestId('trace-text-fallback')
    expect(details).toBeDefined()
    expect(details.textContent).toContain('Wages')
  })

  it('handles unknown nodeId gracefully without crashing', () => {
    renderAtRoute('/explain/nonexistent.node')

    expect(screen.getByTestId('page-explain')).toBeDefined()
    expect(screen.getByTestId('trace-svg')).toBeDefined()
    // Should show the unknown label in the heading
    expect(screen.getByRole('heading').textContent).toContain('Unknown')
  })

  it('updates SVG when collapse button is clicked', async () => {
    const user = userEvent.setup()

    useTaxStore.getState().addW2({
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Acme Corp',
      box1: 5_000_000,
      box2: 750_000,
    })

    renderAtRoute('/explain/form1040.line9')

    // form1040.line9 is a computed node with children — should have a toggle button
    const toggle = screen.getByTestId('toggle-form1040.line9')
    expect(toggle).toBeDefined()

    // Count nodes before collapse
    const svg = screen.getByTestId('trace-svg')
    const nodesBefore = svg.querySelectorAll('[data-testid^="trace-node-"]').length
    expect(nodesBefore).toBeGreaterThan(1)

    // Collapse
    await user.click(toggle)

    // After collapse only root should remain visible
    const nodesAfter = svg.querySelectorAll('[data-testid^="trace-node-"]').length
    expect(nodesAfter).toBe(1)
  })
})
