# Maryland State Return Design (TY2025)

## Scope
Implement Maryland individual income tax return support in the multi-state framework:
- Interview selection/config for MD in `State Returns`
- Compute engine module for MD Form 502/505-style output
- Validation guardrails for residency dates
- Explainability node mapping for MD lines
- PDF compiler mapping (programmatic summary form)
- Filing packet export integration
- Unit/integration tests

## Forms covered
- **Primary output label:**
  - Full-year / part-year: `MD Form 502`
  - Nonresident: `MD Form 505`
- This implementation is a practical v1 and does not claim full legal completeness.

## Interview flow
User selects Maryland on State Returns page and chooses:
- Full-year resident
- Part-year resident (move-in / move-out dates)
- Nonresident

Rules:
- Dates are optional for part-year and default to Jan 1 / Dec 31 when omitted.
- Dates are clamped to tax-year boundaries.
- If move-in > move-out, apportionment ratio resolves to 0 (safe fallback).

## Computation model (v1)
### Inputs
- Federal AGI (`Form 1040 line 11`)
- Filing status
- Dependents count
- Federal Schedule A (for optional itemized carryover)
- MD withholding from W-2 (Box 17 where Box 15 = `MD`)

### Core steps
1. Compute apportionment ratio by residency:
   - Full-year = 1
   - Part-year = inclusive days in-state / days in year
   - Nonresident = 0 (v1 proxy)
2. Compute Maryland AGI from federal AGI (no state adjustments modeled in v1).
3. Compute deduction (larger of):
   - Maryland standard deduction (percent of AGI with min/max by status)
   - Federal itemized deduction (if itemized chosen and Schedule A exists)
4. Compute personal/dependent exemptions with AGI phase-down.
5. Compute taxable income = max(0, apportioned AGI - apportioned deduction - apportioned exemptions).
6. Compute state tax via progressive MD brackets.
7. Compute local tax using default flat local rate.
8. Tax after credits = state + local (no additional credits in v1).
9. Compare against MD withholding to determine refund or balance due.

## Validation/assumptions
- Nonresident currently uses apportionment ratio 0 (v1 simplification; future should use MD-source income allocation).
- Local tax uses a default statewide representative rate (future county-specific interview needed).
- No pension subtraction / two-income subtraction / specialized credits in v1.

## Explainability nodes
- `form502.mdAGI`
- `form502.mdSourceIncome`
- `form502.apportionmentRatio`
- `form502.mdDeduction`
- `form502.mdExemptions`
- `form502.mdTaxableIncome`
- `form502.mdStateTax`
- `form502.mdLocalTax`
- `form502.taxAfterCredits`
- `form502.stateWithholding`
- `form502.overpaid`
- `form502.amountOwed`

## PDF/compiler
- Programmatic generator with a single summary page.
- Form identifiers:
  - `MD Form 502` or `MD Form 505`
- Sequence number prefix: `MD-01`.

## Follow-up roadmap (post-v1)
1. County/local tax selection from actual county rates.
2. True nonresident sourcing (wages/business/rental/capital allocations).
3. Maryland-specific additions/subtractions and pension exclusion logic.
4. Senior/child/dependent and refundable state credits.
5. Official form-template field mapping (if templates are added to `public/forms/state/MD`).
