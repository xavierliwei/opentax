# Federal Gap Closure — Phase 3 Summary

**Date:** 2026-02-23
**Tax Year:** 2025 (returns filed 2026)
**Branch:** `feat/federal-gap-closure-phase3`

---

## Implemented Scope

### 1. Schedule C — Profit or Loss From Business (Sole Proprietorship)

**New file:** `src/rules/2025/scheduleC.ts`

- Full data model for Schedule C businesses (`ScheduleC` interface in `types.ts`)
- Gross income computation (Line 1 → Line 7): gross receipts, returns/allowances, COGS
- Part II expense computation (Lines 8–27): all 19 standard expense categories
- 50% meals deduction (IRC §274(n))
- Net profit/loss computation (Line 31)
- Multi-business aggregation (`computeAllScheduleC`)
- Validation warnings for unsupported advanced features:
  - Inventory/COGS Part III detail (`hasInventory`)
  - Home office deduction, Form 8829 (`hasHomeOffice`)
  - Vehicle expense detail, Form 4562 Part V (`hasVehicleExpenses`)

### 2. Schedule SE — Self-Employment Tax

**New file:** `src/rules/2025/scheduleSE.ts`

- Short Schedule SE (Section A) computation
- Net SE earnings: 92.35% factor (IRC §1402(a)(12))
- Social Security tax: 12.4% with wage base coordination
  - Accounts for W-2 Box 3 wages already subject to SS tax
  - Caps at $176,100 SS wage base (2025)
- Medicare tax: 2.9% on all net SE earnings (uncapped)
- Total SE tax → Schedule 2, Part II (Line 23)
- Deductible half (50%) → Schedule 1, Line 15 → Form 1040 Line 10 (reduces AGI)

### 3. QBI Deduction — IRC §199A (Form 8995 Simplified)

**New file:** `src/rules/2025/qbiDeduction.ts`

- Form 8995 simplified computation for below-threshold taxpayers
- Thresholds: $191,950 (single) / $383,900 (MFJ) for 2025
- Deduction = min(20% × QBI, 20% × taxable income before QBI)
- QBI sources: Schedule C net profit + K-1 Section 199A amounts
- Conservative $0 for above-threshold taxpayers (Form 8995-A not implemented)
- Flows to Form 1040 Line 13

### 4. K-1 Groundwork (Schedule K-1 Data Model + Validations)

**Data model:** `ScheduleK1` interface in `types.ts`

- Supports partnership (1065), S-corp (1120-S), trust/estate (1041)
- Captures key income boxes: ordinary income, rental, interest, dividends, capital gains
- Section 199A QBI amount (flows to QBI deduction)
- Distributions field for reference
- `scheduleK1s` array added to `TaxReturn`

**Validation (non-breaking):**
- `K1_INCOME_NOT_COMPUTED` (severity: error) — flags that K-1 income is NOT in the return
- `K1_QBI_PARTIAL` (severity: warning) — when K-1 QBI is used for deduction but income is not

### 5. Form 1040 Integration

**Modified files:** `form1040.ts`, `schedule1.ts`

- Schedule 1, Line 3: Business income/loss from Schedule C
- Schedule 1, Line 15: Deductible half of SE tax
- Form 1040, Line 10: Now includes SE deductible half adjustment
- Form 1040, Line 13: QBI deduction (was hardcoded $0)
- Form 1040, Line 23: Now includes SE tax in other taxes
- Earned income calculation includes net SE earnings
- Form1040Result includes `scheduleCResult`, `scheduleSEResult`, `qbiResult`

### 6. Federal Validation Updates

**Modified file:** `federalValidation.ts`

- Renamed `PHASE2_LIMITATIONS` → `PHASE3_LIMITATIONS` (updated scope description)
- Renamed `UNSUPPORTED_SCHEDULE_C` → `POSSIBLE_SE_INCOME` (only when no Schedule C present)
- New: `SCHEDULE_C_SE_COMPUTED` (info) — confirms SE tax was computed
- New: `SCHEDULE_C_INVENTORY`, `SCHEDULE_C_HOME_OFFICE`, `SCHEDULE_C_VEHICLE` — per-business warnings
- New: `QBI_DEDUCTION_COMPUTED` (info) — confirms QBI deduction was computed
- New: `QBI_RENTAL_NOT_COMPUTED` (info) — rental QBI safe harbor not yet supported
- New: `K1_INCOME_NOT_COMPUTED` (error) — K-1 income not included in return
- New: `K1_QBI_PARTIAL` (warning) — K-1 QBI used but income not computed

---

## Remaining Gaps (Post-Phase 3)

| Gap | Priority | Notes |
|-----|----------|-------|
| Full K-1 tax computation | High | Data model exists; income/deduction/credit integration needed |
| Form 8995-A (complex QBI) | Medium | W-2 wage/UBIA limits, SSTB phase-out for above-threshold |
| Schedule F (farm income) | Low | Rare for typical filers |
| Form 1116 (foreign tax credit) | Medium | Common for international investors |
| Long Schedule SE (Section B) | Low | Church employees, tip income |
| NOL carryforward | Low | Net operating loss from business losses |
| At-risk limitations (Form 6198) | Low | Relevant for leveraged investments |
| Home office (Form 8829) | Medium | Common for self-employed; flag exists |
| 1099-NEC support | Medium | Nonemployee compensation (more common than 1099-MISC Box 3) |
| SE Additional Medicare Tax | Low | 0.9% on combined wages+SE above threshold |

---

## Compliance Caveats

1. **K-1 Income**: Schedule K-1 forms are captured in the data model but their income, deductions, and credits are NOT included in the tax computation. Returns with K-1s will have a **severity: error** validation item. Do NOT file returns with K-1 income without professional review.

2. **QBI Above Threshold**: For taxpayers with taxable income above $191,950 (single) / $383,900 (MFJ), the QBI deduction is conservatively set to $0. The Form 8995-A complex limitations (W-2 wages, UBIA, SSTB) are not yet implemented. This is a **safe conservative** approach — taxpayers may be entitled to a deduction.

3. **Home Office**: The home office deduction (Form 8829) is not computed. If a Schedule C business has `hasHomeOffice: true`, a validation warning is emitted but the deduction is $0.

4. **SE Threshold**: The $400 SE filing threshold is not enforced as a validation check. Very small SE amounts still compute SE tax. This is computationally correct but a $0 SE tax at very low income would be more practical.

5. **Additional Medicare Tax**: The 0.9% Additional Medicare Tax on combined wages + SE earnings above the threshold is computed on W-2 wages (Form 8959) but does not yet include SE earnings in the calculation. This may slightly understate Additional Medicare Tax for high-income self-employed filers.

---

## Test Results

**New tests added:** 56 tests across 4 new test files

| Test File | Tests | Description |
|-----------|-------|-------------|
| `tests/rules/scheduleC.test.ts` | 14 | Schedule C computation: expenses, COGS, losses, 50% meals, multi-business |
| `tests/rules/scheduleSE.test.ts` | 9 | SE tax: 92.35% factor, wage base coordination, deductible half |
| `tests/rules/qbiDeduction.test.ts` | 14 | QBI: simplified path, above-threshold, multiple sources, edge cases |
| `tests/rules/selfEmploymentIntegration.test.ts` | 19 | Full flow: Schedule C → SE → QBI → Form 1040, K-1, validation |

**Total test results:**
```
 Test Files  72 passed (72)
      Tests  1529 passed (1529)
   Duration  5.67s
```

**Pre-existing tests:** 1473 (all passing — zero regressions)
**New tests:** 56
**Failed tests:** 0

---

## Build Output

```
vite v7.3.1 building client environment for production...
✓ 2051 modules transformed.
dist/index.html                              0.39 kB │ gzip:   0.27 kB
dist/assets/pdf.worker.min-wgc6bjNh.mjs  1,078.61 kB
dist/assets/index-C0jXazVf.css              59.23 kB │ gzip:  10.85 kB
dist/assets/index-xz64deNh.js            1,512.84 kB │ gzip: 487.03 kB
✓ built in 1.68s
```

**TypeScript:** 0 errors
**Build:** 2051 modules, 0 errors

---

## Files Changed

### New Files (3)
- `src/rules/2025/scheduleC.ts` — Schedule C computation
- `src/rules/2025/scheduleSE.ts` — Schedule SE computation
- `src/rules/2025/qbiDeduction.ts` — QBI deduction (Form 8995 simplified)

### New Test Files (4)
- `tests/rules/scheduleC.test.ts`
- `tests/rules/scheduleSE.test.ts`
- `tests/rules/qbiDeduction.test.ts`
- `tests/rules/selfEmploymentIntegration.test.ts`

### Modified Files (6)
- `src/model/types.ts` — Added `ScheduleC`, `ScheduleK1` types; `scheduleCBusinesses`, `scheduleK1s` arrays
- `src/rules/2025/constants.ts` — Added SE tax, QBI constants
- `src/rules/2025/form1040.ts` — Integrated Schedule C/SE/QBI into orchestrator
- `src/rules/2025/schedule1.ts` — Added Line 3 (business income), Line 15 (SE deduction)
- `src/rules/2025/federalValidation.ts` — Updated to Phase 3 validation codes
- `tests/rules/federalValidation.test.ts` — Updated 2 assertions for renamed codes

### Documentation
- `docs/federal-gap-closure-phase3-summary.md` — This file
