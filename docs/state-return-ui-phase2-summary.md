# State Return UI — Phase 2 Implementation Summary

> **Status**: Implemented
> **Date**: 2026-02-20
> **Design doc**: [docs/state-return-ui-design.md](state-return-ui-design.md)
> **Phase 1 summary**: [docs/state-return-ui-implementation-summary.md](state-return-ui-implementation-summary.md)

## What Was Done

Phase 2 adds state PDF generation architecture, implements the CA Form 540 generation path, and upgrades the review UX to config-driven rendering that scales beyond CA.

### 1. State PDF Generation Architecture

**New `StateFormCompiler` interface** (`src/forms/stateCompiler.ts`) — Defines the contract for per-state form compilation: takes a `TaxReturn`, `StateComputeResult`, and optional PDF templates, returns a compiled PDF document with form summaries.

**State form compiler registry** (`src/forms/stateFormRegistry.ts`) — Maps `SupportedStateCode` to `StateFormCompiler` implementations. Adding a new state's PDF generation requires only a new compiler + registry entry.

**`compileFilingPackage()` integration** (`src/forms/compiler.ts`) — The main compiler now:
- Accepts optional `stateTemplates` parameter (backward compatible — existing callers don't need to change)
- Loops over `taxReturn.stateReturns[]`, looks up each state's compiler via the registry
- Computes state results, compiles state PDFs, assembles them after federal forms in the combined document
- Returns `statePackages[]` containing per-state PDF bytes for separate download

**Updated types** (`src/forms/types.ts`) — `CompiledForms` now includes `statePackages: StatePackage[]` where each `StatePackage` has `stateCode`, `label`, `pdfBytes`, and `forms`.

### 2. CA Form 540 PDF Generation

**Programmatic PDF generator** (`src/forms/fillers/form540Filler.ts`) — Generates a California Form 540 document using `pdf-lib`'s `PDFDocument.create()` (same approach as the cover sheet). Produces a clean, readable 1-page PDF with:
- Taxpayer information header
- Income section (Federal AGI → Schedule CA adjustments → CA AGI)
- Deductions section (standard vs itemized, CA taxable income)
- Tax section (bracket tax, mental health tax, exemption credits, renter's credit, tax after credits)
- Payments section (state withholding, total payments)
- Result section (refund or amount owed)

**Design decision**: Programmatic generation was chosen because the official FTB Form 540 fillable PDF is not bundled. The `StateFormCompiler` interface is designed to support template-based filling — when the official PDF is obtained, the filler can be upgraded without changing the framework.

### 3. Config-Driven State Review Rendering

**Review layout types** added to `StateRulesModule` (`src/rules/stateEngine.ts`):
- `StateReviewSection` — title + array of line items
- `StateReviewLineItem` — label, nodeId (for explainability), getValue function, tooltip, optional showWhen predicate
- `StateReviewResultLine` — refund/owed/zero result display

**CA review layout config** (`src/rules/2025/ca/module.ts`) — The CA module now exports `reviewLayout` and `reviewResultLines` that produce the identical visual output as the original `CAReviewPage`:
- Income section: Federal AGI, Schedule CA Additions (conditional), CA AGI
- Deductions section: CA Deduction, CA Taxable Income
- Tax & Credits section: CA Tax, Mental Health Tax (conditional), Exemption Credits (conditional), Renter's Credit (conditional), CA Tax After Credits
- Payments & Result section: CA State Withholding (conditional)
- Result lines: CA Refund, CA Amount You Owe, or zero balance

**Generic `StateReviewPage`** (`src/ui/pages/StateReviewPage.tsx`) — A single React component that renders any state's review page from its module's config. Extracts the state code from the URL path (`/interview/state-review-{CODE}`), looks up the module via the registry, and renders sections/items/results. Adding a new state's review page requires zero React code — just config in the module.

### 4. UI Changes

**Interview steps** (`src/interview/steps.ts`) — All state review steps now use `StateReviewPage` instead of the per-state component map. The `CAReviewPage` import and `STATE_REVIEW_COMPONENTS` map are removed.

**Download page** (`src/ui/pages/DownloadPage.tsx`) — Enhanced with:
- "Download All (Federal + State)" button label when states are selected
- Per-state separate download buttons (expandable section) available after PDF generation
- State mailing note in the info banner

**Cover sheet** (`src/forms/fillers/coverSheet.ts`) — Updated to detect state forms in the package, change title from "Federal Tax Return" to "Tax Return" when states are included, add state mailing note, and include "Mail state forms separately" in the checklist.

### 5. Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Federal-only return | `compileFilingPackage()` produces identical output — `statePackages` is empty |
| `compileFilingPackage(tr, templates)` (no state templates arg) | Works unchanged — third parameter is optional |
| `CAReviewPage` component | Still exists in codebase (deprecated, no longer imported) |
| `computeResult.form540` consumers | Still populated from `stateResults` (Phase 1 shim, removed in Phase 3) |
| State review via old path `/interview/state-review-CA` | Works — `StateReviewPage` extracts state code from URL |

## New Files

| File | Purpose |
|------|---------|
| `src/forms/stateCompiler.ts` | `StateFormCompiler` interface and `StateFormTemplates` type |
| `src/forms/stateFormRegistry.ts` | State form compiler registry |
| `src/forms/fillers/form540Filler.ts` | CA Form 540 programmatic PDF generator + compiler |
| `src/ui/pages/StateReviewPage.tsx` | Generic config-driven state review page |
| `public/forms/state/CA/.gitkeep` | Directory placeholder for future CA PDF templates |
| `tests/forms/stateCompiler.test.ts` | State form compilation tests (9 tests) |
| `tests/rules/stateReviewLayout.test.ts` | Review layout config tests (7 tests) |

## Modified Files

| File | Change |
|------|--------|
| `src/rules/stateEngine.ts` | Added `StateReviewSection`, `StateReviewLineItem`, `StateReviewResultLine` types; `reviewLayout` and `reviewResultLines` fields on `StateRulesModule` |
| `src/rules/2025/ca/module.ts` | Added `CA_REVIEW_LAYOUT` and `CA_REVIEW_RESULT_LINES` config; module now exports these |
| `src/forms/compiler.ts` | `compileFilingPackage()` accepts optional state templates, compiles state forms, returns `statePackages` |
| `src/forms/types.ts` | Added `StatePackage` type, `statePackages` field on `CompiledForms` |
| `src/forms/fillers/coverSheet.ts` | Detects state forms, updates title/mailing/checklist |
| `src/interview/steps.ts` | Uses `StateReviewPage` for all state review steps |
| `src/ui/pages/DownloadPage.tsx` | Separate state download, enhanced labels, mailing note |

## Test Results

- **Build**: Clean (`tsc -b && vite build` passes)
- **New tests**: 16 pass (9 state compiler + 7 review layout)
- **Existing tests**: 1155 pass, 69 fail (pre-existing: better-sqlite3 version mismatch in plugin tests, DOMMatrix in pdfjs-dist for interview/UI tests)
- **Total**: 1155 passing across 48 test files

### New Test Coverage

**`tests/forms/stateCompiler.test.ts`** (9 tests):
- CA compiler registered in registry
- Unknown state returns undefined
- CA Form 540 generates valid PDF (1 page)
- PDF bytes can be saved and reloaded
- Federal-only return has no state packages
- CA return includes CA Form 540 in combined PDF
- Combined PDF has more pages with CA selected
- State package PDF loadable independently
- State form sequence numbers sort after federal

**`tests/rules/stateReviewLayout.test.ts`** (7 tests):
- CA has expected review sections (Income, Deductions, Tax & Credits, Payments & Result)
- Result lines cover refund, owed, and zero cases
- Layout items produce correct values from real compute results
- Conditional items hide when values are zero
- Result lines correctly identify refund vs owed
- Each item has valid explainability nodeId
- Each item has complete tooltip (explanation, pubName, pubUrl)

## Known Gaps

1. **No official FTB Form 540 template** — The CA 540 filler generates programmatically. When the official fillable PDF is available, upgrade `form540Filler.ts` to template-based filling (same pattern as federal fillers). The `StateFormCompiler` interface supports both approaches.

2. **Schedule CA not generated as separate PDF** — The current CA filler produces a single Form 540 page. A separate Schedule CA PDF could be added for completeness (showing the detailed adjustments).

3. **`CAReviewPage` still in codebase** — The file is no longer imported but remains. Remove in Phase 3 cleanup.

4. **State mailing addresses not detailed** — The cover sheet shows a generic "mail state forms separately" note. Phase 3 could add per-state mailing addresses (FTB address for CA, DTF for NY, etc.).

5. **No state validation/gap analysis** — State-specific gaps (e.g., "CA selected but no W-2 with CA withholding") are not yet surfaced. Planned for Phase 3.

## Exact Next-Step TODOs for Phase 3

### Required (Core Framework)

- [ ] **Add NY state module** — `src/rules/2025/ny/` with constants, IT-201 computation, module registration, review layout. Proves the framework works for a second state.
- [ ] **NY Form IT-201 filler** — `src/forms/fillers/it201Filler.ts` + registry entry
- [ ] **Remove `form540` from `ComputeResult`** — All consumers now use `stateResults[]`. Remove the backward-compat shim.
- [ ] **Remove deprecated `caResident`/`rentPaidInCA` from `TaxReturn`** — Phase 1 kept them for migration. Store migration should handle all edge cases by now.
- [ ] **Remove `CAReviewPage`** — File is no longer used; delete it.
- [ ] **Remove `setCAResident`/`setRentPaidInCA` store actions** — Replaced by generic state return actions.

### Recommended (Quality)

- [ ] **Obtain FTB Form 540 fillable PDF** — Place in `public/forms/state/CA/f540.pdf` and upgrade filler to template-based
- [ ] **Schedule CA PDF filler** — Generate Schedule CA as a separate form in the CA package
- [ ] **State validation / gap analysis** — Detect missing state withholding, un-matched state income, surface in UI
- [ ] **Per-state mailing addresses on cover sheet** — FTB mailing address for CA, DTF for NY
- [ ] **W-2 state withholding banner** — Prompt users when W-2 has state data for an un-selected state

### Nice-to-Have (Phase 4+)

- [ ] **Additional states** — NJ, IL, PA, MA, VA, GA, NC, OH (priority by population)
- [ ] **Part-year resident support** — `residencyType` currently limited to `'full-year'`
- [ ] **State-specific interview pages** — Custom input pages injected by state modules
- [ ] **Multi-state income allocation** — Source income to specific states for part-year/nonresident
