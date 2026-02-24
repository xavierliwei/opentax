# North Carolina State Return Design (D-400)

This branch implements an initial NC state return module aligned with the multi-state framework.

## Scope delivered
- State interview flow: NC appears in supported states and dynamic review steps
- Compute/rules: NC Form D-400 baseline (AGI → standard deduction → taxable income → flat tax)
- Part-year/nonresident apportionment support (date-based ratio)
- Explainability labels + traced values for NC nodes
- State review layout and result lines
- Programmatic PDF generator and compiler registration (`NC-01`)
- State packet export via `compileFilingPackage`
- Unit/integration tests for rules, module, interview visibility, and compiler flow

## Simplifications in this phase
- NC additions/subtractions are placeholders (0)
- Credits are placeholders (0)
- Withholding currently sourced from W-2 entries tagged `box15State = 'NC'`

## Follow-up candidates
- Add NC specific additions/subtractions schedule support
- Add nonrefundable/refundable NC credits
- Add template-based D-400 mapping when official PDF templates are bundled
- Add NC state validation warnings (selected state vs available withholding mismatch)
