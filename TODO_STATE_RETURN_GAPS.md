# State-Return Gap — Parallel TODO Backlog

Generated: 2026-02-24
Audit: [docs/state-return-gap-audit-2026-02-24.md](docs/state-return-gap-audit-2026-02-24.md)

Parallelization groups:
- **A** — UI input collection (StateReturnsPage.tsx, types, store)
- **B** — Calculation / rules engine fixes
- **C** — Test expansion
- **D** — UX polish & accessibility

Groups A–D are independent and can run concurrently.
Tasks within the same group that touch different files can also run concurrently.

---

## Group A — UI Input Collection

### STATE-GAP-001  Add MD county selector
- **Severity:** P0
- **Scope:** `src/ui/pages/StateReturnsPage.tsx`, `src/rules/2025/md/constants.ts` (county list)
- **Acceptance criteria:**
  - When `stateCode === 'MD'`, a `<select>` renders with all 24 counties + Baltimore City
  - Selected value written to `config.county` via `updateStateReturn`
  - Default county matches `MD_DEFAULT_COUNTY` from constants
  - County selector hidden for non-MD states
- **Test:** `npm test -- --grep "StateReturnsPage"` + manual: select MD → verify county dropdown appears

### STATE-GAP-002  Add MA rent-amount input
- **Severity:** P0
- **Scope:** `src/ui/pages/StateReturnsPage.tsx`
- **Acceptance criteria:**
  - When `stateCode === 'MA'`, a numeric input for annual rent appears
  - Value stored in `config.rentAmount` (cents)
  - Inline helper text: "50% of rent, max $4,000 deduction"
  - Input hidden for non-MA states
- **Test:** `npm test -- --grep "StateReturnsPage"` + manual: select MA → verify rent field

### STATE-GAP-003  Add PA §529 contribution input
- **Severity:** P0
- **Scope:** `src/ui/pages/StateReturnsPage.tsx`
- **Acceptance criteria:**
  - When `stateCode === 'PA'`, a numeric input for 529 contributions appears
  - Value stored in `config.contributions529` (cents)
  - Inline helper text: "Up to $18,000 per beneficiary ($36,000 MFJ)"
  - Input hidden for non-PA states
- **Test:** `npm test -- --grep "StateReturnsPage"` + manual: select PA → verify 529 field

### STATE-GAP-004  Add NJ college-student dependent selector
- **Severity:** P0
- **Scope:** `src/ui/pages/StateReturnsPage.tsx`
- **Acceptance criteria:**
  - When `stateCode === 'NJ'`, show checkboxes next to each dependent allowing user to tag as college student
  - Selected dependent IDs written to `config.njDependentCollegeStudents`
  - Only appears if at least one dependent exists in the return
- **Test:** `npm test -- --grep "StateReturnsPage"` + manual: add NJ + dependents → verify selector

---

## Group B — Calculation / Rules Fixes

### STATE-GAP-010  Implement CT part-year apportionment
- **Severity:** P1
- **Scope:** `src/rules/2025/ct/formCT1040.ts`, `src/rules/2025/ct/module.ts`
- **Acceptance criteria:**
  - When `residencyType === 'part-year'`, compute ratio from moveInDate/moveOutDate
  - Apply ratio to CT tax (multiply full-year tax by ratio)
  - `StateComputeResult.apportionmentRatio` populated
  - Full-year behavior unchanged
- **Test:** `npm test -- tests/rules/ct/` — add part-year scenario; verify prorated tax

### STATE-GAP-011  Gate NJ part-year selection until NJ-1040NR implemented
- **Severity:** P1
- **Scope:** `src/ui/pages/StateReturnsPage.tsx` (disable part-year/nonresident for NJ), `src/rules/2025/nj/module.ts` (remove misleading label)
- **Acceptance criteria:**
  - Part-year and nonresident radio buttons disabled for NJ with "Coming soon" text
  - `module.ts` form label no longer says "part-year estimate" when residency is full-year
- **Test:** `npm test -- tests/rules/nj/` — existing tests pass; manual: NJ part-year disabled in UI

### STATE-GAP-012  Fix PA nonresident source apportionment (Classes 2-8)
- **Severity:** P1
- **Scope:** `src/rules/2025/pa/incomeClasses.ts`
- **Acceptance criteria:**
  - For nonresidents, Classes 2-8 filtered to PA-source income (e.g., interest from PA institutions, PA rental property)
  - Full-year resident behavior unchanged
  - If PA-source data unavailable, fall back to apportionment ratio × total
- **Test:** `npm test -- tests/rules/pa/` — add nonresident scenario with mixed-source income

### STATE-GAP-013  Disable CA nonresident in UI until CA-source modeled
- **Severity:** P1
- **Scope:** `src/ui/pages/StateReturnsPage.tsx`
- **Acceptance criteria:**
  - Nonresident radio button disabled for CA with "Coming soon" text
  - No change to form540.ts computation
- **Test:** manual: CA → nonresident option disabled

### STATE-GAP-014  Implement NC additions/deductions (Phase 1 set)
- **Severity:** P1
- **Scope:** `src/rules/2025/nc/formd400.ts`, `src/rules/2025/nc/constants.ts`
- **Acceptance criteria:**
  - NC addition: state income tax deducted on federal Schedule A (if itemizing)
  - NC deduction: Social Security benefits (full exclusion)
  - `ncAdditions` and `ncDeductions` no longer hardcoded to 0
  - Federal-only filers unaffected (additions = 0 for standard deduction)
- **Test:** `npm test -- tests/rules/nc/` — add scenarios: itemizer with SALT, Social Security recipient

### STATE-GAP-015  Implement MA EITC (30% of federal)
- **Severity:** P1
- **Scope:** `src/rules/2025/ma/form1.ts`, `src/rules/2025/ma/constants.ts`
- **Acceptance criteria:**
  - `totalCredits` includes MA EITC = 30% of federal EITC (Form 1040 Line 27)
  - Credit is refundable (reduces amountOwed, increases overpaid)
  - $0 credit when federal EITC is $0
- **Test:** `npm test -- tests/rules/ma/` — add EITC scenario with known federal EITC amount

### STATE-GAP-016  Fix CT qualifying-child detection
- **Severity:** P1
- **Scope:** `src/rules/2025/ct/formCT1040.ts` (line 75)
- **Acceptance criteria:**
  - Replace substring match (`includes('son')`) with structured check: use dependent's `isQualifyingChild` flag or age < 19 (< 24 if student)
  - "grandson" no longer false-positives unless actually qualifying
  - "stepchild", "foster child" correctly detected
- **Test:** `npm test -- tests/rules/ct/` — add cases: "stepchild" → qualifies; "person" → does not qualify

### STATE-GAP-017  Add PA §529 per-beneficiary validation
- **Severity:** P1
- **Scope:** `src/rules/2025/pa/pa40.ts`
- **Acceptance criteria:**
  - If `contributions529` exceeds $18,000 × beneficiaryCount (or $36,000 MFJ), clamp to limit
  - Add `disclosures` entry warning if clamped
  - If beneficiary count unavailable, use 1 as default
- **Test:** `npm test -- tests/rules/pa/` — add scenario: $25K contribution single → clamped to $18K

### STATE-GAP-018  Extract shared `computeApportionmentRatio` utility
- **Severity:** P2
- **Scope:** New file `src/rules/apportionment.ts`; update imports in `ca/form540.ts`, `ma/form1.ts`, `md/form502.ts`, `nc/formd400.ts`, `pa/pa40.ts`, `va/form760.ts`, `dc/formd40.ts`, `ga/form500.ts`, `fl/module.ts`
- **Acceptance criteria:**
  - Single canonical function in `apportionment.ts`
  - All 9 state modules import from it; local copies deleted
  - All existing state tests pass unchanged
- **Test:** `npm test -- tests/rules/` — full state test suite passes

### STATE-GAP-019  Implement GA retirement exclusion (age 62+)
- **Severity:** P2
- **Scope:** `src/rules/2025/ga/scheduleGA.ts`, `src/rules/2025/ga/constants.ts`
- **Acceptance criteria:**
  - Taxpayers age 62+ (or permanently disabled) get up to $65,000 exclusion ($130,000 MFJ) on retirement income
  - Exclusion applies to 1099-R income only
  - No exclusion for age < 62
- **Test:** `npm test -- tests/rules/ga/` — add scenario: age 63, $50K pension → $0 taxable retirement

### STATE-GAP-020  Implement VA age deduction improvements
- **Severity:** P2
- **Scope:** `src/rules/2025/va/scheduleADJ.ts`, `src/rules/2025/va/constants.ts`
- **Acceptance criteria:**
  - Age 65+ deduction up to $12,000, phased out above $75,000 FAGI
  - Phase-out: $1 reduction per $1 over $75K threshold
  - Deduction = max(0, $12,000 − max(0, FAGI − $75,000))
- **Test:** `npm test -- tests/rules/va/` — add scenarios at $74K, $75K, $80K, $87K FAGI

---

## Group C — Test Expansion

### STATE-GAP-030  Expand CT test suite
- **Severity:** P2
- **Scope:** `tests/rules/ct/formCT1040.test.ts` (currently 35 lines)
- **Acceptance criteria:**
  - ≥ 15 test cases covering: bracket boundaries (all 7 CT brackets), personal exemption phase-out, property tax credit, EITC with/without children, standard vs no-deduction, withholding/refund, zero income
  - All filing statuses tested (Single, MFJ, MFS, HOH)
- **Test:** `npm test -- tests/rules/ct/`

### STATE-GAP-031  Expand DC test suite
- **Severity:** P2
- **Scope:** `tests/rules/dc/formd40.test.ts` (currently 61 lines)
- **Acceptance criteria:**
  - ≥ 12 test cases covering: all 6 DC brackets, standard deduction, itemized deduction, commuter exemption (MD, VA, OTHER), part-year apportionment, withholding, zero income
- **Test:** `npm test -- tests/rules/dc/`

### STATE-GAP-032  Expand NC test suite
- **Severity:** P2
- **Scope:** `tests/rules/nc/formd400.test.ts` (currently 57 lines)
- **Acceptance criteria:**
  - ≥ 10 test cases covering: flat rate verification, standard deduction by filing status, part-year proration, withholding aggregation, zero income, Social Security exclusion (after STATE-GAP-014)
- **Test:** `npm test -- tests/rules/nc/`

### STATE-GAP-033  Add CT form compilation test
- **Severity:** P2
- **Scope:** `tests/forms/stateCompiler.test.ts`
- **Acceptance criteria:**
  - CT form compilation test added alongside existing CA/MA/MD/NJ/PA/VA/DC/NC tests
  - Generated PDF is non-empty and correct page count
- **Test:** `npm test -- tests/forms/stateCompiler`

### STATE-GAP-034  Add QW/MFS/HOH filing-status tests for undertested states
- **Severity:** P2
- **Scope:** `tests/rules/ct/`, `tests/rules/dc/`, `tests/rules/ga/`, `tests/rules/nc/`, `tests/rules/pa/`
- **Acceptance criteria:**
  - At least one test per filing status (QW, MFS, HOH) per state
  - Verify correct standard deduction and bracket selection for each
- **Test:** `npm test -- tests/rules/{ct,dc,ga,nc,pa}/`

---

## Group D — UX Polish & Accessibility

### STATE-GAP-040  Fix state review step completion tracking
- **Severity:** P2
- **Scope:** `src/interview/steps.ts` (line 57)
- **Acceptance criteria:**
  - `isComplete` returns `true` when state compute result exists without errors
  - Sidebar shows check mark after state review step visited and computation succeeded
  - Other `isComplete: () => false` at lines 280, 291 reviewed for same issue
- **Test:** `npm test -- tests/interview/` + manual: visit state review → sidebar updates

### STATE-GAP-041  Add accessibility attributes to StateReturnsPage
- **Severity:** P2
- **Scope:** `src/ui/pages/StateReturnsPage.tsx`
- **Acceptance criteria:**
  - All `<label>` elements have `htmlFor` matching input `id`
  - Housing-type fieldset (NJ) has `aria-describedby` linking to help text
  - Disabled residency options have `aria-disabled="true"` and visible "(coming soon)" text
- **Test:** manual: axe-core or Lighthouse accessibility audit; keyboard navigation works

### STATE-GAP-042  Show part-year apportionment ratio in UI
- **Severity:** P2
- **Scope:** `src/ui/pages/StateReturnsPage.tsx`
- **Acceptance criteria:**
  - When part-year dates are entered, display computed ratio (e.g., "182 / 365 = 49.9%")
  - Ratio updates live as dates change
  - Display below the move-out date input
- **Test:** manual: enter part-year dates → ratio appears and updates

---

## Dependency map

```
Independent (run in parallel):
  Group A (UI inputs)  ─┐
  Group B (rules)       ├─ all independent of each other
  Group C (tests)       │  (C depends on B for new-scenario tests)
  Group D (UX polish)  ─┘

Within Group B:
  STATE-GAP-018 (extract apportionment) should land BEFORE
    STATE-GAP-010 (CT part-year) and STATE-GAP-012 (PA source)
    so they import from the shared utility.

Within Group C:
  STATE-GAP-030/031/032 can start immediately for existing behavior.
  New-scenario tests (e.g., CT part-year) depend on corresponding B tasks.
  STATE-GAP-034 is independent.
```

## Quick reference

| ID | Sev | Group | State | Summary |
|----|-----|-------|-------|---------|
| 001 | P0 | A | MD | Add county selector |
| 002 | P0 | A | MA | Add rent-amount input |
| 003 | P0 | A | PA | Add §529 contribution input |
| 004 | P0 | A | NJ | Add college-student dependent selector |
| 010 | P1 | B | CT | Implement part-year apportionment |
| 011 | P1 | B | NJ | Gate part-year until NJ-1040NR ready |
| 012 | P1 | B | PA | Fix nonresident source apportionment |
| 013 | P1 | B | CA | Disable nonresident until CA-source modeled |
| 014 | P1 | B | NC | Implement NC additions/deductions |
| 015 | P1 | B | MA | Implement MA EITC |
| 016 | P1 | B | CT | Fix qualifying-child detection |
| 017 | P1 | B | PA | Add §529 per-beneficiary validation |
| 018 | P2 | B | All | Extract shared apportionment utility |
| 019 | P2 | B | GA | Implement retirement exclusion |
| 020 | P2 | B | VA | Implement age deduction improvements |
| 030 | P2 | C | CT | Expand test suite |
| 031 | P2 | C | DC | Expand test suite |
| 032 | P2 | C | NC | Expand test suite |
| 033 | P2 | C | CT | Add form compilation test |
| 034 | P2 | C | Multi | Add QW/MFS/HOH filing-status tests |
| 040 | P2 | D | All | Fix review step completion tracking |
| 041 | P2 | D | All | Add a11y attributes to StateReturnsPage |
| 042 | P2 | D | All | Show apportionment ratio in UI |
