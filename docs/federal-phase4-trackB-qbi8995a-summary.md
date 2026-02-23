# Federal Gap Closure Phase 4 Track B: Form 8995-A QBI Above-Threshold Path

## Overview

Implements the Form 8995-A above-threshold QBI deduction path (IRC &sect;199A) alongside the existing Form 8995 simplified path. Taxpayers with taxable income above the filing-status threshold ($191,950 single / $383,900 MFJ for 2025) now receive a computed QBI deduction subject to W-2 wage and UBIA limitations, rather than the previous conservative $0 fallback.

## What Changed

### Data Model (`src/model/types.ts`)

Added optional per-business QBI fields to support Form 8995-A:

- **ScheduleC**: `isSSTB?`, `qbiW2Wages?`, `qbiUBIA?`
- **ScheduleK1**: `isSSTB?`, `section199AW2Wages?`, `section199AUBIA?`

All new fields are optional and default to 0/false, preserving full backward compatibility.

### QBI Computation Engine (`src/rules/2025/qbiDeduction.ts`)

**New types:**
- `QBIBusinessInput` — per-business QBI data (id, name, qbi, w2Wages, ubia, isSSTB)
- `QBIBusinessResult` — per-business result with wage limitation, deductible amount, SSTB flags

**New exported helpers:**
- `computeWageLimitation(w2Wages, ubia)` — max(50% x W-2, 25% x W-2 + 2.5% x UBIA)
- `computePhaseInFactor(taxableIncome, filingStatus)` — fraction of phase-in range consumed (0 at threshold, 1 at threshold + $50K/$100K)

**Enhanced `computeQBIDeduction()`:**
- New optional 5th parameter: `businesses?: QBIBusinessInput[]`
- Below-threshold behavior is **unchanged** (Form 8995 simplified path)
- Above-threshold without businesses array returns conservative $0 (backward compat)
- Above-threshold with businesses array computes Form 8995-A:
  - Per-business W-2/UBIA wage limitation
  - Phase-in range partial limitation
  - SSTB phase-in reduction and fully-above exclusion
  - Loss pass-through and aggregation
  - Final cap at 20% of taxable income

**Result type additions:**
- `businessResults: QBIBusinessResult[] | null` — per-business detail (8995-A only)
- `hasSSTB: boolean` — any SSTB business detected
- `sstbWarning: boolean` — SSTB warning should be emitted

### Form 1040 Integration (`src/rules/2025/form1040.ts`)

The QBI computation call site now builds `QBIBusinessInput[]` from Schedule C businesses and K-1 forms, passing per-business W-2/UBIA/SSTB data into the enhanced `computeQBIDeduction()`. This enables the Form 8995-A path automatically when above-threshold taxpayers have business data.

### Validation (`src/rules/2025/federalValidation.ts`)

- Updated `QBI_DEDUCTION_COMPUTED` message to reflect both Form 8995 and 8995-A support
- Added `QBI_SSTB_WARNING` validation item when SSTB businesses are present

## Form 8995-A Computation Rules

### Threshold and Phase-In Range (2025)

| Filing Status | Threshold | Phase-Out Range | Fully Above |
|---|---|---|---|
| Single | $191,950 | $50,000 | $241,950 |
| MFJ | $383,900 | $100,000 | $483,900 |
| MFS | $191,950 | $50,000 | $241,950 |
| HOH | $191,950 | $50,000 | $241,950 |
| QW | $383,900 | $100,000 | $483,900 |

### W-2/UBIA Wage Limitation

Per business: `max(50% x W-2 wages, 25% x W-2 wages + 2.5% x UBIA)`

### Phase-In Logic (Non-SSTB)

```
phaseInFactor = (taxableIncome - threshold) / phaseOutRange   [clamped 0-1]

If in phase-in range (0 < factor < 1):
  excess = max(0, 20% x QBI - wageLimitation)
  deductible = 20% x QBI - phaseInFactor x excess

If fully above (factor = 1):
  deductible = min(20% x QBI, wageLimitation)
```

### SSTB Handling

- **Fully above threshold + phase-out range**: SSTB QBI = $0 (excluded)
- **In phase-in range**: QBI, W-2 wages, and UBIA all reduced by `(1 - phaseInFactor)`, then standard wage limitation applied
- **Below threshold**: No SSTB effect (simplified path)

### Assumptions and Limitations

1. **Section 163(j)** interest limitation is not applied (rare for individual filers)
2. **Patron reduction** (cooperatives, Form 8995-A Part III) is not supported
3. **QBI loss carryforward** from prior years is not tracked
4. **Rental real estate** QBI safe harbor (Rev. Proc. 2019-38) remains unsupported
5. SSTB classification must be entered by the user or from K-1 data; no automatic NAICS-based classification

## Test Coverage

**60 tests** in `tests/rules/qbiDeduction.test.ts`:

| Category | Tests | Description |
|---|---|---|
| `computeWageLimitation` | 6 | 50% W-2 vs 25%+2.5% UBIA, zero cases, rounding |
| `computePhaseInFactor` | 7 | At/below threshold, midpoint, top, above, $1 precision |
| Below-threshold simplified | 6 | Standard 20% computation, TI/QBI limiting, MFJ, boundary |
| Above-threshold backward compat | 3 | Conservative $0 without businesses array |
| Multiple QBI sources | 2 | Schedule C + K-1, netting losses |
| Edge cases | 6 | Negative QBI, zero TI, traced values |
| Fully above (non-SSTB) | 6 | W-2 limit, UBIA alternative, $0 W-2, TI cap, multi-biz |
| Phase-in range (non-SSTB) | 5 | Midpoint, $1 above, top, generous W-2, MFJ range |
| SSTB | 5 | Fully-above exclusion, phase-in reduction, mixed, $1 above, flags |
| Loss businesses | 2 | Loss pass-through, combined floor at $0 |
| Threshold boundary precision | 5 | Exactly at threshold, $1 above, $1 below top, MFJ top |
| TI cap | 1 | 20% TI still limits 8995-A result |
| Real-world scenarios | 3 | Consulting LLC, MFJ K-1+ScheduleC, sole proprietor |
| Backward compatibility | 3 | With/without businesses, conservative fallback |

All **1573 tests** pass across 72 test files. TypeScript compiles clean. Vite build succeeds.

## Files Modified

| File | Change |
|---|---|
| `src/model/types.ts` | Added `isSSTB`, `qbiW2Wages`, `qbiUBIA` to ScheduleC; `isSSTB`, `section199AW2Wages`, `section199AUBIA` to ScheduleK1 |
| `src/rules/2025/qbiDeduction.ts` | Rewrote with Form 8995-A support, new types, helper functions |
| `src/rules/2025/form1040.ts` | Build per-business QBI inputs, pass to enhanced computation |
| `src/rules/2025/federalValidation.ts` | Updated QBI validation message, added SSTB warning |
| `tests/rules/qbiDeduction.test.ts` | Expanded from 10 to 60 tests covering all 8995-A paths |
| `tests/rules/selfEmploymentIntegration.test.ts` | Updated above-threshold test to reflect new 8995-A computation |
| `docs/federal-phase4-trackB-qbi8995a-summary.md` | This summary |
