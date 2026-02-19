/**
 * Robinhood Consolidated 1099-B PDF parser.
 *
 * Parses the PDF exported from Robinhood (Consolidated Form 1099) and extracts
 * 1099-B stock and option transactions.
 *
 * Column layout (in x-position order within each transaction row):
 *   date_sold | quantity | proceeds [G/N] | date_acquired | cost_basis |
 *   wash_sale [W/D] | gain_loss | additional_info
 *
 * Section headers identify Form 8949 category (A/B/D/E).
 */

import * as pdfjsLib from 'pdfjs-dist'
import rawWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { Form1099B } from '../../model/types'
import type { ParseResult } from '../csv/types'

// ── PDF.js worker setup ───────────────────────────────────────
//
// The worker file (.mjs) must be served with a JavaScript MIME type, but
// some static servers (including the OpenTax dev server) may not handle .mjs
// correctly. To work around this, we fetch the worker source and re-serve it
// via a blob URL with the correct MIME type, which is guaranteed to work.
// The blob URL is cached so the fetch only happens once per page load.

let _workerBlobUrl: string | null = null

async function ensureWorker(): Promise<void> {
  if (_workerBlobUrl) return
  try {
    const res = await fetch(rawWorkerUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    _workerBlobUrl = URL.createObjectURL(
      new Blob([text], { type: 'application/javascript' }),
    )
  } catch {
    // Fall back to the direct URL — works when the server is configured correctly
    _workerBlobUrl = rawWorkerUrl
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = _workerBlobUrl
}

// ── Internal types ────────────────────────────────────────────

interface RawItem {
  str: string
  x: number
  y: number
  width: number
  page: number
}

interface Line {
  items: RawItem[]
  /** Full text with single spaces inserted where column gaps occur */
  text: string
  y: number
  page: number
}

type Category8949 = 'A' | 'B' | 'D' | 'E'

// ── PDF text extraction ───────────────────────────────────────

async function extractItems(data: ArrayBuffer): Promise<RawItem[]> {
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const out: RawItem[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      out.push({
        str: item.str,
        x: item.transform[4],
        // Flip y so that y=0 is the top of the page
        y: viewport.height - item.transform[5],
        width: item.width,
        page: p,
      })
    }
  }

  return out
}

// ── Line grouping ─────────────────────────────────────────────

function groupLines(items: RawItem[], yTolerance = 4): Line[] {
  // Sort: by page, then top-to-bottom (y), then left-to-right (x)
  const sorted = [...items].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page
    if (Math.abs(a.y - b.y) > yTolerance) return a.y - b.y
    return a.x - b.x
  })

  const lines: Line[] = []
  let group: RawItem[] = []

  for (const item of sorted) {
    const prev = group[group.length - 1]
    if (!prev || (item.page === prev.page && Math.abs(item.y - prev.y) <= yTolerance)) {
      group.push(item)
    } else {
      if (group.length > 0) lines.push(buildLine(group))
      group = [item]
    }
  }
  if (group.length > 0) lines.push(buildLine(group))
  return lines
}

function buildLine(items: RawItem[]): Line {
  const sorted = [...items].sort((a, b) => a.x - b.x)
  const parts: string[] = []
  let prevRight = -Infinity

  for (const item of sorted) {
    // Insert a space if there's a visible gap between items (column boundary)
    if (prevRight > 0 && item.x > prevRight + 2) parts.push(' ')
    parts.push(item.str)
    prevRight = item.x + item.width
  }

  return {
    items: sorted,
    text: parts.join('').trim(),
    y: sorted[0].y,
    page: sorted[0].page,
  }
}

// ── Section / category detection ──────────────────────────────

function detectBoxCategory(text: string): Category8949 | null {
  // "Report on Form 8949, Part I with Box A checked."
  // "Report on Form 8949, Part II with Box D checked."
  const m = text.match(/Box\s+([ABDE])\s+checked/i)
  return m ? (m[1].toUpperCase() as Category8949) : null
}

// ── Security header ───────────────────────────────────────────

function isCusipLine(text: string): boolean {
  return text.includes('/ CUSIP:')
}

function parseCusipLine(text: string): { description: string; cusip: string } {
  // Stocks:  "ADVANCED MICRO DEVICES, INC. COMMON STOCK / CUSIP: 007903107 / Symbol:"
  // Options: "AAPL 08/01/2025 CALL $205.00 / CUSIP:  / Symbol: AAPL 08/01/25 C 205.000"
  const m = text.match(/^(.+?)\s*\/\s*CUSIP:\s*([^/]*?)\s*\//)
  if (m) {
    return { description: m[1].trim(), cusip: m[2].trim() }
  }
  return { description: text.trim(), cusip: '' }
}

// ── Transaction row parsing ───────────────────────────────────

// MM/DD/YY — the two-digit year format used throughout the PDF
const DATE_RE = /^\d{2}\/\d{2}\/\d{2}$/
// Quantities have exactly 3 decimal places (e.g. 200.000, 3,500.000, 0.001)
const SHARES_RE = /^-?[\d,]+\.\d{3}$/
// Dollar amounts have exactly 2 decimal places (e.g. 28,287.87, -1,410.09, 0.00)
const DOLLARS_RE = /^-?[\d,]+\.\d{2}$/

function parseCents(s: string): number {
  return Math.round(parseFloat(s.replace(/,/g, '')) * 100)
}

function parseDate(s: string): string | null {
  if (!s || /^various$/i.test(s)) return null
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (!m) return null
  const [, mm, dd, yy] = m
  const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`
  return `${year}-${mm}-${dd}`
}

interface TxnFields {
  dateSold: string         // ISO
  dateAcquired: string | null  // ISO or null for Various
  proceeds: number         // cents (can be negative for short options)
  costBasis: number        // cents
  washSale: number         // cents
  gainLoss: number         // cents
  additional: string
}

/**
 * Parse a transaction row using a token-based state machine.
 * Tokens are text items sorted left-to-right.
 *
 * Expected sequence:
 *   DATE  SHARES  DOLLARS[N|G]  DATE|Various  DOLLARS
 *   (DOLLARS W|D | ...)  DOLLARS  TEXT*
 */
function parseTxnRow(line: Line): TxnFields | null {
  // Collect raw tokens
  const raw = line.items.map((it) => it.str.trim()).filter(Boolean)

  // Normalize: merge consecutive lone "." into "..."
  const collapsed: string[] = []
  for (let i = 0; i < raw.length; ) {
    if (raw[i] === '.' && raw[i + 1] === '.' && raw[i + 2] === '.') {
      collapsed.push('...')
      i += 3
    } else {
      collapsed.push(raw[i++])
    }
  }

  // Merge numeric fragments split at the decimal point.
  // Robinhood PDFs sometimes emit numbers as two separate text items, e.g.:
  //   "200" + ".000"  →  "200.000"
  //   "28,287" + ".87"  →  "28,287.87"
  const merged: string[] = []
  for (let i = 0; i < collapsed.length; ) {
    const cur = collapsed[i]
    const next = collapsed[i + 1] ?? ''
    if (/^-?[\d,]+$/.test(cur) && /^\.\d+$/.test(next)) {
      merged.push(cur + next)
      i += 2
    } else {
      merged.push(cur)
      i++
    }
  }

  // Split tokens that contain an embedded flag character.
  // The PDF sometimes emits proceeds and wash-sale amounts with their flag
  // letter fused into a single text item:
  //   "28,287.87 N"  →  ["28,287.87", "N"]   (proceeds + net flag)
  //   "1,197.02 W"   →  ["1,197.02",  "W"]   (wash-sale + disallowed flag)
  const tokens: string[] = []
  for (const tok of merged) {
    const m = tok.match(/^(-?[\d,]+\.\d{2})\s+([NGWD])$/)
    if (m) {
      tokens.push(m[1], m[2])
    } else {
      tokens.push(tok)
    }
  }

  let i = 0

  // ── 1. Date sold ──────────────────────────────────────────
  if (!DATE_RE.test(tokens[i] ?? '')) return null
  const dateSold = parseDate(tokens[i++])
  if (!dateSold) return null

  // ── 2. Quantity (skip — we don't need share count) ───────
  // SHARES_RE catches 3-decimal share quantities. Also accept plain integers
  // for rare cases like "1" (single contract).
  if (i >= tokens.length) return null
  if (SHARES_RE.test(tokens[i]) || /^[\d,]+$/.test(tokens[i])) {
    i++
  }

  // ── 3. Proceeds ──────────────────────────────────────────
  if (i >= tokens.length || !DOLLARS_RE.test(tokens[i])) return null
  const proceeds = parseCents(tokens[i++])

  // ── 4. Optional G/N flag ─────────────────────────────────
  if (tokens[i] === 'N' || tokens[i] === 'G') i++

  // ── 5. Date acquired or "Various" ────────────────────────
  if (i >= tokens.length) return null
  let dateAcquired: string | null = null
  if (DATE_RE.test(tokens[i])) {
    dateAcquired = parseDate(tokens[i++])
  } else if (/^various$/i.test(tokens[i])) {
    dateAcquired = null
    i++
  } else {
    return null
  }

  // ── 6. Cost basis ─────────────────────────────────────────
  if (i >= tokens.length || !DOLLARS_RE.test(tokens[i])) return null
  const costBasis = parseCents(tokens[i++])

  // ── 7. Wash sale column: "..." or DOLLARS + W/D flag ─────
  let washSale = 0
  if (i < tokens.length) {
    if (/^\.+$/.test(tokens[i])) {
      // "..." → no wash sale
      i++
    } else if (DOLLARS_RE.test(tokens[i])) {
      const flag = tokens[i + 1]
      if (flag === 'W' || flag === 'D') {
        washSale = parseCents(tokens[i])
        i += 2 // consume amount + flag
      }
      // If not followed by W/D, fall through without consuming:
      // the DOLLARS here must be the gain/loss (wash sale column is blank)
    }
  }

  // ── 8. Gain / loss ────────────────────────────────────────
  if (i >= tokens.length || !DOLLARS_RE.test(tokens[i])) return null
  const gainLoss = parseCents(tokens[i++])

  // ── 9. Additional info (rest of row) ──────────────────────
  const additional = tokens.slice(i).join(' ')

  return { dateSold, dateAcquired, proceeds, costBasis, washSale, gainLoss, additional }
}

// ── Main export ───────────────────────────────────────────────

export async function parseRobinhoodPdf(data: ArrayBuffer): Promise<ParseResult> {
  const transactions: Form1099B[] = []
  const warnings: string[] = []
  const errors: string[] = []
  let total = 0
  let parsed = 0
  let skipped = 0

  try {
    await ensureWorker()
    const rawItems = await extractItems(data)
    const lines = groupLines(rawItems)

    let currentCategory: Category8949 | null = null
    // After seeing a section header, wait for the "Box X checked" sub-header
    let awaitingBox = false
    let currentDesc = ''
    let currentCusip = ''

    for (const line of lines) {
      const text = line.text

      // ── Section header: SHORT/LONG TERM TRANSACTIONS FOR … ──
      if (/\b(SHORT|LONG)\s+TERM\s+TRANSACTIONS\s+FOR\b/i.test(text)) {
        awaitingBox = true
        continue
      }

      // ── Box category sub-header: "Box A checked" ──────────
      if (awaitingBox) {
        const cat = detectBoxCategory(text)
        if (cat) {
          currentCategory = cat
          awaitingBox = false
        }
        // Skip all lines until we confirm the category
        continue
      }

      // ── Not in a 1099-B section yet ───────────────────────
      if (!currentCategory) continue

      // ── Skip boilerplate / non-data lines ─────────────────
      if (
        /^1a-\s*Description/i.test(text) || // column header
        /^1c-\s*Date/i.test(text) || // column header
        /^\s*"Gain or loss/i.test(text) || // column note
        /Security total:/i.test(text) || // subtotal row
        /^\*\s*This is important/i.test(text) // footer
      ) {
        if (/Security total:/i.test(text)) skipped++
        continue
      }

      // ── Security header (contains "/ CUSIP:") ─────────────
      if (isCusipLine(text)) {
        const { description, cusip } = parseCusipLine(text)
        currentDesc = description
        currentCusip = cusip
        continue
      }

      // ── Transaction row (first token is MM/DD/YY) ─────────
      const firstToken = line.items[0]?.str?.trim() ?? ''
      if (DATE_RE.test(firstToken)) {
        // Non-1099-B rows (dividends, interest, margin interest) also start
        // with a date but have far fewer tokens — skip them silently.
        const rawItemCount = line.items.filter((it) => it.str.trim()).length
        if (rawItemCount < 5) continue

        total++

        const fields = parseTxnRow(line)
        if (!fields) {
          warnings.push(`Page ${line.page}: could not parse row (skipped)`)
          skipped++
          continue
        }

        const isLongTerm = currentCategory === 'D' || currentCategory === 'E'
        const basisReported = currentCategory === 'A' || currentCategory === 'D'
        const noncovered = currentCategory === 'B' || currentCategory === 'E'

        // RSU warning: $0 basis on a non-option equity sale
        const isOption = /\b(CALL|PUT)\b/i.test(currentDesc)
        if (fields.costBasis === 0 && !isOption && fields.proceeds > 0) {
          warnings.push(
            `"${currentDesc}" may be an RSU sale (cost basis is $0). ` +
              `Verify basis matches FMV at vest date to avoid double taxation.`,
          )
        }

        transactions.push({
          id: crypto.randomUUID(),
          brokerName: 'Robinhood Securities LLC',
          description: currentDesc,
          cusip: currentCusip || undefined,
          dateAcquired: fields.dateAcquired,
          dateSold: fields.dateSold,
          proceeds: fields.proceeds,
          // For short options cost basis is genuinely $0 (not unreported)
          costBasis: fields.costBasis,
          washSaleLossDisallowed: fields.washSale,
          gainLoss: fields.gainLoss,
          basisReportedToIrs: basisReported,
          longTerm: isLongTerm,
          noncoveredSecurity: noncovered,
          federalTaxWithheld: 0,
        })
        parsed++
      }
    }
  } catch (err) {
    errors.push(`PDF parse error: ${err instanceof Error ? err.message : String(err)}`)
  }

  return { transactions, warnings, errors, rowCounts: { total, parsed, skipped } }
}
