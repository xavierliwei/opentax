/**
 * Shared PDF text extraction utilities.
 *
 * Used by both Robinhood and Fidelity PDF parsers to extract text items
 * from PDFs and group them into logical lines.
 */

import * as pdfjsLib from 'pdfjs-dist'
import rawWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// ── PDF.js worker setup ───────────────────────────────────────
//
// The worker file (.mjs) must be served with a JavaScript MIME type, but
// some static servers (including the OpenTax dev server) may not handle .mjs
// correctly. To work around this, we fetch the worker source and re-serve it
// via a blob URL with the correct MIME type, which is guaranteed to work.
// The blob URL is cached so the fetch only happens once per page load.

let _workerBlobUrl: string | null = null

export async function ensureWorker(): Promise<void> {
  if (_workerBlobUrl) return
  try {
    const res = await fetch(rawWorkerUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    _workerBlobUrl = URL.createObjectURL(
      new Blob([text], { type: 'application/javascript' }),
    )
  } catch {
    // Fall back to the direct URL — works when the server is configured correctly
    _workerBlobUrl = rawWorkerUrl
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = _workerBlobUrl
}

// ── Types ─────────────────────────────────────────────────────

export interface RawItem {
  str: string
  x: number
  y: number
  width: number
  page: number
}

export interface Line {
  items: RawItem[]
  /** Full text with single spaces inserted where column gaps occur */
  text: string
  y: number
  page: number
}

// ── PDF text extraction ───────────────────────────────────────

export async function extractItems(data: ArrayBuffer): Promise<RawItem[]> {
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const out: RawItem[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      out.push({
        str: item.str,
        x: item.transform[4],
        // Flip y so that y=0 is the top of the page
        y: viewport.height - item.transform[5],
        width: item.width,
        page: p,
      })
    }
  }

  return out
}

// ── Line grouping ─────────────────────────────────────────────

export function groupLines(items: RawItem[], yTolerance = 4): Line[] {
  // Sort: by page, then top-to-bottom (y), then left-to-right (x)
  const sorted = [...items].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page
    if (Math.abs(a.y - b.y) > yTolerance) return a.y - b.y
    return a.x - b.x
  })

  const lines: Line[] = []
  let group: RawItem[] = []

  for (const item of sorted) {
    const prev = group[group.length - 1]
    if (!prev || (item.page === prev.page && Math.abs(item.y - prev.y) <= yTolerance)) {
      group.push(item)
    } else {
      if (group.length > 0) lines.push(buildLine(group))
      group = [item]
    }
  }
  if (group.length > 0) lines.push(buildLine(group))
  return lines
}

export function buildLine(items: RawItem[]): Line {
  const sorted = [...items].sort((a, b) => a.x - b.x)
  const parts: string[] = []
  let prevRight = -Infinity

  for (const item of sorted) {
    // Insert a space if there's a visible gap between items (column boundary)
    if (prevRight > 0 && item.x > prevRight + 2) parts.push(' ')
    parts.push(item.str)
    prevRight = item.x + item.width
  }

  return {
    items: sorted,
    text: parts.join('').trim(),
    y: sorted[0].y,
    page: sorted[0].page,
  }
}
