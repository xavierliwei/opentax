# OpenTax TODO

## Quick Wins
- [x] Fix `better-sqlite3` version mismatch — vitest alias resolves root copy (Node 24) while openclaw-plugin keeps Node 25 binary
- [x] Add IRS 2025 fillable PDF templates to `/public/forms/` + fix field name mappings for Schedule D and Form 8949
- [x] Granular API endpoint for itemized deductions — dedicated GET/PUT instead of full return sync
- [x] Accessibility pass — ARIA labels, keyboard nav, trace graph `<title>`/`<desc>` tags
- [x] Mobile responsive fixes — Review page and trace graph layout on small screens
- [x] Better error UX — CSV parse failures and missing form templates show minimal feedback
- [x] Investment interest carryforward — excess over NII carries forward via Form 4952

---

## IRS Rules Gaps — Form 1040 Lines

Lines currently returning **placeholder $0** that need real computation:

### Line 8 — Other Income (via Schedule 1, Part I)
- [ ] Taxable refunds of state/local taxes (Line 1)
- [ ] Alimony received (Line 2a, pre-2019 agreements)
- [ ] Business income/loss from Schedule C (Line 3)
- [ ] Capital gain/loss beyond Schedule D (Line 4) — already handled
- [ ] Rental, royalty, partnership, S-corp income from Schedule E (Line 5)
- [ ] Farm income from Schedule F (Line 6)
- [ ] Unemployment compensation — 1099-G (Line 7)
- [ ] Social Security benefits — taxable portion (Line 8, SSA-1099)
- [ ] Other income: gambling, jury duty, cancellation of debt, etc. (Line 9)

### Line 10 — Adjustments to Income (via Schedule 1, Part II)
- [ ] Educator expenses deduction ($300 max) (Line 11)
- [ ] HSA deduction — Form 8889 (Line 13)
- [ ] Self-employment tax deduction — 50% of SE tax (Line 15)
- [ ] Self-employed SEP/SIMPLE/qualified plans (Line 16)
- [ ] Self-employed health insurance deduction (Line 17)
- [x] IRA deduction — traditional IRA contribution (Line 20)
- [ ] Student loan interest deduction ($2,500 max, AGI phase-out) (Line 21)

### Line 13 — Qualified Business Income (QBI) Deduction
- [ ] QBI deduction — Form 8995 or 8995-A (20% of qualified business income, subject to W-2 wage / property limits above thresholds)

### Line 17 — Schedule 2, Part I (Additional Taxes)
- [x] Alternative Minimum Tax (AMT) — Form 6251. High priority for RSU/ISO equity comp users
- [ ] Excess premium tax credit repayment — Form 8962

### Line 23 — Schedule 2, Part II (Other Taxes)
- [ ] Self-employment tax — Schedule SE (15.3% on 92.35% of net SE earnings, split SS/Medicare)
- [ ] Net Investment Income Tax (NIIT) — 3.8% surtax on lesser of NII or MAGI above $200K single / $250K MFJ (IRC §1411). Constants already defined but computation not wired.
- [ ] Additional Medicare tax — 0.9% on wages/SE income above $200K single / $250K MFJ
- [ ] Household employment taxes — Schedule H
- [ ] Repayment of first-time homebuyer credit
- [ ] IRC §965 net tax liability installment

### Line 26 — Estimated Tax Payments
- [ ] Estimated tax payments (Form 1040-ES) — quarterly payments made during the year. Need input field + sum on Line 26.

### Line 29 — American Opportunity Credit (AOTC)
- [ ] AOTC — Form 8863: up to $2,500/student (100% of first $2K + 25% of next $2K). 40% refundable ($1,000 max). Requires Form 1098-T model. Phase-out MAGI $80K–$90K single, $160K–$180K MFJ.

### Line 31 — Other Payments & Refundable Credits
- [ ] Lifetime Learning Credit (LLC) — Form 8863: 20% of up to $10,000 qualified expenses. Non-refundable. Phase-out MAGI $80K–$90K.
- [ ] Premium tax credit — Form 8962 (ACA marketplace)

---

## IRS Rules Gaps — Missing Schedules & Forms

### Schedule 1 — Additional Income and Adjustments
- [ ] Part I: lines 1–10 (other income types listed above)
- [ ] Part II: lines 11–26 (adjustments listed above)
- [ ] Wire Schedule 1 totals into Form 1040 Lines 8 and 10

### Schedule 2 — Additional Taxes
- [ ] Part I: AMT (Form 6251) + excess PTC repayment
- [ ] Part II: SE tax, NIIT, additional Medicare tax, etc.
- [ ] Wire into Form 1040 Lines 17 and 23

### Schedule 3 — Additional Credits and Payments
- [ ] Part I: Foreign tax credit (Form 1116), education credits (Form 8863), general business credit (Form 3800)
- [ ] Part II: Estimated tax payments, amount paid with extension, excess SS withholding

### Schedule C — Profit or Loss from Business
- [ ] Gross income, COGS, business expenses, net profit/loss
- [ ] Feeds into Schedule 1 Line 3 and Schedule SE

### Schedule SE — Self-Employment Tax
- [ ] 15.3% on 92.35% of net SE earnings (12.4% SS + 2.9% Medicare)
- [ ] SS portion capped at wage base ($176,100 for 2025)
- [ ] 50% of SE tax deductible on Schedule 1 Line 15

### Schedule E — Supplemental Income
- [ ] Rental income/loss (Part I)
- [ ] Partnership / S-corp income (Part II, K-1)
- [ ] Estate / trust income (Part III, K-1)

### Form 6251 — Alternative Minimum Tax
- [x] AMT exemption amounts and phase-outs
- [x] AMTI computation (add back SALT, ISO exercise spread, etc.)
- [x] Tentative minimum tax vs regular tax
- [ ] AMT credit carryforward (Form 8801)
- [x] Critical for tech workers exercising ISOs

### Form 8889 — Health Savings Accounts
- [ ] HSA contribution deduction (above-the-line)
- [ ] Employer contributions (W-2 Box 12 code W)
- [ ] Excess contribution penalty
- [ ] Distribution reporting (Form 1099-SA)

### Form 8863 — Education Credits
- [ ] American Opportunity Credit (refundable portion)
- [ ] Lifetime Learning Credit
- [ ] Requires Form 1098-T data model

### Form 1116 — Foreign Tax Credit
- [ ] Foreign taxes paid (from 1099-DIV Box 7, 1099-INT Box 6)
- [ ] Credit vs deduction election
- [ ] Limitation based on foreign-source income ratio

---

## IRS Rules Gaps — Missing Input Documents

### Form 1099-R — Distributions from Pensions, Annuities, Retirement
- [ ] Model type, parser, and UI page
- [ ] Distribution codes (code G = direct rollover, code 1 = early distribution, code 7 = normal)
- [ ] Taxable amount computation (Box 2a vs gross distribution Box 1)
- [ ] 10% early withdrawal penalty (Form 5329) when applicable
- [ ] Roth conversion tracking
- [ ] Immediate need: Fidelity 401K rollover (code G = non-taxable)

### Form 1098-T — Tuition Statement
- [ ] Qualified tuition and fees (Box 1)
- [ ] Scholarships/grants (Box 5)
- [ ] Needed for AOTC and LLC computation

### Form 1099-G — Government Payments
- [ ] Unemployment compensation (Box 1)
- [ ] State/local tax refunds (Box 2) — taxable if prior year itemized

### SSA-1099 — Social Security Benefits
- [ ] Gross benefits (Box 5)
- [ ] Taxable portion worksheet (up to 85% taxable based on combined income)

### Form 1099-SA — HSA/MSA Distributions
- [ ] Distribution reporting for HSA tax treatment

### Form 1099-NEC — Nonemployee Compensation
- [ ] Self-employment income ($600+ threshold)
- [ ] Feeds into Schedule C

### Form 1099-MISC — Miscellaneous Income
- [ ] Rents, royalties, prizes, other income
- [ ] Feeds into Schedule 1 or Schedule E

### Form 1099-K — Payment Card / Third-Party Network
- [ ] Gross payment amounts (>$600 threshold for 2025)
- [ ] Reconciliation with Schedule C or other income

---

## IRS Rules Gaps — Other Computation Gaps

### Capital Gains — Advanced Cases
- [ ] 28% rate gain (collectibles) — Schedule D worksheet
- [ ] Unrecaptured Section 1250 gain (depreciation recapture on real property)
- [ ] Section 1202 QSBS exclusion (up to 100% of gain on qualified small business stock)
- [ ] Installment sales — Form 6252
- [ ] Like-kind exchanges — Form 8824

### Additional Credits Not Implemented
- [ ] Adoption credit — Form 8839 (up to $17,280 per child for 2025)
- [ ] Elderly/disabled credit — Schedule R
- [ ] Foreign tax credit — Form 1116
- [ ] General business credit — Form 3800
- [ ] Electric vehicle credit — Form 8936

### Carryforward Tracking
- [ ] Charitable contribution carryforward (5-year for excess cash/property)
- [ ] Net operating loss (NOL) carryforward
- [ ] AMT credit carryforward (Form 8801)
- [ ] Foreign tax credit carryforward/carryback

### Filing & Compliance
- [ ] Estimated tax penalty — Form 2210 (underpayment penalty computation)
- [ ] Extension filing — Form 4868
- [ ] Amended return — Form 1040-X
- [ ] E-file / MeF XML generation
- [ ] State tax computation (federal-only today)

### Standard Deduction — Special Cases
- [ ] Additional standard deduction for age 65+ ($2,000 single/HOH, $1,600 MFJ per person)
- [ ] Additional standard deduction for blind ($2,000 single/HOH, $1,600 MFJ per person)
- [ ] Dependent filer standard deduction limitation (greater of $1,350 or earned income + $450, capped at regular std deduction)

---

## Bigger Features
- [ ] State tax computation (federal-only today)
- [x] Alternative Minimum Tax (AMT) — important for RSU/ISO users
- [ ] Schedule C / Schedule SE — self-employment income
- [ ] Multi-year support (hardcoded to 2025)
- [ ] E-file / MeF XML generation for electronic filing

---

## What's Already Done (for reference)

- [x] Form 1040 Lines 1–37 (core flow complete, 5 placeholder lines remain)
- [x] Schedule A — full itemized deductions (medical 7.5% floor, SALT $40K cap w/ phaseout, mortgage interest cap, investment interest w/ carryforward, charitable AGI limits)
- [x] Schedule B — interest and dividend summary
- [x] Schedule D — capital gains/losses with $3K loss limitation and carryforward
- [x] Form 8949 — 4 categories (A/B/D/E) with adjustment codes
- [x] QDCG tax worksheet — preferential rates for qualified dividends and LTCG
- [x] Child Tax Credit + Additional CTC (Form 8812)
- [x] Earned Income Credit (EITC) — all 4 schedules
- [x] Dependent Care Credit (Form 2441)
- [x] Saver's Credit (Form 8880)
- [x] Residential Energy Credit (Form 5695, Parts I & II)
- [x] IRA deduction — traditional IRA contribution (Schedule 1, Line 20 → Form 1040 Line 10)
- [x] Alternative Minimum Tax (AMT) — Form 6251
- [x] Wash sale detection (IRC §1091)
- [x] RSU basis adjustment with confidence scoring
- [x] Capital loss carryforward tracking
- [x] W-2, 1099-INT, 1099-DIV, 1099-B input with OCR
- [x] Explainability trace graph with IRS citations
- [x] PDF generation (IRS assembly order)
