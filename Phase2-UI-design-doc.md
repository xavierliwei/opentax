# OpenTax Phase 2 — UI Design Document

> **Status**: Draft
> **Date**: 2026-02-15
> **Scope**: Tax year 2025 (returns filed in 2026)
> **Prerequisite**: Phase 1 complete — 623 tests, rules engine, PDF compiler, explainability traces, Robinhood CSV parser

---

## Table of Contents

1. [Tech Stack Decisions](#1-tech-stack-decisions)
2. [Architecture Overview](#2-architecture-overview)
3. [State Management (Zustand Store)](#3-state-management-zustand-store)
4. [Live Tax Balance](#4-live-tax-balance)
5. [Feature 1: Guided Interview UI](#5-feature-1-guided-interview-ui)
6. [Feature 2: Document Upload with OCR](#6-feature-2-document-upload-with-ocr)
7. [Feature 3: Wash Sale Detection](#7-feature-3-wash-sale-detection)
8. [Feature 4: Multi-Broker CSV Import](#8-feature-4-multi-broker-csv-import)
9. [Feature 5: Interactive Explainability Graph](#9-feature-5-interactive-explainability-graph)
10. [Persistence & Export](#10-persistence--export)
11. [Implementation Order](#11-implementation-order)
12. [Complete File Index](#12-complete-file-index)
13. [Testing Strategy](#13-testing-strategy)

---

## 1. Tech Stack Decisions

### Already in place (Phase 1)

| Package | Version | Purpose |
|---|---|---|
| React | 19.2 | UI library |
| Vite | 7.3 | Dev server + bundler |
| Vitest | 3.2 | Test runner |
| TypeScript | 5.9 | Type safety |
| pdf-lib | 1.17 | PDF generation |
| idb | 8.0 | IndexedDB wrapper |

### New dependencies for Phase 2

| Package | Version | Why this one | Alternative considered |
|---|---|---|---|
| **Tailwind CSS** | v4 | CSS-native `@theme` directive, `@tailwindcss/vite` plugin — zero PostCSS config. Utility-first fits our form-heavy UI. | Vanilla CSS modules — too verbose for 50+ components |
| **Zustand** | v5 | Lightweight (~1 KB), built-in `persist` middleware, no providers/context wrapping, works seamlessly with React 19. | Redux Toolkit — overkill for single-page tax form; React Context — no built-in persistence, prop-drilling risk |
| **React Router** | v7 | File-based or config-based routing, widely adopted, stable. Needed for interview steps + explainability deep links. | TanStack Router — newer, less ecosystem support |
| **Tesseract.js** | v5 | Client-side OCR via WASM. All processing stays in-browser (no server). Supports English IRS forms well. | Cloud OCR API — requires server, costs money, privacy concerns with tax docs |
| **Heroicons** | v2 | Clean, MIT-licensed icon set by Tailwind team. Consistent with Tailwind aesthetic. | Lucide — good but larger bundle |

### Tailwind v4 Setup

Tailwind v4 uses CSS-native configuration instead of `tailwind.config.js`:

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-tax-green: #16a34a;    /* refund */
  --color-tax-red: #dc2626;      /* amount owed */
  --color-tax-blue: #2563eb;     /* computed nodes */
  --color-tax-gray: #6b7280;     /* user-entry nodes */
  --color-brand: #1e40af;        /* OpenTax blue */
  --color-sidebar: #f8fafc;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

No `tailwind.config.js`, no PostCSS config, no `content` globs. Tailwind v4 auto-detects source files.

---

## 2. Architecture Overview

### Component Tree

```
<App>
  <BrowserRouter>
    <AppShell>
      ├── <Sidebar />              ← step list, progress bar
      ├── <LiveBalance />           ← sticky refund/owed bar
      └── <main>
            <Routes>
              <Route path="/" element={<Welcome />} />
              <Route path="/interview/:stepId" element={<InterviewStep />} />
              <Route path="/review" element={<Review />} />
              <Route path="/download" element={<Download />} />
              <Route path="/explain/:nodeId" element={<ExplainView />} />
            </Routes>
          </main>
    </AppShell>
  </BrowserRouter>
</App>
```

### Data Flow

```
                    ┌─────────────┐
                    │  User Input  │  (interview pages, CSV upload, OCR)
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Zustand Store│  holds TaxReturn + ComputeResult
                    │  useTaxStore │
                    └──────┬──────┘
                           │  every mutation calls:
                           ▼
              ┌────────────────────────┐
              │ computeAll(taxReturn)  │  src/rules/engine.ts
              └────────────┬───────────┘
                           │  returns ComputeResult
                           ▼
              ┌────────────────────────┐
              │   Store updates        │
              │   computeResult field  │
              └────────────┬───────────┘
                           │
              ┌────────────┼──────────────┐
              │            │              │
              ▼            ▼              ▼
        LiveBalance   Interview      Explainability
        component     pages (read)   graph (read)
```

### Key Invariant

**Every store mutation triggers `computeAll()`.** The user always sees the correct tax balance, no matter which page they are on. There is no "calculate" button — the result is always fresh.

---

## 3. State Management (Zustand Store)

### File: `src/store/taxStore.ts`

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TaxReturn, FilingStatus, W2, Form1099INT,
  Form1099DIV, CapitalTransaction, Dependent, Taxpayer,
  RSUVestEvent, Adjustment, ItemizedDeductions, Credit } from '../model/types'
import type { ComputeResult } from '../rules/engine'
import { computeAll } from '../rules/engine'
import { emptyTaxReturn } from '../model/types'
import { get, set, del } from 'idb-keyval'

export interface TaxStoreState {
  // ── Core data ─────────────────────────────────────
  taxReturn: TaxReturn
  computeResult: ComputeResult

  // ── Filing status ─────────────────────────────────
  setFilingStatus: (status: FilingStatus) => void

  // ── Taxpayer / Spouse ─────────────────────────────
  setTaxpayer: (taxpayer: Partial<Taxpayer>) => void
  setSpouse: (spouse: Partial<Taxpayer>) => void
  removeSpouse: () => void

  // ── Dependents ────────────────────────────────────
  addDependent: (dep: Dependent) => void
  updateDependent: (index: number, dep: Partial<Dependent>) => void
  removeDependent: (index: number) => void

  // ── W-2s ──────────────────────────────────────────
  addW2: (w2: W2) => void
  updateW2: (id: string, patch: Partial<W2>) => void
  removeW2: (id: string) => void

  // ── 1099-INT ──────────────────────────────────────
  addForm1099INT: (form: Form1099INT) => void
  updateForm1099INT: (id: string, patch: Partial<Form1099INT>) => void
  removeForm1099INT: (id: string) => void

  // ── 1099-DIV ──────────────────────────────────────
  addForm1099DIV: (form: Form1099DIV) => void
  updateForm1099DIV: (id: string, patch: Partial<Form1099DIV>) => void
  removeForm1099DIV: (id: string) => void

  // ── Capital transactions ──────────────────────────
  setCapitalTransactions: (txns: CapitalTransaction[]) => void
  addCapitalTransaction: (tx: CapitalTransaction) => void
  removeCapitalTransaction: (id: string) => void

  // ── RSU vest events ───────────────────────────────
  addRSUVestEvent: (event: RSUVestEvent) => void
  removeRSUVestEvent: (id: string) => void

  // ── Adjustments ───────────────────────────────────
  addAdjustment: (adj: Adjustment) => void
  removeAdjustment: (id: string) => void

  // ── Deductions ────────────────────────────────────
  setDeductionMethod: (method: 'standard' | 'itemized') => void
  setItemizedDeductions: (d: Partial<ItemizedDeductions>) => void

  // ── Credits ───────────────────────────────────────
  addCredit: (credit: Credit) => void
  removeCredit: (id: string) => void

  // ── Bulk ──────────────────────────────────────────
  importReturn: (taxReturn: TaxReturn) => void
  resetReturn: () => void
}
```

### Recompute Pattern

Every mutating action follows the same pattern:

```ts
setFilingStatus: (status) => set((state) => {
  const taxReturn = { ...state.taxReturn, filingStatus: status }
  return { taxReturn, computeResult: computeAll(taxReturn) }
}),
```

This guarantees that `computeResult` is always consistent with `taxReturn`. The `computeAll()` function runs in <5 ms for typical returns (benchmarked in Phase 1), so there is no performance concern.

### Persistence — IndexedDB via `idb-keyval`

```ts
const useTaxStore = create<TaxStoreState>()(
  persist(
    (set) => ({
      taxReturn: emptyTaxReturn(2025),
      computeResult: computeAll(emptyTaxReturn(2025)),
      // ... all actions
    }),
    {
      name: 'opentax-return',
      storage: {
        getItem: async (name) => {
          const val = await get(name)
          return val ?? null
        },
        setItem: async (name, value) => {
          await set(name, value)
        },
        removeItem: async (name) => {
          await del(name)
        },
      },
      partialize: (state) => ({ taxReturn: state.taxReturn }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.computeResult = computeAll(state.taxReturn)
        }
      },
    }
  )
)
```

**Key design decisions:**

1. **Only persist `taxReturn`, not `computeResult`.** The result is deterministic — rehydrate triggers `computeAll()` to rebuild it.
2. **Use `idb-keyval`** (already depends on `idb` 8.0) instead of `localStorage` — no 5 MB limit, better for large transaction lists.
3. **SSN is persisted** in IndexedDB (user's own device, encrypted at rest by the OS), but never sent to any server.

### Selectors

Components use fine-grained selectors to minimize re-renders:

```ts
// Only re-renders when refund/owed changes
const refund = useTaxStore(s => s.computeResult.form1040.line34.amount)
const owed = useTaxStore(s => s.computeResult.form1040.line37.amount)

// Only re-renders when W-2 list changes
const w2s = useTaxStore(s => s.taxReturn.w2s)
```

---

## 4. Live Tax Balance

### Component: `src/ui/components/LiveBalance.tsx`

The `LiveBalance` component is a sticky bar that appears on every interview page, showing the user's current tax position at all times.

### Visual Spec

```
┌──────────────────────────────────────────────────────────────────┐
│  Estimated Refund         Federal Tax      Withheld              │
│  $4,265.50                $12,770.00       $17,035.50            │
│  ██████████ green         ────────────     ────────────          │
│                                       Why this number? →        │
└──────────────────────────────────────────────────────────────────┘
```

### Behavior

| State | Display | Color |
|---|---|---|
| `line34.amount > 0` | "Estimated Refund: $X,XXX.XX" | `text-tax-green` (green-600) |
| `line37.amount > 0` | "Amount You Owe: $X,XXX.XX" | `text-tax-red` (red-600) |
| Both zero | "Tax Balance: $0.00" | `text-gray-500` |
| No income entered yet | "Enter your income to see your balance" | `text-gray-400` |

### Data Source

```ts
// From ComputeResult (src/rules/engine.ts → Form1040Result):
computeResult.form1040.line16   // Total tax (cents)
computeResult.form1040.line25   // Federal income tax withheld (cents)
computeResult.form1040.line33   // Total payments (cents)
computeResult.form1040.line34   // Overpaid / refund (cents)
computeResult.form1040.line37   // Amount you owe (cents)
```

### Features

- **Sticky positioning**: `position: sticky; top: 0; z-index: 40` — stays visible while scrolling
- **Animation**: Amount changes animate with a brief number-counting transition (CSS `transition` on opacity + transform, JS `requestAnimationFrame` for counting)
- **"Why this number?" link**: Navigates to `/explain/form1040.line34` or `/explain/form1040.line37` — directly into the explainability graph
- **Breakdown tooltip**: Hovering/clicking shows:
  - Total income (line 9)
  - Deductions (line 14)
  - Tax computed (line 16)
  - Total withheld (line 25)
  - Difference = refund or owed

### Component Implementation Outline

```tsx
export function LiveBalance() {
  const line34 = useTaxStore(s => s.computeResult.form1040.line34.amount)
  const line37 = useTaxStore(s => s.computeResult.form1040.line37.amount)
  const line16 = useTaxStore(s => s.computeResult.form1040.line16.amount)
  const line25 = useTaxStore(s => s.computeResult.form1040.line25.amount)
  const hasIncome = useTaxStore(s => s.computeResult.form1040.line9.amount > 0)

  if (!hasIncome) {
    return <div className="...">Enter your income to see your balance</div>
  }

  const isRefund = line34 > 0
  const amount = isRefund ? line34 : line37
  const label = isRefund ? 'Estimated Refund' : 'Amount You Owe'
  const color = isRefund ? 'text-tax-green' : 'text-tax-red'
  const explainNode = isRefund ? 'form1040.line34' : 'form1040.line37'

  return (
    <div className="sticky top-0 z-40 bg-white border-b px-6 py-3 flex items-center justify-between">
      <div>
        <span className="text-sm text-gray-500">{label}</span>
        <span className={`text-2xl font-bold ${color} ml-2`}>
          {formatCurrency(amount)}
        </span>
      </div>
      <div className="flex items-center gap-6 text-sm text-gray-500">
        <span>Tax: {formatCurrency(line16)}</span>
        <span>Withheld: {formatCurrency(line25)}</span>
        <Link to={`/explain/${explainNode}`} className="text-brand underline">
          Why this number?
        </Link>
      </div>
    </div>
  )
}

function formatCurrency(cents: number): string {
  const d = Math.abs(cents) / 100
  const formatted = d.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return cents < 0 ? `-${formatted}` : formatted
}
```

---

## 5. Feature 1: Guided Interview UI

### Interview Flow — 13 Steps

```
 ┌─ Welcome ─────────────────────────────────────────────┐
 │  "Let's file your 2025 taxes"                         │
 │  [Start] button                                       │
 └───────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ Filing Status ───────────────────────────────────────┐
 │  Radio: Single / MFJ / MFS / HoH / QW                │
 └───────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ Personal Info ───────────────────────────────────────┐
 │  First, MI, Last, SSN, DOB, Address                   │
 └───────────────────────────────────────────────────────┘
          │
          ▼  (only if MFJ)
 ┌─ Spouse Info ─────────────────────────────────────────┐
 │  Same fields as Personal Info                         │
 └───────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ Dependents ──────────────────────────────────────────┐
 │  Repeatable section: name, SSN, relationship, months  │
 │  [+ Add dependent]                                    │
 └───────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ W-2 Income ──────────────────────────────────────────┐
 │  [Upload W-2 photo] or manual entry                   │
 │  Repeatable: employer, box1, box2, ...                │
 │  [+ Add another W-2]                                  │
 └───────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ Interest Income (1099-INT) ──────────────────────────┐
 │  Repeatable: payer, box1, box3, box4, box8            │
 │  [+ Add 1099-INT]                                     │
 └───────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ Dividend Income (1099-DIV) ──────────────────────────┐
 │  Repeatable: payer, box1a, box1b, box2a, box4         │
 │  [+ Add 1099-DIV]                                     │
 └───────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ Stock Sales ─────────────────────────────────────────┐
 │  [Upload CSV from broker]                             │
 │  Broker auto-detection + transaction table            │
 │  Manual add/edit transactions                         │
 └───────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ RSU Income ──────────────────────────────────────────┐
 │  Repeatable: vest date, symbol, shares, FMV, W-2 link │
 │  [+ Add RSU vest event]                               │
 └───────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ Deductions ──────────────────────────────────────────┐
 │  Toggle: Standard (shown amount) / Itemized           │
 │  If itemized: medical, SALT, mortgage, charitable     │
 │  Side-by-side comparison                              │
 └───────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ Review ──────────────────────────────────────────────┐
 │  Full 1040 summary, all schedules                     │
 │  Edit links back to each section                      │
 │  Explainability links for every line                  │
 └───────────────────────────────────────────────────────┘
          │
          ▼
 ┌─ Download ────────────────────────────────────────────┐
 │  [Generate PDF] → calls compileFilingPackage()        │
 │  Preview summary, download button                     │
 │  JSON export option                                   │
 └───────────────────────────────────────────────────────┘
```

### Step Definitions — `src/interview/steps.ts`

Each step is a declarative definition. The interview engine uses these to determine navigation, progress, and visibility.

```ts
export interface InterviewStep {
  id: string
  label: string                           // sidebar display name
  path: string                            // URL path segment
  isVisible: (tr: TaxReturn) => boolean   // should this step show?
  isComplete: (tr: TaxReturn) => boolean  // green checkmark?
  component: React.ComponentType          // lazy loaded page
}

export const STEPS: InterviewStep[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    path: '/',
    isVisible: () => true,
    isComplete: () => true,  // always "done"
    component: WelcomePage,
  },
  {
    id: 'filing-status',
    label: 'Filing Status',
    path: '/interview/filing-status',
    isVisible: () => true,
    isComplete: (tr) => tr.filingStatus !== undefined,
    component: FilingStatusPage,
  },
  {
    id: 'personal-info',
    label: 'Your Info',
    path: '/interview/personal-info',
    isVisible: () => true,
    isComplete: (tr) =>
      tr.taxpayer.firstName.length > 0 &&
      tr.taxpayer.lastName.length > 0 &&
      tr.taxpayer.ssn.length === 9 &&
      tr.taxpayer.address.street.length > 0 &&
      tr.taxpayer.address.city.length > 0 &&
      tr.taxpayer.address.state.length === 2 &&
      tr.taxpayer.address.zip.length >= 5,
    component: PersonalInfoPage,
  },
  {
    id: 'spouse-info',
    label: 'Spouse Info',
    path: '/interview/spouse-info',
    isVisible: (tr) => tr.filingStatus === 'mfj',
    isComplete: (tr) =>
      tr.spouse !== undefined &&
      tr.spouse.firstName.length > 0 &&
      tr.spouse.lastName.length > 0 &&
      tr.spouse.ssn.length === 9,
    component: SpouseInfoPage,
  },
  {
    id: 'dependents',
    label: 'Dependents',
    path: '/interview/dependents',
    isVisible: () => true,
    isComplete: () => true,  // zero dependents is valid
    component: DependentsPage,
  },
  {
    id: 'w2-income',
    label: 'W-2 Income',
    path: '/interview/w2-income',
    isVisible: () => true,
    isComplete: (tr) => tr.w2s.length > 0,
    component: W2IncomePage,
  },
  {
    id: 'interest-income',
    label: 'Interest',
    path: '/interview/interest-income',
    isVisible: () => true,
    isComplete: () => true,  // zero interest is valid
    component: InterestIncomePage,
  },
  {
    id: 'dividend-income',
    label: 'Dividends',
    path: '/interview/dividend-income',
    isVisible: () => true,
    isComplete: () => true,  // zero dividends is valid
    component: DividendIncomePage,
  },
  {
    id: 'stock-sales',
    label: 'Stock Sales',
    path: '/interview/stock-sales',
    isVisible: () => true,
    isComplete: () => true,  // zero trades is valid
    component: StockSalesPage,
  },
  {
    id: 'rsu-income',
    label: 'RSU Income',
    path: '/interview/rsu-income',
    isVisible: (tr) => tr.rsuVestEvents.length > 0 || tr.w2s.some(w =>
      w.box12.some(e => e.code === 'V')
    ),
    isComplete: () => true,
    component: RSUIncomePage,
  },
  {
    id: 'deductions',
    label: 'Deductions',
    path: '/interview/deductions',
    isVisible: () => true,
    isComplete: () => true,  // standard is the default
    component: DeductionsPage,
  },
  {
    id: 'review',
    label: 'Review',
    path: '/review',
    isVisible: () => true,
    isComplete: () => false,  // never auto-complete
    component: ReviewPage,
  },
  {
    id: 'download',
    label: 'Download',
    path: '/download',
    isVisible: () => true,
    isComplete: () => false,
    component: DownloadPage,
  },
]
```

### Interview Hook — `src/interview/useInterview.ts`

```ts
export function useInterview() {
  const taxReturn = useTaxStore(s => s.taxReturn)
  const location = useLocation()
  const navigate = useNavigate()

  // Filter to visible steps only
  const visibleSteps = STEPS.filter(s => s.isVisible(taxReturn))

  // Find current step index
  const currentIndex = visibleSteps.findIndex(s => s.path === location.pathname)

  const progress = {
    current: currentIndex + 1,
    total: visibleSteps.length,
    percent: Math.round(((currentIndex + 1) / visibleSteps.length) * 100),
    completedCount: visibleSteps.filter(s => s.isComplete(taxReturn)).length,
  }

  return {
    steps: visibleSteps,
    currentStep: visibleSteps[currentIndex],
    currentIndex,
    progress,

    goNext: () => {
      if (currentIndex < visibleSteps.length - 1) {
        navigate(visibleSteps[currentIndex + 1].path)
      }
    },
    goPrev: () => {
      if (currentIndex > 0) {
        navigate(visibleSteps[currentIndex - 1].path)
      }
    },
    goToStep: (stepId: string) => {
      const step = visibleSteps.find(s => s.id === stepId)
      if (step) navigate(step.path)
    },
    canGoNext: currentIndex < visibleSteps.length - 1,
    canGoPrev: currentIndex > 0,
  }
}
```

### AppShell Layout — `src/ui/components/AppShell.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│                        LiveBalance (sticky)                      │
├────────────┬─────────────────────────────────────────────────────┤
│            │                                                     │
│  Sidebar   │            Main Content Area                        │
│            │                                                     │
│  ✓ Welcome │     ┌─────────────────────────────────────────┐     │
│  ✓ Filing  │     │                                         │     │
│  ● Your In │     │     <InterviewStep />                   │     │
│  ○ Spouse  │     │     (current page component)            │     │
│  ○ W-2     │     │                                         │     │
│  ○ 1099-INT│     │                                         │     │
│  ○ 1099-DIV│     │                                         │     │
│  ○ Stocks  │     │                                         │     │
│  ○ Deduct. │     │                                         │     │
│  ○ Review  │     │     ┌──────────┐  ┌──────────┐          │     │
│  ○ Download│     │     │ ← Back   │  │  Next →  │          │     │
│            │     │     └──────────┘  └──────────┘          │     │
│ ─────────  │     └─────────────────────────────────────────┘     │
│ Progress:  │                                                     │
│ ████░░ 40% │                                                     │
│            │                                                     │
├────────────┴─────────────────────────────────────────────────────┤
│  Step 3 of 11 · 40% complete                                    │
└──────────────────────────────────────────────────────────────────┘
```

- **Sidebar width**: 240 px, collapsible on mobile (< 768px) to a hamburger menu
- **Step indicators**: `✓` = completed (green), `●` = current (blue), `○` = pending (gray)
- **Invisible steps**: Don't appear in sidebar (e.g., Spouse when filing Single)

### Reusable Form Components — `src/ui/components/`

#### `CurrencyInput`

Dollar-display input that stores integer cents internally.

```tsx
interface CurrencyInputProps {
  label: string
  value: number         // cents
  onChange: (cents: number) => void
  placeholder?: string
  required?: boolean
  helperText?: string
}
```

**Behavior:**
- User types `60000` or `60,000` or `$60,000` or `60000.00`
- Display shows `$60,000.00` on blur
- Internal value: `6000000` (cents)
- `onChange` emits `6000000`
- Uses `inputMode="decimal"` on mobile for numeric keyboard
- Strips non-numeric characters before parsing

#### `SSNInput`

Masked SSN input with format `XXX-XX-XXXX`.

```tsx
interface SSNInputProps {
  label: string
  value: string         // 9 digits, no dashes
  onChange: (ssn: string) => void
  masked?: boolean      // default true — shows ***-**-1234
}
```

**Behavior:**
- Display: `•••-••-1234` (last 4 visible)
- Edit mode: shows full SSN while focused
- Auto-formats with dashes during typing
- Validates: exactly 9 digits, no leading 9 (ITIN) or 000
- `inputMode="numeric"` on mobile

#### `DateInput`

ISO date input with calendar picker fallback.

```tsx
interface DateInputProps {
  label: string
  value: string         // ISO date "YYYY-MM-DD"
  onChange: (date: string) => void
}
```

#### `StateSelect`

Dropdown of US states + DC.

```tsx
interface StateSelectProps {
  label: string
  value: string         // 2-letter code
  onChange: (code: string) => void
}
```

50 states + DC + territories (PR, VI, GU, AS, MP).

#### `RepeatableSection`

Generic container for adding/removing items (W-2s, dependents, 1099s).

```tsx
interface RepeatableSectionProps<T> {
  label: string
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  onAdd: () => void
  onRemove: (index: number) => void
  addLabel?: string     // "Add another W-2"
  maxItems?: number
  emptyMessage?: string // "No W-2s added yet"
}
```

#### `DocumentCard`

Summary card for an uploaded/entered document (W-2, 1099).

```tsx
interface DocumentCardProps {
  title: string         // "W-2 from Acme Corp"
  subtitle?: string     // "$60,000.00 wages"
  onEdit: () => void
  onRemove: () => void
  confidence?: number   // OCR confidence (0–1) — shows indicator
}
```

### Page Component Specs

#### 5a. Welcome Page — `src/ui/pages/WelcomePage.tsx`

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              OpenTax                                 │
│              Free, open-source tax filing             │
│              for tax year 2025                       │
│                                                      │
│     Your data never leaves your browser.             │
│     No accounts. No servers. No fees.                │
│                                                      │
│              ┌─────────────────────┐                 │
│              │    Let's Start →    │                 │
│              └─────────────────────┘                 │
│                                                      │
│     [Import a saved return (JSON)]                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **[Let's Start]** → navigates to `/interview/filing-status`
- **[Import]** → file picker for JSON, calls `importReturn()`

#### 5b. Filing Status Page — `src/ui/pages/FilingStatusPage.tsx`

```
┌──────────────────────────────────────────────────────┐
│  What is your filing status?                         │
│                                                      │
│  ○ Single                                            │
│    You're unmarried or legally separated.             │
│                                                      │
│  ○ Married Filing Jointly (MFJ)                      │
│    You and your spouse file one return together.      │
│                                                      │
│  ○ Married Filing Separately (MFS)                   │
│    You and your spouse each file your own return.     │
│                                                      │
│  ○ Head of Household (HoH)                           │
│    Unmarried and paying >50% of household costs.     │
│                                                      │
│  ○ Qualifying Surviving Spouse (QW)                  │
│    Spouse died in 2023 or 2024, you have a           │
│    dependent child.                                  │
│                                                      │
│              ← Back        Next →                    │
└──────────────────────────────────────────────────────┘
```

**Store action**: `setFilingStatus(status)`

- Selecting MFJ makes the Spouse step visible
- Changing from MFJ to another status calls `removeSpouse()`

#### 5c. Personal Info Page — `src/ui/pages/PersonalInfoPage.tsx`

**Fields:**

| Field | Component | Model path | Validation |
|---|---|---|---|
| First name | `<input>` | `taxpayer.firstName` | Required, max 50 chars |
| Middle initial | `<input maxLength={1}>` | `taxpayer.middleInitial` | Optional, single letter |
| Last name | `<input>` | `taxpayer.lastName` | Required, max 50 chars |
| SSN | `<SSNInput>` | `taxpayer.ssn` | 9 digits |
| Date of birth | `<DateInput>` | `taxpayer.dateOfBirth` | Optional, valid date |
| Street address | `<input>` | `taxpayer.address.street` | Required |
| Apartment | `<input>` | `taxpayer.address.apartment` | Optional |
| City | `<input>` | `taxpayer.address.city` | Required |
| State | `<StateSelect>` | `taxpayer.address.state` | Required, 2-letter |
| ZIP | `<input>` | `taxpayer.address.zip` | Required, 5 or 9 digits |

**Store action**: `setTaxpayer({ ...partial })` — each field calls on blur.

#### 5d. Spouse Info Page — `src/ui/pages/SpouseInfoPage.tsx`

Same layout as Personal Info but for `spouse`. Only visible when `filingStatus === 'mfj'`.

**Store action**: `setSpouse({ ...partial })`

#### 5e. Dependents Page — `src/ui/pages/DependentsPage.tsx`

```
┌──────────────────────────────────────────────────────┐
│  Do you have any dependents?                         │
│                                                      │
│  ┌ Dependent #1 ─────────────────────────────── ✕ ┐  │
│  │  First: [        ]  Last: [        ]           │  │
│  │  SSN: [•••-••-1234]  Relationship: [dropdown]  │  │
│  │  Months lived with you: [12 ▼]                 │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [+ Add another dependent]                           │
│                                                      │
│              ← Back        Next →                    │
└──────────────────────────────────────────────────────┘
```

- Uses `<RepeatableSection>` with `Dependent` items
- Relationship dropdown: son, daughter, stepchild, foster child, sibling, parent, grandchild, other
- Months dropdown: 0–12
- **Store actions**: `addDependent()`, `updateDependent()`, `removeDependent()`

#### 5f. W-2 Income Page — `src/ui/pages/W2IncomePage.tsx`

```
┌──────────────────────────────────────────────────────┐
│  W-2 Wage and Tax Statements                        │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  📄 Upload W-2 image for automatic OCR       │    │
│  │  [Drop file here or click to browse]          │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Or enter manually:                                  │
│                                                      │
│  ┌ W-2 #1: Acme Corp ─────────────────────── ✕ ┐    │
│  │  Employer name: [Acme Corp    ]               │    │
│  │  Employer EIN:  [12-3456789   ]               │    │
│  │                                               │    │
│  │  Box 1 (Wages):              [$60,000.00]     │    │
│  │  Box 2 (Fed. tax withheld):  [$6,000.00 ]     │    │
│  │  Box 3 (SS wages):           [$60,000.00]     │    │
│  │  Box 4 (SS tax withheld):    [$3,720.00 ]     │    │
│  │  Box 5 (Medicare wages):     [$60,000.00]     │    │
│  │  Box 6 (Medicare withheld):  [$870.00   ]     │    │
│  │                                               │    │
│  │  ▸ Show Box 7–20 (advanced)                   │    │
│  └───────────────────────────────────────────────┘    │
│                                                      │
│  [+ Add another W-2]                                 │
│                                                      │
│              ← Back        Next →                    │
└──────────────────────────────────────────────────────┘
```

- Top section: OCR upload area (see Feature 2)
- Each W-2 uses `<CurrencyInput>` for all box fields
- Advanced section (collapsed by default): boxes 7, 8, 10, 11, 12a–12d, 13 checkboxes, 14, 15–20
- Box 12 entries: repeatable up to 4, each with code dropdown + amount
- **Store actions**: `addW2()`, `updateW2()`, `removeW2()`

**W2 model mapping** (from `src/model/types.ts`):

| UI field | W2 property | Type |
|---|---|---|
| Box 1 Wages | `box1` | cents |
| Box 2 Federal withheld | `box2` | cents |
| Box 3 SS wages | `box3` | cents |
| Box 4 SS tax | `box4` | cents |
| Box 5 Medicare wages | `box5` | cents |
| Box 6 Medicare tax | `box6` | cents |
| Box 12 | `box12: W2Box12Entry[]` | code + cents |
| Box 13 | `box13StatutoryEmployee`, etc. | boolean |

#### 5g. Interest Income Page — `src/ui/pages/InterestIncomePage.tsx`

```
┌──────────────────────────────────────────────────────┐
│  Interest Income (1099-INT)                          │
│                                                      │
│  ┌ 1099-INT #1: Savings Bank ────────────── ✕ ┐     │
│  │  Payer name: [Savings Bank ]                │     │
│  │  Box 1 (Interest income):     [$1,200.00]   │     │
│  │  Box 3 (US Savings Bonds):    [$0.00    ]   │     │
│  │  Box 4 (Fed. tax withheld):   [$0.00    ]   │     │
│  │  Box 8 (Tax-exempt interest): [$0.00    ]   │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  [+ Add 1099-INT]                                    │
│                                                      │
│              ← Back        Next →                    │
└──────────────────────────────────────────────────────┘
```

**Store actions**: `addForm1099INT()`, `updateForm1099INT()`, `removeForm1099INT()`

**Model mapping** (from `Form1099INT` in `src/model/types.ts`):

| UI field | Property | Type |
|---|---|---|
| Box 1 Interest income | `box1` | cents |
| Box 2 Early withdrawal penalty | `box2` | cents |
| Box 3 US savings bonds | `box3` | cents |
| Box 4 Federal withheld | `box4` | cents |
| Box 8 Tax-exempt interest | `box8` | cents |

#### 5h. Dividend Income Page — `src/ui/pages/DividendIncomePage.tsx`

```
┌──────────────────────────────────────────────────────┐
│  Dividend Income (1099-DIV)                          │
│                                                      │
│  ┌ 1099-DIV #1: Vanguard ────────────────── ✕ ┐     │
│  │  Payer name: [Vanguard     ]                │     │
│  │  Box 1a (Ordinary dividends):  [$800.00]    │     │
│  │  Box 1b (Qualified dividends): [$500.00]    │     │
│  │  Box 2a (Cap gain distrib.):   [$200.00]    │     │
│  │  Box 4 (Fed. tax withheld):    [$0.00  ]    │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  [+ Add 1099-DIV]                                    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Store actions**: `addForm1099DIV()`, `updateForm1099DIV()`, `removeForm1099DIV()`

#### 5i. Stock Sales Page — `src/ui/pages/StockSalesPage.tsx`

This is the most complex page. It integrates CSV import (Feature 4), wash sale detection (Feature 3), and manual transaction editing.

```
┌──────────────────────────────────────────────────────┐
│  Stock Sales & Capital Gains                         │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  📄 Upload broker CSV                        │    │
│  │  [Drop CSV file or click to browse]           │    │
│  │  Supported: Robinhood, Fidelity, Vanguard     │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  15 transactions loaded from Robinhood               │
│  ⚠ 1 wash sale detected (KO) — Review below         │
│                                                      │
│  Category A — Short-term, basis reported (5 trades)  │
│  ┌──────────────────────────────────────────────┐    │
│  │ Security │ Acquired │ Sold   │ Proceeds│G/L  │    │
│  │ AAPL     │ 01/15/25 │ 06/10  │ $6,500  │+$1.5│    │
│  │ MSFT     │ 02/01/25 │ 07/01  │ $2,500  │-$500│    │
│  │ ...      │          │        │         │     │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Category E — Long-term, basis NOT reported (3)      │
│  ┌──────────────────────────────────────────────┐    │
│  │ KO  │ 05/01/23 │ 08/10/25 │ $1,800 │ W:$0  │    │
│  │                    ⚠ Wash sale: $700 disall. │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Summary:                                            │
│  Short-term: +$2,200  Long-term: +$11,200            │
│  Net capital gain: $13,400                           │
│                                                      │
│  [+ Add transaction manually]                        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- Grouped by Form 8949 category (A, B, D, E)
- Wash sales highlighted with warning badge
- Summary shows net short-term and long-term gains
- Manual add uses `CapitalTransaction` fields

**Store action**: `setCapitalTransactions(txns)` after CSV parse + wash sale detection

#### 5j. RSU Income Page — `src/ui/pages/RSUIncomePage.tsx`

Only visible if the user has RSU vest events or W-2 Box 12 code V.

```
┌──────────────────────────────────────────────────────┐
│  RSU Vest Events                                     │
│                                                      │
│  ┌ Vest #1 ──────────────────────────────── ✕ ┐     │
│  │  Vest date: [2025-03-15]                    │     │
│  │  Symbol: [GOOG]     CUSIP: [38259P508]      │     │
│  │  Shares vested: [100]                       │     │
│  │  Shares withheld for tax: [35]              │     │
│  │  Shares delivered: [65]                     │     │
│  │  FMV at vest (per share): [$150.00]         │     │
│  │  Total FMV: $15,000.00 (computed)           │     │
│  │  Linked W-2: [Acme Corp W-2 ▼]             │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  [+ Add RSU vest event]                              │
│                                                      │
│  ℹ RSU income is already included in your W-2        │
│    Box 1 wages. The cost basis for your shares       │
│    equals the FMV at vest.                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Store actions**: `addRSUVestEvent()`, `removeRSUVestEvent()`

#### 5k. Deductions Page — `src/ui/pages/DeductionsPage.tsx`

```
┌──────────────────────────────────────────────────────┐
│  Deductions                                          │
│                                                      │
│  Choose your deduction method:                       │
│                                                      │
│  ┌──────────────────────┬───────────────────────┐    │
│  │  ● Standard          │  ○ Itemized           │    │
│  │     $15,000           │     $0 (enter below)  │    │
│  └──────────────────────┴───────────────────────┘    │
│                                                      │
│  (shown only if Itemized selected:)                  │
│                                                      │
│  Medical expenses:           [$5,000.00 ]            │
│    ℹ Only the amount above 7.5% of your AGI          │
│      ($X,XXX) is deductible.                         │
│                                                      │
│  State and local taxes:      [$8,000.00 ]            │
│    ℹ Capped at $40,000 (2025 SALT cap)               │
│                                                      │
│  Mortgage interest:          [$12,000.00]            │
│                                                      │
│  Charitable (cash):         [$3,000.00 ]             │
│  Charitable (non-cash):     [$500.00   ]             │
│                                                      │
│  Other deductions:           [$0.00    ]             │
│                                                      │
│  ──────────────────────────────────────              │
│  Total itemized: $XX,XXX                             │
│  Standard deduction: $15,000                         │
│  ✓ Standard is better by $X,XXX (or vice versa)     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Key logic:**
- Shows the standard deduction amount from `STANDARD_DEDUCTION[filingStatus]` (in `src/rules/2025/constants.ts`)
- Comparison: computes itemized total on-the-fly and shows which is higher
- SALT cap info: shows $40,000 cap for 2025 per `SALT_BASE_CAP`
- Medical floor: shows 7.5% of AGI per `MEDICAL_AGI_FLOOR_RATE`

**Store actions**: `setDeductionMethod()`, `setItemizedDeductions()`

#### 5l. Review Page — `src/ui/pages/ReviewPage.tsx`

Full summary of the return with edit links.

```
┌──────────────────────────────────────────────────────┐
│  Review Your Return                                  │
│                                                      │
│  Filing Status: Single                   [Edit]      │
│  Taxpayer: John Doe (***-**-1234)        [Edit]      │
│                                                      │
│  ── Income ──────────────────────────────────────    │
│  Line 1a  Wages                 $60,000.00   [?]     │
│  Line 2b  Taxable interest      $1,200.00    [?]     │
│  Line 3b  Ordinary dividends    $800.00      [?]     │
│  Line 7   Capital gain/loss     $13,400.00   [?]     │
│  Line 9   Total income          $75,400.00   [?]     │
│                                                      │
│  ── Deductions ──────────────────────────────────    │
│  Line 12  Standard deduction    $15,000.00   [?]     │
│  Line 15  Taxable income        $60,400.00   [?]     │
│                                                      │
│  ── Tax & Payments ──────────────────────────────    │
│  Line 16  Tax                   $8,114.00    [?]     │
│  Line 24  Total tax             $8,114.00    [?]     │
│  Line 25  Withheld              $6,000.00    [?]     │
│  Line 33  Total payments        $6,000.00    [?]     │
│                                                      │
│  ── Result ──────────────────────────────────────    │
│  Line 37  Amount you owe        $2,114.00    [?]     │
│                                                      │
│  [?] = "Why this number?" link → /explain/{nodeId}   │
│  [Edit] = navigate back to relevant interview step   │
│                                                      │
│  Schedules included: B, D, Form 8949                 │
│                                                      │
│              ← Back to Deductions    Continue →      │
└──────────────────────────────────────────────────────┘
```

**Data source**: Reads all `form1040.line*` values from `computeResult`.

Each `[?]` icon links to `/explain/form1040.line{N}` using the node IDs defined in `NODE_LABELS` (from `src/rules/engine.ts`).

#### 5m. Download Page — `src/ui/pages/DownloadPage.tsx`

```
┌──────────────────────────────────────────────────────┐
│  Download Your Return                                │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │                                             │     │
│  │  Return Summary                             │     │
│  │  ─────────────────────                      │     │
│  │  Tax Year:        2025                      │     │
│  │  Filing Status:   Single                    │     │
│  │  Name:            John Doe                  │     │
│  │  AGI:             $75,400.00                │     │
│  │  Total Tax:       $8,114.00                 │     │
│  │  Total Payments:  $6,000.00                 │     │
│  │  Amount Owed:     $2,114.00                 │     │
│  │                                             │     │
│  │  Forms: 1040, Schedule B, Schedule D,       │     │
│  │         Form 8949                           │     │
│  │                                             │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Download PDF ↓   │  │  Export JSON ↓   │          │
│  └──────────────────┘  └──────────────────┘          │
│                                                      │
│  ℹ This PDF is for review only. E-file via           │
│    IRS Free File or print and mail.                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**PDF generation flow:**

```ts
async function handleDownloadPDF() {
  setGenerating(true)
  try {
    // Load PDF templates (stored in /public/forms/)
    const templates: FormTemplates = {
      f1040: await loadTemplate('forms/f1040.pdf'),
      f1040sa: await loadTemplate('forms/f1040sa.pdf'),
      f1040sb: await loadTemplate('forms/f1040sb.pdf'),
      f1040sd: await loadTemplate('forms/f1040sd.pdf'),
      f8949: await loadTemplate('forms/f8949.pdf'),
    }

    const compiled = await compileFilingPackage(taxReturn, templates)

    // Trigger browser download
    const blob = new Blob([compiled.pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `OpenTax-2025-${taxReturn.taxpayer.lastName}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    setGenerating(false)
  }
}
```

Uses existing `compileFilingPackage()` from `src/forms/compiler.ts`. The `ReturnSummary` returned provides all summary fields.

**JSON export:**

```ts
function handleExportJSON() {
  const json = JSON.stringify(taxReturn, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  // ... same download pattern
}
```

---

## 6. Feature 2: Document Upload with OCR

### Overview

Tesseract.js runs entirely in the browser using WASM workers. No data leaves the device. The OCR pipeline extracts text from W-2, 1099-INT, and 1099-DIV images and maps recognized text to the correct form fields.

### Pipeline

```
   User drops image file
         │
         ▼
  ┌─────────────────┐
  │  File validation │  Accept: .jpg, .png, .pdf, .heic
  │  Max 10 MB       │  Convert HEIC → PNG if needed
  └────────┬────────┘
           │
           ▼  (if PDF)
  ┌─────────────────┐
  │ PDF → Image     │  Using pdf.js or canvas rendering
  │ (page 1 only)   │  Convert to PNG for Tesseract
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  Tesseract.js   │  createWorker('eng')
  │  OCR Engine     │  worker.recognize(image)
  └────────┬────────┘
           │  returns: { data: { words: Word[] } }
           │  each Word has: text, bbox, confidence
           ▼
  ┌─────────────────┐
  │ Form Detection  │  Identify document type by
  │                 │  scanning for "W-2", "1099-INT"
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Field Extraction│  Form-specific parser maps
  │ (Spatial)       │  labels → values using bbox
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Verification UI │  Side-by-side: image + extracted
  │                 │  fields with confidence badges
  └────────┬────────┘
           │  User confirms / corrects
           ▼
  ┌─────────────────┐
  │ Store Update    │  addW2(), addForm1099INT(), etc.
  └─────────────────┘
```

### OCR Initialization — `src/intake/ocr/ocrEngine.ts`

```ts
import { createWorker, Worker } from 'tesseract.js'

let worker: Worker | null = null

export async function getOCRWorker(): Promise<Worker> {
  if (!worker) {
    worker = await createWorker('eng', 1, {
      // WASM + trained data loaded from CDN on first use
      // Cached in browser after first load (~15 MB)
    })
  }
  return worker
}

export interface OCRResult {
  words: OCRWord[]
  confidence: number   // overall 0–100
  rawText: string
}

export interface OCRWord {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
  confidence: number   // 0–100 per word
}

export async function recognizeImage(image: File | Blob): Promise<OCRResult> {
  const w = await getOCRWorker()
  const { data } = await w.recognize(image)
  return {
    words: data.words.map(w => ({
      text: w.text,
      bbox: w.bbox,
      confidence: w.confidence,
    })),
    confidence: data.confidence,
    rawText: data.text,
  }
}
```

### Form Detection — `src/intake/ocr/formDetector.ts`

```ts
export type DetectedFormType = 'W-2' | '1099-INT' | '1099-DIV' | 'unknown'

export function detectFormType(ocrResult: OCRResult): DetectedFormType {
  const text = ocrResult.rawText.toUpperCase()

  // W-2 indicators
  if (text.includes('WAGE AND TAX STATEMENT') || text.includes('FORM W-2')) {
    return 'W-2'
  }

  // 1099-INT indicators
  if (text.includes('INTEREST INCOME') && text.includes('1099')) {
    return '1099-INT'
  }

  // 1099-DIV indicators
  if (text.includes('DIVIDENDS AND DISTRIBUTIONS') && text.includes('1099')) {
    return '1099-DIV'
  }

  return 'unknown'
}
```

### W-2 Parser — `src/intake/ocr/w2Parser.ts`

The W-2 has a standardized IRS layout. The parser uses spatial relationships between label text and value text to extract box values.

```ts
export interface W2ParseResult {
  fields: Map<string, ExtractedField>
  overallConfidence: number
}

export interface ExtractedField {
  value: string
  confidence: number  // 0–1 (normalized from Tesseract's 0–100)
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

// Known W-2 box labels and their spatial relationships
const W2_FIELD_PATTERNS: Record<string, RegExp[]> = {
  employerEin:   [/employer.*identification/i, /ein/i],
  employerName:  [/employer.*name/i, /employer/i],
  box1:          [/wages.*tips.*other/i, /box\s*1\b/i],
  box2:          [/federal.*income.*tax.*withheld/i, /box\s*2\b/i],
  box3:          [/social.*security.*wages/i, /box\s*3\b/i],
  box4:          [/social.*security.*tax.*withheld/i, /box\s*4\b/i],
  box5:          [/medicare.*wages/i, /box\s*5\b/i],
  box6:          [/medicare.*tax.*withheld/i, /box\s*6\b/i],
  box15State:    [/state$/i, /employer.*state/i],
  box16:         [/state\s*wages/i, /box\s*16/i],
  box17:         [/state\s*income\s*tax/i, /box\s*17/i],
}

export function parseW2(ocrResult: OCRResult): W2ParseResult {
  const fields = new Map<string, ExtractedField>()

  for (const [fieldName, patterns] of Object.entries(W2_FIELD_PATTERNS)) {
    // 1. Find the label word(s) matching the pattern
    const labelWord = findLabelWord(ocrResult.words, patterns)
    if (!labelWord) continue

    // 2. Find the value: look for the nearest numeric/text word
    //    to the right of or below the label
    const valueWord = findValueNear(ocrResult.words, labelWord.bbox, fieldName)
    if (!valueWord) continue

    fields.set(fieldName, {
      value: valueWord.text,
      confidence: valueWord.confidence / 100,
      bbox: valueWord.bbox,
    })
  }

  const confidences = [...fields.values()].map(f => f.confidence)
  const overallConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0

  return { fields, overallConfidence }
}
```

**Spatial matching algorithm:**

1. For each known field label, scan all OCR words to find the label text
2. Once the label bbox is found, search for the value in predictable locations:
   - **Same row, to the right**: Most W-2 boxes have the value to the right of the label
   - **Below the label**: Some boxes (employer name) span the area below
3. Filter candidate values by type: monetary fields must match `/^\$?[\d,]+\.?\d*$/`
4. Pick the highest-confidence match within the expected spatial zone

### Confidence Thresholds and UI

| Confidence | Badge | Color | Behavior |
|---|---|---|---|
| >= 90% | "Auto-filled" | Green | Value auto-populated, editable |
| 70–89% | "Check this" | Yellow | Value shown but highlighted for review |
| < 70% | "Could not read" | Red | Field left blank, user must type |

### Verification UI — `src/ui/components/OCRVerification.tsx`

```
┌──────────────────────────────────────────────────────┐
│  Verify W-2 from OCR                                 │
│                                                      │
│  ┌──────────────┬──────────────────────────────┐     │
│  │              │                              │     │
│  │   Original   │   Extracted Fields           │     │
│  │   Image      │                              │     │
│  │              │  Employer: Acme Corp  ✓ 95%  │     │
│  │   [W-2 img   │  EIN: 12-3456789     ✓ 92%  │     │
│  │    with bbox  │  Box 1: $60,000.00   ✓ 98%  │     │
│  │    overlays]  │  Box 2: $6,000.00    ⚠ 78%  │     │
│  │              │  Box 3: $60,000.00   ✓ 94%  │     │
│  │              │  Box 5: ___________   ✕ 45%  │     │
│  │              │                              │     │
│  └──────────────┴──────────────────────────────┘     │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Confirm & Add    │  │  Discard          │          │
│  └──────────────────┘  └──────────────────┘          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- Left panel: the original uploaded image with bounding box overlays on detected fields (green/yellow/red borders matching confidence)
- Right panel: extracted field values, all editable, with confidence badges
- **Confirm & Add**: creates the W-2/1099 in the store using the (possibly corrected) values
- **Discard**: throws away the OCR result

### 1099-INT Parser — `src/intake/ocr/form1099IntParser.ts`

Same spatial approach, but simpler — fewer boxes:

```ts
const FORM_1099_INT_PATTERNS: Record<string, RegExp[]> = {
  payerName:  [/payer.*name/i, /name\s*of\s*payer/i],
  box1:       [/interest\s*income/i, /box\s*1\b/i],
  box2:       [/early\s*withdrawal/i, /box\s*2\b/i],
  box3:       [/savings\s*bond/i, /treasury/i, /box\s*3\b/i],
  box4:       [/federal.*tax.*withheld/i, /box\s*4\b/i],
  box8:       [/tax.*exempt/i, /box\s*8\b/i],
}
```

### 1099-DIV Parser — `src/intake/ocr/form1099DivParser.ts`

```ts
const FORM_1099_DIV_PATTERNS: Record<string, RegExp[]> = {
  payerName:  [/payer.*name/i, /name\s*of\s*payer/i],
  box1a:      [/total\s*ordinary\s*dividends/i, /box\s*1a/i],
  box1b:      [/qualified\s*dividends/i, /box\s*1b/i],
  box2a:      [/total\s*capital\s*gain/i, /box\s*2a/i],
  box4:       [/federal.*tax.*withheld/i, /box\s*4\b/i],
  box5:       [/section\s*199a/i, /box\s*5\b/i],
  box11:      [/exempt.*interest\s*dividends/i, /box\s*11/i],
}
```

---

## 7. Feature 3: Wash Sale Detection

### IRS Rule (IRC Section 1091)

A **wash sale** occurs when you sell a security at a loss and purchase a "substantially identical" security within 30 days before or after the sale (61-day window). The loss is **disallowed** and added to the cost basis of the replacement purchase.

### Algorithm — `src/rules/2025/washSale.ts`

```ts
import type { CapitalTransaction } from '../../model/types'

export interface WashSaleMatch {
  lossSaleId: string         // the sale that generated the loss
  replacementId: string      // the purchase that triggers the wash sale
  disallowedLoss: number     // cents — the amount of loss disallowed
  symbol: string
  lossSaleDate: string
  replacementDate: string
}

export interface WashSaleResult {
  matches: WashSaleMatch[]
  adjustedTransactions: CapitalTransaction[]  // with wash sale adjustments applied
}

export function detectWashSales(
  transactions: CapitalTransaction[]
): WashSaleResult {
  const matches: WashSaleMatch[] = []
  const adjusted = transactions.map(tx => ({ ...tx }))

  // Step 1: Find all loss sales not already flagged with code W
  const lossSales = adjusted.filter(tx =>
    tx.gainLoss < 0 && tx.adjustmentCode !== 'W'
  )

  for (const lossSale of lossSales) {
    // Step 2: Find substantially identical purchases within 61-day window
    const lossSaleDate = new Date(lossSale.dateSold)
    const windowStart = addDays(lossSaleDate, -30)
    const windowEnd = addDays(lossSaleDate, 30)

    const replacements = adjusted.filter(tx =>
      tx.id !== lossSale.id &&
      isSubstantiallyIdentical(lossSale, tx) &&
      tx.dateAcquired !== null &&
      isWithinWindow(new Date(tx.dateAcquired), windowStart, windowEnd)
    )

    if (replacements.length > 0) {
      // Use the earliest replacement
      const replacement = replacements.sort((a, b) =>
        a.dateAcquired!.localeCompare(b.dateAcquired!)
      )[0]

      const disallowedLoss = Math.abs(lossSale.gainLoss)

      matches.push({
        lossSaleId: lossSale.id,
        replacementId: replacement.id,
        disallowedLoss,
        symbol: lossSale.description,
        lossSaleDate: lossSale.dateSold,
        replacementDate: replacement.dateAcquired!,
      })

      // Step 3: Adjust the loss sale
      const txToAdjust = adjusted.find(tx => tx.id === lossSale.id)!
      txToAdjust.adjustmentCode = 'W'
      txToAdjust.washSaleLossDisallowed = disallowedLoss
      txToAdjust.adjustmentAmount = disallowedLoss
      txToAdjust.gainLoss = 0  // loss fully disallowed

      // Step 4: Add disallowed loss to replacement basis
      const repToAdjust = adjusted.find(tx => tx.id === replacement.id)!
      repToAdjust.adjustedBasis += disallowedLoss
      repToAdjust.gainLoss = repToAdjust.proceeds - repToAdjust.adjustedBasis
    }
  }

  return { matches, adjustedTransactions: adjusted }
}

function isSubstantiallyIdentical(
  sale: CapitalTransaction,
  candidate: CapitalTransaction
): boolean {
  // Match by CUSIP if available (most reliable)
  // Fall back to symbol/description match
  const saleDesc = sale.description.toUpperCase().trim()
  const candDesc = candidate.description.toUpperCase().trim()
  return saleDesc === candDesc
}

function isWithinWindow(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
```

### Integration Point

Wash sale detection runs **after** CSV import and **before** the transactions are committed to the store:

```
CSV file → BrokerParser.parse() → Form1099B[] → convert to CapitalTransaction[]
  → detectWashSales(transactions) → WashSaleResult
  → User reviews matches in UI → confirms/overrides
  → store.setCapitalTransactions(adjustedTransactions)
```

### Wash Sale Review UI — `src/ui/components/WashSaleReview.tsx`

```
┌──────────────────────────────────────────────────────┐
│  ⚠ Wash Sale Detected                               │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │  KO (Coca-Cola)                             │     │
│  │                                             │     │
│  │  Loss sale:     Sold 08/10/2025             │     │
│  │                 Proceeds: $1,800            │     │
│  │                 Basis: $2,500               │     │
│  │                 Loss: -$700                 │     │
│  │                                             │     │
│  │  Replacement:   Bought 08/25/2025           │     │
│  │                 (within 30 days)             │     │
│  │                                             │     │
│  │  Result: $700 loss disallowed (code W)      │     │
│  │          Added to replacement basis          │     │
│  │                                             │     │
│  │  [✓ Accept]        [✕ Override — keep loss]  │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **Accept**: keeps the wash sale adjustment (default)
- **Override**: removes the adjustment — user takes responsibility. The transaction keeps its original loss.

---

## 8. Feature 4: Multi-Broker CSV Import

### Existing Infrastructure

The Robinhood parser (`src/intake/csv/robinhood.ts`) already implements the `BrokerParser` interface from `src/intake/csv/types.ts`:

```ts
// Already exists:
export interface BrokerParser {
  readonly brokerName: string
  parse(csv: string): ParseResult
}

export interface ParseResult {
  transactions: Form1099B[]
  warnings: string[]
  errors: string[]
  rowCounts: { total: number; parsed: number; skipped: number }
}
```

### CSV Utilities (already exist)

From `src/intake/csv/utils.ts`: `parseCSV()`, `parseCurrency()`, `parseDate()`, `parseTerm()`.

### Fidelity Parser — `src/intake/csv/fidelity.ts`

```ts
const FIDELITY_COLUMN_PATTERNS: Record<string, RegExp> = {
  description:   /^(security\s*description|description|security)/i,
  cusip:         /^cusip/i,
  dateAcquired:  /^(date\s*acquired|acquired\s*date|open\s*date)/i,
  dateSold:      /^(date\s*sold|sold\s*date|close\s*date)/i,
  proceeds:      /^(proceeds|sales?\s*proceeds|gross\s*proceeds)/i,
  costBasis:     /^(cost\s*basis|cost|adjusted\s*cost\s*basis)/i,
  washSale:      /^(wash\s*sale|wash\s*sale\s*loss|loss\s*disallowed)/i,
  gainLoss:      /^(gain.*loss|realized\s*gain|short.*term.*gain|long.*term.*gain)/i,
  term:          /^(term|holding\s*period)/i,
  box:           /^(box|category|reporting\s*category)/i,
}
```

**Fidelity-specific handling:**
- Fidelity CSVs often have a header row with account number, then a blank line, then column headers
- Cost basis may say "N/A" or "Various" for non-covered securities
- Term column uses "Short" and "Long" (vs Robinhood's "Short Term" / "Long Term")
- Fidelity includes a summary row at the bottom ("TOTAL") that must be skipped

### Vanguard Parser — `src/intake/csv/vanguard.ts`

```ts
const VANGUARD_COLUMN_PATTERNS: Record<string, RegExp> = {
  description:   /^(investment\s*name|security|fund\s*name|description)/i,
  cusip:         /^cusip/i,
  dateAcquired:  /^(date\s*acquired|purchase\s*date|acquired)/i,
  dateSold:      /^(date\s*sold|sale\s*date|sold)/i,
  proceeds:      /^(proceeds|sales?\s*proceeds)/i,
  costBasis:     /^(cost\s*basis|cost|basis)/i,
  washSale:      /^(wash\s*sale|disallowed\s*loss)/i,
  gainLoss:      /^(gain.*loss|net\s*gain)/i,
  term:          /^(term|st\/lt|short.*long)/i,
  box:           /^(box|category|code)/i,
}
```

**Vanguard-specific handling:**
- Vanguard CSVs may include mutual fund distributions in addition to sales
- "ST" / "LT" abbreviations for term
- May have multiple account sections within one CSV file (separated by account headers)
- Fund names use full names ("Vanguard Total Stock Market Index Fund") — truncate for `description`

### Auto-Detection — `src/intake/csv/autoDetect.ts`

```ts
import { RobinhoodParser } from './robinhood'
import { FidelityParser } from './fidelity'
import { VanguardParser } from './vanguard'
import type { BrokerParser, ParseResult } from './types'

const ALL_PARSERS: BrokerParser[] = [
  new RobinhoodParser(),
  new FidelityParser(),
  new VanguardParser(),
]

export interface DetectionResult {
  parser: BrokerParser
  confidence: 'high' | 'medium' | 'low'
  result: ParseResult
}

export function autoDetectBroker(csv: string): DetectionResult {
  // Strategy 1: Header inspection
  const firstLines = csv.split('\n').slice(0, 5).join('\n').toLowerCase()

  if (firstLines.includes('robinhood')) {
    return tryParser(new RobinhoodParser(), csv, 'high')
  }
  if (firstLines.includes('fidelity')) {
    return tryParser(new FidelityParser(), csv, 'high')
  }
  if (firstLines.includes('vanguard')) {
    return tryParser(new VanguardParser(), csv, 'high')
  }

  // Strategy 2: Trial parsing — try all parsers, pick the one with
  // the most successful rows and fewest errors
  const results = ALL_PARSERS.map(parser => tryParser(parser, csv, 'medium'))
  const best = results
    .filter(r => r.result.errors.length === 0)
    .sort((a, b) => b.result.rowCounts.parsed - a.result.rowCounts.parsed)

  if (best.length > 0) {
    return { ...best[0], confidence: 'medium' }
  }

  // Fallback: try Robinhood (most generic column patterns)
  return tryParser(new RobinhoodParser(), csv, 'low')
}

function tryParser(
  parser: BrokerParser,
  csv: string,
  confidence: 'high' | 'medium' | 'low'
): DetectionResult {
  try {
    const result = parser.parse(csv)
    return { parser, confidence, result }
  } catch {
    return {
      parser,
      confidence: 'low',
      result: { transactions: [], warnings: [], errors: ['Parse failed'], rowCounts: { total: 0, parsed: 0, skipped: 0 } },
    }
  }
}
```

### CSV Upload Component — `src/ui/components/CSVUpload.tsx`

```
┌──────────────────────────────────────────────────────┐
│  Import Broker CSV                                   │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │                                              │    │
│  │     Drag and drop your CSV file here         │    │
│  │                                              │    │
│  │     or [click to browse]                     │    │
│  │                                              │    │
│  │     Supported: Robinhood, Fidelity, Vanguard │    │
│  │                                              │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  (After upload:)                                     │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  ✓ Detected: Robinhood (high confidence)     │    │
│  │                                              │    │
│  │  Transactions:  15 parsed, 2 skipped          │    │
│  │  Short-term:    7 trades (+$2,200 net)        │    │
│  │  Long-term:     8 trades (+$11,200 net)       │    │
│  │                                              │    │
│  │  ⚠ Warnings:                                 │    │
│  │    • Row 8: No cost basis reported            │    │
│  │    • Row 14: Wash sale loss of $700           │    │
│  │                                              │    │
│  │  [Import All]    [Review Transactions]        │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Flow after upload:**

1. Read file as text
2. Call `autoDetectBroker(csv)` → `DetectionResult`
3. Show broker badge + transaction summary
4. Convert `Form1099B[]` → `CapitalTransaction[]` (map fields)
5. Run `detectWashSales(transactions)` if any losses exist
6. If wash sales found, show `WashSaleReview` component
7. On confirm: `store.setCapitalTransactions(adjustedTransactions)`

### Form1099B to CapitalTransaction Conversion

```ts
export function convertToCapitalTransactions(
  form1099Bs: Form1099B[]
): CapitalTransaction[] {
  return form1099Bs.map((b, i) => {
    const category = getCategory(b)
    return {
      id: `csv-${i}`,
      description: b.description,
      dateAcquired: b.dateAcquired,
      dateSold: b.dateSold,
      proceeds: b.proceeds,
      reportedBasis: b.costBasis ?? 0,
      adjustedBasis: b.costBasis ?? 0,
      adjustmentCode: b.costBasis === null ? 'B' : null,
      adjustmentAmount: 0,
      gainLoss: b.gainLoss,
      washSaleLossDisallowed: b.washSaleLossDisallowed,
      longTerm: b.longTerm ?? false,
      category,
      source1099BId: b.id,
    }
  })
}

function getCategory(b: Form1099B): Form8949Category {
  const basisReported = b.basisReportedToIrs && !b.noncoveredSecurity
  if (b.longTerm) return basisReported ? 'D' : 'E'
  return basisReported ? 'A' : 'B'
}
```

---

## 9. Feature 5: Interactive Explainability Graph

### Overview

The explainability graph lets users trace any computed value back to its source documents. It renders the `ComputeTrace` tree (from `buildTrace()` in `src/rules/engine.ts`) as an interactive SVG tree.

### Route: `/explain/:nodeId`

Examples:
- `/explain/form1040.line16` — "Why is my tax $8,114?"
- `/explain/form1040.line34` — "Why is my refund $4,265.50?"
- `/explain/scheduleD.line7` — "How was my net short-term gain calculated?"

### Data Source

```ts
// Already exists in src/rules/engine.ts:

export function buildTrace(result: ComputeResult, nodeId: string): ComputeTrace

export interface ComputeTrace {
  nodeId: string
  label: string
  output: TracedValue
  inputs: ComputeTrace[]     // child nodes (recursive)
  irsCitation?: string
}
```

### Tree Layout Algorithm — `src/ui/explain/useTraceLayout.ts`

The hook takes a `ComputeTrace` tree and computes SVG coordinates for each node.

```ts
export interface LayoutNode {
  id: string
  label: string
  amount: number              // cents
  sourceKind: 'computed' | 'document' | 'user-entry'
  irsCitation?: string
  x: number
  y: number
  width: number
  height: number
  children: LayoutNode[]
  collapsed: boolean
}

export interface LayoutEdge {
  fromId: string
  toId: string
  points: { x: number; y: number }[]
}

export function useTraceLayout(trace: ComputeTrace): {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  width: number
  height: number
  toggleCollapse: (nodeId: string) => void
} {
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set())

  // Layout algorithm: top-down tree
  // Root at top, children below, spread horizontally
  //
  // Constants:
  //   NODE_WIDTH = 260
  //   NODE_HEIGHT = 80
  //   HORIZONTAL_GAP = 40
  //   VERTICAL_GAP = 60
  //
  // 1. Assign depth (y) based on tree level
  // 2. Assign width (x) using a post-order traversal:
  //    - Leaf nodes: width = NODE_WIDTH
  //    - Internal nodes: width = sum of children widths + gaps
  //    - Center parent above its children
  // 3. Generate edges as straight lines from parent bottom-center
  //    to child top-center

  // ... implementation

  return { nodes, edges, width, height, toggleCollapse }
}
```

### TraceNode Component — `src/ui/explain/TraceNode.tsx`

```
┌─── Computed node (blue) ────────────────────────┐
│  Taxable income                                  │
│  $60,400.00                                      │
│  Form 1040, Line 15                              │
│  [▾ Collapse]                                    │
└──────────────────────────────────────────────────┘

┌─── Document node (green) ───────────────────────┐
│  W-2 from Acme Corp (Box 1)                     │
│  $60,000.00                                      │
│  Confidence: 100%                                │
└──────────────────────────────────────────────────┘

┌─── User-entry node (gray) ──────────────────────┐
│  Medical expenses                                │
│  $5,000.00                                       │
│  Entered by user                                 │
└──────────────────────────────────────────────────┘
```

**Node colors by `source.kind`:**

| Source kind | Background | Border | Icon |
|---|---|---|---|
| `computed` | `bg-blue-50` | `border-blue-400` | Calculator |
| `document` | `bg-green-50` | `border-green-400` | Document |
| `user-entry` | `bg-gray-50` | `border-gray-400` | Pencil |

### ExplainView Page — `src/ui/pages/ExplainView.tsx`

```tsx
export function ExplainView() {
  const { nodeId } = useParams<{ nodeId: string }>()
  const computeResult = useTaxStore(s => s.computeResult)

  const trace = buildTrace(computeResult, nodeId!)
  const { nodes, edges, width, height, toggleCollapse } = useTraceLayout(trace)

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">
        {NODE_LABELS[nodeId!] ?? nodeId}
      </h1>

      {/* Interactive SVG tree */}
      <div className="overflow-auto border rounded-lg bg-gray-50 p-4">
        <svg width={width} height={height}>
          {edges.map(edge => (
            <TraceEdge key={`${edge.fromId}-${edge.toId}`} edge={edge} />
          ))}
          {nodes.map(node => (
            <TraceNode
              key={node.id}
              node={node}
              onToggle={() => toggleCollapse(node.id)}
            />
          ))}
        </svg>
      </div>

      {/* Text fallback using existing explainLine() */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-gray-500">
          Show text trace
        </summary>
        <pre className="mt-2 bg-gray-100 p-4 rounded text-sm font-mono whitespace-pre-wrap">
          {explainLine(computeResult, nodeId!)}
        </pre>
      </details>
    </div>
  )
}
```

### Text Fallback

The existing `explainLine()` function (from `src/rules/engine.ts`) already generates a text-based tree:

```
Wages, salaries, tips: $60,000.00 [Form 1040, Line 1a]
  |- W-2 from Acme Corp (Box 1): $60,000.00
```

This serves as an accessible fallback below the graph. No new code needed — it's already implemented and tested.

### Entry Points

Users can reach the explainability graph from:

1. **LiveBalance** → "Why this number?" link
2. **Review page** → `[?]` icon next to each line item
3. **Direct URL** → `/explain/form1040.line16` (bookmarkable)

---

## 10. Persistence & Export

### IndexedDB Strategy

All state persists via Zustand's `persist` middleware using `idb-keyval` (see Section 3).

| Key | Value | Size estimate |
|---|---|---|
| `opentax-return` | Serialized `TaxReturn` | 5–50 KB typical |

### What Is Persisted

- Full `TaxReturn` object (all form data, transactions, deductions)
- SSN is stored (user's own device only, encrypted at rest by OS)

### What Is NOT Persisted

- `ComputeResult` — rebuilt on rehydration via `computeAll()`
- Uploaded images — discarded after OCR extraction
- Temporary OCR results

### JSON Export/Import

| Action | Description |
|---|---|
| **Export** | `JSON.stringify(taxReturn, null, 2)` → downloads `.json` file |
| **Import** | File picker → `JSON.parse()` → validate shape → `store.importReturn()` |

Shape validation on import:

```ts
function validateTaxReturn(obj: unknown): obj is TaxReturn {
  if (typeof obj !== 'object' || obj === null) return false
  const tr = obj as Record<string, unknown>
  return (
    typeof tr.taxYear === 'number' &&
    typeof tr.filingStatus === 'string' &&
    ['single', 'mfj', 'mfs', 'hoh', 'qw'].includes(tr.filingStatus as string) &&
    Array.isArray(tr.w2s) &&
    typeof tr.taxpayer === 'object'
  )
}
```

### SSN Handling

| Context | Handling |
|---|---|
| UI display | Masked: `•••-••-1234` (last 4 visible) |
| IndexedDB | Stored in full (user's device only) |
| JSON export | Included (user explicitly downloads) |
| PDF output | Full SSN in correct fields |
| Console/logs | Never logged |
| Network | Never transmitted (no server) |

---

## 11. Implementation Order

### Dependency Graph

```
P2.1 Tailwind + Zustand + Router
  │
  ▼
P2.2 Reusable form components (CurrencyInput, SSNInput, etc.)
  │
  ├──────────────────────────────┐
  ▼                              ▼
P2.3 Interview engine         P2.5 Multi-broker CSV ◄──┐
  + first 5 steps                (Fidelity, Vanguard)   │
  │                              │                      │
  ▼                              ▼                      │
P2.4 Income entry steps       P2.6 Wash sale detection  │
  (W-2, 1099-INT, 1099-DIV)     │                      │
  LiveBalance verifiable here    ▼                      │
  │                           P2.8 Document upload     │
  │                             with OCR (parallel) ───┘
  ▼
P2.7 RSU + Deductions + Review + Download
  │
  ▼
P2.9 Interactive explainability graph
```

### Step Details

| Step | Description | Files created | Depends on | Est. new tests |
|---|---|---|---|---|
| **P2.1** | Install Tailwind v4, Zustand v5, React Router v7. Configure Vite. Set up `AppShell`, `Sidebar`, base routes. | `src/store/taxStore.ts`, `src/ui/components/AppShell.tsx`, `src/ui/components/Sidebar.tsx`, `src/index.css` (theme), `vite.config.ts` (update) | — | 5 |
| **P2.2** | Build reusable form primitives: `CurrencyInput`, `SSNInput`, `DateInput`, `StateSelect`, `RepeatableSection`, `DocumentCard` | `src/ui/components/CurrencyInput.tsx`, `SSNInput.tsx`, `DateInput.tsx`, `StateSelect.tsx`, `RepeatableSection.tsx`, `DocumentCard.tsx` | P2.1 | 15 |
| **P2.3** | Interview engine (`steps.ts`, `useInterview.ts`) + Welcome, Filing Status, Personal Info, Spouse Info, Dependents pages | `src/interview/steps.ts`, `src/interview/useInterview.ts`, `src/ui/pages/WelcomePage.tsx`, `FilingStatusPage.tsx`, `PersonalInfoPage.tsx`, `SpouseInfoPage.tsx`, `DependentsPage.tsx` | P2.2 | 10 |
| **P2.4** | W-2 Income, Interest Income, Dividend Income pages. `LiveBalance` component. | `src/ui/pages/W2IncomePage.tsx`, `InterestIncomePage.tsx`, `DividendIncomePage.tsx`, `src/ui/components/LiveBalance.tsx` | P2.3 | 12 |
| **P2.5** | `FidelityParser`, `VanguardParser`, `autoDetect.ts`, `CSVUpload` component, `Form1099B` → `CapitalTransaction` converter | `src/intake/csv/fidelity.ts`, `vanguard.ts`, `autoDetect.ts`, `src/ui/components/CSVUpload.tsx`, conversion util | P2.2 | 20 |
| **P2.6** | Wash sale detection algorithm + review UI | `src/rules/2025/washSale.ts`, `src/ui/components/WashSaleReview.tsx` | P2.5 | 15 |
| **P2.7** | RSU page, Deductions page, Review page, Download page | `src/ui/pages/RSUIncomePage.tsx`, `DeductionsPage.tsx`, `ReviewPage.tsx`, `DownloadPage.tsx` | P2.4 | 10 |
| **P2.8** | Tesseract.js integration, OCR engine, 3 form parsers, verification UI. Can run in parallel with P2.5. | `src/intake/ocr/ocrEngine.ts`, `formDetector.ts`, `w2Parser.ts`, `form1099IntParser.ts`, `form1099DivParser.ts`, `src/ui/components/OCRVerification.tsx` | P2.2 | 20 |
| **P2.9** | Explainability graph page, `useTraceLayout` hook, `TraceNode`, `TraceEdge` SVG components | `src/ui/pages/ExplainView.tsx`, `src/ui/explain/useTraceLayout.ts`, `TraceNode.tsx`, `TraceEdge.tsx` | P2.4 | 8 |

### Parallelization Opportunities

- **P2.5 and P2.8** can run in parallel (both depend on P2.2, not on each other)
- **P2.9** only needs the store + `computeResult` — can start after P2.4

### Running Total

Phase 1: 623 tests
Phase 2 estimate: ~115 new tests
Target total: ~738 tests

---

## 12. Complete File Index

### New Files (~50)

```
src/
├── store/
│   └── taxStore.ts                    # Zustand store with persist
│
├── interview/
│   ├── steps.ts                       # Declarative step definitions
│   └── useInterview.ts                # Navigation hook
│
├── ui/
│   ├── components/
│   │   ├── AppShell.tsx               # Layout: sidebar + main + LiveBalance
│   │   ├── Sidebar.tsx                # Step list with progress
│   │   ├── LiveBalance.tsx            # Sticky refund/owed bar
│   │   ├── CurrencyInput.tsx          # Dollar input (stores cents)
│   │   ├── SSNInput.tsx               # Masked SSN input
│   │   ├── DateInput.tsx              # ISO date input
│   │   ├── StateSelect.tsx            # US state dropdown
│   │   ├── RepeatableSection.tsx      # Add/remove item list
│   │   ├── DocumentCard.tsx           # Document summary card
│   │   ├── CSVUpload.tsx              # Drag-and-drop CSV import
│   │   ├── WashSaleReview.tsx         # Wash sale match review
│   │   └── OCRVerification.tsx        # Side-by-side OCR verify
│   │
│   ├── pages/
│   │   ├── WelcomePage.tsx
│   │   ├── FilingStatusPage.tsx
│   │   ├── PersonalInfoPage.tsx
│   │   ├── SpouseInfoPage.tsx
│   │   ├── DependentsPage.tsx
│   │   ├── W2IncomePage.tsx
│   │   ├── InterestIncomePage.tsx
│   │   ├── DividendIncomePage.tsx
│   │   ├── StockSalesPage.tsx
│   │   ├── RSUIncomePage.tsx
│   │   ├── DeductionsPage.tsx
│   │   ├── ReviewPage.tsx
│   │   ├── DownloadPage.tsx
│   │   └── ExplainView.tsx
│   │
│   └── explain/
│       ├── useTraceLayout.ts          # Tree layout algorithm
│       ├── TraceNode.tsx              # SVG node component
│       └── TraceEdge.tsx              # SVG edge component
│
├── intake/
│   ├── csv/
│   │   ├── fidelity.ts               # Fidelity CSV parser
│   │   ├── vanguard.ts               # Vanguard CSV parser
│   │   ├── autoDetect.ts             # Broker auto-detection
│   │   └── convert.ts                # Form1099B → CapitalTransaction
│   │
│   └── ocr/
│       ├── ocrEngine.ts              # Tesseract.js wrapper
│       ├── formDetector.ts            # W-2 / 1099 type detection
│       ├── w2Parser.ts               # W-2 field extraction
│       ├── form1099IntParser.ts       # 1099-INT field extraction
│       └── form1099DivParser.ts       # 1099-DIV field extraction
│
└── rules/
    └── 2025/
        └── washSale.ts               # Wash sale detection algorithm

tests/
├── store/
│   └── taxStore.test.ts              # Store actions + recompute
│
├── interview/
│   ├── steps.test.ts                  # isVisible / isComplete logic
│   └── useInterview.test.ts           # Navigation hook
│
├── ui/
│   ├── components/
│   │   ├── CurrencyInput.test.tsx
│   │   ├── SSNInput.test.tsx
│   │   ├── LiveBalance.test.tsx
│   │   └── CSVUpload.test.tsx
│   │
│   └── explain/
│       └── useTraceLayout.test.ts     # Layout algorithm unit tests
│
├── intake/
│   ├── csv/
│   │   ├── fidelity.test.ts
│   │   ├── vanguard.test.ts
│   │   └── autoDetect.test.ts
│   │
│   └── ocr/
│       ├── w2Parser.test.ts
│       ├── form1099IntParser.test.ts
│       └── form1099DivParser.test.ts
│
├── rules/
│   └── washSale.test.ts               # Wash sale algorithm tests
│
└── scenarios/
    └── interviewFlow.test.ts           # Full interview integration test
```

### Modified Files

```
src/App.tsx                             # Add Router + AppShell
src/index.css                           # Add Tailwind theme
vite.config.ts                          # Add Tailwind plugin
package.json                            # Add new dependencies
```

---

## 13. Testing Strategy

### Test Categories

| Category | Tool | Coverage |
|---|---|---|
| **Component tests** | React Testing Library + Vitest | `CurrencyInput`, `SSNInput`, `LiveBalance`, `CSVUpload`, all page components |
| **Hook tests** | `renderHook()` from RTL | `useInterview`, `useTraceLayout` |
| **Parser unit tests** | Vitest | `FidelityParser`, `VanguardParser`, auto-detection, OCR parsers |
| **Algorithm tests** | Vitest | Wash sale detection, tree layout positions |
| **Store tests** | Vitest | All store actions trigger `computeAll()`, persist/rehydrate cycle |
| **Integration tests** | RTL | Full interview flow: Welcome → Filing Status → W-2 → Review → Download |

### Key Test Scenarios

**Store recompute:**
```ts
test('addW2 triggers recompute and updates tax', () => {
  const store = useTaxStore.getState()
  store.addW2(makeW2({ box1: cents(60000), box2: cents(6000) }))
  const result = useTaxStore.getState().computeResult
  expect(result.form1040.line1a.amount).toBe(cents(60000))
  expect(result.form1040.line25.amount).toBe(cents(6000))
})
```

**LiveBalance display:**
```ts
test('shows refund when overpaid', () => {
  // Setup: W-2 with box2 > computed tax
  render(<LiveBalance />)
  expect(screen.getByText(/Estimated Refund/)).toBeInTheDocument()
  expect(screen.getByText(/\$4,265\.50/)).toBeInTheDocument()
})
```

**CurrencyInput:**
```ts
test('converts dollar input to cents', async () => {
  const onChange = vi.fn()
  render(<CurrencyInput label="Wages" value={0} onChange={onChange} />)
  await userEvent.type(screen.getByRole('textbox'), '60000')
  await userEvent.tab() // trigger blur
  expect(onChange).toHaveBeenCalledWith(6000000) // $60,000 = 6,000,000 cents
})
```

**Wash sale detection:**
```ts
test('detects wash sale within 30-day window', () => {
  const transactions = [
    makeTx({ id: '1', description: 'AAPL', dateSold: '2025-06-15', gainLoss: cents(-500) }),
    makeTx({ id: '2', description: 'AAPL', dateAcquired: '2025-06-20', gainLoss: cents(300) }),
  ]
  const result = detectWashSales(transactions)
  expect(result.matches).toHaveLength(1)
  expect(result.matches[0].disallowedLoss).toBe(cents(500))
  expect(result.adjustedTransactions.find(t => t.id === '1')!.adjustmentCode).toBe('W')
})
```

**Fidelity parser:**
```ts
test('parses Fidelity CSV with summary rows', () => {
  const csv = `Account: Z12345678
Date,Description,...
01/15/2025,AAPL,...
TOTAL,...`
  const parser = new FidelityParser()
  const result = parser.parse(csv)
  expect(result.rowCounts.parsed).toBe(1)
  expect(result.rowCounts.skipped).toBe(1) // TOTAL row
})
```

**Interview flow integration:**
```ts
test('full flow: welcome → filing status → W-2 → review shows tax', async () => {
  render(<App />)

  // Welcome page
  await userEvent.click(screen.getByText("Let's Start"))

  // Filing status
  await userEvent.click(screen.getByLabelText('Single'))
  await userEvent.click(screen.getByText('Next'))

  // ... fill personal info, W-2 ...

  // Review page should show computed tax
  expect(screen.getByText(/Total tax/)).toBeInTheDocument()
})
```

### Existing Tests Must Pass

All 623 existing tests (rules engine, PDF compiler, Robinhood parser, integration scenarios) must continue to pass. Phase 2 adds ~115 new tests for a target of ~738 total.

The existing test command (`npm test` / `vitest run`) runs all tests including the new ones. No test configuration changes needed.

---

## Appendix: Existing API Reference

These functions and types already exist in the Phase 1 codebase. Phase 2 UI code calls them — no modifications needed.

### Rules Engine — `src/rules/engine.ts`

```ts
function computeAll(model: TaxReturn): ComputeResult
function buildTrace(result: ComputeResult, nodeId: string): ComputeTrace
function explainLine(result: ComputeResult, nodeId: string): string

interface ComputeResult {
  form1040: Form1040Result
  scheduleB: ScheduleBResult
  values: Map<string, TracedValue>
  executedSchedules: string[]
}

interface ComputeTrace {
  nodeId: string
  label: string
  output: TracedValue
  inputs: ComputeTrace[]
  irsCitation?: string
}
```

### Model — `src/model/types.ts`

```ts
function emptyTaxReturn(taxYear: number): TaxReturn

interface TaxReturn {
  taxYear: number
  filingStatus: FilingStatus
  taxpayer: Taxpayer
  spouse?: Taxpayer
  dependents: Dependent[]
  w2s: W2[]
  form1099Bs: Form1099B[]
  form1099INTs: Form1099INT[]
  form1099DIVs: Form1099DIV[]
  rsuVestEvents: RSUVestEvent[]
  capitalTransactions: CapitalTransaction[]
  adjustments: Adjustment[]
  deductions: { method: 'standard' | 'itemized'; itemized?: ItemizedDeductions }
  credits: Credit[]
}
```

### Traced Values — `src/model/traced.ts`

```ts
function cents(dollars: number): number
function dollars(amountInCents: number): number

interface TracedValue {
  amount: number          // integer cents
  source: ValueSource     // document | computed | user-entry
  confidence: number      // 0–1
  irsCitation?: string
}
```

### PDF Compiler — `src/forms/compiler.ts`

```ts
function compileFilingPackage(taxReturn: TaxReturn, templates: FormTemplates): Promise<CompiledForms>

interface CompiledForms {
  pdfBytes: Uint8Array
  formsIncluded: FormSummary[]
  summary: ReturnSummary
}

interface ReturnSummary {
  taxYear: number
  filingStatus: string
  taxpayerName: string
  agi: number
  totalTax: number
  totalPayments: number
  refund: number
  amountOwed: number
}
```

### Broker CSV — `src/intake/csv/types.ts`

```ts
interface BrokerParser {
  readonly brokerName: string
  parse(csv: string): ParseResult
}

interface ParseResult {
  transactions: Form1099B[]
  warnings: string[]
  errors: string[]
  rowCounts: { total: number; parsed: number; skipped: number }
}
```

### Constants — `src/rules/2025/constants.ts`

```ts
const STANDARD_DEDUCTION: Record<FilingStatus, number>  // single=1500000, mfj=3000000
const SALT_BASE_CAP: Record<FilingStatus, number>       // $40,000 for 2025
const MEDICAL_AGI_FLOOR_RATE = 0.075                    // 7.5%
const SCHEDULE_B_THRESHOLD = 150000                     // $1,500
const CAPITAL_LOSS_LIMIT: Record<FilingStatus, number>  // $3,000
```
