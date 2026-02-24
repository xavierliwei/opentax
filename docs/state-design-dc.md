# District of Columbia State Return Design (D-40)

Implemented scope for CLD-20260223-33:

- Supported return: **DC Form D-40** (full-year / part-year / nonresident)
- Nonresident commuter nuance: **MD/VA reciprocity exemption**
  - If DC nonresident commuter resident state is MD or VA, DC tax is forced to zero.
  - DC withholding remains refundable.
- Interview flow:
  - State Returns page now allows nonresident selection for DC.
  - Adds commuter home-state selector (MD / VA / Other) when DC nonresident is selected.
- Compute model:
  - Starts from federal AGI
  - Part-year apportionment by days in DC residency window
  - Chooses larger of standard/itemized deduction (simplified)
  - Applies DC progressive bracket tax
  - Applies reciprocity override for MD/VA nonresident commuters
- PDF/compiler:
  - Programmatic one-page D-40 summary PDF via pdf-lib
  - Included in state package export and combined packet as sequence `DC-01`
- Explain/review mapping:
  - Added D-40 trace node labels and review layout in `dc/module.ts`
- Tests:
  - Added D-40 rule tests
  - Extended state registry/engine tests for DC registration
  - Added D-40 compiler tests and registry assertion
