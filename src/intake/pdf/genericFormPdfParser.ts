/**
 * Generic standalone form PDF parser for W-2, 1099-INT, and 1099-DIV.
 *
 * Uses pdfjs-dist text extraction (same as fidelityPdfParser / robinhoodPdfParser)
 * to read embedded PDF text layers. Replaces the Tesseract OCR pipeline for
 * digitally-generated PDFs, which is the vast majority of tax forms.
 *
 * Strategy: extract text with pdfUtils, group into lines, scan for label patterns,
 * and extract trailing dollar amounts — the same proven pattern used by the
 * Fidelity consolidated PDF parser.
 */

import { ensureWorker, extractItems, groupLines } from './pdfUtils'

// ── Shared types (previously in OCR modules) ─────────────────

export type DetectedFormType = 'W-2' | '1099-INT' | '1099-DIV' | 'unknown'

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

  return 'unknown'
}

// ── Value extraction helpers ────────────────────────────────

const TRAILING_DOLLARS_RE = /\$?([\d,]+\.\d{2})\s*$/

function parseCents(s: string): number {
  return Math.round(parseFloat(s.replace(/,/g, '')) * 100)
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

// ── 1099-INT parsing ────────────────────────────────────────

function parse1099Int(lineTexts: string[]): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()

  // Look for payer name: usually the first prominent text line
  // before the form fields start
  for (const t of lineTexts) {
    if (/payer/i.test(t) && !/box|form|copy|1099/i.test(t)) {
      // Try to extract name after "PAYER'S name" label
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

    // Box labels: "1 Interest income", "Box 1", etc.
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

// ── 1099-DIV parsing ────────────────────────────────────────

function parse1099Div(lineTexts: string[]): Map<string, ExtractedField> {
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

// ── W-2 parsing ─────────────────────────────────────────────

function parseW2(lineTexts: string[]): Map<string, ExtractedField> {
  const fields = new Map<string, ExtractedField>()

  // Employer name: look for "Employer's name" label followed by actual name
  for (const t of lineTexts) {
    if (/employer.s?\s+name/i.test(t)) {
      const name = t.replace(/^.*employer.s?\s+name\s*(?:,?\s*address[^:]*)?[:\s-]*/i, '').trim()
      if (name && !/^(and|address|number)/i.test(name)) {
        fields.set('employerName', textField(name))
        break
      }
    }
  }

  // Try fallback: if no employer name found from label, look for EIN pattern nearby
  if (!fields.has('employerName')) {
    for (let i = 0; i < lineTexts.length; i++) {
      if (/\d{2}-\d{7}/.test(lineTexts[i])) {
        // Employer name is often on the line before or after the EIN
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

  // Employer EIN
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

  // Box 15 — State abbreviation (no dollar value)
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
  let fields: Map<string, ExtractedField>

  switch (formType) {
    case '1099-INT':
      fields = parse1099Int(lineTexts)
      break
    case '1099-DIV':
      fields = parse1099Div(lineTexts)
      break
    case 'W-2':
      fields = parseW2(lineTexts)
      break
  }

  if (fields.size === 0) {
    warnings.push('Form type was detected but no field values could be extracted. The PDF layout may not be supported.')
  }

  return { formType, fields, warnings }
}
