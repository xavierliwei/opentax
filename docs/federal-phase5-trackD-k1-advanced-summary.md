# Federal Phase 5 Track D — K-1 Advanced Computation

## Overview

Closes the top K-1 computation gaps identified in Phase 4: partnership guaranteed
payments (Box 4), self-employment tax via Box 14 Code A, and a conservative
passive activity loss (PAL) guardrail for K-1 rental losses.

## Changes

### 1. Partnership Guaranteed Payments (Box 4)

**Files:** `src/model/types.ts`, `src/rules/2025/scheduleK1.ts`, `src/rules/2025/form1040.ts`

- Added optional `guaranteedPayments` field to `ScheduleK1` interface.
- Guaranteed payments are aggregated into `totalGuaranteedPayments` and included
  in `totalPassthroughIncome` (ordinary + rental + GP).
- Flow: guaranteed payments route to Schedule 1 Line 5 (as part of passthrough
  income) and are always subject to SE tax per IRC §1402(a).

### 2. Partnership SE Tax (Box 14 Code A)

**Files:** `src/model/types.ts`, `src/rules/2025/scheduleK1.ts`, `src/rules/2025/scheduleSE.ts`, `src/rules/2025/form1040.ts`

- Added optional `selfEmploymentEarnings` field to `ScheduleK1` interface.
- If provided, Box 14 Code A SE earnings are combined with Schedule C net profit
  and guaranteed payments on Schedule SE Line 2.
- Conservative approach: if `selfEmploymentEarnings` is not provided (default),
  SE tax is not computed for that K-1. This avoids overtaxing limited partners
  who are generally exempt from SE tax on ordinary income (IRC §1402(a)(13)).
- The deductible half of SE tax reduces AGI (Schedule 1, Line 15).
- Net SE earnings contribute to earned income for EIC and other credits.

### 3. K-1 Rental Loss PAL Guardrail

**Files:** `src/rules/2025/scheduleK1.ts`, `src/rules/2025/form1040.ts`

- New `computeK1RentalPAL()` function applies the IRC §469(i) $25,000 special
  allowance to K-1 rental losses, with AGI phase-out ($100K–$150K).
- The $25K allowance is shared with Schedule E Part I rental losses: whatever
  Schedule E consumes reduces the amount available for K-1 rental losses.
- MFS filing status gets $0 allowance (per IRC §469(i)(4)).
- This is a guardrail, not a full Form 8582 computation — it does not track
  basis, at-risk amounts, material participation, or loss carryforwards.
- New `K1RentalPALResult` is exposed on `Form1040Result` for transparency.

### 4. Validation Updates

**File:** `src/rules/2025/federalValidation.ts`

- `K1_RENTAL_LOSS_NO_PAL` → renamed to `K1_RENTAL_LOSS_PAL_GUARDRAIL` with
  updated message explaining the $25K guardrail.
- `K1_PARTNERSHIP_SE_NOT_COMPUTED` → now only emitted for partnerships where
  ordinary income > 0 but no Box 14 or guaranteed payments are entered.
- New `K1_PARTNERSHIP_SE_COMPUTED` info item when SE tax is computed from
  Box 14 and/or guaranteed payments.
- `K1_UNSUPPORTED_BOXES` and `SUPPORTED_SCOPE` messages updated to reflect
  newly supported Box 4, Box 14, and PAL guardrail.
- `K1_INCOME_COMPUTED` message updated to include GP and SE details when present.

### 5. UI Updates

**File:** `src/ui/pages/ScheduleK1Page.tsx`

- Added "Guaranteed payments" (Box 4) input — shown only for partnerships.
- Added "SE earnings (Box 14, Code A)" input — shown only for partnerships.
- Replaced outdated "NOT yet computed" warning banner with accurate "K-1 income
  is included in your tax computation" info banner.
- Updated income items tooltip to reflect actual computation flow.

## IRS Citations

| Feature | IRC/Form Reference |
|---|---|
| Guaranteed payments | IRC §707(c), K-1 Box 4 |
| GP subject to SE tax | IRC §1402(a) |
| Box 14 SE earnings | K-1 Box 14 Code A, Schedule SE |
| Limited partner SE exemption | IRC §1402(a)(13) |
| PAL $25K special allowance | IRC §469(i) |
| PAL AGI phase-out | IRC §469(i)(3) — $100K–$150K |
| MFS $0 PAL allowance | IRC §469(i)(4) |

## Test Coverage

30 new tests added (69 total K-1 tests, 1725 total):

- **K-1 Guaranteed Payments (4 tests):** Flow to Schedule 1 Line 5, SE tax
  computation, combined with ordinary income, S-corp exclusion.
- **K-1 Partnership SE Tax (5 tests):** Box 14 flow to Schedule SE, combined
  with GP, combined with Schedule C, limited partner exclusion, AGI deduction.
- **K-1 Rental PAL Guardrail Unit (8 tests):** Positive income pass-through,
  loss below/above $25K, AGI phaseout, MFS, shared allowance with Schedule E.
- **K-1 Rental PAL Integration (4 tests):** Form 1040 flow, shared allowance
  with Schedule E, high AGI elimination, profit pass-through.
- **K-1 Aggregate (2 tests):** New fields aggregation, backward compatibility.
- **K-1 Validation (5 tests):** SE_COMPUTED, SE_NOT_COMPUTED, unsupported boxes.
- **K-1 Full Flow (2 tests):** General partner comprehensive, limited partner.

## Modified Files

| File | Change |
|---|---|
| `src/model/types.ts` | Added `guaranteedPayments`, `selfEmploymentEarnings` to `ScheduleK1` |
| `src/rules/2025/scheduleK1.ts` | New fields in aggregate, `computeK1RentalPAL()` function |
| `src/rules/2025/scheduleSE.ts` | Accept K-1 SE earnings parameter |
| `src/rules/2025/form1040.ts` | Wire GP/SE/PAL into orchestrator |
| `src/rules/2025/federalValidation.ts` | Updated K-1 validation messages |
| `src/ui/pages/ScheduleK1Page.tsx` | GP and SE input fields, updated messaging |
| `tests/rules/k1Income.test.ts` | 30 new tests |
| `tests/ui/pages/Phase4Pages.test.tsx` | Updated UI assertions |

## Limitations (Out of Scope)

- Full Form 8582 passive activity loss computation (basis tracking, at-risk,
  material participation, loss carryforward/carryback).
- K-1 foreign taxes (Box 16), AMT items, tax-exempt income, royalties.
- Qualified dividend breakdown for K-1 dividends.
- Long Schedule SE (Section B) scenarios.
