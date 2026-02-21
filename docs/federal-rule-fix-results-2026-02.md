# Federal Rule Engine — Fix Results

**Date:** 2026-02-20
**Branch:** `feat/federal-rule-fixes-2025`
**Based on:** [Fix Plan](./federal-rule-fix-plan.md)

---

## Summary

All four Priority 0 constant defects in `src/rules/2025/constants.ts` have been corrected to match IRS Rev. Proc. 2024-40 and OBBBA provisions. All affected tests and UI text updated. Full test suite passes (1,081 non-UI tests, 43 test files).

---

## Fix 1: Standard Deduction (OBBBA §70102)

**File:** `src/rules/2025/constants.ts` lines 25-31

| Filing Status | Before | After |
|---|---|---|
| Single | $15,000 | **$15,750** |
| MFJ | $30,000 | **$31,500** |
| MFS | $15,000 | **$15,750** |
| HOH | $22,500 | **$23,625** |
| QW | $30,000 | **$31,500** |

**Cascading impact:** Every scenario's taxable income, tax, and refund/owed changed. Updated:
- `tests/rules/constants.test.ts` — 5 spot-check values
- `tests/rules/form1040-full.test.ts` — 15+ expected values (taxable income, tax, refund, deduction caps, dependent filer tests)
- `tests/rules/engine.test.ts` — standardDeduction document resolution
- `tests/scenarios/integration.test.ts` — all 5 scenarios (A–E) line12/line14/line15/line16/line24/line34/line37
- `src/ui/pages/ReviewPage.tsx` — tooltip explanation text

---

## Fix 2: Child Tax Credit (OBBBA §70101)

**File:** `src/rules/2025/constants.ts` line 248

| Constant | Before | After |
|---|---|---|
| CTC_PER_QUALIFYING_CHILD | $2,000 | **$2,200** |

**Cascading impact:** Updated:
- `tests/rules/childTaxCredit.test.ts` — 10 expected values (initial credit, phase-out, additional CTC, mixed dependent)
- `src/ui/pages/DependentsPage.tsx` — tooltip text ($2,000 → $2,200)
- `src/ui/pages/CreditsPage.tsx` — tooltip text ($2,000 → $2,200)

Notable behavioral change: At single/$240K AGI with 1 child, phase-out reduction is $2,000 but credit is now $2,200, leaving $200 remaining (previously fully phased out at $0).

---

## Fix 3: AMT 28% Threshold

**File:** `src/rules/2025/constants.ts` lines 373-379

| Filing Status | Before | After |
|---|---|---|
| Single/MFJ/HOH/QW | $248,300 | **$239,100** |
| MFS | $124,150 | **$119,550** |

**Cascading impact:** Updated:
- `tests/rules/amt.test.ts` — bracket boundary test input AMTI values ($336,400 → $327,200), 3 comment references

AMT computation code already uses the `AMT_28_PERCENT_THRESHOLD` constant throughout — no hardcoded values found.

---

## Fix 4: Saver's Credit 10% Thresholds

**File:** `src/rules/2025/constants.ts` lines 311-316

| Filing Status | rate10 Before | rate10 After |
|---|---|---|
| Single/MFS | $39,000 | **$39,500** |
| HOH | $58,500 | **$59,250** |
| MFJ/QW | $78,000 | **$79,000** |

**Cascading impact:** Saver's credit computation code uses the constant. Test at AGI $40,000 (above both old and new thresholds) still correctly yields 0%. No test value changes needed.

---

## Build & Test Results

**TypeScript build:** Pre-existing errors only (missing `RSUBasisBanner.tsx` — unrelated UI component). No new errors introduced.

**Test suite (non-UI):**
```
Test Files  43 passed (43)
     Tests  1173 passed (1173)
```

All 1,173 tests pass, including:
- 85 constant spot-checks
- 94 Form 1040 line tests
- 30 child tax credit tests
- 23 AMT tests
- 28 other credits tests
- 28 integration scenario tests (with PDF round-trip)

**UI tests:** 6 pre-existing failures (matchMedia mock, DOMMatrix, missing RSUBasisBanner). Not related to this change.

---

## Runtime Code Verification

Searched all production source code (`src/`) for hardcoded old values:

- **Standard deduction:** Found and fixed in `ReviewPage.tsx` tooltip text
- **CTC per child:** Found and fixed in `DependentsPage.tsx` and `CreditsPage.tsx` tooltip text
- **AMT 28% thresholds:** No hardcoded values found — all computation uses constants
- **Saver's credit thresholds:** No hardcoded values found — all computation uses constants
- **CTC computation:** Confirmed `childTaxCredit.ts` uses `CTC_PER_QUALIFYING_CHILD` constant (not hardcoded)

---

## Files Changed

### Constants (1 file)
- `src/rules/2025/constants.ts` — 4 constant groups corrected

### Tests (7 files)
- `tests/rules/constants.test.ts` — standard deduction spot-checks
- `tests/rules/form1040-full.test.ts` — Form 1040 expected values, dependent filer tests
- `tests/rules/childTaxCredit.test.ts` — CTC credit amounts, phase-out, ACTC
- `tests/rules/amt.test.ts` — bracket boundary inputs, threshold comments
- `tests/rules/engine.test.ts` — document resolution standard deduction
- `tests/scenarios/integration.test.ts` — 5 end-to-end scenarios

### UI (3 files)
- `src/ui/pages/ReviewPage.tsx` — standard deduction tooltip
- `src/ui/pages/DependentsPage.tsx` — CTC per-child tooltip
- `src/ui/pages/CreditsPage.tsx` — CTC per-child tooltip

---

## Remaining Gaps

### Priority 1 — OBBBA $6,000 Senior Deduction (§70103)
**Status:** Not implemented. This is a new deduction (not a constant fix) for taxpayers age 65+, separate from the existing additional standard deduction. Requires:
- New constant in `constants.ts`
- Logic change in `form1040.ts` Line 12 computation
- New age flag or reuse of existing `taxpayerAge65` field
- Estimated effort: 2-4 hours

### Priority 2 — Feature Gaps (Not Blocking)
- QBI deduction (Line 13) — requires Schedule C/K-1 support
- Self-employment tax (Schedule SE) — requires Schedule C
- K-1 income flows — requires partnership/S-corp support
