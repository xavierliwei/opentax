# Partial-Year State Residency — Audit & Fix

**Date:** 2026-02-20
**Branch:** `feat/partial-state-residency-audit`
**Scope:** California (CA) partial-year residency; extensible framework for other states

---

## 1. Pre-Audit Findings

### 1.1 Data Model

| Area | Status | Detail |
|------|--------|--------|
| `StateReturnConfig.residencyType` | **Missing** | Field did not exist; all returns implicitly full-year |
| Move-in / move-out dates | **Missing** | No date fields on the config |
| `ResidencyType` union type | **Missing** | No type definition |

### 1.2 Rules Engine (CA Form 540)

| Area | Status | Detail |
|------|--------|--------|
| Apportionment ratio computation | **Missing** | No ratio logic; tax computed on 100% of income |
| Tax proration (540NR method) | **Missing** | No proration of bracket tax |
| Exemption credit proration | **Missing** | Credits applied at full value regardless |
| Mental health tax apportionment | **Missing** | 1% surcharge on full taxable income |
| Renter's credit eligibility | **Missing** | No half-year residency check |
| CA-source income tracking | **Missing** | No separate line item |

### 1.3 State Module (`ca/module.ts`)

| Area | Status | Detail |
|------|--------|--------|
| Config passthrough to `computeForm540` | **Missing** | Config not forwarded |
| Dynamic form label (540 vs 540NR) | **Missing** | Always "CA Form 540" |
| Review layout for part-year fields | **Missing** | No CA-Source Income line |

### 1.4 UI (StateReturnsPage)

| Area | Status | Detail |
|------|--------|--------|
| Residency type selector | **Missing** | No radio buttons; checkbox only |
| Part-year date inputs | **Missing** | No move-in/move-out fields |
| Date validation | **Missing** | N/A (no dates) |
| Nonresident option | **Missing** | N/A |

### 1.5 PDF Generation

| Area | Status | Detail |
|------|--------|--------|
| Dynamic form title (540 vs 540NR) | **Missing** | Always "Form 540" |
| Apportionment display | **Missing** | No ratio shown |
| Dynamic formId in filing package | **Missing** | Hardcoded |

### 1.6 Download / Review Pages

| Area | Status | Detail |
|------|--------|--------|
| Residency type display | **Missing** | Not shown |
| Part-year percentage | **Missing** | Not shown |
| Dynamic heading from `formLabel` | **Missing** | Hardcoded |

**Summary:** Partial-year residency was entirely unimplemented. The design docs explicitly marked Form 540NR as "out of scope."

---

## 2. Changes Made

### 2.1 Data Model (`src/model/types.ts`)

- Added `ResidencyType = 'full-year' | 'part-year' | 'nonresident'` union type
- Added `residencyType: ResidencyType` to `StateReturnConfig` (required field)
- Added optional `moveInDate?: string` and `moveOutDate?: string` (ISO 8601 format)
- Existing `rentPaid?: boolean` retained

### 2.2 State Engine Interface (`src/rules/stateEngine.ts`)

- Added `residencyType: ResidencyType` to `StateComputeResult`
- Added optional `apportionmentRatio?: number` to `StateComputeResult`
- Imported `ResidencyType` from model types

### 2.3 CA Form 540 Rules (`src/rules/2025/ca/form540.ts`)

**New: `computeApportionmentRatio(config, taxYear)`**
- Full-year → 1.0
- Part-year → `daysInCA / daysInYear` (inclusive, UTC-based)
- Nonresident → 0.0
- Handles leap years, clamps dates to tax year boundaries
- Parses ISO date strings manually to avoid timezone issues

**Updated: `computeForm540(model, form1040, config?)`**
- `config` parameter is optional for backward compatibility
- Tax proration: `fullYearTax × ratio` (FTB 540NR method)
- Exemption credits prorated by ratio
- Mental health tax computed on `apportionedTaxable` (taxableIncome × ratio)
- Renter's credit requires `ratio >= 0.5`
- New result fields: `residencyType`, `apportionmentRatio`, `caSourceIncome`

### 2.4 CA Module (`src/rules/2025/ca/module.ts`)

- `compute()` now passes `config` to `computeForm540()`
- `toStateResult()` returns dynamic `formLabel`: "CA Form 540" or "CA Form 540NR"
- Added traced values for `caSourceIncome` and `apportionmentRatio`
- Added "CA-Source Income" to review layout with `showWhen` guard for part-year

### 2.5 UI — StateReturnsPage (`src/ui/pages/StateReturnsPage.tsx`)

- Added `RESIDENCY_OPTIONS` array (full-year, part-year, nonresident)
- Radio button group for residency type when state is selected
- Nonresident option disabled with "(coming soon)" label
- Part-year date inputs (move-in, move-out) with:
  - `min="2025-01-01"` / `max="2025-12-31"` constraints
  - Helper text: "Leave blank if Jan 1" / "Leave blank if Dec 31"
  - Validation message when move-in > move-out
- Dates cleared when switching away from part-year
- Dynamic renter's credit tooltip for part-year

### 2.6 PDF Filler (`src/forms/fillers/form540Filler.ts`)

- Dynamic header: "California Form 540" vs "California Form 540NR — Part-Year/Nonresident"
- Subtitle includes apportionment percentage for part-year (e.g., "49.6% CA residency")
- Apportionment info line in income section
- Dynamic official form reference in footer
- `formId` in compiler output reflects actual form (540 vs 540NR)

### 2.7 Filing Package Compiler (`src/forms/compiler.ts`)

- Line 249: Changed `label: stateModule.formLabel` → `label: stateResult.formLabel`

### 2.8 Download Page (`src/ui/pages/DownloadPage.tsx`)

- Shows residency type and apportionment percentage for part-year state returns

### 2.9 State Review Page (`src/ui/pages/StateReviewPage.tsx`)

- Heading uses `stateResult.formLabel` (dynamic 540/540NR)
- Part-year subtitle shows residency percentage

---

## 3. Test Coverage

### 3.1 New Test File: `tests/rules/ca/partialResidency.test.ts` (25 tests)

**Apportionment Ratio (10 tests)**
- Full-year returns 1.0
- Nonresident returns 0.0
- Part-year moved out Jun 30 → 181/365
- Part-year moved in Jul 1 → 184/365
- Part-year entire year → 1.0
- Move-in only (Jul 1 to Dec 31) → 184/365
- Move-out only (Jan 1 to Jun 30) → 181/365
- No dates defaults to full year
- Dates outside tax year clamped
- Move-out before move-in → 0

**Part-Year Tax Computation (5 tests)**
- Tax is prorated by ratio
- CA AGI unchanged (federal AGI used for deduction comparison)
- CA-source income tracked
- Residency type correctly set on result
- Full-year backward compatibility

**Renter's Credit Part-Year (2 tests)**
- Eligible at 50%+ residency
- Ineligible below 50%

**Mental Health Tax Part-Year (2 tests)**
- Computed on apportioned taxable income
- Zero when apportioned income below threshold

**computeAll Integration (4 tests)**
- Part-year integrates through full pipeline
- Form label is "CA Form 540NR"
- Apportionment ratio present in state result
- Full-year backward compatibility

**Backward Compatibility (2 tests)**
- computeForm540 without config → full-year
- computeForm540 with full-year config → ratio 1.0

### 3.2 Extended: `tests/forms/stateCompiler.test.ts` (+3 tests)

- Part-year CA generates "CA Form 540NR" formId
- Filing package uses "CA Form 540NR" label
- Full-year CA retains "CA Form 540" label

### 3.3 Test Results

```
Test Files  118 passed | 1 failed (pre-existing)
Tests      1368 passed | 1 failed (pre-existing)
```

The single failing test (`tests/ui/pages/P27Pages.test.tsx` line 101) is pre-existing and unrelated to this change — confirmed by stashing all changes and re-running.

**Build:** TypeScript compiles clean. Vite production build succeeds.

---

## 4. Architecture Decisions

### 4.1 FTB 540NR Ratio Method

California's actual Form 540NR uses a "compute on total, then prorate" method:

1. Compute tax on **total** taxable income (as if full-year resident)
2. Multiply by `CA days / year days` apportionment ratio

This is simpler and more accurate than trying to source individual income items to CA, which would require employer-level allocation data that most taxpayers don't have readily available.

### 4.2 UTC Date Handling

All date arithmetic uses `Date.UTC()` to avoid timezone-dependent off-by-one errors. ISO date strings are parsed manually with `split('-')` rather than `new Date(string)` because the latter creates UTC midnight, while `new Date(year, month, day)` creates local midnight — mixing these causes incorrect day counts.

### 4.3 Backward Compatibility

The `config` parameter on `computeForm540()` is optional. When omitted, the function behaves identically to the pre-change version (full-year, ratio 1.0). No existing call sites were broken.

---

## 5. Remaining Limitations

| Item | Status | Notes |
|------|--------|-------|
| **Nonresident filing** | Stubbed (disabled in UI) | Returns ratio 0.0; needs CA-source income sourcing rules |
| **Income sourcing** | Not implemented | Part-year uses ratio-based proration, not item-level sourcing |
| **Schedule CA (540NR)** | Not distinct from Schedule CA (540) | Real 540NR has different adjustment columns |
| **Multi-state allocation** | Not implemented | No W-2 splitting across states |
| **Estimated tax payments** | Not state-aware | CA estimated payments not tracked separately |
| **SDI/VPDI** | Not implemented | State disability insurance not on W-2 import |
| **Other states** | Not implemented | Framework is extensible — add `StateRulesModule` + `StateFormCompiler` |
| **540NR PDF template** | Programmatic only | Uses pdf-lib generated page, not official FTB template |

### 5.1 Extensibility for Other States

The framework supports adding new states by implementing:
1. `StateRulesModule` in `src/rules/2025/<state>/module.ts` — computation
2. `StateFormCompiler` in `src/forms/fillers/<form>Filler.ts` — PDF generation
3. Register in `src/rules/stateRegistry.ts` and `src/forms/stateFormRegistry.ts`

Each state module receives the full `StateReturnConfig` including residency type and dates, so state-specific apportionment methods can be implemented independently.

---

## 6. Files Changed

| File | Type |
|------|------|
| `src/model/types.ts` | Modified |
| `src/rules/stateEngine.ts` | Modified |
| `src/rules/2025/ca/form540.ts` | Modified |
| `src/rules/2025/ca/module.ts` | Modified |
| `src/ui/pages/StateReturnsPage.tsx` | Modified |
| `src/forms/fillers/form540Filler.ts` | Modified |
| `src/forms/compiler.ts` | Modified |
| `src/ui/pages/DownloadPage.tsx` | Modified |
| `src/ui/pages/StateReviewPage.tsx` | Modified |
| `tests/rules/ca/partialResidency.test.ts` | **New** |
| `tests/forms/stateCompiler.test.ts` | Modified |
