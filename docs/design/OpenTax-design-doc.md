# OpenTax — Design Document

Last updated: 2026-02-14

## Vision

Build **OpenTax**: an open-source, free-first tax filing assistant with TurboTax-quality UX, focused on transparency, explainability, and auditability. Every number on every form is traceable to source documents and IRS rules.

## Core thesis

- People should be able to prepare taxes for free.
- AI helps with intake and explanations, but final tax math must be deterministic rules code — never LLM output.
- Open-source rules + form mappings create trust, auditability, and community extensibility.

## Product principles

1. **Free core** for common returns — no paywalls on forms the IRS gives away for free.
2. **Explainability-first** — every number traceable to a source document line, a rule citation, and an IRS instruction reference.
3. **Audit trail by default** — workpapers and computation logs generated automatically.
4. **Privacy-first** — all computation runs client-side in the browser. No tax data leaves the user's device. Optional self-host for advanced features.
5. **Open rules engine** — tax rules, form definitions, and mappings are all open source and versioned per tax year.

## Target user scenario (MVP)

**Primary persona: W-2 tech worker with equity comp**
- W-2 wages (possibly multiple employers)
- RSU income + RSU stock sales (common double-taxation trap)
- Stock/ETF trading via brokerage (1099-B)
- Interest and dividend income (1099-INT, 1099-DIV)
- Standard deduction (most common) or basic itemized
- Filing by **mail** (print-ready PDF package)

---

## Product flow

### Step 1 — Intake
Upload or enter source documents:
- W-2 (photo/PDF upload with OCR, or manual entry)
- 1099-B (broker CSV import from Schwab, Fidelity, E*TRADE; or manual)
- 1099-INT, 1099-DIV (manual entry or upload)
- RSU vesting records (broker supplemental statements)

Each imported value gets a **confidence score** and a link back to its source. Low-confidence values are flagged for user verification.

### Step 2 — Guided interview
- Dependency-graph-driven: only ask questions relevant to the user's situation.
- Questions map to the canonical tax model (see below), not to form lines — form mapping happens automatically.
- Examples: Filing status? Dependents? Did you sell any stock? Did you receive RSUs?

### Step 3 — Compute + explain
- Live refund/balance-due display as data is entered.
- Per-form drill-down: click any line to see its inputs, rule, and IRS citation.
- RSU basis adjustment wizard: detect $0-basis 1099-B entries, walk user through correction.
- Warnings for common issues (e.g., wash sales, missing cost basis, W-2 box mismatches).

### Step 4 — Review + file
- Pre-filing checklist (completeness, consistency, math verification).
- Generate print-ready PDF package in correct IRS assembly order.
- Summary of all forms, key numbers, and action items.
- Future: e-file via MeF integration.

---

## Technical architecture

### System overview

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Client)                   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Intake   │  │ Interview│  │   Review / PDF    │  │
│  │  (upload, │→ │  (guided │→ │   (print package, │  │
│  │   OCR)    │  │   Q&A)   │  │    checklist)     │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │              │
│       ▼              ▼                 ▼              │
│  ┌──────────────────────────────────────────────┐    │
│  │          Canonical Tax Model (store)          │    │
│  │  taxpayer · income · documents · adjustments  │    │
│  └──────────────────┬───────────────────────────┘    │
│                     │                                │
│                     ▼                                │
│  ┌──────────────────────────────────────────────┐    │
│  │     Rules Engine (deterministic, versioned)   │    │
│  │  compute nodes · form mappings · citations    │    │
│  └──────────────────┬───────────────────────────┘    │
│                     │                                │
│                     ▼                                │
│  ┌──────────────────────────────────────────────┐    │
│  │      Form Compiler → filled IRS forms         │    │
│  │  (PDF generation, print-ready package)        │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │         Explainability Graph (UI)             │    │
│  │  "Why this number?" → trace to source + rule  │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Key constraint: everything above runs in the browser.** No server receives tax data.

### Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | **TypeScript** | Type safety for financial math, runs in browser and Node |
| Frontend | **React** + Vite | Fast dev, large ecosystem, good for form-heavy UIs |
| State | **Zustand** or plain React context | Lightweight, no server sync needed |
| Rules engine | **Pure TypeScript functions** | Deterministic, testable, versionable per tax year |
| PDF generation | **pdf-lib** (client-side) | Fill IRS PDF templates directly in browser |
| Data persistence | **IndexedDB** (via idb) | Local-only, survives page refresh, no server |
| Testing | **Vitest** | Fast, TypeScript-native, good snapshot support |
| Bundler | **Vite** | Fast builds, good TypeScript/React support |

### Canonical tax model

The central data structure. All UI, rules, and forms read from / write to this model.

```typescript
interface TaxReturn {
  taxYear: number;                    // e.g., 2025
  filingStatus: FilingStatus;         // single | mfj | mfs | hoh | qw
  taxpayer: Taxpayer;                 // name, SSN, address, DOB
  spouse?: Taxpayer;                  // if MFJ/MFS
  dependents: Dependent[];

  // Source documents (each field tracks its origin)
  w2s: W2[];
  form1099Bs: Form1099B[];
  form1099INTs: Form1099INT[];
  form1099DIVs: Form1099DIV[];

  // Derived/entered data
  rsuVestEvents: RSUVestEvent[];      // linked to W-2 and 1099-B
  capitalTransactions: CapitalTransaction[];  // after lot matching
  adjustments: Adjustment[];          // IRA, student loan, etc.
  deductions: {
    method: 'standard' | 'itemized';
    itemized?: ItemizedDeductions;
  };
  credits: Credit[];
}

// Every monetary value is traced
interface TracedValue {
  amount: number;                     // cents (integer) to avoid float errors
  source: ValueSource;                // document ref, computation ref, or user entry
  confidence: number;                 // 0-1, from OCR or import
  irsCitation?: string;               // e.g., "Form 1040, Line 1a"
}
```

**Important: all monetary values stored as integer cents** to eliminate floating-point rounding issues.

### Rules engine

```typescript
// Each rule is a pure function: inputs → output + explanation
interface ComputeNode {
  id: string;                         // e.g., "totalIncome"
  label: string;                      // "Total Income (Form 1040, Line 9)"
  compute: (model: TaxReturn) => TracedValue;
  dependsOn: string[];                // other node IDs
  irsCitation: string;                // instructions reference
  taxYear: number;                    // version pinning
}
```

Rules are organized by form and versioned by tax year:
```
src/rules/
  2025/
    form1040.ts           # 1040 line computations
    scheduleB.ts          # interest/dividends
    scheduleD.ts          # capital gains summary
    form8949.ts           # sales and dispositions
    scheduleA.ts          # itemized deductions
    taxComputation.ts     # brackets, rates, tax liability
    constants.ts          # standard deduction, bracket thresholds, etc.
```

### Form compiler

Maps computed values to IRS PDF form fields:
```typescript
interface FormFieldMapping {
  formId: string;         // "f1040"
  fieldName: string;      // IRS PDF field name
  computeNodeId: string;  // which rule produces this value
  line: string;           // "Line 1a"
}
```

The compiler:
1. Runs all relevant compute nodes in dependency order.
2. Maps outputs to PDF field names.
3. Fills IRS PDF templates using pdf-lib.
4. Assembles the complete filing package in correct order.

### Explainability graph

Every line on every form links back through the compute graph:

```
Form 1040, Line 9 (Total income): $145,230
  ├─ Line 1a (Wages): $120,000
  │   └─ Source: W-2 from Acme Corp, Box 1 [confidence: 1.0]
  ├─ Line 2b (Taxable interest): $230
  │   └─ Source: 1099-INT from Chase, Box 1 [confidence: 1.0]
  ├─ Line 3b (Ordinary dividends): $1,500
  │   └─ Source: 1099-DIV from Schwab, Box 1a [confidence: 1.0]
  └─ Line 7 (Capital gain/loss): $23,500
      └─ Schedule D, Line 16 → Form 8949 transactions [12 lots]
```

Users can click any number to expand its full derivation.

---

## W-2 + RSU + stock trading specifics

### W-2 handling
- Map all standard boxes (1–20) to canonical model fields.
- Multi-W-2 support: aggregate wages, withholding, etc.
- Detect state/local withholding for future state filing.
- Cross-validate: Box 1 (wages) should ≥ Box 3 (SS wages) in most cases.

### RSU basis adjustment (critical feature)

**The problem:** Brokers commonly report RSU sales on 1099-B with **$0 cost basis** or basis that excludes the income already taxed at vesting. This causes double taxation — the RSU income appears on both the W-2 (as ordinary income at vest) and on 1099-B (as full proceeds with no basis offset).

**How OpenTax solves this:**

1. **Link RSU events**: User enters (or imports) RSU vest records — vest date, # shares, FMV at vest, shares withheld for tax.
2. **Match to 1099-B**: When a 1099-B sale matches an RSU lot (same CUSIP, acquisition date = vest date), flag it.
3. **Detect $0 or wrong basis**: Compare 1099-B reported basis against known FMV-at-vest basis.
4. **Auto-generate Form 8949 adjustment**:
   - Column (e): correct basis = FMV at vest × shares sold
   - Column (f): Code **B** (basis reported to IRS is incorrect)
   - Column (g): adjustment amount = correct basis − reported basis
5. **Show the user**: Clear before/after comparison — "Without adjustment your gain would be $X (double-taxed). With adjustment, your actual gain is $Y."

**Example:**
| | Without adjustment | With adjustment |
|---|---|---|
| Proceeds | $12,000 | $12,000 |
| Basis (1099-B says) | $0 | → $10,000 (FMV at vest) |
| Reported gain | $12,000 | $2,000 |
| Code | — | B |

### Stock trading / 1099-B
- Parse broker 1099-B data (CSV import for Schwab, Fidelity, E*TRADE).
- Classify each transaction: short-term vs long-term (held > 1 year).
- Group by Form 8949 category:
  - **(A)** Short-term, basis reported to IRS
  - **(B)** Short-term, basis NOT reported to IRS
  - **(D)** Long-term, basis reported to IRS
  - **(E)** Long-term, basis NOT reported to IRS
- Wash sale detection: flag sales at a loss where substantially identical securities were purchased within 30 days before/after. Disallowed loss carries forward to new lot basis.
- Roll up to Schedule D summary.

---

## IRS forms — MVP coverage

### Forms generated (Phase 1)

| Form | Purpose | When included |
|---|---|---|
| **Form 1040** | Main individual return | Always |
| **Schedule B** | Interest & dividends detail | If interest or dividends > $1,500 |
| **Form 8949** | Capital asset sales detail | If any stock/RSU sales |
| **Schedule D** | Capital gains/losses summary | If any stock/RSU sales |
| **Schedule A** | Itemized deductions | If user chooses itemized |

### Paper filing package assembly

IRS requires forms in **Attachment Sequence Number** order:

1. Form 1040 (on top)
2. Schedule A (Seq. 07) — if itemizing
3. Schedule B (Seq. 08)
4. Schedule D (Seq. 12)
5. Form 8949 (Seq. 12A)
6. W-2 copies (stapled at end)
7. Any 1099s showing federal withholding

**Assembly**: single staple in upper-left corner. Payment check clipped (not stapled) to front if balance due.

OpenTax generates a single PDF with all pages in correct order, plus a cover sheet checklist.

---

## 2025 tax year reference (filing in 2026)

### Standard deduction
| Filing status | Amount |
|---|---|
| Single | $15,000 |
| Married filing jointly | $30,000 |
| Head of household | $22,500 |

### Tax brackets (Single)
| Rate | Taxable income range |
|---|---|
| 10% | $0 – $11,925 |
| 12% | $11,925 – $48,475 |
| 22% | $48,475 – $103,350 |
| 24% | $103,350 – $197,300 |
| 32% | $197,300 – $250,525 |
| 35% | $250,525 – $626,350 |
| 37% | Over $626,350 |

### Long-term capital gains rates
| Rate | Single taxable income |
|---|---|
| 0% | Up to ~$48,350 |
| 15% | $48,350 – $533,400 |
| 20% | Over $533,400 |

*Note: These numbers must be verified against final IRS publications for 2025. Store in `rules/2025/constants.ts` as single source of truth.*

---

## AI usage boundary

**Use AI for:**
- Document OCR / extraction assistance (with confidence scores)
- Conversational guidance and plain-English explanations
- Prompting for missing data ("You entered a 1099-B sale but no cost basis — did your broker provide a supplemental statement?")
- Help text and contextual education

**Never use AI for:**
- Final tax calculations — all math comes from deterministic, tested rules.
- Form field values — every value must trace through the compute graph.
- Filing decisions — surface options and explain trade-offs, but user decides.

---

## Testing strategy

Tax software correctness is critical. Testing approach:

1. **Unit tests per compute node**: Each rule function tested with known inputs → expected outputs.
2. **Integration test scenarios**: Complete tax returns with known correct outcomes:
   - Simple W-2 only (single filer, standard deduction)
   - W-2 + interest + dividends
   - W-2 + RSU sales (with basis adjustment)
   - Multiple 1099-Bs with wash sales
   - Itemized deduction scenario
3. **IRS worksheet verification**: Compare OpenTax outputs against hand-completed IRS worksheets.
4. **Snapshot tests**: Form field mappings — ensure PDF field values match expected for each scenario.
5. **Regression tests**: Any bug fix includes a test case that reproduces the bug.
6. **Property-based tests**: Tax liability should be monotonically non-decreasing with income (within a bracket). Refund + tax owed should equal total tax minus withholding.

---

## Privacy & security

- **No server**: all computation in browser. No tax data transmitted anywhere.
- **Local storage only**: IndexedDB for persistence. User can export/import JSON backup.
- **No analytics on tax data**: if analytics are added, they must never include PII or financial data.
- **SSN handling**: SSNs are masked in the UI by default (show last 4). Full SSN only written to final PDF. Never logged or stored in plain text outside the tax model.
- **Export**: user can download their complete data as encrypted JSON at any time.

---

## Existing open-source landscape

| Project | Tech | Status | Differentiation for OpenTax |
|---|---|---|---|
| **UsTaxes** | TypeScript/React | Active, browser-based | Similar philosophy — study their form coverage. OpenTax adds explainability graph + RSU workflow. |
| **HabuTax** | Python | Active | CLI-focused. OpenTax targets consumer UX. |
| **OpenTaxSolver** | C | Long-running | Desktop/CLI. No modern web UX. |
| **IRS Direct File** | Java (open-sourced) | Official IRS | Limited scope, not extensible by community. OpenTax is community-driven. |

**Key differentiators for OpenTax:**
1. Explainability-first (every number traceable to source + rule)
2. RSU basis adjustment as a first-class workflow
3. Modern browser-only architecture (true privacy)
4. Designed for the W-2 + equity comp persona specifically

---

## Project structure (proposed)

```
opentax/
├── src/
│   ├── model/                  # Canonical tax model types
│   │   ├── types.ts            # TaxReturn, W2, Form1099B, etc.
│   │   └── traced.ts           # TracedValue, ValueSource
│   ├── rules/
│   │   └── 2025/
│   │       ├── constants.ts    # Brackets, deduction amounts, rates
│   │       ├── form1040.ts     # 1040 line computations
│   │       ├── scheduleB.ts
│   │       ├── scheduleD.ts
│   │       ├── form8949.ts
│   │       ├── scheduleA.ts
│   │       └── taxComputation.ts
│   ├── forms/                  # Form compiler + PDF generation
│   │   ├── mappings/           # Form field → compute node mappings
│   │   ├── templates/          # IRS PDF templates (blank forms)
│   │   └── compiler.ts         # Fill PDFs from computed values
│   ├── intake/                 # Document parsing / import
│   │   ├── csv/                # Broker CSV parsers (Schwab, Fidelity, etc.)
│   │   └── ocr/                # OCR integration for uploaded docs
│   ├── interview/              # Guided Q&A flow
│   │   ├── questions.ts        # Question definitions + dependency graph
│   │   └── engine.ts           # Interview state machine
│   ├── ui/                     # React components
│   │   ├── pages/              # Intake, Interview, Review, etc.
│   │   ├── components/         # Shared UI components
│   │   └── explain/            # Explainability drill-down UI
│   ├── store/                  # State management
│   └── App.tsx
├── tests/
│   ├── rules/                  # Unit tests per compute node
│   ├── scenarios/              # Full return integration tests
│   └── forms/                  # PDF snapshot tests
├── public/
│   └── forms/                  # IRS PDF templates
├── package.json
├── vite.config.ts
├── tsconfig.json
└── OpenTax-design-doc.md
```

---

## MVP roadmap

### Phase 1 — Core engine + paper filing (current)

Phase 1 is broken into 13 steps with explicit dependencies and test criteria. Each step produces working, tested code before moving on.

---

#### Step 1: Project scaffolding
**Depends on:** nothing
**Produces:** buildable, testable empty project

Set up the repo with Vite + React + TypeScript + Vitest. Confirm the toolchain works end-to-end before writing any domain code.

- [ ] `npm create vite@latest` with React + TypeScript template
- [ ] Add Vitest config (`vitest.config.ts`), confirm `npm test` runs
- [ ] Add ESLint + Prettier with strict TypeScript rules
- [ ] Create directory skeleton: `src/model/`, `src/rules/2025/`, `src/forms/`, `src/intake/`, `tests/rules/`, `tests/scenarios/`, `tests/forms/`
- [ ] Add `pdf-lib` and `idb` as dependencies
- [ ] Verify `npm run dev` serves a blank page, `npm test` passes with a trivial test

**How to test:** `npm run build` succeeds. `npm test` passes. `npm run dev` opens in browser.

---

#### Step 2: Canonical tax model types
**Depends on:** Step 1
**Produces:** `src/model/types.ts`, `src/model/traced.ts`

Define the core data structures that the entire system reads and writes. No runtime logic yet — just types and factory functions.

- [ ] `TracedValue` type — amount (integer cents), source reference, confidence score, IRS citation
- [ ] `ValueSource` discriminated union — `'document'` (form + box), `'computed'` (node ID + inputs), `'user-entry'`
- [ ] `TaxReturn` — top-level container: taxYear, filingStatus, taxpayer, spouse, dependents
- [ ] `W2` — all boxes (1–20), employer EIN, employer name/address
- [ ] `Form1099B` — proceeds, cost basis, date acquired, date sold, wash sale loss disallowed, basis reported to IRS (yes/no), long-term/short-term
- [ ] `Form1099INT` — Box 1 (interest), Box 4 (federal tax withheld)
- [ ] `Form1099DIV` — Box 1a (ordinary dividends), Box 1b (qualified dividends), Box 2a (capital gain distributions), Box 4 (federal tax withheld)
- [ ] `RSUVestEvent` — vest date, # shares, FMV at vest, shares withheld for tax, linked W-2 ID
- [ ] `CapitalTransaction` — derived from 1099-B + RSU linkage: proceeds, adjusted basis, gain/loss, holding period, 8949 category (A/B/D/E), adjustment code, adjustment amount
- [ ] `FilingStatus` enum — `single`, `mfj`, `mfs`, `hoh`, `qw`
- [ ] Helper: `cents(dollars: number): number` — converts dollar amount to integer cents
- [ ] Helper: `dollars(cents: number): number` — converts back for display
- [ ] Factory: `emptyTaxReturn(taxYear: number): TaxReturn` — creates a blank return

**How to test:**
- **Compile-time:** TypeScript compiler catches type errors — a factory function that builds a `TaxReturn` with all required fields must compile.
- **Unit tests:** `cents(100.10)` → `10010`. `dollars(10010)` → `100.10`. Round-trip: `dollars(cents(x)) === x` for values with ≤ 2 decimal places.
- **Property test:** `cents()` always produces an integer (no fractional cents).

---

#### Step 3: 2025 tax constants
**Depends on:** Step 2
**Produces:** `src/rules/2025/constants.ts`

Single source of truth for all 2025 tax year numbers. Every bracket, rate, and threshold lives here — no magic numbers anywhere else.

- [ ] Standard deduction by filing status
- [ ] Ordinary income tax brackets by filing status (7 brackets × 5 statuses)
- [ ] Long-term capital gains rate thresholds by filing status (0% / 15% / 20%)
- [ ] Social Security wage base ($176,100 for 2025)
- [ ] Qualified dividend tax rate thresholds (same as LTCG)
- [ ] Schedule B threshold ($1,500 — when Schedule B is required)
- [ ] Capital loss deduction limit ($3,000 / $1,500 for MFS)
- [ ] Each constant annotated with IRS source (e.g., "Rev. Proc. 2024-40")

**How to test:**
- **Spot checks:** Compare every constant against IRS Revenue Procedure 2024-40 and 2025 Form 1040 instructions. Write tests that assert exact values: `expect(STANDARD_DEDUCTION.single).toBe(1500000)` (in cents).
- **Structural tests:** Every filing status has an entry. Bracket arrays are sorted ascending. Each bracket's floor equals the prior bracket's ceiling.

---

#### Step 4: Income aggregation rules (Form 1040 Lines 1–9)
**Depends on:** Steps 2, 3
**Produces:** `src/rules/2025/form1040.ts` (partial — income lines only)

Compute the income section of Form 1040 from source documents.

- [ ] **Line 1a — Wages:** Sum of all W-2 Box 1 values. Returns `TracedValue` sourced to each W-2.
- [ ] **Line 2a — Tax-exempt interest:** (placeholder $0 for MVP)
- [ ] **Line 2b — Taxable interest:** Sum of all 1099-INT Box 1 values.
- [ ] **Line 3a — Qualified dividends:** Sum of all 1099-DIV Box 1b values.
- [ ] **Line 3b — Ordinary dividends:** Sum of all 1099-DIV Box 1a values.
- [ ] **Line 7 — Capital gain/loss:** Reads from Schedule D Line 21 (or Line 16 if no 28%/unrecaptured gains). Depends on Step 6.
- [ ] **Line 8 — Other income:** (placeholder $0 for MVP)
- [ ] **Line 9 — Total income:** Sum of Lines 1a + 2b + 3b + 7 + 8.

Each function signature: `(model: TaxReturn) => TracedValue`

**How to test:**
- **Unit tests per line:** Create a `TaxReturn` fixture with 2 W-2s ($60k and $40k). Assert `computeLine1a(fixture).amount === 10_000_000` (cents). Assert `.source` references both W-2s.
- **Edge cases:** Zero W-2s → $0. One 1099-INT with $0 interest → $0.
- **Trace tests:** Every returned `TracedValue` has a valid `source` with document references.

---

#### Step 5: Schedule B — Interest & dividends
**Depends on:** Steps 2, 3
**Produces:** `src/rules/2025/scheduleB.ts`

Schedule B lists individual interest and dividend payers when totals exceed $1,500.

- [ ] **Part I — Interest:** List each 1099-INT payer + amount. Line 4 = total.
- [ ] **Part II — Ordinary Dividends:** List each 1099-DIV payer + amount. Line 6 = total.
- [ ] **Required check:** Function `isScheduleBRequired(model): boolean` — true if Line 4 > $1,500 or Line 6 > $1,500.
- [ ] Each line item carries payer name and EIN for the form.

**How to test:**
- **Threshold test:** 2 interest sources at $800 each → total $1,600 → Schedule B required. Single source at $1,400 → not required.
- **Aggregation test:** 3 payers → 3 line items in Part I, total matches sum.
- **Cross-check:** Schedule B Line 4 must equal Form 1040 Line 2b. Schedule B Line 6 must equal Form 1040 Line 3b. Write a test that computes both and asserts equality.

---

#### Step 6: Form 8949 + Schedule D — Capital gains
**Depends on:** Steps 2, 3
**Produces:** `src/rules/2025/form8949.ts`, `src/rules/2025/scheduleD.ts`

The most complex rules in Phase 1. Processes individual transactions into Form 8949, then summarizes on Schedule D.

**Form 8949:**
- [ ] Classify each `CapitalTransaction` into category A/B/D/E based on: (a) short-term vs long-term, (b) whether basis was reported to IRS.
- [ ] For each transaction: compute gain/loss = proceeds − adjusted basis.
- [ ] Group transactions by category for separate Form 8949 pages.
- [ ] Compute totals per category: total proceeds, total basis, total adjustments, total gain/loss.

**Schedule D:**
- [ ] **Part I — Short-term:** Line 1a (category A totals), Line 1b (category B totals). Line 7 = net short-term gain/loss.
- [ ] **Part II — Long-term:** Line 8a (category D totals), Line 8b (category E totals). Line 15 = net long-term gain/loss.
- [ ] **Part III — Summary:** Line 16 = Line 7 + Line 15 (net gain/loss). Apply $3,000 capital loss limitation (Line 21).
- [ ] **Qualified Dividends and Capital Gain Tax Worksheet** (from 1040 instructions) — used when there are qualified dividends or net LTCG, applies preferential rates instead of ordinary rates.

**How to test:**
- **Single sale test:** Buy 100 shares at $50, sell at $70, held 2 years, basis reported → category D, $2,000 LTCG.
- **Mixed test:** 3 short-term trades + 2 long-term trades → correct grouping into categories A and D.
- **Loss limitation:** Net capital loss of $5,000 → only $3,000 deductible on Line 21, $2,000 carries forward.
- **Category classification:** basis-reported short-term → A, basis-not-reported long-term → E, etc. Test all 4 categories.
- **Cross-form consistency:** Schedule D Line 1a totals must match Form 8949 category A totals. Write a test that computes both and asserts equality.
- **QDCG worksheet test:** $80k ordinary income + $20k LTCG for a single filer → the first ~$X of LTCG taxed at 0%, remainder at 15%. Compare against a hand-worked IRS worksheet.

---

#### Step 7: RSU basis adjustment
**Depends on:** Steps 2, 6
**Produces:** additions to `src/rules/2025/form8949.ts` + `src/model/types.ts` (RSU linking logic)

The key differentiating feature. Detects and corrects the double-taxation trap.

- [ ] **RSU-to-1099B matcher:** Given RSU vest events and 1099-B entries, match by: CUSIP (or symbol), acquisition date ≈ vest date, share quantity. Produce a match confidence score.
- [ ] **Basis discrepancy detector:** For matched RSU sales, compare 1099-B reported basis against `FMV at vest × shares sold`. Flag if 1099-B basis is $0 or significantly lower than expected.
- [ ] **Adjustment generator:** For flagged transactions, produce a `CapitalTransaction` with:
  - Adjusted basis = FMV at vest × shares sold
  - Code B in column (f)
  - Adjustment amount in column (g) = correct basis − reported basis
  - Category B (short-term, basis wrong) or E (long-term, basis wrong)
- [ ] **Impact calculator:** Compute "tax saved by adjustment" = (adjustment amount × marginal rate estimate). Display to user for motivation.

**How to test:**
- **Zero-basis test:** RSU vested at $100/share, 100 shares. 1099-B shows proceeds $12,000, basis $0. After adjustment: basis $10,000, gain $2,000, Code B, adjustment +$10,000.
- **Partial-basis test:** 1099-B shows basis $5,000 (half the correct amount). Adjustment should be +$5,000.
- **Correct-basis test:** 1099-B already shows $10,000 basis. No adjustment needed — matcher should flag this as "basis looks correct."
- **Multi-lot test:** 3 vest events, 2 sales — matcher correctly links each sale to the right vest lot.
- **No-match test:** A 1099-B sale with no corresponding RSU vest → no adjustment attempted, classified normally.
- **Integration test:** Full return with W-2 ($120k including RSU income) + RSU sale (1099-B with $0 basis). Compare tax with and without adjustment — the difference should equal the avoided double-tax.

---

#### Step 8: Tax computation (Form 1040 Lines 10–37)
**Depends on:** Steps 3, 4, 5, 6
**Produces:** `src/rules/2025/taxComputation.ts`, remainder of `src/rules/2025/form1040.ts`

Compute deductions, taxable income, tax liability, and refund/amount owed.

- [ ] **Line 10 — Adjustments to income:** (placeholder $0 for MVP — no IRA/student loan deductions yet)
- [ ] **Line 11 — Adjusted Gross Income:** Line 9 − Line 10.
- [ ] **Line 12 — Deductions:** Standard deduction (by filing status from constants) or Schedule A total. Include the higher-of logic.
- [ ] **Line 13 — Qualified business income deduction:** (placeholder $0)
- [ ] **Line 14 — Total deductions:** Line 12 + Line 13.
- [ ] **Line 15 — Taxable income:** max(0, Line 11 − Line 14).
- [ ] **Line 16 — Tax:** Computed via:
  - If qualified dividends or net LTCG exist → use Qualified Dividends and Capital Gain Tax Worksheet (preferential rates).
  - Otherwise → ordinary tax bracket computation.
- [ ] **Line 24 — Total tax:** Line 16 + (SE tax, AMT, etc. — all $0 for MVP).
- [ ] **Line 25 — Federal tax withheld:** Sum of all W-2 Box 2 + 1099 Box 4 values.
- [ ] **Line 33 — Total payments:** Line 25 + estimated payments (0 for MVP).
- [ ] **Line 34 — Overpayment:** If Line 33 > Line 24, the difference.
- [ ] **Line 37 — Amount you owe:** If Line 24 > Line 33, the difference.

**How to test:**
- **Simple W-2 test:** Single filer, $75,000 wages, $8,000 withheld, standard deduction, no investments.
  - AGI = $75,000. Taxable income = $75,000 − $15,000 = $60,000.
  - Tax = 10% of $11,925 + 12% of ($48,475 − $11,925) + 22% of ($60,000 − $48,475) = $1,192.50 + $4,386 + $2,535.50 = $8,114.
  - Refund = $8,000 − $8,114 = owes $114.
  - Assert exact amounts.
- **LTCG preferential rate test:** Single, $50,000 wages + $20,000 LTCG. The LTCG should be taxed at 0%/15% rates, not ordinary rates. Compare against hand-worked QDCG worksheet.
- **Zero income test:** No documents → taxable income $0, tax $0, no refund.
- **Boundary tests:** Income exactly at bracket boundaries. Taxable income at exactly $0 (deduction equals income).
- **MFJ test:** Use MFJ brackets/deduction for a married couple scenario. Verify different bracket thresholds apply.
- **Withholding aggregation:** 2 W-2s + 1 1099-INT with withholding → Line 25 sums all three.

---

#### Step 9: Schedule A — Itemized Deductions
**Depends on:** Steps 3, 8
**Produces:** `src/rules/2025/scheduleA.ts`, updates to `src/rules/2025/constants.ts` and `src/rules/2025/form1040.ts`

Implement Schedule A so that `computeLine12` correctly applies IRS rules (medical 7.5% AGI floor, $10K SALT cap) instead of naively summing raw itemized amounts.

- [ ] **Constants:** Add `MEDICAL_AGI_FLOOR_RATE` (0.075) and `SALT_CAP` ($10,000 / $5,000 for MFS) to `constants.ts`.
- [ ] **Schedule A computation:**
  - **Line 1 — Medical and dental expenses:** Raw total from `itemized.medical`.
  - **Line 2 — AGI:** From Form 1040 Line 11.
  - **Line 3 — 7.5% of AGI:** `Math.round(AGI * 0.075)`.
  - **Line 4 — Medical deduction:** `max(0, Line 1 − Line 3)` — only the amount exceeding 7.5% of AGI.
  - **Line 5–7 — State/local taxes (SALT):** Sum of state income tax (or sales tax), real estate tax, personal property tax. **Capped at $10,000** ($5,000 if MFS).
  - **Line 8–10 — Interest:** Mortgage interest (home acquisition debt, pass-through from input).
  - **Line 11–14 — Charitable contributions:** Sum of cash + non-cash contributions (pass-through from input).
  - **Line 15–16 — Other deductions:** Pass-through (casualty/theft in federally declared disaster, other).
  - **Line 17 — Total itemized deductions:** Sum of Lines 4 + 7 + 10 + 14 + 16.
- [ ] **Update `computeLine12`:** Accept AGI as input. When `deductions.method === 'itemized'`, compute Schedule A and compare against standard deduction. Preserve higher-of logic: use whichever is larger.
- [ ] **Expose `ScheduleAResult`:** Add to `Form1040Result` so downstream consumers (PDF filler, explainability trace) can access individual Schedule A lines.

**How to test:**
- **Medical below floor:** AGI $100,000, medical $5,000 → 7.5% floor = $7,500 → medical deduction $0.
- **Medical above floor:** AGI $100,000, medical $10,000 → deduction = $10,000 − $7,500 = $2,500.
- **Medical at floor:** AGI $100,000, medical $7,500 → deduction = $0.
- **SALT under cap:** SALT total $8,000 → passes through as $8,000.
- **SALT at cap:** SALT total $10,000 → passes through as $10,000.
- **SALT over cap:** SALT total $25,000 → capped at $10,000.
- **SALT MFS half-cap:** MFS filer, SALT total $8,000 → capped at $5,000.
- **Rounding edge case:** Verify 7.5% floor computation rounds correctly for odd AGI amounts.
- **Full realistic scenario:** AGI $150,000, medical $15,000, SALT $18,000, mortgage $12,000, charitable $5,000 → medical deduction = $15,000 − $11,250 = $3,750; SALT capped at $10,000; total = $3,750 + $10,000 + $12,000 + $5,000 = $30,750.
- **Integration through `computeForm1040`:** Verify Line 12 picks itemized ($30,750) over standard ($15,000) for a single filer with the above scenario.

---

#### Step 10: Broker CSV import (Robinhood)
**Depends on:** Step 2
**Produces:** `src/intake/csv/robinhood.ts`, `src/intake/csv/types.ts`, `src/intake/csv/utils.ts`

Parse real broker CSV exports into `Form1099B[]` and `CapitalTransaction[]`. Start with Robinhood (primary broker), with a shared interface for future Fidelity/Vanguard support.

- [ ] **Shared `BrokerParser` interface:** `BrokerParser { parse(csv: string): ParseResult }` where `ParseResult` has `transactions: Form1099B[]`, `warnings: string[]`, `errors: string[]`, `rowCounts: { total: number, parsed: number, skipped: number }`.
- [ ] **Manual RFC 4180 CSV parser:** No papaparse dependency — keeps bundle lean. Handle quoted fields, escaped quotes, CRLF/LF line endings.
- [ ] **Data cleaning utilities** (`src/intake/csv/utils.ts`):
  - `parseCurrency(raw: string): number | null` — `"$1,234.56"` → `123456` cents, `"($500.00)"` → `−50000`, `""` / `"N/A"` → `null`.
  - `parseDate(raw: string): string | null` — `"01/15/2025"` → `"2025-01-15"`, `"Various"` → `null` with warning.
  - `parseTerm(raw: string): 'short' | 'long' | null` — normalize term descriptions.
- [ ] **Robinhood 1099-B parser:** Flexible header mapping to handle column name variations across export years. Map columns: description, date acquired, date sold, proceeds, cost basis, wash sale loss disallowed, gain/loss, term (short/long).
- [ ] **RSU detection heuristic:** Flag transactions where description contains "RSU" or cost basis is $0 with a note suggesting RSU basis check.
- [ ] **Future:** Fidelity and Vanguard parsers will follow as a separate step, implementing the same `BrokerParser` interface.

**Note:** User will provide an actual Robinhood CSV to confirm exact column headers before implementation begins.

**How to test:**
- **Golden file test:** Take a real (anonymized) Robinhood CSV export, store as `tests/fixtures/robinhood-sample.csv`. Parse it and assert expected number of transactions, specific values for known rows.
- **Currency/date parsing edge cases:** `"$1,234.56"` → `123456`. `"($500.00)"` → `−50000`. `""` or `"N/A"` → null/flagged. `"01/15/2025"` → `"2025-01-15"`. `"Various"` → null with warning.
- **Empty/malformed CSV handling:** Empty CSV → empty result + no crash. CSV with headers only → empty result. Malformed row → appears in `errors`, other rows still parse.
- **Round-trip `Form1099B` validation:** Parse a CSV, then verify the resulting `Form1099B[]` objects have correct types and non-null required fields.

---

#### Step 11: PDF form filling + paper filing package
**Depends on:** Steps 4–9 (all rules), Step 10
**Produces:** `src/forms/compiler.ts`, `src/forms/mappings/*.ts`, PDF output

Fill IRS PDF templates with computed values and assemble the final print-ready package.

- [ ] **Obtain IRS PDF templates:** Download blank 2025 Form 1040, Schedule B, Schedule D, Form 8949. Store in `public/forms/`. These are public domain.
- [ ] **PDF field discovery:** Use pdf-lib to enumerate field names in each IRS PDF. Document the field-name-to-line mapping in `src/forms/mappings/`.
- [ ] **Form 1040 filler:** Map computed values to 1040 PDF fields. Include: taxpayer name, SSN, address, filing status checkbox, all income lines, deduction, taxable income, tax, withholding, refund/owed.
- [ ] **Schedule B filler:** Payer names + amounts for interest and dividends.
- [ ] **Form 8949 filler:** Transaction rows. Handle multiple pages if > ~14 transactions per category (each 8949 page has limited rows). Print category checkbox (A/B/D/E).
- [ ] **Schedule D filler:** Summary lines from Form 8949 totals.
- [ ] **Package assembler:** Merge all filled PDFs into one document in IRS attachment sequence order: 1040 → Schedule B (Seq 08) → Schedule D (Seq 12) → Form 8949 (Seq 12A).
- [ ] **Cover sheet generator:** First page summarizing: forms included, key numbers (AGI, total tax, refund/owed), mailing address (looked up by state), checklist (sign here, attach W-2, etc.).

**How to test:**
- **Field mapping smoke test:** Fill Form 1040 with a known fixture. Extract field values back from the PDF using pdf-lib. Assert Line 1a field contains the expected wage amount.
- **Visual inspection test:** Generate a PDF for each test scenario (simple W-2, W-2+RSU, W-2+trading). Open and visually verify correctness. Store these as reference PDFs.
- **Page ordering test:** Parse the assembled PDF. Assert pages appear in sequence order: 1040 first, then schedules by attachment sequence number.
- **Multi-page 8949 test:** Fixture with 30 transactions → should produce multiple Form 8949 pages. Assert all transactions appear, none are lost.
- **Round-trip integration test (most important):** Starting from a complete `TaxReturn` fixture:
  1. Run all rules → computed values.
  2. Fill all forms → assembled PDF.
  3. Extract field values from PDF.
  4. Assert extracted values match computed values.
  This catches both rule errors and mapping errors.

~/.claude/plans/idempotent-plotting-pumpkin.md
---

#### Step 12: Explainability trace
**Depends on:** Steps 4–9 (all rules)
**Produces:** `src/rules/engine.ts` (compute graph runner), trace data structure

Build the infrastructure for "why this number?" — not the UI (that's Phase 2), but the data layer.

- [ ] **Compute graph runner:** Takes a `TaxReturn`, runs all relevant `ComputeNode` functions in dependency order, returns a `ComputeResult` containing every node's output + full trace.
- [ ] **Trace data structure:** `ComputeTrace { nodeId, label, output: TracedValue, inputs: ComputeTrace[], irsCitation }` — a tree users can walk.
- [ ] **Dependency resolver:** Topological sort of compute nodes. Detect cycles (should be impossible but guard against it).
- [ ] **Selective computation:** Only compute nodes relevant to the user's situation (e.g., skip Schedule B nodes if no interest/dividends).
- [ ] **Console/JSON dump:** `explainLine(traceResult, "form1040.line16")` → returns human-readable trace string. Useful for debugging and for Phase 2 UI.

**How to test:**
- **Trace completeness:** For a W-2-only return, `explainLine("form1040.line9")` trace should include Line 1a → W-2 source. No "unknown source" in the tree.
- **Trace correctness:** For a return with LTCG, Line 16 (tax) trace should show the QDCG worksheet path, not the ordinary bracket path.
- **Dependency order:** If Node B depends on Node A, A must be computed before B. Scramble the node registration order and verify output is still correct.
- **Selective computation:** Return with no dividends → Schedule B nodes never execute. Verify via a mock/spy.
- **Cycle detection:** Register two nodes that depend on each other → should throw a clear error, not infinite loop.

---

#### Step 13: Integration test scenarios
**Depends on:** All previous steps
**Produces:** `tests/scenarios/*.test.ts`, `tests/fixtures/*.ts`

End-to-end tests using complete, realistic tax return data. These are the ultimate correctness check.

- [ ] **Scenario A — Simple W-2:** Single filer. One W-2 ($75,000 wages, $8,000 withheld). Standard deduction. No investments. Expected: taxable income $60,000, tax ~$8,114, owes ~$114.
- [ ] **Scenario B — W-2 + interest + dividends:** Single filer. W-2 ($90,000). 1099-INT ($2,500 interest). 1099-DIV ($3,000 ordinary, $1,500 qualified). Standard deduction. Schedule B required. QDCG worksheet applies.
- [ ] **Scenario C — W-2 + RSU sale (double-tax trap):** Single filer. W-2 ($150,000, includes $50,000 RSU income). 1099-B shows RSU sale: proceeds $55,000, basis $0. RSU vest: 500 shares at $100 FMV. Expected: Form 8949 adjustment +$50,000, actual gain $5,000 (not $55,000).
- [ ] **Scenario D — Multiple stock trades:** Single filer. W-2 ($80,000). 15 stock trades: mix of short-term gains, long-term gains, and losses. One wash sale. Expected: correct 8949 categorization, Schedule D summary, loss limitation if applicable.
- [ ] **Scenario E — MFJ basic:** Married filing jointly. Two W-2s ($60,000 + $45,000). Some interest. Standard deduction ($30,000). Verify MFJ brackets apply.

For each scenario:
- [ ] Define complete `TaxReturn` fixture with all source data.
- [ ] Hand-calculate the expected result for every form line (document the math in comments).
- [ ] Assert: every computed line matches expected value (exact cents).
- [ ] Assert: generated PDF contains correct values in correct fields.
- [ ] Assert: explainability trace for key lines (AGI, tax, refund) is complete and correct.

**How to test:** These *are* the tests. The key discipline:
- **Hand-calculate first.** Do the math on paper (or in a spreadsheet) using IRS instructions. Then write the assertion. Never derive the "expected" value from the code being tested.
- **Cross-check with IRS Free File / another tool.** Run the same scenario through UsTaxes or IRS tax tables to validate the expected numbers.
- **Maintain as living documentation.** Each scenario file documents a real-world use case with full worked math.

### Phase 2 — UX + polish
- [ ] Guided interview UI
- [ ] Document upload with OCR
- [ ] Wash sale detection and adjustment
- [ ] Multi-broker CSV support (Fidelity, Vanguard)
- [ ] Better explainability UI (interactive graph)

### Phase 3 — Expand
- [ ] State returns (CA as first target)
- [ ] Additional credits (child tax credit, education, etc.)
- [ ] E-file integration (MeF — requires EFIN/ETIN, ATS testing)
- [ ] ESPP support
- [ ] ISO/NQSO support
- [ ] AMT computation

---

## What is public / usable

**Freely available:**
- Tax laws, regulations, and IRS revenue rulings
- IRS forms, instructions, and publications (all public domain)
- State tax forms and instructions

**Has compliance gates:**
- Production e-file (MeF) requires EFIN, ETIN, and ATS testing (Publication 3112, 4164)
- Some broker API integrations may require partnership agreements

**Implication:** Paper filing is the right MVP target. E-file is Phase 3.

---

## Disclaimers

- OpenTax is not a CPA, EA, or legal representative.
- Users must review all forms before filing.
- The software performs calculations based on publicly available IRS rules, but the user bears responsibility for accuracy.
- OpenTax does not provide tax advice — it provides tax computation and explanation tools.
