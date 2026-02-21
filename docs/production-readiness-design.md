# OpenTax — Production Readiness Design Document

Last updated: 2026-02-20

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture & Runtime Assumptions](#2-architecture--runtime-assumptions)
3. [Security & Privacy Model](#3-security--privacy-model)
4. [Authentication & Access Control](#4-authentication--access-control)
5. [Data Storage & Encryption](#5-data-storage--encryption)
6. [Secret Management](#6-secret-management)
7. [Environment & Configuration Strategy](#7-environment--configuration-strategy)
8. [Observability](#8-observability)
9. [Error Budgets & SLOs](#9-error-budgets--slos)
10. [Reliability & Scaling](#10-reliability--scaling)
11. [CI/CD & Release Strategy](#11-cicd--release-strategy)
12. [Migrations & Versioning](#12-migrations--versioning)
13. [Feature Flags](#13-feature-flags)
14. [Compliance & Legal](#14-compliance--legal)
15. [Backup & Disaster Recovery](#15-backup--disaster-recovery)
16. [Incident Response & Runbooks](#16-incident-response--runbooks)
17. [QA Strategy](#17-qa-strategy)
18. [Accessibility](#18-accessibility)
19. [Internationalization Readiness](#19-internationalization-readiness)
20. [Cost Controls](#20-cost-controls)
21. [Phased Rollout Plan](#21-phased-rollout-plan)
22. [Risk Register](#22-risk-register)
23. [30/60/90-Day Execution Plan](#23-306090-day-execution-plan)

---

## 1. Executive Summary

OpenTax is an open-source, privacy-first US federal and state tax preparation application. Today it runs as a localhost dev tool: a Vite+React SPA performing all tax computation client-side, with an optional Node.js backend (SQLite) for the OpenClaw AI plugin. There is no authentication, no hosted infrastructure, no CI/CD pipeline, and no multi-user support.

This document defines the concrete steps to take OpenTax from its current state to a production-grade hosted service that can serve real taxpayers during the 2026 filing season (Jan–Apr 2027 for TY2026).

**Key architectural decision:** OpenTax's core privacy guarantee — *all tax computation happens client-side; no PII leaves the browser* — is a product differentiator and must be preserved in production. The hosted service is a static-asset CDN deployment, not a server-side application. The optional backend (OpenClaw plugin, sync, backup) is a separate, opt-in tier.

### Current State

| Dimension | Status |
|---|---|
| Computation engine | Complete: Form 1040, 10+ schedules, CA state, AMT, credits, wash sales, RSU adjustment |
| PDF generation | Complete: client-side IRS PDF filling, correct assembly order, cover sheet |
| UI/UX | Complete: 39-step interview, OCR upload, CSV import, explainability trace, mobile responsive |
| Testing | ~895 unit/integration tests (Vitest), E2E framework (Playwright) |
| Auth | None |
| CI/CD | None |
| Hosting | localhost only |
| Observability | None |
| Multi-user | No (single IndexedDB store) |

### Target State (GA)

| Dimension | Target |
|---|---|
| Hosting | Static SPA on CDN (Cloudflare Pages or Vercel), zero-server for core flow |
| Auth | Optional accounts for cloud backup/sync (OAuth via GitHub/Google) |
| Data privacy | All computation client-side, encrypted backup opt-in |
| CI/CD | GitHub Actions: lint → test → build → preview → deploy |
| Observability | Client-side error tracking (Sentry), anonymous usage analytics (Plausible/PostHog) |
| Compliance | Privacy policy, terms of service, IRS disclaimers, SOC 2 Type I readiness |
| Availability | 99.9% for static assets during filing season (Jan–Apr) |

---

## 2. Architecture & Runtime Assumptions

### 2.1 Deployment Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        CDN Edge (Cloudflare/Vercel)             │
│  Static assets: HTML, JS, CSS, IRS PDF templates, WASM (OCR)   │
│  Cache: immutable hashed bundles, long TTL                      │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────────┐
│                         User's Browser                          │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │
│  │  React   │  │  Zustand  │  │  Rules     │  │  pdf-lib     │  │
│  │  UI      │  │  Store    │  │  Engine    │  │  PDF fill    │  │
│  └────┬─────┘  └────┬─────┘  └────────────┘  └──────────────┘  │
│       │              │                                          │
│       │              ▼                                          │
│       │         IndexedDB (encrypted at rest via browser)       │
│       │                                                         │
│       ▼ (opt-in only)                                           │
│  ┌──────────────────────────────────────────────┐               │
│  │  Sync Adapter → encrypted blob upload        │               │
│  └──────────────────────────┬───────────────────┘               │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTPS (opt-in)
┌─────────────────────────────▼───────────────────────────────────┐
│                   Backup Service (Tier 2)                        │
│  Auth: OAuth (GitHub/Google) → JWT                              │
│  Storage: encrypted blob in S3/R2 (user-derived key)            │
│  API: PUT /backup, GET /backup, DELETE /backup                  │
│  Zero knowledge: server cannot decrypt tax data                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Runtime Assumptions

| Assumption | Detail |
|---|---|
| **Browser support** | Chrome 90+, Firefox 90+, Safari 15+, Edge 90+. No IE11. |
| **JavaScript required** | SPA; no SSR. Progressive enhancement not feasible for tax computation. |
| **IndexedDB available** | Required for persistence. Detect and show clear error if unavailable (private browsing on some browsers). |
| **WASM support** | Required for Tesseract.js OCR. Graceful fallback: manual entry if WASM blocked. |
| **Network** | Required only for initial page load + PDF template fetch. All computation offline-capable after load. |
| **PDF templates** | Bundled as static assets. ~15 MB total for all federal + CA forms. Loaded lazily on demand. |
| **Memory** | Peak ~200 MB for large returns (100+ 8949 transactions + OCR). Target: <150 MB for typical returns. |
| **Bundle size** | Current: ~800 KB gzipped (estimate). Target: <1 MB gzipped with code splitting. |

### 2.3 Service Boundaries

| Service | Owner | SLA | Stateful? |
|---|---|---|---|
| CDN (static assets) | Infra | 99.9% | No |
| Browser runtime | Client device | N/A | Yes (IndexedDB) |
| Backup API (Tier 2) | Backend | 99.5% | Yes (S3/R2) |
| OpenClaw plugin | Plugin | Best effort | Yes (SQLite) |

---

## 3. Security & Privacy Model

### 3.1 Threat Model

**Assets to protect:**
- PII: SSN, name, address, date of birth (taxpayer, spouse, dependents)
- Financial data: income, deductions, credits, capital transactions, bank accounts
- Generated PDFs: complete tax returns ready to file

**Threat actors:**
- Network attackers (MITM, CDN compromise)
- XSS / supply chain injection (npm dependencies)
- Malicious browser extensions
- Physical access to user device
- Cloud storage breach (if backup enabled)

### 3.2 Security Controls

#### Client-Side (Core)

| Control | Implementation |
|---|---|
| **No server-side PII** | Tax data never leaves the browser in the core flow. No analytics contain PII. |
| **Content Security Policy** | Strict CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'`. No inline scripts. |
| **Subresource Integrity** | SRI hashes on all script/link tags in `index.html`. |
| **HTTPS only** | HSTS header with 1-year max-age, includeSubDomains, preload. |
| **XSS prevention** | React's default escaping. No `dangerouslySetInnerHTML`. CSP blocks inline scripts. |
| **Dependency auditing** | `npm audit` in CI. Dependabot/Renovate for automated CVE alerts. Pin exact versions in `package-lock.json`. |
| **SSN handling** | Masked in UI (show last 4). Full SSN only written to PDF blob. Never logged, never in URL params, never in error reports. |
| **PDF handling** | Generated PDFs held in memory (Blob URL), revoked after download. Not persisted to IndexedDB. |

#### Backup Service (Tier 2)

| Control | Implementation |
|---|---|
| **Zero-knowledge encryption** | Tax data encrypted client-side with a key derived from user's password (PBKDF2, 600K iterations, SHA-256). Server stores only the encrypted blob. |
| **Auth** | OAuth 2.0 (GitHub, Google) for identity. Short-lived JWTs (15 min access, 7-day refresh). |
| **Transport** | TLS 1.3 only. Certificate pinning for mobile (future). |
| **Storage** | Encrypted blobs in Cloudflare R2 (or AWS S3). Server-side encryption at rest (AES-256) as defense-in-depth on top of client-side encryption. |
| **Data retention** | User can delete at any time. Auto-purge 3 years after last access (with email warning 30 days prior). |
| **Rate limiting** | 10 backup writes/hour per user. 100 reads/hour. |

### 3.3 Supply Chain Security

| Measure | Detail |
|---|---|
| **Lockfile integrity** | `package-lock.json` checked into git. CI fails if lockfile out of sync. |
| **Dependency review** | New dependencies require explicit approval in PR review. Prefer zero-dependency or well-audited packages. |
| **SBOM** | Generate SBOM (CycloneDX format) on each release. Publish alongside release artifacts. |
| **Reproducible builds** | Pin Node.js version (`.nvmrc`). Use `npm ci` (not `npm install`) in CI. |
| **Canary checks** | Post-deploy: verify `index.html` SRI hashes match build output. Alert on mismatch. |

---

## 4. Authentication & Access Control

### 4.1 Tiers

| Tier | Auth Required | Capabilities |
|---|---|---|
| **Anonymous (core)** | None | Full tax preparation, computation, PDF download. All data in browser IndexedDB. |
| **Authenticated (optional)** | OAuth (GitHub/Google) | Cloud backup/restore, cross-device sync, data export. |
| **Admin** | OAuth + role claim | Feature flag management, error dashboard, release controls. |

### 4.2 Auth Flow (Tier 2)

```
User clicks "Back up my data" →
  1. OAuth redirect (GitHub/Google) → authorization code
  2. Code exchanged for tokens at /api/auth/callback
  3. Server issues:
     - Access token (JWT, 15 min, HttpOnly cookie, SameSite=Strict)
     - Refresh token (opaque, 7 days, HttpOnly cookie, SameSite=Strict)
  4. Client encrypts TaxReturn JSON with user-derived key
  5. Client PUTs encrypted blob to /api/backup
  6. On restore: GET /api/backup → decrypt client-side → hydrate Zustand store
```

### 4.3 Authorization Model

Minimal RBAC:

| Role | Permissions |
|---|---|
| `user` | CRUD own backup, read own profile, delete own account |
| `admin` | Manage feature flags, view aggregated (non-PII) metrics, trigger deploys |

No multi-user collaboration. No sharing of tax returns between accounts. Each account owns exactly one backup per tax year.

### 4.4 Session Management

- Access tokens: 15-minute expiry, auto-refresh via refresh token.
- Refresh tokens: 7-day expiry, rotated on use (one-time use).
- Logout: clear both cookies, revoke refresh token server-side.
- Idle timeout: 30-minute inactivity → prompt to re-authenticate before backup operations.

---

## 5. Data Storage & Encryption

### 5.1 Client-Side Storage

| Store | Contents | Encryption | Retention |
|---|---|---|---|
| **IndexedDB** | `TaxReturn` JSON (Zustand persist) | Browser-managed (OS-level disk encryption). Not application-encrypted by default — see 5.3. | Until user clears browser data or clicks "Start Over". |
| **Memory** | `ComputeResult`, PDF blobs | N/A (volatile) | Session only. |
| **SessionStorage** | Interview step position | None (non-sensitive) | Tab session only. |

### 5.2 Server-Side Storage (Backup Service)

| Store | Contents | Encryption | Retention |
|---|---|---|---|
| **Cloudflare R2 / S3** | Encrypted backup blob (per user, per tax year) | Client-side: AES-256-GCM (user-derived key). Server-side: S3 SSE-S3 (defense-in-depth). | Until user deletes or 3-year auto-purge. |
| **Auth DB (Postgres/D1)** | User ID, OAuth provider ID, email, created_at, last_backup_at | Column-level encryption for email. | Until account deletion + 30-day grace period. |

### 5.3 Optional Client-Side Encryption (Future Enhancement)

For users on shared computers, offer an optional passphrase to encrypt IndexedDB contents:

```
User sets passphrase →
  PBKDF2(passphrase, random salt, 600K iterations) → AES-256-GCM key
  Encrypt TaxReturn JSON before IndexedDB write
  Decrypt on read (prompt for passphrase on page load)
```

This is a Tier 2 feature — not required for MVP.

### 5.4 Data Classification

| Classification | Examples | Handling |
|---|---|---|
| **Restricted** | SSN, full name + SSN, complete tax return | Never transmitted unencrypted. Never logged. Never in error reports. Masked in UI. |
| **Confidential** | Income amounts, deductions, addresses | Kept client-side. If backed up, encrypted. Excluded from analytics. |
| **Internal** | Feature flag states, anonymous usage events | May be transmitted to analytics. No PII. |
| **Public** | Tax brackets, IRS form templates, app version | Freely cacheable. |

---

## 6. Secret Management

### 6.1 Secrets Inventory

| Secret | Where Used | Storage |
|---|---|---|
| OAuth client secrets (GitHub, Google) | Backup API auth callback | Environment variable on deploy platform (Cloudflare Workers secrets / Vercel env) |
| JWT signing key | Backup API token issuance | Environment variable, rotated quarterly |
| R2/S3 access keys | Backup API blob storage | Environment variable (or Workers binding for R2) |
| Sentry DSN | Client-side error reporting | Bundled in build (non-sensitive — DSN is a public write key, not a secret) |
| Analytics write key | Client-side analytics | Bundled in build (non-sensitive — write-only) |

### 6.2 Secret Hygiene

- **No secrets in git.** `.env` files are in `.gitignore`. CI secrets stored in GitHub Secrets or deploy platform's secret manager.
- **No secrets in client bundles.** Only public write-only DSNs/keys are bundled. OAuth client secrets are server-side only.
- **Rotation schedule:** JWT signing key rotated quarterly. OAuth secrets rotated annually. Old keys kept valid for 24 hours during rotation (grace period).
- **Least privilege:** R2/S3 keys scoped to single bucket, single prefix. No wildcard policies.

---

## 7. Environment & Configuration Strategy

### 7.1 Environments

| Environment | URL | Purpose | Deploy Trigger |
|---|---|---|---|
| **Local dev** | `localhost:5173` | Development with hot reload | Manual (`npm run dev`) |
| **Preview** | `preview-{branch}.opentax.dev` | PR preview deployments | Automatic on PR open/update |
| **Staging** | `staging.opentax.dev` | Pre-production validation | Automatic on merge to `main` |
| **Production** | `app.opentax.dev` | Live for users | Manual promotion from staging (or auto after staging soak) |

### 7.2 Configuration Hierarchy

```
Build-time (vite define/env):
  VITE_APP_VERSION        — git SHA, injected at build
  VITE_SENTRY_DSN         — error reporting endpoint
  VITE_ANALYTICS_KEY      — anonymous analytics write key
  VITE_BACKUP_API_URL     — backup service base URL (empty = disabled)
  VITE_FEATURE_FLAGS_URL  — feature flag config endpoint (empty = all defaults)

Runtime (browser):
  Feature flags            — fetched from CDN JSON or LaunchDarkly (with local fallback)
  Tax year                 — derived from current date (configurable override for testing)

Server-side (backup API):
  OAUTH_GITHUB_CLIENT_ID
  OAUTH_GITHUB_CLIENT_SECRET
  OAUTH_GOOGLE_CLIENT_ID
  OAUTH_GOOGLE_CLIENT_SECRET
  JWT_SIGNING_KEY
  R2_ACCOUNT_ID / R2_ACCESS_KEY / R2_SECRET_KEY / R2_BUCKET
  DATABASE_URL             — connection string for auth DB
```

### 7.3 Build-Time vs Runtime Config

| Config Type | Mechanism | Can Change Without Redeploy? |
|---|---|---|
| App version, DSNs | `import.meta.env.VITE_*` | No — baked into bundle |
| Feature flags | JSON fetch from CDN | Yes — update JSON, CDN propagates |
| Tax year constants | `src/rules/{year}/constants.ts` | No — requires new build |
| IRS PDF templates | Static assets in `public/forms/` | No — requires new deploy |

---

## 8. Observability

### 8.1 Error Tracking

**Tool:** Sentry (browser SDK)

| Event | Detail |
|---|---|
| **Unhandled exceptions** | Automatic capture with stack trace, breadcrumbs, browser/OS info. |
| **Computation errors** | Catch in `computeAll()` wrapper. Tag with: tax year, filing status, which schedule threw. No PII — strip SSN, amounts, names from error context before sending. |
| **PDF generation errors** | Catch in `compileFilingPackage()`. Tag with: which form failed, template file name. |
| **CSP violations** | `report-uri` header to Sentry CSP endpoint. |
| **PII scrubbing** | Configure Sentry `beforeSend` hook: strip any string matching SSN pattern (`\d{3}-?\d{2}-?\d{4}`), email patterns, and known PII field names from all events. |

### 8.2 Analytics

**Tool:** Plausible (privacy-first, no cookies, GDPR-compliant) or PostHog (self-hosted option)

**Events to track (all anonymous, no PII):**

| Event | Properties |
|---|---|
| `interview_step_viewed` | `step_id`, `section` |
| `interview_completed` | `filing_status`, `has_state_return` (boolean), `duration_minutes` |
| `pdf_downloaded` | `forms_included[]` (e.g., `["1040", "scheduleD", "8949"]`), `page_count` |
| `ocr_used` | `document_type` (w2/1099int/etc), `confidence_score_bucket` (high/medium/low) |
| `csv_imported` | `broker` (robinhood/unknown), `transaction_count_bucket` (1-10/11-50/51+) |
| `explain_view_opened` | `form_line` (e.g., "1040.line16") |
| `error_shown` | `error_type`, `step_id` |

**Not tracked:** Any dollar amounts, SSNs, names, addresses, or data that could identify a user.

### 8.3 Performance Monitoring

**Client-side metrics (via Performance API / Sentry Performance):**

| Metric | Target | Alert Threshold |
|---|---|---|
| **LCP (Largest Contentful Paint)** | <2.5s | >4s |
| **FID (First Input Delay)** | <100ms | >300ms |
| **CLS (Cumulative Layout Shift)** | <0.1 | >0.25 |
| **computeAll() duration** | <200ms (typical return) | >2s |
| **PDF compilation duration** | <3s (typical), <10s (100+ 8949 txns) | >15s |
| **OCR processing duration** | <5s per document | >15s |
| **Bundle size (gzipped)** | <1 MB | >1.5 MB |
| **IndexedDB read/write** | <50ms | >500ms |

### 8.4 Logging

**Client-side:** Console logging in development only. No production console logs (strip via Vite build). Errors routed to Sentry.

**Backup API (if deployed):** Structured JSON logs to stdout (consumed by Cloudflare/Vercel log drain).

| Log Field | Example |
|---|---|
| `timestamp` | `2026-04-15T10:30:00Z` |
| `level` | `info` / `warn` / `error` |
| `request_id` | `req_abc123` |
| `method` | `PUT` |
| `path` | `/api/backup` |
| `status` | `200` |
| `user_id` | `usr_xyz` (opaque ID, not email) |
| `duration_ms` | `150` |
| `error` | (if applicable) |

**Never log:** request/response bodies (contain encrypted tax data), auth tokens, user emails.

---

## 9. Error Budgets & SLOs

### 9.1 SLO Definitions

Since the core product is a static SPA, SLOs focus on asset availability and client-side reliability.

| SLI | Measurement | SLO | Error Budget (30 days) |
|---|---|---|---|
| **Asset availability** | % of CDN requests returning 2xx for static assets | 99.9% | 43 min downtime |
| **Computation correctness** | % of computeAll() calls that complete without exception | 99.99% | 4.3 min of errors across all users |
| **PDF generation success** | % of compileFilingPackage() calls that produce valid PDF | 99.9% | 43 min of failures |
| **Backup API availability** | % of backup/restore requests returning 2xx (Tier 2) | 99.5% | 3.6 hours downtime |
| **Page load performance** | % of page loads with LCP < 4s | 95% | 5% of loads can be slow |

### 9.2 Error Budget Policy

- **>50% budget consumed:** Investigate. Create issue for top error.
- **>80% budget consumed:** Freeze non-critical deploys. Focus on reliability fixes.
- **Budget exhausted:** Incident declared. All hands on reliability. No feature work until budget recovers.

### 9.3 Filing Season Escalation

During peak filing season (March 15 – April 15):
- Tighten asset availability SLO to 99.95%.
- Freeze all non-critical changes to rules engine and PDF fillers.
- On-call rotation active (see Section 16).

---

## 10. Reliability & Scaling

### 10.1 Static SPA Scaling

The core product has no server to scale. CDN handles all load.

| Component | Scaling Strategy |
|---|---|
| **Static assets** | CDN edge caching (Cloudflare 300+ PoPs / Vercel Edge). Immutable hashed bundles, 1-year cache. `index.html` cached 5 min with stale-while-revalidate. |
| **PDF templates** | Lazy-loaded on demand. CDN-cached. ~1 MB per form, 15 MB total. |
| **Tesseract WASM** | Loaded on first OCR use. ~4 MB. CDN-cached. |
| **Browser computation** | Runs on user's device. No server cost. Scales to infinite users. |

### 10.2 Backup Service Scaling (Tier 2)

If deployed, the backup API is a lightweight stateless service:

| Dimension | Approach |
|---|---|
| **Compute** | Cloudflare Workers (or Vercel Serverless Functions). Auto-scales to demand. |
| **Storage** | Cloudflare R2 (S3-compatible). Per-user blobs. No hot spots. |
| **Auth DB** | Cloudflare D1 (SQLite-compatible) or managed Postgres. Reads dominate. |
| **Rate limiting** | Per-user rate limits enforced at edge (Cloudflare rate limiting rules). |

**Expected load (filing season peak):**
- 10K concurrent users (SPA — no server requests during computation)
- 500 backup writes/hour (opt-in users saving progress)
- 2000 backup reads/hour (users restoring on new device)

### 10.3 Resilience Patterns

| Pattern | Implementation |
|---|---|
| **Offline-first** | App works fully offline after initial load. Service worker caches all assets (Vite PWA plugin). IndexedDB for data persistence. |
| **Graceful degradation** | OCR unavailable → manual entry. Backup API down → continue locally. Analytics blocked → silent no-op. |
| **Data durability** | IndexedDB is primary store. "Export JSON" button always available. Backup service is convenience, not requirement. |
| **Recovery from corrupt state** | "Start Over" button clears IndexedDB. JSON export/import for manual recovery. Detect invalid store shape on hydration and prompt user. |

---

## 11. CI/CD & Release Strategy

### 11.1 Pipeline

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Commit   │───▶│  Lint +   │───▶│  Test    │───▶│  Build   │───▶│ Preview  │
│  (PR)     │    │  Type     │    │  (unit + │    │  (Vite)  │    │  Deploy  │
│           │    │  Check    │    │  integ)  │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                                      │
                                                          PR approved + merged
                                                                      │
                                                                      ▼
                                                               ┌──────────┐
                                                               │ Staging  │
                                                               │ Deploy   │
                                                               └────┬─────┘
                                                                    │
                                                              Soak 2 hours
                                                          (auto E2E + manual)
                                                                    │
                                                                    ▼
                                                               ┌──────────┐
                                                               │  Prod    │
                                                               │  Deploy  │
                                                               └──────────┘
```

### 11.2 CI Jobs (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc' }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc' }
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v4  # upload coverage

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc' }
      - run: npm ci
      - run: npm run build
      - run: npx bundlesize  # fail if bundle exceeds limit
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }

  e2e:
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc' }
      - run: npm ci
      - run: npx playwright install --with-deps
      - uses: actions/download-artifact@v4
        with: { name: dist, path: dist/ }
      - run: npm run test:e2e

  preview:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    needs: [build]
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist, path: dist/ }
      # Deploy to preview URL (Cloudflare Pages / Vercel)

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: [build, e2e]
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist, path: dist/ }
      # Deploy to staging

  deploy-prod:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: [deploy-staging]
    environment: production  # requires manual approval
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist, path: dist/ }
      # Deploy to production
```

### 11.3 Release Strategy

| Aspect | Approach |
|---|---|
| **Versioning** | SemVer. `MAJOR.MINOR.PATCH`. Major = breaking model changes or new tax year. Minor = new forms/features. Patch = bug fixes. |
| **Release cadence** | Weekly during development. Freeze 2 weeks before filing season opens. Patch-only during filing season. |
| **Rollback** | CDN atomic deploys. Rollback = redeploy previous build artifact. Target: <5 min rollback. |
| **Release notes** | Auto-generated from conventional commits. Published on GitHub Releases. |
| **Tagging** | `v{major}.{minor}.{patch}` tags on `main`. Tax-year tags: `ty2025-final` when rules are locked for a tax year. |

### 11.4 Branch Strategy

| Branch | Purpose | Protection |
|---|---|---|
| `main` | Production-ready trunk | Require PR, CI pass, 1 approval |
| `agent/*` | Feature branches (per CLAUDE.md) | None |
| `release/ty{year}` | Tax year release branch (created at freeze) | Require PR, CI pass, 2 approvals |

---

## 12. Migrations & Versioning

### 12.1 Tax Model Versioning

The `TaxReturn` type evolves across versions. Since data is stored in IndexedDB (client-side JSON), we need a migration strategy.

```typescript
// src/store/migrations.ts
interface MigrationDef {
  fromVersion: number;
  toVersion: number;
  migrate: (data: unknown) => unknown;
}

const migrations: MigrationDef[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: (data) => {
      // Example: add scheduleEProperties field
      return { ...data, scheduleEProperties: [] };
    },
  },
  // Each new field addition gets a migration
];

export function migrateToLatest(data: unknown, fromVersion: number): TaxReturn {
  let current = data;
  for (const m of migrations) {
    if (m.fromVersion >= fromVersion) {
      current = m.migrate(current);
    }
  }
  return current as TaxReturn;
}
```

**Rules:**
1. Every `TaxReturn` shape change increments `MODEL_VERSION`.
2. New optional fields use `?? defaultValue` in UI/rules (per memory pattern).
3. Migrations are additive — never remove fields in a minor version.
4. Old data (pre-migration) is backed up before migration runs.

### 12.2 Tax Year Versioning

Tax rules change annually. Strategy:

```
src/rules/
  2025/          ← current production
    constants.ts
    form1040.ts
    ...
  2026/          ← next year (copies 2025, updates constants + rule changes)
    constants.ts
    form1040.ts
    ...
  engine.ts      ← dispatches to correct year based on TaxReturn.taxYear
```

- Each tax year is a complete, independent module.
- The engine reads `taxReturn.taxYear` and imports the corresponding module.
- Old years remain frozen — no changes after `ty{year}-final` tag.

### 12.3 IRS PDF Template Versioning

IRS releases new PDF forms annually (typically November–December for the next filing year).

| Step | Timing | Action |
|---|---|---|
| **Download** | Nov–Dec | Download new IRS PDF templates for the filing year |
| **Field mapping** | Dec–Jan | Discover PDF field names, update filler mappings |
| **Validation** | Jan | Visual comparison of filled PDFs against IRS samples |
| **Lock** | Jan 15 | Freeze template files for the filing season |

Templates stored in `public/forms/{year}/` with a manifest:
```json
{
  "taxYear": 2025,
  "forms": {
    "f1040": { "file": "f1040-2025.pdf", "sha256": "abc123...", "version": "2025-01" },
    "scheduleA": { "file": "sa-2025.pdf", "sha256": "def456...", "version": "2025-01" }
  }
}
```

---

## 13. Feature Flags

### 13.1 Implementation

Lightweight, CDN-hosted JSON approach (no vendor dependency for MVP):

```json
// https://app.opentax.dev/flags.json (CDN-cached, 5 min TTL)
{
  "version": 3,
  "flags": {
    "enable_backup_service": false,
    "enable_state_ny": false,
    "enable_schedule_c": false,
    "enable_ocr_1099r": true,
    "show_beta_banner": true,
    "max_8949_transactions": 500
  }
}
```

```typescript
// src/lib/featureFlags.ts
const FLAGS_URL = import.meta.env.VITE_FEATURE_FLAGS_URL;
const DEFAULT_FLAGS = { /* ... defaults ... */ };

let flags = DEFAULT_FLAGS;

export async function loadFlags(): Promise<void> {
  if (!FLAGS_URL) return;
  try {
    const res = await fetch(FLAGS_URL);
    flags = { ...DEFAULT_FLAGS, ...await res.json().then(j => j.flags) };
  } catch {
    // Use defaults on failure — never block app startup
  }
}

export function flag(name: string): boolean | number | string {
  return flags[name] ?? DEFAULT_FLAGS[name];
}
```

### 13.2 Flag Lifecycle

| Phase | Action |
|---|---|
| **New feature** | Add flag defaulting to `false`. Develop behind flag. |
| **Beta** | Enable flag for beta testers (via URL param `?flags=enable_foo` in staging). |
| **GA** | Enable flag in production `flags.json`. |
| **Cleanup** | Remove flag check from code. Remove from `flags.json`. |

### 13.3 Planned Flags

| Flag | Purpose | Default |
|---|---|---|
| `enable_backup_service` | Show "Back up" button, enable cloud sync | `false` |
| `enable_state_ny` | Show New York state return option | `false` |
| `enable_state_tx` | Show Texas (no state income tax, just property) | `false` |
| `enable_schedule_c` | Show Schedule C self-employment flow | `false` |
| `enable_social_security` | Show SSA-1099 input + taxable SS worksheet | `false` |
| `show_beta_banner` | Show "Beta — verify before filing" banner | `true` |
| `max_8949_transactions` | Limit on imported 1099-B rows (performance guard) | `500` |

---

## 14. Compliance & Legal

### 14.1 Tax Software Regulatory Requirements

| Requirement | Status | Action |
|---|---|---|
| **IRS Authorized e-File Provider** | Not applicable (paper filing only for MVP) | Required if e-file added (Publication 3112: apply for EFIN, pass suitability check, complete ETIN testing) |
| **IRS Free File Alliance** | Not applicable (OpenTax is OSS, not an IRS partner) | Explore membership if user base grows |
| **State e-file certification** | Not applicable (paper filing only) | Each state has its own certification process |
| **AICPA standards** | Informational — OpenTax is not a CPA firm | Follow AICPA Statements on Standards for Tax Services (SSTS) as best practice |
| **Circular 230** | OpenTax does not provide tax advice | Disclaimers must be prominent (see 14.4) |

### 14.2 Privacy & Data Protection

| Regulation | Applicability | Compliance Actions |
|---|---|---|
| **CCPA/CPRA (California)** | If serving CA residents | Privacy policy with CCPA disclosures. "Do Not Sell" link. Data deletion on request. OpenTax advantage: no server-side PII in core flow. |
| **State privacy laws** (CO, CT, VA, etc.) | If serving residents of those states | Align with CCPA approach — strictest standard applies. |
| **GDPR** | If serving EU residents (unlikely for US tax filing) | Not applicable for MVP. Revisit if international users emerge. |
| **COPPA** | If minors use the service | Not applicable — tax filers must be 18+ (or have guardian). Add age gate if needed. |
| **FTC Act Section 5** | Always applies (unfair/deceptive practices) | Accurate marketing. No dark patterns. Clear disclaimers. |

### 14.3 Compliance Checklist

- [ ] **Privacy Policy** — Describe what data is collected (only anonymous analytics), what is NOT collected (PII stays client-side), third-party services used (Sentry, Plausible), data retention, user rights.
- [ ] **Terms of Service** — Limitation of liability, no tax advice warranty, accuracy disclaimer, arbitration clause.
- [ ] **Tax Disclaimers** — Displayed prominently:
  - "OpenTax is not a CPA, enrolled agent, or tax attorney."
  - "Review all forms before filing. You are responsible for the accuracy of your return."
  - "OpenTax provides computation tools, not tax advice."
  - "For complex situations, consult a tax professional."
- [ ] **Cookie banner** — Not needed if using Plausible (no cookies). Needed if using PostHog with cookies.
- [ ] **Accessibility statement** — WCAG 2.1 AA conformance claim (see Section 18).
- [ ] **Open source license** — Current license (if any) reviewed for compatibility with production use. Recommend MIT or Apache 2.0.
- [ ] **SBOM published** — CycloneDX format alongside each release.
- [ ] **Vulnerability disclosure policy** — `SECURITY.md` with responsible disclosure process.

### 14.4 Required Disclaimers (In-App)

Display at:
1. **Welcome page** — brief disclaimer + link to full terms.
2. **Review page** — pre-filing checklist item: "I have reviewed all forms and take responsibility for accuracy."
3. **Download page** — final reminder before PDF download.
4. **Footer** — persistent small-print link to terms and privacy policy.

---

## 15. Backup & Disaster Recovery

### 15.1 What Can Go Wrong

| Failure | Impact | Mitigation |
|---|---|---|
| **CDN outage** | Users can't load the app | Multi-CDN (Cloudflare + fallback). Service worker serves cached version. |
| **User clears browser data** | Tax return lost | Prominent "Export your data" prompts. Optional cloud backup. |
| **IndexedDB corruption** | Tax return unreadable | Detect on hydration. Prompt for JSON re-import. Keep last-known-good backup in separate IDB store. |
| **Bad deploy** | App broken for all users | Rollback to previous CDN deploy in <5 min. Canary checks catch most issues. |
| **Backup service down** | Can't save/restore cloud backups | App still fully functional without backup. Show degraded-mode banner. |
| **R2/S3 data loss** | Cloud backups lost | R2 has 99.999999999% durability. Cross-region replication for defense-in-depth. |

### 15.2 Client-Side Data Protection

| Mechanism | Implementation |
|---|---|
| **JSON export** | "Export Data" button → downloads `opentax-{year}-{date}.json`. Prompted after every major section completion. |
| **Auto-export reminder** | After first 15 minutes of use, show non-blocking banner: "Save a backup of your progress." |
| **IndexedDB double-write** | Write to both `opentax-current` and `opentax-backup` stores. If primary corrupts, restore from backup. |
| **Service Worker cache** | Precache all app assets. Users can continue using the app (including computation) even if CDN is down. |

### 15.3 Backup Service DR (Tier 2)

| Aspect | Strategy |
|---|---|
| **RPO (Recovery Point Objective)** | 0 — every backup write is immediately durable in R2. |
| **RTO (Recovery Time Objective)** | <1 hour for backup service restoration. App itself is unaffected. |
| **Backup testing** | Monthly: restore a test backup blob, verify decryption and data integrity. |
| **Multi-region** | R2 multi-region replication enabled. If primary region fails, reads served from replica. |

---

## 16. Incident Response & Runbooks

### 16.1 Severity Levels

| Level | Definition | Response Time | Examples |
|---|---|---|---|
| **SEV-1** | Core app unusable for all users | 15 min acknowledge, 1 hour mitigate | CDN down, app crashes on load, computation produces wrong results |
| **SEV-2** | Major feature broken for subset of users | 1 hour acknowledge, 4 hours mitigate | PDF generation fails for specific form combo, OCR crashes on certain browsers |
| **SEV-3** | Minor feature broken or degraded | Next business day | Analytics not reporting, one tooltip misaligned, slow load on 3G |
| **SEV-4** | Cosmetic or low-impact | Next sprint | Typo, minor style inconsistency |

### 16.2 On-Call Structure

During filing season (Jan 15 – April 15):
- **Primary on-call:** Rotates weekly among core contributors.
- **Escalation:** Primary → Project lead → All contributors.
- **Communication:** GitHub Issues (SEV-3/4), Slack/Discord (SEV-1/2), email for external comms.

Off-season: Best-effort response via GitHub Issues.

### 16.3 Runbooks

#### Runbook: CDN Outage
```
Symptom: Users report app won't load. Uptime monitor fires.
1. Check CDN status page (status.cloudflare.com or vercel.com/status).
2. If CDN-wide outage: post status update, wait for CDN resolution.
3. If our config issue: check DNS, check deploy status, check domain config.
4. If bad deploy: rollback to previous deploy via CLI:
   - Cloudflare: wrangler pages deployment rollback
   - Vercel: vercel rollback
5. Verify rollback: curl -I https://app.opentax.dev → 200 OK.
6. Post-mortem within 48 hours.
```

#### Runbook: Computation Error (Wrong Tax Numbers)
```
Symptom: User reports tax calculation doesn't match manual computation, or
         Sentry reports exception in computeAll().
1. SEVERITY: SEV-1 if affects correctness for common returns. SEV-2 if edge case.
2. Reproduce: create fixture matching user's scenario (no PII — use anonymized data).
3. Identify faulty rule in src/rules/2025/.
4. Write failing test FIRST (the expected correct value, hand-calculated).
5. Fix the rule. Verify test passes.
6. Check: does this fix change results for existing test scenarios? If yes, verify
   each change is correct (not a regression).
7. Deploy hotfix (expedited: skip staging soak, but run full test suite in CI).
8. Post-mortem: why wasn't this caught by existing tests? Add scenario coverage.
```

#### Runbook: PDF Generation Failure
```
Symptom: "Download" button errors, or generated PDF has missing/wrong fields.
1. Check Sentry for exception details (which filler, which field).
2. Common causes:
   a. IRS PDF template field name changed → update mapping in src/forms/fillers/.
   b. Computation returns undefined for a field → add null guard in filler.
   c. pdf-lib version incompatibility → check if IRS updated PDF format.
3. Fix, add regression test, deploy.
```

#### Runbook: IndexedDB Corruption
```
Symptom: User reports data loss or app stuck on load.
1. Guide user to open browser DevTools → Application → IndexedDB.
2. Check if opentax-backup store has valid data.
3. If backup exists: guide user to trigger recovery (or provide console script).
4. If no backup: check if user has JSON export. Guide import.
5. If no recovery possible: data is lost. Document for prevention improvement.
6. Follow up: improve corruption detection and auto-recovery logic.
```

#### Runbook: Security Incident (Data Breach Suspected)
```
Symptom: Report of unauthorized access, XSS vulnerability, or dependency compromise.
1. SEVERITY: Always SEV-1.
2. If CDN/supply chain compromise: immediately disable deploy pipeline. Rollback to
   last known-good deploy with verified SRI hashes.
3. If backup service compromise: disable backup API. Notify affected users via email.
4. Assess scope: what data could have been accessed?
5. Core product mitigation: since tax data is client-side only, a CDN compromise
   could have injected script to exfiltrate data. Check: when was the bad deploy
   live? How many users loaded it?
6. Notify users if PII exposure is possible (even if uncertain).
7. Engage security advisor for formal incident report.
8. Post-mortem with public transparency report.
```

---

## 17. QA Strategy

### 17.1 Testing Pyramid

```
                    ┌─────────┐
                    │  E2E    │  ~20 tests (Playwright)
                    │ (slow)  │  Full interview flows, PDF download
                   ┌┴─────────┴┐
                   │ Integration │  ~100 tests (Vitest)
                   │ (medium)   │  Full return scenarios, cross-form
                  ┌┴────────────┴┐
                  │   Unit Tests  │  ~800+ tests (Vitest)
                  │   (fast)      │  Rules, fillers, parsers, components
                  └───────────────┘
```

### 17.2 Unit Tests

| Domain | What to Test | Coverage Target |
|---|---|---|
| **Rules** (`src/rules/`) | Each computation function with known inputs → expected outputs. Edge cases: zero income, max brackets, boundary values. | 100% line coverage |
| **Form fillers** (`src/forms/fillers/`) | Field mapping correctness. Multi-page overflow (8949). Null/undefined handling. | 95% line coverage |
| **Intake parsers** (`src/intake/`) | CSV parsing, OCR field extraction, broker detection. Edge cases: empty files, malformed data, encoding issues. | 95% line coverage |
| **Store** (`src/store/`) | Zustand mutations produce correct state. Migration functions. | 90% line coverage |
| **UI components** (`src/ui/`) | Rendering, user interactions, form validation. Accessibility attributes. | 80% line coverage |

### 17.3 Integration Tests

| Scenario Type | Count | What's Verified |
|---|---|---|
| **Full return scenarios** (existing) | 5 | Complete TaxReturn → computeAll() → every form line matches hand-calculated expected values |
| **Cross-form consistency** | 10+ | Schedule D totals match 8949 sums. Schedule B totals match 1040 lines 2b/3b. Schedule A total flows correctly to 1040 line 12. |
| **State return integration** | 2+ | Federal compute + state compute + state PDF generation for CA. |
| **IRS worksheet verification** | 5+ | Compare OpenTax output against hand-completed IRS worksheets (QDCG, AMT, EITC). |

### 17.4 End-to-End Tests (Playwright)

| Test | Description |
|---|---|
| **Happy path: Simple W-2 return** | Start → filing status → personal info → W-2 entry → review → download PDF. Verify PDF has correct values. |
| **Happy path: W-2 + RSU** | Include RSU vest events, verify basis adjustment appears, correct 8949 category. |
| **OCR upload flow** | Upload W-2 image → verify OCR populates fields → user confirms → data saved. |
| **CSV import flow** | Upload Robinhood CSV → verify transaction count → review wash sales → confirm. |
| **Interview navigation** | Verify step visibility based on filing status and data entered. Back/forward navigation. |
| **Mobile viewport** | Run key flows at 375px width. Verify no layout breaks. |
| **Error recovery** | Trigger computation error → verify error message shown → user can continue. |

### 17.5 Performance Testing

| Test | Tool | Threshold |
|---|---|---|
| **Bundle size** | bundlesize (CI) | <1 MB gzipped total. <200 KB gzipped main chunk. |
| **computeAll() benchmark** | Vitest bench | <200ms for typical return. <2s for 500-transaction return. |
| **PDF compilation benchmark** | Vitest bench | <3s for typical 10-page return. <15s for 50-page return (many 8949 pages). |
| **Lighthouse CI** | lighthouse-ci | Performance >90, Accessibility >95, Best Practices >95. |
| **Memory profiling** | Manual (Chrome DevTools) | <150 MB heap for typical return. No memory leaks across interview steps. |

### 17.6 Property-Based Tests

| Property | Description |
|---|---|
| **Monotonic tax** | Tax liability is non-decreasing as income increases (within a bracket). |
| **Balance equation** | `refund + owed == totalTax - totalPayments` (exactly one of refund/owed is positive). |
| **No negative tax** | Tax liability is never negative. |
| **Cents precision** | All monetary values are integers (no fractional cents). |
| **Idempotent computation** | `computeAll(tr) === computeAll(tr)` — same input always produces same output. |
| **Trace completeness** | Every non-zero form line has a non-empty `inputs` array in its trace. |

### 17.7 Manual QA Checklist (Pre-Release)

- [ ] Complete a simple W-2 return end-to-end. Verify PDF.
- [ ] Complete a W-2 + RSU + stock trading return. Verify 8949/Schedule D.
- [ ] Complete an itemized deduction return. Verify Schedule A.
- [ ] Complete a return with all credits (CTC, EITC, education, energy). Verify amounts.
- [ ] Test on Chrome, Firefox, Safari. Test on mobile (iOS Safari, Android Chrome).
- [ ] Test with screen reader (VoiceOver or NVDA). Complete at least 3 interview steps.
- [ ] Test "Export Data" and "Import Data" round-trip.
- [ ] Test "Start Over" — verify all data cleared.
- [ ] Compare at least 2 scenarios against another tax tool (UsTaxes, IRS Free File, manual calculation).

---

## 18. Accessibility

### 18.1 Current State

- ARIA labels on form inputs (implemented in Phase 2).
- Keyboard navigation for interview flow (Tab, Enter, arrow keys).
- Mobile responsive layout (Tailwind breakpoints).
- LiveBalance component announces refund/owed changes to screen readers.

### 18.2 WCAG 2.1 AA Compliance Plan

| Criterion | Status | Action |
|---|---|---|
| **1.1.1 Non-text Content** | Partial | Add `alt` text to all icons. Ensure SVG trace graph has text alternatives. |
| **1.3.1 Info and Relationships** | Partial | Audit form groupings (`fieldset`/`legend`). Ensure table headers on review pages. |
| **1.4.3 Contrast (Minimum)** | Needs audit | Run axe-core on all pages. Fix any contrast ratios below 4.5:1. |
| **1.4.4 Resize Text** | Good | Tailwind responsive handles most cases. Verify at 200% zoom. |
| **2.1.1 Keyboard** | Good | Interview nav works with keyboard. Verify all interactive elements reachable. |
| **2.4.1 Bypass Blocks** | Needs work | Add skip-to-content link. Add landmark roles (main, nav, complementary). |
| **2.4.7 Focus Visible** | Needs audit | Ensure focus rings visible on all interactive elements. Tailwind `ring` utilities. |
| **3.3.1 Error Identification** | Good | Form validation errors shown inline with `aria-invalid` and `aria-describedby`. |
| **3.3.2 Labels or Instructions** | Good | All inputs have visible labels. InfoTooltip provides additional context. |
| **4.1.2 Name, Role, Value** | Needs audit | Ensure custom components (CurrencyInput, SSNInput) expose correct ARIA roles. |

### 18.3 Testing Tools

- **axe-core** (automated): Run in CI via `@axe-core/playwright` on E2E tests.
- **Lighthouse accessibility audit**: Run in CI. Fail on score <90.
- **Manual screen reader testing**: VoiceOver (macOS/iOS), NVDA (Windows). Quarterly.
- **Keyboard-only testing**: Include in E2E test suite (no mouse events).

---

## 19. Internationalization Readiness

### 19.1 Current Scope

OpenTax targets US federal and state tax returns only. All content is in English. IRS forms are English-only.

### 19.2 i18n Prep (No Immediate Work Needed)

| Aspect | Current | Future-Ready Action |
|---|---|---|
| **UI strings** | Hardcoded in JSX | Extract to `src/i18n/en.json` when multi-language needed. Use `react-i18next` or similar. |
| **Number formatting** | Custom `dollars()` helper | Already US-centric (commas, period decimal). `Intl.NumberFormat` for future locales. |
| **Date formatting** | ISO strings internally, US display | Use `Intl.DateTimeFormat` for display. Keep ISO internally. |
| **Currency** | USD only, integer cents | Model already supports this cleanly. |
| **IRS form labels** | English, matches official IRS terminology | Keep English for form-specific labels. Translate UI chrome only. |
| **RTL support** | Not needed for English | Use Tailwind `rtl:` variants if needed in future. |

### 19.3 Spanish Language Support (Future Consideration)

IRS provides many forms and instructions in Spanish. If demand exists:
1. Translate UI chrome strings (buttons, labels, help text).
2. Keep form line references in English (they reference English IRS publications).
3. Provide Spanish-language tooltips and explanations alongside English IRS citations.
4. Estimated effort: 2-4 weeks for one contributor.

---

## 20. Cost Controls

### 20.1 Infrastructure Costs (Estimated)

| Service | Free Tier | Paid Estimate (10K MAU) | Paid Estimate (100K MAU) |
|---|---|---|---|
| **Cloudflare Pages** (static hosting) | 500 builds/month, unlimited bandwidth | $0 (free tier sufficient) | $0 (free tier sufficient) |
| **Cloudflare Workers** (backup API) | 100K requests/day | $5/month | $15/month |
| **Cloudflare R2** (backup storage) | 10 GB, 1M requests | $5/month | $50/month |
| **Cloudflare D1** (auth DB) | 5 GB | $0 (free tier) | $5/month |
| **Sentry** (error tracking) | 5K errors/month | $0 (free tier) | $26/month (50K errors) |
| **Plausible** (analytics) | N/A (self-hosted free, cloud $9/mo) | $9/month | $19/month |
| **GitHub Actions** (CI/CD) | 2000 min/month | $0 (free for OSS) | $0 (free for OSS) |
| **Domain** | N/A | $12/year | $12/year |
| **Total** | **$0/month** | **~$20/month** | **~$100/month** |

### 20.2 Cost Guardrails

| Control | Mechanism |
|---|---|
| **CDN bandwidth** | Cloudflare free tier has no bandwidth limits. Monitor via dashboard. |
| **R2 storage** | Set per-user backup size limit (5 MB — more than sufficient for a TaxReturn JSON). Alert at 80% of budget. |
| **Workers invocations** | Rate limiting per user (Section 3.2). Alert at 80% of daily limit. |
| **CI minutes** | Cache `node_modules` and Playwright browsers. Parallelize jobs. Skip E2E on draft PRs. |
| **Sentry events** | Rate-limit client SDK to 10 events/session. Sample transactions at 10%. |
| **Bundle size** | CI check prevents bundle bloat (which increases CDN egress and user bandwidth). |

### 20.3 Open-Source Sustainability

| Revenue Option | Viability | Notes |
|---|---|---|
| **Donations** (GitHub Sponsors, Open Collective) | Low-medium | Covers hosting costs for small user base. |
| **Premium features** (e-file, audit protection) | Medium | Would require IRS EFIN, significant compliance investment. |
| **White-label licensing** | Low | Tax software market has established players. |
| **Grants** (OSS foundations, public interest tech) | Medium | IRS modernization grants, civic tech funding. |

Recommendation: Keep costs near zero by leveraging free tiers. The static SPA architecture makes this achievable even at scale.

---

## 21. Phased Rollout Plan

### Phase 0: Foundation (Weeks 1–4)

**Goal:** Infrastructure and CI/CD. No public-facing changes.

| Milestone | Owner Role | Deliverable |
|---|---|---|
| Set up GitHub Actions CI | DevOps / Core Dev | `.github/workflows/ci.yml` — lint, test, build, E2E |
| Set up Cloudflare Pages | DevOps | `app.opentax.dev` serving static build |
| Add Sentry integration | Core Dev | Browser error tracking with PII scrubbing |
| Add service worker | Core Dev | Offline-capable after first load (Vite PWA plugin) |
| Create `SECURITY.md` | Core Dev / Legal | Vulnerability disclosure policy |
| Set up preview deploys | DevOps | PR preview URLs |
| Store version in IndexedDB | Core Dev | `MODEL_VERSION` + migration framework |
| Bundle size CI check | Core Dev | Fail build if >1.5 MB gzipped |

### Phase 1: MVP Launch (Weeks 5–8)

**Goal:** Public beta. Real users can prepare and print federal returns.

| Milestone | Owner Role | Deliverable |
|---|---|---|
| Privacy policy + ToS | Legal / Core Dev | `/privacy`, `/terms` pages |
| In-app disclaimers | Core Dev | Welcome, review, download page disclaimers |
| JSON export/import | Core Dev | "Save progress" / "Load progress" buttons |
| "Beta" banner | Core Dev | Prominent banner on all pages: "Beta — verify before filing" |
| Anonymous analytics | Core Dev | Plausible integration (or self-hosted PostHog) |
| Feature flags | Core Dev | CDN JSON flag system + planned flags |
| Accessibility audit | QA / Core Dev | axe-core in CI, fix critical issues |
| Lighthouse CI | DevOps | Fail on perf <80, a11y <90 |
| Landing page | Design / Core Dev | Simple landing page explaining the project + "Start filing" CTA |
| Beta launch | All | Announce on relevant communities (HN, Reddit r/tax, OSS forums) |

### Phase 2: Hardening (Weeks 9–16)

**Goal:** Fix issues from beta feedback. Improve test coverage. Add backup service.

| Milestone | Owner Role | Deliverable |
|---|---|---|
| Fix beta bugs | Core Dev | Address top 10 user-reported issues |
| Expand test scenarios | Core Dev / QA | Add 10+ integration scenarios from real user feedback |
| OAuth sign-in | Backend Dev | GitHub + Google OAuth for optional accounts |
| Encrypted backup service | Backend Dev | Client-side encryption + R2 storage |
| Cross-browser testing | QA | Verify Firefox, Safari, Edge, mobile browsers |
| Performance optimization | Core Dev | Code splitting, lazy load PDF templates, optimize computeAll() |
| Additional state support | Core Dev | Add 2-3 more states (NY, TX/no-income-tax info, WA) behind feature flags |
| Computation correctness audit | Core Dev / Tax Domain | Cross-check 20 scenarios against IRS Free File or commercial software |
| E2E test suite expansion | QA | 15+ E2E tests covering major flows |

### Phase 3: GA (Weeks 17–20)

**Goal:** General availability for filing season. Confidence in correctness. Stable.

| Milestone | Owner Role | Deliverable |
|---|---|---|
| Remove beta banner | Core Dev | Feature flag: `show_beta_banner: false` |
| Finalize 2025 tax year | Core Dev | Lock `ty2025-final` tag. No more rule changes. |
| Filing season freeze | All | Only bug fixes and security patches merge to release branch. |
| On-call rotation | Core Dev | Weekly rotation, runbooks published, alerting active |
| Load testing | DevOps / QA | Simulate 1000 concurrent CDN users. Verify no issues. |
| PR + launch comms | Marketing | Blog post, HN submission, Reddit posts, OSS community outreach |
| Monitor error budgets | DevOps | Dashboard showing SLO compliance. Daily review during filing season. |

---

## 22. Risk Register

### Prioritized by Impact × Likelihood

| # | Risk | Impact | Likelihood | Severity | Mitigation |
|---|---|---|---|---|---|
| **R1** | **Tax computation produces incorrect results** | Critical — users file wrong returns | Medium — complex rules, IRS edge cases | **Critical** | Extensive test scenarios. Cross-check with other tools. Property-based tests. Clearly mark as beta. Disclaimers. |
| **R2** | **IRS PDF template field names change** | High — PDFs have wrong/missing values | Medium — IRS updates templates annually | **High** | Automated field-name extraction script. Visual diff test of filled PDFs. Template version pinning with manifest. |
| **R3** | **Security vulnerability in dependencies** | High — potential PII exposure via XSS | Medium — npm ecosystem has frequent CVEs | **High** | Dependabot, `npm audit` in CI, strict CSP, SRI, minimal dependency surface. |
| **R4** | **Browser compatibility issue in production** | Medium — subset of users can't use app | Medium — Safari/Firefox quirks with IndexedDB, WASM | **Medium** | Cross-browser E2E tests. Feature detection with clear error messages. |
| **R5** | **User loses data (clears browser, device change)** | Medium — frustrating but recoverable | High — common user behavior | **Medium** | Prominent export reminders. Optional cloud backup. Auto-backup prompts after significant data entry. |
| **R6** | **Legal challenge (tax advice, accuracy claims)** | High — liability exposure | Low — strong disclaimers, no advice given | **Medium** | Prominent disclaimers. Terms of service with limitation of liability. "Not tax advice" messaging. Legal review of all user-facing copy. |
| **R7** | **Scaling issues during filing season peak** | Low — static SPA scales inherently | Low — CDN handles load; no server bottleneck | **Low** | Service worker for offline resilience. CDN monitors. Backup API rate limits. |
| **R8** | **Contributor burnout / bus factor** | High — solo maintainer risk | Medium — common in OSS | **Medium** | Document everything (this doc, CLAUDE.md, code comments). Encourage community contributions. Automate what can be automated. |
| **R9** | **IRS changes rules after rules are locked** | Medium — late-breaking tax law changes | Low — rare but happens (e.g., COVID relief) | **Low** | Monitor IRS news feed. Maintain ability to hotfix rules even during freeze (with double review). |
| **R10** | **Regulatory action (unauthorized e-file claims, etc.)** | High — legal/financial | Very Low — paper filing only, clear disclaimers | **Low** | Never claim e-file capability unless certified. Never claim to be a CPA/EA. Regular legal review. |

### Risk Response Actions

| Risk | Owner Role | Action | Due |
|---|---|---|---|
| R1 | Core Dev + QA | Add 20 cross-validated test scenarios before beta launch | Week 6 |
| R2 | Core Dev | Build PDF field extraction script + visual diff CI step | Week 4 |
| R3 | DevOps | Set up Dependabot + npm audit CI + CSP headers | Week 2 |
| R4 | QA | Cross-browser E2E suite (Chrome, Firefox, Safari, mobile) | Week 10 |
| R5 | Core Dev | Implement JSON export + auto-backup prompts | Week 6 |
| R6 | Legal | Draft privacy policy, ToS, and disclaimers | Week 5 |
| R8 | All | Complete this design doc + all runbooks + contributor guide | Week 4 |

---

## 23. 30/60/90-Day Execution Plan

### Days 1–30: Foundation + CI/CD + Legal Groundwork

**Theme:** "Make it deployable and safe."

| Week | Tasks | Owner Role | Success Criteria |
|---|---|---|---|
| **Week 1** | Set up GitHub Actions CI (lint + test + build). Create `.nvmrc`. Add `npm ci` lockfile check. Set up Dependabot. | DevOps | Every PR runs CI. `npm audit` passes. |
| **Week 2** | Set up Cloudflare Pages deployment. Configure custom domain. Add HTTPS/HSTS. Set up PR preview deploys. | DevOps | `app.opentax.dev` serves the built SPA. Preview URLs work. |
| **Week 3** | Integrate Sentry (browser SDK) with PII scrubbing. Add CSP headers. Add SRI to `index.html`. Create `SECURITY.md`. | Core Dev | Errors reported to Sentry (no PII). CSP blocks inline scripts. |
| **Week 4** | Implement service worker (Vite PWA). Add IndexedDB `MODEL_VERSION` + migration framework. Add bundle size CI check. Write contributor guide. | Core Dev | App works offline after first load. Model version tracked. Bundle <1.5 MB. |

**Deliverables at Day 30:**
- CI/CD pipeline running on every PR and merge.
- Production deployment pipeline (staging → prod).
- Error tracking active.
- Security headers deployed.
- Offline-capable SPA.
- Data model migration framework in place.

### Days 31–60: Beta Launch + User-Facing Polish

**Theme:** "Make it usable by real people."

| Week | Tasks | Owner Role | Success Criteria |
|---|---|---|---|
| **Week 5** | Write privacy policy and terms of service. Add in-app disclaimers (welcome, review, download pages). Add footer links. | Legal + Core Dev | Legal pages live. Disclaimers visible at key points. |
| **Week 6** | Implement JSON export/import. Add auto-backup reminders. Add "Start Over" confirmation flow. Implement feature flag system. | Core Dev | Users can save/restore progress. Feature flags control new features. |
| **Week 7** | Add anonymous analytics (Plausible). Run accessibility audit (axe-core). Fix critical a11y issues. Add Lighthouse CI. | Core Dev + QA | Analytics tracking events. No critical a11y violations. Lighthouse scores pass thresholds. |
| **Week 8** | Create landing page. Expand test scenarios (10 new integration tests). Cross-check 5 scenarios against other tax tools. **Beta launch.** | All | 10+ new validated scenarios. Public beta announcement. |

**Deliverables at Day 60:**
- Public beta at `app.opentax.dev` with beta banner.
- Legal pages and disclaimers.
- Data export/import.
- Feature flags operational.
- Analytics providing usage insights.
- Accessibility baseline established.
- Test coverage expanded with real-world validated scenarios.

### Days 61–90: Hardening + Backup Service + GA Prep

**Theme:** "Make it reliable and trustworthy."

| Week | Tasks | Owner Role | Success Criteria |
|---|---|---|---|
| **Week 9** | Triage and fix top beta bugs. Expand E2E test suite. Cross-browser testing (Firefox, Safari, mobile). | Core Dev + QA | Top 10 bugs fixed. E2E tests pass on 3+ browsers. |
| **Week 10** | Implement OAuth sign-in (GitHub + Google). Build encrypted backup API (Cloudflare Workers + R2). | Backend Dev | Users can sign in and back up encrypted data. |
| **Week 11** | Performance optimization (code splitting, lazy PDF loads). Add 10 more cross-validated test scenarios. Computation correctness audit. | Core Dev + QA | computeAll() <200ms. 30+ validated scenarios total. |
| **Week 12** | On-call rotation setup. Publish runbooks. Error budget dashboard. Prepare GA comms. Lock `ty2025-final`. **GA launch.** | All | On-call active. Runbooks published. Filing season freeze in effect. GA announced. |

**Deliverables at Day 90:**
- General availability with confidence in correctness.
- Optional cloud backup for authenticated users.
- On-call rotation and incident response process.
- 30+ cross-validated test scenarios.
- Performance optimized.
- Filing season freeze in effect — stability over features.

---

## Appendix A: Decision Log

| Date | Decision | Rationale | Status |
|---|---|---|---|
| 2026-02-20 | Static SPA on CDN (no SSR, no server for core flow) | Privacy guarantee: no PII leaves browser. Scales infinitely at near-zero cost. | Adopted |
| 2026-02-20 | Cloudflare Pages + Workers + R2 (primary deploy target) | Free tier covers MVP. Workers for backup API. R2 for encrypted blob storage. | Proposed |
| 2026-02-20 | CDN-hosted JSON feature flags (no vendor) | Simple, no cost, no dependency. Upgrade to LaunchDarkly if complexity warrants. | Proposed |
| 2026-02-20 | Zero-knowledge backup encryption | Users trust that even if server is breached, tax data is unreadable. | Proposed |
| 2026-02-20 | Paper filing only for MVP (no e-file) | E-file requires EFIN/ETIN/ATS testing — significant regulatory overhead. Paper filing is the pragmatic first step. | Adopted |

## Appendix B: Glossary

| Term | Definition |
|---|---|
| **CDN** | Content Delivery Network — serves static assets from edge locations worldwide |
| **CSP** | Content Security Policy — HTTP header that restricts what resources the browser can load |
| **EFIN** | Electronic Filing Identification Number — IRS-issued number for authorized e-file providers |
| **ETIN** | Electronic Transmitter Identification Number — for software that transmits e-file returns |
| **HSTS** | HTTP Strict Transport Security — forces HTTPS |
| **MeF** | Modernized e-File — IRS electronic filing system |
| **PII** | Personally Identifiable Information |
| **R2** | Cloudflare's S3-compatible object storage |
| **SLI** | Service Level Indicator — a metric that measures service behavior |
| **SLO** | Service Level Objective — a target value for an SLI |
| **SRI** | Subresource Integrity — browser verifies fetched resource matches expected hash |
| **SSE** | Server-Sent Events — unidirectional server-to-client streaming |
| **WAL** | Write-Ahead Logging — SQLite journaling mode for safer concurrent access |
| **WASM** | WebAssembly — binary instruction format for browser execution (used by Tesseract.js) |
