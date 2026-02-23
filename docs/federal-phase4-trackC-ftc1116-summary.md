# Federal Phase 4 Track C — Foreign Tax Credit (Form 1116)

## Overview

Implements a practical Form 1116 foreign tax credit path for common
portfolio-income cases. Covers passive-category foreign taxes reported on
1099-DIV Box 7 and 1099-INT Box 6 (the most common FTC scenario for US
investors with international mutual funds or foreign bank accounts).

## Changes

### Data Model (`src/model/types.ts`)
- **Form1099DIV**: Added `box7` (foreign tax paid, cents) and `box8?` (foreign country)
- **Form1099INT**: Added `box6` (foreign tax paid, cents) and `box7?` (foreign country)

### Computation Module (`src/rules/2025/foreignTaxCredit.ts`)
New module implementing:
- **Foreign tax aggregation** across multiple 1099-DIV and 1099-INT forms
- **FTC limitation formula** per IRC §904:
  `credit ≤ US_tax × (foreign_source_income / worldwide_taxable_income)`
- **Direct credit election** detection (IRC §901(j)):
  ≤$300 single / $600 MFJ → no Form 1116 required
- **Excess foreign tax** tracking (informational, carryover not implemented)
- **Country tracking** from Box 8 / Box 7 fields

### Form 1040 Integration (`src/rules/2025/form1040.ts`)
- FTC computed after Line 16 (tax) and before Line 20 (credits)
- `foreignTaxCreditResult` added to `Form1040Result` interface
- FTC amount flows to Line 20 (Schedule 3, Part I, Line 1) alongside
  existing credits (dependent care, education, saver's, energy)
- Non-refundable: cannot reduce tax below zero (enforced by Line 22 floor)

### PDF Filler (`src/forms/fillers/schedule3Filler.ts`)
- Schedule 3 Line 1 now populated with FTC credit amount

### Validation (`src/rules/2025/federalValidation.ts`)
Three new validation items when foreign taxes are present:
- `FTC_COMPUTED` (info): Confirms FTC is being calculated, shows amounts
- `FTC_NO_CARRYOVER` (warning): Carryback/carryforward not supported
- `FTC_PASSIVE_ONLY` (warning): Only passive category income handled

Phase limitations message updated from `PHASE3_LIMITATIONS` to
`PHASE4_LIMITATIONS` to reflect FTC support.

### UI (`src/ui/components/OCRUpload.tsx`)
- OCR upload now captures Box 6/7 for 1099-INT and Box 7 for 1099-DIV

### Tests (`tests/rules/foreignTaxCredit.test.ts`)
35 tests covering:
- Basic computation (no foreign tax, simple dividend, interest, combined)
- Limitation formula (taxes > limitation, foreign income > taxable income,
  zero taxable income, zero US tax, correct ratio math)
- Direct credit election ($300/$600 thresholds by filing status)
- Multiple 1099 aggregation (DIV + INT, mixed with/without foreign tax)
- Country tracking (deduplication)
- Integration with Form 1040 (Line 20 inclusion, tax reduction, non-refundable
  cap, interaction with other credits)
- Validation item generation
- Edge cases (zero dividends with tax, large amounts, rounding, MFS, QW)

Existing test updates:
- `federalValidation.test.ts`: Updated to check `PHASE4_LIMITATIONS`
- `selfEmploymentIntegration.test.ts`: Updated to check `PHASE4_LIMITATIONS`

## Assumptions and Scope

### Supported (common portfolio cases)
- Foreign taxes withheld on dividends (1099-DIV Box 7)
- Foreign taxes withheld on interest (1099-INT Box 6)
- Single passive category (no basket allocation needed)
- All filing statuses (single, MFJ, MFS, HOH, QW)
- Direct credit election for small amounts

### Not Supported (validation warnings emitted)
- General category income (foreign wages, self-employment abroad)
- Multiple income categories / basket allocation
- FTC carryback (1 year) or carryforward (10 years) tracking
- Treaty-based positions or income re-sourcing
- AMT foreign tax credit interaction
- Sanctioned country income (IRC §901(j))
- High-tax kickout rules
- Form 1116 PDF generation (credit flows to Schedule 3 Line 1 only)

## IRC References
- **IRC §901**: General rule for foreign tax credit
- **IRC §904**: FTC limitation formula
- **IRC §901(j)**: Direct credit election (≤$300/$600)
- **IRC §904(c)**: Carryback/carryforward (not implemented)
- **Form 1116 Instructions (2025)**: Computation details

## Test Results
- 35 new FTC tests: all passing
- 1564 total tests: all passing
- TypeScript build: clean (no errors)
