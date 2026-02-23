# Federal Gap Closure — Phase 2 Summary

**Date:** 2026-02-22
**Tax Year:** 2025 (returns filed in 2026)
**Branch:** `feat/federal-gap-closure-phase2`

---

## What Was Implemented

### 1. Premium Tax Credit (Form 8962 / IRC §36B)

**Data Model (`src/model/types.ts`):**
- Added `Form1095AMonthlyRow` interface: `month`, `enrollmentPremium`, `slcspPremium`, `advancePTC` (all in integer cents)
- Added `Form1095A` interface: `id`, `marketplaceName`, `policyNumber?`, `recipientName`, `rows[]`
- Added `form1095As: Form1095A[]` to `TaxReturn` interface with `emptyTaxReturn()` factory support

**Computation (`src/rules/2025/premiumTaxCredit.ts` — new file):**
- Federal Poverty Level: `$15,060` base + `$5,380` per additional person (2025 HHS guidelines)
- `federalPovertyLevel(householdSize)` → annual FPL in cents
- Applicable percentage table with 5 IRA-enhanced bands (0%–8.5%):
  - ≤150% FPL: 0%, 150–200%: 0–2%, 200–250%: 2–4%, 250–300%: 4–6%, 300–400%: 6–8.5%
  - `computeApplicablePercentage(fplPercent)` → decimal with linear interpolation within bands
- Repayment caps for excess APTC (Table 5, Form 8962):
  - <200% FPL: $400 single / $800 MFJ
  - 200–300%: $1,050 / $2,100
  - 300–400%: $1,750 / $3,500
  - ≥400%: Unlimited (full repayment)
- `computePremiumTaxCredit(form1095As, householdIncome, filingStatus, numDependents, hasSpouse)`:
  - Consolidates monthly rows across multiple 1095-A forms
  - Monthly PTC = max(0, min(enrollmentPremium, SLCSP − monthlyContribution))
  - Annual PTC = sum of monthly PTC amounts
  - Net PTC = annual PTC − total APTC
  - Positive net PTC → refundable credit (Line 31)
  - Negative net PTC → excess APTC repayment (capped for income <400% FPL) → Schedule 2, Part I → Line 17

**Refundable Credits Integration (`src/rules/2025/refundableCredits.ts`):**
- `computeRefundableCredits(model, agi)` now accepts AGI parameter for PTC computation
- New fields on `RefundableCreditsResult`: `premiumTaxCredit: PremiumTaxCreditResult | null`, `excessAPTCRepayment: number`
- When net PTC > 0: adds `RefundableCreditItem` with `creditId: 'premiumTaxCredit'` to Line 31 total
- When net PTC < 0: calculates capped repayment amount (not included in Line 31)

**Form 1040 Integration (`src/rules/2025/form1040.ts`):**
- Moved `computeRefundableCredits()` call before Line 16/17 computation so excess APTC repayment is available
- `computeLine17()` updated to accept `excessAPTCRepayment` parameter; adds it to Schedule 2, Part I total alongside AMT
- `refundableCreditsResult` attached to `Form1040Result` for downstream access

**Engine Trace (`src/rules/engine.ts`):**
- Added trace node labels: `refundableCredit.premiumTaxCredit`, `ptc.excessAPTCRepayment`
- Added 1095-A document source leaf nodes in `collectAllValues()`
- Added 1095-A document reference resolver in `resolveDocumentRef()`

### 2. Social Security MFS Lived-Apart Exception (IRC §86(c)(1)(C)(ii))

**Data Model:**
- Added `mfsLivedApartAllYear?: boolean` to the `deductions` block in `TaxReturn`

**Computation (`src/rules/2025/socialSecurityBenefits.ts`):**
- New constants: `SS_MFS_LIVED_APART_BASE = $25,000`, `SS_MFS_LIVED_APART_ADDITIONAL = $34,000`
- `computeTaxableSocialSecurity()` now accepts `mfsLivedApart: boolean = false`
- When `filingStatus === 'mfs' && mfsLivedApart === true`: uses single-filer-equivalent thresholds ($25K/$34K) instead of default MFS thresholds ($0/$0)
- Added `mfsLivedApart?: boolean` to `SocialSecurityBenefitsResult` for transparency
- The MFS lived-apart flag flows from `model.deductions.mfsLivedApartAllYear` through `computeForm1040()` to the SS computation

**Impact:** Without this fix, MFS filers who lived apart all year would have up to 85% of benefits taxable regardless of income, instead of receiving the more favorable single-like thresholds they're entitled to under IRC §86(c)(1)(C)(ii).

### 3. Improved Unsupported-Gap Signaling

**Federal Validation (`src/rules/2025/federalValidation.ts`):**

New and improved validation items:

| Code | Severity | Trigger | Purpose |
|------|----------|---------|---------|
| `UNSUPPORTED_SCHEDULE_C` | warning | 1099-MISC Box 3 > $600 | Self-employment income detected; Schedule C/SE not computed |
| `UNSUPPORTED_QBI_DEDUCTION` | info | Schedule E or large 1099-MISC | QBI deduction (IRC §199A) not implemented |
| `UNSUPPORTED_K1_INCOME` | info | Always | K-1 passthrough income not in data model |
| `PHASE2_LIMITATIONS` | info | Always | Overall scope of what is/isn't supported |
| `PTC_FORM_8962` | info | 1095-A present | Form 8962 reconciliation computed |
| `MFS_SS_BENEFITS` | warning | MFS + SS, not lived-apart | Warns about $0 base amount |
| `MFS_SS_BENEFITS_LIVED_APART` | info | MFS + SS + lived-apart | Confirms lived-apart thresholds in use |
| `SSA_NEGATIVE_NET_BENEFITS` | warning | Box 5 < 0 | Advises about IRC §1341 claim-of-right |
| `SSA_BENEFITS_REPAID` | info | Box 4 > 0, Box 5 ≥ 0 | Notes partial repayment, mentions §1341 if >$3K |
| `SSA_BOX5_MISMATCH` | warning | Box 5 ≠ Box 3 − Box 4 | Data integrity check |

Removed: `PHASE1_LIMITATIONS`, `POSSIBLE_SE_INCOME` (replaced by more specific codes above)

---

## Tests Added

### `tests/rules/premiumTaxCredit.test.ts` — 28 tests

- **FPL computation** (3 tests): 1-person, 2-person, 4-person households
- **Applicable percentage** (7 tests): All 5 bands including boundaries (0%, 150%, 175%, 200%, 250%, 300%, 400%) and above 400%
- **Repayment caps** (5 tests): Single/MFJ at <200%, 200–300%, 300–400%, and >400% FPL
- **PTC computation** (7 tests): Credit exceeds APTC, APTC exceeds PTC, repayment cap enforcement, family with dependents, no 1095-A forms, partial-year coverage, zero APTC
- **Refundable credits integration** (3 tests): PTC credit flows to Line 31, excess APTC to repayment path, no PTC items when no 1095-A
- **Form 1040 integration** (3 tests): Line 31 includes credit, Line 17 includes repayment, validation emits PTC info

### `tests/rules/socialSecurityEdgeCases.test.ts` — 18 tests

- **MFS lived-apart thresholds** (7 tests): Default $0/$0, lived-apart matches single, Tier 0/1/2 with lived-apart, comparative test showing dramatic taxability difference
- **Benefits repaid** (3 tests): Zero benefits, negative benefits (repaid > received), withholding passthrough
- **Tax-exempt interest** (1 test): Pushes combined income from Tier 0 to Tier 1
- **Validation** (5 tests): Negative net benefits warning, benefits-repaid info, Box 5 mismatch, MFS warning, MFS lived-apart info
- **Form 1040 integration** (2 tests): MFS lived-apart flag flows through, MFS without flag triggers 85% taxability

### Pre-existing test fixes (2 tests)

- `tests/rules/federalValidation.test.ts`: Updated `PHASE1_LIMITATIONS` → `PHASE2_LIMITATIONS`, `POSSIBLE_SE_INCOME` → `UNSUPPORTED_SCHEDULE_C` (severity `info` → `warning`)

**Total new tests:** 48
**Total test count:** 1473 (all passing)

---

## Files Modified

| File | Change |
|------|--------|
| `src/model/types.ts` | Added `Form1095A`, `Form1095AMonthlyRow` interfaces; `form1095As` array; `mfsLivedApartAllYear` flag |
| `src/rules/2025/premiumTaxCredit.ts` | **New file** — FPL, applicable %, repayment caps, full PTC computation |
| `src/rules/2025/socialSecurityBenefits.ts` | Added MFS lived-apart threshold constants and computation path |
| `src/rules/2025/refundableCredits.ts` | Integrated PTC into refundable credits framework; AGI parameter |
| `src/rules/2025/form1040.ts` | Wired PTC into Line 17 (repayment) and Line 31 (credit); passed MFS lived-apart flag |
| `src/rules/2025/federalValidation.ts` | Added/improved 10 validation items for PTC, SS edge cases, and gap signaling |
| `src/rules/engine.ts` | Added PTC trace nodes, 1095-A source leaves, excess APTC trace |
| `tests/rules/premiumTaxCredit.test.ts` | **New file** — 28 tests |
| `tests/rules/socialSecurityEdgeCases.test.ts` | **New file** — 18 tests |
| `tests/rules/federalValidation.test.ts` | Fixed 2 tests for renamed validation codes |

---

## Backward Compatibility

- All 1016 pre-existing tests continue to pass (1473 total with new tests)
- `form1095As` defaults to `[]` in `emptyTaxReturn()` — no impact on existing returns without marketplace coverage
- `mfsLivedApartAllYear` is optional (`?: boolean`), defaults to `false` — existing MFS returns unaffected
- `computeRefundableCredits()` AGI parameter defaults to `0` — existing callers without PTC data work unchanged
- `computeTaxableSocialSecurity()` mfsLivedApart parameter defaults to `false` — same behavior as before
- `computeLine17()` excessAPTCRepayment parameter defaults to `0` — no change for returns without PTC

---

## Remaining Gaps (Future Phases)

| Gap | Priority | Notes |
|-----|----------|-------|
| Schedule C / SE Tax | High | Self-employment income and 15.3% SE tax; currently warned but not computed |
| Schedule F | Medium | Farm income |
| Form 1116 (Foreign Tax Credit) | Medium | Currently not in data model |
| K-1 Passthrough (1065/1120-S/1041) | Medium | Partnership/S-corp/trust income |
| QBI Deduction (IRC §199A) | Medium | Up to 20% deduction for qualified business income |
| Form 8962 UI | Low | Data model and computation exist; interview wizard for 1095-A data entry needed |

---

## Build & Test Results

```
Build: tsc -b && vite build — 2048 modules, 0 errors
Tests: 68 files, 1473 tests, all passing
```
