/**
 * Form 1098 (Mortgage Interest Statement) PDF parser.
 *
 * Extracts key fields from a standard IRS Form 1098:
 *   - Box 1: Mortgage interest received
 *   - Box 2: Outstanding mortgage principal
 *   - Box 11: Mortgage origination date
 *   - Lender name from the recipient block
 *
 * The parsed values directly populate the existing ItemizedDeductions fields
 * (mortgageInterest, mortgagePrincipal, mortgagePreTCJA).
 */

import { ensureWorker, extractItems, groupLines } from './pdfUtils'

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

const DOLLARS_RE = /\$?\s*([\d,]+\.\d{2})\b/

function parseCents(s: string): number {
  return Math.round(parseFloat(s.replace(/[,$\s]/g, '')) * 100)
}

/** Parse a date in MM/DD/YYYY or MM/DD/YY format to ISO string */
function parseDate(s: string): string | null {
  // MM/DD/YYYY
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    const [, mm, dd, yyyy] = m
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  // MM/DD/YY
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

  const result: Form1098ParseResult = {
    lenderName: '',
    mortgageInterest: 0,
    mortgagePrincipal: 0,
    mortgagePreTCJA: false,
    warnings: [],
    errors: [],
  }

  // Verify this looks like a Form 1098
  const allText = lines.map((l) => l.text).join(' ').toUpperCase()
  if (!allText.includes('1098') || !allText.includes('MORTGAGE')) {
    result.errors.push('This does not appear to be a Form 1098 (Mortgage Interest Statement).')
    return result
  }

  // Extract lender name — typically in the RECIPIENT/LENDER block near top
  for (const line of lines) {
    const t = line.text
    if (/recipient.s?\s*.*name/i.test(t) || /lender.s?\s*name/i.test(t)) {
      // The lender name is often on the next line or same line after the label
      const idx = lines.indexOf(line)
      if (idx + 1 < lines.length) {
        const nextText = lines[idx + 1].text.trim()
        // Skip lines that look like addresses or other labels
        if (nextText && !/^\d/.test(nextText) && !/address|street|city|state|zip/i.test(nextText)) {
          result.lenderName = nextText
        }
      }
      break
    }
  }

  // If no labeled lender name found, try first few lines for a company name
  if (!result.lenderName) {
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const t = lines[i].text.trim()
      // Look for lines that look like company names (all caps or title case, no numbers)
      if (t.length > 3 && t.length < 80 && /^[A-Z]/.test(t) &&
          !/(form|1098|copy|filer|recipient|corrected|omb|void|department|internal)/i.test(t) &&
          !/\d{5}/.test(t)) {
        result.lenderName = t
        break
      }
    }
  }

  // Scan for box values
  let foundBox1 = false
  let foundBox2 = false

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text

    // Box 1 — Mortgage interest received from payer(s)/borrower(s)
    if (!foundBox1 && /\b1\b.*mortgage\s+interest\s+received/i.test(t)) {
      const dollarMatch = t.match(DOLLARS_RE)
      if (dollarMatch) {
        result.mortgageInterest = parseCents(dollarMatch[1])
        foundBox1 = true
      } else {
        // Check adjacent lines for the value
        const val = findNearbyDollar(lines, i)
        if (val !== null) {
          result.mortgageInterest = val
          foundBox1 = true
        }
      }
    }

    // Also match simpler "Box 1" pattern
    if (!foundBox1 && /^[\s$]*box\s*1\b/i.test(t) && !/box\s*1[0-9]/i.test(t)) {
      const dollarMatch = t.match(DOLLARS_RE)
      if (dollarMatch) {
        result.mortgageInterest = parseCents(dollarMatch[1])
        foundBox1 = true
      }
    }

    // Box 2 — Outstanding mortgage principal
    if (!foundBox2 && /\b2\b.*outstanding\s+mortgage\s+principal/i.test(t)) {
      const dollarMatch = t.match(DOLLARS_RE)
      if (dollarMatch) {
        result.mortgagePrincipal = parseCents(dollarMatch[1])
        foundBox2 = true
      } else {
        const val = findNearbyDollar(lines, i)
        if (val !== null) {
          result.mortgagePrincipal = val
          foundBox2 = true
        }
      }
    }

    if (!foundBox2 && /^[\s$]*box\s*2\b/i.test(t) && !/box\s*2[0-9]/i.test(t)) {
      const dollarMatch = t.match(DOLLARS_RE)
      if (dollarMatch) {
        result.mortgagePrincipal = parseCents(dollarMatch[1])
        foundBox2 = true
      }
    }

    // Box 11 — Mortgage origination date
    if (/\b11\b.*mortgage\s+origination\s+date/i.test(t) || /box\s*11\b/i.test(t)) {
      const dateStr = parseDate(t)
      if (dateStr) {
        result.originationDate = dateStr
        result.mortgagePreTCJA = dateStr <= TCJA_CUTOFF
      } else {
        // Check next line for a date
        if (i + 1 < lines.length) {
          const nextDate = parseDate(lines[i + 1].text)
          if (nextDate) {
            result.originationDate = nextDate
            result.mortgagePreTCJA = nextDate <= TCJA_CUTOFF
          }
        }
      }
    }
  }

  // Also try a positional/pattern approach: scan all lines for dollar amounts
  // near box labels if the labeled approach didn't work
  if (!foundBox1) {
    for (const line of lines) {
      // Some 1098s have a grid layout: "$ 12,345.67" near a "1" label
      // Try matching lines that have just a dollar amount (the value cells)
      const t = line.text
      if (/mortgage\s+interest/i.test(t) && !foundBox1) {
        const dollarMatch = t.match(DOLLARS_RE)
        if (dollarMatch) {
          result.mortgageInterest = parseCents(dollarMatch[1])
          foundBox1 = true
        }
      }
    }
  }

  if (!foundBox2) {
    for (const line of lines) {
      const t = line.text
      if (/outstanding.*principal/i.test(t) && !foundBox2) {
        const dollarMatch = t.match(DOLLARS_RE)
        if (dollarMatch) {
          result.mortgagePrincipal = parseCents(dollarMatch[1])
          foundBox2 = true
        }
      }
    }
  }

  // Validation
  if (!foundBox1 && !foundBox2) {
    result.errors.push('Could not extract mortgage interest or principal from this Form 1098. The PDF layout may not be supported.')
  } else {
    if (!foundBox1) {
      result.warnings.push('Could not find Box 1 (mortgage interest) — you may need to enter it manually.')
    }
    if (!foundBox2) {
      result.warnings.push('Could not find Box 2 (outstanding principal) — you may need to enter it manually.')
    }
  }

  return result
}

/** Look at the next couple lines for a dollar amount */
function findNearbyDollar(lines: { text: string }[], idx: number): number | null {
  for (let j = idx + 1; j < Math.min(idx + 3, lines.length); j++) {
    const m = lines[j].text.match(DOLLARS_RE)
    if (m) return parseCents(m[1])
  }
  return null
}
