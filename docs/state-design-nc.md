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

## NC Additions/Deductions (D-400 Schedule S)
NC AGI diverges from federal AGI when any of the following apply:

### Additions (Schedule S, Part A)
- **HSA deduction add-back**: NC does not conform to IRC section 223. Any HSA deduction
  claimed on the federal return is added back for NC purposes.
- **State/local income tax add-back**: If the filer claimed state/local income taxes as an
  itemized deduction on federal Schedule A, NC adds that amount back.

### Deductions (Schedule S, Part B)
- **Social Security exemption**: NC fully exempts Social Security benefits. The taxable
  portion (Form 1040 Line 6b) is subtracted from NC income.
- **US government obligation interest**: Interest from Treasury bonds, I-bonds, and other
  US government obligations (1099-INT Box 3) is exempt from NC state income tax.

## Simplifications in this phase
- Credits are placeholders (0)
- Withholding currently sourced from W-2 entries tagged `box15State = 'NC'`

## Follow-up candidates
- Add nonrefundable/refundable NC credits
- Add template-based D-400 mapping when official PDF templates are bundled
- Add NC state validation warnings (selected state vs available withholding mismatch)
