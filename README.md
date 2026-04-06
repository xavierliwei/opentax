# OpenTax

Free, open-source tax preparation software with transparent computation, full explainability, and privacy-first design. Every number on your return can be traced back to its source document and the IRS rule that produced it.

**[Documentation](https://opentax.evokelab.ai/)** · **[MIT License](./LICENSE)**

---

## Why OpenTax

- **Transparent** — every computed value carries provenance. Click any number to see exactly where it came from and why.
- **Private** — all tax computation runs client-side in the browser. Your tax data never leaves your device.
- **Deterministic** — the rules engine is pure TypeScript functions with no LLM math. Same inputs always produce the same outputs.
- **Explainable** — interactive trace graphs let you drill from a final refund amount down to the W-2 box or IRS rule that produced it.

## What's supported

### Federal (2025 tax year)

| Category | Forms |
|----------|-------|
| **Core** | Form 1040 |
| **Schedules** | 1, 2, 3, A, B, C, D, E, SE |
| **Credits** | 8812 (Child Tax), 8863 (Education), 1116 (Foreign Tax) |
| **Other** | 6251 (AMT), 8889 (HSA), 8949 (Capital Gains), 8995/8995-A (QBI) |

Income types: W-2, 1099-INT, 1099-DIV, 1099-R, 1099-B, K-1, rental, self-employment, RSUs, ISOs.

### State (12 states)

CA · CT · DC · GA · MA · MD · NC · NJ · NY · OH · PA · VA

Full-year, part-year, and nonresident residency types with apportionment.

## Quick start

```bash
npm install
npm run dev
```

Opens the frontend at http://localhost:5173 with the backend API on :7891. Both hot-reload.

### Production

```bash
npm run build
npm start
```

The backend serves the built frontend at http://localhost:7891.

## How it works

```
Upload docs ─→ Interview ─→ Compute ─→ Review ─→ Download PDFs
   (OCR)       (guided)     (rules)    (trace)    (IRS forms)
```

1. **Intake** — upload W-2s, 1099s, or broker CSVs. PDFs are OCR'd with confidence scoring. Broker statements from Fidelity, Robinhood, and E\*TRADE are auto-detected.
2. **Interview** — dependency-driven Q&A that only asks relevant questions based on what you've entered so far.
3. **Compute** — deterministic rules engine processes your data through the canonical tax model. All amounts are integer cents to avoid floating-point errors.
4. **Review** — pre-filing checklist, gap analysis with completion percentage, and interactive trace graphs for any line item.
5. **Download** — client-side PDF generation fills official IRS templates (18 federal forms, 12 state forms) and assembles them in correct attachment sequence order with a cover sheet.

## Architecture

```
src/
├── model/        Canonical TaxReturn type, TracedValue system
├── rules/        Deterministic computation engine
│   └── 2025/     Federal + state rules (ca/, ct/, dc/, ga/, ...)
├── forms/        PDF compilation pipeline
│   ├── fillers/  One filler per IRS/state form
│   └── mappings/ AcroForm field name → result value mappings
├── intake/       Document OCR, PDF parsing, broker CSV import
├── store/        Zustand state management (synced to IndexedDB)
└── ui/           React pages and components
    └── explain/  Interactive trace graph visualization

server/           Node.js backend (SQLite persistence, REST + SSE)
openclaw-plugin/  AI agent plugin (16 tools for conversational tax prep)
```

**Key design decisions:**
- Amounts stored as integer cents everywhere to eliminate floating-point drift
- Every value is a `TracedValue` carrying its source, confidence score, and optional IRS citation
- Rules are pure functions: `(TaxReturn, ...deps) → Result` — no side effects, fully testable
- PDF generation is 100% client-side using pdf-lib — nothing is sent to a server

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Frontend + backend with hot reload |
| `npm run dev:fe` | Frontend only (Vite dev server) |
| `npm start` | Production (backend serves built frontend) |
| `npm run build` | TypeScript check + Vite production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E tests (Playwright) |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `OPENTAX_PORT` | `7891` | Backend API port |
| `OPENTAX_WORKSPACE` | `.` | Directory for SQLite database |
| `OPENTAX_STATIC_DIR` | `./dist` | Built frontend assets |

## Tech stack

**Frontend:** React 19, Vite 7, TypeScript, Tailwind CSS 4, Zustand
**PDF:** pdf-lib (form filling), pdfjs-dist (OCR/extraction)
**Persistence:** IndexedDB (browser), SQLite (backend)
**Testing:** Vitest, Testing Library, Playwright

## OpenClaw plugin

The `openclaw-plugin/` directory is a standalone [OpenClaw](https://github.com/openclaw) extension for AI-assisted tax preparation. It exposes 16 agent tools (data entry, document processing, computation, explanation) over a REST + SSE API. See [`openclaw-plugin/README.md`](./openclaw-plugin/README.md) for details.

## Contributing

```bash
npm install
npm test           # unit tests
npm run test:e2e   # e2e (requires: npx playwright install)
```

The rules engine lives in `src/rules/2025/`. Each form or schedule is a self-contained module with its own constants, computation function, and test suite. State rules follow the same pattern under `src/rules/2025/{state-code}/`.

## License

[MIT](./LICENSE)
