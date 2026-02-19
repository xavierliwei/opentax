import { describe, it, expect } from 'vitest'
import { parseForm1099Int } from '../../../src/intake/ocr/form1099IntParser.ts'
import type { OCRResult, OCRWord } from '../../../src/intake/ocr/ocrEngine.ts'

function word(text: string, x0: number, y0: number, x1: number, y1: number, confidence = 95): OCRWord {
  return { text, bbox: { x0, y0, x1, y1 }, confidence }
}

function make1099IntOCR(): OCRResult {
  const words: OCRWord[] = [
    // Payer info
    word('Payer', 10, 10, 55, 25),
    word('Chase', 130, 10, 185, 25, 93),

    // Box 1 — Interest income
    word('Box', 10, 50, 35, 65),
    word('1', 40, 50, 50, 65),
    word('$1,250.00', 130, 50, 220, 65, 91),

    // Box 2 — Early withdrawal penalty
    word('Box', 10, 80, 35, 95),
    word('2', 40, 80, 50, 95),
    word('$0.00', 130, 80, 180, 95, 90),

    // Box 3 — US Savings Bonds
    word('Box', 10, 110, 35, 125),
    word('3', 40, 110, 50, 125),
    word('$200.00', 130, 110, 210, 125, 88),

    // Box 4 — Federal tax withheld
    word('Box', 10, 140, 35, 155),
    word('4', 40, 140, 50, 155),
    word('$125.00', 130, 140, 210, 155, 92),

    // Box 8 — Tax-exempt interest
    word('Box', 10, 170, 35, 185),
    word('8', 40, 170, 50, 185),
    word('$50.00', 130, 170, 200, 185, 87),
  ]

  return {
    words,
    confidence: 90,
    rawText: 'Form 1099-INT Interest Income Payer Chase Box 1 $1,250.00 ...',
  }
}

describe('parseForm1099Int', () => {
  const ocr = make1099IntOCR()
  const result = parseForm1099Int(ocr)

  it('extracts payer name', () => {
    const field = result.fields.get('payerName')
    expect(field).toBeDefined()
    expect(field!.value).toBe('Chase')
  })

  it('extracts box1 interest income as cents', () => {
    const field = result.fields.get('box1')
    expect(field!.value).toBe('125000')
  })

  it('extracts box2 early withdrawal penalty', () => {
    const field = result.fields.get('box2')
    expect(field!.value).toBe('0')
  })

  it('extracts box3 US savings bonds', () => {
    const field = result.fields.get('box3')
    expect(field!.value).toBe('20000')
  })

  it('extracts box4 federal tax withheld', () => {
    const field = result.fields.get('box4')
    expect(field!.value).toBe('12500')
  })

  it('extracts box8 tax-exempt interest', () => {
    const field = result.fields.get('box8')
    expect(field!.value).toBe('5000')
  })

  it('includes confidence scores from value words', () => {
    const field = result.fields.get('box8')
    // Value word "$50.00" has confidence 87
    expect(field!.confidence).toBeCloseTo(0.87, 2)
  })

  it('returns empty for unrecognizable OCR', () => {
    const emptyOcr: OCRResult = {
      words: [word('gibberish', 0, 0, 80, 20)],
      confidence: 50,
      rawText: 'gibberish',
    }
    expect(parseForm1099Int(emptyOcr).fields.size).toBe(0)
  })
})
