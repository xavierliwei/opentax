# State Return UI — Phase 1 Implementation Summary

> **Status**: Implemented
> **Date**: 2026-02-20
> **Design doc**: [docs/state-return-ui-design.md](state-return-ui-design.md)

## What Was Done

Phase 1 generalizes the existing CA-only state return code into a multi-state framework while preserving identical behavior for existing CA users and federal-only filers.

### Architecture Changes

**State engine abstraction** — Each state implements `StateRulesModule` (compute, traced values, node labels). The registry maps `SupportedStateCode` to modules. Adding a new state requires only a new module + registry entry.

**Data model migration** — `TaxReturn.stateReturns: StateReturnConfig[]` replaces the old `caResident` / `rentPaidInCA` booleans. Legacy IndexedDB data is migrated transparently on rehydration. Deprecated fields are kept for backward compatibility (removed in Phase 3).

**Engine produces `stateResults[]`** — `ComputeResult.stateResults` contains standardized `StateComputeResult` objects for all selected states. The `form540` field is still populated from `stateResults` for backward compatibility.

### UI Changes

**StateReturnsPage** replaces the CA checkbox previously embedded in FilingStatusPage. Users select states from a list of supported states with per-state follow-up options (e.g., CA renter's credit).

**Sidebar section headers** — Steps are grouped under Getting Started, Income, Deductions & Credits, Review, and Download. State review steps appear dynamically under Review when states are selected.

**LiveBalance generalized** — Shows federal-only layout when no states are selected, or a multi-pill layout (Federal + each state) when states are selected.

**ReviewPage** — The hardcoded CA banner link is replaced with dynamic links for each selected state.

**DownloadPage** — Shows a state summary card for each selected state (AGI, tax, withholding, refund/owed).

## New Files

| File | Purpose |
|------|---------|
| `src/rules/stateEngine.ts` | `StateRulesModule` and `StateComputeResult` interfaces |
| `src/rules/stateRegistry.ts` | State module registry, `getSupportedStates()`, `getAllStateNodeLabels()` |
| `src/rules/2025/ca/module.ts` | CA state module wrapping `computeForm540` into the framework |
| `src/ui/pages/StateReturnsPage.tsx` | State selection interview page |
| `tests/rules/stateEngine.test.ts` | State engine unit tests (10 tests) |

## Modified Files

| File | Change |
|------|--------|
| `src/model/types.ts` | Added `SupportedStateCode`, `StateReturnConfig`, `stateReturns[]`; deprecated `caResident`/`rentPaidInCA` |
| `src/model/serialize.ts` | Added `stateResults` to serialization |
| `src/rules/engine.ts` | Added `stateResults` to `ComputeResult`; `computeAll()` uses state registry; CA node labels/traced values delegated to module |
| `src/store/taxStore.ts` | Added `addStateReturn`, `removeStateReturn`, `updateStateReturn`; legacy migration in rehydration; `setCAResident`/`setRentPaidInCA` now delegate to new actions |
| `src/interview/steps.ts` | Added `section` field to `InterviewStep`; `StateReturnsPage` step; dynamic `stateReviewSteps()`; removed hardcoded `ca-review` |
| `src/ui/pages/FilingStatusPage.tsx` | Removed CA state return section (moved to StateReturnsPage) |
| `src/ui/components/Sidebar.tsx` | Renders section headers; accepts `section` on `SidebarStep` |
| `src/ui/components/AppShell.tsx` | Passes `section` from steps to Sidebar |
| `src/ui/components/LiveBalance.tsx` | Generalized from hardcoded CA to loop over `stateResults` |
| `src/ui/pages/ReviewPage.tsx` | Dynamic state return links instead of hardcoded CA |
| `src/ui/pages/DownloadPage.tsx` | State summary cards for each selected state |
| `src/ui/pages/CAReviewPage.tsx` | Updated fallback link to point to StateReturnsPage |
| `tests/interview/steps.test.ts` | Updated for new step count, section assignments, state visibility |
| `tests/ui/components/LiveBalance.test.tsx` | Updated for new layout; added dual-pill CA test |

## Test Results

- **Build**: Clean (`tsc -b && vite build` passes)
- **Tests**: 898 tests pass across 29 test files (including 10 new state engine tests)
- **Pre-existing failures**: `DOMMatrix` (pdfjs-dist in test env) and `better-sqlite3` version mismatch — not related to this change

## Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Existing CA user (IndexedDB has `caResident: true`) | Migrated to `stateReturns: [{stateCode: 'CA', ...}]` on rehydration |
| Existing federal-only user | `stateReturns: []` — no change in behavior |
| `computeResult.form540` consumers | Still populated from `stateResults` (removed in Phase 3) |
| `setCAResident()` / `setRentPaidInCA()` callers | Delegate to new state return actions |
| JSON import with old format | `emptyTaxReturn()` merge provides `stateReturns: []` default |

## Remaining TODOs (Phase 2+)

- **State PDF generation** — `StateFormCompiler` interface, CA Form 540 filler, `compileFilingPackage()` integration
- **Generic StateReviewPage** — Config-driven review layout replacing per-state components (currently CA still uses `CAReviewPage`)
- **Add second state (NY)** — Proves the framework works for multiple states
- **Remove deprecated fields** — `caResident`, `rentPaidInCA`, `form540` on `ComputeResult` (Phase 3)
- **State validation** — Gap analysis for missing state withholding, unmatched state income
- **W-2 state withholding banner** — Prompt users when W-2 has state data for an un-selected state
