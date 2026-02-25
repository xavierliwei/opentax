# OpenTax TODO

## IRS Rules Gaps — Form 1040 Lines

Lines that still need real computation:

### Line 8 — Other Income (via Schedule 1, Part I)
- [x] Alimony received (Line 2a, pre-2019 agreements)
- [ ] Other income: gambling, jury duty, cancellation of debt, etc. (Line 9)

### Line 10 — Adjustments to Income (via Schedule 1, Part II)
- [x] Educator expenses deduction ($300 max) (Line 11)
- [x] Self-employed SEP/SIMPLE/qualified plans (Line 16)
- [x] Self-employed health insurance deduction (Line 17)

### Line 23 — Schedule 2, Part II (Other Taxes)
- [x] Household employment taxes — Schedule H (simplified: user enters computed amount)

---

## IRS Rules Gaps — Missing Schedules & Forms

### Schedule E — Supplemental Income
- [ ] Partnership / S-corp income PDF filler for Schedule E Part II (computation + K-1 UI done; PDF output not yet generated)

### Form 6251 — Alternative Minimum Tax
- [ ] AMT credit carryforward (Form 8801)

### Form 8863 — Education Credits
- [ ] Requires Form 1098-T data model (credits compute correctly from manual input; no 1098-T OCR/import)

---

## IRS Rules Gaps — Missing Input Documents

### Form 1098-T — Tuition Statement
- [ ] Qualified tuition and fees (Box 1), scholarships/grants (Box 5)
- [ ] Needed for 1098-T OCR import (AOTC/LLC currently use manual input)

### Form 1099-NEC — Nonemployee Compensation
- [ ] Self-employment income ($600+ threshold)
- [ ] Feeds into Schedule C (Schedule C itself is implemented)

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
- [ ] Multi-year support (hardcoded to 2025)

## Infrastructure
- [ ] Enable GitHub Pages — repo Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, Folder: `/docs`. Landing page and CNAME are ready at `docs/`.

## Out of Scope
- **E-filing / MeF XML** — requires IRS enrollment and certification as an Authorized e-file Provider
- **Authentication** — product runs on localhost; single-user, no network auth needed

---

## What's Already Done

### Core Form 1040
- [x] Form 1040 Lines 1–37 (core flow complete)
- [x] QDCG tax worksheet — preferential rates for qualified dividends and LTCG
- [x] Additional standard deduction for age 65+ and blind
- [x] Dependent filer standard deduction limitation

### Schedules
- [x] Schedule A — full itemized deductions (medical floor, SALT $40K cap w/ phaseout, mortgage cap, investment interest w/ carryforward, charitable AGI limits)
- [x] Schedule B — interest and dividend summary
- [x] Schedule C — business income/loss with gross income, COGS, expenses, net profit
- [x] Schedule D — capital gains/losses with $3K loss limitation and carryforward
- [x] Schedule E Part I — rental income/loss with straight-line depreciation and PAL limitation
- [x] Schedule E Part II — K-1 passthrough income (partnership, S-corp, trust/estate) with box-to-line routing
- [x] Schedule SE — self-employment tax (15.3% on 92.35% of net SE, SS wage base cap, 50% deductible)
- [x] Schedule 1 — additional income (1099-MISC, 1099-G, Schedule C, Schedule E, SSA-1099) and adjustments (IRA, HSA, student loan, SE tax deduction)
- [x] Form 8949 — 4 categories (A/B/D/E) with adjustment codes

### Credits
- [x] Child Tax Credit + Additional CTC (Form 8812)
- [x] Earned Income Credit (EITC) — all 4 schedules
- [x] Dependent Care Credit (Form 2441)
- [x] Saver's Credit (Form 8880)
- [x] Residential Energy Credit (Form 5695, Parts I & II)
- [x] Education Credits — AOTC + LLC (Form 8863) with multi-student support
- [x] Foreign Tax Credit (Form 1116) — passive category, limitation formula, direct credit election
- [x] Premium Tax Credit (Form 8962) — APTC reconciliation, excess repayment on Schedule 2

### Additional Taxes
- [x] Alternative Minimum Tax (AMT) — Form 6251
- [x] Net Investment Income Tax (NIIT) — 3.8% surtax
- [x] Additional Medicare Tax — 0.9% on wages/SE above threshold
- [x] Self-employment tax — Schedule SE
- [x] HSA penalties (distribution 20% + excess 6%)

### Deductions & Adjustments
- [x] IRA deduction (Schedule 1, Line 20)
- [x] HSA deduction computation (Form 8889) with UI input
- [x] Student loan interest deduction (Schedule 1, Line 21) with UI input
- [x] QBI deduction — Form 8995 / 8995-A (20% of QBI, W-2 wage/UBIA limits, SSTB handling)
- [x] Estimated tax payments (Form 1040-ES) — quarterly inputs, Line 26

### Income Documents & Parsing
- [x] W-2, 1099-INT, 1099-DIV, 1099-MISC, 1099-B, 1099-G, 1099-R input with OCR
- [x] Schedule K-1 input (partnership, S-corp, trust/estate) with full box routing
- [x] Social Security benefits (SSA-1099) — taxable portion worksheet (up to 85%)

### Investment & Special
- [x] Wash sale detection (IRC §1091)
- [x] RSU basis adjustment with confidence scoring
- [x] Capital loss carryforward tracking
- [x] Investment interest carryforward (Form 4952)

### State Tax Returns (11 states + DC)
- [x] CA — Form 540 with Schedule CA
- [x] CT — Form CT-1040 with CT credits
- [x] DC — Form D-40
- [x] GA — Form 500 with Schedule GA
- [x] MA — Form 1 with adjustments
- [x] MD — Form 502
- [x] NC — Form D-400
- [x] NJ — Form NJ-1040
- [x] NY — Form IT-201
- [x] PA — Form PA-40 with Schedule SP and income classes
- [x] VA — Form 760 with Schedule ADJ and VA credits

### Infrastructure
- [x] OpenClaw plugin — 1099-G and 1099-R CRUD, agent tools, document routing
- [x] Explainability trace graph with IRS citations
- [x] PDF generation (IRS assembly order with cover sheet)
- [x] Granular API endpoint for itemized deductions
- [x] Accessibility pass (ARIA labels, keyboard nav)
- [x] Mobile responsive layout
