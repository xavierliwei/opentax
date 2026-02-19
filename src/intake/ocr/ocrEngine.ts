/**
 * Tesseract.js wrapper — browser-side OCR engine.
 *
 * Singleton worker pattern: the WASM worker + trained data (~15MB)
 * is loaded once and reused across all recognitions.
 * All processing is local — no data leaves the device.
 */

import { createWorker, type Worker } from 'tesseract.js'

// ── Types ──────────────────────────────────────────────────────

export interface OCRBBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface OCRWord {
  text: string
  bbox: OCRBBox
  confidence: number // 0–100
}

export interface OCRResult {
  words: OCRWord[]
  confidence: number // 0–100, overall page confidence
  rawText: string
}

// ── Singleton worker ──────────────────────────────────────────

let workerInstance: Worker | null = null
let workerPromise: Promise<Worker> | null = null

export async function getOCRWorker(): Promise<Worker> {
  if (workerInstance) return workerInstance
  if (workerPromise) return workerPromise

  workerPromise = createWorker('eng').then((w) => {
    workerInstance = w
    return w
  })

  return workerPromise
}

/** Terminate the singleton worker (for cleanup). */
export async function terminateOCRWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate()
    workerInstance = null
    workerPromise = null
  }
}

// ── Recognition ───────────────────────────────────────────────

export async function recognizeImage(image: File | Blob): Promise<OCRResult> {
  const worker = await getOCRWorker()
  const { data } = await worker.recognize(image)

  // Extract words from nested structure: blocks → paragraphs → lines → words
  const words: OCRWord[] = []
  if (data.blocks) {
    for (const block of data.blocks) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const w of line.words) {
            words.push({
              text: w.text,
              bbox: {
                x0: w.bbox.x0,
                y0: w.bbox.y0,
                x1: w.bbox.x1,
                y1: w.bbox.y1,
              },
              confidence: w.confidence,
            })
          }
        }
      }
    }
  }

  return {
    words,
    confidence: data.confidence,
    rawText: data.text,
  }
}
