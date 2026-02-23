# Federal Gap Closure — Phase 1 Summary

**Date:** 2026-02-22
**Tax Year:** 2025 (returns filed in 2026)
**Branch:** `feat/federal-gap-closure-phase1`

---

## What Was Implemented

### 1. Social Security Benefits (Form 1040 Lines 6a/6b)

**Data Model:**
- Added `FormSSA1099` interface to `src/model/types.ts` with fields for Box 3 (benefits paid), Box 4 (benefits repaid), Box 5 (net benefits), and Box 6 (voluntary withholding)
- Added `formSSA1099s` array to `TaxReturn` interface with `emptyTaxReturn()` factory support

**Computation (IRS Publication 915 Worksheet):**
- New module: `src/rules/2025/socialSecurityBenefits.ts`
- Implements the three-tier taxable Social Security benefits formula:
  - **Tier 0:** Combined income ≤ base amount → $0 taxable
  - **Tier 1:** Base < combined income ≤ additional amount → up to 50% taxable
  - **Tier 2:** Combined income > additional amount → up to 85% taxable
- `combinedIncome = modifiedAGI + ½ × grossBenefits`, where `modifiedAGI = AGI (excl. SS) + tax-exempt interest`
- Thresholds: Single $25K/$34K, MFJ $32K/$44K, MFS $0/$0 (worst case)
- Full traceability via `TracedValue` and `irsCitation` fields

**Form 1040 Integration:**
- `computeLine6a()` — Sums all SSA-1099 Box 5 values
- `computeLine6b()` — Taxable portion from Pub 915 worksheet
- Line 6b included in Line 9 (total income)
- SSA-1099 Box 6 withholding included in Line 25 (federal tax withheld)
- Engine trace nodes: `ssa1099:{id}:box5`, `ssa1099:{id}:box6`, `ss.grossBenefits`, `ss.taxableBenefits`

### 2. OBBBA Senior Standard Deduction Enhancement (§70104)

**New module:** `src/rules/2025/seniorDeduction.ts`

The One Big Beautiful Bill Act (signed 2025-07-04) doubled the additional standard deduction for taxpayers age 65+:
- **Single/HOH:** $4,000 per qualifying senior (was $2,000)
- **MFJ/MFS/QW:** $3,200 per qualifying senior (was $1,600)

The blind additional amount remains at the pre-OBBBA level ($2,000/$1,600).

**Integration:**
- `computeSeniorDeduction()` returns a detailed breakdown: senior count, blind count, per-person amounts, and totals
- Integrated into `computeLine12()` — replaces the old flat `additionalCount × additionalPer` with the split senior/blind calculation
- Correctly handles: single senior, MFJ both 65+, MFJ mixed (one 65+, one blind), dependent filer limitations + senior deduction, itemized-vs-standard comparison

### 3. Line 31 Refundable Credits Framework

**New module:** `src/rules/2025/refundableCredits.ts`

Extensible architecture for refundable credits flowing to Form 1040 Line 31:

**Interfaces:**
- `RefundableCreditItem` — individual credit with ID, description, amount, IRS citation
- `RefundableCreditWarning` — validation warnings for unsupported credits
- `RefundableCreditsResult` — aggregated items + total + warnings

**Implemented credit:**
- **Excess Social Security tax withholding** — When multiple employers each withhold SS tax up to the wage base ($176,100 × 6.2% = $10,918), the overage is refundable via Schedule 3

**Placeholder hooks (Phase 2):**
- Premium Tax Credit (Form 8962) — framework hook ready, emits warning when indicators detected
- Credit for undistributed capital gains (Form 2439)
- Credit for federal tax on fuels (Form 4136)

**Integration:**
- `computeLine31()` now delegates to the framework instead of returning `tracedZero()`
- Flows through Line 32 → Line 33 → refund/owed calculation
- Engine trace nodes for each credit item

### 4. Federal Validation Module

**New module:** `src/rules/2025/federalValidation.ts`

Structured validation producing `FederalValidationItem` objects with:
- Machine-readable `code` (e.g., `UNSUPPORTED_SE_TAX`)
- `severity`: info / warning / error
- User-facing `message` with actionable guidance
- `irsCitation` and `category` (unsupported / data-quality / accuracy / compliance)

**Validation checks:**
1. **SSA-1099 data quality** — negative net benefits, Box 5 mismatch
2. **MFS + SS benefits** — warns about worst-case taxability when lived together
3. **OBBBA senior deduction** — informational message when applied
4. **Dependent filer limitations** — explains standard deduction cap
5. **1099-R early withdrawal** — flags code "1" distributions
6. **Possible self-employment income** — warns on large 1099-MISC Box 3
7. **Phase 1 limitations** — lists supported and unsupported scenarios

### 5. Tests Added

**48 new tests across 4 test files:**

| Test File | Tests | Coverage |
|---|---|---|
| `socialSecurity.test.ts` | 18 | All 3 tiers × filing statuses, tax-exempt interest, MFS, MFJ couple, withholding, Form 1040 integration |
| `seniorDeduction.test.ts` | 15 | Single/MFJ/HOH/MFS, blind interaction, OBBBA doubling, dependent filer, Form 1040 integration |
| `refundableCredits.test.ts` | 8 | Single employer (no excess), multi-employer excess, 3-employer scenario, framework aggregation, Line 31 integration |
| `federalValidation.test.ts` | 7 | All validation checks: MFS+SS, negative benefits, Box 5 mismatch, senior info, dependent info, SE income, clean return |

**New test fixtures:**
- `makeSSA1099()` — SSA-1099 fixture builder
- `ssaTier1Return()`, `ssaTier2Return()` — SS benefits at different tiers
- `seniorStandardDeductionReturn()` — Single 65+ filer
- `seniorCoupleMFJReturn()` — MFJ couple, both 65+, one blind
- `excessSSWithholdingReturn()` — Multiple employers with SS over-withholding

---

## What Remains for Phase 2

### High Priority
1. **Premium Tax Credit (Form 8962)** — ACA marketplace reconciliation. Framework hook exists; full Form 8962 worksheet implementation needed. Requires adding Form 1095-A to the data model.
2. **Self-Employment Tax (Schedule SE)** — 1099-NEC support, Schedule C, SE tax computation. Large scope item.
3. **Foreign Tax Credit (Form 1116)** — Common for investors with international funds.

### Medium Priority
4. **Social Security — edge cases:**
   - Lump-sum election (prior-year benefits received in current year)
   - MFS lived-apart exception (different base amounts)
   - Negative net benefits (repayment scenarios)
5. **Form 8889 (HSA)** — Already partially implemented; SSA-1099 interaction with HSA eligibility for age 65+
6. **Estimated tax penalty (Form 2210)** — Underpayment penalty computation
7. **Additional refundable credits:**
   - Credit for federal tax on fuels (Form 4136)
   - Credit for undistributed capital gains (Form 2439)

### Low Priority
8. **Farm income (Schedule F)**
9. **Qualified business income deduction (Form 8995)** — Currently placeholder $0
10. **Net operating loss carryforward**

---

## Legal/Compliance Caveats

1. **Not a substitute for professional tax advice.** This software is for educational and informational purposes. Users should consult a qualified tax professional for complex situations.

2. **OBBBA provisions are based on the enacted text (§70104) as of 2025-07-04.** IRS implementing regulations and forms may differ from the statutory text. Constants should be verified against final IRS instructions when published.

3. **Social Security taxability thresholds ($25K/$34K single, $32K/$44K MFJ) have NOT been indexed for inflation since 1984.** These are hardcoded per IRC §86.

4. **MFS Social Security:** The tool assumes the worst case (lived with spouse = $0 base amount). Taxpayers who lived apart all year should consult Publication 915 for different thresholds.

5. **Excess SS withholding:** The refundable credit computation relies on accurate W-2 Box 4 amounts. Employers may have different rounding conventions.

6. **Phase 1 does NOT support:** self-employment tax, foreign tax credit, AMT credit carryforward, Premium Tax Credit, passive activity loss for non-rental activities, or any state-specific SS benefit exemptions.

---

## Build & Test Output

```
$ npx tsc -b
(no errors)

$ npx vitest run
 Test Files  66 passed (66)
      Tests  1427 passed (1427)
   Duration  5.84s
```

All existing tests continue to pass. No regressions introduced.

---

## Files Changed

### New Files
- `src/rules/2025/socialSecurityBenefits.ts` — SS taxable benefits computation (Pub 915)
- `src/rules/2025/seniorDeduction.ts` — OBBBA §70104 senior deduction
- `src/rules/2025/refundableCredits.ts` — Line 31 refundable credits framework
- `src/rules/2025/federalValidation.ts` — Federal return validation module
- `tests/rules/socialSecurity.test.ts` — 18 tests
- `tests/rules/seniorDeduction.test.ts` — 15 tests
- `tests/rules/refundableCredits.test.ts` — 8 tests
- `tests/rules/federalValidation.test.ts` — 7 tests
- `docs/federal-gap-closure-phase1-summary.md` — This document

### Modified Files
- `src/model/types.ts` — Added `FormSSA1099` interface and `formSSA1099s` to `TaxReturn`
- `src/rules/2025/form1040.ts` — Lines 6a/6b, updated Line 9/12/25/31, new result fields
- `src/rules/engine.ts` — SSA-1099 trace nodes, new node labels, document ref resolution
- `tests/fixtures/returns.ts` — New fixture builders and test scenarios
- `tests/ui/pages/P27Pages.test.tsx` — Fixed pre-existing incorrect assertion ($15,000 → $15,750)
