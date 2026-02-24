# Workstream: SEO, Analytics & Landing Page Polish

**Track:** 4 of 4 — Growth agent
**Branch:** `agent/seo-analytics`
**Date:** 2026-02-20

---

## Scope

This workstream implements Track 4 from the GitHub Pages launch plan: SEO foundations, privacy-first analytics scaffolding, and landing page messaging improvements.

### File changes

| File | Action | Description |
|---|---|---|
| `docs/index.html` | Modified | Stronger messaging, launch CTAs, nav links, social metadata, analytics snippet |
| `docs/robots.txt` | Created | Search engine directives — allow all crawlers |
| `docs/sitemap.xml` | Created | XML sitemap with all planned pages and `lastmod` dates |
| `docs/workstream-seo-summary.md` | Created | This summary document |

---

## What changed in `docs/index.html`

### SEO & metadata
- **Title** updated to `OpenTax — Free Open-Source Tax Preparation Software` (target keywords: "open source tax software", "free tax preparation")
- **Meta description** rewritten to 160 chars with primary keywords
- **Keywords meta tag** added with target keyword clusters
- **Canonical URL** added: `<link rel="canonical">`
- **Open Graph tags** completed: `og:title`, `og:description`, `og:type`, `og:url`, `og:image` (with dimensions), `og:site_name`
- **Twitter Card** tags added: `summary_large_image` card with title, description, and image

### Messaging & positioning
- **Hero subtitle** updated to mention both standalone and OpenClaw plugin use cases, with inline link to plugin docs
- **"Audited correctness" card** replaces generic "Open source" card — links to Trust Center for credibility
- **New "Two ways to use OpenTax" section** — side-by-side cards for standalone app vs. OpenClaw plugin, with feature bullets and deep links to respective docs
- **Supported forms** section updated with CA 540 card and link to limitations page

### Navigation & CTAs
- **Hero primary CTA** changed from "View on GitHub" to **"Try the Demo"** (→ `/demo/`)
- **Hero secondary CTA** remains "View on GitHub"
- **Nav bar** now includes: Features, Trust Center, Demo, Docs, GitHub
- **Footer** now includes: Trust Center, Demo, Docs, Privacy, GitHub
- **Get Started section** adds secondary "Read the docs" CTA alongside GitHub button

### Analytics scaffolding
- **Plausible snippet** added to `<head>` inside an HTML comment block (disabled by default)
  - To activate: uncomment the `<script>` tag and set `data-domain` to the production GitHub Pages domain
  - Uses `script.tagged-events.js` variant for custom event support
- **Custom event helpers** added in a commented `<script>` block at end of `<body>`:
  - `trackEvent(name, props)` — generic event dispatcher
  - `data-analytics` attribute listener for declarative CTA tracking
  - Scroll depth milestone tracking (25/50/75/100%)
- **No JavaScript runs by default** — analytics code is entirely commented out, preserving static-only hosting

---

## `docs/robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://xavierliwei.github.io/opentax/sitemap.xml
```

Allows all crawlers full access and points to the sitemap.

---

## `docs/sitemap.xml`

Lists all planned pages from the information architecture:

| Page | Priority | Change frequency |
|---|---|---|
| `/` (landing) | 1.0 | weekly |
| `/trust/` | 0.9 | monthly |
| `/trust/irs-sources.html` | 0.8 | monthly |
| `/trust/scenarios.html` | 0.8 | monthly |
| `/trust/limitations.html` | 0.7 | monthly |
| `/demo/` | 0.9 | monthly |
| `/docs/` | 0.8 | monthly |
| `/docs/standalone.html` | 0.8 | monthly |
| `/docs/openclaw-plugin.html` | 0.8 | monthly |
| `/privacy.html` | 0.4 | yearly |

All `lastmod` dates set to 2026-02-20. Update when pages are created by other tracks.

---

## What this track does NOT do

- Does **not** create Trust Center pages (`/trust/*`) — owned by Track 1
- Does **not** create Demo pages (`/demo/*`) — owned by Track 2
- Does **not** create Developer Docs pages (`/docs/*`) — owned by Track 3
- Does **not** create `privacy.html` — owned by Track 1
- Does **not** generate `og-image.png` — requires design asset creation
- Links to these pages are in place; they will resolve once the respective tracks ship

---

## Activation checklist

After all tracks merge:

- [ ] Uncomment the Plausible `<script>` tag in `index.html` `<head>` (and add to all other pages)
- [ ] Uncomment the custom event `<script>` block at end of `index.html` `<body>`
- [ ] Verify `data-domain` matches the production GitHub Pages domain
- [ ] Generate and place `og-image.png` (1200x630) in `docs/`
- [ ] Update `sitemap.xml` `lastmod` dates after all pages are live
- [ ] Run Lighthouse audit — target: Performance 95+, Accessibility 100, SEO 100
