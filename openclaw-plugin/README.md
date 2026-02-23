# OpenTax OpenClaw Plugin

OpenClaw plugin for conversational US federal income tax preparation (2025 tax year). Provides 16 agent tools for data entry, document processing, tax computation, and explainability — plus a live dashboard HTTP API with SSE.

## Prerequisites

- **Node.js >= 20**
- **OpenClaw** runtime (the plugin registers tools and services via the OpenClaw plugin API)
- **npm** (for dependency installation)

## Install & Setup

### 1. Clone and install

```bash
git clone <repo-url> opentax && cd opentax
npm install
```

### 2. Build the frontend (required for the dashboard)

```bash
npm run build
```

This compiles TypeScript and bundles the React frontend into `dist/`.

### 3. Register with OpenClaw

Add the plugin to your OpenClaw configuration (`openclaw.json` or equivalent):

```json
{
  "plugins": {
    "entries": {
      "openclaw-plugin-opentax": {
        "path": "./openclaw-plugin",
        "config": {
          "workspace": ".",
          "httpPort": 7890,
          "staticDir": "./dist"
        }
      }
    }
  }
}
```

The plugin entry point is `openclaw-plugin/index.ts`, declared in `openclaw-plugin/package.json` under `"openclaw.extensions"`.

## Configuration

All config fields are optional with sensible defaults:

| Field | Default | Description |
|---|---|---|
| `workspace` | Current working directory | Directory for SQLite state persistence (`opentax.db`) |
| `httpPort` | `7890` | Port for the dashboard HTTP API and SSE stream |
| `staticDir` | `./dist` | Path to built frontend assets served by the dashboard |

Config is passed via `pluginConfig` in your OpenClaw plugin entry. See `openclaw.plugin.json` for the full JSON Schema.

## Agent Tools

The plugin registers these tools with the OpenClaw agent:

### Query tools (read-only)

| Tool | Description |
|---|---|
| `tax_get_status` | Current return status: completion %, gaps, tax summary, next suggested action |
| `tax_get_result` | Computed results: AGI, taxable income, tax, withholding, refund/owed |
| `tax_explain` | Explain how a specific line was calculated (e.g., `form1040.line15`) |

### Data entry tools

| Tool | Description |
|---|---|
| `tax_set_filing_status` | Set filing status (`single`, `mfj`, `mfs`, `hoh`, `qw`) |
| `tax_set_personal_info` | Set taxpayer name, SSN, address |
| `tax_set_spouse_info` | Set spouse info (required for `mfj`) |
| `tax_add_dependent` | Add a dependent |
| `tax_add_w2` | Add a W-2 (wages + withholding) |
| `tax_add_1099_int` | Add a 1099-INT (interest income) |
| `tax_add_1099_div` | Add a 1099-DIV (dividend income) |
| `tax_add_capital_transaction` | Add a capital gain/loss transaction |
| `tax_set_deductions` | Set itemized deductions |

### Document & import tools

| Tool | Description |
|---|---|
| `tax_process_document` | Extract data from a PDF tax document (W-2, 1099). Returns extracted fields for confirmation — does not auto-import. |
| `tax_import_csv` | Import brokerage CSV (auto-detects broker format). Two-step: preview first, then `confirm: true` to import. |

### Utility tools

| Tool | Description |
|---|---|
| `tax_reset` | Reset the return to a blank state (destructive) |
| `tax_export_json` | Export the full TaxReturn as JSON |

All monetary tool parameters are in **dollars** (e.g., `60000` = $60,000), not cents.

## HTTP API

The plugin starts an HTTP server (default port `7890`) serving:

| Endpoint | Method | Description |
|---|---|---|
| `/api/status` | GET | Full state: tax return, computed result, gap analysis |
| `/api/gap-analysis` | GET | Completion percentage and missing items |
| `/api/events` | GET | SSE stream — pushes `stateChanged` events with completion % |
| `/api/return.json` | GET | Raw TaxReturn JSON export |
| `/api/sync` | POST | Import a TaxReturn (with optimistic version checking) |
| `/*` | GET | Static file serving (SPA with `index.html` fallback) |

Open `http://localhost:7890` in a browser to access the interactive dashboard.

## Local Development

### Run OpenTax standalone (no OpenClaw)

```bash
npm run dev
```

Starts the Vite frontend (`:5173`) and backend API (`:7891`) with hot reload. The standalone server reuses the same `TaxService` and HTTP layer as the plugin.

### Run tests

```bash
npm test                # unit tests (Vitest) — includes plugin tests
npm run test:e2e        # headless E2E tests (Playwright)
```

Plugin-specific tests live in `tests/plugin/`:

- `tests/plugin/TaxService.test.ts` — core service logic
- `tests/plugin/GapAnalysis.test.ts` — gap detection
- `tests/plugin/tools/dataEntry.test.ts` — data entry tools
- `tests/plugin/tools/query.test.ts` — query tools

### Type-check the plugin

```bash
npx tsc -p openclaw-plugin/tsconfig.json --noEmit
```

### Project structure

```
openclaw-plugin/
  index.ts               # Plugin entry point (registers tools + HTTP service)
  openclaw.plugin.json    # Plugin manifest (id, skills, config schema)
  SKILL.md               # Agent skill instructions (workflow, rules, node IDs)
  package.json            # Plugin dependencies (better-sqlite3)
  tsconfig.json           # TypeScript config (ES2022, strict)
  service/
    TaxService.ts         # Core tax service (state, compute, persistence)
    GapAnalysis.ts        # Re-exports shared gap analysis module
  tools/
    registerTools.ts      # Adapts sync ToolDefs to async OpenClaw API
    dataEntry.ts          # Data entry tools (filing status, W-2, 1099, etc.)
    query.ts              # Read-only tools (status, result, explain)
    document.ts           # PDF extraction and CSV import
    utility.ts            # Reset and JSON export
  http/
    httpService.ts        # HTTP server (REST + SSE + static files)
    serialize.ts          # ComputeResult serialization
```

## Example Usage

A typical agent conversation flow:

```
User: "I made $85,000 at Acme Corp and had $15,000 withheld."

Agent calls: tax_set_filing_status({ status: "single" })
Agent calls: tax_add_w2({ employer: "Acme Corp", wages: 85000, federalWithheld: 15000 })
Agent calls: tax_get_status()
  → "Tax Return Status (35% complete) — Estimated refund: $4,582.00"

User: [sends photo of 1099-INT]

Agent calls: tax_process_document({ filePath: "/tmp/1099-int.pdf" })
  → "Detected form: 1099-INT — Interest income: $1,200"
Agent calls: tax_add_1099_int({ payer: "Chase Bank", interest: 1200 })

User: "What's my taxable income?"

Agent calls: tax_explain({ nodeId: "form1040.line15" })
  → Breakdown: AGI $86,200 − standard deduction $15,350 = $70,850
```

See `SKILL.md` for the full agent workflow, validation rules, and common node IDs for `tax_explain`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE` on port 7890 | Another process (or a previous instance) is using the port | Set a different `httpPort` in config, or stop the conflicting process |
| Dashboard shows blank page | Frontend not built | Run `npm run build` from the repo root |
| `Cannot find module 'better-sqlite3'` | Dependencies not installed | Run `npm install` from the repo root |
| SSE events not arriving | Browser/client not connected to correct port | Verify `httpPort` config; check `http://localhost:7890/api/events` |
| `opentax.db` locked / `SQLITE_BUSY` | Multiple processes sharing the same database file | Each process/worktree must have its own `opentax.db` — copy the file or set a separate `workspace` |
| CSV import fails | Unsupported broker format | Check supported formats; file must be a standard brokerage transaction export |
| PDF extraction returns "unknown" | Unrecognized form layout | Supported forms: W-2, 1099-INT, 1099-DIV, 1099-R. Enter other forms manually. |

## Security & Privacy

- **All data stays local.** Tax data is stored in a SQLite database (`opentax.db`) in the configured workspace directory on your machine. No data is sent to external servers.
- **HTTP API binds to localhost.** The dashboard server listens on `localhost` only. It is not exposed to the network unless you explicitly configure otherwise.
- **CORS is open.** The HTTP API sets `Access-Control-Allow-Origin: *` for local development convenience. This is safe when bound to localhost but should be restricted if the server is ever exposed externally.
- **No authentication.** The HTTP API has no auth layer — it relies on localhost binding for access control. Do not expose the port to untrusted networks.
- **SSN handling.** SSNs entered via `tax_set_personal_info` / `tax_set_spouse_info` are stored in the local SQLite database only. They are never logged or transmitted.
- **File access.** `tax_process_document` and `tax_import_csv` read files from the local filesystem at paths provided by the agent. The plugin does not write to arbitrary paths.

## Related Docs

- [OpenTax README](../README.md) — project overview, standalone setup, scripts, architecture
- [SKILL.md](./SKILL.md) — agent skill instructions, tool list, workflow rules, common node IDs
- [openclaw.plugin.json](./openclaw.plugin.json) — plugin manifest and config schema
- [docs/design/OpenTax-design-doc.md](../docs/design/OpenTax-design-doc.md) — architecture and design decisions
