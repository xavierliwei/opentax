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

function emptyResult(error: string): PdfParseOutput {
  return {
    transactions: [],
    warnings: [],
    errors: [error],
    rowCounts: { total: 0, parsed: 0, skipped: 0 },
    form1099DIVs: [],
    form1099INTs: [],
    brokerName: '',
  }
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

  // ── Detect unsupported form types before routing to a parser ──
  if (firstPageText.includes('1099-R') || firstPageText.includes('DISTRIBUTION CODE')) {
    return emptyResult('This PDF is a 1099-R (retirement distributions). 1099-R support is not yet available — please enter it manually or check back later.')
  }
  if (firstPageText.includes('1099-NEC') || firstPageText.includes('NONEMPLOYEE COMPENSATION')) {
    return emptyResult('This PDF is a 1099-NEC (non-employee compensation). 1099-NEC support is not yet available.')
  }

  // ── Route to broker-specific parsers ──
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
  if (result.transactions.length === 0 && result.errors.length === 0) {
    result.errors.push('Could not detect a supported broker or form type in this PDF. Supported formats: Fidelity and Robinhood consolidated 1099.')
  }
  return {
    ...result,
    brokerName: 'Unknown Broker',
    form1099DIVs: [],
    form1099INTs: [],
  }
}
