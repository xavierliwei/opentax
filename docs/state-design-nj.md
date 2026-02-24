# New Jersey State Tax Form Generation — Design & Status

## Overview

NJ Form NJ-1040 (Resident Income Tax Return) support for Tax Year 2025.

## What's Implemented

### Tax Computation (`src/rules/2025/nj/`)
- **Progressive tax brackets**: 7-bracket system (1.4% to 10.75%) for single/MFS; 8-bracket system for MFJ/HOH/QW
- **NJ gross income from source documents**: NJ does not start from federal AGI. Income is computed directly from W-2s, 1099s, K-1s, and Schedule C/D/E results.
- **Income categories** (Lines 15–27):
  - Wages (W-2 Box 16 preferred, Box 1 fallback)
  - Taxable interest (1099-INT Box 1)
  - Dividends (1099-DIV Box 1a — NJ taxes all at ordinary rates)
  - Business income (Schedule C net profit)
  - Capital gains (Schedule D Line 16 — all taxed as ordinary income)
  - Pensions/annuities (1099-R Box 2a, excluding rollovers code G)
  - Partnership/S-corp income (K-1 ordinary income)
  - Rental income (Schedule E)
  - Other income (1099-MISC Box 3)
- **Social Security**: Fully exempt — never enters NJ gross income
- **Pension exclusion** (Line 20b): Up to $100,000 (MFJ) / $75,000 (single) if NJ gross income is below the eligibility threshold
- **Property tax deduction** (Line 30): Actual property taxes paid (homeowners) or 18% of rent (renters), capped at $15,000. Auto-optimized vs the $50 property tax credit.
- **Medical expense deduction** (Line 31): Expenses exceeding 2% of NJ gross income (lower than federal 7.5% threshold)
- **Personal exemptions** (Line 37): $1,000 per filer/spouse, $1,500 per dependent, plus additional exemptions for veterans ($6,000), age 65+ ($1,000), blind/disabled ($1,000), and college student dependents ($1,000)
- **NJ EITC** (Line 44): 40% of federal Earned Income Credit (refundable)
- **NJ Child Tax Credit** (Line 45): $1,000 per child age ≤ 5, if NJ gross income ≤ $80,000 (refundable)
- **Property tax credit** (Line 43): $50 flat refundable credit when the deduction is less beneficial
- **State withholding**: Sums NJ W-2 Box 17 amounts (only W-2s with Box 15 = NJ)
- **Part-year residency**: Computes using NJ-1040 as a resident estimate with disclosure label (NJ-1040NR not yet supported)

### Form Generation (`src/forms/fillers/nj1040Filler.ts`)
- Programmatic PDF generation using pdf-lib
- Renders taxpayer info, income breakdown, deductions & exemptions, tax & credits, payments, and result
- One-page summary form for review purposes

### Integration Points
- `SupportedStateCode` type union includes `'NJ'`
- State rules registry (`stateRegistry.ts`) — `njModule` registered
- State form compiler registry (`stateFormRegistry.ts`) — `njFormCompiler` registered
- Engine (`engine.ts`) — `executedSchedules` includes `'NJ-1040'`
- Review layout with 4 sections: Income, Deductions & Exemptions, Tax & Credits, Payments & Result
- Explainability trace with node labels for all computed values
- Interview/sidebar auto-integration (dynamic step generation handles NJ)
- NJ-specific config fields in `StateReturnConfig`: `njPropertyTaxPaid`, `njRentPaid`, `njIsHomeowner`, `njTaxpayerVeteran`, `njSpouseVeteran`, `njTaxpayerBlindDisabled`, `njSpouseBlindDisabled`, `njDependentCollegeStudents`

## Known Gaps & Limitations

### Not Yet Implemented
1. **NJ-1040NR (Nonresident/Part-Year)** — Part-year computation uses NJ-1040 as a resident estimate with disclosure. The official NJ-1040NR form has a more detailed income allocation approach.
2. **Credit for taxes paid to other jurisdictions** (Line 40) — Nonrefundable credit for NJ residents who also pay taxes to another state. Requires cross-state coordination.
3. **NJ health insurance mandate penalty** — NJ requires health insurance coverage; penalty computation not modeled.
4. **NJ local taxes** — Some NJ municipalities have local wage taxes (not income taxes). These are employer-withheld and not part of NJ-1040 but may affect effective tax burden.
5. **NJ use tax** — For untaxed out-of-state purchases.
6. **Schedule NJ-BUS-1/NJ-BUS-2** — Business income allocation for multi-state businesses.
7. **NJ estimated tax payments** — ES-NJ equivalent not modeled.
8. **Alimony deduction** — NJ still allows alimony deduction for pre-2019 agreements (differs from federal post-TCJA treatment).
9. **NJ disability insurance withholding** — NJ SUI/SDI from W-2 Box 14 is not currently parsed or displayed.
10. **Gambling winnings** — NJ taxes gambling winnings as other income but does not allow gambling losses as a deduction (unlike federal).

### Assumptions
- **Tax brackets**: Based on NJ Division of Taxation 2025 instructions. NJ brackets are statutory and change infrequently.
- **Pension exclusion limits**: $100,000 (MFJ) / $75,000 (single) / $50,000 (MFS) — statutory amounts that have been stable since 2017.
- **EITC rate**: 40% of federal — increased from 30% in 2020, now statutory at 40%.
- **Child Tax Credit**: $1,000 per child age ≤ 5, income cap $80,000 — per NJ Division of Taxation guidance.
- **Property tax deduction cap**: $15,000 — statutory.
- **All amounts in cents**: Consistent with codebase convention.

## Validation Taxonomy Contract

The NJ module aligns with the standard `StateComputeResult` contract:
- `stateAGI` → `line29_njGrossIncome` (NJ gross income, not federal AGI)
- `stateTaxableIncome` → `line38_njTaxableIncome`
- `stateTax` → `line39_njTax`
- `stateCredits` → `line48_totalCredits`
- `taxAfterCredits` → `line49_taxAfterCredits`
- `stateWithholding` → `line52_njWithholding`
- `overpaid` → `line56_overpaid`
- `amountOwed` → `line57_amountOwed`

Quality gates validate:
- Non-negative tax and withholding amounts
- Consistent refund/owed (exactly one of overpaid or amountOwed is positive)
- Cross-state consistency (total state withholding ≤ total W-2 state withholding)

## File Inventory

| File | Purpose |
|------|---------|
| `src/rules/2025/nj/constants.ts` | Tax brackets, exemptions, pension exclusion, credits, property tax thresholds |
| `src/rules/2025/nj/formNJ1040.ts` | Main NJ-1040 computation (result type + `computeNJ1040`) |
| `src/rules/2025/nj/module.ts` | `StateRulesModule` wrapper, review layout, traced values |
| `src/rules/2025/nj/index.ts` | Module exports |
| `src/forms/fillers/nj1040Filler.ts` | PDF generator and `StateFormCompiler` |
| `src/model/types.ts` | `'NJ'` in `SupportedStateCode`, NJ-specific config fields |
| `src/rules/stateRegistry.ts` | `njModule` registered |
| `src/forms/stateFormRegistry.ts` | `njFormCompiler` registered |
| `src/rules/engine.ts` | `'NJ-1040'` in `executedSchedules` |

## Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/rules/nj/form1040.test.ts` | 23 | Income computation, brackets (all filing statuses), exemptions, property tax deduction/credit, medical deduction, pension exclusion, EITC, CTC, withholding, refund/owed, integration |
| `tests/rules/nj/module.test.ts` | 6 | Module metadata, review layout sections, review value getters, traced values, engine integration, part-year label |
| `tests/rules/stateEngine.test.ts` | +3 | NJ module registration, NJ computeAll integration (executedSchedules + traced values), NJ college-student dependent exemption |
| `tests/forms/stateCompiler.test.ts` | +4 | NJ compiler registration, NJ PDF generation, NJ PDF save/reload, NJ filing package integration |

## Next Steps

1. Implement NJ-1040NR for nonresident and part-year filers
2. Add credit for taxes paid to other jurisdictions (Line 40)
3. Parse NJ SUI/SDI from W-2 Box 14 for display
4. Add NJ health insurance mandate penalty computation
5. Official 2025 bracket verification when NJ Division of Taxation publishes final instructions
6. Add official NJ-1040 PDF template to `public/forms/state/NJ/` for template-based filling
