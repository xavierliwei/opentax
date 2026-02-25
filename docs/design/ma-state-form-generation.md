# Massachusetts State Tax Form Generation — Design & Status

## Overview

MA Form 1 (Resident Income Tax Return) support for Tax Year 2025.

## What's Implemented

### Tax Computation (`src/rules/2025/ma/`)
- **Flat 5.00% income tax rate** on all taxable income (no progressive brackets)
- **Millionaire's surtax (Fair Share Amendment)**: Additional 4% on taxable income over $1,000,000 (Article XLIV, effective 2023). Threshold not doubled for MFJ.
- **Personal exemptions** (not a standard deduction):
  - Single: $4,400 / MFJ: $8,800 / MFS: $4,400 / HOH: $6,800 / QW: $4,400
- **Dependent exemption**: $1,000 per dependent (no phase-out)
- **Age 65+ exemption**: $700 per person (taxpayer + spouse if MFJ/MFS)
- **Blind exemption**: $2,200 per legally blind person
- **Rent deduction**: 50% of rent paid for principal MA residence, capped at $4,000 ($2,000 MFS)
- **MA adjustments to federal AGI** (Schedule Y):
  - Addition: HSA deduction add-back (MA does not conform to IRC §223)
  - Subtraction: Social Security benefits (MA fully exempts SS income)
  - Subtraction: US government obligation interest (Treasury bonds, I-bonds via 1099-INT Box 3)
- **MA Earned Income Tax Credit**: 30% of federal EITC (refundable)
- **Part-year residency**: Day-based apportionment ratio for income, exemptions, and rent deduction
- **State withholding**: Sums MA W-2 Box 17 amounts

### Form Generation (`src/forms/fillers/form1Filler.ts`)
- Programmatic PDF generation using pdf-lib (same pattern as NY, NJ, DC, GA)
- Renders taxpayer info, income, exemptions & deductions, tax, payments, and result
- One-page summary form for review purposes
- Generates "Form 1-NR/PY" label for part-year residents

### Integration Points
- `SupportedStateCode` type union includes `'MA'`
- `StateReturnConfig` includes `rentAmount?: number` field (cents)
- State rules registry (`stateRegistry.ts`) — `maModule` registered
- State form compiler registry (`stateFormRegistry.ts`) — `maFormCompiler` registered
- Engine (`engine.ts`) — `executedSchedules` includes `'MA-Form1'`
- Review layout with 4 sections: Income, Exemptions & Deductions, Tax, Payments & Result
- Explainability trace with node labels for all computed values
- Interview/sidebar auto-integration (dynamic step generation handles MA)
- StateReturnsPage.tsx includes MA rent amount input and residency guidance link

## Known Gaps & Limitations

### Not Yet Implemented
1. **Schedule Y full support** — Only HSA add-back, SS exemption, and US gov interest are implemented. Other additions/subtractions (e.g., IRC §179 excess deduction, alimony paid before 2019) are not yet covered.
2. **Medical/dental deduction** — MA allows deduction for medical expenses exceeding 7.5% of MA AGI (constant exists but computation not wired).
3. **Commuter transit deduction** — Pre-tax transit benefits may differ between federal and MA treatment.
4. **Schedule B interest/dividend income** — MA may tax certain interest/dividend income differently (Part A vs Part B income classes were unified at 5% since 2012, so this is low priority).
5. **Form 1-NR/PY official** — Part-year computation uses apportionment on the Form 1 result. The official Form 1-NR/PY has a more detailed MA-source income allocation.
6. **Estimated tax payments** — MA Form 1-ES equivalents.
7. **MA child care credit** — Schedule CB (limited credit).
8. **Property tax circuit breaker** — Schedule CB for low-income seniors.
9. **Other credits** — Lead paint credit, septic system credit, brownfields credit, etc.
10. **Official DOR PDF template filling** — Currently generates a summary PDF; does not fill the official DOR Form 1 template.

### Assumptions
- **Flat rate**: 5.00% has been stable since 2012 (Parts A/B/C unified). This rate is set by MGL ch. 62 §4.
- **Surtax threshold**: $1,000,000 for 2025. The threshold is indexed to CPI starting 2024 but has not changed from $1M.
- **Personal exemptions**: Based on 2024 published values. These are statutory and rarely change.
- **Rent deduction cap**: $4,000 ($2,000 MFS) — statutory, stable.
- **EITC rate**: 30% of federal — statutory since 2001.
- **All amounts in cents**: Consistent with codebase convention.

## File Inventory

| File | Purpose |
|------|---------|
| `src/rules/2025/ma/constants.ts` | Tax rate, surtax, exemptions, rent deduction, EITC rate |
| `src/rules/2025/ma/adjustments.ts` | Federal AGI → MA AGI adjustments (HSA, SS, US gov interest) |
| `src/rules/2025/ma/form1.ts` | Main Form 1 computation (result type + `computeForm1`) |
| `src/rules/2025/ma/module.ts` | `StateRulesModule` wrapper, review layout, traced values |
| `src/forms/fillers/form1Filler.ts` | PDF generator and `StateFormCompiler` |
| `src/model/types.ts` | `'MA'` in `SupportedStateCode`, `rentAmount` in `StateReturnConfig` |
| `src/rules/stateRegistry.ts` | `maModule` registered |
| `src/forms/stateFormRegistry.ts` | `maFormCompiler` registered |
| `src/rules/engine.ts` | `'MA-Form1'` in `executedSchedules` |

## Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/rules/ma/form1.test.ts` | 25+ | Flat rate, surtax, exemptions (personal/dependent/age65/blind), rent deduction, MA adjustments, withholding, refund/owed, part-year apportionment, integration |
| `tests/rules/ma/adjustments.test.ts` | 10+ | HSA add-back, SS exemption, US gov interest, combined adjustments |
| `tests/rules/stateEngine.test.ts` | +4 | MA module registration, MA compute integration, MA rent deduction, executedSchedules |
| `tests/forms/stateCompiler.test.ts` | +5 | MA compiler registration, PDF generation, save/reload, part-year label, filing package integration |

## Next Steps

1. Add Schedule Y full support (remaining additions/subtractions)
2. Implement medical/dental expense deduction
3. Add property tax circuit breaker (Schedule CB) for senior residents
4. Implement official DOR Form 1 PDF template filling
5. Add estimated tax payment tracking
6. Verify 2025 constants when MA DOR publishes final Form 1 instructions
