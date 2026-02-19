import { describe, it, expect } from 'vitest'
import {
  findLabelWords,
  findValueNear,
  isMonetary,
  ocrTextToCents,
} from '../../../src/intake/ocr/spatialMatch.ts'
import type { OCRWord } from '../../../src/intake/ocr/ocrEngine.ts'

function word(text: string, x0: number, y0: number, x1: number, y1: number, confidence = 95): OCRWord {
  return { text, bbox: { x0, y0, x1, y1 }, confidence }
}

describe('isMonetary', () => {
  it('matches dollar amounts with $', () => {
    expect(isMonetary('$1,234.56')).toBe(true)
  })

  it('matches amounts without $', () => {
    expect(isMonetary('1234.56')).toBe(true)
  })

  it('matches whole numbers', () => {
    expect(isMonetary('50000')).toBe(true)
  })

  it('matches amounts with commas', () => {
    expect(isMonetary('1,234,567')).toBe(true)
  })

  it('rejects text strings', () => {
    expect(isMonetary('ACME Corp')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isMonetary('')).toBe(false)
  })

  it('rejects EIN-like strings', () => {
    expect(isMonetary('12-3456789')).toBe(false)
  })

  it('rejects bare single digits (box numbers)', () => {
    expect(isMonetary('1')).toBe(false)
    expect(isMonetary('2')).toBe(false)
    expect(isMonetary('15')).toBe(false)
  })

  it('matches $5 (has dollar sign)', () => {
    expect(isMonetary('$5')).toBe(true)
  })

  it('matches 100 (3+ digits)', () => {
    expect(isMonetary('100')).toBe(true)
  })

  it('matches 0.50 (has decimal)', () => {
    expect(isMonetary('0.50')).toBe(true)
  })
})

describe('ocrTextToCents', () => {
  it('converts dollar string to cents', () => {
    expect(ocrTextToCents('$1,234.56')).toBe(123456)
  })

  it('converts plain number to cents', () => {
    expect(ocrTextToCents('500.00')).toBe(50000)
  })

  it('returns 0 for non-parseable text', () => {
    expect(ocrTextToCents('N/A')).toBe(0)
  })
})

describe('findLabelWords', () => {
  const words: OCRWord[] = [
    word('Employer', 10, 10, 80, 25),
    word('name', 85, 10, 120, 25),
    word('ACME', 130, 10, 180, 25),
    word('Box', 10, 40, 35, 55),
    word('1', 40, 40, 50, 55),
    word('$50,000.00', 60, 40, 140, 55),
  ]

  it('finds single-word label', () => {
    const result = findLabelWords(words, [/^Employer$/i])
    expect(result).not.toBeNull()
    expect(result!.text).toBe('Employer')
  })

  it('finds two-word label via concatenation', () => {
    const result = findLabelWords(words, [/^Box 1$/i])
    expect(result).not.toBeNull()
    expect(result!.text).toBe('Box 1')
    // Merged bbox
    expect(result!.bbox.x0).toBe(10)
    expect(result!.bbox.x1).toBe(50)
  })

  it('returns null when no match', () => {
    const result = findLabelWords(words, [/^Box 99$/])
    expect(result).toBeNull()
  })

  it('returns first matching pattern', () => {
    const result = findLabelWords(words, [/^ACME$/i, /^Employer$/i])
    expect(result!.text).toBe('ACME')
  })
})

describe('findValueNear', () => {
  const words: OCRWord[] = [
    word('Box', 10, 40, 35, 55),
    word('1', 40, 40, 50, 55),
    word('$50,000.00', 130, 40, 230, 55),
    word('Box', 10, 70, 35, 85),
    word('2', 40, 70, 50, 85),
    word('$5,000.00', 130, 70, 220, 85),
    word('Employer', 10, 10, 80, 25),
    word('ACME', 130, 10, 180, 25),
    word('Corp', 185, 10, 220, 25),
  ]

  it('finds monetary value to the right of label', () => {
    const label = findLabelWords(words, [/^Box 1$/i])!
    const value = findValueNear(words, label.bbox, 'monetary')
    expect(value).not.toBeNull()
    expect(value!.text).toBe('$50,000.00')
  })

  it('finds text value to the right of label', () => {
    const label = findLabelWords(words, [/^Employer$/i])!
    const value = findValueNear(words, label.bbox, 'text')
    expect(value).not.toBeNull()
    expect(value!.text).toBe('ACME')
  })

  it('finds the closest value (not one from another row)', () => {
    const label = findLabelWords(words, [/^Box 2$/i])!
    const value = findValueNear(words, label.bbox, 'monetary')
    expect(value).not.toBeNull()
    expect(value!.text).toBe('$5,000.00')
  })

  it('returns null when no value of the right type', () => {
    const label = findLabelWords(words, [/^Box 1$/i])!
    const value = findValueNear(words, label.bbox, 'ein')
    expect(value).toBeNull()
  })

  it('finds value below label when nothing is to the right', () => {
    const labelOnlyWords: OCRWord[] = [
      word('Wages', 10, 10, 60, 25),
      word('$75,000.00', 10, 30, 100, 45),
    ]
    const label = findLabelWords(labelOnlyWords, [/^Wages$/i])!
    const value = findValueNear(labelOnlyWords, label.bbox, 'monetary')
    expect(value).not.toBeNull()
    expect(value!.text).toBe('$75,000.00')
  })
})
