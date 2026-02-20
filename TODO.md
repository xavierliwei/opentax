# OpenTax TODO

## Blockers — Computation Done, UI Missing

These features have working computation engines but **no way for users to input data**:

- [x] **HSA interview page** — coverage type, contributions, qualified expenses, age flags on Deductions page
- [x] **Student loan interest input field** — 1098-E amount input on Deductions page with phase-out warnings
- [x] **ISO exercise interview page** — exercise events input with AMT spread computation

## Quick Wins

- [x] IRA spouse coverage — `spouseCoveredByEmployerPlan` hardcoded to `false` in `iraDeduction.ts`; needs separate spouse W-2 tracking for MFJ
- [x] Form 1040 Line 1z — hardcoded to equal Line 1a (MVP comment in filler); should sum all Line 1 sub-components
- [x] Additional standard deduction for age 65+ ($2,000 single/HOH, $1,600 MFJ per person)
- [x] Additional standard deduction for blind ($2,000 single/HOH, $1,600 MFJ per person)
- [ ] Dependent filer standard deduction limitation (greater of $1,350 or earned income + $450) ← agent 1
- [ ] Estimated tax payments input — Form 1040-ES quarterly payments, sum on Line 26 ← agent 1

---

## IRS Rules Gaps — Form 1040 Lines

Lines currently returning **placeholder $0** that need real computation:

### Line 8 — Other Income (via Schedule 1, Part I)
- [x] Rents, royalties (1099-MISC) — Schedule 1 Line 5
- [x] Other income: prizes, awards (1099-MISC Box 3) — Schedule 1 Line 8z
- [ ] Taxable refunds of state/local taxes (Line 1)
- [ ] Alimony received (Line 2a, pre-2019 agreements)
- [ ] Business income/loss from Schedule C (Line 3)
- [ ] Rental, royalty, partnership, S-corp income from Schedule E (Line 5)
- [ ] Unemployment compensation — 1099-G (Line 7)
- [ ] Social Security benefits — taxable portion (Line 8, SSA-1099)
- [ ] Other income: gambling, jury duty, cancellation of debt, etc. (Line 9)

### Line 10 — Adjustments to Income (via Schedule 1, Part II)
- [x] IRA deduction — traditional IRA contribution (Line 20)
- [x] HSA deduction — Form 8889 (Line 13) — computation done, UI missing
- [x] Student loan interest deduction — $2,500 max, MAGI phase-out (Line 21) — computation done, UI missing
- [ ] Educator expenses deduction ($300 max) (Line 11)
- [ ] Self-employment tax deduction — 50% of SE tax (Line 15)
- [ ] Self-employed SEP/SIMPLE/qualified plans (Line 16)
- [ ] Self-employed health insurance deduction (Line 17)

### Line 13 — Qualified Business Income (QBI) Deduction
- [ ] QBI deduction — Form 8995 or 8995-A (20% of qualified business income, subject to W-2 wage / property limits above thresholds)

### Line 17 — Schedule 2, Part I (Additional Taxes)
- [x] Alternative Minimum Tax (AMT) — Form 6251
- [ ] Excess premium tax credit repayment — Form 8962

### Line 23 — Schedule 2, Part II (Other Taxes)
- [x] HSA penalties (distribution 20% + excess 6%) — computation done
- [ ] Net Investment Income Tax (NIIT) — 3.8% surtax on lesser of NII or MAGI above $200K/$250K. Constants defined but not wired.
- [ ] Additional Medicare tax — 0.9% on wages/SE income above $200K/$250K
- [ ] Self-employment tax — Schedule SE (15.3% on 92.35% of net SE earnings)
- [ ] Household employment taxes — Schedule H

### Line 29 — American Opportunity Credit (AOTC)
- [x] AOTC — Form 8863: up to $2,500/student. 40% refundable. Requires Form 1098-T. Phase-out $80K–$90K single, $160K–$180K MFJ.

### Line 31 — Other Payments & Refundable Credits
- [x] Lifetime Learning Credit (LLC) — Form 8863: 20% of up to $10K. Phase-out $80K–$90K.
- [ ] Premium tax credit — Form 8962 (ACA marketplace)

---

## IRS Rules Gaps — Missing Schedules & Forms

### Schedule 1 — Additional Income and Adjustments
- [x] Part I: 1099-MISC rents/royalties/other → Lines 5, 8z, 10
- [ ] Part I: remaining income types (business, rental, unemployment, SS benefits)
- [ ] Part II: remaining adjustments (educator, SE deductions)

### Schedule C — Profit or Loss from Business
- [ ] Gross income, COGS, business expenses, net profit/loss
- [ ] Feeds into Schedule 1 Line 3 and Schedule SE

### Schedule SE — Self-Employment Tax
- [ ] 15.3% on 92.35% of net SE earnings (12.4% SS + 2.9% Medicare)
- [ ] SS portion capped at wage base ($176,100 for 2025)
- [ ] 50% of SE tax deductible on Schedule 1 Line 15

### Schedule E — Supplemental Income
- [x] Rental income/loss (Part I) — with straight-line depreciation calculator
- [ ] Partnership / S-corp income (Part II, K-1)

### Form 6251 — Alternative Minimum Tax
- [x] AMT exemption amounts and phase-outs
- [x] AMTI computation (add back SALT, ISO exercise spread, etc.)
- [x] Tentative minimum tax vs regular tax
- [x] Critical for tech workers exercising ISOs
- [ ] AMT credit carryforward (Form 8801)

### Form 8863 — Education Credits
- [x] American Opportunity Credit (refundable portion)
- [x] Lifetime Learning Credit
- [ ] Requires Form 1098-T data model

### Form 1116 — Foreign Tax Credit
- [ ] Foreign taxes paid (from 1099-DIV Box 7, 1099-INT Box 6)
- [ ] Credit vs deduction election
- [ ] Limitation based on foreign-source income ratio

---

## IRS Rules Gaps — Missing Input Documents

### Form 1099-R — Distributions from Pensions, Annuities, Retirement ← agent 2
- [ ] Model type, parser, and UI page ← agent 2
- [ ] Distribution codes (code G = direct rollover, code 1 = early, code 7 = normal) ← agent 2
- [ ] Taxable amount computation (Box 2a vs gross distribution Box 1) ← agent 2
- [ ] 10% early withdrawal penalty (Form 5329) when applicable
- [ ] Immediate need: Fidelity 401K rollover (code G = non-taxable) ← agent 2

### Form 1098-T — Tuition Statement
- [ ] Qualified tuition and fees (Box 1), scholarships/grants (Box 5)
- [ ] Needed for AOTC and LLC computation

### Form 1099-G — Government Payments
- [ ] Unemployment compensation (Box 1)
- [ ] State/local tax refunds (Box 2) — taxable if prior year itemized

### SSA-1099 — Social Security Benefits
- [ ] Gross benefits, taxable portion worksheet (up to 85% taxable)

### Form 1099-NEC — Nonemployee Compensation
- [ ] Self-employment income ($600+ threshold)
- [ ] Feeds into Schedule C

### Form 1099-K — Payment Card / Third-Party Network
- [ ] Gross payment amounts (>$600 threshold for 2025)
- [ ] Reconciliation with Schedule C or other income

---

## Other Computation Gaps

### Capital Gains — Advanced Cases
- [ ] 28% rate gain (collectibles) — Schedule D worksheet
- [ ] Unrecaptured Section 1250 gain (depreciation recapture)
- [ ] Section 1202 QSBS exclusion (up to 100% of gain on qualified small business stock)

### Carryforward Tracking
- [ ] AMT credit carryforward (Form 8801)
- [ ] Charitable contribution carryforward (5-year)
- [ ] Net operating loss (NOL) carryforward

### Filing & Compliance
- [ ] Estimated tax penalty — Form 2210
- [ ] Amended return — Form 1040-X

---

## Bigger Features
- [ ] State tax computation — federal-only today; at least handle top states
- [ ] Schedule C / Schedule SE — self-employment income
- [ ] Multi-year support (hardcoded to 2025)

## Infrastructure
- [ ] Enable GitHub Pages — repo Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, Folder: `/docs`. Landing page is ready at `docs/index.html`.

## Out of Scope
- **E-filing / MeF XML** — requires IRS enrollment and certification as an Authorized e-file Provider
- **Authentication** — product runs on localhost; single-user, no network auth needed

---

## What's Already Done

- [x] Form 1040 Lines 1–37 (core flow complete)
- [x] Schedule A — full itemized deductions (medical floor, SALT $40K cap w/ phaseout, mortgage cap, investment interest w/ carryforward, charitable AGI limits)
- [x] Schedule B — interest and dividend summary
- [x] Schedule D — capital gains/losses with $3K loss limitation and carryforward
- [x] Form 8949 — 4 categories (A/B/D/E) with adjustment codes
- [x] Schedule 1 — 1099-MISC rents/royalties/other income
- [x] QDCG tax worksheet — preferential rates for qualified dividends and LTCG
- [x] Child Tax Credit + Additional CTC (Form 8812)
- [x] Earned Income Credit (EITC) — all 4 schedules
- [x] Dependent Care Credit (Form 2441)
- [x] Saver's Credit (Form 8880)
- [x] Residential Energy Credit (Form 5695, Parts I & II)
- [x] Education Credits — AOTC + LLC (Form 8863) with multi-student support
- [x] Additional standard deduction for age 65+ and blind
- [x] IRA deduction (Schedule 1, Line 20)
- [x] HSA deduction computation (Form 8889) with UI input
- [x] Student loan interest deduction (Schedule 1, Line 21) with UI input
- [x] Alternative Minimum Tax (AMT) — Form 6251
- [x] Wash sale detection (IRC §1091)
- [x] RSU basis adjustment with confidence scoring
- [x] Capital loss carryforward tracking
- [x] W-2, 1099-INT, 1099-DIV, 1099-MISC, 1099-B input with OCR
- [x] Explainability trace graph with IRS citations
- [x] PDF generation (IRS assembly order with cover sheet)
- [x] Investment interest carryforward (Form 4952)
- [x] Granular API endpoint for itemized deductions
- [x] Accessibility pass (ARIA labels, keyboard nav)
- [x] Mobile responsive layout
