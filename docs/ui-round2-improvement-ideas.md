# UI Round 2 — Improvement Ideas (Prioritized)

_Generated: 2026-02-20_

## Priority 1: Build Blockers

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1 | **Missing `RSUBasisBanner.tsx` component** — `RSUIncomePage` and `StockSalesPage` import `RSUBasisBanner` / `RSUBasisSummary` from a file that doesn't exist. TypeScript build fails. | Build broken | Low |

## Priority 2: Test Failures (16 failing / 1252 total)

| # | Issue | Root Cause | Fix |
|---|-------|-----------|-----|
| 2 | **`DOMMatrix is not defined`** — 5 test suites crash on import of `pdfjs-dist` in jsdom/node environments (`InterviewPages`, `IncomePages`, `steps.test`, `ExplainView`, `P27Pages`). | `pdfjs-dist` references `DOMMatrix` at module load; jsdom doesn't provide it. | Add a vitest setup file that stubs `globalThis.DOMMatrix` (and `matchMedia`) before any imports run. |
| 3 | **`window.matchMedia is not a function`** — `useTraceLayout.test` and `ExplainView.test` crash because jsdom lacks `matchMedia`. | Module-level `window.matchMedia()` call in `useTraceLayout.ts`. | Polyfill `window.matchMedia` in the vitest UI setup file. |
| 4 | **`RepeatableSection` "disables add when maxItems" test fails** — test looks for `screen.getByText('+ Add')` but the component uses a `<Button>` with `<Plus icon> Add` (no `+` prefix). | UI text drift: the `+` was replaced by a Lucide `Plus` icon. | Update test to use `screen.getByRole('button', { name: /add/i })`. |
| 5 | **`audit-high-risk.test.ts` constant mismatches** — Standard deduction, CTC, AMT, and Saver's Credit thresholds in the audit test expect 2026 OBBBA values but the code uses current 2025 constants. | Test expectations are ahead of code (or vice versa). These are tax-constant disputes, not UI issues. | Out of scope for this UI pass — do not change tax constants. |

## Priority 3: UI Polish — State Step Naming

| # | Issue | Current Behavior | Proposed Fix |
|---|-------|-----------------|-------------|
| 6 | **Hardcoded `CA` in `StateReturnsPage`** — Tooltip text, description copy, and type-cast (`as 'CA'`) assume only California. When more states are added this will break or confuse. | `addStateReturn({ stateCode: code as 'CA', ... })`, `code === 'CA'` conditionals everywhere. | Use `SupportedStateCode` type generically; move per-state config (tooltip, description) into the state module registry so the page can render any state's info dynamically. |
| 7 | **Static "More states coming soon" message** — `StateReturnsPage` shows this only when `supportedStates.length === 1`. Fine for now but the wording is presentationally hardcoded. | Minor — informational only. | Keep for now, but make conditional message dynamic. |

## Priority 4: UI Polish — Download / Review Copy

| # | Issue | Current Behavior | Proposed Fix |
|---|-------|-----------------|-------------|
| 8 | **"Generate package first" disabled-state text is vague** — On the Download page, disabled per-state download buttons show "Generate package first" but don't explain *how*. | Users see a disabled button with unclear helper text. | Change to "Click 'Download All' above to generate" — links the action to the button they need. |
| 9 | **Download page e-file disclaimer could mention state mailing** — The blue info box mentions state mailing only conditionally. | Good, but could be slightly more prominent. | Minor copy tweak — acceptable as-is. |
| 10 | **Review page `[?]` links are small and hard to tap on mobile** — `w-6 h-6` on mobile is borderline for touch targets (Apple HIG recommends 44px). | Functional but small. | Future pass: increase to `w-8 h-8` minimum on mobile. Keep for now. |

## Priority 5: Code Quality / Maintainability

| # | Issue | Notes |
|---|-------|-------|
| 11 | **`StateReturnsPage` uses `STATE_NAMES` map** — Only has `CA: 'California'`. Should derive from registry. | Consolidate into `stateRegistry.ts`. |
| 12 | **Duplicated `formatCurrency` helpers** — Three slightly different implementations across `ReviewPage`, `DownloadPage`, `StateReviewPage`. | Future: extract to shared `lib/format.ts`. |
| 13 | **`FILING_STATUS_LABELS` duplicated** — Present in both `ReviewPage` and `DownloadPage`. | Future: extract to shared module. |

## What to Implement Now (This Pass)

1. Create `RSUBasisBanner.tsx` (build blocker)
2. Add vitest setup file with `DOMMatrix` and `matchMedia` stubs
3. Fix `FormComponents.test.tsx` button text assertion
4. Make `StateReturnsPage` labels dynamic (remove hardcoded CA assumptions)
5. Improve "Generate package first" copy on Download page

## What NOT to Change

- Tax calculation constants (audit-high-risk test failures are out of scope)
- Core tax engine behavior
- Form filler logic
