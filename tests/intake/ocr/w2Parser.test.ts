import { describe, it, expect } from 'vitest'
import { parseW2 } from '../../../src/intake/ocr/w2Parser.ts'
import type { OCRResult, OCRWord } from '../../../src/intake/ocr/ocrEngine.ts'

function word(text: string, x0: number, y0: number, x1: number, y1: number, confidence = 95): OCRWord {
  return { text, bbox: { x0, y0, x1, y1 }, confidence }
}

function makeW2OCR(): OCRResult {
  // Simulates a realistic W-2 layout with labels and values
  const words: OCRWord[] = [
    // Employer info
    word('Employer', 10, 10, 80, 25),
    word('ACME', 85, 10, 135, 25),
    word('EIN', 10, 40, 35, 55),
    word('12-3456789', 130, 40, 220, 55, 92),

    // Box 1 — Wages
    word('Box', 10, 60, 35, 75),
    word('1', 40, 60, 50, 75),
    word('$75,000.00', 130, 60, 230, 75, 88),

    // Box 2 — Federal tax withheld
    word('Box', 10, 90, 35, 105),
    word('2', 40, 90, 50, 105),
    word('$12,500.00', 130, 90, 230, 105, 91),

    // Box 3 — Social Security wages
    word('Box', 10, 120, 35, 135),
    word('3', 40, 120, 50, 135),
    word('$75,000.00', 130, 120, 230, 135, 93),

    // Box 4 — Social Security tax
    word('Box', 10, 150, 35, 165),
    word('4', 40, 150, 50, 165),
    word('$4,650.00', 130, 150, 220, 165, 90),

    // Box 5 — Medicare wages
    word('Box', 10, 180, 35, 195),
    word('5', 40, 180, 50, 195),
    word('$75,000.00', 130, 180, 230, 195, 94),

    // Box 6 — Medicare tax
    word('Box', 10, 210, 35, 225),
    word('6', 40, 210, 50, 225),
    word('$1,087.50', 130, 210, 220, 225, 89),

    // State info
    word('Box', 10, 240, 35, 255),
    word('15', 40, 240, 55, 255),
    word('CA', 130, 240, 155, 255, 96),

    word('Box', 10, 270, 35, 285),
    word('16', 40, 270, 55, 285),
    word('$75,000.00', 130, 270, 230, 285, 92),

    word('Box', 10, 300, 35, 315),
    word('17', 40, 300, 55, 315),
    word('$3,750.00', 130, 300, 220, 315, 90),
  ]

  return {
    words,
    confidence: 91,
    rawText: 'Employer ACME EIN 12-3456789 Box 1 $75,000.00 Box 2 $12,500.00 ...',
  }
}

describe('parseW2', () => {
  const ocr = makeW2OCR()
  const result = parseW2(ocr)

  it('extracts employer name', () => {
    const field = result.fields.get('employerName')
    expect(field).toBeDefined()
    expect(field!.value).toBe('ACME')
  })

  it('extracts employer EIN', () => {
    const field = result.fields.get('employerEin')
    expect(field).toBeDefined()
    expect(field!.value).toBe('12-3456789')
  })

  it('extracts box1 wages as cents', () => {
    const field = result.fields.get('box1')
    expect(field).toBeDefined()
    expect(field!.value).toBe('7500000') // $75,000.00 = 7500000 cents
  })

  it('extracts box2 federal tax withheld', () => {
    const field = result.fields.get('box2')
    expect(field).toBeDefined()
    expect(field!.value).toBe('1250000')
  })

  it('extracts box3 social security wages', () => {
    const field = result.fields.get('box3')
    expect(field!.value).toBe('7500000')
  })

  it('extracts box4 social security tax', () => {
    const field = result.fields.get('box4')
    expect(field!.value).toBe('465000')
  })

  it('extracts box5 medicare wages', () => {
    const field = result.fields.get('box5')
    expect(field!.value).toBe('7500000')
  })

  it('extracts box6 medicare tax', () => {
    const field = result.fields.get('box6')
    expect(field!.value).toBe('108750')
  })

  it('extracts box15 state', () => {
    const field = result.fields.get('box15State')
    expect(field).toBeDefined()
    expect(field!.value).toBe('CA')
  })

  it('extracts box16 state wages', () => {
    const field = result.fields.get('box16StateWages')
    expect(field!.value).toBe('7500000')
  })

  it('extracts box17 state income tax', () => {
    const field = result.fields.get('box17StateIncomeTax')
    expect(field!.value).toBe('375000')
  })

  it('includes per-field confidence from the value word', () => {
    const field = result.fields.get('box1')
    // Value word "$75,000.00" has confidence 88
    expect(field!.confidence).toBeCloseTo(0.88, 2)
  })

  it('includes bbox from the value word', () => {
    const field = result.fields.get('box1')
    expect(field!.bbox).toBeDefined()
    // Value word "$75,000.00" starts at x0=130
    expect(field!.bbox!.x0).toBe(130)
  })

  it('returns empty fields map for OCR with no recognizable labels', () => {
    const emptyOcr: OCRResult = {
      words: [word('random', 0, 0, 50, 20), word('text', 60, 0, 100, 20)],
      confidence: 80,
      rawText: 'random text',
    }
    const r = parseW2(emptyOcr)
    expect(r.fields.size).toBe(0)
  })
})
