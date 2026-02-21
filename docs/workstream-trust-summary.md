# Workstream: Trust Center & Content

**Track:** 1 of 4 — Trust Center & Content
**Branch:** `agent/trust-center`
**Date:** 2026-02-20

## Changed files

| File | Status | Description |
|------|--------|-------------|
| `docs/trust/index.html` | New | Trust Center hub page with navigation to sub-pages, methodology overview, and trust metrics |
| `docs/trust/irs-sources.html` | New | IRS publications reference table — 21 rows mapping every `src/rules/2025/*.ts` file to authoritative IRS sources |
| `docs/trust/scenarios.html` | New | 10 validated tax scenarios with specific inputs, expected outputs, computed results, and pass/fail status |
| `docs/trust/limitations.html` | New | Known limitations page — 10 unsupported items, 6 known constraints, supported forms summary, and issue reporting guide |
| `docs/trust/methodology.html` | New | Computation methodology — deterministic engine, traced values, integer arithmetic, test suite, client-side architecture, and computation flow |
| `docs/privacy.html` | New | Privacy policy — no-data-collected statement, client-side architecture explanation, IRS disclaimer |
| `docs/workstream-trust-summary.md` | New | This summary file |

## Acceptance checklist

- [x] All 6 HTML files created and render correctly
- [x] Every `src/rules/2025/*.ts` file has at least one IRS citation in the sources table
- [x] All 10 scenarios have specific dollar amounts and pass/fail status
- [x] Limitations page covers every "Not supported" item from launch plan §3c
- [x] All pages use consistent Tailwind styling matching `docs/index.html`
- [x] All pages include proper `<title>`, `<meta description>`, Open Graph tags
- [x] Internal navigation links work between all Trust Center pages
- [x] Privacy page includes IRS disclaimer
- [x] Mobile-friendly: sticky nav, responsive grids, touch-friendly targets
- [x] Footer links to Privacy, GitHub, and IRS disclaimer on all pages
- [x] `docs/index.html` not modified (owned by Track 4)
- [x] No SEO files modified (owned by Track 4)

## IRS sources coverage

All 21 rule engine files in `src/rules/2025/` are mapped to IRS sources:

| Engine file | IRS sources |
|-------------|-------------|
| `constants.ts` | Rev. Proc. 2024-40, OBBBA §70102 |
| `form1040.ts` | 2025 Form 1040 Instructions, QDCG Worksheet |
| `taxComputation.ts` | Rev. Proc. 2024-40 §3 |
| `childTaxCredit.ts` | IRC §24, Pub 972, OBBBA §70101 |
| `earnedIncomeCredit.ts` | IRC §32, Pub 596, Rev. Proc. 2024-40 §3.10 |
| `scheduleD.ts` | IRC §1(h), Pub 550, Schedule D Instructions |
| `form8949.ts` | Form 8949 Instructions |
| `washSale.ts` | IRC §1091, Pub 550 Ch. 4 |
| `scheduleA.ts` | IRC §§63, 170, 213; Pub 502, 526 |
| `hsaDeduction.ts` | IRC §223, Pub 969, Rev. Proc. 2024-25 |
| `amt.ts` | IRC §§55–59, Form 6251 Instructions |
| `educationCredit.ts` | IRC §25A, Pub 970, Form 8863 Instructions |
| `saversCredit.ts` | IRC §25B, Form 8880 Instructions |
| `dependentCareCredit.ts` | IRC §21, Form 2441 Instructions |
| `energyCredit.ts` | IRC §25C, §25D, Form 5695 Instructions |
| `iraDeduction.ts` | IRC §219, Pub 590-A |
| `studentLoanDeduction.ts` | IRC §221, Pub 970 Ch. 4 |
| `rsuAdjustment.ts` | Pub 525, Form 8949 Code B |
| `scheduleB.ts` | Schedule B Instructions |
| `scheduleE.ts` | IRC §469(i), Pub 527, Schedule E Instructions |
| `schedule1.ts` | Schedule 1 Instructions |

## Validated scenarios

| # | Scenario | Status |
|---|----------|--------|
| 1 | Single W-2 earner, standard deduction | Validated |
| 2 | MFJ, two W-2s, 2 dependents | Validated |
| 3 | Stock sales with wash sale adjustments | Validated |
| 4 | HSA contributions & distributions | Validated |
| 5 | Itemized deductions (mortgage, charity, medical) | Validated |
| 6 | Rental income with depreciation | Validated |
| 7 | AMT triggering scenario (ISO exercise) | Validated |
| 8 | EITC with qualifying children | Validated |
| 9 | Education credits (AOTC + LLC) | Validated |
| 10 | California state return (540) | Validated |

## Notes

- The methodology page (`methodology.html`) was added beyond the launch plan scope to support the Trust Center hub's "How we ensure correctness" section. It documents the deterministic engine, traced values, integer arithmetic, and test suite.
- No modifications were made to `docs/index.html` or any SEO files — those are owned by Track 4 (SEO, Analytics & Landing Page Polish).
- All pages include cross-links to each other and CTAs to GitHub and the issue tracker.
