# Federal Phase 5 Track A — Schedule C & SE PDF Export

## Overview

Added PDF export support for Schedule C (Profit or Loss From Business) and
Schedule SE (Self-Employment Tax). The compiler now emits these forms when
applicable and places them in the correct IRS attachment sequence order.

## What Changed

### New Files

| File | Purpose |
|------|---------|
| `scripts/generate-schedule-c-se-pdfs.ts` | Generates synthetic fillable PDF templates for Schedule C (2 pages, 41 text fields, 6 checkboxes) and Schedule SE (1 page, 11 text fields) |
| `public/forms/f1040sc.pdf` | Schedule C PDF template |
| `public/forms/f1040sse.pdf` | Schedule SE PDF template |
| `src/forms/mappings/scheduleCFields.ts` | Field name constants for Schedule C (header, business info, income, expenses, summary) |
| `src/forms/mappings/scheduleSEFields.ts` | Field name constants for Schedule SE Section A |
| `src/forms/fillers/scheduleCFiller.ts` | `fillScheduleC()` — fills one Schedule C per business |
| `src/forms/fillers/scheduleSEFiller.ts` | `fillScheduleSE()` — fills Schedule SE Section A |
| `tests/forms/scheduleCFiller.test.ts` | 8 tests for Schedule C field mapping |
| `tests/forms/scheduleSEFiller.test.ts` | 5 tests for Schedule SE field mapping |

### Modified Files

| File | Change |
|------|--------|
| `src/forms/types.ts` | Added `f1040sc` and `f1040sse` to `FormTemplates` interface |
| `src/forms/compiler.ts` | Added Schedule C/SE inclusion logic, correct sequence ordering, SE tax → Schedule 2 wiring |
| `src/forms/fillers/schedule2Filler.ts` | Added SE tax to Line 6 (Part II) when Schedule SE is present |
| `src/ui/pages/DownloadPage.tsx` | Loads `f1040sc.pdf` and `f1040sse.pdf` templates |
| `tests/fixtures/returns.ts` | Added `makeScheduleC` helper and 4 new fixture returns |
| `tests/forms/compiler.test.ts` | Added 6 new integration tests for C/SE packet inclusion |

## Packet Inclusion Logic

| Condition | Forms Emitted |
|-----------|---------------|
| `scheduleCResult` has businesses | Schedule C (one per business), Schedule 1 |
| `scheduleSEResult.totalSETax > 0` | Schedule SE, Schedule 2 (SE tax on Line 6) |
| Business has net loss | Schedule C only (no SE when SE tax = 0) |
| No businesses | Neither Schedule C nor SE |

## IRS Attachment Sequence Order

```
00  Form 1040
02  Schedule 1
05  Schedule 2
06  Schedule 3
07  Schedule A
08  Schedule B
09  Schedule C          ← NEW
12  Schedule D
12A Form 8949
13  Schedule E
17  Schedule SE         ← NEW
18  Form 8863
32  Form 8812
47  Form 6251
52  Form 8889
```

## Key Design Decisions

1. **IRS Line 3 vs rules engine line3**: The rules engine's `line3` computes
   gross profit (receipts − returns − COGS). IRS Form Line 3 is just
   receipts − returns. The filler computes IRS Line 3 from raw inputs and
   uses `result.line3.amount` for IRS Line 5 (gross profit).

2. **Multiple Schedule C support**: One PDF per business. When multiple
   businesses exist, form IDs are labeled (e.g., "Schedule C (Consulting Co)").

3. **Meals deduction**: 50% of meals expense shown on Line 24b, computed in
   the filler since the rules engine tracks the full amount.

4. **Schedule 2 integration**: SE tax flows from `ScheduleSEResult.totalSETax`
   to Schedule 2, Part II, Line 6. The `fillSchedule2` function accepts an
   optional `scheduleSEResult` parameter.

5. **Synthetic PDF templates**: Generated programmatically via pdf-lib since
   IRS PDFs are not redistributable. Field names follow IRS naming convention
   `topmostSubform[0].Page1[0].f1_NN[0]`.

## Test Coverage

- **scheduleCFiller.test.ts** (8 tests): header fields, business info, income
  lines with COGS, expense lines with 50% meals, net loss formatting, valid
  PDF output, page count, spouse SSN handling.

- **scheduleSEFiller.test.ts** (5 tests): header fields, SE tax line
  computation, W-2 wage base coordination, valid PDF output, page count.

- **compiler.test.ts** (6 new tests): profitable sole proprietor includes
  C/SE/Sch1/Sch2; net loss excludes SE; W-2 + side business; multiple
  businesses get separate Schedule Cs; attachment sequence order; no C/SE
  when no businesses.

## Verification

```
npm run build    → clean (0 errors)
vitest run       → 69/69 tests pass (6 test files)
```
