/**
 * Spatial matching utilities for OCR form parsing.
 *
 * Tax forms have a structured layout: labels appear near their values
 * (typically to the left or above). These utilities find label words
 * by regex pattern, then locate the nearest value word in the expected
 * spatial direction.
 */

import type { OCRWord, OCRBBox } from './ocrEngine.ts'
import { parseCurrency } from '../csv/utils.ts'

// ── Label search ──────────────────────────────────────────────

/**
 * Find the first word (or consecutive words) matching any of the given
 * regex patterns. Returns the matched word with the widest bbox span
 * if multiple consecutive words form the match, or null if not found.
 */
export function findLabelWords(words: OCRWord[], patterns: RegExp[]): OCRWord | null {
  for (const pattern of patterns) {
    // Try single-word match
    for (const word of words) {
      if (pattern.test(word.text)) {
        return word
      }
    }

    // Try two-word concatenation (for split labels like "Box 1")
    for (let i = 0; i < words.length - 1; i++) {
      const combined = words[i].text + ' ' + words[i + 1].text
      if (pattern.test(combined)) {
        return {
          text: combined,
          bbox: mergeBBox(words[i].bbox, words[i + 1].bbox),
          confidence: Math.min(words[i].confidence, words[i + 1].confidence),
        }
      }
    }
  }

  return null
}

// ── Value search ──────────────────────────────────────────────

export type ValueType = 'monetary' | 'text' | 'ein' | 'state'

/**
 * Find the nearest value word to the right of or below a label bounding box.
 *
 * Strategy:
 * 1. Collect candidate words that are to the right of (same row) or below the label
 * 2. Filter by value type expectations
 * 3. Return the closest candidate by spatial distance
 */
export function findValueNear(
  words: OCRWord[],
  labelBbox: OCRBBox,
  type: ValueType = 'text',
): OCRWord | null {
  const labelCenterY = (labelBbox.y0 + labelBbox.y1) / 2
  const labelHeight = labelBbox.y1 - labelBbox.y0
  const labelWidth = labelBbox.x1 - labelBbox.x0

  const candidates: { word: OCRWord; distance: number }[] = []

  for (const word of words) {
    const wordCenterY = (word.bbox.y0 + word.bbox.y1) / 2

    // Skip words that are above the label
    if (word.bbox.y1 < labelBbox.y0 - labelHeight) continue

    // Skip words that are to the left of the label
    if (word.bbox.x1 < labelBbox.x0) continue

    // Skip the label word itself (overlapping bbox)
    if (bboxOverlap(word.bbox, labelBbox) > 0.5) continue

    // Type filtering
    if (type === 'monetary' && !isMonetary(word.text)) continue
    if (type === 'ein' && !/\d{2}[\s-]?\d{7}/.test(word.text)) continue
    if (type === 'state' && !/^[A-Z]{2}$/i.test(word.text.trim())) continue

    // Calculate distance: prefer right-of over below
    const dx = Math.max(0, word.bbox.x0 - labelBbox.x1)
    const dy = Math.abs(wordCenterY - labelCenterY)
    const sameRow = dy < labelHeight * 1.5
    const distance = sameRow ? dx : dx + dy + labelWidth * 2

    candidates.push({ word, distance })
  }

  candidates.sort((a, b) => a.distance - b.distance)
  return candidates[0]?.word ?? null
}

// ── Monetary detection ────────────────────────────────────────

/**
 * Check if a text string looks like a monetary value.
 * Requires at least one of: $ sign, decimal point, comma, or 3+ digits.
 * This excludes bare short numbers like "1", "2", "15" which are
 * typically box number labels on tax forms.
 */
export function isMonetary(text: string): boolean {
  const t = text.trim()
  // Must have $ sign, or decimal point with digits, or comma separator, or 3+ digits
  if (/^\$[\d,]+\.?\d*$/.test(t)) return true
  if (/^[\d,]+\.\d+$/.test(t)) return true
  if (/^\d{1,3}(,\d{3})+\.?\d*$/.test(t)) return true
  if (/^\d{3,}$/.test(t)) return true
  return false
}

/** Parse OCR text to integer cents using the shared parseCurrency utility. */
export function ocrTextToCents(text: string): number {
  return parseCurrency(text) ?? 0
}

// ── BBox utilities ────────────────────────────────────────────

function mergeBBox(a: OCRBBox, b: OCRBBox): OCRBBox {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  }
}

/** Compute overlap ratio of two bboxes (0–1, relative to smaller bbox area). */
function bboxOverlap(a: OCRBBox, b: OCRBBox): number {
  const overlapX = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  const overlapY = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  const overlapArea = overlapX * overlapY
  const areaA = (a.x1 - a.x0) * (a.y1 - a.y0)
  const areaB = (b.x1 - b.x0) * (b.y1 - b.y0)
  const minArea = Math.min(areaA, areaB)
  if (minArea === 0) return 0
  return overlapArea / minArea
}
