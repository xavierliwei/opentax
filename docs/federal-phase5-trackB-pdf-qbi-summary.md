# Federal Phase 5 Track B: PDF Export for QBI Deduction (Form 8995 / 8995-A)

## Overview

Adds PDF export support for the QBI (Qualified Business Income) deduction, generating Form 8995 (simplified computation) and Form 8995-A (above-threshold computation) based on existing QBI rules engine output.

## What Was Added

### PDF Generators

Since official IRS PDF templates for Form 8995/8995-A are not available in the template library, both forms are generated programmatically using `pdf-lib` (same approach as the cover sheet generator).

**`src/forms/fillers/form8995Filler.ts`** — Form 8995 (Simplified Computation)
- Generates a single-page PDF for below-threshold taxpayers
- Lists up to 5 businesses with names, TINs, and per-business QBI
- Computes and displays Lines 1-7: Total QBI, 20% component, taxable income limitation, final deduction
- Used when taxable income <= $191,950 (single) / $383,900 (MFJ)

**`src/forms/fillers/form8995aFiller.ts`** — Form 8995-A (Above Threshold)
- Generates a multi-section PDF for above-threshold taxpayers
- Part I: Per-business QBI, 20% QBI, W-2/UBIA wage limitation, deductible QBI
- Part II: W-2 wage and UBIA limitation detail per business
- Part III: QBI deduction summary with loss netting and taxable income cap
- Annotations for SSTB excluded/phase-in businesses and loss businesses
- Warning banners for unsupported sub-paths (aggregation elections, etc.)

### Compiler Integration (`src/forms/compiler.ts`)

- **Inclusion logic**: Form 8995 included when `qbiResult.simplifiedPath === true`; Form 8995-A included when `qbiResult.simplifiedPath === false`
- Neither form is included when there is no QBI (e.g., simple W-2 returns)
- Forms are generated even when deduction is $0 (documents why the deduction was limited)
- Attachment sequence: Form 8995 = seq 55, Form 8995-A = seq 55A (after Form 8889 at seq 52)

### Test Fixtures (`tests/fixtures/returns.ts`)

New helpers and fixtures:
- `makeScheduleC()` — helper for creating Schedule C test data
- `makeScheduleK1()` — helper for creating K-1 test data
- `qbiSimplifiedReturn()` — Single filer, $80K wages + $50K Schedule C, below threshold
- `qbiK1SimplifiedReturn()` — Single filer with K-1 QBI, below threshold
- `qbiAboveThresholdReturn()` — MFJ, $350K wages + $150K Schedule C + $80K K-1, above threshold
- `qbiSSTBAboveThresholdReturn()` — Single, SSTB business fully above phase-in (excluded)

### Tests (`tests/forms/qbiPdf.test.ts`)

14 tests covering:

| Category | Tests | Description |
|---|---|---|
| Packet inclusion | 6 | No QBI = no form; below-threshold = 8995; above-threshold = 8995-A; SSTB = 8995-A; K-1 QBI = 8995; sequence order |
| Form 8995 PDF | 2 | Valid single-page PDF; correct deduction amounts |
| Form 8995-A PDF | 3 | Valid PDF for above-threshold; valid PDF for SSTB exclusion; per-business results with W-2/UBIA |
| Full pipeline | 3 | Combined PDF with 8995; combined PDF with 8995-A; Line 13 flow |

## Packet Inclusion Decision Tree

```
QBI result exists?
  No  --> No QBI form included
  Yes --> Is simplifiedPath true?
    Yes --> Form 8995 (seq 55)
    No  --> Form 8995-A (seq 55A)
```

## Unsupported Sub-Paths (Fallback Behavior)

| Sub-path | Behavior |
|---|---|
| Aggregation elections (multiple businesses as one) | Warning on form; each business computed individually |
| Patron reduction (cooperative patronage) | Not computed; note in warnings |
| No per-business data for above-threshold | Warning on form; deduction conservatively $0 |
| SSTB in phase-in range | Phase-in reduction applied conservatively; warning emitted |

## Verification

- `tsc --noEmit`: Clean (0 errors)
- `vitest run`: 1709 tests passing (76 files), including 14 new QBI PDF tests
- No changes to existing test expectations
