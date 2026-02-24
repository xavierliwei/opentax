# Unsupported Forms Wave 1 — Form 8606 / 2210 / 4868 Baseline

Date: 2026-02-24

## What changed

Implemented explicit guardrail workflows (non-silent) for three medium-frequency unsupported forms:

1. **Form 8606 (IRA basis / Roth conversion allocation)**
   - Added validation warning `FORM_8606_BASIS_NOT_SUPPORTED` when an IRA 1099-R has **"Taxable amount not determined"** checked.
   - Guidance explains that OpenTax does not compute pro-rata basis and asks user to provide validated Box 2a or complete Form 8606 manually.

2. **Form 2210 (underpayment penalty)**
   - Added informational validation item `FORM_2210_NOT_COMPUTED` when Form 1040 Line 37 has a balance due.
   - Explains that underpayment penalty safe-harbor analysis is not computed.

3. **Form 4868 (extension of time to file)**
   - Added informational validation item `FORM_4868_EXTENSION_WORKFLOW` when there is a balance due.
   - Clarifies extension workflow is not generated/filed in OpenTax and reminds that payment is still due by deadline.

## Scope sync

- Updated `SUPPORTED_SCOPE` message to explicitly list Form 8606 / 2210 / 4868 as unsupported.
- Updated Trust Center limitations page with a dedicated constraint card for these forms.

## Files touched

- `src/rules/2025/federalValidation.ts`
- `tests/rules/federalValidation.test.ts`
- `docs/trust/limitations.html`
- `docs/unsupported-forms-wave1-summary.md`
