# OpenTax TODO

_Last updated: 2026-02-19 by agent 3. Agent 4 is working on CA state tax (Form 540)._

## Completed

- [x] IRS fillable PDF templates + field mappings for all supported forms
- [x] Investment interest carryforward (Form 4952)
- [x] Student loan interest deduction (Schedule 1, Line 21) — IRC §221, $2,500 cap, MAGI phase-out
- [x] Mobile responsive fixes — Review page and trace graph layout on small screens
- [x] Better error UX — CSV parse failures and missing form templates
- [x] AMT (Form 6251) — ISO spread, SALT add-back, QDCG worksheet, exemption phase-out
- [x] HSA interview page and Form 8889 computation
- [x] Student loan interest interview field (1098-E)
- [x] ISO exercise interview page with AMT preference display
- [x] Form 1040 Line 1z — sums all Line 1 sub-components
- [x] Age 65+ and blind additional standard deduction
- [x] Education credits — AOTC + LLC (Form 8863) with multi-student support
- [x] Schedule E Part I — rental real estate income/loss with depreciation + PAL
- [x] Child Tax Credit + Additional CTC (Form 8812)
- [x] Earned Income Credit
- [x] Dependent care, saver's, and energy credits
- [x] **PDF filing package: 13 forms** — Form 1040, Schedules A/B/D/E/1/2/3, Forms 8949/6251/8812/8863/8889

---

## Critical Gap — Schedule E PDF

- [x] **Schedule E PDF filler** — template, field mappings, filler, and compiler wiring complete. 13 forms in filing package.

---

## Form 1040 Lines Still Returning $0

These lines are hardcoded to zero. Each needs: data model fields, intake/UI, rules, and 1040 filler updates.

| Line | Description | Blocking Input |
|------|-------------|----------------|
| 4a/4b | IRA distributions (taxable portion) | 1099-R support |
| 5a/5b | Pensions and annuities | 1099-R support |
| 6a/6b | Social Security benefits (85% inclusion) | SSA-1099 support |
| 13 | QBI deduction (§199A, 20% pass-through) | Schedule C / K-1 |
| 23 | Other taxes — only HSA penalty today | NIIT (3.8%), Addl Medicare (0.9%), SE tax |
| 31 | Other refundable credits | Net premium tax credit (Form 8962) |

---

## Input Documents Not Yet Supported

| Document | Feeds Into | Priority |
|----------|-----------|----------|
| **1099-R** | Lines 4a/4b, 5a/5b (IRA/pension distributions) | High — very common |
| 1099-G | Line 7 (unemployment), Schedule 1 Line 1 (state refund) | Medium — **agent 3 working** |
| SSA-1099 | Lines 6a/6b (Social Security) | Medium |
| 1099-NEC | Schedule C / SE tax | Medium |
| 1099-K | Schedule C | Low |
| 1098-T | Form 8863 (currently manual input only) | Low |

---

## Computation Gaps

### Schedule 1 — Additional Income (Part I)
- [ ] Line 1: Taxable state/local refunds (needs prior-year SALT tracking)
- [ ] Line 3: Business income/loss (Schedule C) — large effort
- [ ] Line 7: Unemployment compensation (needs 1099-G)

### Schedule 1 — Adjustments (Part II)
- [ ] Line 11: Educator expenses ($300 deduction)
- [ ] Line 15: Deductible part of SE tax (needs Schedule SE)

### Schedule 2 — Other Taxes (Part II)
- [ ] NIIT — 3.8% net investment income tax (Form 8960), kicks in at $200K/$250K
- [ ] Additional Medicare tax — 0.9% on wages > $200K/$250K (Form 8959)
- [ ] Self-employment tax (Schedule SE)

### Other
- [x] Dependent filer standard deduction limitation (greater of $1,350 or earned income + $450)
- [x] Estimated tax payments input — Form 1040-ES quarterly payments, sum on Line 26
- [ ] IRA spouse coverage — `spouseCoveredByEmployerPlan` hardcoded `false`
- [ ] AMT credit carryforward (Form 8801)

---

## Medium Effort Features

- [ ] 1099-R support — retirement distributions (rollover code G, taxable codes 1/7). Model + parser + UI + Schedule 1 integration.
- [ ] ESPP support — qualifying vs disqualifying dispositions, basis adjustment
- [ ] Accessibility pass — ARIA labels, keyboard nav, trace graph `<title>`/`<desc>` tags

## Bigger Features

- [ ] **CA state tax (Form 540)** — _agent 4 is actively working on this_
- [ ] Schedule C / Schedule SE — self-employment income and SE tax
- [ ] Multi-year support — currently hardcoded to 2025
- [ ] NQSO (non-qualified stock options) support

## Out of Scope

- E-filing (MeF) — requires IRS enrollment as Authorized e-file Provider
- Authentication — runs on localhost, no multi-user auth needed
