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

// ── 1099-B transaction row parsing ───────────────────────────

interface TxnFields {
  dateAcquired: string | null
  dateSold: string
  proceeds: number
  costBasis: number
  accruedMarketDiscount: number
  washSale: number
  gainLoss: number
  federalTaxWithheld: number
}

function parseTxnRow(line: Line): TxnFields | null {
  // Collect raw tokens
  const raw = line.items.map((it) => it.str.trim()).filter(Boolean)

  // Merge numeric fragments split at the decimal point (e.g., "28,287" + ".87")
  const merged: string[] = []
  for (let i = 0; i < raw.length; ) {
    const cur = raw[i]
    const next = raw[i + 1] ?? ''
    if (/^-?[\d,]+$/.test(cur) && /^\.\d+/.test(next)) {
      // Also handle "(e)" suffix on cost basis: ".65(e)"
      merged.push(cur + next)
      i += 2
    } else {
      merged.push(cur)
      i++
    }
  }

  // Now split tokens that have "(e)" fused — keep the number, drop the flag
  const tokens: string[] = []
  for (const tok of merged) {
    // "1,882.65(e)" → "1,882.65"
    const eMatch = tok.match(/^(-?[\d,]+\.\d{2})\(e\)$/)
    if (eMatch) {
      tokens.push(eMatch[1])
    } else {
      tokens.push(tok)
    }
  }

  let i = 0

  // ── 1. "Sale" action ──
  if (!/^sale$/i.test(tokens[i] ?? '')) return null
  i++

  // ── 2. Quantity (skip) ──
  if (i >= tokens.length) return null
  // Quantity has 3 decimal places or is an integer
  if (/^-?[\d,]+\.\d{3}$/.test(tokens[i]) || /^[\d,]+$/.test(tokens[i])) {
    i++
  }

  // ── 3. Date acquired ──
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

  // ── 4. Date sold ──
  if (i >= tokens.length || !DATE_RE.test(tokens[i])) return null
  const dateSold = parseDate(tokens[i++])
  if (!dateSold) return null

  // ── 5. Proceeds ──
  if (i >= tokens.length || !DOLLARS_RE.test(tokens[i])) return null
  const proceeds = parseCents(tokens[i++])

  // ── 6. Cost basis ──
  if (i >= tokens.length || !DOLLARS_RE.test(tokens[i])) return null
  const costBasis = parseCents(tokens[i++])

  // ── 7. Accrued market discount (optional — may be empty/missing) ──
  let accruedMarketDiscount = 0
  if (i < tokens.length && DOLLARS_RE.test(tokens[i])) {
    // Could be accrued market discount OR wash sale OR gain/loss
    // We need to look ahead: if there are enough dollar tokens remaining,
    // this one is accrued market discount
    const remainingDollars = tokens.slice(i).filter(t => DOLLARS_RE.test(t)).length
    if (remainingDollars >= 3) {
      // At least: accrued_market_discount, wash_sale_or_gain, gain_loss
      // Actually let's be more careful. The minimum remaining pattern is:
      // gain/loss (1 dollar). Wash sale and accrued are optional.
      // With 3+ remaining dollars, first is accrued market discount
      accruedMarketDiscount = parseCents(tokens[i++])
    }
  }

  // ── 8. Wash sale loss disallowed (optional) ──
  let washSale = 0
  if (i < tokens.length && DOLLARS_RE.test(tokens[i])) {
    const remainingDollars = tokens.slice(i).filter(t => DOLLARS_RE.test(t)).length
    if (remainingDollars >= 2) {
      // wash_sale + gain_loss
      washSale = parseCents(tokens[i++])
    }
  }

  // ── 9. Gain/loss ──
  if (i >= tokens.length || !DOLLARS_RE.test(tokens[i])) return null
  const gainLoss = parseCents(tokens[i++])

  // ── 10. Federal tax withheld (optional) ──
  let federalTaxWithheld = 0
  if (i < tokens.length && DOLLARS_RE.test(tokens[i])) {
    federalTaxWithheld = parseCents(tokens[i++])
  }

  return { dateAcquired, dateSold, proceeds, costBasis, accruedMarketDiscount, washSale, gainLoss, federalTaxWithheld }
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
      if (/\b(Short|Long).term\s+transactions\s+for\s+which\s+basis\b/i.test(text)) {
        awaitingBox = true
        continue
      }

      // Box category: "Box A checked"
      if (awaitingBox) {
        const cat = detectBoxCategory(text)
        if (cat) {
          currentCategory = cat
          awaitingBox = false
        }
        continue
      }

      if (!currentCategory) continue

      // Skip column header lines and boilerplate
      if (/^\s*Action\b/i.test(text) && /Quantity/i.test(text)) continue
      if (/^\s*\(IRS\s+Form/i.test(text)) continue
      if (/^\s*1a\s+Description/i.test(text)) continue
      if (/^\s*Proceeds\s+are\s+reported/i.test(text)) continue

      // Skip Subtotals / TOTALS / Box summary lines
      if (/^Subtotals\b/i.test(text) || /^TOTALS\b/i.test(text)) {
        skipped++
        continue
      }
      if (/^Box\s+[ABDE]\s+(Short|Long)/i.test(text)) continue

      // Security header: "DESCRIPTION, SYMBOL, CUSIP"
      const sec = parseSecurityHeader(text)
      if (sec) {
        currentDesc = sec.description
        currentSymbol = sec.symbol
        currentCusip = sec.cusip
        continue
      }

      // Transaction row: starts with "Sale"
      if (/^Sale\b/i.test(text)) {
        total++

        const fields = parseTxnRow(line)
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
