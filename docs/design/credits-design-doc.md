# OpenTax — Tax Credits Design Document

> **Status**: Proposed
> **Date**: 2026-02-18
> **Scope**: Tax year 2025 (returns filed in 2026)
> **Prerequisite**: Phase 2 complete — rules engine, guided interview, PDF compiler, explainability traces

---

## Overview

Tax credits reduce tax liability directly (unlike deductions, which reduce taxable income). OpenTax currently skips Form 1040 Lines 19–23 (non-refundable credits) and Lines 27–32 (refundable credits) entirely. This document describes a phased plan to implement the most impactful credits.

### Current gaps in Form 1040 computation

```
Line 16  Tax                        ✓ Computed
Line 17  Schedule 2 taxes           ✗ Skipped ($0)
Line 18  Sum of 16 + 17             ✗ Skipped (= Line 16)
Line 19  Child Tax Credit            ✗ MISSING
Line 20  Schedule 3, Line 8         ✗ MISSING (other non-refundable credits)
Line 21  Sum of 19 + 20             ✗ MISSING
Line 22  Line 18 − Line 21          ✗ MISSING (tax after credits)
Line 23  Other taxes (Sch 2, Ln 21) ✗ Skipped ($0)
Line 24  Total tax (22 + 23)        ✓ Computed (currently = Line 16, wrong)
Line 25  Federal withholding         ✓ Computed
Line 27  Earned Income Credit        ✗ MISSING
Line 28  Additional Child Tax Credit ✗ MISSING
Line 29  American Opportunity Credit ✗ MISSING
Line 31  Other refundable credits    ✗ MISSING
Line 32  Sum of 27–31               ✗ MISSING
Line 33  Total payments (25 + 32)    ✓ Computed (currently = Line 25, wrong)
```

### Layers touched per credit

Each credit requires changes across all layers:

| Layer | Work |
|-------|------|
| **Model** (`types.ts`) | Add typed credit fields to `TaxReturn` or `Dependent` |
| **Rules** (`src/rules/2025/`) | New compute function per credit + phase-out logic |
| **Engine** (`engine.ts`) | Register credit nodes for trace/explainability |
| **Form 1040** (`form1040.ts`) | Wire Lines 18–24 and 27–33 properly |
| **PDF** (`form1040Fields.ts`, `form1040Filler.ts`) | Map and fill credit line fields |
| **UI** (`src/ui/pages/`) | New interview page(s) for credit data entry |
| **Interview** (`steps.ts`) | Insert credits step between Deductions and Review |
| **Store** (`taxStore.ts`) | Add mutations for credit-related state |
| **Tests** | Unit tests for each credit's computation + phase-outs |

---

## Phase 1 — Child Tax Credit (CTC + Additional CTC)

**Why first**: Most common credit. Already have dependent data. High impact for target users with kids.

### IRS rules (2025)

- **$2,000 per qualifying child** under age 17 at end of tax year
- **$500 credit** for other dependents (not qualifying children)
- Phase-out: credit reduces by $50 for every $1,000 of AGI over threshold
  - Single / HoH: $200,000
  - MFJ: $400,000
- Non-refundable portion capped at tax liability (Line 18)
- Refundable portion (Additional CTC, Line 28): up to $1,700 per child, computed via Form 8812

### Model changes

```typescript
// Extend Dependent with age qualification
export interface Dependent {
  // ... existing fields ...
  dateOfBirth: string        // ISO date — needed to determine if under 17
  qualifiesForCTC: boolean   // derived: under 17 + relationship + SSN
}
```

### Rules: `src/rules/2025/childTaxCredit.ts`

1. Count qualifying children (under 17, valid SSN, lived with taxpayer 6+ months)
2. Count other dependents (everyone else)
3. Compute initial credit: `(qualifyingChildren × $2,000) + (otherDependents × $500)`
4. Apply AGI phase-out
5. Split into non-refundable (Line 19, capped at Line 18) and refundable (Line 28, via Form 8812 worksheet)

### Form 1040 integration

- Fix `computeLine24`: `Line 18 − Line 21 + Line 23` (not just `= Line 16`)
- Fix `computeLine33`: `Line 25 + Line 32` (not just `= Line 25`)
- Add `line18`, `line19`, `line21`, `line22`, `line28`, `line32` to `Form1040Result`

### UI: CreditsPage (or extend DependentsPage)

- Auto-compute from dependent data — show calculated CTC amount
- Display phase-out warning if near AGI threshold
- No new data entry needed if `dateOfBirth` is already collected on DependentsPage

### PDF

- Fill Line 19 (field already mapped), add mappings for Lines 20–22, 28, 32

### Tests

- Family with 2 qualifying children, AGI below threshold → full $4,000 CTC
- AGI in phase-out range → reduced credit
- Tax liability less than CTC → Additional CTC (refundable) kicks in
- Dependent over 17 → $500 other dependent credit only
- MFS → lower phase-out threshold

---

## Phase 2 — Earned Income Credit (EITC)

**Why second**: Largest refundable credit for low/mid-income filers. Significant refund impact.

### IRS rules (2025)

- Credit based on earned income + number of qualifying children
- Maximum credit (2025 estimates):
  - 0 children: ~$632
  - 1 child: ~$4,213
  - 2 children: ~$6,960
  - 3+ children: ~$7,830
- Investment income limit: ~$11,600
- Not available for MFS filers
- Phase-in and phase-out ranges vary by filing status and child count

### Model changes

```typescript
// No new model fields — uses existing:
// - TaxReturn.dependents (child count)
// - W2 wages (earned income)
// - form1040.line11 (AGI)
// - Investment income from 1099-INT/DIV/B
```

### Rules: `src/rules/2025/earnedIncomeCredit.ts`

1. Check eligibility: not MFS, investment income under limit, valid SSN
2. Compute earned income (W-2 wages + self-employment, minus SE tax deduction)
3. Lookup credit from IRS EIC table (or piecewise linear formula: phase-in rate × income, plateau, phase-out rate × income)
4. Compare credit at earned income vs. credit at AGI — take the smaller

### Form 1040 integration

- Populate Line 27 (EITC amount)
- Feeds into Line 32 → Line 33

### UI

- Auto-computed — no additional user input needed
- Show eligibility status and computed amount on CreditsPage
- If MFS, display "EITC not available for Married Filing Separately"

### Supporting form: Schedule EIC

- Required if claiming EITC with qualifying children
- Lists child name, SSN, year of birth, relationship, months lived
- Data already available from `TaxReturn.dependents`

### Tests

- Single filer, 1 child, income in phase-in range → partial credit
- MFJ, 2 children, income in plateau → max credit
- Investment income exceeds limit → disqualified
- MFS → disqualified
- No children, low income → small credit

---

## Phase 3 — Education Credits (AOTC + LLC)

**Why third**: Common for filers with college-age dependents or continuing education.

### IRS rules (2025)

**American Opportunity Tax Credit (AOTC)**:
- Up to $2,500 per eligible student (first 4 years of post-secondary)
- 100% of first $2,000 + 25% of next $2,000 in qualified expenses
- 40% refundable ($1,000 max), 60% non-refundable
- Phase-out: MAGI $80K–$90K (single), $160K–$180K (MFJ)

**Lifetime Learning Credit (LLC)**:
- Up to $2,000 per return (20% of first $10,000 in expenses)
- Non-refundable only
- Phase-out: MAGI $80K–$90K (single), $160K–$180K (MFJ)
- Cannot claim both AOTC and LLC for the same student

### Model changes

```typescript
export interface Form1098T {
  id: string
  studentName: string
  studentSSN: string
  institution: string
  box1: number    // payments received for qualified tuition (cents)
  box5: number    // scholarships/grants (cents)
}

export interface EducationCredit {
  studentId: string        // links to dependent or taxpayer
  creditType: 'aotc' | 'llc'
  qualifiedExpenses: number  // cents — tuition + required fees + books (AOTC)
}

// Add to TaxReturn:
//   form1098Ts: Form1098T[]
//   educationCredits: EducationCredit[]
```

### Rules: `src/rules/2025/educationCredits.ts`

1. For each student, determine AOTC vs LLC eligibility
2. Compute qualified expenses (1098-T Box 1 minus Box 5, plus books if AOTC)
3. Apply per-student credit formula
4. Apply AGI phase-out
5. Split AOTC: 60% non-refundable (Line 20 via Schedule 3), 40% refundable (Line 29)

### UI: EducationPage

- Input: 1098-T data (PDF upload or manual)
- Per-student: select AOTC vs LLC, enter additional qualified expenses
- Show calculated credit per student

### Supporting form: Form 8863

- Part III: student information
- Part II: AOTC calculation
- Part I: LLC calculation
- Generates amounts for Form 1040 Lines 20 and 29

### Tests

- 1 student, $4,000 expenses → $2,500 AOTC ($1,500 non-refundable + $1,000 refundable)
- AGI in phase-out → proportional reduction
- 2 students, one AOTC + one LLC → combined credits
- 5th year student → AOTC ineligible, LLC only

---

## Phase 4 — Other Common Credits

Lower frequency but straightforward to implement once the credit infrastructure exists.

### 4a. Child and Dependent Care Credit (Form 2441)

- Up to $3,000 expenses for 1 dependent, $6,000 for 2+
- Credit rate: 20–35% of expenses (based on AGI)
- Non-refundable
- **Model**: add `dependentCareExpenses` to `TaxReturn`
- **UI**: input care provider info + expenses on CreditsPage

### 4b. Saver's Credit (Form 8880)

- Credit for retirement contributions (401k, IRA)
- 10–50% of contributions up to $2,000 ($4,000 MFJ)
- AGI limits: $38,250 (single), $76,500 (MFJ) for 2025
- Non-refundable
- **Model**: retirement contributions already available from W-2 Box 12 codes D/E/G
- **UI**: auto-computed, display only

### 4c. Residential Clean Energy Credit (Form 5695)

- 30% of qualified energy improvements (solar, battery, heat pumps)
- No income phase-out, no maximum (for solar)
- Non-refundable, carryforward allowed
- **Model**: add `energyImprovements` array to `TaxReturn`
- **UI**: input type of improvement + cost

---

## Implementation Order

```
Phase 1 (CTC)         ──→  Phase 2 (EITC)         ──→  Phase 3 (Education)  ──→  Phase 4 (Other)
├─ dateOfBirth on          ├─ EIC table/formula         ├─ Form 1098-T model      ├─ Form 2441
│  Dependent               ├─ Schedule EIC              ├─ Form 8863              ├─ Form 8880
├─ Form 8812 logic         ├─ MFS guard                 ├─ EducationPage UI       ├─ Form 5695
├─ Fix Lines 18–24         └─ Auto-compute on           └─ AOTC/LLC split
├─ Fix Lines 28, 32–33        CreditsPage
├─ CreditsPage UI
└─ PDF field mappings

Shared prerequisite (do once in Phase 1):
  • Wire Form 1040 Lines 18–24 and 27–33 correctly
  • Add credit nodes to engine trace
  • Add CreditsPage to interview steps
  • Add credit mutations to taxStore
```

Each subsequent phase only adds a new rule file + UI section — the plumbing is done in Phase 1.
