# New York State Tax Form Generation — Design & Status

## Overview

NY Form IT-201 (Resident Income Tax Return) support for Tax Year 2025.

## What's Implemented

### Tax Computation (`src/rules/2025/ny/`)
- **Progressive tax brackets**: 8-bracket system (4% to 10.9%) for all filing statuses
- **Standard deduction**: $8,000 (single/MFS), $16,050 (MFJ/QW), $11,200 (HOH)
- **NY adjustments to federal AGI**:
  - Subtraction: Social Security benefits (NY fully exempts SS income)
  - Subtraction: US government obligation interest (Treasury bonds, I-bonds)
  - Additions: placeholder for future non-conformity items
- **Dependent exemption**: $1,000 per dependent
- **NY Earned Income Tax Credit**: 30% of federal EITC
- **Itemized deductions**: Federal Schedule A with SALT add-back (NY has no SALT cap)
- **Part-year residency**: Day-based apportionment ratio
- **State withholding**: Sums NY W-2 Box 17 amounts

### Form Generation (`src/forms/fillers/formIT201Filler.ts`)
- Programmatic PDF generation using pdf-lib (same pattern as NJ, DC, GA)
- Renders taxpayer info, income, deductions, tax, credits, payments, and result
- One-page summary form for review purposes

### Integration Points
- `SupportedStateCode` type union includes `'NY'`
- State rules registry (`stateRegistry.ts`) — `nyModule` registered
- State form compiler registry (`stateFormRegistry.ts`) — `nyFormCompiler` registered
- Engine (`engine.ts`) — `executedSchedules` includes `'NY-IT201'`
- Review layout with 4 sections: Income, Deductions, Tax & Credits, Payments & Result
- Explainability trace with node labels for all computed values
- Interview/sidebar auto-integration (dynamic step generation handles NY)

## Known Gaps & Limitations

### Not Yet Implemented
1. **NYC resident tax** — NYC imposes an additional local income tax (3.078%–3.876%). This requires a `nycResident` config flag and additional bracket computation.
2. **Yonkers resident/nonresident tax** — Similar to NYC but with different rates.
3. **IT-203 (Nonresident/Part-Year)** — Part-year computation uses apportionment on the IT-201 result. The official IT-203 form has a more detailed income allocation approach.
4. **NY pension/annuity exclusion** — Up to $20,000 exclusion for filers age 59½+. Requires 1099-R data and age verification.
5. **NY child and dependent care credit** — Percentage of federal credit (110% for low AGI, scaling down).
6. **NY college tuition credit/deduction** — Form IT-272.
7. **NY household credit** — Small credit for low-income filers.
8. **NY additions** — IRC §168(k) bonus depreciation add-back, other federal non-conformity items.
9. **NY minimum income tax** — Rarely applies but exists for very high-income filers.
10. **Estimated tax payments** — 1040-ES NY equivalents.

### Assumptions
- **Tax brackets**: Based on 2024 NY tax law. NY bracket thresholds are set by statute and have historically not changed annually. The 10.9% top rate was made permanent in 2023.
- **Standard deduction**: Uses 2024 values. NY standard deductions are statutory and have not changed since 2018.
- **EITC rate**: 30% of federal — this is statutory and stable.
- **All amounts in cents**: Consistent with codebase convention.

## File Inventory

| File | Purpose |
|------|---------|
| `src/rules/2025/ny/constants.ts` | Tax brackets, standard deduction, exemptions, credit rates |
| `src/rules/2025/ny/formIT201.ts` | Main IT-201 computation (result type + `computeFormIT201`) |
| `src/rules/2025/ny/module.ts` | `StateRulesModule` wrapper, review layout, traced values |
| `src/forms/fillers/formIT201Filler.ts` | PDF generator and `StateFormCompiler` |
| `src/model/types.ts` | `'NY'` added to `SupportedStateCode` |
| `src/rules/stateRegistry.ts` | `nyModule` registered |
| `src/forms/stateFormRegistry.ts` | `nyFormCompiler` registered |
| `src/rules/engine.ts` | `'NY-IT201'` in `executedSchedules` |

## Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/rules/2025/ny/formIT201.test.ts` | 23 | Brackets, deductions, SS exemption, US gov interest, part-year, dependents, edge cases, review layout, engine integration |
| `tests/rules/stateEngine.test.ts` | +2 | NY module registration, NY compute integration |
| `tests/forms/stateCompiler.test.ts` | +4 | NY compiler registration, PDF generation, filing package integration |

## Next Steps

1. Add NYC resident local tax computation
2. Implement IT-203 for nonresident filing
3. Add pension exclusion (requires age data + 1099-R)
4. Add NY-specific config fields to `StateReturnsPage.tsx` (NYC residence checkbox)
5. Official 2025 bracket verification when NY DTF publishes final instructions
