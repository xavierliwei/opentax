/**
 * Fidelity Consolidated 1099 PDF parser.
 *
 * Parses a Fidelity "Tax Reporting Statement" PDF and extracts:
 *   - 1099-B stock/ETF transactions (pages 3–5)
 *   - 1099-DIV summary (page 1)
 *   - 1099-INT summary (page 1)
 *   - Supplemental Stock Plan Lot Detail (pages 9–10) for adjusted RSU/ESPP basis
 *
 * Fidelity column layout for 1099-B rows:
 *   Action | Quantity | Date Acquired | Date Sold | Proceeds |
 *   Cost Basis [(e)] | Accrued Market Discount | Wash Sale Loss Disallowed |
 *   Gain/Loss | Federal Tax Withheld | State Tax Withheld
 *
 * Security headers: "MICROSOFT CORP, MSFT, 594918104" (description, symbol, CUSIP)
 * Section headers identify Form 8949 category (A/D) via "Box A/D checked" text.
 *
 * For transactions marked (e) — employer stock plan shares — cost basis on the
 * 1099-B may not include compensation income adjustments. The "Supplemental Stock
 * Plan Lot Detail" provides the correct adjusted cost basis and adjusted gain/loss.
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

/** Parse quantity string (3 decimal places) to integer thousandths */
function parseQuantity(s: string): number {
  return Math.round(parseFloat(s.replace(/,/g, '')) * 1000)
}

// ── Section detection ────────────────────────────────────────

function detectBoxCategory(text: string): Category8949 | null {
  const m = text.match(/Box\s+([ABDE])\s+checked/i)
  return m ? (m[1].toUpperCase() as Category8949) : null
}

/** Fidelity security headers: "DESCRIPTION, SYMBOL, CUSIP_9DIGIT" */
function parseSecurityHeader(text: string): { description: string; symbol: string; cusip: string } | null {
  const m = text.match(/^(.+?),\s*([A-Z]{1,5}),\s*([A-Z0-9]{9})\s*$/)
  if (!m) return null
  return { description: m[1].trim(), symbol: m[2].trim(), cusip: m[3].trim() }
}

// ── 1099-DIV parsing ─────────────────────────────────────────

function parseDivSection(lines: Line[]): Form1099DIV | null {
  let box1a = 0, box1b = 0, box2a = 0, box3 = 0, box4 = 0, box5 = 0, box11 = 0

  for (const line of lines) {
    const t = line.text
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

interface ColumnPositions {
  proceeds: number
  costBasis: number
  washSale: number
  gainLoss: number
  fedTax: number
}

function detectColumnPositions(line: Line): ColumnPositions | null {
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
    if (!washSale) washSale = (costBasis + gainLoss) / 2
    if (!fedTax) fedTax = gainLoss + 200
    return { proceeds, costBasis, washSale, gainLoss, fedTax }
  }
  return null
}

function assignColumn(x: number, cols: ColumnPositions): 'proceeds' | 'costBasis' | 'washSale' | 'gainLoss' | 'fedTax' | 'skip' {
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
  quantity: number          // shares × 1000 (integer thousandths)
  hasEMarker: boolean       // true if (e) marker present on cost basis
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

  let dateAcquired: string | null = null
  let dateSold: string | null = null
  let foundSale = false
  let quantity = 0
  let foundQty = false
  let hasEMarker = false
  let proceeds = 0, costBasis = 0, washSale = 0, gainLoss = 0, federalTaxWithheld = 0

  for (const item of items) {
    const s = item.str.trim()
    if (!s) continue

    // Track (e) marker for employer stock plan shares
    if (s === '(e)') { hasEMarker = true; continue }

    // "Sale" or "!C Sale" action
    if (/^!?C?\s*Sale$/i.test(s)) { foundSale = true; continue }

    // Quantity (3 decimal places)
    if (!foundQty && /^-?[\d,]+\.\d{3}$/.test(s)) {
      quantity = parseQuantity(s)
      foundQty = true
      continue
    }

    // Date fields
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

    // Dollar values
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

  return { quantity, hasEMarker, dateAcquired, dateSold, proceeds, costBasis, washSale, gainLoss, federalTaxWithheld }
}

// ── Supplemental Stock Plan Lot Detail ──────────────────────

interface SupplementalColPositions {
  proceeds: number
  ordinaryIncome: number
  adjustedBasis: number
  washSale: number
  adjustedGainLoss: number
}

interface SupplementalEntry {
  quantity: number          // shares × 1000
  dateAcquired: string | null
  dateSold: string
  proceeds: number          // cents
  adjustedCostBasis: number // cents
  washSale: number          // cents
  adjustedGainLoss: number  // cents
}

function detectSupplementalColumns(line: Line): SupplementalColPositions | null {
  let proceeds = 0, ordinaryIncome = 0, adjustedBasis = 0, washSale = 0, adjustedGainLoss = 0

  for (const item of line.items) {
    const s = item.str.trim()
    if (s === 'Proceeds') proceeds = item.x
    if (/^Ordinary\s+Income/i.test(s)) ordinaryIncome = item.x
    if (/^Adjusted\s+Cost/i.test(s)) adjustedBasis = item.x
    if (/^Wash\s+Sale/i.test(s)) washSale = item.x
    if (/^Adjusted\s+Gain/i.test(s)) adjustedGainLoss = item.x
  }

  if (proceeds && adjustedBasis && adjustedGainLoss) {
    if (!ordinaryIncome) ordinaryIncome = (proceeds + adjustedBasis) / 2
    if (!washSale) washSale = (adjustedBasis + adjustedGainLoss) / 2
    return { proceeds, ordinaryIncome, adjustedBasis, washSale, adjustedGainLoss }
  }
  return null
}

function assignSupplementalColumn(x: number, cols: SupplementalColPositions):
  'proceeds' | 'ordinaryIncome' | 'adjustedBasis' | 'washSale' | 'adjustedGainLoss' | 'skip' {
  const mid1 = (cols.proceeds + cols.ordinaryIncome) / 2
  const mid2 = (cols.ordinaryIncome + cols.adjustedBasis) / 2
  const mid3 = (cols.adjustedBasis + cols.washSale) / 2
  const mid4 = (cols.washSale + cols.adjustedGainLoss) / 2

  if (x < mid1) return 'proceeds'
  if (x < mid2) return 'ordinaryIncome'
  if (x < mid3) return 'adjustedBasis'
  if (x < mid4) return 'washSale'
  return 'adjustedGainLoss'
}

function parseSupplementalRow(line: Line, cols: SupplementalColPositions): SupplementalEntry | null {
  const items = line.items

  let quantity = 0
  let foundQty = false
  let dateAcquired: string | null = null
  let dateSold: string | null = null
  let proceeds = 0, adjustedCostBasis = 0, washSale = 0, adjustedGainLoss = 0

  for (const item of items) {
    const s = item.str.trim()
    if (!s) continue

    // Skip grant type labels (RSU, QSP, ESPP, etc.) — they're text before the quantity
    if (/^[A-Z]{2,5}$/.test(s) && !foundQty) continue

    // Quantity (3 decimal places)
    if (!foundQty && /^[\d,]+\.\d{3}$/.test(s)) {
      quantity = parseQuantity(s)
      foundQty = true
      continue
    }

    // Dates
    if (DATE_RE.test(s)) {
      if (!dateAcquired && !dateSold) {
        dateAcquired = parseDate(s)
      } else if (!dateSold) {
        dateSold = parseDate(s)
      }
      continue
    }

    // Dollar values
    if (DOLLARS_RE.test(s)) {
      const col = assignSupplementalColumn(item.x, cols)
      const val = parseCents(s)
      if (col === 'proceeds') proceeds = val
      else if (col === 'adjustedBasis') adjustedCostBasis = val
      else if (col === 'washSale') washSale = val
      else if (col === 'adjustedGainLoss') adjustedGainLoss = val
    }
  }

  if (!foundQty || !dateSold) return null

  return { quantity, dateAcquired, dateSold, proceeds, adjustedCostBasis, washSale, adjustedGainLoss }
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
    type Section = 'div' | 'int' | '1099b' | 'supplemental' | 'stockPlanDetail' | null
    let currentSection: Section = null
    const divLines: Line[] = []
    const intLines: Line[] = []

    // 1099-B state
    let currentCategory: Category8949 | null = null
    let awaitingBox = false
    let currentDesc = ''
    let currentSymbol = ''
    let currentCusip = ''
    let colPositions: ColumnPositions | null = null

    // Track (e) markers and quantities for supplemental matching
    const txnMeta = new Map<string, { quantity: number; hasEMarker: boolean }>()

    // Supplemental stock plan lot detail state
    let suppColPositions: SupplementalColPositions | null = null
    const supplementalEntries: SupplementalEntry[] = []

    for (const line of lines) {
      const text = line.text

      // ── Detect section transitions ──

      // Supplemental stock plan lot detail (the section we need)
      if (/Supplemental\s+Stock\s+Plan\s+Lot\s+Detail/i.test(text)) {
        currentSection = 'stockPlanDetail'
        suppColPositions = null  // reset columns for each sub-section
        continue
      }

      // Other supplemental sections — skip but don't stop parsing
      if (/Supplemental\s+Information\s+Not\s+Reported/i.test(text) ||
          (/SUPPLEMENTAL\s+INFORMATION/i.test(text) && !/Stock\s+Plan/i.test(text))) {
        currentSection = 'supplemental'
        continue
      }

      // Details of 1099-DIV/INT Transactions — skip
      if (/Details\s+of\s+1099-(DIV|INT)/i.test(text)) {
        currentSection = 'supplemental'
        continue
      }

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
        currentSection = null
        continue
      }
      if (/Summary\s+of\s+\d{4}\s+Proceeds/i.test(text)) {
        currentSection = null
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

      // ── Supplemental Stock Plan Lot Detail parsing ──
      if (currentSection === 'stockPlanDetail') {
        // Skip non-data lines
        if (/^(Short|Long)-Term\s+Transactions/i.test(text)) continue
        if (/^Description\s+of\s+Property/i.test(text)) continue
        if (/^Based\s+on\s+the\s+disposal/i.test(text)) continue
        if (/^\*?\s*This\s+is\s+important/i.test(text)) continue
        if (/^Subtotals\b/i.test(text) || /^Totals\b/i.test(text)) continue
        if (/^(Short|Long)-Term\s+Adjusted/i.test(text)) continue
        if (/^Wash\s+Sale\s+Loss\s+Disallowed/i.test(text)) continue
        if (/^[\s-]+$/.test(text.replace(/\s/g, ''))) continue
        if (/^\(\w\)\s+/i.test(text)) continue  // footnotes like (w), (x), (y), (z)
        if (/^Grant\s+Type\b/i.test(text)) continue  // grant type legend header
        if (/^(DO|NQSOP|NQSP|NSR|QSOP|QSP|RSA|RSU|SAR)\s+\w/i.test(text) &&
            !/\d{2}\/\d{2}\/\d{2}/.test(text)) continue  // grant type legend rows

        // Security header
        if (parseSecurityHeader(text)) continue

        // Column header detection
        if (/Grant/i.test(text) && /Quantity/i.test(text) && /Adjusted/i.test(text)) {
          const detected = detectSupplementalColumns(line)
          if (detected) suppColPositions = detected
          continue
        }
        // Skip continuation header lines
        if (/^Type\s*\(w\)/i.test(text) || /^Reported\s*\(y\)/i.test(text) ||
            /^Other\s+Basis/i.test(text) || /^Disallowed/i.test(text)) continue

        // Parse data rows — they have quantities with 3 decimal places
        if (suppColPositions && /\d+\.\d{3}/.test(text)) {
          const entry = parseSupplementalRow(line, suppColPositions)
          if (entry) supplementalEntries.push(entry)
        }
        continue
      }

      // Skip other supplemental sections
      if (currentSection === 'supplemental') continue

      // ── 1099-B parsing ──
      if (currentSection !== '1099b') continue

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

      if (awaitingBox) {
        const cat = detectBoxCategory(text)
        if (cat) {
          currentCategory = cat
          awaitingBox = false
        }
        continue
      }

      if (!currentCategory) continue

      if (/^\s*Action\b/i.test(text) && /Quantity/i.test(text)) {
        const detected = detectColumnPositions(line)
        if (detected) colPositions = detected
        continue
      }
      if (/^\s*\(IRS\s+Form/i.test(text)) continue
      if (/^\s*1a\s+Description/i.test(text)) continue
      if (/^\s*Proceeds\s+are\s+reported/i.test(text)) continue

      if (/^Subtotals\b/i.test(text) || /^TOTALS\b/i.test(text)) {
        skipped++
        continue
      }
      if (/^Box\s+[ABDE]\s+(Short|Long)/i.test(text)) continue
      if (/^[\s-]+$/.test(text.replace(/\s/g, ''))) continue
      if (/^\*?\s*This\s+is\s+important/i.test(text)) continue
      if (/^Acquired\b/i.test(text)) continue
      if (/^Discount\b/i.test(text)) continue

      const sec = parseSecurityHeader(text)
      if (sec) {
        currentDesc = sec.description
        currentSymbol = sec.symbol
        currentCusip = sec.cusip
        continue
      }

      if (/^!?C?\s*Sale\b/i.test(text) && colPositions) {
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

        if (fields.costBasis === 0 && fields.proceeds > 0) {
          warnings.push(
            `"${currentDesc}" may be an RSU sale (cost basis is $0). ` +
              `Verify basis matches FMV at vest date to avoid double taxation.`,
          )
        }

        const txnId = crypto.randomUUID()
        transactions.push({
          id: txnId,
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
        txnMeta.set(txnId, { quantity: fields.quantity, hasEMarker: fields.hasEMarker })
        parsed++
      }
    }

    // ── Parse DIV and INT sections ──
    const div = parseDivSection(divLines)
    if (div) form1099DIVs.push(div)

    const int = parseIntSection(intLines)
    if (int) form1099INTs.push(int)

    // ── Phase 2: Apply supplemental stock plan lot detail adjustments ──
    if (supplementalEntries.length > 0) {
      const matchKey = (qty: number, dateAcq: string | null, dateSold: string, proceeds: number) =>
        `${qty}|${dateAcq ?? 'null'}|${dateSold}|${proceeds}`

      // Build lookup from supplemental entries
      const suppMap = new Map<string, SupplementalEntry[]>()
      for (const entry of supplementalEntries) {
        const key = matchKey(entry.quantity, entry.dateAcquired, entry.dateSold, entry.proceeds)
        const existing = suppMap.get(key) ?? []
        existing.push(entry)
        suppMap.set(key, existing)
      }

      // Match against parsed transactions
      for (const txn of transactions) {
        const meta = txnMeta.get(txn.id)
        if (!meta) continue

        const key = matchKey(meta.quantity, txn.dateAcquired, txn.dateSold, txn.proceeds)
        const matches = suppMap.get(key)
        if (!matches || matches.length === 0) continue

        // Consume the first match (FIFO — Fidelity lists in same order)
        const suppEntry = matches.shift()!
        if (matches.length === 0) suppMap.delete(key)

        // Apply adjusted basis and gain/loss
        txn.costBasis = suppEntry.adjustedCostBasis
        txn.gainLoss = suppEntry.adjustedGainLoss
        txn.washSaleLossDisallowed = suppEntry.washSale
        txn.basisAdjustedFromSupplemental = true
      }

      // Warn about (e) transactions that were NOT matched
      for (const txn of transactions) {
        const meta = txnMeta.get(txn.id)
        if (meta?.hasEMarker && !txn.basisAdjustedFromSupplemental) {
          warnings.push(
            `"${txn.description}" has (e) marker (unadjusted basis for employer stock plan) ` +
            `but no matching supplemental stock plan lot detail was found. Cost basis may need manual adjustment.`,
          )
        }
      }
    }

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
