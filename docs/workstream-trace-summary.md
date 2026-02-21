# Workstream: Interactive Trace Demo

**Track:** 2 — Interactive Trace Demo
**Branch:** `agent/trace-demo`
**Status:** Complete

---

## Deliverables

| File | Type | Size | Description |
|---|---|---|---|
| `docs/demo/index.html` | HTML | 30 KB | Self-contained interactive trace visualization page |
| `docs/demo/trace-data.json` | JSON | 24 KB | Pre-computed trace tree for the sample return |

**Combined page weight:** ~54 KB (well under the 200 KB target).

---

## Sample Scenario

Single filer with:
- **W-2 income:** $85,000 (Acme Corp)
- **1099-INT interest:** $1,200 (Chase Bank)
- **Deduction:** Standard ($15,750 for Single, Rev. Proc. 2024-40 §3.01)

### Computed values (verified against 2025 engine constants)

| Line | Description | Amount |
|---|---|---|
| 1a | Wages, salaries, tips | $85,000.00 |
| 2b | Taxable interest | $1,200.00 |
| 9 | Total income | $86,200.00 |
| 11 | Adjusted gross income | $86,200.00 |
| 14 | Total deductions | $15,750.00 |
| 15 | Taxable income | $70,450.00 |
| 16 | Tax (3 brackets) | $10,413.00 |
| 24 | Total tax | $10,413.00 |
| 25 | Federal tax withheld | $10,800.00 |
| 33 | Total payments | $10,800.00 |
| 34 | Refund | $387.00 |

### Tax bracket detail

| Bracket | Range | Taxable amount | Tax |
|---|---|---|---|
| 10% | $0 – $11,925 | $11,925 | $1,192.50 |
| 12% | $11,925 – $48,475 | $36,550 | $4,386.00 |
| 22% | $48,475 – $70,450 | $21,975 | $4,834.50 |
| **Total** | | | **$10,413.00** |

---

## Features Implemented

### Interactive trace tree
- Form 1040 summary table with all key lines
- Click any line to expand its full computation trace
- Recursive tree rendering with animated expand/collapse
- Nodes rendered as cards with connecting tree lines

### Node type classification
- **Document source** (green border): Values extracted from W-2, 1099-INT
- **Computed value** (blue border): Values produced by the rules engine
- **User entry** (gray border): Values entered by the filer (e.g., filing status)
- Color-coded badges on every node

### Amount and formula display
- All amounts formatted as currency with tabular-nums
- Each computed node shows its formula (e.g., "Line 9 − Line 10")
- Tax bracket nodes show the explicit calculation

### IRS citation links
- Every node carries its IRS citation text
- Clicking a citation opens a detail panel with:
  - Node label and citation text
  - Formula description
  - Direct link to the IRS publication (irs.gov)
- Citations reference: Form 1040, Rev. Proc. 2024-40, Pub 501, W-2/1099 forms

### Deep trace indicator
- Expanding to depth 3+ triggers a subtle blue glow animation
- Tracks `nodesExpanded` and `maxDepthReached` for engagement metrics

### CTA buttons
- **Run with Your Data** → GitHub repo (primary CTA)
- **View Source Code** → `src/rules/` on GitHub
- **OpenClaw Plugin Docs** → plugin documentation page

### Mobile-first responsive design
- Sticky navigation on mobile screens
- Summary rows with 44px minimum touch targets
- Tree indentation scales down on narrow viewports
- All interactive elements meet WCAG touch target guidelines
- Vertical tree layout on small screens

### Accessibility
- Keyboard navigation: `tabindex="0"`, Enter/Space to activate
- `aria-expanded` state on expandable rows
- `aria-label` with meaningful descriptions
- Semantic HTML: `<nav>`, `<header>`, `<main>`, `<footer>`, `<section>`

### SEO
- Unique `<title>` and `<meta description>` with target keywords
- Open Graph tags (`og:title`, `og:description`, `og:type`, `og:url`)
- Canonical URL
- Semantic HTML structure

---

## Tech Stack

| Layer | Choice |
|---|---|
| HTML | Static, self-contained page |
| CSS | Tailwind CDN + inline `<style>` for tree structure |
| JS | Vanilla JS (IIFE, no dependencies) |
| Font | Inter via Google Fonts |
| Data | JSON file fetched at page load |

No build step required. No framework dependencies. Runs entirely in the browser.

---

## Acceptance Criteria Checklist

- [x] Demo loads with pre-computed trace data (no server required)
- [x] User can expand/collapse any trace node by clicking
- [x] Expanding to depth 3+ triggers visual indication (blue glow)
- [x] Each node displays: label, amount, source type badge, IRS citation
- [x] Trace tree accurately represents the computation path in `src/rules/engine.ts`
- [x] Page is mobile-responsive (vertical tree on < 640px)
- [x] Page includes CTAs to GitHub, standalone quickstart, and plugin docs
- [x] Total page size < 200 KB (actual: 54 KB)
- [x] No modifications to `docs/index.html` or `trust/docs` pages

---

## Trace Data Structure

The `trace-data.json` file follows the `ComputeTrace` interface from `src/rules/engine.ts`:

```json
{
  "nodeId": "form1040.line24",
  "label": "Total tax",
  "amount": 1041300,
  "formLine": "Line 24",
  "irsCitation": "Form 1040, Line 24",
  "irsUrl": "https://www.irs.gov/forms-pubs/about-form-1040",
  "sourceType": "computed",
  "formula": "Line 22 + Line 23",
  "children": [...]
}
```

Amounts are in integer cents (matching `TracedValue.amount` in `src/model/traced.ts`).
Source types map to the `ValueSource` discriminated union: `document`, `computed`, `user-entry`.
