# Workstream: Developer Docs & Plugin Guide

**Track:** 3 of 4 (from `github-pages-launch-plan.md` §9)
**Branch:** `agent/dev-docs`
**Status:** Complete

---

## Deliverables

| File | Purpose | Status |
|------|---------|--------|
| `docs/docs/index.html` | Developer docs hub — dual-mode pitch, quick links | Done |
| `docs/docs/standalone-webapp.html` | Standalone web app quickstart with copy-to-clipboard | Done |
| `docs/docs/openclaw-plugin.html` | OpenClaw plugin integration guide — tools, API, SSE | Done |
| `docs/docs/architecture.html` | Architecture boundaries, data flow, security model | Done |

---

## Content Coverage

### Dual-mode product pitch (docs hub)
- Clearly presents the two ways to use OpenTax: standalone client-side web app vs. OpenClaw AI-agent plugin.
- Each mode has a card with description, value proposition, and link to its dedicated guide.
- Architecture diagram (ASCII) shows how both modes share TaxService and the rules engine.

### Standalone quickstart (standalone-webapp.html)
- Three-command quickstart: `git clone`, `npm install`, `npm run dev`.
- Copy-to-clipboard buttons on all code blocks.
- Feature cards covering: document import, guided interview, traceability, PDF generation, zero data transmission, state returns.
- Tech stack table (React 19, Zustand 5, Tailwind 4, Vite 6, Tesseract.js 5, pdf-lib, Vitest 3).
- Project structure tree with directory descriptions.
- Development workflow commands (test, build, lint, type-check).

### OpenClaw plugin guide (openclaw-plugin.html)
- Explains what OpenClaw is and how the protocol works.
- Installation: clone + start server + register with agent config.
- All 16 agent tools documented in four groups:
  1. Return lifecycle (create, get, delete, list)
  2. Data input (filing status, W-2, 1099, dependents, deductions, credits)
  3. Computation (compute, summary, trace)
  4. Export (PDF, JSON, dashboard)
- Example agent conversation showing tool invocation flow.
- TaxService API code sample for direct Node.js integration.
- SSE streaming events (start, progress, complete) with wire-format example.
- REST API endpoint table (method, path, description).

### Architecture guide (architecture.html)
- Three-layer system diagram: Surface (mode-specific) → TaxService (shared) → Rules Engine (shared).
- Rules engine section: computation model, dependency graph, determinism guarantees.
- Supported forms inventory with file-to-form mapping.
- Trace system: three source types (document, computed, user-entry), TraceNode JSON structure.
- Data flow comparison: standalone (browser-only) vs. plugin (agent ↔ server).
- Architectural boundaries: engine ↔ TaxService, TaxService ↔ surface, plugin ↔ agent.
- Security model for both modes.
- Testing strategy table by layer (unit, integration, HTTP, component).

---

## Design Consistency

All pages follow the patterns established in `docs/index.html`:

- **Tailwind CDN** with identical `tailwind.config` (brand colors, Inter font family).
- **Navigation:** Logo + "Home" / "Docs" links + GitHub button. Breadcrumb on sub-pages.
- **Hero section:** Gradient background (`from-gray-900 via-brand to-brand-light`), decorative blur circles.
- **Section rhythm:** `py-20 sm:py-28` vertical padding, `max-w-4xl` or `max-w-6xl` containers.
- **Cards:** `bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-blue-200`.
- **Code blocks:** Dark terminal style (`bg-gray-900 rounded-2xl`), red/yellow/green window chrome dots, green `$` prompts.
- **Footer:** Matching `MIT License | Not affiliated with the IRS | GitHub` pattern.
- **Mobile-responsive:** All grids collapse to single column on mobile, text scales with breakpoints, touch-friendly link/button sizes.

## SEO

Each page includes:
- Unique `<title>` tag (under 60 characters where possible)
- Unique `<meta name="description">` (150–160 characters)
- Open Graph tags (`og:title`, `og:description`, `og:type`, `og:url`)
- `<link rel="canonical">`
- Semantic HTML (`<header>`, `<section>`, `<nav>`, `<footer>`)
- Internal cross-links between all docs pages (minimum 2 per page)

## Acceptance Criteria (from launch plan §9, Track 3)

- [x] All HTML files render correctly in browser
- [x] Standalone guide has working copy-to-clipboard for `git clone` + `npm install` + `npm run dev`
- [x] Plugin guide documents all 16 agent tools from `openclaw-plugin/`
- [x] Plugin guide includes TaxService API usage example
- [x] Architecture diagram clearly shows standalone vs. plugin data flow
- [x] All pages use consistent Tailwind styling matching `docs/index.html`
- [x] All pages include proper `<title>`, `<meta description>`, Open Graph tags
- [x] Code blocks use syntax-highlighted styling matching landing page terminal block

---

## Files Not Modified

Per track boundaries, the following files were **not** touched:
- `docs/index.html` (owned by Track 4: SEO & Analytics)
- `docs/sitemap.xml`, `docs/robots.txt` (owned by Track 4)
- `docs/trust/*` (owned by Track 1: Trust Center)
- `docs/demo/*` (owned by Track 2: Trace Demo)
