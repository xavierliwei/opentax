# UI Round 2 — Implementation Summary

_Completed: 2026-02-20_

## Overview

This pass focused on build fixes, test stability, dynamic state labels, and download-page UX copy. Core tax calculations were intentionally left unchanged.

## Results

| Metric | Before | After |
|--------|--------|-------|
| TypeScript build | **BROKEN** (missing `RSUBasisBanner.tsx`) | **CLEAN** |
| Vite production build | N/A (blocked by tsc) | **CLEAN** (1.6s) |
| Test files passing | 51 / 59 (8 failing) | **58 / 59** (1 failing) |
| Individual tests passing | 1236 / 1252 (16 failing) | **1316 / 1331** (15 failing) |
| UI test files failing | 5 | **0** |

The 15 remaining failures are in `tests/rules/audit-high-risk.test.ts` — tax constant mismatches (OBBBA 2026 values vs current 2025 code). These are tax-engine disputes, not UI issues, and were intentionally left untouched.

## Changed Files

### New Files
| File | Purpose |
|------|---------|
| `src/ui/components/RSUBasisBanner.tsx` | RSU basis adjustment banner + summary components (was imported but missing) |
| `tests/setup.ts` | Vitest global setup: `DOMMatrix` and `matchMedia` stubs for jsdom/node |
| `docs/ui-round2-improvement-ideas.md` | Prioritized issue list for this pass |
| `docs/ui-round2-implementation-summary.md` | This file |

### Modified Files
| File | What Changed |
|------|-------------|
| `vite.config.ts` | Added `setupFiles: ['tests/setup.ts']` to both `unit` and `ui` test projects |
| `src/rules/stateEngine.ts` | Added `stateName` field to `StateRulesModule` interface |
| `src/rules/stateRegistry.ts` | Exposed `stateName` from `getSupportedStates()` |
| `src/rules/2025/ca/module.ts` | Added `stateName: 'California'` to CA module |
| `src/ui/pages/StateReturnsPage.tsx` | Removed hardcoded `STATE_NAMES` map and `code === 'CA'` conditionals; now reads `stateName`/`label` from registry |
| `src/ui/pages/DownloadPage.tsx` | Changed disabled-state helper text from "Generate package first" to "Click 'Download All' above to generate" |
| `tests/ui/components/FormComponents.test.tsx` | Fixed `+ Add` → `getByRole('button', { name: /add/i })` |
| `tests/ui/pages/IncomePages.test.tsx` | Fixed `+ Add another W-2` / `Remove` / `Show Box 7-20` text matchers to use role queries and regex |
| `tests/ui/pages/InterviewPages.test.tsx` | Fixed `+ Add Dependent` text matcher to use role query |
| `tests/ui/pages/P27Pages.test.tsx` | Fixed RSU add/remove, SALT label, mortgage interest label, and download helper text assertions |

## What Was Fixed

### 1. Build Blocker — Missing RSUBasisBanner Component
`RSUIncomePage` and `StockSalesPage` imported `RSUBasisBanner`/`RSUBasisSummary` from a file that didn't exist. Created the component with two exports:
- `RSUBasisBanner` — full banner with per-lot adjustment detail (for StockSalesPage)
- `RSUBasisSummary` — compact preview (for RSUIncomePage)

### 2. Test Environment — DOMMatrix & matchMedia Stubs
Added `tests/setup.ts` with:
- `globalThis.DOMMatrix` stub — prevents `ReferenceError` when pdfjs-dist loads in node/jsdom
- `window.matchMedia` stub — prevents crash in `useTraceLayout.ts` module-level call

This fixed 5 test suites that crashed on import (`InterviewPages`, `IncomePages`, `ExplainView`, `useTraceLayout`, `steps.test`).

### 3. Test Text Drift — Button Text Assertions
The `RepeatableSection` component switched from `"+ Add"` text to a Lucide `Plus` icon + text. Similarly, "Remove" became an icon-only button with `aria-label`. Updated all affected tests to use `getByRole('button', { name: /pattern/i })` which is more resilient to icon/text changes.

### 4. State Step Labels — Dynamic Instead of Hardcoded CA
- Added `stateName` to `StateRulesModule` interface and CA module
- `StateReturnsPage` now reads labels from the registry instead of a hardcoded `STATE_NAMES` map
- Tooltip text, description copy, and "More states coming soon" message all derive from registry data
- The CA-specific renter's credit checkbox remains (it's genuinely CA-specific behavior)

### 5. Download Page — Disabled-Action Messaging
Changed "Generate package first" to "Click 'Download All' above to generate" so users know exactly what action enables the per-state download buttons.

## What Remains (Next Steps)

| Priority | Item | Notes |
|----------|------|-------|
| High | **Tax constant audit** (`audit-high-risk.test.ts`) | 15 tests expect OBBBA 2026 values; code has 2025 constants. Needs policy decision on which values to use. |
| Medium | **Extract shared helpers** | `formatCurrency`, `FILING_STATUS_LABELS` duplicated across Review/Download pages |
| Medium | **Touch target sizing** | Review page `[?]` links are 24px on mobile; should be 32px+ for touch |
| Low | **State-specific config in registry** | CA tooltip URLs, descriptions, and per-state follow-up options could move to a config object in each state module |
| Low | **Code splitting** | Vite warns about 1.5MB JS chunk; could lazy-load PDF/intake modules |
