import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// Mock idb (required by taxStore)
vi.mock('idb', () => ({
  openDB: vi.fn(() =>
    Promise.resolve({
      get: vi.fn(() => Promise.resolve(undefined)),
      put: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    }),
  ),
}))

// Mock data
const mockGapAnalysis = {
  items: [
    { category: 'personal', field: 'ssn', label: 'Taxpayer SSN', priority: 'required' },
  ],
  completionPercent: 65,
  readyToFile: false,
  nextSuggestedAction: 'Ask for SSN.',
  warnings: [],
}

const mockForm1040 = {
  line1a: { amount: 6000000, source: { kind: 'computed', nodeId: 'form1040.line1a', inputs: [] }, confidence: 1 },
  line2a: { amount: 0, source: { kind: 'computed', nodeId: 'form1040.line2a', inputs: [] }, confidence: 1 },
  line2b: { amount: 0, source: { kind: 'computed', nodeId: 'form1040.line2b', inputs: [] }, confidence: 1 },
  line3a: { amount: 0, source: { kind: 'computed', nodeId: 'form1040.line3a', inputs: [] }, confidence: 1 },
  line3b: { amount: 0, source: { kind: 'computed', nodeId: 'form1040.line3b', inputs: [] }, confidence: 1 },
  line7: { amount: 0, source: { kind: 'computed', nodeId: 'form1040.line7', inputs: [] }, confidence: 1 },
  line8: { amount: 0, source: { kind: 'computed', nodeId: 'form1040.line8', inputs: [] }, confidence: 1 },
  line9: { amount: 6000000, source: { kind: 'computed', nodeId: 'form1040.line9', inputs: [] }, confidence: 1 },
  line10: { amount: 0, source: { kind: 'computed', nodeId: 'form1040.line10', inputs: [] }, confidence: 1 },
  line11: { amount: 6000000, source: { kind: 'computed', nodeId: 'form1040.line11', inputs: [] }, confidence: 1 },
  line12: { amount: 1500000, source: { kind: 'computed', nodeId: 'form1040.line12', inputs: [] }, confidence: 1 },
  line13: { amount: 0, source: { kind: 'computed', nodeId: 'form1040.line13', inputs: [] }, confidence: 1 },
  line14: { amount: 1500000, source: { kind: 'computed', nodeId: 'form1040.line14', inputs: [] }, confidence: 1 },
  line15: { amount: 4500000, source: { kind: 'computed', nodeId: 'form1040.line15', inputs: [] }, confidence: 1 },
  line16: { amount: 560000, source: { kind: 'computed', nodeId: 'form1040.line16', inputs: [] }, confidence: 1 },
  line24: { amount: 560000, source: { kind: 'computed', nodeId: 'form1040.line24', inputs: [] }, confidence: 1 },
  line25: { amount: 900000, source: { kind: 'computed', nodeId: 'form1040.line25', inputs: [] }, confidence: 1 },
  line33: { amount: 900000, source: { kind: 'computed', nodeId: 'form1040.line33', inputs: [] }, confidence: 1 },
  line34: { amount: 340000, source: { kind: 'computed', nodeId: 'form1040.line34', inputs: [] }, confidence: 1 },
  line37: { amount: 0, source: { kind: 'computed', nodeId: 'form1040.line37', inputs: [] }, confidence: 1 },
}

const mockStatusResponse = {
  taxReturn: {
    taxYear: 2025,
    filingStatus: 'single',
    taxpayer: { firstName: 'John', lastName: 'Doe', ssn: '', address: { street: '123 Main', city: 'City', state: 'IL', zip: '60000' } },
    dependents: [],
    w2s: [{ id: 'w2-1', employerName: 'Acme Corp' }],
    form1099Bs: [],
    form1099INTs: [],
    form1099DIVs: [],
    rsuVestEvents: [],
    capitalTransactions: [],
    adjustments: [],
    deductions: { method: 'standard' },
    credits: [],
  },
  computeResult: {
    form1040: mockForm1040,
    scheduleB: { line4: mockForm1040.line2b, line6: mockForm1040.line3b, entries: { interest: [], dividends: [] }, required: false },
    values: {},
    executedSchedules: ['B'],
  },
  stateVersion: 3,
  gapAnalysis: mockGapAnalysis,
}

// Mock fetch
const mockFetch = vi.fn()

// Mock EventSource
class MockEventSource {
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  readyState = 0
  url: string

  constructor(url: string) {
    this.url = url
    // Simulate connection after a tick
    setTimeout(() => {
      this.readyState = 1
      this.onopen?.(new Event('open'))
    }, 0)
  }

  close() {
    this.readyState = 2
  }

  // Helper to simulate incoming SSE message
  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }
}

let mockEventSource: MockEventSource | null = null

beforeEach(() => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockStatusResponse),
  })
  vi.stubGlobal('fetch', mockFetch)
  vi.stubGlobal('EventSource', class extends MockEventSource {
    constructor(url: string) {
      super(url)
      mockEventSource = this
    }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  mockEventSource = null
})

// Lazy import after mocks
const { DashboardPage } = await import('../../../src/ui/pages/DashboardPage.tsx')

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  it('renders with mocked fetch data', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeDefined()
    })
  })

  it('shows completion bar with percentage', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('completion-bar')).toBeDefined()
      expect(screen.getByText(/65%/)).toBeDefined()
    })
  })

  it('shows tax summary with AGI and refund', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('tax-summary')).toBeDefined()
      // AGI = $60,000
      expect(screen.getByText('AGI')).toBeDefined()
      // Refund
      expect(screen.getByText('Refund')).toBeDefined()
    })
  })

  it('shows gap items', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('gap-items')).toBeDefined()
      expect(screen.getByText('Taxpayer SSN')).toBeDefined()
    })
  })

  it('SSE update triggers refetch', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeDefined()
    })

    // Initial fetch (status endpoint)
    const initialFetchCount = mockFetch.mock.calls.length

    // Simulate SSE state change
    mockEventSource?.simulateMessage({ type: 'stateChanged', stateVersion: 4, timestamp: new Date().toISOString() })

    // Should trigger another fetch
    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(initialFetchCount)
    })
  })

  it('shows error when API is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText(/Cannot reach API/)).toBeDefined()
    })
  })
})
