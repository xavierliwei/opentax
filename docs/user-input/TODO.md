# OpenTax TODO

## Completed
- [x] IRS 2025 fillable PDF templates + field name mappings for Schedule D and Form 8949
- [x] Investment interest carryforward (Form 4952) — prior-year carryforward input added to deductions model and UI
- [x] Student loan interest deduction (Schedule 1, Line 21) — IRC §221, $2,500 cap, MAGI phase-out
- [x] Mobile responsive fixes — Review page and trace graph layout on small screens
- [x] Better error UX — CSV parse failures and missing form templates
- [x] Alternative Minimum Tax (AMT) — Form 6251 with ISO spread, SALT add-back, QDCG worksheet, exemption phase-out

## Blockers — Missing UI for Implemented Features
- [ ] HSA interview page — computation (Form 8889) is done but there's no UI to enter HSA contributions, coverage type, or 1099-SA distributions
- [ ] Student loan interest interview field — computation is done but no UI input anywhere for the 1098-E amount
- [ ] ISO exercise interview page — data model and AMT computation done, just needs an input page

## Quick Wins
- [ ] Fix `better-sqlite3` version mismatch — `npm rebuild better-sqlite3` to unblock backend tests
- [ ] IRA spouse coverage — `spouseCoveredByEmployerPlan` is hardcoded `false`; needs separate spouse W-2 tracking for MFJ
- [ ] Form 1040 Line 1z — hardcoded to equal Line 1a (MVP); should sum all Line 1 sub-components

## Medium Effort
- [ ] 1099-R support — retirement distributions (code G rollover, code 1/7 taxable). Needs Form1099R model, parser, UI page, and Schedule 1 integration. Very common form for target users.
- [ ] Granular API endpoint for itemized deductions — dedicated GET/PUT instead of full `/api/sync`
- [ ] Accessibility pass — ARIA labels, keyboard nav, trace graph `<title>`/`<desc>` tags
- [ ] AMT credit carryforward (Form 8801) — prior-year AMT paid reduces future regular tax

## Bigger Features
- [ ] State tax computation — federal-only today; at least cover top states (CA, NY, TX no-op, WA no-op)
- [ ] Schedule C / Schedule SE — self-employment income and SE tax (needed for 1099-NEC filers)
- [ ] Multi-year support — currently hardcoded to 2025
- [ ] Schedule E — rental/passive income

## Out of Scope
- E-filing — requires IRS enrollment and certification as an Authorized e-file Provider
- Authentication — product runs on localhost; no multi-user/network auth needed
