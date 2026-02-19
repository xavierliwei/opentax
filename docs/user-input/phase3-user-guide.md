# Phase 3 User Guide — Agentic Tax Filing with OpenClaw

## Overview

Phase 3 adds three capabilities to OpenTax:

1. **OpenClaw Plugin** — An AI agent on Telegram that walks users through tax filing conversationally
2. **HTTP API + SSE** — A real-time API (port 7890) that serves tax state and pushes live updates
3. **Dashboard** — A web page at `/dashboard` showing live tax status, updated in real-time as the agent works

All three share the same `TaxService` instance, so changes made by the agent show up on the dashboard instantly, and vice versa.

---

## 1. Using the OpenClaw Plugin (Telegram Agent)

### Installation

```bash
openclaw plugins install -l ./openclaw-plugin
```

This registers all 16 agent tools and starts the HTTP API on port 7890.

### Talking to the Agent

Once installed, message the bot on Telegram. The agent follows a conversational workflow:

**Starting a session:**
> "Let's do my taxes"

The agent calls `tax_get_status` internally and tells you what's needed.

**Entering income naturally:**
> "I made $60,000 at Google and they withheld $9,000"

The agent extracts the employer name, wages, and withholding, confirms them with you, then calls `tax_add_w2`.

**Sending document photos:**
> *[sends a photo of a W-2]*

The agent runs OCR via `tax_process_document`, shows the extracted fields with confidence scores, and asks you to confirm before entering the data.

**Checking status at any time:**
> "How's my return looking?"

The agent calls `tax_get_status` and reports completion %, missing items, and your current refund/owed amount.

**Getting explanations:**
> "Why do I owe $2,000?"

The agent calls `tax_explain` on `form1040.line37` and walks through the calculation tree.

### Agent Tools Reference

| Tool | Purpose |
|------|---------|
| `tax_get_status` | Gap analysis — what's done, what's missing, next suggestion |
| `tax_get_result` | Computed numbers: AGI, tax, refund/owed |
| `tax_explain` | Trace any line back to its sources |
| `tax_set_filing_status` | Set single/mfj/mfs/hoh/qw |
| `tax_set_personal_info` | Name, SSN, address |
| `tax_set_spouse_info` | Spouse details (for MFJ) |
| `tax_add_dependent` | Add a dependent |
| `tax_add_w2` | Add a W-2 (dollar amounts, not cents) |
| `tax_add_1099_int` | Add interest income |
| `tax_add_1099_div` | Add dividend income |
| `tax_add_capital_transaction` | Add a stock sale |
| `tax_set_deductions` | Standard or itemized with amounts |
| `tax_process_document` | OCR a tax document photo |
| `tax_import_csv` | Import brokerage CSV (two-step: preview, then confirm) |
| `tax_reset` | Clear the entire return |
| `tax_export_json` | Export full TaxReturn as JSON |

All monetary parameters are in **dollars** (e.g., `wages: 60000`). The service converts to cents internally.

---

## 2. Using the HTTP API Directly

The plugin starts an HTTP server on **port 7890**. You can use it from any client (curl, browser, scripts).

### Endpoints

#### `GET /api/status`
Full state snapshot including gap analysis.

```bash
curl http://localhost:7890/api/status | jq .gapAnalysis.completionPercent
# 65
```

Response shape:
```json
{
  "taxReturn": { ... },
  "computeResult": { "form1040": { ... }, "values": { ... } },
  "stateVersion": 7,
  "gapAnalysis": {
    "completionPercent": 65,
    "readyToFile": false,
    "items": [{ "category": "personal", "field": "ssn", "label": "Taxpayer SSN", "priority": "required" }],
    "nextSuggestedAction": "Ask the user for their SSN.",
    "warnings": []
  }
}
```

#### `GET /api/gap-analysis`
Just the gap analysis (lighter payload).

```bash
curl http://localhost:7890/api/gap-analysis | jq .readyToFile
```

#### `GET /api/return.json`
Raw TaxReturn export (for backup or external tools).

```bash
curl http://localhost:7890/api/return.json > my-return-backup.json
```

#### `GET /api/events` (SSE)
Server-Sent Events stream. Pushes an event on every state change.

```bash
curl -N http://localhost:7890/api/events
# data: {"type":"connected","stateVersion":7}
# data: {"type":"stateChanged","stateVersion":8,"completionPercent":72,"timestamp":"2025-..."}
```

Each event includes the new `stateVersion` and `completionPercent` so lightweight clients can update without re-fetching the full status.

#### `POST /api/sync`
Push state from the web UI (or any client) to the server. Includes version conflict detection.

```bash
curl -X POST http://localhost:7890/api/sync \
  -H 'Content-Type: application/json' \
  -d '{"taxReturn": {...}, "stateVersion": 7}'
```

Returns `200 {"ok":true, "stateVersion":8}` on success, or `409` if there's a version conflict.

---

## 3. Using the Dashboard

### Starting the dashboard

The dashboard is a React page at `/dashboard` in the existing Vite dev server:

```bash
npm run dev
# Open http://localhost:5173/dashboard
```

It connects to the HTTP API at `http://localhost:7890` by default.

### Custom API URL

If the plugin runs on a different host (e.g., via Tailscale):

```bash
VITE_DASHBOARD_API=http://100.x.x.x:7890 npm run dev
```

### What it shows

- **Connection indicator** — green/red dot showing SSE connection status
- **Completion bar** — percentage from the gap analysis engine
- **Tax summary** — AGI, total tax, withholding, refund/owed
- **Section cards** — Personal, Income, Deductions — each shows complete/incomplete
- **Gap items** — missing required/recommended items with priority badges
- **Activity log** — timestamped SSE events showing when state changes
- **"Open Interview" link** — jumps to the P2 web UI at `/interview/filing-status`

The dashboard updates in **real-time** via SSE. When the agent adds a W-2 via Telegram, the dashboard reflects it within a second.

---

## 4. Syncing the P2 Web UI with the Agent

The existing interview-style web UI can share state with the agent via the sync adapter. This is opt-in — call it from the browser console or integrate it into your app code.

### From the browser console

```js
import { connectToServer } from '/src/store/syncAdapter.ts'

const disconnect = connectToServer({ serverUrl: 'http://localhost:7890' })

// Later, to stop syncing:
disconnect()
```

### How sync works

1. On connect, the adapter fetches the server's current state and imports it into the Zustand store
2. Local changes (via the web UI) are POST-ed to `/api/sync`
3. Remote changes (via the agent) arrive via SSE and are imported into the store
4. A **loop guard** (`isRemoteUpdate` flag) prevents SSE-triggered imports from being POST-ed back
5. **Version tracking** prevents stale overwrites — if the server is ahead, a 409 is returned

---

## 5. Using TaxService Programmatically

You can use `TaxService` directly in any Node.js script (no OpenClaw required):

```ts
import { TaxService } from './openclaw-plugin/service/TaxService.ts'
import { analyzeGaps } from './openclaw-plugin/service/GapAnalysis.ts'
import { createHttpService } from './openclaw-plugin/http/httpService.ts'

// Create service with a workspace directory for persistence
const service = new TaxService('/tmp/my-taxes')

// Set personal info
service.setTaxpayer({
  firstName: 'John',
  lastName: 'Doe',
  ssn: '123456789',
  address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
})

// Add a W-2 (amounts in cents)
import { cents } from './src/model/traced.ts'
service.addW2({
  id: 'w2-1',
  employerName: 'Acme Corp',
  employerEin: '12-3456789',
  box1: cents(60000),   // $60,000 wages
  box2: cents(9000),    // $9,000 withheld
  box3: cents(60000),
  box4: cents(3720),
  box5: cents(60000),
  box6: cents(870),
  box7: 0, box8: 0, box10: 0, box11: 0,
  box12: [],
  box13StatutoryEmployee: false,
  box13RetirementPlan: false,
  box13ThirdPartySickPay: false,
  box14: '',
})

// Check results
const { form1040 } = service.computeResult
console.log('AGI:', form1040.line11.amount / 100)
console.log('Tax:', form1040.line16.amount / 100)
console.log('Refund:', form1040.line34.amount / 100)

// Run gap analysis
const gaps = analyzeGaps(service.taxReturn, service.computeResult)
console.log('Completion:', gaps.completionPercent + '%')
console.log('Ready to file:', gaps.readyToFile)
console.log('Next step:', gaps.nextSuggestedAction)

// Listen for changes
service.on('stateChanged', ({ stateVersion }) => {
  console.log('State updated to version', stateVersion)
})

// Start the HTTP API (optional)
const http = createHttpService(service)
await http.start()
console.log('API running on port 7890')

// Persist to disk
service.persistNow()
```

### Key differences from the Zustand store

| Aspect | Zustand Store (P2) | TaxService (P3) |
|--------|-------------------|-----------------|
| Runtime | Browser | Node.js |
| Persistence | IndexedDB | JSON file on disk |
| Reactivity | Zustand subscriptions | EventEmitter (`stateChanged`) |
| Monetary input | Cents (internal) | Cents (internal); agent tools accept dollars |
| State access | `useTaxStore.getState()` | `service.taxReturn` / `service.computeResult` |

---

## 6. Architecture Diagram

```
Telegram ---- OpenClaw Gateway ---- Plugin Tools ---- TaxService (in-memory + file)
                                                           |
                                                      EventEmitter
                                                           |
                                                     HTTP (port 7890)
                                                      /api/* + SSE
                                                           |
                                          +---------+------+--------+
                                          |                         |
                                    Dashboard                 P2 Web UI
                                    /dashboard              syncAdapter
                                    (React + SSE)         (Zustand + POST)
```

All three consumers (agent, dashboard, web UI) operate on the same `TaxService` instance. State is persisted to `{workspace}/opentax-state.json` and survives restarts.

---

## 7. File Map

```
openclaw-plugin/
  index.ts                  Plugin entry point
  package.json              ESM manifest
  tsconfig.json             Node.js TypeScript config
  SKILL.md                  Agent skill definition
  service/
    TaxService.ts           Headless tax service (EventEmitter + persistence)
    GapAnalysis.ts           Gap analysis engine
  tools/
    registerTools.ts         Master tool registration
    dataEntry.ts             9 data entry tools
    query.ts                 3 query tools
    document.ts              2 document tools (OCR + CSV)
    utility.ts               2 utility tools (reset + export)
  ocr/
    ocrNodeEngine.ts         Node.js tesseract.js wrapper
  http/
    httpService.ts           HTTP server + SSE (port 7890)
    serialize.ts             Map<->Record conversion for JSON

src/
  model/serialize.ts         Shared serialization (used by dashboard client)
  store/syncAdapter.ts       Zustand <-> HTTP API sync
  ui/pages/
    DashboardPage.tsx        Live dashboard (SSE + fetch)
    DashboardLayout.tsx      Minimal mobile layout
  App.tsx                    (modified) Added /dashboard route
```
