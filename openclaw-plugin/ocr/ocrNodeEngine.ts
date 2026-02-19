/**
 * Node.js OCR engine using tesseract.js.
 *
 * Same word extraction logic as src/intake/ocr/ocrEngine.ts, but reads from
 * filesystem paths instead of File/Blob (browser API).
 * Singleton worker pattern for efficiency.
 */

import { createWorker, type Worker } from 'tesseract.js'
import type { OCRResult, OCRWord } from '../../src/intake/ocr/ocrEngine.ts'

let workerInstance: Worker | null = null
let workerPromise: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (workerInstance) return workerInstance
  if (workerPromise) return workerPromise

  workerPromise = createWorker('eng').then((w) => {
    workerInstance = w
    return w
  })

  return workerPromise
}

export async function terminateNodeOCRWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate()
    workerInstance = null
    workerPromise = null
  }
}

export async function recognizeImageNode(filePath: string): Promise<OCRResult> {
  const worker = await getWorker()
  const { data } = await worker.recognize(filePath)

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
