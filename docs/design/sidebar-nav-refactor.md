# Sidebar Navigation Refactor

**Status:** Draft
**Author:** Agent 1
**Date:** 2025-02-24

---

## Problem

The left sidebar currently shows **24-35 steps** at once. The income section alone has 13 items, most of which don't apply to a typical filer. A W-2 employee with no investments, no rental properties, and no business income still sees "Rental Income", "Business Income", "K-1 Income", "ISO Exercises", etc. This makes the interview feel overwhelming and the sidebar difficult to scan.

### Current step counts

| Section | Steps | Always visible |
|---|---|---|
| Getting Started | 7 (6 + spouse if MFJ) | 6 |
| Income | 13 (12 + RSU if applicable) | 12 |
| Deductions & Credits | 3 | 3 |
| Review | 1 federal + 0-11 state | 1 |
| Download | 1 | 1 |
| **Total** | **25-35** | **23** |

A first-time user lands on the sidebar and sees 23+ nav items before entering any data. That's the core UX problem.

---

## Design Goals

1. **Reduce visible steps to ~10 by default** - only show what applies to the user
2. **Opt-in income types** - add an "Income Sources" checklist step where the user selects which income types they have; only checked types appear in the sidebar
3. **Reorder by prevalence** - most common income types appear first in the checklist and in the sidebar
4. **Keep it simple** - no collapsible sections, no nested nav; just show/hide steps based on user selections
5. **Non-destructive** - unchecking an income type hides the step but preserves any entered data
6. **No regression** - existing interview flow, completion logic, and navigation (Back/Next) continue to work

---

## Proposed Changes

### 1. New `incomeSources` field on TaxReturn

Add an opt-in checklist field to the TaxReturn model:

```typescript
// src/model/types.ts
export type IncomeSourceId =
  | 'w2'            // W-2 wages (most common, checked by default)
  | 'interest'      // 1099-INT
  | 'dividends'     // 1099-DIV
  | 'unemployment'  // 1099-G
  | 'retirement'    // 1099-R, IRA, pension
  | 'stocks'        // 1099-B, capital gains
  | 'rsu'           // RSU vest events
  | 'iso'           // ISO / stock option exercises
  | 'rental'        // Schedule E rental properties
  | 'business'      // Schedule C self-employment
  | 'k1'            // Schedule K-1 (partnership, S-Corp, trust)
  | 'other'         // Other/misc income (prizes, jury duty, etc.)

interface TaxReturn {
  // ... existing fields ...
  incomeSources: IncomeSourceId[]   // user-selected income types
}
```

Default value in `emptyTaxReturn()`: `['w2']` (W-2 is pre-checked since ~85% of filers have wage income).

### 2. New "Income Sources" step (replaces showing all income steps upfront)

Add a new step in the **Getting Started** section called **"Income Sources"**. This step shows a checklist of income types the user can toggle. It replaces the current pattern where all 13 income steps are always visible.

**Checklist layout (ordered by prevalence):**

```
What income did you receive in 2025?
Check all that apply.

[x] W-2 wages or salary
[ ] Interest income (1099-INT)
[ ] Dividend income (1099-DIV)
[ ] Retirement / pension / IRA (1099-R)
[ ] Unemployment compensation (1099-G)
[ ] Stock sales / capital gains (1099-B)
[ ] Other income (prizes, awards, jury duty, gambling)
-------- Less common --------
[ ] RSU vest events
[ ] ISO / stock option exercises
[ ] Rental property income (Schedule E)
[ ] Self-employment / business income (Schedule C)
[ ] Partnership / S-Corp / Trust K-1 income
```

The separator line ("Less common") provides a visual hint without hiding options.

### 3. Visibility rules update in steps.ts

Each income step's `isVisible` changes from `() => true` to checking `incomeSources`:

```typescript
// Before:
{ id: 'rental-income', isVisible: () => true, ... }

// After:
{ id: 'rental-income', isVisible: (tr) => tr.incomeSources.includes('rental'), ... }
```

Full mapping:

| Step ID | Shown when `incomeSources` contains |
|---|---|
| `w2-income` | `'w2'` |
| `interest-income` | `'interest'` |
| `dividend-income` | `'dividends'` |
| `misc-income` | `'other'` |
| `1099g-income` | `'unemployment'` |
| `retirement-income` | `'retirement'` |
| `rental-income` | `'rental'` |
| `stock-sales` | `'stocks'` |
| `rsu-income` | `'rsu'` AND existing RSU/W-2 Box 12 logic |
| `iso-exercises` | `'iso'` |
| `schedule-c` | `'business'` |
| `schedule-k1` | `'k1'` |

### 4. Auto-detection (smart defaults)

When the user enters data that implies an income source, auto-add it to `incomeSources` so the step appears without requiring manual checklist toggling:

| Trigger | Auto-adds |
|---|---|
| W-2 added | `'w2'` (already default) |
| W-2 Box 12 code V present | `'rsu'` |
| `rsuVestEvents.length > 0` | `'rsu'` |
| `form1099Bs.length > 0` or CSV upload of stock sales | `'stocks'` |
| `scheduleEProperties.length > 0` | `'rental'` |
| `scheduleCBusinesses.length > 0` | `'business'` |
| `k1s.length > 0` | `'k1'` |

This means: if a user imports data or previously saved data that includes rental properties, the "Rental Income" step appears automatically even if they haven't visited the Income Sources checklist.

### 5. Getting Started section reorder

Current order:
```
Welcome > Filing Status > Your Info > [Spouse] > Dependents > Prior Year > State Returns
```

Proposed order:
```
Welcome > Filing Status > Your Info > [Spouse] > Dependents > Income Sources > State Returns > Prior Year
```

Rationale:
- **Income Sources** moves up because it controls what the user sees next. Placing it right before the income section makes the flow feel natural: "tell us about yourself, then tell us what income you have, then enter each one."
- **Prior Year** moves to last in Getting Started. Most filers don't have prior-year carryforwards (AMT credit, capital loss, FTC carryover). It's still always visible but positioned where it doesn't interrupt the main flow. Power users who need it can still reach it easily.

### 6. Deductions & Credits section cleanup

The `form-1095a` (Health Insurance / 1095-A) step is currently in the "Deductions & Credits" section. This is misleading since most filers don't have marketplace insurance.

**Option A (recommended):** Add `'health-marketplace'` to the `incomeSources` checklist (rename it to "Income & Forms" or keep separate). Show `form-1095a` only when checked.

**Option B:** Keep it always visible but move it out of Deductions & Credits into its own "Health Coverage" section.

**Option C:** Gate it behind a simple yes/no on the Deductions page: "Did you get health insurance through Healthcare.gov?"

Recommendation: **Option A** - add a "Health Coverage" checkbox to the Income Sources checklist. Rename the step from "Income Sources" to "What applies to you?" to accommodate non-income items.

Updated checklist title: **"What applies to you?"**

Additional items at the bottom:
```
-------- Other forms --------
[ ] Health insurance from marketplace (1095-A)
```

### 7. Sidebar visual density

With fewer steps showing, the sidebar gets breathing room. No structural changes to `Sidebar.tsx` are needed beyond receiving fewer steps. However, two small improvements:

**a) Section step counts** - Show "2 of 3" next to each section header so the user knows progress at a glance without counting badges:

```
INCOME (2 of 3)
  [x] W-2 Income
  [ ] Interest
  [ ] Dividends
```

**b) "Edit selections" link** - Under the Income section header, show a small link back to the Income Sources checklist so the user can add/remove income types without scrolling up:

```
INCOME (1 of 2)  [edit]
  [x] W-2 Income
  [ ] Stock Sales
```

---

## Step count comparison

### Before (typical W-2 filer)

The sidebar shows **23 steps**. The user must scroll past Rental Income, ISO Exercises, Business Income, and K-1 Income even though none apply.

### After (same W-2 filer, checks only "W-2 wages")

| Section | Steps |
|---|---|
| Getting Started | 7 (Welcome, Filing Status, Your Info, Dependents, What Applies, State Returns, Prior Year) |
| Income | 1 (W-2 Income) |
| Deductions & Credits | 2 (Deductions, Credits) |
| Review | 1 (Federal Review) |
| Download | 1 |
| **Total** | **12** |

### After (complex filer: W-2 + stocks + rental + K-1 + CA state)

| Section | Steps |
|---|---|
| Getting Started | 7 |
| Income | 4 (W-2, Stock Sales, Rental Income, K-1 Income) |
| Deductions & Credits | 2 |
| Review | 2 (Federal + CA) |
| Download | 1 |
| **Total** | **16** |

---

## Files to modify

| File | Change |
|---|---|
| `src/model/types.ts` | Add `IncomeSourceId` type, add `incomeSources` field to `TaxReturn`, update `emptyTaxReturn()` |
| `src/interview/steps.ts` | Add "What Applies" step, update `isVisible` for all income steps + 1095-A, reorder Getting Started steps |
| `src/ui/pages/IncomeSourcesPage.tsx` | **New file** - checklist page component |
| `src/ui/components/Sidebar.tsx` | Optional: add section step counts and "edit" link |
| `src/store/taxStore.ts` | Auto-detection logic (sync `incomeSources` when data implies a source) |
| `tests/interview/steps.test.ts` | Update visibility tests for income steps |

---

## Migration

Existing saved returns (in IndexedDB) won't have the `incomeSources` field. The migration strategy:

1. In `emptyTaxReturn()`, default `incomeSources` to `['w2']`
2. When loading a saved return where `incomeSources` is `undefined`, run auto-detection: scan the return for non-empty W-2s, 1099-Bs, Schedule E properties, etc., and populate `incomeSources` accordingly
3. This ensures existing users who already entered stock sales see the Stock Sales step without re-checking the box

---

## Out of scope

- Collapsible sidebar sections (adds complexity without solving the root cause)
- Drag-and-drop step reordering
- Multi-page income source wizard
- Changes to the Review or Download sections
- Changes to state review step visibility (already conditional)

---

## Open questions

1. Should the "What applies to you?" step be skippable, or require at least one selection before proceeding?
2. Should we show a confirmation when unchecking an income type that has data entered (e.g., "You have 2 rental properties entered. Hide this section anyway?")?
3. Should Prior Year move into a collapsible "Advanced" area, or is reordering it to the end sufficient?
