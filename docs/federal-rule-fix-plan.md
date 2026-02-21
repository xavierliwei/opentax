# Federal Rule Engine — Fix Plan

**Date:** 2026-02-20
**Based on:** [Federal Rule Engine Audit](./federal-rule-engine-audit-2026-02.md)

---

## Priority 0 — Must Fix Before Filing Season

All four defects are in `src/rules/2025/constants.ts`. The fixes are constant-value changes only; no logic modifications are needed.

### Fix 1: Standard Deduction (OBBBA §70102)

**File:** `src/rules/2025/constants.ts` lines 25-31
**Effort:** 5 minutes
**Risk:** Low (constant change, extensive test coverage)

```diff
 export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
-  single: c(15000),
-  mfj:    c(30000),
-  mfs:    c(15000),
-  hoh:    c(22500),
-  qw:     c(30000),
+  single: c(15750),
+  mfj:    c(31500),
+  mfs:    c(15750),
+  hoh:    c(23625),
+  qw:     c(31500),
 }
```

**Impact:** Affects every tax return. Under-deducting income → taxpayers overpay.
**Tests to update:** `constants.test.ts` (standard deduction spot checks), `form1040-full.test.ts` (integration scenarios that hard-code expected values), `integration.test.ts` (scenario expected values).

---

### Fix 2: Child Tax Credit (OBBBA §70101)

**File:** `src/rules/2025/constants.ts` line 248
**Effort:** 5 minutes
**Risk:** Low (constant change)

```diff
-export const CTC_PER_QUALIFYING_CHILD    = c(2000)   // $2,000 per child under 17
+export const CTC_PER_QUALIFYING_CHILD    = c(2200)   // $2,200 per child under 17 (OBBBA §70101)
```

**Impact:** All returns with qualifying children under 17 get $200 less credit per child.
**Tests to update:** `childTaxCredit.test.ts` (expected credit amounts), `form1040-full.test.ts` (family scenarios), `integration.test.ts`.

---

### Fix 3: AMT 28% Threshold

**File:** `src/rules/2025/constants.ts` lines 373-379
**Effort:** 5 minutes
**Risk:** Low (constant change, affects only high-AMT filers)

```diff
 export const AMT_28_PERCENT_THRESHOLD: Record<FilingStatus, number> = {
-  single: c(248300),
-  mfj:    c(248300),
-  mfs:    c(124150),
-  hoh:    c(248300),
-  qw:     c(248300),
+  single: c(239100),
+  mfj:    c(239100),
+  mfs:    c(119550),
+  hoh:    c(239100),
+  qw:     c(239100),
 }
```

**Impact:** AMT filers with AMTI above exemption pay slightly wrong AMT. The 28% rate kicks in $9,200 too late, under-collecting AMT in the $239,100-$248,300 range.
**Tests to update:** `amt.test.ts` (threshold references and expected values), `constants.test.ts` (if AMT constants are tested).

---

### Fix 4: Saver's Credit 10% Thresholds

**File:** `src/rules/2025/constants.ts` lines 311-316
**Effort:** 5 minutes
**Risk:** Low (constant change, affects low-income filers near threshold)

```diff
 export const SAVERS_CREDIT_THRESHOLDS: Record<FilingStatus, SaversCreditThreshold> = {
-  single: { rate50: c(23750),  rate20: c(25500),  rate10: c(39000) },
-  mfs:    { rate50: c(23750),  rate20: c(25500),  rate10: c(39000) },
-  hoh:    { rate50: c(35625),  rate20: c(38250),  rate10: c(58500) },
-  mfj:    { rate50: c(47500),  rate20: c(51000),  rate10: c(78000) },
-  qw:     { rate50: c(47500),  rate20: c(51000),  rate10: c(78000) },
+  single: { rate50: c(23750),  rate20: c(25500),  rate10: c(39500) },
+  mfs:    { rate50: c(23750),  rate20: c(25500),  rate10: c(39500) },
+  hoh:    { rate50: c(35625),  rate20: c(38250),  rate10: c(59250) },
+  mfj:    { rate50: c(47500),  rate20: c(51000),  rate10: c(79000) },
+  qw:     { rate50: c(47500),  rate20: c(51000),  rate10: c(79000) },
 }
```

**Impact:** Filers with AGI between old and new threshold (e.g. $39,000-$39,500 single) incorrectly get 0% instead of 10%. Small population affected.
**Tests to update:** `otherCredits.test.ts` (saver's credit tests).

---

## Implementation Order

1. Apply all 4 constant fixes in a single commit to `constants.ts`
2. Update all affected test expected values
3. Run full test suite to verify
4. Commit test updates separately

**Total estimated effort:** 1-2 hours including test updates.

---

## Priority 1 — New Feature

### OBBBA $6,000 Senior Deduction (§70103)

**Effort:** 2-4 hours
**Files affected:** `constants.ts` (new constant), `form1040.ts` (add to Line 12 logic), `types.ts` (may need age flag)
**Description:** OBBBA created a new deduction of up to $6,000 for taxpayers age 65+ (in addition to the existing additional standard deduction). This is a separate provision under IRC §63 as amended.

---

## Priority 2 — Future Work (Not Blocking)

These are feature gaps, not defects:
- QBI deduction (Line 13) — requires Schedule C/K-1 support
- Self-employment tax (Schedule SE) — requires Schedule C
- K-1 income flows — requires partnership/S-corp support
