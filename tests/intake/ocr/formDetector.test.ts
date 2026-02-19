import { describe, it, expect } from 'vitest'
import { detectFormType, type DetectedFormType } from '../../../src/intake/ocr/formDetector.ts'
import type { OCRResult } from '../../../src/intake/ocr/ocrEngine.ts'

function makeOCR(rawText: string): OCRResult {
  return { words: [], confidence: 90, rawText }
}

describe('detectFormType', () => {
  it('detects W-2 from "Wage and Tax Statement"', () => {
    const ocr = makeOCR('Employee Copy\nWage and Tax Statement\nForm W-2 2025')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('W-2')
  })

  it('detects W-2 from "Form W-2"', () => {
    const ocr = makeOCR('Form W-2\nEmployer Name: ACME Corp')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('W-2')
  })

  it('detects W-2 with OCR spacing in "W - 2"', () => {
    const ocr = makeOCR('Form W - 2\nSome text')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('W-2')
  })

  it('detects 1099-INT from "Interest Income"', () => {
    const ocr = makeOCR('Payer: Big Bank\n1099\nInterest Income\nBox 1: $500.00')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('1099-INT')
  })

  it('detects 1099-INT from "1099-INT"', () => {
    const ocr = makeOCR('Form 1099-INT\nPayer: Bank of America')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('1099-INT')
  })

  it('detects 1099-DIV from "Dividends and Distributions"', () => {
    const ocr = makeOCR('1099\nDividends and Distributions\nTotal Ordinary Dividends')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('1099-DIV')
  })

  it('detects 1099-DIV from "1099-DIV"', () => {
    const ocr = makeOCR('Form 1099-DIV\nVanguard')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('1099-DIV')
  })

  it('detects 1099-DIV with OCR spacing "1099 DIV"', () => {
    const ocr = makeOCR('Form 1099 DIV\nFidelity')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('1099-DIV')
  })

  it('returns unknown for unrecognized text', () => {
    const ocr = makeOCR('Some random document\nwith no tax form markers')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('unknown')
  })

  it('returns unknown for empty text', () => {
    const ocr = makeOCR('')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('unknown')
  })

  it('returns unknown for 1099 without subtype', () => {
    const ocr = makeOCR('Form 1099\nSome generic income')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('unknown')
  })

  it('is case-insensitive', () => {
    const ocr = makeOCR('wage and tax statement\nform w-2')
    expect(detectFormType(ocr)).toBe<DetectedFormType>('W-2')
  })
})
