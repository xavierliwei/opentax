/**
 * Form 1098 (Mortgage Interest Statement) PDF parser.
 *
 * Extracts key fields from a standard IRS Form 1098:
 *   - Box 1: Mortgage interest received
 *   - Box 2: Outstanding mortgage principal
 *   - Box 3: Mortgage origination date
 *   - Box 11: Mortgage acquisition date (fallback for origination)
 *   - Lender name from the recipient block
 *
 * Strategy: Use raw text items with x/y positions to locate box labels,
 * then find dollar/date values nearby (same x-region, slightly below).
 * Form 1098 has a grid layout where labels and values are in different
 * rows but the same column — so x-position proximity is key.
 */

import { ensureWorker, extractItems, groupLines } from './pdfUtils'
import type { RawItem } from './pdfUtils'

export interface Form1098ParseResult {
  lenderName: string
  mortgageInterest: number   // cents
  mortgagePrincipal: number  // cents
  mortgagePreTCJA: boolean   // derived from origination date
  originationDate?: string   // ISO date if found
  warnings: string[]
  errors: string[]
}

// ── Helpers ──────────────────────────────────────────────────

const DOLLARS_RE = /^\$?([\d,]+\.\d{2})$/

function parseCents(s: string): number {
  return Math.round(parseFloat(s.replace(/[,$\s]/g, '')) * 100)
}

/** Parse a date in MM/DD/YYYY or MM/DD/YY format to ISO string */
function parseDate(s: string): string | null {
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    const [, mm, dd, yyyy] = m
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/)
  if (m) {
    const [, mm, dd, yy] = m
    const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return null
}

const TCJA_CUTOFF = '2017-12-15'

// ── Main parser ──────────────────────────────────────────────

export async function parseForm1098Pdf(data: ArrayBuffer): Promise<Form1098ParseResult> {
  await ensureWorker()

  const items = await extractItems(data)
  const lines = groupLines(items)
  // Only look at page 1 items for box values
  const page1Items = items.filter((it) => it.page === 1)

  const result: Form1098ParseResult = {
    lenderName: '',
    mortgageInterest: 0,
    mortgagePrincipal: 0,
    mortgagePreTCJA: false,
    warnings: [],
    errors: [],
  }

  // Verify this looks like a Form 1098
  const allText = page1Items.map((it) => it.str).join(' ').toUpperCase()
  if (!allText.includes('1098') && !allText.includes('MORTGAGE INTEREST STATEMENT')) {
    result.errors.push('This does not appear to be a Form 1098 (Mortgage Interest Statement).')
    return result
  }

  // ── Extract lender name ──
  // Look for "RECIPIENT'S/LENDER'S" label, then find the first name-like
  // text item below it in the same x-region
  const recipientLabel = page1Items.find((it) =>
    /recipient.s?\/lender/i.test(it.str) && /name/i.test(it.str),
  )
  if (recipientLabel) {
    // Find items below this label, in a similar x range, that look like names
    const candidates = page1Items.filter((it) =>
      it.y > recipientLabel.y + 5 &&
      it.y < recipientLabel.y + 30 &&
      it.x < recipientLabel.x + 60 &&
      it.str.trim().length > 3 &&
      /^[A-Z]/.test(it.str.trim()) &&
      !/^\d/.test(it.str.trim()) &&
      !/province|country|postal|telephone/i.test(it.str),
    )
    if (candidates.length > 0) {
      result.lenderName = candidates[0].str.trim()
    }
  }

  // ── Find box labels by scanning raw items ──
  // Form 1098 box labels are individual text items like "1", "2", "3", "11"
  // followed by descriptive text. We look for the number item then match
  // nearby dollar/date values by x-position (same column, lower y).

  // First, find items that look like box number labels
  const boxLabels = findBoxLabels(page1Items)

  // For each box, find the value below it (within ~30pt y, similar x)
  if (boxLabels.box1) {
    const val = findDollarBelow(page1Items, boxLabels.box1)
    if (val !== null) {
      result.mortgageInterest = val
    }
  }

  if (boxLabels.box2) {
    const val = findDollarBelow(page1Items, boxLabels.box2)
    if (val !== null) {
      result.mortgagePrincipal = val
    }
  }

  // Box 3 = origination date, Box 11 = acquisition date (use either)
  const dateBox = boxLabels.box3 ?? boxLabels.box11
  if (dateBox) {
    const dateVal = findDateBelow(page1Items, dateBox)
    if (dateVal) {
      result.originationDate = dateVal
      result.mortgagePreTCJA = dateVal <= TCJA_CUTOFF
    }
  }

  // ── Fallback: scan grouped lines for labeled values ──
  if (!result.mortgageInterest) {
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].text
      if (/mortgage\s+interest\s+received/i.test(t) || /mortgage\s+interest/i.test(t)) {
        const m = t.match(/\$([\d,]+\.\d{2})/)
        if (m) {
          result.mortgageInterest = parseCents(m[1])
          break
        }
        // Check next lines
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const m2 = lines[j].text.match(/\$([\d,]+\.\d{2})/)
          if (m2) {
            result.mortgageInterest = parseCents(m2[1])
            break
          }
        }
        if (result.mortgageInterest) break
      }
    }
  }

  if (!result.mortgagePrincipal) {
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].text
      if (/outstanding\s+mortgage\s+principal/i.test(t)) {
        const m = t.match(/\$([\d,]+\.\d{2})/)
        if (m) {
          result.mortgagePrincipal = parseCents(m[1])
          break
        }
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const m2 = lines[j].text.match(/\$([\d,]+\.\d{2})/)
          if (m2) {
            result.mortgagePrincipal = parseCents(m2[1])
            break
          }
        }
        if (result.mortgagePrincipal) break
      }
    }
  }

  if (!result.originationDate) {
    for (const line of lines) {
      if (/mortgage\s+origination\s+date|mortgage\s+acquisition\s+date/i.test(line.text)) {
        const d = parseDate(line.text)
        if (d) {
          result.originationDate = d
          result.mortgagePreTCJA = d <= TCJA_CUTOFF
          break
        }
      }
    }
  }

  // Validation
  if (!result.mortgageInterest && !result.mortgagePrincipal) {
    result.errors.push('Could not extract mortgage interest or principal from this Form 1098. The PDF layout may not be supported.')
  } else {
    if (!result.mortgageInterest) {
      result.warnings.push('Could not find Box 1 (mortgage interest) — you may need to enter it manually.')
    }
    if (!result.mortgagePrincipal) {
      result.warnings.push('Could not find Box 2 (outstanding principal) — you may need to enter it manually.')
    }
  }

  return result
}

// ── Positional helpers ───────────────────────────────────────

interface BoxLabels {
  box1?: RawItem  // Mortgage interest received
  box2?: RawItem  // Outstanding mortgage principal
  box3?: RawItem  // Mortgage origination date
  box11?: RawItem // Mortgage acquisition date
}

/**
 * Find box label items on page 1. Box labels in Form 1098 are small text
 * items containing just the box number (e.g., "1", "2", "3", "11") or
 * concatenated like "1Mortgage interest..." when PDF.js merges them.
 */
function findBoxLabels(items: RawItem[]): BoxLabels {
  const result: BoxLabels = {}

  for (const item of items) {
    const s = item.str.trim()

    // Match "1Mortgage interest" or standalone "1" near "Mortgage interest"
    if (!result.box1 && /^1\s*Mortgage\s+interest\s+received/i.test(s)) {
      result.box1 = item
    }
    if (!result.box2 && /^2\s*Outstanding\s+mortgage\s+principal/i.test(s)) {
      result.box2 = item
    }
    if (!result.box3 && /^3\s*Mortgage\s+origination\s+date/i.test(s)) {
      result.box3 = item
    }
    if (!result.box11 && /^11\s*Mortgage\s+acquisition\s+date/i.test(s)) {
      result.box11 = item
    }
  }

  // If concatenated labels weren't found, look for standalone number items
  // near descriptive text items
  if (!result.box1 || !result.box2) {
    for (const item of items) {
      const s = item.str.trim()
      if (s === '1' && !result.box1) {
        // Check if there's "Mortgage interest" text nearby (within ~100px x, ~5px y)
        const nearby = items.find((it) =>
          /mortgage\s+interest\s+received/i.test(it.str) &&
          Math.abs(it.y - item.y) < 6 &&
          it.x > item.x && it.x - item.x < 100,
        )
        if (nearby) result.box1 = item
      }
      if (s === '2' && !result.box2) {
        const nearby = items.find((it) =>
          /outstanding\s+mortgage/i.test(it.str) &&
          Math.abs(it.y - item.y) < 6 &&
          it.x > item.x && it.x - item.x < 100,
        )
        if (nearby) result.box2 = item
      }
      if (s === '3' && !result.box3) {
        const nearby = items.find((it) =>
          /mortgage\s+origination/i.test(it.str) &&
          Math.abs(it.y - item.y) < 6 &&
          it.x > item.x && it.x - item.x < 100,
        )
        if (nearby) result.box3 = item
      }
      if (s === '11' && !result.box11) {
        const nearby = items.find((it) =>
          /mortgage\s+acquisition/i.test(it.str) &&
          Math.abs(it.y - item.y) < 6 &&
          it.x > item.x && it.x - item.x < 100,
        )
        if (nearby) result.box11 = item
      }
    }
  }

  return result
}

/**
 * Find a dollar value below a box label item.
 * Searches for $X,XXX.XX items within ~25pt below the label's y,
 * and within ~60pt of the label's x position.
 */
function findDollarBelow(items: RawItem[], label: RawItem): number | null {
  const candidates = items
    .filter((it) => {
      if (it.y <= label.y) return false
      if (it.y > label.y + 30) return false
      // Allow items in same column region (x within reasonable range)
      // Value can be offset right from label (grid layout)
      if (it.x < label.x - 20) return false
      if (it.x > label.x + 120) return false
      return DOLLARS_RE.test(it.str.trim())
    })
    .sort((a, b) => a.y - b.y) // closest first

  if (candidates.length > 0) {
    const m = candidates[0].str.trim().match(DOLLARS_RE)
    if (m) return parseCents(m[1])
  }
  return null
}

/**
 * Find a date value below a box label item.
 */
function findDateBelow(items: RawItem[], label: RawItem): string | null {
  const candidates = items
    .filter((it) => {
      if (it.y <= label.y) return false
      if (it.y > label.y + 30) return false
      if (it.x < label.x - 20) return false
      if (it.x > label.x + 120) return false
      return parseDate(it.str.trim()) !== null
    })
    .sort((a, b) => a.y - b.y)

  if (candidates.length > 0) {
    return parseDate(candidates[0].str.trim())
  }
  return null
}
