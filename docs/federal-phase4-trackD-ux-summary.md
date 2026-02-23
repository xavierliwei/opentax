# Federal Gap Closure Phase 4 — Track D: UX/Data-Entry Polish

**Date**: 2026-02-23
**Branch**: `feat/federal-phase4-ux-polish`

## Overview

Phase 4 Track D adds interview pages and UX improvements for federal capabilities introduced in Phase 3 (Schedule C/SE, K-1, 1095-A/PTC, QBI deduction). It also upgrades the Review page with validation alerts and improves guidance text for unsupported scenarios.

## Changes

### 1. New Interview Pages

#### Schedule C — Business Income (`ScheduleCPage.tsx`)
- Full data-entry form for sole proprietorship/single-member LLC businesses
- Business info: name, EIN, NAICS code, accounting method
- Gross income section: receipts, returns, cost of goods sold
- Collapsible expense section with all 19 Part II line items (Lines 8–27)
- Collapsible "Additional Features" section for unsupported-feature flags:
  - Inventory (Part III), home office (Form 8829), vehicle detail (Form 4562)
  - Each flag shows an amber warning when checked explaining the limitation
- Per-business summary: gross profit, total expenses, net profit/loss
- MFJ owner selector (taxpayer/spouse)
- Guidance: meals 50% deductibility, SE tax flow, QBI deduction eligibility

#### Schedule K-1 — Passthrough Income (`ScheduleK1Page.tsx`)
- Data capture for partnership/S-corp/trust K-1 forms
- Page-level amber warning that K-1 is not yet computed
- Per-card red warning explaining income does NOT flow to Form 1040
- Entity info: name, EIN, type selector (partnership/S-corp/trust-estate)
- Income boxes with entity-type-aware helper text (e.g., "Box 1 (Form 1065)")
- Section 199A QBI field (flows to QBI deduction even though income isn't computed)
- Distribution reference field (not used in computation)
- MFJ owner selector

#### Form 1095-A / PTC (`Form1095APage.tsx`)
- Data entry for Health Insurance Marketplace statements
- Policy info: marketplace name, recipient, policy number
- 12-month data grid with three columns per month:
  - Column A: Enrollment premium
  - Column B: SLCSP premium
  - Column C: Advance PTC
- "Copy Jan to all months" convenience button
- Responsive layout: desktop shows tabular grid, mobile stacks vertically
- Annual totals row when any data is entered
- Blue info box explaining how PTC reconciliation works

### 2. Store Actions

Added 9 new Zustand store actions in `taxStore.ts`:
- `addScheduleC`, `updateScheduleC`, `removeScheduleC`
- `addScheduleK1`, `updateScheduleK1`, `removeScheduleK1`
- `addForm1095A`, `updateForm1095A`, `removeForm1095A`

All actions trigger `recompute()` to keep the tax engine in sync.

### 3. Interview Flow Registration

New steps registered in `steps.ts`:
- `schedule-c` (section: income) — after ISO exercises
- `schedule-k1` (section: income) — after Schedule C
- `form-1095a` (section: deductions-credits) — before Deductions

### 4. Review Page Enhancements

Upgraded `ReviewPage.tsx` with:
- **Validation alerts**: errors (red) and warnings (amber) shown at the top of the review page; info notes collapsed in a `<details>` element at the bottom
- **Schedule summary cards**: contextual cards for Schedule C, K-1, and 1095-A when present, with Edit links back to the relevant interview page
- **New line items**: Line 8 (Other income), Line 13 (QBI deduction), Line 31 (Other refundable credits including PTC)
- **Improved tooltip text**: Updated explanations for Line 10 (now mentions SE tax deduction), Line 23 (now mentions SE tax and excess APTC), Line 33 (now mentions PTC)

### 5. Validation & Messaging Improvements

- Renamed `PHASE3_LIMITATIONS` validation code to `SUPPORTED_SCOPE` with updated, clearer messaging listing all supported and unsupported features
- Updated tests that referenced the old code name

### 6. Mobile Responsiveness

All new pages follow established mobile-first patterns:
- `max-w-xl mx-auto` content constraint
- `grid-cols-1 sm:grid-cols-2` (or `sm:grid-cols-3`) responsive grids
- Mobile-first touch targets via existing Button/InfoTooltip components
- 1095-A monthly grid: stacks vertically on mobile with inline labels, shows tabular layout on desktop

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `src/ui/pages/ScheduleCPage.tsx` | Schedule C interview page |
| `src/ui/pages/ScheduleK1Page.tsx` | Schedule K-1 interview page |
| `src/ui/pages/Form1095APage.tsx` | Form 1095-A / PTC interview page |
| `tests/ui/pages/Phase4Pages.test.tsx` | 43 tests for new pages, store, review, and steps |
| `docs/federal-phase4-trackD-ux-summary.md` | This summary |

### Modified Files
| File | Changes |
|------|---------|
| `src/store/taxStore.ts` | Added 3 type imports, 9 action signatures, 9 action implementations |
| `src/interview/steps.ts` | Added 3 imports, 3 interview step definitions |
| `src/ui/pages/ReviewPage.tsx` | Added validation alerts, schedule summary cards, new line items, info import |
| `src/rules/2025/federalValidation.ts` | Renamed PHASE3_LIMITATIONS to SUPPORTED_SCOPE with improved wording |
| `tests/ui/mobile-responsive.test.tsx` | Added 5 mobile responsiveness tests for Phase 4 pages |
| `tests/rules/federalValidation.test.ts` | Updated code reference PHASE3_LIMITATIONS → SUPPORTED_SCOPE |
| `tests/rules/selfEmploymentIntegration.test.ts` | Updated code reference PHASE3_LIMITATIONS → SUPPORTED_SCOPE |

## Test Results

- **Total tests**: 1577 passing across 73 test files
- **New tests added**: 48 (43 in Phase4Pages.test.tsx + 5 in mobile-responsive.test.tsx)
- **Regressions**: 0 (after updating 2 test references to renamed validation code)
- **Build**: Clean (`tsc -b && vite build` succeeds)

## Assumptions

1. Schedule C businesses reuse the existing `ScheduleC` data model from Phase 3 (types.ts lines 243–287)
2. K-1 income is intentionally NOT computed — the page and review surface clear warnings about this limitation
3. Form 1095-A data flows to the existing `computeRefundableCredits` → PTC computation from Phase 3
4. All monetary values remain in integer cents per the codebase convention
5. The "Copy Jan to all months" feature on the 1095-A page is a UX convenience — it overwrites all 12 months with January's values
6. Validation severity hierarchy: errors shown at top (red), warnings below (amber), infos collapsed at bottom (blue)
