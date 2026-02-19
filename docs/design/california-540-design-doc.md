# OpenTax — California Form 540 Design Document

> **Status**: Proposed
> **Date**: 2026-02-19
> **Scope**: Tax year 2025 (returns filed in 2026)
> **Prerequisite**: Federal Form 1040 computation complete
> **Source**: FTB 2025 Form 540 Instructions, Schedule CA (540) Instructions, Tax Rate Schedules

---

## Overview

California is the most common state return for our target user (tech employee with W-2 + stock income). CA taxes all income at ordinary rates (no preferential LTCG rate), starts from federal AGI, applies CA-specific adjustments, and uses its own 9-bracket progressive rate schedule plus a 1% mental health surcharge above $1M.

### What already exists in our model

| Data | Source | Status |
|------|--------|--------|
| W-2 Box 15 (state code) | `W2.box15State` | Captured in model, UI, OCR |
| W-2 Box 16 (state wages) | `W2.box16StateWages` | Captured |
| W-2 Box 17 (state tax withheld) | `W2.box17StateIncomeTax` | Captured |
| Federal AGI (Line 11) | `Form1040Result.line11` | Computed |
| Itemized deductions detail | `ScheduleAResult` | Computed |
| Capital gains/losses | `ScheduleDResult` | Computed |
| IRA deduction | `IRADeductionResult` | Computed |
| HSA deduction | `HSAResult` | Computed |
| Student loan interest | `StudentLoanDeductionResult` | Computed |

### What's missing

- CA tax bracket constants
- CA standard deduction / personal exemption credit constants
- Schedule CA adjustment logic (additions/subtractions from federal AGI)
- Form 540 computation engine
- State withholding on 1099 forms (not captured today)
- CA-specific credits (CalEITC, renter's credit)
- Form 540 PDF filler

---

## Architecture

CA computation sits **downstream** of the federal computation — it consumes `Form1040Result` and produces `Form540Result`.

```
TaxReturn model
    |
    v
computeForm1040(model)  -->  Form1040Result
    |                            |
    v                            v
computeForm540(model, form1040Result)  -->  Form540Result
    |
    v
PDF compiler: fillForm1040() + fillForm540()
```

### File structure

```
src/rules/2025/ca/
  constants.ts          -- CA brackets, standard deduction, credits
  form540.ts            -- Main orchestrator (parallel to form1040.ts)
  scheduleCA.ts         -- Federal-to-CA adjustments
  caCredits.ts          -- Personal exemption, CalEITC, renter's credit

tests/rules/ca/
  form540.test.ts
  scheduleCA.test.ts
  caCredits.test.ts

src/forms/fillers/
  form540Filler.ts      -- PDF field mapping
```

---

## Phase 1 — CA Tax Computation (Core)

### 1a. Constants: `src/rules/2025/ca/constants.ts`

**Source**: FTB 2025 Tax Rate Schedules (Rev. Proc. 2024-40 CA equivalent)

```typescript
// All amounts in cents via c() helper

// ── Standard Deduction ──────────────────────────────────────
export const CA_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: c(5706),
  mfj:    c(11412),
  mfs:    c(5706),
  hoh:    c(11412),
  qw:     c(11412),
}

// ── Tax Brackets (9 brackets: 1% - 12.3%) ──────────────────
// Schedule X: Single / MFS
// Schedule Y: MFJ / QW
// Schedule Z: HOH

export const CA_TAX_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { rate: 0.01, floor: c(0) },
    { rate: 0.02, floor: c(11079) },
    { rate: 0.04, floor: c(26264) },
    { rate: 0.06, floor: c(41452) },
    { rate: 0.08, floor: c(57542) },
    { rate: 0.093, floor: c(72724) },
    { rate: 0.103, floor: c(371479) },
    { rate: 0.113, floor: c(445771) },
    { rate: 0.123, floor: c(742953) },
  ],
  mfs: [/* same as single */],
  mfj: [
    { rate: 0.01, floor: c(0) },
    { rate: 0.02, floor: c(22158) },
    { rate: 0.04, floor: c(52528) },
    { rate: 0.06, floor: c(82904) },
    { rate: 0.08, floor: c(115084) },
    { rate: 0.093, floor: c(145448) },
    { rate: 0.103, floor: c(742958) },
    { rate: 0.113, floor: c(891542) },
    { rate: 0.123, floor: c(1485906) },
  ],
  qw: [/* same as MFJ */],
  hoh: [
    { rate: 0.01, floor: c(0) },
    { rate: 0.02, floor: c(22173) },
    { rate: 0.04, floor: c(52530) },
    { rate: 0.06, floor: c(67716) },
    { rate: 0.08, floor: c(83805) },
    { rate: 0.093, floor: c(98990) },
    { rate: 0.103, floor: c(505208) },
    { rate: 0.113, floor: c(606251) },
    { rate: 0.123, floor: c(1010417) },
  ],
}

// ── Mental Health Services Tax ──────────────────────────────
// 1% surcharge on taxable income > $1M (all filing statuses)
export const CA_MENTAL_HEALTH_THRESHOLD = c(1000000)
export const CA_MENTAL_HEALTH_RATE = 0.01

// ── Personal Exemption Credits ──────────────────────────────
export const CA_PERSONAL_EXEMPTION_CREDIT = c(153)    // per person
export const CA_DEPENDENT_EXEMPTION_CREDIT = c(475)   // per dependent

export const CA_EXEMPTION_PHASEOUT: Record<FilingStatus, number> = {
  single: c(252203),
  mfs:    c(252203),
  mfj:    c(504411),
  qw:     c(504411),
  hoh:    c(378310),
}

// ── Renter's Credit ─────────────────────────────────────────
export const CA_RENTERS_CREDIT: Record<'single_mfs' | 'other', {
  credit: number; agiLimit: number
}> = {
  single_mfs: { credit: c(60),  agiLimit: c(53994) },
  other:      { credit: c(120), agiLimit: c(107987) },
}
```

### 1b. Schedule CA Adjustments: `src/rules/2025/ca/scheduleCA.ts`

Computes CA AGI from federal AGI by applying additions and subtractions.

**Key adjustments for our target user (W-2 + investments):**

| Adjustment | Direction | Reason | Priority |
|------------|-----------|--------|----------|
| HSA deduction | Addition | CA doesn't recognize IRC §223. Add back federal HSA deduction. | Phase 1 |
| State tax refund | Subtraction | If included in federal income, subtract (CA doesn't tax its own refund) | Phase 2 |
| Social Security | Subtraction | CA fully excludes SS benefits | Phase 2 (no SSA-1099 yet) |
| Educator expenses | Addition | CA doesn't allow $300 federal deduction | Phase 2 (not implemented federally) |

**Phase 1 scope** — Only the HSA add-back matters for our target user. Most W-2 tech employees with stock income have no other CA adjustments.

```typescript
export interface ScheduleCAResult {
  federalAGI: number            // cents — Form 1040 Line 11
  additions: number             // cents — Column B total
  subtractions: number          // cents — Column C total
  caAGI: number                 // cents — federal AGI + additions - subtractions

  // Detail
  hsaAddBack: number            // cents — HSA deduction added back
}

export function computeScheduleCA(
  form1040: Form1040Result,
): ScheduleCAResult
```

### 1c. Form 540 Orchestrator: `src/rules/2025/ca/form540.ts`

```typescript
export interface Form540Result {
  // Income
  federalAGI: number              // Line 13 — from Form 1040 Line 11
  caAdjustments: ScheduleCAResult // Schedule CA
  caAGI: number                   // Line 17

  // Deductions
  caStandardDeduction: number     // Line 18
  caItemizedDeduction: number     // Line 18 (if itemized)
  deductionUsed: number           // max(standard, itemized)
  deductionMethod: 'standard' | 'itemized'

  // Tax
  caTaxableIncome: number         // Line 19 = caAGI - deduction
  caTax: number                   // Line 31 — from bracket computation
  mentalHealthTax: number         // Line 36 — 1% on income > $1M
  totalTax: number                // Line 35 + Line 36

  // Credits
  personalExemptionCredit: number // Line 32
  dependentExemptionCredit: number
  exemptionPhaseOutReduction: number
  totalExemptionCredits: number   // Line 32 after phase-out
  rentersCredit: number           // Line 46

  // Payments
  stateWithholding: number        // Line 71 — sum of W-2 Box 17
  totalPayments: number           // Line 77

  // Result
  taxAfterCredits: number         // Line 48
  overpaid: number                // Line 93 (refund)
  amountOwed: number              // Line 97
}
```

**Form 540 line-by-line computation:**

```
Line 13:  Federal AGI (from Form 1040 Line 11)
Line 14:  CA adjustments — additions (Schedule CA Column B)
Line 15:  Subtotal (Line 13 + Line 14)
Line 16:  CA adjustments — subtractions (Schedule CA Column C)
Line 17:  CA AGI (Line 15 - Line 16)
Line 18:  CA standard deduction OR CA itemized deductions
Line 19:  CA taxable income = max(0, Line 17 - Line 18)

Line 31:  CA tax (from tax table if ≤ $100K, else bracket computation)
Line 32:  Exemption credits
Line 33:  Tax minus exemption credits = max(0, Line 31 - Line 32)
Line 35:  Net tax (after all non-refundable credits)
Line 36:  Mental health services tax (1% on income > $1M)

Line 46:  Renter's credit (nonrefundable)
Line 48:  Tax after credits

Line 71:  State income tax withheld (W-2 Box 17)
Line 77:  Total payments

Line 93:  Overpaid (refund)
Line 97:  Amount you owe
```

### 1d. CA Itemized Deductions

CA itemized deductions differ from federal in important ways:

| Deduction | Federal | CA |
|-----------|---------|-----|
| **State income tax** | Deductible (SALT cap applies) | **Not deductible** (can't deduct CA tax from CA tax) |
| **SDI** | Deductible as SALT | **Not deductible** |
| **SALT cap** | $40,000 ($20K MFS) | **No cap** — but state taxes excluded |
| **Mortgage interest** | $750K limit (post-TCJA) | **$1M limit** (CA didn't conform to TCJA) |
| **Home equity interest** | Not deductible (TCJA suspended) | **Deductible** (up to $100K, CA didn't conform) |
| **Medical** | 7.5% AGI floor | 7.5% AGI floor (same) |
| **Charitable** | Same limits | Same limits |

**Phase 1 implementation**: Start from federal Schedule A values, then:
1. Remove state income tax and SDI from SALT (Line 5a subtraction)
2. Keep real estate + personal property taxes (no cap)
3. If mortgage principal > $750K but ≤ $1M, recalculate interest deduction with $1M limit
4. Use CA AGI (not federal AGI) for medical floor calculation

---

## Phase 2 — Credits

### 2a. CalEITC (Form FTB 3514)

Refundable state EITC for low-income filers.

| Children | Max CalEITC | Max Earned Income |
|----------|-------------|-------------------|
| 0 | $302 | $32,900 |
| 1 | $2,016 | $32,900 |
| 2 | $3,339 | $32,900 |
| 3+ | $3,756 | $32,900 |

Also includes Young Child Tax Credit ($1,189 per qualifying child under 6) and Foster Youth Tax Credit.

### 2b. CA Child and Dependent Care Credit (Form FTB 3506)

- Percentage of federal credit amount
- Federal AGI must be $100,000 or less
- Care must be provided in California
- Nonrefundable

### 2c. Other Credits (lower priority)

- CA 529 credit
- CA film/TV production credit
- CA research credit

---

## Phase 3 — State Withholding on 1099s

Currently 1099-INT, 1099-DIV, and 1099-MISC don't capture state withholding. Need to add optional fields:

```typescript
// Add to Form1099INT, Form1099DIV, Form1099MISC:
  stateWithheld?: number    // cents — state income tax withheld
  stateCode?: string        // 2-letter state code
```

For Phase 1, state withholding comes only from W-2 Box 17 (the most common case). 1099 state withholding is a Phase 3 enhancement.

---

## Model Changes

### `src/model/types.ts`

```typescript
// Add to TaxReturn:
  caResident?: boolean              // true if CA resident for full year
  rentPaidInCA?: boolean            // for renter's credit
```

No new data entry forms needed — CA computation derives from federal data plus these two flags.

---

## Engine Integration

### `src/rules/engine.ts`

Add CA nodes to `NODE_LABELS`:

```typescript
// Form 540
'form540.caAGI': 'California adjusted gross income',
'form540.caTaxableIncome': 'California taxable income',
'form540.caTax': 'California tax',
'form540.mentalHealthTax': 'Mental health services tax (1%)',
'form540.exemptionCredits': 'CA exemption credits',
'form540.rentersCredit': 'CA renter\'s credit',
'form540.stateWithholding': 'CA state income tax withheld',
'form540.overpaid': 'CA overpaid (refund)',
'form540.amountOwed': 'CA amount you owe',

// Schedule CA
'scheduleCA.hsaAddBack': 'HSA deduction add-back (CA)',
'scheduleCA.additions': 'CA income additions',
'scheduleCA.subtractions': 'CA income subtractions',
```

Update `computeAll()` to optionally run CA computation and merge CA values into the trace map.

---

## Test Plan

### Unit tests: `tests/rules/ca/form540.test.ts`

**Basic scenarios (~20 tests):**
- Single, $75K wages, standard deduction → CA tax + federal tax
- MFJ, $120K combined wages → MFJ brackets
- Single, $50K wages → verify against FTB tax table
- Zero income → $0 CA tax
- Deduction exceeds income → $0 taxable, $0 tax

**Bracket boundary tests:**
- Income at each bracket threshold → correct rate applied
- Income $1 over $1M → mental health tax kicks in ($0.01 surcharge)
- Income $999,999 → no mental health tax

**Adjustment tests:**
- HSA deduction add-back → CA AGI > federal AGI
- No HSA → CA AGI = federal AGI

**Credit tests:**
- Personal exemption credit for single ($153), MFJ ($306)
- Dependent exemption ($475 per dependent)
- Exemption phase-out at threshold
- Renter's credit: under AGI limit → credit; over → $0
- Renter's credit: not a renter → $0

**Itemized deduction tests:**
- Federal itemized with $18K SALT → CA removes state tax portion, keeps property tax
- Mortgage $800K (over federal $750K limit, under CA $1M limit) → CA allows full interest
- Medical expenses with CA AGI floor (different from federal AGI floor)

**Integration tests:**
- Full return: W-2 $150K, state withholding $8K → verify CA refund/owed
- Tech employee: $200K wages + $50K LTCG → CA taxes LTCG at ordinary rates
- High earner: $1.5M income → mental health tax applies

**Withholding tests:**
- Sum of multiple W-2 Box 17 values
- No state withholding → owes full tax

---

## Implementation Order

```
Phase 1 (Core — enables CA filing for W-2 employees)
  1. CA constants (brackets, deductions, exemptions)
  2. Schedule CA adjustments (HSA add-back only)
  3. CA itemized deduction adjustments (SALT, mortgage)
  4. Form 540 computation (tax + credits + withholding → refund/owed)
  5. Engine integration (trace nodes)
  6. UI: CA resident flag + renter flag (2 checkboxes on FilingStatusPage)
  7. Tests

Phase 2 (Credits)
  8. CalEITC (refundable)
  9. CA dependent care credit
  10. PDF filler for Form 540

Phase 3 (Completeness)
  11. State withholding on 1099s (model + UI + OCR)
  12. Full Schedule CA adjustments (Social Security, educator, etc.)
  13. Estimated tax payments (CA Form 540-ES)
```

### Estimated scope

| Phase | Files | Tests | Effort |
|-------|-------|-------|--------|
| Phase 1 | 5 new, 3 modified | ~30 | Medium |
| Phase 2 | 2 new, 1 modified | ~15 | Small |
| Phase 3 | 3 modified | ~10 | Small |

---

## Key Design Decisions

1. **CA computation is downstream of federal** — no circular dependency. `computeForm540()` takes `Form1040Result` as input.

2. **CA LTCG at ordinary rates** — no QDCG worksheet needed for CA. Simplifies computation significantly.

3. **Reuse federal bracket computation** — our `computeOrdinaryTax()` function works with any bracket table. Pass CA brackets instead of federal brackets.

4. **Phase 1 covers 90%+ of target users** — a CA-resident W-2 employee with standard deduction or itemized (with state tax removal) and no Social Security income has no Schedule CA adjustments beyond HSA.

5. **Two new user inputs only** — `caResident` and `rentPaidInCA`. Everything else derives from existing federal data.

---

## Out of Scope

- **Non-resident / part-year resident** returns (Form 540NR) — requires income apportionment
- **CA Schedule D** — not needed since CA taxes all gains at ordinary rates
- **CA business credits** — enterprise-level, not for target user
- **CA estimated tax penalty** (Form FTB 5805)
- **Other state returns** — this doc covers CA only; future docs for NY, TX (no-op), WA (no-op), etc.
