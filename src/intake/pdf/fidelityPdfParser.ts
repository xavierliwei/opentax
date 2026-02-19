/**
 * Fidelity Consolidated 1099 PDF parser.
 *
 * Parses a Fidelity "Tax Reporting Statement" PDF and extracts:
 *   - 1099-B stock/ETF transactions (pages 3–5)
 *   - 1099-DIV summary (page 1)
 *   - 1099-INT summary (page 1)
 *
 * Fidelity column layout for 1099-B rows:
 *   Action | Quantity | Date Acquired | Date Sold | Proceeds |
 *   Cost Basis [(e)] | Accrued Market Discount | Wash Sale Loss Disallowed |
 *   Gain/Loss | Federal Tax Withheld | State Tax Withheld
 *
 * Security headers: "MICROSOFT CORP, MSFT, 594918104" (description, symbol, CUSIP)
 * Section headers identify Form 8949 category (A/D) via "Box A/D checked" text.
 */

import type { Form1099B, Form1099DIV, Form1099INT } from '../../model/types'
import type { ConsolidatedParseResult } from '../csv/types'
import { ensureWorker, extractItems, groupLines } from './pdfUtils'
import type { Line } from './pdfUtils'

type Category8949 = 'A' | 'B' | 'D' | 'E'

const BROKER_NAME = 'Fidelity Brokerage Services LLC'

// ── Helpers ──────────────────────────────────────────────────

const DATE_RE = /^\d{2}\/\d{2}\/\d{2}$/
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

// ── Section detection ────────────────────────────────────────

function detectBoxCategory(text: string): Category8949 | null {
  const m = text.match(/Box\s+([ABDE])\s+checked/i)
  return m ? (m[1].toUpperCase() as Category8949) : null
}

/** Fidelity security headers: "DESCRIPTION, SYMBOL, CUSIP_9DIGIT" */
function parseSecurityHeader(text: string): { description: string; symbol: string; cusip: string } | null {
  // Match lines like "MICROSOFT CORP, MSFT, 594918104"
  // or "GRANITESHARES ETF TR2X LONG NVDA DAI, NVDL, 38747R827"
  // CUSIP is the last comma-separated token and is 9 alphanumeric chars
  const m = text.match(/^(.+?),\s*([A-Z]{1,5}),\s*([A-Z0-9]{9})\s*$/)
  if (!m) return null
  return { description: m[1].trim(), symbol: m[2].trim(), cusip: m[3].trim() }
}

// ── 1099-DIV parsing ─────────────────────────────────────────

function parseDivSection(lines: Line[]): Form1099DIV | null {
  let box1a = 0, box1b = 0, box2a = 0, box3 = 0, box4 = 0, box5 = 0, box11 = 0

  for (const line of lines) {
    const t = line.text
    // Match patterns like "1a Total Ordinary Dividends...90.94"
    // The dotted leaders connect label to value; we just look for the trailing number
    const valMatch = t.match(/([\d,]+\.\d{2})\s*$/)
    if (!valMatch) continue
    const val = parseCents(valMatch[1])

    if (/^1a\s/i.test(t)) box1a = val
    else if (/^1b\s/i.test(t)) box1b = val
    else if (/^2a\s/i.test(t)) box2a = val
    else if (/^3\s+Nondividend/i.test(t)) box3 = val
    else if (/^4\s+Federal/i.test(t)) box4 = val
    else if (/^5\s+Section\s*199A/i.test(t)) box5 = val
    else if (/^12\s+Exempt/i.test(t)) box11 = val
  }

  // Only create a DIV form if there's actual dividend income
  if (box1a === 0 && box1b === 0 && box2a === 0) return null

  return {
    id: crypto.randomUUID(),
    payerName: BROKER_NAME,
    box1a, box1b, box2a, box3, box4, box5, box11,
  }
}

// ── 1099-INT parsing ─────────────────────────────────────────

function parseIntSection(lines: Line[]): Form1099INT | null {
  let box1 = 0, box2 = 0, box3 = 0, box4 = 0, box8 = 0

  for (const line of lines) {
    const t = line.text
    const valMatch = t.match(/([\d,]+\.\d{2})\s*$/)
    if (!valMatch) continue
    const val = parseCents(valMatch[1])

    if (/^1\s+Interest\s+Income/i.test(t)) box1 = val
    else if (/^2\s+Early/i.test(t)) box2 = val
    else if (/^3\s+Interest\s+on\s+U\.?S/i.test(t)) box3 = val
    else if (/^4\s+Federal/i.test(t)) box4 = val
    else if (/^8\s+Tax.Exempt/i.test(t)) box8 = val
  }

  if (box1 === 0 && box3 === 0 && box8 === 0) return null

  return {
    id: crypto.randomUUID(),
    payerName: BROKER_NAME,
    box1, box2, box3, box4, box8,
  }
}

// ── Column position detection ────────────────────────────────

/**
 * Column x-position boundaries for Fidelity 1099-B tables.
 * Detected from the header row containing "Action", "Proceeds", etc.
 * Dollar values in transaction rows are assigned to columns by x-position.
 */
interface ColumnPositions {
  proceeds: number      // x of "Proceeds" / "1d" label
  costBasis: number     // x of "Cost or" / "1e" label
  washSale: number      // x of "Wash Sale" / "1g" label
  gainLoss: number      // x of "Gain/Loss" label
  fedTax: number        // x of "4 Federal" label
}

function detectColumnPositions(line: Line): ColumnPositions | null {
  // The header line contains items like "1d", "Proceeds", "1e", "Cost or", "1g", "Wash Sale", "Gain/Loss"
  let proceeds = 0, costBasis = 0, washSale = 0, gainLoss = 0, fedTax = 0

  for (const item of line.items) {
    const s = item.str.trim()
    if (s === '1d' || s === 'Proceeds') proceeds = item.x
    if (s === '1e' || s === 'Cost or') costBasis = item.x
    if (s === '1g' || s === 'Wash Sale') washSale = item.x
    if (/^Gain\/Loss/i.test(s)) gainLoss = item.x
    if (/^4 Federal/i.test(s) || (s === '4' && fedTax === 0)) fedTax = item.x
  }

  if (proceeds && costBasis && gainLoss) {
    // If wash sale column not found, place it between cost basis and gain/loss
    if (!washSale) washSale = (costBasis + gainLoss) / 2
    // If fed tax column not found, place it well after gain/loss
    if (!fedTax) fedTax = gainLoss + 200
    return { proceeds, costBasis, washSale, gainLoss, fedTax }
  }
  return null
}

/** Assign a dollar value to a column based on its x-position */
function assignColumn(x: number, cols: ColumnPositions): 'proceeds' | 'costBasis' | 'washSale' | 'gainLoss' | 'fedTax' | 'skip' {
  // Compute midpoints between columns for boundary detection
  const mid_proc_cost = (cols.proceeds + cols.costBasis) / 2
  const mid_cost_wash = (cols.costBasis + cols.washSale) / 2
  const mid_wash_gl = (cols.washSale + cols.gainLoss) / 2
  const mid_gl_fed = (cols.gainLoss + cols.fedTax) / 2

  if (x < mid_proc_cost) return 'proceeds'
  if (x < mid_cost_wash) return 'costBasis'
  if (x < mid_wash_gl) return 'washSale'
  if (x < mid_gl_fed) return 'gainLoss'
  return 'fedTax'
}

// ── 1099-B transaction row parsing ───────────────────────────

interface TxnFields {
  dateAcquired: string | null
  dateSold: string
  proceeds: number
  costBasis: number
  washSale: number
  gainLoss: number
  federalTaxWithheld: number
}

function parseTxnRow(line: Line, cols: ColumnPositions): TxnFields | null {
  const items = line.items

  // Extract dates and dollar values with their x-positions
  let dateAcquired: string | null = null
  let dateSold: string | null = null
  let foundSale = false
  let foundQty = false
  let proceeds = 0, costBasis = 0, washSale = 0, gainLoss = 0, federalTaxWithheld = 0

  for (const item of items) {
    const s = item.str.trim()
    if (!s || s === '(e)') continue

    // "Sale" action
    if (/^sale$/i.test(s)) { foundSale = true; continue }

    // Quantity (3 decimal places)
    if (!foundQty && /^-?[\d,]+\.\d{3}$/.test(s)) { foundQty = true; continue }

    // Date fields: first date = acquired, second = sold
    if (DATE_RE.test(s)) {
      if (!dateAcquired && !dateSold) {
        dateAcquired = parseDate(s)
      } else if (!dateSold) {
        dateSold = parseDate(s)
      }
      continue
    }
    if (/^various$/i.test(s)) {
      dateAcquired = null
      continue
    }

    // Dollar values — assign by x-position
    if (DOLLARS_RE.test(s)) {
      const col = assignColumn(item.x, cols)
      const val = parseCents(s)
      if (col === 'proceeds') proceeds = val
      else if (col === 'costBasis') costBasis = val
      else if (col === 'washSale') washSale = val
      else if (col === 'gainLoss') gainLoss = val
      else if (col === 'fedTax') federalTaxWithheld = val
    }
  }

  if (!foundSale || !dateSold) return null

  return { dateAcquired, dateSold, proceeds, costBasis, washSale, gainLoss, federalTaxWithheld }
}

// ── Main export ──────────────────────────────────────────────

export async function parseFidelityPdf(data: ArrayBuffer): Promise<ConsolidatedParseResult> {
  const transactions: Form1099B[] = []
  const warnings: string[] = []
  const errors: string[] = []
  let total = 0
  let parsed = 0
  let skipped = 0

  const form1099DIVs: Form1099DIV[] = []
  const form1099INTs: Form1099INT[] = []

  try {
    await ensureWorker()
    const rawItems = await extractItems(data)
    const lines = groupLines(rawItems)

    // ── Phase 1: Identify sections and collect section lines ──
    type Section = 'div' | 'int' | '1099b' | 'supplemental' | null
    let currentSection: Section = null
    let divLines: Line[] = []
    let intLines: Line[] = []

    // 1099-B state
    let currentCategory: Category8949 | null = null
    let awaitingBox = false
    let currentDesc = ''
    let currentSymbol = ''
    let currentCusip = ''
    let colPositions: ColumnPositions | null = null

    for (const line of lines) {
      const text = line.text

      // ── Stop at supplemental pages ──
      if (/Supplemental\s+Information\s+Not\s+Reported/i.test(text) ||
          /SUPPLEMENTAL\s+INFORMATION/i.test(text)) {
        break
      }

      // ── Detect section transitions ──
      if (/Form\s+1099-DIV\s*\*/i.test(text)) {
        currentSection = 'div'
        continue
      }
      if (/Form\s+1099-INT\s*\*/i.test(text)) {
        currentSection = 'int'
        continue
      }
      if (/FORM\s+1099-B\s*\*/i.test(text)) {
        currentSection = '1099b'
        continue
      }
      if (/Form\s+1099-MISC\s*\*/i.test(text)) {
        currentSection = null // skip MISC
        continue
      }
      if (/Summary\s+of\s+\d{4}\s+Proceeds/i.test(text)) {
        currentSection = null // summary table, skip
        continue
      }
      if (/Summary\s+of\s+\d{4}\s+Original/i.test(text)) {
        currentSection = null
        continue
      }

      // ── Collect lines for DIV/INT sections ──
      if (currentSection === 'div') {
        divLines.push(line)
        continue
      }
      if (currentSection === 'int') {
        intLines.push(line)
        continue
      }

      // ── 1099-B parsing ──
      if (currentSection !== '1099b') continue

      // Section header: SHORT/LONG TERM TRANSACTIONS
      // In Fidelity PDFs, the section header and "Box X checked" are often on the same line
      if (/\b(Short|Long).term\s+transactions\s+for\s+which\s+basis\b/i.test(text)) {
        const cat = detectBoxCategory(text)
        if (cat) {
          currentCategory = cat
          awaitingBox = false
        } else {
          awaitingBox = true
        }
        continue
      }

      // Box category on a separate line: "Box A checked"
      if (awaitingBox) {
        const cat = detectBoxCategory(text)
        if (cat) {
          currentCategory = cat
          awaitingBox = false
        }
        continue
      }

      if (!currentCategory) continue

      // Column header line — detect x-positions for value columns
      if (/^\s*Action\b/i.test(text) && /Quantity/i.test(text)) {
        const detected = detectColumnPositions(line)
        if (detected) colPositions = detected
        continue
      }
      if (/^\s*\(IRS\s+Form/i.test(text)) continue
      if (/^\s*1a\s+Description/i.test(text)) continue
      if (/^\s*Proceeds\s+are\s+reported/i.test(text)) continue

      // Skip Subtotals / TOTALS / Box summary lines / dashed separators
      if (/^Subtotals\b/i.test(text) || /^TOTALS\b/i.test(text)) {
        skipped++
        continue
      }
      if (/^Box\s+[ABDE]\s+(Short|Long)/i.test(text)) continue
      if (/^[\s\-]+$/.test(text.replace(/\s/g, ''))) continue  // dash separators
      if (/^\*\s*This\s+is\s+important/i.test(text)) continue  // footer disclaimer
      if (/^Acquired\b/i.test(text)) continue  // continuation of column header
      if (/^Discount\b/i.test(text)) continue  // continuation of column header

      // Security header: "DESCRIPTION, SYMBOL, CUSIP"
      const sec = parseSecurityHeader(text)
      if (sec) {
        currentDesc = sec.description
        currentSymbol = sec.symbol
        currentCusip = sec.cusip
        continue
      }

      // Transaction row: starts with "Sale"
      if (/^Sale\b/i.test(text) && colPositions) {
        total++

        const fields = parseTxnRow(line, colPositions)
        if (!fields) {
          warnings.push(`Page ${line.page}: could not parse row "${text.slice(0, 60)}…" (skipped)`)
          skipped++
          continue
        }

        const isLongTerm = currentCategory === 'D' || currentCategory === 'E'
        const basisReported = currentCategory === 'A' || currentCategory === 'D'
        const noncovered = currentCategory === 'B' || currentCategory === 'E'

        // RSU warning: $0 basis on a non-option equity sale
        if (fields.costBasis === 0 && fields.proceeds > 0) {
          warnings.push(
            `"${currentDesc}" may be an RSU sale (cost basis is $0). ` +
              `Verify basis matches FMV at vest date to avoid double taxation.`,
          )
        }

        transactions.push({
          id: crypto.randomUUID(),
          brokerName: BROKER_NAME,
          description: currentSymbol
            ? `${currentDesc} (${currentSymbol})`
            : currentDesc,
          cusip: currentCusip || undefined,
          dateAcquired: fields.dateAcquired,
          dateSold: fields.dateSold,
          proceeds: fields.proceeds,
          costBasis: fields.costBasis,
          washSaleLossDisallowed: fields.washSale,
          gainLoss: fields.gainLoss,
          basisReportedToIrs: basisReported,
          longTerm: isLongTerm,
          noncoveredSecurity: noncovered,
          federalTaxWithheld: fields.federalTaxWithheld,
        })
        parsed++
      }
    }

    // ── Parse DIV and INT sections ──
    const div = parseDivSection(divLines)
    if (div) form1099DIVs.push(div)

    const int = parseIntSection(intLines)
    if (int) form1099INTs.push(int)

  } catch (err) {
    errors.push(`PDF parse error: ${err instanceof Error ? err.message : String(err)}`)
  }

  return {
    transactions,
    warnings,
    errors,
    rowCounts: { total, parsed, skipped },
    form1099DIVs,
    form1099INTs,
  }
}
