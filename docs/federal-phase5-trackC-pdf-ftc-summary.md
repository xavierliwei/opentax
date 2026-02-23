# Federal Phase 5 Track C: PDF Export for Form 1116 (Foreign Tax Credit)

## Overview

Added PDF export support for Form 1116 (Foreign Tax Credit) covering the passive category portfolio-income path. When a taxpayer has foreign taxes exceeding the direct credit election threshold ($300 single / $600 MFJ), the compiler now generates a filled Form 1116 and includes it in the filing package at IRS attachment sequence 19.

## What Changed

### New Files

| File | Purpose |
|------|---------|
| `public/forms/f1116.pdf` | Fillable PDF template with all required fields (2 pages) |
| `scripts/generate-f1116-template.ts` | Generator script for the template |
| `src/forms/mappings/form1116Fields.ts` | PDF field name mapping (header, Parts I-IV) |
| `src/forms/fillers/form1116Filler.ts` | Filler function: ForeignTaxCreditResult to PDF |
| `tests/forms/form1116Filler.test.ts` | 14 unit tests for field mapping and edge cases |

### Modified Files

| File | Change |
|------|--------|
| `src/forms/types.ts` | Added `f1116: Uint8Array` to `FormTemplates` |
| `src/forms/compiler.ts` | Added Form 1116 conditional inclusion (seq 19) |
| `src/ui/pages/DownloadPage.tsx` | Added f1116.pdf to template loading |
| `tests/forms/compiler.test.ts` | 5 new integration tests for inclusion/non-inclusion |
| `tests/forms/stateCompiler.test.ts` | Added f1116 to template fixture |
| `tests/scenarios/integration.test.ts` | Added f1116 to template fixture |

## Form 1116 Field Mapping

### Part I: Foreign-Source Income
- Line 1a: Dividend and interest income from sources with foreign tax
- Line 2: Total foreign-source gross income
- Line 3g: Net foreign-source taxable income (conservative: no deduction allocation)

### Part II: Foreign Taxes Paid
- Line 8: Taxes withheld at source (split by dividends/interest)
- Lines 9-14: Total creditable foreign taxes (no carryover, no reductions)

### Part III: Figuring the Credit
- Lines 15-21: Limitation computation (foreign source / worldwide x US tax)
- Line 22: Credit = min(taxes paid, limitation)
- Line 33: Final credit for passive category
- Line 34: Excess foreign tax (informational carryforward amount)

### Part IV: Summary
- Line 35: Passive category credit
- Line 38: Total foreign tax credit (flows to Schedule 3 Line 1)

## Inclusion Logic

Form 1116 is included in the PDF package when ALL of:
1. `foreignTaxCreditResult.applicable === true` (foreign taxes were paid)
2. `foreignTaxCreditResult.directCreditElection === false` (taxes exceed threshold)

When the direct credit election applies (taxes <= $300/$600), the FTC flows directly to Schedule 3 Line 1 without Form 1116, per IRC section 901(j).

## Unsupported Scenarios (noted on form)

These advanced FTC scenarios are outside the current MVP scope:

- General category income (wages/business income earned abroad)
- Multiple basket/category allocations
- FTC carryback (1 year) or carryforward (10 years)
- Treaty-based positions or re-sourcing rules
- Foreign tax credit on AMT (Form 6251 interaction)
- Sanctioned country income
- High-tax kickout rules

## Test Coverage

### Filler Tests (14 tests)
- Header fields on both pages (name, SSN)
- Country field population (single and multiple)
- Part I foreign-source income breakdown
- Part II foreign taxes paid (dividend/interest split)
- Part III limitation computation (ratio, amounts)
- Part III credit amount on page 2
- Part IV summary totals
- Excess foreign tax when limitation binds
- 2-page PDF output validation
- PDF round-trip (save and reload)
- Edge cases: dividend-only, interest-only, ratio > 1.0

### Compiler Integration Tests (5 tests)
- Form 1116 included when single filer taxes > $300
- Form 1116 excluded when single filer taxes <= $300 (direct credit)
- Form 1116 excluded when no foreign taxes paid
- Form 1116 included for MFJ when taxes > $600
- Attachment sequence order verification

## Build & Test Results

- `npm run build`: Clean (0 errors)
- `npx vitest run`: 76 test files, 1714 tests passing
