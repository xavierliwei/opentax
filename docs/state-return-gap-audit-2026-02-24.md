# State-Return Gap Audit — 2026-02-24

Scope: 10 supported states + DC (CA, CT, DC, GA, MA, MD, NC, NJ, NY, PA, VA) for TY 2025.
Covers: rules/calculations, interview UX, review pages, PDF download, tests.

---

## P0 — Must-fix (incorrect output or data loss)

### P0-1: MD county field not collected in UI
**Evidence:** `StateReturnConfig.county` (types.ts:583) is used by `form502.ts` to pick local tax rate (2.25%–3.20%), but `StateReturnsPage.tsx` never renders a county selector — grep for `rentAmount|contributions529|county` in that file returns zero matches.
**Impact:** Every MD return uses the default county rate; users cannot correct it. Local tax can swing ~$800/year on $80K income.
**Fix:** Add `<select>` for MD counties when `stateCode === 'MD'`; wire to `updateStateReturn`.

### P0-2: MA rent deduction field not collected in UI
**Evidence:** `StateReturnConfig.rentAmount` (types.ts:584) feeds `form1.ts` rent deduction (50% of rent, cap $4K), but the UI never asks for it.
**Impact:** MA filers who rent lose up to $200 in tax savings silently.
**Fix:** Add numeric input for annual rent when `stateCode === 'MA'`; show inline cap note.

### P0-3: PA §529 contribution field not collected in UI
**Evidence:** `StateReturnConfig.contributions529` (types.ts:585) feeds `pa40.ts` deduction (up to $18K single/$36K MFJ), but no UI input exists.
**Impact:** PA filers with 529 plans lose up to $553 (3.07% × $18K) savings silently.
**Fix:** Add numeric input when `stateCode === 'PA'`.

### P0-4: NJ college-student exemption collected but invisible
**Evidence:** `njDependentCollegeStudents` is defined in `StateReturnConfig` (types.ts:598) and consumed in `formNJ1040.ts:224`, but the UI never presents a way to tag dependents as college students.
**Impact:** NJ filers lose $1,000 exemption per qualifying dependent.
**Fix:** Add multi-select of dependents as college students when `stateCode === 'NJ'`.

---

## P1 — High-impact gaps (wrong or missing calculation logic)

### P1-1: CT part-year / nonresident not implemented
**Evidence:** `formCT1040.ts` has no apportionment logic; no `computeApportionmentRatio` call. Config allows `residencyType: 'part-year'` but computation ignores it.
**Impact:** CT part-year filers are taxed on full-year income.
**Fix:** Add apportionment to `formCT1040.ts`; add move-in/out date collection for CT.

### P1-2: NJ part-year / nonresident not supported
**Evidence:** `module.ts:19` — form label says `'NJ-1040NR not yet supported'`. Part-year flag is stored but computation does not apportion income.
**Impact:** NJ part-year filers over-taxed.
**Fix:** Implement NJ income apportionment or gate part-year selection in UI until ready.

### P1-3: PA source apportionment not applied
**Evidence:** `pa40.ts` calls `computeApportionmentRatio` and stores it, but income classes are not filtered to PA-source for nonresidents. `incomeClasses.ts:75-86` has nonresident W-2 filtering for Class 1 only — Classes 2-8 use full amounts.
**Impact:** PA nonresidents over-taxed on out-of-state interest/dividends/gains.
**Fix:** Apply source rules to all 8 income classes for nonresident; add PA-source allocation for each class.

### P1-4: CA nonresident income not modeled
**Evidence:** `form540.ts:203` comment: `'nonresident: 0.0 (only CA-source income taxed — not yet modeled)'`. Apportionment returns 0 for nonresidents, yielding $0 tax (incorrect if CA-source income exists).
**Impact:** CA nonresidents with CA-source income get $0 tax instead of correct amount.
**Fix:** Either implement CA-source income allocation or disable nonresident selection for CA in UI.

### P1-5: NC additions/deductions hardcoded to 0
**Evidence:** `formd400.ts:77-78`: `ncAdditions = 0; ncDeductions = 0`. NC has additions (e.g., state income tax deducted on federal) and deductions (e.g., Social Security, Bailey Settlement exclusion).
**Impact:** NC AGI is always equal to federal AGI; some filers overpay, others underpay.
**Fix:** Implement at minimum: NC add-back of state income tax (if itemizing) and Social Security exclusion.

### P1-6: MA credits always $0
**Evidence:** `form1.ts:240`: `const totalCredits = 0`. MA has several credits (limited income credit, septic credit, lead paint credit, EITC) — none modeled.
**Impact:** Low/moderate-income MA filers miss refundable credits.
**Fix:** Implement MA EITC (30% of federal) at minimum; gate others behind Phase 2.

### P1-7: CT dependent detection uses fragile string matching
**Evidence:** `formCT1040.ts:75` — `d.relationship.toLowerCase().includes('son')` will match "grandson", "person", "mason" and miss "stepchild", "foster child".
**Impact:** CT EITC child bonus may be incorrectly granted or denied.
**Fix:** Use structured `isQualifyingChild` flag or age-based check instead of substring match on relationship.

### P1-8: PA §529 deduction has no per-beneficiary validation
**Evidence:** `pa40.ts` applies the deduction from `config.contributions529` without checking per-beneficiary limits ($18K single, $36K MFJ per beneficiary).
**Impact:** Users could enter lump-sum exceeding per-beneficiary cap; over-deducting.
**Fix:** Either collect per-beneficiary amounts or add validation cap warning.

---

## P2 — Polish / coverage gaps (lower risk, still needed)

### P2-1: State review steps never mark complete
**Evidence:** `steps.ts:57` — `isComplete: () => false` for all dynamic state review steps. Also lines 280 and 291.
**Impact:** Sidebar shows state reviews as never-done; user can't track progress.
**Fix:** Mark complete when state result computes without errors (or simply when visited).

### P2-2: CT test coverage critically low
**Evidence:** `tests/rules/ct/formCT1040.test.ts` — 35 lines, ~5 test cases. Compare CA (809 lines) or MD (679 lines).
**Impact:** Regressions in CT computation likely to go undetected.
**Fix:** Expand to cover bracket boundaries, exemption phase-out, property tax credit, EITC, withholding.

### P2-3: DC test coverage critically low
**Evidence:** `tests/rules/dc/formd40.test.ts` — 61 lines, ~3 test cases. No bracket or deduction testing.
**Impact:** DC regressions undetected.
**Fix:** Add bracket boundary tests, standard/itemized deduction tests, low-income credit tests.

### P2-4: NC test coverage insufficient
**Evidence:** `tests/rules/nc/formd400.test.ts` — 57 lines, ~7 test cases. No bracket verification, no deduction tests.
**Fix:** Expand to cover flat-rate verification, standard deduction by filing status, withholding.

### P2-5: Duplicate `computeApportionmentRatio` across 10 files
**Evidence:** Grep finds the function in `ca/form540.ts`, `ma/form1.ts`, `md/form502.ts`, `nc/formd400.ts`, `pa/pa40.ts`, `va/form760.ts`, `dc/formd40.ts`, `ga/form500.ts` — near-identical logic each time.
**Impact:** Maintenance burden; divergent bug fixes.
**Fix:** Extract to `src/rules/apportionment.ts`; import from each module.

### P2-6: GA/VA retirement exclusions hardcoded to 0
**Evidence:** `scheduleGA.ts:26` — retirement exclusion = 0. `scheduleADJ.ts` — other subtractions = 0. Both are Phase 2 placeholders.
**Impact:** Retirees in GA ($65K exclusion age 62+) and VA ($12K age 65+) overpay.
**Fix:** Implement age-gated retirement exclusion for each state.

### P2-7: Accessibility gaps in StateReturnsPage
**Evidence:** Labels at lines 165-192 lack `htmlFor` attributes; housing-type fieldset (lines 256-293) lacks `aria-describedby`. No `aria-disabled` on "coming soon" residency options.
**Impact:** Screen-reader users cannot operate state config form effectively.
**Fix:** Add `htmlFor`, `aria-label`, `aria-describedby` throughout.

### P2-8: CT form PDF not tested in stateCompiler.test.ts
**Evidence:** `tests/forms/stateCompiler.test.ts` covers CA, MA, MD, NJ, PA, VA, DC, NC — CT absent.
**Fix:** Add CT form compilation test.

### P2-9: No filing-status edge-case tests (QW, MFS) for most states
**Evidence:** Most state test suites only exercise Single and MFJ. QW (Qualifying Surviving Spouse), MFS, and HOH untested for CT, DC, GA, NC, PA.
**Fix:** Add at least one test per filing status per state.

### P2-10: Part-year apportionment ratio preview missing from UI
**Evidence:** Apportionment ratio is computed in rules but never displayed to users in `StateReturnsPage.tsx`. Users cannot verify the fraction of the year used.
**Fix:** Show computed ratio (e.g., "182/365 = 49.9%") below the date inputs.

---

## Cross-cutting observations

| Aspect | Status |
|--------|--------|
| Tax brackets TY 2025 | All states loaded ✓ |
| Filing statuses (Single/MFJ/MFS/HOH/QW) | All states handle via constants ✓ |
| Negative-income floor | All states use `Math.max(0, …)` ✓ |
| W-2 withholding aggregation | All states filter by Box 15 state code ✓ |
| Explainability trace nodes | All states provide `nodeLabels` + `collectTracedValues` ✓ |
| PDF generation | All 11 states have fillers (programmatic pdf-lib) ✓ |
