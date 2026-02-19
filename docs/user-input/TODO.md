# OpenTax TODO

## Quick Wins
- [ ] Fix `better-sqlite3` version mismatch — `npm rebuild better-sqlite3` to unblock 53 backend tests
- [x] Add IRS 2025 fillable PDF templates to `/public/forms/` + fix field name mappings for Schedule D and Form 8949

## Medium Effort
- [ ] 1099-R support — Fidelity 401K rollover (code G = direct rollover to IRA, generally non-taxable). Needs `Form1099R` model type, parser, and UI page.
- [x] Investment interest carryforward — excess investment interest over net investment income carries forward via Form 4952. Prior-year carryforward input added to deductions model and UI.
- [x] Student loan interest deduction (Schedule 1, Line 21) — IRC §221 above-the-line deduction capped at $2,500 with MAGI-based phase-out. Integrated into Line 10 adjustments alongside IRA and HSA.
- [ ] Granular API endpoint for itemized deductions — currently external systems must fetch/sync the entire tax return via `/api/return.json` or `/api/sync`. Add a dedicated GET/PUT endpoint for deductions.
- [ ] Accessibility pass — ARIA labels, keyboard nav, trace graph `<title>`/`<desc>` tags
- [x] Mobile responsive fixes — Review page and trace graph layout on small screens
- [x] Better error UX — CSV parse failures and missing form templates show minimal feedback
- [ ] ISO exercise UI interview page — input page for ISO exercise events (data model added, computation done, just needs UI)
- [ ] AMT credit carryforward (Form 8801) — prior-year AMT paid reduces future regular tax

## Bigger Features
- [ ] State tax computation (federal-only today)
- [x] Alternative Minimum Tax (AMT) — Form 6251 computation with ISO spread, SALT add-back, 26%/28% brackets, QDCG worksheet, and exemption phase-out. Wired to Form 1040 Line 17 with full traceability.
- [ ] Schedule C / Schedule SE — self-employment income
- [ ] Multi-year support (hardcoded to 2025)
