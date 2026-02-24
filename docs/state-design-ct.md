# OpenTax — Connecticut CT-1040 Design Document

> **Status**: Proposed
> **Date**: 2026-02-24
> **Scope**: Tax year 2025 (returns filed in 2026)
> **Prerequisite**: Federal Form 1040 computation complete
> **Source**: CT DRS 2025 Form CT-1040 Instructions, CT-1040 TCS (Tables A–E), Schedule 1/3/CT-EITC

---

## Overview

Connecticut is a key expansion state for OpenTax. CT uses a 7-bracket progressive income tax (2%–6.99%) with a unique "benefit recapture" mechanism that phases out lower bracket advantages for higher earners. CT has **no standard deduction** — it uses personal exemptions that phase out aggressively. The CT-1040 starts from federal AGI, applies Schedule 1 modifications, and computes tax via a four-table calculation (brackets + phase-out add-back + benefit recapture).

### What already exists in our model

| Data | Source | Status |
|------|--------|--------|
| W-2 Box 15 (state code) | `W2.box15State` | Captured in model, UI, OCR |
| W-2 Box 16 (state wages) | `W2.box16StateWages` | Captured |
| W-2 Box 17 (state tax withheld) | `W2.box17StateIncomeTax` | Captured |
| Federal AGI (Line 11) | `Form1040Result.line11` | Computed |
| Itemized deductions detail | `ScheduleAResult` | Computed |
| Capital gains/losses | `ScheduleDResult` | Computed |
| HSA deduction | `HSAResult` | Computed |
| Social Security benefits | `FormSSA1099.box5` | Captured |
| 1099-R retirement distributions | `Form1099R.box2a` | Captured |
| 1099-INT Box 3 (U.S. obligations) | `Form1099INT.box3` | Captured |

### What's missing

- CT tax bracket constants (7 brackets × 3 schedules)
- CT personal exemption constants + phase-out tables (Table A)
- CT 2% rate phase-out add-back (Table C)
- CT benefit recapture (Table D)
- Schedule 1 modifications (CT AGI adjustments from federal AGI)
- CT-1040 computation engine
- CT property tax credit (Schedule 3)
- CT EITC (Schedule CT-EITC)
- CT Form CT-1040 PDF filler
- `'CT'` added to `SupportedStateCode`

---

## Architecture

CT computation sits **downstream** of the federal computation — it consumes `Form1040Result` and produces `FormCT1040Result`.

```
TaxReturn model
    |
    v
computeForm1040(model)  -->  Form1040Result
    |                            |
    v                            v
computeFormCT1040(model, form1040Result)  -->  FormCT1040Result
    |
    v
PDF compiler: fillForm1040() + fillFormCT1040()
```

### Data flow detail

```
Federal AGI (Form 1040 Line 11)
    |
    + Schedule 1 Additions (non-CT muni bond interest, bonus depreciation add-back)
    - Schedule 1 Subtractions (U.S. obligations interest, Social Security, pension/IRA)
    |
    = CT AGI (CT-1040 Line 5)
    |
    - Personal Exemption (Table A — phases out by CT AGI)
    |
    = CT Taxable Income (CT-1040 Line 6)
    |
    → Table B (7-bracket computation)
    + Table C (2% rate phase-out add-back)
    + Table D (benefit recapture)
    |
    = CT Income Tax (CT-1040 Line 7)
    |
    - Credits (property tax credit, CT EITC, PE tax credit)
    - Withholding (W-2 Box 17)
    |
    = Tax Due / Refund
```

### File structure

```
src/rules/2025/ct/
  constants.ts          -- CT brackets, exemptions, recapture tables, credit limits
  formCT1040.ts         -- Main orchestrator (parallel to form540.ts)
  scheduleCT1.ts        -- Federal-to-CT AGI adjustments (Schedule 1)
  ctCredits.ts          -- Property tax credit, CT EITC
  module.ts             -- ctModule implementing StateRulesModule

tests/rules/ct/
  formCT1040.test.ts
  scheduleCT1.test.ts
  ctCredits.test.ts

src/forms/fillers/
  formCT1040Filler.ts   -- PDF field mapping
```

---

## CT Tax Rules — Detailed Reference

### Tax Brackets (Table B) — Tax Year 2025

CT uses 7 progressive brackets. Rates were reduced in 2024 (bottom two brackets: 3%→2%, 5%→4.5%).

**Single / Married Filing Separately:**

| Bracket | Taxable Income | Rate |
|---------|---------------|------|
| 1 | $0 – $10,000 | 2.00% |
| 2 | $10,001 – $50,000 | 4.50% |
| 3 | $50,001 – $100,000 | 5.50% |
| 4 | $100,001 – $200,000 | 6.00% |
| 5 | $200,001 – $250,000 | 6.50% |
| 6 | $250,001 – $500,000 | 6.90% |
| 7 | Over $500,000 | 6.99% |

**Married Filing Jointly / Qualifying Surviving Spouse:**

| Bracket | Taxable Income | Rate |
|---------|---------------|------|
| 1 | $0 – $20,000 | 2.00% |
| 2 | $20,001 – $100,000 | 4.50% |
| 3 | $100,001 – $200,000 | 5.50% |
| 4 | $200,001 – $400,000 | 6.00% |
| 5 | $400,001 – $500,000 | 6.50% |
| 6 | $500,001 – $1,000,000 | 6.90% |
| 7 | Over $1,000,000 | 6.99% |

**Head of Household:**

| Bracket | Taxable Income | Rate |
|---------|---------------|------|
| 1 | $0 – $16,000 | 2.00% |
| 2 | $16,001 – $80,000 | 4.50% |
| 3 | $80,001 – $160,000 | 5.50% |
| 4 | $160,001 – $320,000 | 6.00% |
| 5 | $320,001 – $400,000 | 6.50% |
| 6 | $400,001 – $800,000 | 6.90% |
| 7 | Over $800,000 | 6.99% |

### Personal Exemptions (Table A) — No Standard Deduction

CT has **no standard deduction**. Instead, taxpayers receive a personal exemption that phases out by CT AGI.

| Filing Status | Max Exemption | Phase-Out Start | Phase-Out End (Exemption = $0) |
|---------------|--------------|-----------------|-------------------------------|
| Single | $15,000 | $30,000 | $44,000 |
| MFS | $12,000 | $24,000 | $36,000 |
| HoH | $19,000 | $38,000 | $57,000 |
| MFJ | $24,000 | $48,000 | $72,000 |
| QSS | $24,000 | $48,000 | $72,000 |

**Phase-out rule**: Exemption reduced by $1,000 for each $1,000 (or fraction) of CT AGI above the phase-out start.

### 2% Rate Phase-Out Add-Back (Table C)

Recaptures the benefit of the 2% bottom bracket as income rises.

| Filing Status | Phase-Out Begins | Phase-Out Ends | Max Add-Back |
|---------------|-----------------|----------------|-------------|
| Single / MFS | ~$56,500 | ~$105,000 | ~$200 |
| HoH | ~$80,500 | ~$160,000 | ~$320 |
| MFJ / QSS | ~$100,500 | ~$210,000 | ~$400 |

### Benefit Recapture (Table D)

Recaptures the full benefit of the two reduced brackets (2% and 4.5%) for high-income taxpayers.

| Filing Status | Recapture Begins | Recapture Ends | Max Recapture |
|---------------|-----------------|----------------|--------------|
| Single / MFS | $105,000 | $150,000 | $250 |
| HoH | $168,000 | $240,000 | $400 |
| MFJ / QSS | $210,000 | $300,000 | $500 |

**Design note**: Tables C and D are implemented as lookup tables (not bracket computations). They use CT AGI, not taxable income, as the input. The CT DRS publishes these as stepped dollar amounts in income bands.

---

## Phase 1 — CT Core Tax Computation

### 1a. Constants: `src/rules/2025/ct/constants.ts`

**Source**: CT DRS 2025 CT-1040 TCS Tables A–D

```typescript
// All amounts in cents via c() helper

// ── Tax Brackets (Table B) ─────────────────────────────────────
// 7 brackets: 2%, 4.5%, 5.5%, 6%, 6.5%, 6.9%, 6.99%

export const CT_TAX_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { rate: 0.02,   floor: c(0) },
    { rate: 0.045,  floor: c(10000) },
    { rate: 0.055,  floor: c(50000) },
    { rate: 0.06,   floor: c(100000) },
    { rate: 0.065,  floor: c(200000) },
    { rate: 0.069,  floor: c(250000) },
    { rate: 0.0699, floor: c(500000) },
  ],
  mfs: [/* same as single */],
  mfj: [
    { rate: 0.02,   floor: c(0) },
    { rate: 0.045,  floor: c(20000) },
    { rate: 0.055,  floor: c(100000) },
    { rate: 0.06,   floor: c(200000) },
    { rate: 0.065,  floor: c(400000) },
    { rate: 0.069,  floor: c(500000) },
    { rate: 0.0699, floor: c(1000000) },
  ],
  qw: [/* same as MFJ */],
  hoh: [
    { rate: 0.02,   floor: c(0) },
    { rate: 0.045,  floor: c(16000) },
    { rate: 0.055,  floor: c(80000) },
    { rate: 0.06,   floor: c(160000) },
    { rate: 0.065,  floor: c(320000) },
    { rate: 0.069,  floor: c(400000) },
    { rate: 0.0699, floor: c(800000) },
  ],
}

// ── Personal Exemptions (Table A) ──────────────────────────────
// CT has NO standard deduction. Personal exemption phases out.

export const CT_PERSONAL_EXEMPTION: Record<FilingStatus, {
  maxExemption: number
  phaseOutStart: number
  phaseOutEnd: number
}> = {
  single: { maxExemption: c(15000), phaseOutStart: c(30000),  phaseOutEnd: c(44000) },
  mfs:    { maxExemption: c(12000), phaseOutStart: c(24000),  phaseOutEnd: c(36000) },
  hoh:    { maxExemption: c(19000), phaseOutStart: c(38000),  phaseOutEnd: c(57000) },
  mfj:    { maxExemption: c(24000), phaseOutStart: c(48000),  phaseOutEnd: c(72000) },
  qw:     { maxExemption: c(24000), phaseOutStart: c(48000),  phaseOutEnd: c(72000) },
}

// ── 2% Rate Phase-Out Add-Back (Table C) ───────────────────────
// Recaptures benefit of 2% bottom bracket for middle incomes.
// Implemented as lookup tables keyed on CT AGI bands.

export const CT_TABLE_C: Record<FilingStatus, {
  phaseOutStart: number
  phaseOutEnd: number
  maxAddBack: number
}> = {
  single: { phaseOutStart: c(56500),  phaseOutEnd: c(105000), maxAddBack: c(200) },
  mfs:    { phaseOutStart: c(56500),  phaseOutEnd: c(105000), maxAddBack: c(200) },
  hoh:    { phaseOutStart: c(80500),  phaseOutEnd: c(160000), maxAddBack: c(320) },
  mfj:    { phaseOutStart: c(100500), phaseOutEnd: c(210000), maxAddBack: c(400) },
  qw:     { phaseOutStart: c(100500), phaseOutEnd: c(210000), maxAddBack: c(400) },
}

// ── Benefit Recapture (Table D) ────────────────────────────────
// Recaptures benefit of both reduced brackets for high incomes.

export const CT_TABLE_D: Record<FilingStatus, {
  recaptureStart: number
  recaptureEnd: number
  maxRecapture: number
}> = {
  single: { recaptureStart: c(105000), recaptureEnd: c(150000), maxRecapture: c(250) },
  mfs:    { recaptureStart: c(105000), recaptureEnd: c(150000), maxRecapture: c(250) },
  hoh:    { recaptureStart: c(168000), recaptureEnd: c(240000), maxRecapture: c(400) },
  mfj:    { recaptureStart: c(210000), recaptureEnd: c(300000), maxRecapture: c(500) },
  qw:     { recaptureStart: c(210000), recaptureEnd: c(300000), maxRecapture: c(500) },
}

// ── Property Tax Credit (Schedule 3) ───────────────────────────
// Nonrefundable credit for property taxes paid on CT primary residence.
// Max $300, phases out by 15% per $10,000 over income limit.

export const CT_PROPERTY_TAX_CREDIT = {
  maxCredit: c(300),
  phaseOutRate: 0.15,        // 15% reduction per $10K over limit
  phaseOutStep: c(10000),    // $10K bands ($5K for MFS)
  phaseOutStepMFS: c(5000),
  incomeLimit: {
    single: c(46300),
    hoh:    c(46300),
    mfs:    c(56500),
    mfj:    c(56500),
    qw:     c(56500),
  } as Record<FilingStatus, number>,
}

// ── CT EITC ────────────────────────────────────────────────────
// 40% of federal EITC + $250 bonus for families with qualifying children.
// Fully refundable. Full-year residents only.

export const CT_EITC_RATE = 0.40
export const CT_EITC_CHILD_BONUS = c(250)
```

### 1b. Schedule 1 Adjustments: `src/rules/2025/ct/scheduleCT1.ts`

Computes CT AGI from federal AGI by applying additions and subtractions.

**Key adjustments for our target user (W-2 + stock income):**

| Adjustment | Direction | Reason | Priority |
|------------|-----------|--------|----------|
| U.S. obligation interest | Subtraction | CT excludes interest on Treasury bonds/notes (1099-INT Box 3) | Phase 1 |
| Non-CT municipal bond interest | Addition | Interest from other states' bonds must be added back | Phase 2 |
| Bonus depreciation add-back | Addition | CT requires 100% IRC §168(k) add-back | Phase 2 (Sch C/E users) |
| Social Security benefits | Subtraction | CT exempts SS below $75K single / $100K MFJ | Phase 2 |
| Pension/annuity income | Subtraction | CT exempts pensions below $75K single / $100K MFJ | Phase 2 |
| IRA distributions | Subtraction | 75% of non-Roth IRA distributions excluded (2025) | Phase 2 |

**Phase 1 scope** — Only U.S. obligation interest subtraction matters for our target user (tech employees rarely have non-CT muni bonds or pension income). Most W-2 employees with stock income have zero CT Schedule 1 adjustments unless they hold Treasury bonds.

```typescript
export interface ScheduleCT1Result {
  federalAGI: number            // cents — Form 1040 Line 11
  additions: number             // cents — Schedule 1 additions total
  subtractions: number          // cents — Schedule 1 subtractions total
  ctAGI: number                 // cents — federal AGI + additions - subtractions

  // Detail
  usObligationInterest: number  // cents — subtracted (1099-INT Box 3)
}

export function computeScheduleCT1(
  model: TaxReturn,
  form1040: Form1040Result,
): ScheduleCT1Result
```

### 1c. Form CT-1040 Orchestrator: `src/rules/2025/ct/formCT1040.ts`

```typescript
export interface FormCT1040Result {
  // Income
  federalAGI: number                  // CT-1040 Line 1 — from Form 1040 Line 11
  ctSchedule1: ScheduleCT1Result      // Schedule 1 detail
  ctAGI: number                       // CT-1040 Line 5

  // Personal Exemption (Table A)
  personalExemption: number           // CT-1040 TCS Line 2 (before phase-out)
  exemptionPhaseOutReduction: number  // amount reduced by phase-out
  effectiveExemption: number          // after phase-out

  // Taxable Income
  ctTaxableIncome: number             // CT-1040 Line 6 = ctAGI - effectiveExemption

  // Tax Computation (Tables B + C + D)
  bracketTax: number                  // Table B — 7-bracket computation
  tableC_addBack: number              // Table C — 2% rate phase-out add-back
  tableD_recapture: number            // Table D — benefit recapture
  ctIncomeTax: number                 // CT-1040 Line 7 = bracketTax + tableC + tableD

  // Credits
  propertyTaxCredit: number           // Schedule 3 — nonrefundable, max $300
  ctEITC: number                      // Schedule CT-EITC — refundable (40% × federal EITC + $250)
  totalNonrefundableCredits: number
  totalRefundableCredits: number

  // Tax after credits
  taxAfterCredits: number             // Line 10

  // Payments
  stateWithholding: number            // Line 18 — sum of W-2 Box 17 where box15State === 'CT'
  totalPayments: number               // Line 22

  // Result
  overpaid: number                    // Line 25 (refund)
  amountOwed: number                  // Line 29
}
```

**CT-1040 line-by-line computation:**

```
Line 1:   Federal AGI (from Form 1040 Line 11)
Line 2:   Schedule 1 additions
Line 3:   Subtotal (Line 1 + Line 2)
Line 4:   Schedule 1 subtractions
Line 5:   CT AGI (Line 3 - Line 4)

TCS Line 1: CT Taxable Income = CT AGI - Personal Exemption (Table A)
TCS Line 3: Initial Tax from Table B (7-bracket computation)
TCS Line 4: + Table C (2% phase-out add-back)
TCS Line 5: + Table D (benefit recapture)
TCS Line 6: CT Income Tax = sum of Lines 3–5

Line 7:   CT Income Tax (from TCS)
Line 9:   Credit for taxes paid to other jurisdictions (Phase 3)
Line 10:  Tax after nonrefundable credits

Line 11:  Individual use tax (out of scope)
Line 13:  Total tax

Line 15:  Property tax credit (Schedule 3)
Line 16:  CT EITC (Schedule CT-EITC)

Line 18:  CT income tax withheld (W-2 Box 17)
Line 22:  Total payments + refundable credits

Line 25:  Overpaid (refund)
Line 29:  Amount you owe
```

### 1d. CT-Specific Tax Computation: Tables C and D

Unlike standard bracket computations, Tables C and D are **stepped lookup tables** based on CT AGI (not taxable income). They cannot be computed using `computeBracketTax()`.

```typescript
/**
 * Compute Table C add-back (2% rate phase-out).
 * Uses CT AGI to look up a dollar amount that phases in linearly
 * between phaseOutStart and phaseOutEnd.
 */
export function computeTableCAddBack(
  ctAGI: number,
  filingStatus: FilingStatus,
): number

/**
 * Compute Table D recapture (benefit recapture for high income).
 * Uses CT AGI to look up a dollar amount that phases in
 * between recaptureStart and recaptureEnd.
 */
export function computeTableDRecapture(
  ctAGI: number,
  filingStatus: FilingStatus,
): number
```

**Implementation approach**: Both tables phase in linearly. The add-back/recapture at a given CT AGI is:

```
amount = min(maxAmount, maxAmount × (ctAGI - start) / (end - start))
```

Round to the nearest dollar (CT DRS uses whole-dollar rounding in the published tables).

### 1e. Personal Exemption Phase-Out

```typescript
/**
 * Compute personal exemption after phase-out (Table A).
 * Exemption reduced by $1,000 for each $1,000 (or fraction) of
 * CT AGI above the phase-out start.
 */
export function computePersonalExemption(
  ctAGI: number,
  filingStatus: FilingStatus,
): { maxExemption: number; reduction: number; effectiveExemption: number }
```

The phase-out uses ceiling division: `reduction = min(maxExemption, ceil((ctAGI - start) / c(1000)) * c(1000))`.

---

## Phase 2 — Credits

### 2a. Property Tax Credit (Schedule 3)

Nonrefundable credit for property taxes paid on a primary CT residence or motor vehicle.

| Filing Status | Income Limit | Max Credit |
|---------------|-------------|-----------|
| Single / HoH | $46,300 | $300 |
| MFS | $56,500 | $300 |
| MFJ / QSS | $56,500 | $300 |

**Phase-out**: Credit reduced by 15% for each $10,000 (or fraction) over the income limit ($5,000 steps for MFS).

**Qualifying income**: Broader than CT AGI — includes nontaxable income. For Phase 1, use CT AGI as an approximation; Phase 2 can add nontaxable income components.

**Model input needed**: Property taxes paid on CT primary residence. The existing `ItemizedDeductions.realEstateTaxes` may overlap but isn't CT-specific. Options:
- (A) Add `ctPropertyTaxPaid?: number` to `StateReturnConfig`
- (B) Derive from existing `realEstateTaxes` if taxpayer address is CT

**Recommendation**: Option (A) — add a CT-specific input. The property tax credit uses a broader definition than Schedule A Line 5b (includes motor vehicle taxes). Add a simple dollar input on the CT state returns page.

### 2b. CT Earned Income Tax Credit (Schedule CT-EITC)

Refundable credit tied to the federal EITC.

```
CT EITC = (40% × federal EITC) + $250 (if qualifying children > 0)
```

**Requirements**: Full-year CT resident. Must be eligible for federal EITC.

**Implementation**: After federal computation provides `federalEITC`, multiply by 0.40. If filer has qualifying children (from dependents data), add $250.

```typescript
export function computeCTEITC(
  federalEITC: number,
  hasQualifyingChildren: boolean,
  isFullYearResident: boolean,
): number
```

### 2c. Other Credits (lower priority)

| Credit | Form | Priority | Notes |
|--------|------|----------|-------|
| Credit for taxes paid to other jurisdictions | Schedule 2 | Phase 3 | For income taxed by another state |
| CT AMT | Form CT-6251 | Phase 3 | Only if subject to federal AMT |
| Pass-Through Entity Tax Credit | Schedule CT-PE | Phase 3 | For K-1 recipients from CT PTEs |

---

## Phase 3 — State Withholding on 1099s

Currently 1099-INT, 1099-DIV, and 1099-MISC don't capture state withholding. Need to add optional fields:

```typescript
// Add to Form1099INT, Form1099DIV, Form1099MISC:
  stateWithheld?: number    // cents — state income tax withheld
  stateCode?: string        // 2-letter state code
```

For Phase 1, state withholding comes only from W-2 Box 17 (the most common case). 1099 state withholding is a Phase 3 enhancement shared across all state implementations.

---

## CT AGI Modifications — Full Reference

### Additions to Federal AGI (Schedule 1, Lines 31–37)

| Line | Item | Our Priority |
|------|------|-------------|
| 31 | Interest on non-CT state/local bonds | Phase 2 |
| 32 | Non-CT mutual fund exempt-interest dividends | Phase 2 |
| 33 | Bonus depreciation add-back (IRC §168(k)) | Phase 2 (Sch C/E users) |
| 34 | Loss on sale of CT bonds | Phase 3 |
| 35 | Lump-sum pension distributions not in federal AGI | Phase 3 |
| 37 | Other additions (rare) | Phase 3 |

### Subtractions from Federal AGI (Schedule 1, Lines 38–50)

| Line | Item | Our Priority |
|------|------|-------------|
| 38 | Interest on U.S. government obligations | **Phase 1** |
| 39 | Social Security benefits (exempt below thresholds) | Phase 2 |
| 40 | Railroad Retirement Benefits (100% exempt) | Phase 3 |
| 41 | Pension/annuity income (phased exemption) | Phase 2 |
| 42 | Military retirement pay (100% exempt) | Phase 3 |
| 44 | IRA distributions (75% deductible in 2025) | Phase 2 |
| 46 | CHET contributions ($5K single / $10K MFJ) | Phase 3 |

### Social Security Exemption Thresholds (Line 39)

| Filing Status | Full Exemption Below | Partial Exemption |
|---------------|---------------------|-------------------|
| Single / MFS / HoH | $75,000 federal AGI | Max 25% of benefits taxable above threshold |
| MFJ / QSS | $100,000 federal AGI | Max 25% of benefits taxable above threshold |

### Pension/Annuity Exemption Thresholds (Line 41)

| Filing Status | Full Exemption Below | Phase-Out Range | No Exemption Above |
|---------------|---------------------|-----------------|-------------------|
| Single / MFS / HoH | $75,000 federal AGI | $75,000–$100,000 | $100,000 |
| MFJ / QSS | $100,000 federal AGI | $100,000–$150,000 | $150,000 |

---

## Model Changes

### `src/model/types.ts`

```typescript
// Update SupportedStateCode:
export type SupportedStateCode = 'CA' | 'CT'

// Add CT-specific flags to StateReturnConfig:
export interface StateReturnConfig {
  // ... existing fields ...

  // CT-specific flags
  ctPropertyTaxPaid?: number        // cents — property taxes on CT primary residence + motor vehicle
}
```

No new data entry forms needed beyond the property tax input — CT computation derives from federal data plus the property tax amount.

---

## Engine Integration

### `src/rules/2025/ct/module.ts`

Implements `StateRulesModule` following the CA pattern:

```typescript
export const ctModule: StateRulesModule = {
  stateCode: 'CT',
  stateName: 'Connecticut',
  formLabel: 'CT Form CT-1040',
  sidebarLabel: 'CT Form CT-1040',

  compute(model, federal, config) {
    const schedule1 = computeScheduleCT1(model, federal)
    const ct1040 = computeFormCT1040(model, federal, config, schedule1)
    return toStateResult(ct1040, config)
  },

  nodeLabels: CT_NODE_LABELS,
  collectTracedValues: collectCTTracedValues,
  reviewLayout: CT_REVIEW_LAYOUT,
  reviewResultLines: CT_REVIEW_RESULT_LINES,
}
```

### Node Labels

```typescript
const CT_NODE_LABELS: Record<string, string> = {
  // Schedule 1
  'scheduleCT1.additions': 'CT Schedule 1 additions',
  'scheduleCT1.subtractions': 'CT Schedule 1 subtractions',
  'scheduleCT1.usObligationInterest': 'U.S. obligation interest (CT subtraction)',

  // Form CT-1040
  'formCT1040.ctAGI': 'Connecticut adjusted gross income',
  'formCT1040.personalExemption': 'CT personal exemption',
  'formCT1040.ctTaxableIncome': 'Connecticut taxable income',
  'formCT1040.bracketTax': 'CT tax from brackets (Table B)',
  'formCT1040.tableCAddBack': 'CT 2% rate phase-out add-back (Table C)',
  'formCT1040.tableDRecapture': 'CT benefit recapture (Table D)',
  'formCT1040.ctIncomeTax': 'Connecticut income tax',
  'formCT1040.propertyTaxCredit': 'CT property tax credit',
  'formCT1040.ctEITC': 'CT earned income tax credit',
  'formCT1040.stateWithholding': 'CT state income tax withheld',
  'formCT1040.overpaid': 'CT overpaid (refund)',
  'formCT1040.amountOwed': 'CT amount you owe',
}
```

### Review Layout

```typescript
const CT_REVIEW_LAYOUT: StateReviewSection[] = [
  {
    title: 'Income',
    items: [
      { label: 'Federal AGI', nodeId: 'formCT1040.federalAGI' },
      { label: 'Schedule 1 additions', nodeId: 'scheduleCT1.additions' },
      { label: 'Schedule 1 subtractions', nodeId: 'scheduleCT1.subtractions' },
      { label: 'CT adjusted gross income', nodeId: 'formCT1040.ctAGI' },
    ],
  },
  {
    title: 'Exemption & Taxable Income',
    items: [
      { label: 'Personal exemption (Table A)', nodeId: 'formCT1040.personalExemption' },
      { label: 'CT taxable income', nodeId: 'formCT1040.ctTaxableIncome' },
    ],
  },
  {
    title: 'Tax Computation',
    items: [
      { label: 'Tax from brackets (Table B)', nodeId: 'formCT1040.bracketTax' },
      { label: '2% rate phase-out (Table C)', nodeId: 'formCT1040.tableCAddBack' },
      { label: 'Benefit recapture (Table D)', nodeId: 'formCT1040.tableDRecapture' },
      { label: 'CT income tax', nodeId: 'formCT1040.ctIncomeTax' },
    ],
  },
  {
    title: 'Credits',
    items: [
      { label: 'Property tax credit', nodeId: 'formCT1040.propertyTaxCredit' },
      { label: 'CT EITC', nodeId: 'formCT1040.ctEITC' },
    ],
  },
  {
    title: 'Payments & Result',
    items: [
      { label: 'CT tax withheld', nodeId: 'formCT1040.stateWithholding' },
      { label: 'CT overpaid (refund)', nodeId: 'formCT1040.overpaid' },
      { label: 'CT amount you owe', nodeId: 'formCT1040.amountOwed' },
    ],
  },
]
```

### Files to modify

| File | Change |
|------|--------|
| `src/model/types.ts` | Add `'CT'` to `SupportedStateCode`; add `ctPropertyTaxPaid?` to `StateReturnConfig` |
| `src/rules/stateRegistry.ts` | Import `ctModule`, add `['CT', ctModule]` to `STATE_MODULES` |
| `src/forms/stateFormRegistry.ts` | Import `ctFormCompiler`, add `['CT', ctFormCompiler]` to `STATE_COMPILERS` |
| `src/ui/pages/StateReturnsPage.tsx` | Add CT-specific property tax input (`{code === 'CT' && (...)}`) |

The generic `StateReviewPage.tsx` and `steps.ts` require **zero changes** — they auto-generate from the registry.

---

## UX / Interview Flow

### State Selection Page

When the user selects Connecticut on the state returns page:

1. **Residency type** — radio buttons: Full-year resident / Part-year / Nonresident
2. **CT-specific inputs** (shown only for CT):
   - "Property taxes paid on CT primary residence and/or motor vehicle" — dollar input (for Schedule 3 credit)
3. For part-year residents: move-in/move-out date inputs (existing generic UI)

### Interview Step Order

The interview router in `steps.ts` auto-generates the CT review step. The natural flow:

```
... → Federal Review → State Returns Selection → CT Review → Summary/Filing
```

### CT Review Page

Rendered by the generic `StateReviewPage.tsx` using `CT_REVIEW_LAYOUT`. Five sections:

1. **Income** — Federal AGI → Schedule 1 adjustments → CT AGI
2. **Exemption & Taxable Income** — Personal exemption (with phase-out note) → CT taxable income
3. **Tax Computation** — Bracket tax + Table C + Table D = CT income tax
4. **Credits** — Property tax credit, CT EITC
5. **Payments & Result** — Withholding → refund/owed

### Explainability

Each line links to the trace graph via `nodeId`. The user can click any value to see how it was computed (e.g., clicking "Benefit recapture" shows the Table D lookup based on CT AGI).

---

## Test Plan

### Unit tests: `tests/rules/ct/formCT1040.test.ts`

**Basic scenarios (~15 tests):**

- Single, $75K wages, no adjustments → CT AGI = federal AGI, exemption = $0 (phased out), verify bracket tax + Table C + Table D
- MFJ, $120K combined wages → MFJ brackets, personal exemption = $0 (above $72K phase-out)
- Single, $25K wages → full personal exemption ($15,000), only 2% bracket applies, no Table C/D
- Zero income → $0 CT tax, full personal exemption
- Single, $40K → partial exemption phase-out, verify reduction is correct

**Bracket boundary tests (~7 tests):**

- Income at each bracket threshold → correct rate applied
- Single, $500,001 → 6.99% kicks in on the $1 over $500K
- MFJ, $1,000,001 → 6.99% on the $1 over $1M
- Single, $10,000 exactly → only 2% bracket, tax = $200

**Table C / Table D tests (~8 tests):**

- Single, $56,499 CT AGI → Table C add-back = $0
- Single, $56,500 CT AGI → Table C begins to phase in
- Single, $105,000+ CT AGI → Table C maxed at $200
- Single, $104,999 CT AGI → Table D = $0
- Single, $105,000 CT AGI → Table D begins to phase in
- Single, $150,000+ CT AGI → Table D maxed at $250
- MFJ, $210,000 CT AGI → Table D starts for MFJ
- MFJ, $300,000+ CT AGI → Table D maxed at $500

**Personal exemption phase-out tests (~5 tests):**

- Single, $29,999 CT AGI → full $15,000 exemption
- Single, $30,001 CT AGI → exemption reduced by $1,000 → $14,000
- Single, $44,000 CT AGI → exemption = $0
- MFJ, $60,000 CT AGI → exemption reduced by $12,000 → $12,000
- HoH, $38,001 → exemption reduced by $1,000 → $18,000

**Schedule 1 adjustment tests (~4 tests):**

- Treasury bond interest $5,000 → subtracted, CT AGI = federal AGI - $5,000
- No U.S. obligations → CT AGI = federal AGI
- Zero federal AGI → CT AGI = $0

**Credit tests (~6 tests):**

- Property tax credit: $4,000 taxes paid, income under limit → $300 credit
- Property tax credit: income over limit → reduced credit
- Property tax credit: income well over limit → $0 credit
- Property tax credit: no CT property → $0
- CT EITC: federal EITC $2,000, has children → $2,000 × 0.40 + $250 = $1,050
- CT EITC: federal EITC $1,000, no children → $1,000 × 0.40 = $400

**Integration tests (~5 tests):**

- Full return: W-2 $100K, CT withholding $5K → verify refund/owed
- Tech employee: $200K wages + $50K LTCG → CT taxes at ordinary rates (no preferential rate)
- High earner: $600K income → full Table C + Table D, no exemption, top bracket
- Low-income: $20K wages, CT EITC applies → refundable credit produces refund
- Multiple W-2s: sum Box 17 from all CT W-2s

**Withholding tests (~3 tests):**

- Sum of multiple W-2 Box 17 values where box15State === 'CT'
- W-2 with box15State === 'NY' excluded from CT withholding
- No state withholding → owes full CT tax

### Unit tests: `tests/rules/ct/scheduleCT1.test.ts`

- ~5 tests covering addition/subtraction scenarios

### Unit tests: `tests/rules/ct/ctCredits.test.ts`

- ~8 tests for property tax credit phase-out and CT EITC

**Total: ~66 tests across 3 test files.**

---

## Implementation Order

```
Phase 1 (Core — enables CT filing for W-2 employees)
  1. CT constants (brackets, exemptions, Tables C/D, credit limits)
  2. Schedule 1 adjustments (U.S. obligation interest subtraction)
  3. Personal exemption computation with phase-out (Table A)
  4. Table C add-back + Table D recapture computation
  5. Form CT-1040 orchestrator (tax + exemption + tables → result)
  6. CT module (StateRulesModule) + registry integration
  7. Model changes ('CT' in SupportedStateCode)
  8. UI: CT property tax input on StateReturnsPage
  9. Tests (~45 core tests)

Phase 2 (Credits + Adjustments)
  10. Property tax credit (Schedule 3) with phase-out
  11. CT EITC (40% of federal EITC + $250 child bonus)
  12. Social Security / Pension / IRA subtractions
  13. Non-CT municipal bond interest addition
  14. PDF filler for Form CT-1040
  15. Additional tests (~20)

Phase 3 (Completeness)
  16. State withholding on 1099s (model + UI + OCR) — shared across states
  17. Credit for taxes paid to other jurisdictions (Schedule 2)
  18. CT AMT (Form CT-6251) — only if subject to federal AMT
  19. Pass-through entity tax credit (Schedule CT-PE)
```

### Estimated scope

| Phase | New Files | Modified Files | Tests | Effort |
|-------|-----------|---------------|-------|--------|
| Phase 1 | 5 new | 3 modified | ~45 | Medium |
| Phase 2 | 1 new (PDF) | 2 modified | ~20 | Small |
| Phase 3 | 2 modified | 1 modified | ~10 | Small |

---

## Key Design Decisions

1. **CT computation is downstream of federal** — no circular dependency. `computeFormCT1040()` takes `Form1040Result` as input.

2. **No standard deduction** — CT uses personal exemptions only. This is a meaningful difference from the CA pattern. The code must handle the case where there is no "standard vs. itemized" choice. CT taxable income = CT AGI − personal exemption.

3. **Tables C and D are lookup computations, not bracket computations** — cannot reuse `computeBracketTax()` for these. Implement as linear interpolation between start/end thresholds. This is the most unique CT design element.

4. **Reuse federal bracket computation for Table B** — our `computeBracketTax()` from `taxComputation.ts` works with any bracket array. Pass CT brackets.

5. **CT taxes capital gains at ordinary rates** — no preferential LTCG rate, same as CA. Simplifies computation.

6. **Property tax credit input is CT-specific** — add `ctPropertyTaxPaid` to `StateReturnConfig` rather than trying to derive from federal Schedule A. The credit covers motor vehicle taxes which aren't captured federally.

7. **CT EITC depends on federal EITC** — compute federal first, then multiply. This means CT credits phase depends on federal credit computation being complete.

8. **Phase 1 covers 90%+ of target users** — a CT-resident W-2 employee with no Treasury bond interest, no pension income, and no SS benefits has zero Schedule 1 adjustments. The four-table tax computation (B + C + D) covers the core need.

---

## Validations

### Input Validations

| Field | Rule |
|-------|------|
| CT AGI | Must be ≥ 0 (negative AGI → $0 CT taxable income) |
| Property tax paid | Must be ≥ 0, optional (defaults to $0) |
| Residency type | Must be 'full-year' for Phase 1 |
| Move-in/move-out dates | Required only for part-year; move-out must be ≥ move-in |

### Computation Guards

| Guard | Action |
|-------|--------|
| CT taxable income < 0 | Clamp to $0 |
| Tax after credits < 0 | Clamp to $0 (nonrefundable credits cannot exceed tax) |
| Property tax credit > tax liability | Cap at tax liability (nonrefundable) |
| CT EITC with non-resident | Return $0 (residents only) |
| Table C/D with CT AGI below start | Return $0 |

### Cross-Validation

- If no W-2 has `box15State === 'CT'`, warn: "No CT withholding found. You may owe CT tax."
- If CT AGI > $0 but below filing threshold ($15K single, $24K MFJ), warn: "You may not need to file a CT return."

---

## Out of Scope

- **Non-resident / part-year resident** returns (Form CT-1040NR/PY) — requires Schedule CT-SI income apportionment
- **CT Alternative Minimum Tax** (Form CT-6251) — only relevant if subject to federal AMT
- **Pass-through entity tax credit** (Schedule CT-PE) — requires K-1 CT PTE data
- **CT estimated tax penalty** (Form CT-2210)
- **CHET (529) contribution subtraction** — low priority for target user
- **CT child tax credit** — does not exist for tax year 2025
- **Individual use tax** — CT-1040 Line 11 (out-of-state purchases)

---

## Differences from CA Implementation

| Aspect | CA (Form 540) | CT (Form CT-1040) |
|--------|--------------|-------------------|
| Standard deduction | Yes (CA-specific amounts) | **None** — personal exemption only |
| Deduction choice | Standard vs. itemized | No choice — exemption + optional itemized |
| Brackets | 9 brackets (1%–12.3%) | 7 brackets (2%–6.99%) |
| Surtax | 1% mental health above $1M | Tables C + D (phase-out add-back + benefit recapture) |
| Surtax mechanism | Percentage of excess income | Stepped dollar lookup by CT AGI |
| Key credit | Renter's credit ($60/$120) | Property tax credit (max $300) |
| State EITC | CalEITC (separate formula) | 40% of federal EITC + $250 |
| LTCG treatment | Ordinary rates | Ordinary rates |
| Primary adjustment | HSA add-back | U.S. obligation interest subtraction |

These differences mean the CT module shares the overall architecture pattern but requires unique implementations for the exemption phase-out, Tables C/D, and property tax credit phase-out logic.
