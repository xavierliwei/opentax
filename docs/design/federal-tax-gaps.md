# Federal Tax Rule — Gap Analysis

Last updated: 2026-02-26

## Status: Implemented (Production-Ready)

### Income Types
- W-2 wages (all boxes)
- Interest income (1099-INT, Schedule B)
- Dividend income (1099-DIV, qualified vs ordinary, QDCG worksheet)
- Capital gains/losses (Schedule D, Form 8949, wash sale tracking)
- RSU income (vesting events, basis adjustment)
- ISO/stock options (AMT preference item)
- Business income (Schedule C, 30+ expense categories)
- Rental income (Schedule E, multiple properties, PAL)
- Retirement distributions (1099-R, IRA, pension, 401k)
- Social Security benefits (SSA-1099, Pub 915 three-tier taxability)
- Unemployment compensation (1099-G Box 1)
- Taxable refunds (1099-G Box 2, tax benefit rule)
- 1099-NEC / freelance income (flows to Schedule C / Schedule 1)
- 1099-MISC (prizes, awards, rents, royalties)
- K-1 income (basic pass-through — ordinary, rental, interest, dividends, capital gains)
- Health insurance marketplace (1095-A, Form 8962 PTC)

### Deductions & Adjustments
- Standard deduction (filing status, 65+, blind, dependent)
- Itemized deductions (Schedule A — medical, SALT with OBBBA phase-out, mortgage interest, charitable, other)
- IRA deduction (phaseout for active participants)
- HSA deduction (self-only, family, catch-up)
- Student loan interest ($2,500 max, phaseout)
- Self-employment tax (deductible half)
- Educator expenses ($300 max)
- SE health insurance premiums
- SEP/SIMPLE contributions
- QBI deduction (Form 8995 / 8995-A, W-2 wage / UBIA limits)
- Home office deduction (Form 8829, simplified + regular methods)

### Credits
- Child Tax Credit / ACTC (Form 8812, $2,200/child)
- Earned Income Credit (EITC, three schedules)
- Education credits (AOTC 40% refundable, LLC — Form 8863)
- Dependent care credit (Form 2441)
- Saver's credit (Form 8880)
- Foreign tax credit (Form 1116, passive income)
- Energy credits (Form 5695, solar + efficiency)
- Premium tax credit (Form 8962, IRA-enhanced subsidies)
- Excess Social Security withholding refund

### Tax Computation
- Progressive tax brackets (2025 rates, all filing statuses)
- QDCG tax worksheet (0%/15%/20% preferential rates)
- AMT (Form 6251, ISO spread, exemption phase-out)
- Self-employment tax (Schedule SE, 15.3%)
- Additional Medicare Tax (Form 8959, 0.9%)
- Net Investment Income Tax (Form 8960, 3.8%)
- Passive Activity Loss limitation (Form 8582, $25K special allowance)
- Nondeductible IRA / Roth conversions (Form 8606, pro-rata rule)

### Forms with PDF Fillers
Form 1040, Schedules 1-3/A-E/SE, Forms 2441, 4952, 5695, 6251, 8582, 8606, 8812, 8829, 8863, 8880, 8889, 8949, 8959, 8960, 8995, 8995-A, 1116

---

## Remaining Gaps

### Medium Impact

| Gap | Who it affects | Effort |
|-----|---------------|--------|
| **Form 1040-NR (Nonresident Alien)** | Foreign nationals with US income | High |
| **Schedule F (Farm Income)** | Farmers — SE variant of Schedule C | Medium |
| **Form 2555 (Foreign Earned Income Exclusion)** | US citizens/residents working abroad | Medium-High |
| **Form 4562 (Full Depreciation / MACRS)** | Business/rental owners — currently manual entry only | High |
| **Form 8839 (Adoption Credit)** | Families adopting (~$15K credit) | Low-Medium |
| **Form 8582 PAL for non-rental passive** | Partnership/S-Corp passive losses (current impl only covers rental) | Medium |
| **K-1 full tax treatment** | Partnership/S-Corp investors — data captured but simplified pass-through | High |

### Lower Impact

| Gap | Who it affects | Effort |
|-----|---------------|--------|
| **Schedule R (Elderly/Disabled Credit)** | Low-income seniors/disabled | Low |
| **Form 5329 (Excess IRA/HSA Contribution Penalties)** | Over-contributors to retirement/HSA | Low-Medium |
| **Form 6198 (At-Risk Limitations)** | Certain partnership/S-Corp investors | Medium-High |
| **NOL Carryback/Carryforward** | Business owners with net operating losses | High |
| **Form 8606 Part III (Roth Distributions)** | Early Roth withdrawals | Low |
| **Section 1231 Recapture** | Business property sales with prior-year losses | Medium |
| **Alimony UI** | Pre-2019 divorce agreements — rules exist but no intake page | Low |
| **Foreign Tax Credit (general category)** | Earned income abroad — current FTC only handles passive/investment | Medium |
| **Wash Sale Auto-Detection** | Stock traders — currently user must flag wash sales manually | Medium |

### Edge Cases / Rare
- Form 8275 (disclosure statements)
- Moving expenses (active military only)
- Gambling income as separate source (flows through "other income" today)
