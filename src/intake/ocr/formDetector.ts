/**
 * Form type detection from OCR output.
 *
 * Scans the raw text for known IRS form markers to determine
 * whether the scanned document is a W-2, 1099-INT, or 1099-DIV.
 */

import type { OCRResult } from './ocrEngine.ts'

export type DetectedFormType = 'W-2' | '1099-INT' | '1099-DIV' | 'unknown'

export function detectFormType(ocr: OCRResult): DetectedFormType {
  const text = ocr.rawText.toUpperCase()

  // W-2: "WAGE AND TAX STATEMENT" or "FORM W-2" / "W-2"
  if (/WAGE\s+AND\s+TAX\s+STATEMENT/.test(text) || /\bFORM\s+W[\s-]*2\b/.test(text)) {
    return 'W-2'
  }

  // Both 1099 types contain "1099" — distinguish by subtype markers
  const has1099 = /\b1099\b/.test(text)

  if (has1099) {
    // 1099-INT: "INTEREST INCOME" or "1099-INT"
    if (/INTEREST\s+INCOME/.test(text) || /1099[\s-]*INT\b/.test(text)) {
      return '1099-INT'
    }

    // 1099-DIV: "DIVIDENDS AND DISTRIBUTIONS" or "1099-DIV"
    if (/DIVIDENDS\s+AND\s+DISTRIBUTIONS/.test(text) || /1099[\s-]*DIV\b/.test(text)) {
      return '1099-DIV'
    }
  }

  return 'unknown'
}
