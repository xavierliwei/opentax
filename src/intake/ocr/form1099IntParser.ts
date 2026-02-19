/**
 * 1099-INT field extraction from OCR output.
 */

import type { OCRResult } from './ocrEngine.ts'
import { findLabelWords, findValueNear, ocrTextToCents } from './spatialMatch.ts'
import type { ExtractedField } from './w2Parser.ts'

export interface Form1099IntParseResult {
  fields: Map<string, ExtractedField>
}

interface FieldDef {
  key: string
  patterns: RegExp[]
  type: 'monetary' | 'text'
}

const FORM_1099_INT_FIELDS: FieldDef[] = [
  { key: 'payerName', patterns: [/^Payer/i, /payer.*name/i, /^PAYER'S$/i], type: 'text' },
  { key: 'box1', patterns: [/^Box 1$/i, /interest.*income/i], type: 'monetary' },
  { key: 'box2', patterns: [/^Box 2$/i, /early.*withdrawal/i], type: 'monetary' },
  { key: 'box3', patterns: [/^Box 3$/i, /savings.*bonds/i], type: 'monetary' },
  { key: 'box4', patterns: [/^Box 4$/i, /federal.*tax.*withheld/i], type: 'monetary' },
  { key: 'box8', patterns: [/^Box 8$/i, /tax.exempt.*interest/i], type: 'monetary' },
]

export function parseForm1099Int(ocr: OCRResult): Form1099IntParseResult {
  const fields = new Map<string, ExtractedField>()

  for (const def of FORM_1099_INT_FIELDS) {
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
