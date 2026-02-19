/**
 * W-2 field extraction from OCR output.
 *
 * Uses spatial matching to locate label→value pairs on a scanned W-2.
 * Returns a map of field names to extracted values with per-field confidence.
 */

import type { OCRResult } from './ocrEngine.ts'
import { findLabelWords, findValueNear, ocrTextToCents } from './spatialMatch.ts'
import type { OCRBBox } from './ocrEngine.ts'

export interface ExtractedField {
  value: string
  confidence: number // 0–1
  bbox: OCRBBox | null
}

export interface W2ParseResult {
  fields: Map<string, ExtractedField>
}

interface FieldDef {
  key: string
  patterns: RegExp[]
  type: 'monetary' | 'text' | 'ein' | 'state'
}

const W2_FIELDS: FieldDef[] = [
  { key: 'employerEin', patterns: [/^EIN$/i, /employer.*identification/i, /\bEIN\b/i], type: 'ein' },
  { key: 'employerName', patterns: [/^Employer/i, /employer.*name/i], type: 'text' },
  { key: 'box1', patterns: [/^Box 1$/i, /wages.*tips/i], type: 'monetary' },
  { key: 'box2', patterns: [/^Box 2$/i, /federal.*income.*tax.*withheld/i], type: 'monetary' },
  { key: 'box3', patterns: [/^Box 3$/i, /social.*security.*wages/i], type: 'monetary' },
  { key: 'box4', patterns: [/^Box 4$/i, /social.*security.*tax.*withheld/i], type: 'monetary' },
  { key: 'box5', patterns: [/^Box 5$/i, /medicare.*wages/i], type: 'monetary' },
  { key: 'box6', patterns: [/^Box 6$/i, /medicare.*tax.*withheld/i], type: 'monetary' },
  { key: 'box15State', patterns: [/^Box 15$/i, /^State$/i], type: 'state' },
  { key: 'box16StateWages', patterns: [/^Box 16$/i, /state.*wages/i], type: 'monetary' },
  { key: 'box17StateIncomeTax', patterns: [/^Box 17$/i, /state.*income.*tax/i], type: 'monetary' },
]

export function parseW2(ocr: OCRResult): W2ParseResult {
  const fields = new Map<string, ExtractedField>()

  for (const def of W2_FIELDS) {
    const label = findLabelWords(ocr.words, def.patterns)
    if (!label) continue

    const valueWord = findValueNear(ocr.words, label.bbox, def.type)
    if (!valueWord) continue

    let value: string
    if (def.type === 'monetary') {
      const cents = ocrTextToCents(valueWord.text)
      value = String(cents)
    } else {
      value = valueWord.text.trim()
    }

    fields.set(def.key, {
      value,
      confidence: valueWord.confidence / 100,
      bbox: valueWord.bbox,
    })
  }

  return { fields }
}
