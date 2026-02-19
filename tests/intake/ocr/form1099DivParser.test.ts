import { describe, it, expect } from 'vitest'
import { parseForm1099Div } from '../../../src/intake/ocr/form1099DivParser.ts'
import type { OCRResult, OCRWord } from '../../../src/intake/ocr/ocrEngine.ts'

function word(text: string, x0: number, y0: number, x1: number, y1: number, confidence = 95): OCRWord {
  return { text, bbox: { x0, y0, x1, y1 }, confidence }
}

function make1099DivOCR(): OCRResult {
  const words: OCRWord[] = [
    // Payer info
    word('Payer', 10, 10, 55, 25),
    word('Vanguard', 130, 10, 210, 25, 94),

    // Box 1a — Ordinary dividends
    word('Box', 10, 50, 35, 65),
    word('1a', 40, 50, 58, 65),
    word('$3,500.00', 130, 50, 220, 65, 91),

    // Box 1b — Qualified dividends
    word('Box', 10, 80, 35, 95),
    word('1b', 40, 80, 58, 95),
    word('$2,800.00', 130, 80, 220, 95, 90),

    // Box 2a — Capital gain distributions
    word('Box', 10, 110, 35, 125),
    word('2a', 40, 110, 58, 125),
    word('$500.00', 130, 110, 210, 125, 89),

    // Box 4 — Federal tax withheld
    word('Box', 10, 140, 35, 155),
    word('4', 40, 140, 50, 155),
    word('$350.00', 130, 140, 210, 155, 92),

    // Box 5 — Section 199A
    word('Box', 10, 170, 35, 185),
    word('5', 40, 170, 50, 185),
    word('$100.00', 130, 170, 210, 185, 88),

    // Box 11 — Exempt interest dividends
    word('Box', 10, 200, 35, 215),
    word('11', 40, 200, 58, 215),
    word('$75.00', 130, 200, 200, 215, 86),
  ]

  return {
    words,
    confidence: 90,
    rawText: 'Form 1099-DIV Dividends and Distributions Payer Vanguard ...',
  }
}

describe('parseForm1099Div', () => {
  const ocr = make1099DivOCR()
  const result = parseForm1099Div(ocr)

  it('extracts payer name', () => {
    const field = result.fields.get('payerName')
    expect(field).toBeDefined()
    expect(field!.value).toBe('Vanguard')
  })

  it('extracts box1a ordinary dividends as cents', () => {
    const field = result.fields.get('box1a')
    expect(field!.value).toBe('350000')
  })

  it('extracts box1b qualified dividends', () => {
    const field = result.fields.get('box1b')
    expect(field!.value).toBe('280000')
  })

  it('extracts box2a capital gain distributions', () => {
    const field = result.fields.get('box2a')
    expect(field!.value).toBe('50000')
  })

  it('extracts box4 federal tax withheld', () => {
    const field = result.fields.get('box4')
    expect(field!.value).toBe('35000')
  })

  it('extracts box5 section 199A', () => {
    const field = result.fields.get('box5')
    expect(field!.value).toBe('10000')
  })

  it('extracts box11 exempt interest dividends', () => {
    const field = result.fields.get('box11')
    expect(field!.value).toBe('7500')
  })

  it('includes confidence scores from value words', () => {
    const field = result.fields.get('box11')
    // Value word "$75.00" has confidence 86
    expect(field!.confidence).toBeCloseTo(0.86, 2)
  })

  it('returns empty for unrecognizable OCR', () => {
    const emptyOcr: OCRResult = {
      words: [word('noise', 0, 0, 50, 20)],
      confidence: 40,
      rawText: 'noise',
    }
    expect(parseForm1099Div(emptyOcr).fields.size).toBe(0)
  })
})
