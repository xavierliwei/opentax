# Federal Gap Closure Phase 4, Track A — K-1 Income Computation

## Overview

Phase 4 Track A implements practical K-1 income computation for common passthrough
entity cases (partnerships, S-corps, trusts/estates). K-1 income was previously
captured in the data model but produced an error-level validation warning because
computation was not yet implemented.

## What Changed

### New Module: `src/rules/2025/scheduleK1.ts`

Aggregates K-1 income by type for routing into the Form 1040 flow:

| K-1 Field | IRS Routing | Form 1040 Line |
|---|---|---|
| Box 1 — Ordinary income | Schedule E Part II → Schedule 1 | Line 5 → Line 8 |
| Box 2 — Rental income | Schedule E Part II → Schedule 1 | Line 5 → Line 8 |
| Box 5 — Interest income | Schedule B → Form 1040 | Line 2b |
| Box 6a — Dividends | Schedule B → Form 1040 | Line 3b |
| Box 8 — ST capital gains | Schedule D, Line 5 | Line 7 |
| Box 9a — LT capital gains | Schedule D, Line 12 | Line 7 |
| Box 20 Code Z — QBI | Form 8995 | Line 13 (already implemented) |

### Modified Files

| File | Change |
|---|---|
| `src/rules/2025/form1040.ts` | `computeLine2b()` and `computeLine3b()` accept K-1 additions; orchestrator wires K-1 through entire flow; NIIT includes K-1 investment income; `K1AggregateResult` added to `Form1040Result` |
| `src/rules/2025/scheduleD.ts` | Added Line 5 (K-1 ST gains) and Line 12 (K-1 LT gains) to Schedule D computation |
| `src/rules/2025/schedule1.ts` | Line 5 now includes K-1 passthrough income (ordinary + rental) alongside Schedule E Part I |
| `src/rules/2025/federalValidation.ts` | Replaced `K1_INCOME_NOT_COMPUTED` error with `K1_INCOME_COMPUTED` info; added warnings for qualified dividends, rental losses, partnership SE, and unsupported boxes |
| `src/rules/engine.ts` | Added `scheduleD.line5` and `scheduleD.line12` to node labels and trace graph |
| `src/forms/fillers/scheduleDFiller.ts` | Fills K-1 capital gain lines on Schedule D PDF |

### New Tests: `tests/rules/k1Income.test.ts`

39 tests covering:
- **Unit tests**: K-1 aggregate computation (single, multiple, negative, empty, mixed)
- **Integration tests**: K-1 → Line 2b (interest), Line 3b (dividends), Schedule D (ST/LT gains), Schedule 1 Line 5 (ordinary/rental), combined with Form 8949, Schedule E, Schedule C
- **Full flow**: S-Corp owner exact computation, partnership with all income types
- **NIIT**: K-1 investment income in NIIT computation
- **Validation**: All 5 new validation codes tested, negative cases verified
- **Backward compatibility**: No K-1 produces identical results; existing 1099/Schedule D unchanged
- **Edge cases**: QBI-only K-1, large losses, MFJ with separate entities

## Assumptions and Limitations

### Conservative Choices

1. **K-1 dividends treated as ordinary (non-qualified)**: The data model does not capture the qualified/ordinary dividend breakdown from K-1 Box 6b. All K-1 dividends flow to Line 3b only, not Line 3a. This may slightly overstate tax if some dividends are qualified. A `K1_DIVIDENDS_NOT_QUALIFIED` warning is emitted.

2. **No passive activity loss (PAL) limitations for K-1 rental income**: K-1 rental losses flow directly to Schedule 1 without applying IRC §469 limitations. Proper PAL requires basis tracking and at-risk analysis not yet modeled. A `K1_RENTAL_LOSS_NO_PAL` warning is emitted when rental losses exist.

3. **No self-employment tax on partnership K-1 ordinary income**: Partnership Box 14 (SE income) is not yet modeled. A `K1_PARTNERSHIP_SE_NOT_COMPUTED` warning is emitted for partnerships with positive ordinary income. S-corp ordinary income correctly does NOT trigger SE tax.

4. **Unsupported K-1 boxes**: Guaranteed payments (Box 4), royalties, foreign taxes (Box 16), AMT items (Box 17/18), tax-exempt income (Box 18/19), and other code-specific items are not computed. A `K1_UNSUPPORTED_BOXES` info item lists supported and unsupported fields.

### Design Decisions

- K-1 passthrough income routes through Schedule 1 Line 5 (the same line as Schedule E), which is the correct IRS routing for partnerships/S-corps/trusts
- K-1 capital gains are added to Schedule D on Lines 5 (ST) and 12 (LT), which are the IRS-designated lines for passthrough entity capital gains
- The `K1AggregateResult` is exposed on `Form1040Result` for UI display and debugging
- All existing tests (1529 pre-existing) pass unchanged except 3 tests updated for the new validation code names

## Verification

- TypeScript compiles cleanly (`tsc -b`)
- Vite production build succeeds
- All 1568 tests pass (39 new + 1529 existing)
- Backward compatible: returns without K-1 produce identical results

## IRS Citations

- Schedule K-1 (Form 1065) Instructions: Box-by-box routing
- Schedule K-1 (Form 1120-S) Instructions: Box-by-box routing
- Schedule D Instructions: Lines 5 and 12 for passthrough entities
- Schedule 1: Line 5 for rents, royalties, partnerships, S-corps, trusts
- IRC §199A: QBI deduction (already implemented, now with full income backing)
- IRC §1411: NIIT now includes K-1 investment income
- IRC §469: PAL limitations noted but not applied (conservative, with warning)
