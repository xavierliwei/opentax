/**
 * Schedule SE (Self-Employment Tax) — PDF filler.
 *
 * Fills the Short Schedule SE (Section A) from the ScheduleSEResult
 * computed by the rules engine.
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../../model/types'
import type { ScheduleSEResult } from '../../rules/2025/scheduleSE'
import { SCHSE_HEADER, SCHSE_LINES } from '../mappings/scheduleSEFields'
import { setTextField, setDollarField, formatSSN } from '../helpers'

export async function fillScheduleSE(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  result: ScheduleSEResult,
  options: { flatten?: boolean } = {},
): Promise<PDFDocument> {
  const { flatten = true } = options
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // ── Header ──────────────────────────────────────────────────
  setTextField(form, SCHSE_HEADER.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, SCHSE_HEADER.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // ── Section A — Short Schedule SE ────────────────────────────
  // Line 1a — Net farm profit (always 0 — farm income not supported)
  // Line 1b — not used directly; we populate line 2
  setDollarField(form, SCHSE_LINES.line2, result.line2.amount)
  setDollarField(form, SCHSE_LINES.line3, result.line3.amount)
  setDollarField(form, SCHSE_LINES.line4a, result.line4a.amount)
  setDollarField(form, SCHSE_LINES.line4b, result.line4b.amount)
  setDollarField(form, SCHSE_LINES.line5, result.line5.amount)
  setDollarField(form, SCHSE_LINES.line6, result.line6.amount)

  // Line 12 — Deductible half of SE tax (50%)
  setDollarField(form, SCHSE_LINES.line12, result.deductibleHalf.amount)

  if (flatten) form.flatten()
  return pdfDoc
}
