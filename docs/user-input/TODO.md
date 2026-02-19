# OpenTax TODO

## Quick Wins
- [ ] Fix `better-sqlite3` version mismatch — `npm rebuild better-sqlite3` to unblock 53 backend tests
- [x] Add IRS 2025 fillable PDF templates to `/public/forms/` + fix field name mappings for Schedule D and Form 8949

## Medium Effort
- [ ] 1099-R support — Fidelity 401K rollover (code G = direct rollover to IRA, generally non-taxable). Needs `Form1099R` model type, parser, and UI page.
- [x] Investment interest carryforward — excess investment interest over net investment income carries forward via Form 4952. Prior-year carryforward input added to deductions model and UI.
- [ ] Granular API endpoint for itemized deductions — currently external systems must fetch/sync the entire tax return via `/api/return.json` or `/api/sync`. Add a dedicated GET/PUT endpoint for deductions.
- [ ] Accessibility pass — ARIA labels, keyboard nav, trace graph `<title>`/`<desc>` tags
- [ ] Mobile responsive fixes — Review page and trace graph layout on small screens
- [x] Better error UX — CSV parse failures and missing form templates show minimal feedback

## Bigger Features
- [ ] State tax computation (federal-only today)
- [ ] Alternative Minimum Tax (AMT) — important for RSU/ISO users
- [ ] Schedule C / Schedule SE — self-employment income
- [ ] E-filing via MeF integration (currently mail-file only)
- [ ] Multi-year support (hardcoded to 2025)
