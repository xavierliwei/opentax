# OpenTax GitHub Pages Launch Plan

> **Goal:** Ship a public GitHub Pages site by **Feb 28, 2026** that drives developer adoption, builds trust in tax correctness, and showcases tracing/explainability — positioning OpenTax as the transparent alternative to commercial tax software.

---

## 1. Information Architecture

The GitHub Pages site lives at `docs/` and is served from the `feat/launch-plan-gh-pages` branch. All pages are static HTML with Tailwind CDN — no build step required for the marketing site.

```
docs/
├── index.html                 # Landing / hero page (exists)
├── favicon.svg                # Logo (exists)
├── trust/
│   ├── index.html             # Trust Center hub
│   ├── irs-sources.html       # IRS publications & citations
│   ├── scenarios.html         # Validated tax scenarios
│   └── limitations.html       # Known limitations & scope
├── demo/
│   ├── index.html             # Interactive tracing demo
│   └── trace-data.json        # Sample trace tree for demo
├── docs/
│   ├── index.html             # Developer docs hub
│   ├── standalone.html        # Standalone quickstart
│   └── openclaw-plugin.html   # OpenClaw plugin guide
├── privacy.html               # Privacy policy
├── og-image.png               # Social sharing image
├── sitemap.xml                # SEO sitemap
└── robots.txt                 # Search engine directives
```

### Page inventory

| Page | Purpose | Primary CTA |
|---|---|---|
| `/` (index) | Hero, value props, social proof | "View on GitHub" / "Try the Demo" |
| `/trust/` | Trust Center hub — why users should trust the math | "View IRS Sources" |
| `/trust/irs-sources` | Every IRS publication cross-referenced | "See Validated Scenarios" |
| `/trust/scenarios` | Worked examples with expected vs. computed output | "Try It Yourself" → GitHub |
| `/trust/limitations` | Honest scope boundaries & what's not supported | "View Supported Forms" → `/` |
| `/demo/` | Interactive trace visualization | "Clone & Run Locally" |
| `/docs/` | Developer documentation hub | "Get Started" |
| `/docs/standalone` | Standalone setup guide | `git clone` command |
| `/docs/openclaw-plugin` | OpenClaw integration guide | "Install Plugin" |
| `/privacy` | Privacy policy (no-data-collected statement) | — |

---

## 2. Positioning & Messaging

### Brand positioning statement

> OpenTax is open-source tax preparation that shows its work. Every number traces back to your source documents and the IRS rules that produced it — and all computation runs in your browser, so your data never leaves your device.

### Standalone messaging

**Primary audience:** Developers and technically-minded filers who want to understand their taxes.

| Pillar | Headline | Supporting copy |
|---|---|---|
| Transparency | "Tax prep that shows its work" | Click any line on your return to see exactly how it was computed, which IRS rule applies, and what source documents contributed. |
| Privacy | "Your data never leaves your device" | All computation runs client-side in your browser. No server, no account, no tracking. |
| Free | "Free forever — no upsells" | MIT-licensed, open-source, no premium tier. Every feature available to everyone. |
| Correctness | "Audited against IRS publications" | Deterministic rules engine with 1,300+ tests cross-referenced against Rev. Proc. 2024-40, Pub 501, and OBBBA. |

### OpenClaw plugin messaging

**Primary audience:** Developers building AI-powered tools and agents.

| Pillar | Headline | Supporting copy |
|---|---|---|
| Agent-native | "Tax filing as an agent tool" | 16 tool definitions, SSE streaming, and a REST API — purpose-built for conversational AI agents. |
| Composable | "Drop into any OpenClaw agent" | Install the plugin, point your agent at it, and get conversational tax filing with full explainability. |
| Programmatic | "TaxService API for Node.js" | Import `TaxService`, feed it data, get traced results. No UI required. |

### Competitive differentiation (implicit, never name competitors)

| OpenTax | Commercial tax software |
|---|---|
| Open-source, auditable rules | Black-box computation |
| Every number is traceable | "Trust us" |
| Client-side, zero data transmission | Cloud-based, data harvested |
| Free forever | Free tier → upsell wall |
| Deterministic engine, testable | Opaque, untestable |

---

## 3. Trust Center Content Structure

The Trust Center is the highest-leverage section for user adoption. Tax filers need to trust the math before they'll use the tool.

### 3a. IRS Publications & Citations (`/trust/irs-sources`)

Structured table mapping every OpenTax computation node to its authoritative IRS source.

| Category | Sources cited | Engine files |
|---|---|---|
| Filing status & standard deduction | Rev. Proc. 2024-40, Pub 501 | `constants.ts`, `form1040.ts` |
| Tax brackets & rates | Rev. Proc. 2024-40 §3 | `taxComputation.ts` |
| Child Tax Credit | IRC §24, Pub 972 | `childTaxCredit.ts` |
| Earned Income Credit | IRC §32, Pub 596, Rev. Proc. 2024-40 §3.10 | `earnedIncomeCredit.ts` |
| Capital gains & losses | IRC §1(h), Pub 550, Schedule D instructions | `scheduleD.ts`, `form8949.ts` |
| Itemized deductions | IRC §§63, 170, 213; Pub 502, 526 | `scheduleA.ts` |
| HSA | IRC §223, Pub 969 | `hsaDeduction.ts` |
| AMT | IRC §§55-59, Form 6251 instructions | `amt.ts` |
| Education credits | IRC §25A, Pub 970 | `educationCredit.ts` |
| Saver's Credit | IRC §25B, Form 8880 instructions | `saversCredit.ts` |
| California 540 | FTB Pub 1001, CA Rev & Tax Code | `ca/form540.ts`, `ca/constants.ts` |

**Format:** Each row links to the specific IRS publication URL and the source file on GitHub.

### 3b. Validated Tax Scenarios (`/trust/scenarios`)

Real-world scenarios with expected outputs, computed outputs, and pass/fail status.

| # | Scenario | Filing status | Key forms | Status |
|---|---|---|---|---|
| 1 | Single W-2 earner, standard deduction | Single | 1040 | Validated |
| 2 | Married filing jointly, two W-2s, 2 dependents | MFJ | 1040, Sch B | Validated |
| 3 | Stock sales with wash sale adjustments | Single | 1040, Sch D, 8949 | Validated |
| 4 | HSA contributions & distributions | Single | 1040, 8889 | Validated |
| 5 | Itemized deductions (mortgage, charity, medical) | MFJ | 1040, Sch A | Validated |
| 6 | Rental income with depreciation | Single | 1040, Sch E | Validated |
| 7 | AMT triggering scenario (ISO exercise) | Single | 1040, 6251 | Validated |
| 8 | EITC with qualifying children | HoH | 1040 | Validated |
| 9 | Education credits (AOTC + LLC) | MFJ | 1040 | Validated |
| 10 | California state return (540) | Single | 1040, CA 540 | Validated |

Each scenario page shows: inputs → computation trace → expected output → actual output → delta.

### 3c. Known Limitations (`/trust/limitations`)

Honest, specific disclosure of what OpenTax does **not** cover.

**Not supported (TY2025):**
- Schedule C (self-employment income / sole proprietorships)
- Schedule F (farming income)
- Schedule K-1 (partnerships, S-corps, estates, trusts)
- Form 2441 (child/dependent care credit — partial, employer-provided only)
- Form 8962 (Premium Tax Credit / ACA marketplace)
- Foreign income (Form 2555, FBAR, Form 8938)
- Multi-state returns (only CA 540 currently)
- E-filing (PDF download only — file via IRS Free File or mail)
- Prior-year returns (TY2025 only)
- Business returns (1120, 1120-S, 1065)

**Known constraints:**
- OCR accuracy depends on document quality; manual review always recommended
- Wash sale detection covers single-brokerage scenarios; cross-broker wash sales require manual entry
- State return support limited to California; additional states planned

**How to report issues:** Link to GitHub Issues with "tax-accuracy" label template.

---

## 4. Tracing Feature Demo Strategy

The trace/explainability view is OpenTax's strongest differentiator. The demo must make this viscerally clear.

### Interactive demo page (`/demo/`)

**Approach:** A self-contained, static HTML page with a pre-computed trace tree embedded as JSON. No server required — runs entirely in the browser.

**Demo flow:**
1. Page loads with a pre-filled sample return (Single filer, $85,000 W-2, $1,200 interest, standard deduction)
2. Shows the Form 1040 summary with computed values
3. User clicks any line (e.g., "Total Tax: $11,734")
4. Trace tree expands showing:
   - `form1040.line24` (Total tax) ← `taxComputation.taxOnIncome` ← `form1040.line15` (Taxable income)
   - Each node shows: amount, IRS citation, source type (document/computed/user-entry), confidence score
5. Clicking deeper reveals leaf nodes: W-2 Box 1 value, 1099-INT amount
6. Color coding: green = document source, blue = computed, gray = user entry

**Visual design:**
- Tree rendered as connected cards with animated expand/collapse
- Side panel shows the IRS rule text for the selected node
- Mobile-responsive: vertical tree on small screens
- "This is a demo with sample data" banner at top

**Sample trace data structure** (embedded in `trace-data.json`):
```json
{
  "nodeId": "form1040.line24",
  "label": "Total tax",
  "amount": 1173400,
  "irsCitation": "Form 1040, Line 24",
  "source": { "kind": "computed", "nodeId": "form1040.line24", "inputs": ["taxComputation.taxOnIncome", "form1040.line23"] },
  "children": [...]
}
```

### Demo CTAs
- "See the full source code" → GitHub rules engine link
- "Run with your own data" → Standalone quickstart
- "Add to your AI agent" → OpenClaw plugin docs

---

## 5. Conversion Funnel & CTAs

### Funnel stages

```
Awareness → Interest → Evaluation → Adoption
  (SEO,       (Demo,      (Trust       (Clone,
   social)     features)   Center)      install)
```

### CTA matrix

| Page | Primary CTA | Secondary CTA |
|---|---|---|
| Landing (/) | "Try the Demo" → `/demo/` | "View on GitHub" |
| Demo (/demo/) | "Run with Your Data" → `/docs/standalone` | "View Source" → GitHub |
| Trust Center (/trust/) | "Try the Demo" → `/demo/` | "View on GitHub" |
| Scenarios (/trust/scenarios) | "Run This Scenario" → GitHub quickstart | "Report an Issue" → GitHub Issues |
| Standalone docs (/docs/standalone) | `git clone` (copy-to-clipboard) | "Star on GitHub" |
| Plugin docs (/docs/openclaw-plugin) | "Install Plugin" (copy command) | "View API Reference" |

### GitHub stars as north star metric

Every page includes a GitHub star button. Target: 100 stars in first week.

### Engagement hooks
- **Trace demo completion:** User who expands 3+ trace nodes → show "Run with your data" prompt
- **Scenario exploration:** User who views 2+ scenarios → show "Clone & try it" banner
- **Developer signal:** User on `/docs/` pages → show OpenClaw plugin cross-sell

---

## 6. SEO Plan

### Target keywords

| Priority | Keyword cluster | Target page | Search intent |
|---|---|---|---|
| P0 | open source tax software | `/` | Navigational / Informational |
| P0 | free tax preparation software 2026 | `/` | Transactional |
| P0 | explainable tax computation | `/demo/` | Informational |
| P1 | transparent tax calculation | `/demo/` | Informational |
| P1 | privacy-first tax filing | `/` | Informational |
| P1 | IRS form 1040 open source | `/trust/irs-sources` | Informational |
| P1 | tax software source code | `/` → GitHub | Navigational |
| P2 | AI tax agent plugin | `/docs/openclaw-plugin` | Informational |
| P2 | tax computation engine API | `/docs/openclaw-plugin` | Informational |
| P2 | wash sale calculator open source | `/trust/scenarios` | Transactional |
| P2 | HSA tax deduction calculator | `/trust/scenarios` | Transactional |
| P2 | capital gains tax calculator open source | `/trust/scenarios` | Transactional |

### On-page SEO

**Every page must include:**
- Unique `<title>` tag (50-60 chars) with primary keyword
- Unique `<meta name="description">` (150-160 chars) with primary + secondary keywords
- `<h1>` matching the page topic (one per page)
- Semantic HTML: `<article>`, `<section>`, `<nav>`, `<header>`, `<footer>`
- Internal links to related pages (minimum 2 per page)
- Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`)
- `<link rel="canonical">` for each page

**Title tag templates:**
- Landing: `OpenTax — Free Open-Source Tax Preparation Software`
- Demo: `OpenTax Trace Demo — See How Every Tax Number Is Computed`
- Trust: `Trust Center — IRS-Validated Tax Computation | OpenTax`
- Scenarios: `Validated Tax Scenarios — OpenTax Correctness Testing`
- Limitations: `Known Limitations & Scope — OpenTax`
- Standalone: `Get Started with OpenTax — Developer Quickstart`
- Plugin: `OpenClaw Tax Plugin — AI Agent Tax Filing Integration`

### Technical SEO

- `sitemap.xml` with all pages and `lastmod` dates
- `robots.txt` allowing all crawlers
- Proper `<link rel="canonical">` on every page
- 404 page with navigation back to home
- Page load speed: target < 2s (static HTML + Tailwind CDN, no JS bundle)
- Mobile-first responsive design (already done)

### Link building (organic)

- Submit to Hacker News ("Show HN: Open-source tax prep that shows its work")
- Post to r/opensource, r/tax, r/personalfinance
- Submit to Product Hunt
- GitHub Awesome lists: awesome-self-hosted, awesome-fintech
- Dev.to / Hashnode technical blog post about the trace engine architecture

---

## 7. Analytics Events

Privacy-first analytics using [Plausible](https://plausible.io) (no cookies, GDPR-compliant, self-hostable).

### Event taxonomy

| Event name | Properties | Trigger |
|---|---|---|
| `pageview` | `path`, `referrer`, `device` | Every page load (automatic) |
| `cta_click` | `cta_id`, `page`, `destination` | Any CTA button click |
| `demo_start` | `page` | User lands on `/demo/` |
| `demo_trace_expand` | `node_id`, `depth` | User expands a trace node |
| `demo_trace_deep` | `max_depth` | User expands to depth >= 3 |
| `demo_complete` | `nodes_expanded`, `time_on_page` | User leaves demo page |
| `trust_scenario_view` | `scenario_id` | User views a specific scenario |
| `trust_irs_source_click` | `publication`, `rule_file` | User clicks an IRS source link |
| `docs_copy_command` | `command`, `page` | User copies a terminal command |
| `github_click` | `page`, `target` | User clicks any GitHub link |
| `star_click` | `page` | User clicks "Star on GitHub" |
| `nav_click` | `from`, `to` | User clicks a nav link |
| `scroll_depth` | `page`, `percent` | 25%, 50%, 75%, 100% scroll milestones |
| `external_link` | `page`, `url` | User clicks any outbound link |

### Key metrics & targets (Week 1)

| Metric | Target | Source |
|---|---|---|
| Unique visitors | 2,000 | Plausible |
| Demo page visits | 500 (25% of visitors) | Plausible |
| Demo trace expansions (depth >= 3) | 100 (20% of demo visitors) | Custom event |
| GitHub clicks | 300 (15% of visitors) | Custom event |
| GitHub stars | 100 | GitHub API |
| Trust Center visits | 400 (20% of visitors) | Plausible |
| Avg time on demo page | > 60 seconds | Plausible |
| Bounce rate | < 50% | Plausible |

### Implementation

Add the Plausible snippet to every page's `<head>`:
```html
<script defer data-domain="xavierliwei.github.io"
  src="https://plausible.io/js/script.tagged-events.js"></script>
```

Custom events fire via `plausible()` function calls on click/interaction handlers.

---

## 8. Launch Checklist (Next Week: Feb 21–28)

### Day 1–2 (Feb 21–22): Foundation

- [ ] Enable GitHub Pages on repo (Settings → Pages → Deploy from branch `main`, `/docs` folder)
- [ ] Create `docs/robots.txt` and `docs/sitemap.xml`
- [ ] Create `docs/privacy.html`
- [ ] Generate `docs/og-image.png` (1200×630 social card)
- [ ] Add Plausible analytics snippet to `docs/index.html`
- [ ] Fix existing `<title>` and `<meta description>` on landing page
- [ ] Add canonical URLs and Open Graph image tags to landing page
- [ ] Verify GitHub Pages deploys and is accessible

### Day 3–4 (Feb 23–24): Trust Center

- [ ] Create `docs/trust/index.html` — Trust Center hub page
- [ ] Create `docs/trust/irs-sources.html` — IRS publications reference table
- [ ] Create `docs/trust/scenarios.html` — Validated tax scenarios with results
- [ ] Create `docs/trust/limitations.html` — Known limitations disclosure
- [ ] Add Trust Center link to landing page navigation
- [ ] Cross-link all Trust Center pages

### Day 5 (Feb 25): Tracing Demo

- [ ] Extract sample trace data from engine into `docs/demo/trace-data.json`
- [ ] Create `docs/demo/index.html` — Interactive trace visualization
- [ ] Add "Try the Demo" CTA to landing page hero section
- [ ] Verify demo works on mobile

### Day 6 (Feb 26): Developer Docs

- [ ] Create `docs/docs/index.html` — Developer docs hub
- [ ] Create `docs/docs/standalone.html` — Standalone quickstart with copy-to-clipboard
- [ ] Create `docs/docs/openclaw-plugin.html` — OpenClaw plugin integration guide
- [ ] Add Docs link to landing page navigation

### Day 7 (Feb 27): Polish & Analytics

- [ ] Add Plausible snippet to all new pages
- [ ] Wire up custom event tracking (CTA clicks, demo interactions, GitHub clicks)
- [ ] Add scroll depth tracking to landing page and demo
- [ ] Cross-browser test (Chrome, Firefox, Safari, mobile Safari)
- [ ] Lighthouse audit: target 95+ Performance, 100 Accessibility, 100 SEO
- [ ] Verify all internal links work (no 404s)
- [ ] Update `sitemap.xml` with all final pages

### Day 8 (Feb 28): Launch

- [ ] Merge `feat/launch-plan-gh-pages` to `main`
- [ ] Verify production GitHub Pages URL works
- [ ] Submit to Hacker News ("Show HN")
- [ ] Post to r/opensource and r/personalfinance
- [ ] Share on relevant Discord / Slack communities
- [ ] Monitor Plausible analytics for first 24 hours
- [ ] Set up GitHub Issues template for "tax-accuracy" reports

---

## 9. Implementation Workstreams

Work is split into **4 non-overlapping tracks** that can be executed in parallel by independent agents. Each track owns specific files and has clear acceptance criteria. No file is touched by more than one track.

### Track 1: Trust Center & Content

**Owner:** Content agent
**Duration:** Days 3–4
**Branch:** `agent/trust-center`

**File scope:**
```
docs/trust/index.html            # new
docs/trust/irs-sources.html      # new
docs/trust/scenarios.html        # new
docs/trust/limitations.html      # new
docs/privacy.html                # new
```

**Tasks:**
1. Create Trust Center hub page with navigation to sub-pages
2. Build IRS sources reference table mapping every computation node in `src/rules/2025/*.ts` to its IRS publication
3. Write 10 validated scenario walkthroughs with inputs, expected outputs, and computed outputs
4. Write known limitations page with honest scope disclosure
5. Create privacy policy page (no-data-collected, client-side-only statement)

**Acceptance criteria:**
- [ ] All 5 HTML files render correctly in browser
- [ ] Every `src/rules/2025/*.ts` file has at least one IRS citation in the sources table
- [ ] All 10 scenarios have specific dollar amounts and pass/fail status
- [ ] Limitations page covers every "Not supported" item from §3c above
- [ ] All pages use consistent Tailwind styling matching `docs/index.html`
- [ ] All pages include proper `<title>`, `<meta description>`, Open Graph tags
- [ ] Internal navigation links work between all Trust Center pages
- [ ] Privacy page includes IRS disclaimer from current footer

### Track 2: Interactive Trace Demo

**Owner:** Demo agent
**Duration:** Day 5
**Branch:** `agent/trace-demo`

**File scope:**
```
docs/demo/index.html             # new
docs/demo/trace-data.json        # new
```

**Tasks:**
1. Extract a representative trace tree from the engine for a sample return (Single, $85K W-2, $1,200 interest, standard deduction)
2. Build self-contained HTML page with embedded trace visualization
3. Implement expand/collapse tree interaction with vanilla JS (no framework dependencies)
4. Color-code nodes by source type: document (green), computed (blue), user-entry (gray)
5. Show IRS citation and confidence score on each node
6. Add "Run with your own data" and "View source" CTAs

**Acceptance criteria:**
- [ ] Demo loads with pre-computed trace data (no server required)
- [ ] User can expand/collapse any trace node by clicking
- [ ] Expanding to depth 3+ triggers visual indication of deep trace
- [ ] Each node displays: label, amount (formatted as currency), source type badge, IRS citation
- [ ] Trace tree accurately represents the computation path in `src/rules/engine.ts`
- [ ] Page is mobile-responsive (vertical tree layout on < 640px)
- [ ] Page includes CTAs to GitHub, standalone quickstart, and plugin docs
- [ ] Total page size < 200KB (HTML + JSON + inline CSS/JS)

### Track 3: Developer Docs & Plugin Guide

**Owner:** Docs agent
**Duration:** Day 6
**Branch:** `agent/dev-docs`

**File scope:**
```
docs/docs/index.html             # new
docs/docs/standalone.html        # new
docs/docs/openclaw-plugin.html   # new
```

**Tasks:**
1. Create developer docs hub with links to standalone and plugin guides
2. Write standalone quickstart with copy-to-clipboard terminal commands
3. Write OpenClaw plugin guide covering: installation, tool definitions, TaxService API, SSE events, dashboard
4. Include architecture diagram (ASCII or inline SVG) showing standalone vs. plugin topology
5. Add code examples for common API operations

**Acceptance criteria:**
- [ ] All 3 HTML files render correctly in browser
- [ ] Standalone guide has working copy-to-clipboard for `git clone` + `npm install` + `npm run dev`
- [ ] Plugin guide documents all 16 agent tools from `openclaw-plugin/`
- [ ] Plugin guide includes TaxService API usage example
- [ ] Architecture diagram clearly shows standalone vs. plugin data flow
- [ ] All pages use consistent Tailwind styling matching `docs/index.html`
- [ ] All pages include proper `<title>`, `<meta description>`, Open Graph tags
- [ ] Code blocks use syntax-highlighted styling matching landing page terminal block

### Track 4: SEO, Analytics & Landing Page Polish

**Owner:** Growth agent
**Duration:** Days 1–2 + Day 7
**Branch:** `agent/seo-analytics`

**File scope:**
```
docs/index.html                  # modify (add CTAs, nav links, analytics, SEO tags)
docs/og-image.png                # new
docs/sitemap.xml                 # new
docs/robots.txt                  # new
```

**Tasks:**
1. Update landing page: add "Try the Demo" CTA to hero, add Trust Center + Docs nav links
2. Fix SEO: update `<title>`, add `<meta description>`, add canonical URL, add OG image tag
3. Generate Open Graph social card image (1200×630)
4. Create `sitemap.xml` with all pages
5. Create `robots.txt` with allow-all policy
6. Add Plausible analytics snippet to landing page
7. Wire up custom event tracking (CTA clicks, GitHub clicks, scroll depth)
8. Cross-browser and mobile testing for landing page changes
9. Lighthouse audit and fix any issues

**Acceptance criteria:**
- [ ] Landing page has "Try the Demo" button in hero section
- [ ] Navigation includes links to Features, Trust Center, Demo, Docs, GitHub
- [ ] `<title>` is "OpenTax — Free Open-Source Tax Preparation Software"
- [ ] `<meta description>` is 150-160 chars with target keywords
- [ ] `og:image` points to valid `og-image.png` (1200×630)
- [ ] `sitemap.xml` lists all pages with correct URLs
- [ ] `robots.txt` allows all crawlers
- [ ] Plausible snippet is present in `<head>`
- [ ] Custom events fire on CTA clicks (verified via browser console)
- [ ] Lighthouse scores: Performance 95+, Accessibility 100, SEO 100
- [ ] Landing page loads in < 2 seconds on 3G throttle

---

## Appendix A: Tech Stack for GitHub Pages Site

| Layer | Choice | Rationale |
|---|---|---|
| Hosting | GitHub Pages (from `/docs`) | Zero cost, zero config, tied to repo |
| CSS | Tailwind CDN | Matches app styling, no build step |
| JS | Vanilla JS (demo page only) | No bundle, fast load, no dependencies |
| Analytics | Plausible | Privacy-first, no cookies, GDPR-compliant |
| Font | Inter (Google Fonts) | Matches app, optimized delivery |
| Social cards | Static PNG | Predictable rendering across platforms |

## Appendix B: Post-Launch Roadmap (Week 2+)

- **Blog section** (`/blog/`) — Technical posts on rules engine architecture, trace system design
- **Comparison page** — Feature matrix vs. IRS Free File, FreeTaxUSA (factual, no competitor bashing)
- **Community page** — Contributing guide, code of conduct, GitHub Discussions link
- **Additional state support** — Add state pages as new state modules ship
- **Hosted demo** — Deploy the actual app (not just trace demo) to a subdomain for zero-install trial
- **API documentation** — Auto-generated from TypeScript types via TypeDoc
