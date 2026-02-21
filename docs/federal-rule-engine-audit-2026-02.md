# Federal Tax Rule Engine Accuracy Audit — Tax Year 2025

**Date:** 2026-02-20
**Scope:** All federal tax computation rules in `src/rules/2025/`
**Methodology:** Line-by-line review of constants and computation logic against IRS publications, Form instructions, Rev. Proc. 2024-40, and One Big Beautiful Bill Act (OBBBA, signed 2025-07-04)

---

## Executive Summary

- **28 rule files** reviewed covering Form 1040, Schedules A/B/D/E/1, Form 8949, AMT, CTC, EITC, education credits, energy credits, IRA/HSA/student loan deductions, saver's credit, dependent care credit, wash sales, and RSU adjustments
- **4 defects found** requiring code correction (all in `constants.ts`)
- **1 missing feature** identified (OBBBA senior deduction)
- **899 rule-engine tests pass**; 72 plugin test failures are unrelated (native module version mismatch)
- **Build compiles cleanly**

### Defects At a Glance

| # | Constant | File:Line | Implemented | Correct | Source |
|---|----------|-----------|------------|---------|--------|
| 1 | Standard Deduction | constants.ts:25-31 | $15,000/$30,000 | **$15,750/$31,500** | OBBBA §70102, IRS Pub 501 (2025) |
| 2 | CTC per child | constants.ts:248 | $2,000 | **$2,200** | OBBBA §70101, IRS.gov CTC page |
| 3 | Saver's Credit 10% thresholds | constants.ts:311-316 | $39,000/$58,500/$78,000 | **$39,500/$59,250/$79,000** | Rev. Proc. 2024-40 §3.10 |
| 4 | AMT 28% threshold | constants.ts:373-379 | $248,300/$124,150 | **$239,100/$119,550** | 2025 Form 6251 Instructions |

---

## Complete Rule Inventory & Accuracy Assessment

### 1. Standard Deduction (constants.ts:22-41)

**Status: NEEDS UPDATE**

| Filing Status | Implemented | Correct (OBBBA) | Delta |
|---------------|------------|------------------|-------|
| single | $15,000 | $15,750 | +$750 |
| mfj | $30,000 | $31,500 | +$1,500 |
| mfs | $15,000 | $15,750 | +$750 |
| hoh | $22,500 | $23,625 | +$1,125 |
| qw | $30,000 | $31,500 | +$1,500 |

The OBBBA §70102 increased the standard deduction by $750 (single/MFS), $1,125 (HOH), and $1,500 (MFJ/QW) above the Rev. Proc. 2024-40 base amounts, effective for tax years beginning after 2024.

Additional standard deduction (age 65+/blind) amounts are **Accurate** — unchanged by OBBBA.

**Note:** OBBBA §70103 also created a new $6,000 senior deduction for taxpayers age 65+. This is a separate provision not yet implemented. See Gap List.

**Sources:** IRS Publication 501 (2025), IRS "How to update withholding" guidance

---

### 2. Income Tax Brackets (constants.ts:43-103)

**Status: Accurate**

All 7 bracket thresholds verified for all 5 filing statuses against IRS "Federal income tax rates and brackets" (2025) and Rev. Proc. 2024-40 §3.01.

| Filing Status | Brackets Verified |
|---------------|-------------------|
| single | 10% $0, 12% $11,925, 22% $48,475, 24% $103,350, 32% $197,300, 35% $250,525, 37% $626,350 |
| mfj | 10% $0, 12% $23,850, 22% $96,950, 24% $206,700, 32% $394,600, 35% $501,050, 37% $751,600 |
| mfs | Same as single except 37% at $375,800 |
| hoh | 10% $0, 12% $17,000, 22% $64,850, 24% $103,350, 32% $197,300, 35% $250,500, 37% $626,350 |
| qw | Same as MFJ |

**Sources:** Rev. Proc. 2024-40, IRS.gov bracket page

---

### 3. Long-Term Capital Gains Brackets (constants.ts:105-139)

**Status: Accurate**

All 0%/15%/20% thresholds verified for all filing statuses.

- single: 0%→15% at $48,350, 15%→20% at $533,400
- mfj: 0%→15% at $96,700, 15%→20% at $600,050
- mfs: 0%→15% at $48,350, 15%→20% at $300,025
- hoh: 0%→15% at $64,750, 15%→20% at $566,700

**Source:** Rev. Proc. 2024-40 §3.03

---

### 4. Net Investment Income Tax (constants.ts:141-151)

**Status: Accurate**

- Rate: 3.8% — statutory (IRC §1411), not indexed
- Thresholds: single $200K, mfj $250K, mfs $125K — statutory

**Source:** IRC §1411, IRS Q&A on NIIT

---

### 5. Social Security & Medicare (constants.ts:153-166)

**Status: Accurate**

- SS wage base: $176,100 — verified
- SS rate: 6.2%, Medicare: 1.45%, Additional Medicare: 0.9% — statutory
- Additional Medicare thresholds: $200K/$250K/$125K — statutory

**Sources:** SSA Contribution and Benefit Base announcement, IRS Topic 751

---

### 6. SALT Cap & Phase-Out (constants.ts:180-206)

**Status: Accurate**

OBBBA §70120 provisions correctly implemented:
- Base cap: $40,000 ($20,000 MFS)
- Phase-out threshold: $500,000 ($250,000 MFS)
- Phase-out rate: 30%
- Floor: $10,000 ($5,000 MFS)

**Source:** OBBBA §70120, Bipartisan Policy Center analysis

---

### 7. Mortgage Interest Limits (constants.ts:208-226)

**Status: Accurate**

- Post-TCJA: $750,000 ($375,000 MFS)
- Pre-TCJA grandfathered: $1,000,000 ($500,000 MFS)

**Source:** IRC §163(h)(3), TCJA §11043

---

### 8. Charitable Contribution Limits (constants.ts:228-231)

**Status: Accurate**

- Cash: 60% AGI
- Non-cash: 30% AGI

**Source:** IRC §170(b)

---

### 9. Capital Loss Limit (constants.ts:233-242)

**Status: Accurate**

- $3,000 (single/mfj/hoh/qw), $1,500 (mfs) — statutory, not indexed

**Source:** IRC §1211(b)

---

### 10. Child Tax Credit (constants.ts:244-262)

**Status: NEEDS UPDATE**

| Constant | Implemented | Correct | Status |
|----------|------------|---------|--------|
| CTC per qualifying child | $2,000 | **$2,200** | MISMATCH |
| CTC per other dependent | $500 | $500 | Accurate |
| Refundable max per child | $1,700 | $1,700 | Accurate |
| Earned income threshold | $2,500 | $2,500 | Accurate |
| Refundable rate | 15% | 15% | Accurate |
| Phase-out single | $200,000 | $200,000 | Accurate |
| Phase-out MFJ | $400,000 | $400,000 | Accurate |

OBBBA amended IRC §24 to increase the per-child credit from $2,000 to $2,200 effective for tax years beginning after 2024.

**Sources:** IRS.gov Child Tax Credit page, OBBBA §70101

---

### 11. Earned Income Credit Schedules (constants.ts:264-290)

**Status: Accurate**

All four schedules (0–3+ children) verified:
- Maximum credits: $649/$4,328/$7,152/$8,046
- Phase-in/out rates and thresholds match Rev. Proc. 2024-40 §3.07
- Investment income limit: $11,950

**Source:** IRS EITC tables, Rev. Proc. 2024-40 §3.07

---

### 12. Dependent Care Credit (constants.ts:292-300)

**Status: Accurate**

- Expense limits: $3,000/$6,000
- Base rate: 35%, floor: 20%, AGI step: $2,000, AGI floor: $15,000
- OBBBA dependent care rate increases are effective for tax years beginning after 2025 (not 2025)

**Source:** IRC §21, IRS Publication 503 (2025)

---

### 13. Saver's Credit Thresholds (constants.ts:302-319)

**Status: NEEDS UPDATE**

The 50% and 20% AGI thresholds are correct. The 10% (maximum AGI) thresholds are too low:

| Filing Status | Implemented rate10 | Correct | Delta |
|---------------|-------------------|---------|-------|
| single/mfs | $39,000 | **$39,500** | +$500 |
| hoh | $58,500 | **$59,250** | +$750 |
| mfj/qw | $78,000 | **$79,000** | +$1,000 |

**Source:** Rev. Proc. 2024-40 §3.10, IRS Form 8880 Instructions (2025)

---

### 14. Education Credits (constants.ts:321-339)

**Status: Accurate**

- AOTC: $2,500 max, 40% refundable, 4-year limit
- LLC: $2,000 max (20% of $10,000)
- Phase-out: $80K-$90K (single), $160K-$180K (MFJ)
- OBBBA education credit expansions (5-year AOTC, $3K LLC) are effective for later tax years

**Source:** IRS Form 8863 Instructions (2025), IRC §25A

---

### 15. Energy Credits (constants.ts:341-350)

**Status: Accurate**

- Clean energy (§25D): 30%, no cap
- Improvement (§25C): 30%, $1,200 general cap, $2,000 heat pump, $600 windows, $500 doors, $150 audit
- OBBBA terminated these credits for property placed in service after Dec 31, 2025 — still valid for 2025

**Source:** IRC §25C/§25D, IRS energy credit FAQ

---

### 16. Alternative Minimum Tax (constants.ts:352-379)

**Status: NEEDS UPDATE**

| Constant | Implemented | Correct | Status |
|----------|------------|---------|--------|
| Exemption single | $88,100 | $88,100 | Accurate |
| Exemption mfj | $137,000 | $137,000 | Accurate |
| Exemption mfs | $68,500 | $68,500 | Accurate |
| Phase-out single | $626,350 | $626,350 | Accurate |
| Phase-out mfj | $1,252,700 | $1,252,700 | Accurate |
| **28% threshold** | **$248,300** | **$239,100** | MISMATCH |
| **28% threshold (mfs)** | **$124,150** | **$119,550** | MISMATCH |

The 2025 Form 6251 instructions state the 26% rate applies to the first $239,100 ($119,550 MFS) of AMTI above the exemption.

**Source:** 2025 Form 6251 Instructions, Rev. Proc. 2024-40

---

### 17. IRA Deduction (constants.ts:381-398, iraDeduction.ts)

**Status: Accurate**

- Contribution limits: $7,000 (under 50), $8,000 (50+)
- Phase-out covered single: $79,000–$89,000
- Phase-out covered MFJ: $126,000–$146,000
- Phase-out spouse covered: $236,000–$246,000
- Rounding: up to next $10 increment per IRS instructions

**Source:** IRS IRA Deduction Limits, Rev. Proc. 2024-40

---

### 18. HSA (constants.ts:400-408, hsaDeduction.ts)

**Status: Accurate**

- Self-only: $4,300, Family: $8,550, Catch-up: $1,000
- Employer contributions (W-2 Box 12 code W) correctly excluded from deduction
- 20% distribution penalty, 6% excess penalty

**Source:** Rev. Proc. 2024-25

---

### 19. Student Loan Interest (constants.ts:410-421, studentLoanDeduction.ts)

**Status: Accurate**

- Max: $2,500
- Phase-out single: $85,000–$100,000
- Phase-out MFJ: $170,000–$200,000
- MFS: ineligible

**Source:** IRS Topic 456, IRC §221

---

### 20. Passive Activity Loss (constants.ts:423-431, scheduleE.ts)

**Status: Accurate**

- $25,000 special allowance (IRC §469(i))
- Phase-out: $100,000–$150,000 MAGI
- MFS: $0 allowance

**Source:** IRC §469(i), Schedule E Instructions (2025)

---

### 21. Dependent Filer Limitation (constants.ts:433-440)

**Status: Accurate**

- Minimum deduction: $1,350
- Earned income add-on: $450

**Source:** IRS Publication 501 (2025), IRC §63(c)(5)

---

### 22. Tax Computation (taxComputation.ts)

**Status: Accurate**

- `computeBracketTax()` — progressive bracket math verified correct
- `computeQDCGTax()` — QDCG worksheet logic (preferential 0/15/20% stacked above ordinary income) matches IRS Qualified Dividends and Capital Gain Tax Worksheet

**Source:** 2025 Form 1040 Instructions, QDCG Worksheet

---

### 23. Form 1040 Orchestration (form1040.ts)

**Status: Accurate** (logic correct; uses constants that need updating)

- Lines 1a–9 (income aggregation): correct
- Line 10 (adjustments): IRA + HSA + student loan correctly summed
- Line 12 (standard vs itemized): higher-of logic correct
- Line 15 (taxable income): max(0, Line 11 - Line 14) correct
- Line 16 (tax): ordinary vs QDCG selection correct
- Lines 19-24 (credits and taxes): correctly ordered
- Lines 25-33 (payments): withholding aggregation across all 1099 types correct
- Lines 34/37 (refund/owed): correct

Note: Line 13 (QBI deduction) is a placeholder at $0 — see Gap List.

---

### 24. Schedule A — Itemized Deductions (scheduleA.ts)

**Status: Accurate**

- Medical: 7.5% AGI floor per IRC §213(a) — correct
- SALT: cap/phase-out per OBBBA §70120 — correct (see item 6)
- Mortgage interest: post-TCJA $750K limit with pre-TCJA grandfathering — correct
- Investment interest: limited to NII with carryforward — correct
- Charitable: 60% cash / 30% non-cash AGI limits — correct

---

### 25. Schedule B — Interest & Dividends (scheduleB.ts)

**Status: Accurate**

- $1,500 threshold for filing requirement — correct
- Payer listing and totaling — correct

---

### 26. Schedule D — Capital Gains/Losses (scheduleD.ts)

**Status: Accurate**

- Form 8949 category grouping (A/B/D/E) — correct
- $3,000/$1,500 loss limitation — correct
- Capital loss carryforward tracking — correct
- Capital gain distributions from 1099-DIV Box 2a — correct

---

### 27. Schedule 1 — Additional Income (schedule1.ts)

**Status: Accurate**

- State tax refund (1099-G Box 2) with tax benefit rule — correct
- Unemployment (1099-G Box 1) — correct
- Rental/royalty from Schedule E or 1099-MISC — correct

---

### 28. Schedule E — Rental Property (scheduleE.ts)

**Status: Accurate**

- 15 expense categories — correct
- Straight-line depreciation (27.5 yr residential, 39 yr commercial) — correct
- PAL limitation with $25K allowance and phase-out — correct
- Carryforward for disallowed losses — correct

---

### 29. Earned Income Credit (earnedIncomeCredit.ts)

**Status: Accurate**

- Piecewise linear schedule computation — correct
- Min of credit at earned income vs credit at AGI — correct
- MFS ineligibility — correct
- Investment income limit check — correct
- Age 25-64 requirement for 0-child filers — correct

---

### 30. Education Credits (educationCredit.ts)

**Status: Accurate**

- AOTC: 100% first $2K + 25% next $2K, 40% refundable — correct
- LLC: 20% of expenses, $10K cap — correct
- Phase-out ratio computation — correct
- MFS ineligibility — correct
- Per-student eligibility (half-time, 4-year max, prior AOTC claims) — correct

---

### 31. Dependent Care Credit (dependentCareCredit.ts)

**Status: Accurate**

- Rate schedule (35% base, -1% per $2K AGI above $15K, 20% floor) — correct
- Expense limits ($3K/$6K) — correct
- Earned income limitation — correct

---

### 32. Saver's Credit (saversCredit.ts)

**Status: Accurate** (logic correct; uses thresholds that need updating — see item 13)

- Contribution detection from IRA + W-2 Box 12 codes (D, E, AA, BB, G, H) — correct
- $2,000 per-person limit — correct
- Three-tier rate lookup — correct

---

### 33. Energy Credit (energyCredit.ts)

**Status: Accurate**

- Part I (§25D): 30% uncapped — correct
- Part II (§25C): 30% with per-category caps — correct

---

### 34. AMT (amt.ts)

**Status: Accurate** (logic correct; uses 28% threshold that needs updating — see item 16)

- AMTI computation (taxable income + SALT + ISO spread + PAB interest) — correct
- Exemption phase-out at 25% — correct
- Two-rate structure (26%/28%) — correct
- QDCG preferential rates within AMT — correct

---

### 35. NIIT, Additional Medicare Tax, Early Withdrawal Penalty (form1040.ts)

**Status: Accurate**

- NIIT: 3.8% on lesser of NII or MAGI excess — correct
- Additional Medicare: 0.9% on wages above threshold, with Form 8959 reconciliation — correct
- Early withdrawal: 10% on 1099-R code "1" distributions, exception codes honored — correct

---

### 36. Wash Sale Detection (washSale.ts)

**Status: Accurate**

- ±30-day window — correct per IRC §1091
- Same-symbol matching — correct
- Loss-only flagging — correct
- Basis adjustment on replacement shares — correct

---

### 37. RSU Adjustment (rsuAdjustment.ts)

**Status: Accurate**

- Vest-to-sale basis correction — correct
- W-2 income double-count prevention — correct
- Holding period categorization (ST/LT) — correct
- Form 8949 category assignment — correct

---

## Gap List

| # | Gap | Risk | Notes |
|---|-----|------|-------|
| 1 | QBI deduction (Line 13) | Medium | Placeholder $0. Affects sole proprietors, partnerships, S-corps. |
| 2 | OBBBA $6,000 senior deduction (§70103) | Medium | New provision for age 65+, separate from additional standard deduction. |
| 3 | Self-employment tax (Schedule SE) | Medium | Not implemented. Affects freelancers, gig workers. |
| 4 | Estimated tax penalty (Form 2210) | Low | Not computed; informational only for most filers. |
| 5 | Kiddie Tax (Form 8615) | Low | Not implemented. Affects dependents with unearned income. |
| 6 | Foreign Earned Income Exclusion (Form 2555) | Low | Not implemented. Niche use case. |
| 7 | Partnership/S-Corp K-1 income flows | Medium | Not implemented. |
| 8 | Form 1098-E integration | Low | Student loan interest is user-entered; 1098-E parsing not wired. |

---

## Test Coverage Summary

### Passing Tests
- **899 rule-engine tests pass** across 27 test files
- Coverage spans Form 1040 (lines 1-37), all implemented schedules, all credits/deductions, AMT, NIIT, Medicare, capital gains, wash sales

### Failing Tests
- **72 plugin test failures** — all caused by `better-sqlite3` native module version mismatch (NODE_MODULE_VERSION 137 vs required 141). These are infrastructure issues, not rule logic problems.

### Coverage Gaps
- Dependent care credit: basic tests only (3 scenarios), no edge cases
- Saver's credit: minimal coverage, no phase-out boundary tests
- Energy credit: minimal coverage
- No tests for OBBBA-specific standard deduction amounts
- No tests for AMT 28% threshold boundary (tests use $248,300 which is wrong)
- No tests validating CTC $2,000→$2,200 OBBBA change

---

## Build & Test Results

```
$ npm run build
> tsc -b && vite build
✓ 2043 modules transformed, built in 1.61s (no errors)
```

```
$ npx vitest run tests/rules/
 Test Files  1 failed | 29 passed (30)
      Tests  15 failed | 927 passed (942)
```

- **29 existing test files:** all pass (899 tests)
- **1 new audit test file** (`audit-high-risk.test.ts`): 28 pass, 15 fail
  - 15 failures are **expected** — they assert the correct IRS values against the 4 defective constants
  - These tests will turn green once the constants are fixed

### Audit Test Failure Breakdown
| Defect | Failing Assertions |
|--------|--------------------|
| Standard Deduction (5 statuses) | 5 failures |
| CTC per child + 3 computation tests | 4 failures |
| AMT 28% threshold (single/mfj/hoh/qw + mfs) | 2 failures |
| Saver's Credit rate10 (4 statuses) | 4 failures |

---

## Recommendations

1. **Immediate (P0):** Fix the 4 constant defects identified above. These directly affect tax computation accuracy for every return.
2. **Short-term (P1):** Add focused tests for the corrected values and boundary conditions.
3. **Medium-term (P2):** Implement OBBBA $6,000 senior deduction (§70103).
4. **Long-term (P3):** Implement QBI deduction, self-employment tax, and K-1 flows.
