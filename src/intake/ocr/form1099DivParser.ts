/**
 * 1099-DIV field extraction from OCR output.
 */

import type { OCRResult } from './ocrEngine.ts'
import { findLabelWords, findValueNear, ocrTextToCents } from './spatialMatch.ts'
import type { ExtractedField } from './w2Parser.ts'

export interface Form1099DivParseResult {
  fields: Map<string, ExtractedField>
}

interface FieldDef {
  key: string
  patterns: RegExp[]
  type: 'monetary' | 'text'
}

const FORM_1099_DIV_FIELDS: FieldDef[] = [
  { key: 'payerName', patterns: [/^Payer/i, /payer.*name/i, /^PAYER'S$/i], type: 'text' },
  { key: 'box1a', patterns: [/^Box 1a$/i, /ordinary.*dividends/i, /^1a$/i], type: 'monetary' },
  { key: 'box1b', patterns: [/^Box 1b$/i, /qualified.*dividends/i, /^1b$/i], type: 'monetary' },
  { key: 'box2a', patterns: [/^Box 2a$/i, /capital.*gain/i, /^2a$/i], type: 'monetary' },
  { key: 'box4', patterns: [/^Box 4$/i, /federal.*tax.*withheld/i], type: 'monetary' },
  { key: 'box5', patterns: [/^Box 5$/i, /section.*199a/i], type: 'monetary' },
  { key: 'box11', patterns: [/^Box 11$/i, /exempt.*interest.*dividends/i], type: 'monetary' },
]

export function parseForm1099Div(ocr: OCRResult): Form1099DivParseResult {
  const fields = new Map<string, ExtractedField>()

  for (const def of FORM_1099_DIV_FIELDS) {
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
