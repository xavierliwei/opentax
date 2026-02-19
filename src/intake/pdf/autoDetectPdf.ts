/**
 * PDF broker auto-detection.
 *
 * Scans the first page of a PDF for broker-specific keywords and routes
 * to the appropriate parser. Returns a ConsolidatedParseResult so callers
 * get 1099-B, 1099-DIV, and 1099-INT data in a single pass.
 */

import type { ConsolidatedParseResult } from '../csv/types'
import { ensureWorker, extractItems } from './pdfUtils'
import { parseFidelityPdf } from './fidelityPdfParser'
import { parseRobinhoodPdf } from './robinhoodPdfParser'

export interface PdfParseOutput extends ConsolidatedParseResult {
  brokerName: string
}

export async function autoDetectPdfBroker(data: ArrayBuffer): Promise<PdfParseOutput> {
  await ensureWorker()

  // PDF.js transfers (detaches) the ArrayBuffer, so we must clone it
  // before the detection scan so the actual parser gets a usable copy.
  const detectionCopy = data.slice(0)

  // Scan first-page text for broker identification
  const items = await extractItems(detectionCopy)
  const firstPageText = items
    .filter((it) => it.page === 1)
    .map((it) => it.str)
    .join(' ')
    .toUpperCase()

  if (firstPageText.includes('FIDELITY') || firstPageText.includes('NATIONAL FINANCIAL SERVICES')) {
    const result = await parseFidelityPdf(data)
    return { ...result, brokerName: 'Fidelity' }
  }

  if (firstPageText.includes('ROBINHOOD')) {
    const result = await parseRobinhoodPdf(data)
    return {
      ...result,
      brokerName: 'Robinhood',
      form1099DIVs: [],
      form1099INTs: [],
    }
  }

  // Unknown broker — attempt Robinhood parser as fallback (original behavior)
  const result = await parseRobinhoodPdf(data)
  return {
    ...result,
    brokerName: 'Unknown Broker',
    form1099DIVs: [],
    form1099INTs: [],
  }
}
