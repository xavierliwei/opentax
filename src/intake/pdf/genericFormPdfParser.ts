/**
 * Generic standalone form PDF parser for W-2, 1099-INT, and 1099-DIV.
 *
 * Uses pdfjs-dist text extraction (same as fidelityPdfParser / robinhoodPdfParser)
 * to read embedded PDF text layers. Replaces the Tesseract OCR pipeline for
 * digitally-generated PDFs, which is the vast majority of tax forms.
 *
 * Two extraction strategies, tried in order:
 *
 * 1. **Positional** — for standard IRS form grid layouts where box labels
 *    (e.g. "1 Interest income") and their values ("$ 946.72") are in
 *    adjacent rows at similar x-coordinates. Works with Discover, bank
 *    1099-INT/DIV PDFs, and official IRS form fillable PDFs.
 *
 * 2. **Line-scan** — for broker summaries (like Fidelity consolidated)
 *    where labels and values appear on the same text line
 *    (e.g. "1 Interest Income 1,250.00").
 */

import { ensureWorker, extractItems, groupLines } from './pdfUtils'
import type { RawItem } from './pdfUtils'

// ── Shared types (previously in OCR modules) ─────────────────

export type DetectedFormType = 'W-2' | '1099-INT' | '1099-DIV' | '1099-R' | 'unknown'

export interface ExtractedField {
  value: string
  confidence: number // 0–1
}

export interface GenericPdfResult {
  formType: DetectedFormType
  fields: Map<string, ExtractedField>
  warnings: string[]
}

// ── Form type detection ─────────────────────────────────────

function detectFormTypeFromText(text: string): DetectedFormType {
  const upper = text.toUpperCase()

  if (/WAGE\s+AND\s+TAX\s+STATEMENT/.test(upper) || /\bFORM\s+W[\s-]*2\b/.test(upper)) {
    return 'W-2'
  }

  if (/INTEREST\s+INCOME/.test(upper) || /1099[\s-]*INT\b/.test(upper)) {
    return '1099-INT'
  }

  if (/DIVIDENDS\s+AND\s+DISTRIBUTIONS/.test(upper) || /1099[\s-]*DIV\b/.test(upper)) {
    return '1099-DIV'
  }

  if (/DISTRIBUTIONS?\s+FROM\s+PENSIONS/i.test(upper) || /1099[\s-]*R\b/.test(upper) || /DISTRIBUTION\s+CODE/.test(upper)) {
    return '1099-R'
  }

  return 'unknown'
}

// ── Value extraction helpers ────────────────────────────────

const TRAILING_DOLLARS_RE = /\$?([\d,]+\.\d{2})\s*$/
const DOLLARS_RE = /^-?\$?[\d,]+\.\d{2}$/

function parseCents(s: string): number {
  return Math.round(parseFloat(s.replace(/[,$\s]/g, '')) * 100)
}

function field(cents: number): ExtractedField {
  return { value: String(cents), confidence: 1.0 }
}

function textField(text: string): ExtractedField {
  return { value: text, confidence: 1.0 }
}

function extractTrailingDollars(line: string): number | null {
  const m = line.match(TRAILING_DOLLARS_RE)
  return m ? parseCents(m[1]) : null
}

// ── Positional extraction (IRS grid layout) ─────────────────
//
// Standard IRS forms (1099-INT, 1099-DIV, W-2) use a grid layout:
//   Row 1:  "1  Interest income"          (box label)
//   Row 2:  "$  946.72"                   (value below, similar x)
//
// We find box number items by their text content and x-position,
// then look for dollar values directly below them.

interface BoxLabelMatch {
  boxKey: string       // e.g. "box1", "box2a"
  item: RawItem        // the raw PDF text item for the box number
}

/**
 * Find dollar-value items below a box label within the form grid.
 * Looks for "$" items in the same x-column, within ~30pt below the label,
 * and extracts the adjacent dollar amount.
 */
function findDollarBelow(items: RawItem[], label: RawItem, xTolerance = 25, yRange = 40): number | null {
  // Find a dollar-amount item below the label in a similar x-region
  const candidates = items
    .filter((it) => {
      if (it.page !== label.page) return false
      if (it.y <= label.y) return false
      if (it.y > label.y + yRange) return false
      // Must be in the same x-column region
      if (Math.abs(it.x - label.x) > xTolerance) return false
      return DOLLARS_RE.test(it.str.trim())
    })
    .sort((a, b) => a.y - b.y) // closest first

  if (candidates.length > 0) {
    return parseCents(candidates[0].str.trim())
  }
  return null
}

/**
 * Find a text-value item below a label. Used for non-monetary fields
 * like payer name or state abbreviation.
 */
function findTextBelow(items: RawItem[], label: RawItem, xTolerance = 60, yRange = 30): string | null {
  const candidates = items
    .filter((it) => {
      if (it.page !== label.page) return false
      if (it.y <= label.y) return false
      if (it.y > label.y + yRange) return false
      if (it.x < label.x - 10) return false
      if (it.x > label.x + xTolerance) return false
      const s = it.str.trim()
      return s.length > 1 && !/^\$/.test(s) && !/^[\d,]+\.\d{2}$/.test(s)
    })
    .sort((a, b) => a.y - b.y)

  if (candidates.length > 0) {
    return candidates[0].str.trim()
  }
  return null
}

// ── 1099-INT positional parsing ─────────────────────────────

function parse1099IntPositional(items: RawItem[]): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()
  const page1 = items.filter((it) => it.page === 1)

  // Find box label items — look for items whose text is a box number
  // followed by a description, positioned in the right-side form grid (x > 250)
  const boxLabels: BoxLabelMatch[] = []

  for (const item of page1) {
    const s = item.str.trim()
    // Box numbers in IRS 1099-INT are standalone items like "1", "2", "3", "4", "8"
    // positioned at x > ~300 (right side of the form grid)
    if (item.x < 250) continue

    if (s === '1') {
      // Verify it's near "Interest income" text
      const nearby = page1.find((it) =>
        /interest\s+income/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box1', item })
    } else if (s === '2') {
      const nearby = page1.find((it) =>
        /early\s+withdrawal/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box2', item })
    } else if (s === '3') {
      const nearby = page1.find((it) =>
        /interest\s+on\s+u\.?s/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box3', item })
    } else if (s === '4' || /^4\s+Federal/i.test(s)) {
      const isCombined = /federal/i.test(s)
      const nearby = isCombined || page1.some((it) =>
        /federal\s+(?:income\s+)?tax\s+withheld/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5,
      )
      if (nearby) boxLabels.push({ boxKey: 'box4', item })
    } else if (s === '8') {
      const nearby = page1.find((it) =>
        /tax.exempt\s+interest/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box8', item })
    }
  }

  // For each found box label, look for the dollar value below it
  for (const { boxKey, item } of boxLabels) {
    // Look for "$" sign first — the value is typically next to it
    const dollarSign = page1.find((it) =>
      it.str.trim() === '$' &&
      it.page === item.page &&
      it.y > item.y && it.y <= item.y + 30 &&
      Math.abs(it.x - item.x) < 25,
    )

    if (dollarSign) {
      // Find the actual number near the $ sign
      const val = page1.find((it) =>
        DOLLARS_RE.test(it.str.trim()) &&
        it.page === dollarSign.page &&
        Math.abs(it.y - dollarSign.y) < 5 &&
        it.x > dollarSign.x && it.x < dollarSign.x + 120,
      )
      if (val) {
        fields.set(boxKey, field(parseCents(val.str.trim())))
        continue
      }
    }

    // Fallback: look for dollar value directly below the box label
    const val = findDollarBelow(page1, item)
    if (val !== null) {
      fields.set(boxKey, field(val))
    }
  }

  // Payer name: find text below "PAYER'S name" label area
  const payerLabel = page1.find((it) => /^PAYER.S$/i.test(it.str.trim()))
  if (payerLabel) {
    // Payer name lines are below the "PAYER'S name, street address..." label
    // Typically the first non-label text in the same x-column, below the label block
    const payerLines = page1
      .filter((it) =>
        it.y > payerLabel.y + 10 &&
        it.y < payerLabel.y + 60 &&
        it.x < 250 && // left side of form
        it.str.trim().length > 2 &&
        !/^payer|^postal|^telephone|^name|^street|^city|^state|^province|^country|^zip|^foreign|^or$/i.test(it.str.trim()),
      )
      .sort((a, b) => a.y - b.y)

    if (payerLines.length > 0) {
      fields.set('payerName', textField(payerLines[0].str.trim()))
    }
  }

  // State: look for state abbreviation near box 15
  const box15 = page1.find((it) => it.str.trim() === '15' && it.x > 300)
  if (box15) {
    const stateItem = page1.find((it) =>
      /^[A-Z]{2}$/.test(it.str.trim()) &&
      it.y > box15.y && it.y <= box15.y + 40 &&
      Math.abs(it.x - box15.x) < 40,
    )
    if (stateItem) {
      fields.set('state', textField(stateItem.str.trim()))
    }
  }

  return fields
}

// ── 1099-DIV positional parsing ─────────────────────────────

function parse1099DivPositional(items: RawItem[]): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()
  const page1 = items.filter((it) => it.page === 1)

  const boxLabels: BoxLabelMatch[] = []

  for (const item of page1) {
    const s = item.str.trim()
    if (item.x < 250) continue

    if (s === '1a') {
      const nearby = page1.find((it) =>
        /ordinary\s+dividends|total\s+ordinary/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box1a', item })
    } else if (s === '1b') {
      const nearby = page1.find((it) =>
        /qualified\s+dividends/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box1b', item })
    } else if (s === '2a') {
      const nearby = page1.find((it) =>
        /capital\s+gain/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box2a', item })
    } else if (s === '4' || /^4\s+Federal/i.test(s)) {
      const isCombined = /federal/i.test(s)
      const nearby = isCombined || page1.some((it) =>
        /federal\s+(?:income\s+)?tax\s+withheld/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5,
      )
      if (nearby) boxLabels.push({ boxKey: 'box4', item })
    } else if (s === '5') {
      const nearby = page1.find((it) =>
        /section\s*199a/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box5', item })
    } else if (s === '11' || s === '12') {
      const nearby = page1.find((it) =>
        /exempt.interest\s+dividends/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box11', item })
    }
  }

  for (const { boxKey, item } of boxLabels) {
    const dollarSign = page1.find((it) =>
      it.str.trim() === '$' &&
      it.page === item.page &&
      it.y > item.y && it.y <= item.y + 30 &&
      Math.abs(it.x - item.x) < 25,
    )

    if (dollarSign) {
      const val = page1.find((it) =>
        DOLLARS_RE.test(it.str.trim()) &&
        it.page === dollarSign.page &&
        Math.abs(it.y - dollarSign.y) < 5 &&
        it.x > dollarSign.x && it.x < dollarSign.x + 120,
      )
      if (val) {
        fields.set(boxKey, field(parseCents(val.str.trim())))
        continue
      }
    }

    const val = findDollarBelow(page1, item)
    if (val !== null) {
      fields.set(boxKey, field(val))
    }
  }

  // Payer name
  const payerLabel = page1.find((it) => /^PAYER.S$/i.test(it.str.trim()))
  if (payerLabel) {
    const payerLines = page1
      .filter((it) =>
        it.y > payerLabel.y + 10 &&
        it.y < payerLabel.y + 60 &&
        it.x < 250 &&
        it.str.trim().length > 2 &&
        !/^payer|^postal|^telephone|^name|^street|^city|^state|^province|^country|^zip|^foreign|^or$/i.test(it.str.trim()),
      )
      .sort((a, b) => a.y - b.y)

    if (payerLines.length > 0) {
      fields.set('payerName', textField(payerLines[0].str.trim()))
    }
  }

  return fields
}

// ── W-2 positional parsing ──────────────────────────────────

function parseW2Positional(items: RawItem[]): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()
  const page1 = items.filter((it) => it.page === 1)

  // W-2 box layout — the box labels are numbers like "1", "2" etc.
  // with descriptive text nearby
  const boxDefs: { num: string; key: string; descPattern: RegExp }[] = [
    { num: '1', key: 'box1', descPattern: /wages/i },
    { num: '2', key: 'box2', descPattern: /federal.*tax.*withheld/i },
    { num: '3', key: 'box3', descPattern: /social\s+security\s+wages/i },
    { num: '4', key: 'box4', descPattern: /social\s+security\s+tax/i },
    { num: '5', key: 'box5', descPattern: /medicare\s+wages/i },
    { num: '6', key: 'box6', descPattern: /medicare\s+tax/i },
    { num: '16', key: 'box16StateWages', descPattern: /state\s+wages/i },
    { num: '17', key: 'box17StateIncomeTax', descPattern: /state\s+income\s+tax/i },
  ]

  for (const def of boxDefs) {
    const label = page1.find((it) => {
      if (it.str.trim() !== def.num) return false
      // Verify nearby description text
      return page1.some((d) =>
        def.descPattern.test(d.str) &&
        Math.abs(d.y - it.y) < 5 &&
        d.x > it.x,
      )
    })

    if (label) {
      const dollarSign = page1.find((it) =>
        it.str.trim() === '$' &&
        it.y > label.y && it.y <= label.y + 30 &&
        Math.abs(it.x - label.x) < 25,
      )

      if (dollarSign) {
        const val = page1.find((it) =>
          DOLLARS_RE.test(it.str.trim()) &&
          Math.abs(it.y - dollarSign.y) < 5 &&
          it.x > dollarSign.x && it.x < dollarSign.x + 120,
        )
        if (val) {
          fields.set(def.key, field(parseCents(val.str.trim())))
          continue
        }
      }

      const val = findDollarBelow(page1, label)
      if (val !== null) {
        fields.set(def.key, field(val))
      }
    }
  }

  // Employer name — find "Employer's name" label area
  const empLabel = page1.find((it) => /employer.s?\s+name/i.test(it.str))
  if (empLabel) {
    const name = findTextBelow(page1, empLabel)
    if (name) {
      fields.set('employerName', textField(name))
    }
  }

  // EIN
  for (const item of page1) {
    const m = item.str.match(/(\d{2}-\d{7})/)
    if (m) {
      fields.set('employerEin', textField(m[1]))
      break
    }
  }

  // State abbreviation near box 15
  const box15 = page1.find((it) =>
    it.str.trim() === '15' &&
    page1.some((d) => /state/i.test(d.str) && Math.abs(d.y - it.y) < 5),
  )
  if (box15) {
    const stateItem = page1.find((it) =>
      /^[A-Z]{2}$/.test(it.str.trim()) &&
      it.y > box15.y && it.y <= box15.y + 40 &&
      Math.abs(it.x - box15.x) < 40,
    )
    if (stateItem) {
      fields.set('box15State', textField(stateItem.str.trim()))
    }
  }

  return fields
}

// ── Line-scan extraction (broker summary layout) ─────────────
//
// For PDFs where labels and values appear on the same text line:
//   "1 Interest Income 1,250.00"
// This works with Fidelity consolidated summaries and similar formats.

function parse1099IntLineScan(lineTexts: string[]): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()

  for (const t of lineTexts) {
    if (/payer/i.test(t) && !/box|form|copy|1099/i.test(t)) {
      const nameMatch = t.match(/(?:payer.s?\s+name\s*[:\-]?\s*)(.+)/i)
      if (nameMatch) {
        fields.set('payerName', textField(nameMatch[1].trim()))
        break
      }
    }
  }

  for (const t of lineTexts) {
    const val = extractTrailingDollars(t)
    if (val === null) continue

    if (/\b(?:box\s*)?1\b.*interest\s+income/i.test(t) || /^1\s+Interest/i.test(t)) {
      fields.set('box1', field(val))
    } else if (/\b(?:box\s*)?2\b.*early\s+withdrawal/i.test(t) || /^2\s+Early/i.test(t)) {
      fields.set('box2', field(val))
    } else if (/\b(?:box\s*)?3\b.*(?:interest\s+on\s+u\.?s|savings\s+bonds)/i.test(t) || /^3\s+Interest\s+on\s+U/i.test(t)) {
      fields.set('box3', field(val))
    } else if (/\b(?:box\s*)?4\b.*federal\s+(?:income\s+)?tax\s+withheld/i.test(t) || /^4\s+Federal/i.test(t)) {
      fields.set('box4', field(val))
    } else if (/\b(?:box\s*)?8\b.*tax.exempt\s+interest/i.test(t) || /^8\s+Tax.exempt/i.test(t)) {
      fields.set('box8', field(val))
    }
  }

  return fields
}

function parse1099DivLineScan(lineTexts: string[]): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()

  for (const t of lineTexts) {
    if (/payer/i.test(t) && !/box|form|copy|1099/i.test(t)) {
      const nameMatch = t.match(/(?:payer.s?\s+name\s*[:\-]?\s*)(.+)/i)
      if (nameMatch) {
        fields.set('payerName', textField(nameMatch[1].trim()))
        break
      }
    }
  }

  for (const t of lineTexts) {
    const val = extractTrailingDollars(t)
    if (val === null) continue

    if (/\b(?:box\s*)?1a\b.*(?:ordinary\s+dividends|total\s+ordinary)/i.test(t) || /^1a\s/i.test(t)) {
      fields.set('box1a', field(val))
    } else if (/\b(?:box\s*)?1b\b.*qualified\s+dividends/i.test(t) || /^1b\s/i.test(t)) {
      fields.set('box1b', field(val))
    } else if (/\b(?:box\s*)?2a\b.*(?:capital\s+gain|total\s+capital)/i.test(t) || /^2a\s/i.test(t)) {
      fields.set('box2a', field(val))
    } else if (/\b(?:box\s*)?4\b.*federal\s+(?:income\s+)?tax\s+withheld/i.test(t) || /^4\s+Federal/i.test(t)) {
      fields.set('box4', field(val))
    } else if (/\b(?:box\s*)?5\b.*section\s*199a/i.test(t) || /^5\s+Section/i.test(t)) {
      fields.set('box5', field(val))
    } else if (/\b(?:box\s*)?(?:11|12)\b.*exempt.interest\s+dividends/i.test(t) || /^(?:11|12)\s+Exempt/i.test(t)) {
      fields.set('box11', field(val))
    }
  }

  return fields
}

// ── 1099-R positional parsing ──────────────────────────────

function parse1099RPositional(items: RawItem[]): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()
  const page1 = items.filter((it) => it.page === 1)

  const boxLabels: BoxLabelMatch[] = []

  for (const item of page1) {
    const s = item.str.trim()
    if (item.x < 250) continue

    if (s === '1') {
      const nearby = page1.find((it) =>
        /gross\s+distribution/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box1', item })
    } else if (s === '2a') {
      const nearby = page1.find((it) =>
        /taxable\s+amount/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box2a', item })
    } else if (s === '3') {
      const nearby = page1.find((it) =>
        /capital\s+gain/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box3', item })
    } else if (s === '4' || /^4\s+Federal/i.test(s)) {
      const isCombined = /federal/i.test(s)
      const nearby = isCombined || page1.some((it) =>
        /federal\s+(?:income\s+)?tax\s+withheld/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5,
      )
      if (nearby) boxLabels.push({ boxKey: 'box4', item })
    } else if (s === '5') {
      const nearby = page1.find((it) =>
        /employee\s+contributions/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box5', item })
    } else if (s === '7') {
      const nearby = page1.find((it) =>
        /distribution\s+code/i.test(it.str) &&
        Math.abs(it.y - item.y) < 5 && it.x > item.x,
      )
      if (nearby) boxLabels.push({ boxKey: 'box7', item })
    }
  }

  for (const { boxKey, item } of boxLabels) {
    if (boxKey === 'box7') {
      // Distribution code is text, not monetary
      const codeItem = page1.find((it) =>
        /^[1-9A-T]{1,2}$/i.test(it.str.trim()) &&
        it.y > item.y && it.y <= item.y + 30 &&
        Math.abs(it.x - item.x) < 25,
      )
      if (codeItem) {
        fields.set('box7', textField(codeItem.str.trim().toUpperCase()))
      }
      continue
    }

    const dollarSign = page1.find((it) =>
      it.str.trim() === '$' &&
      it.page === item.page &&
      it.y > item.y && it.y <= item.y + 30 &&
      Math.abs(it.x - item.x) < 25,
    )

    if (dollarSign) {
      const val = page1.find((it) =>
        DOLLARS_RE.test(it.str.trim()) &&
        it.page === dollarSign.page &&
        Math.abs(it.y - dollarSign.y) < 5 &&
        it.x > dollarSign.x && it.x < dollarSign.x + 120,
      )
      if (val) {
        fields.set(boxKey, field(parseCents(val.str.trim())))
        continue
      }
    }

    const val = findDollarBelow(page1, item)
    if (val !== null) {
      fields.set(boxKey, field(val))
    }
  }

  // Payer name
  const payerLabel = page1.find((it) => /^PAYER.S$/i.test(it.str.trim()))
  if (payerLabel) {
    const payerLines = page1
      .filter((it) =>
        it.y > payerLabel.y + 10 &&
        it.y < payerLabel.y + 60 &&
        it.x < 250 &&
        it.str.trim().length > 2 &&
        !/^payer|^postal|^telephone|^name|^street|^city|^state|^province|^country|^zip|^foreign|^or$/i.test(it.str.trim()),
      )
      .sort((a, b) => a.y - b.y)

    if (payerLines.length > 0) {
      fields.set('payerName', textField(payerLines[0].str.trim()))
    }
  }

  // IRA/SEP/SIMPLE checkbox — look for nearby text
  const iraText = page1.find((it) => /IRA.SEP.SIMPLE/i.test(it.str))
  if (iraText) {
    fields.set('iraOrSep', textField('true'))
  }

  return fields
}

// ── 1099-R line-scan parsing ──────────────────────────────

function parse1099RLineScan(lineTexts: string[]): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()

  for (const t of lineTexts) {
    if (/payer/i.test(t) && !/box|form|copy|1099/i.test(t)) {
      const nameMatch = t.match(/(?:payer.s?\s+name\s*[:\-]?\s*)(.+)/i)
      if (nameMatch) {
        fields.set('payerName', textField(nameMatch[1].trim()))
        break
      }
    }
  }

  for (const t of lineTexts) {
    const val = extractTrailingDollars(t)
    if (val === null) continue

    if (/\b(?:box\s*)?1\b.*gross\s+distribution/i.test(t) || /^1\s+Gross/i.test(t)) {
      fields.set('box1', field(val))
    } else if (/\b(?:box\s*)?2a\b.*taxable\s+amount/i.test(t) || /^2a\s/i.test(t)) {
      fields.set('box2a', field(val))
    } else if (/\b(?:box\s*)?3\b.*capital\s+gain/i.test(t) || /^3\s+Capital/i.test(t)) {
      fields.set('box3', field(val))
    } else if (/\b(?:box\s*)?4\b.*federal\s+(?:income\s+)?tax\s+withheld/i.test(t) || /^4\s+Federal/i.test(t)) {
      fields.set('box4', field(val))
    } else if (/\b(?:box\s*)?5\b.*employee\s+contributions/i.test(t) || /^5\s+Employee/i.test(t)) {
      fields.set('box5', field(val))
    }
  }

  // Distribution code — look for code pattern
  for (const t of lineTexts) {
    const codeMatch = t.match(/\b(?:box\s*)?7\b.*?(?:distribution\s+code)?\s*[:\-]?\s*([1-9A-T]{1,2})\b/i)
    if (codeMatch) {
      fields.set('box7', textField(codeMatch[1].toUpperCase()))
      break
    }
  }

  // IRA/SEP/SIMPLE
  for (const t of lineTexts) {
    if (/IRA.SEP.SIMPLE/i.test(t) && /\bX\b|checked|yes/i.test(t)) {
      fields.set('iraOrSep', textField('true'))
      break
    }
  }

  return fields
}

function parseW2LineScan(lineTexts: string[]): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()

  // Employer name
  for (const t of lineTexts) {
    if (/employer.s?\s+name/i.test(t)) {
      const name = t.replace(/^.*employer.s?\s+name\s*(?:,?\s*address[^:]*)?[:\s-]*/i, '').trim()
      if (name && !/^(and|address|number)/i.test(name)) {
        fields.set('employerName', textField(name))
        break
      }
    }
  }

  // Fallback: EIN proximity
  if (!fields.has('employerName')) {
    for (let i = 0; i < lineTexts.length; i++) {
      if (/\d{2}-\d{7}/.test(lineTexts[i])) {
        for (let j = Math.max(0, i - 2); j <= Math.min(lineTexts.length - 1, i + 2); j++) {
          if (j === i) continue
          const candidate = lineTexts[j].trim()
          if (candidate.length > 3 && /^[A-Z]/.test(candidate) && !/\d{2}-\d{7}/.test(candidate) && !/box|form|wage|statement|ein|ssn/i.test(candidate)) {
            fields.set('employerName', textField(candidate))
            break
          }
        }
        break
      }
    }
  }

  // EIN
  for (const t of lineTexts) {
    const einMatch = t.match(/(\d{2}-\d{7})/)
    if (einMatch) {
      fields.set('employerEin', textField(einMatch[1]))
      break
    }
  }

  // Box values
  for (const t of lineTexts) {
    const val = extractTrailingDollars(t)
    if (val === null) continue

    if (/\b(?:box\s*)?1\b.*wages/i.test(t) || /^1\s+Wages/i.test(t)) {
      fields.set('box1', field(val))
    } else if (/\b(?:box\s*)?2\b.*federal.*(?:income\s+)?tax\s+withheld/i.test(t) || /^2\s+Federal/i.test(t)) {
      fields.set('box2', field(val))
    } else if (/\b(?:box\s*)?3\b.*social\s+security\s+wages/i.test(t) || /^3\s+Social\s+security\s+wages/i.test(t)) {
      fields.set('box3', field(val))
    } else if (/\b(?:box\s*)?4\b.*social\s+security\s+tax/i.test(t) || /^4\s+Social\s+security\s+tax/i.test(t)) {
      fields.set('box4', field(val))
    } else if (/\b(?:box\s*)?5\b.*medicare\s+wages/i.test(t) || /^5\s+Medicare\s+wages/i.test(t)) {
      fields.set('box5', field(val))
    } else if (/\b(?:box\s*)?6\b.*medicare\s+tax/i.test(t) || /^6\s+Medicare\s+tax/i.test(t)) {
      fields.set('box6', field(val))
    } else if (/\b(?:box\s*)?16\b.*state\s+wages/i.test(t) || /^16\s+State\s+wages/i.test(t)) {
      fields.set('box16StateWages', field(val))
    } else if (/\b(?:box\s*)?17\b.*state\s+income\s+tax/i.test(t) || /^17\s+State\s+income\s+tax/i.test(t)) {
      fields.set('box17StateIncomeTax', field(val))
    }
  }

  // State abbreviation
  for (const t of lineTexts) {
    const stateMatch = t.match(/\b(?:box\s*)?15\b.*?\b([A-Z]{2})\b/)
    if (stateMatch && /state/i.test(t)) {
      fields.set('box15State', textField(stateMatch[1]))
      break
    }
  }

  return fields
}

// ── Main export ─────────────────────────────────────────────

export async function parseGenericFormPdf(data: ArrayBuffer): Promise<GenericPdfResult> {
  await ensureWorker()

  const items = await extractItems(data)
  const lines = groupLines(items)
  const lineTexts = lines.map((l) => l.text)

  // Detect form type from first-page text
  const firstPageText = items
    .filter((it) => it.page === 1)
    .map((it) => it.str)
    .join(' ')

  const formType = detectFormTypeFromText(firstPageText)

  if (formType === 'unknown') {
    return { formType, fields: new Map(), warnings: [] }
  }

  const warnings: string[] = []

  // Strategy 1: Positional extraction (IRS grid layout)
  let fields: Map<string, ExtractedField>

  switch (formType) {
    case '1099-INT':
      fields = parse1099IntPositional(items)
      break
    case '1099-DIV':
      fields = parse1099DivPositional(items)
      break
    case '1099-R':
      fields = parse1099RPositional(items)
      break
    case 'W-2':
      fields = parseW2Positional(items)
      break
  }

  // Strategy 2: If positional found no monetary values, try line-scan
  const hasMonetaryField = [...fields.values()].some((f) => /^\d+$/.test(f.value) && f.value !== '0')
  if (!hasMonetaryField) {
    let lineScanFields: Map<string, ExtractedField>
    switch (formType) {
      case '1099-INT':
        lineScanFields = parse1099IntLineScan(lineTexts)
        break
      case '1099-DIV':
        lineScanFields = parse1099DivLineScan(lineTexts)
        break
      case '1099-R':
        lineScanFields = parse1099RLineScan(lineTexts)
        break
      case 'W-2':
        lineScanFields = parseW2LineScan(lineTexts)
        break
    }
    // Use line-scan results if they found more fields
    if (lineScanFields.size > fields.size) {
      fields = lineScanFields
    }
  }

  if (fields.size === 0) {
    warnings.push('Form type was detected but no field values could be extracted. The PDF layout may not be supported.')
  }

  return { formType, fields, warnings }
}
