/**
 * Filing package compiler.
 *
 * Orchestrates: rules engine → PDF fillers → assembled multi-page PDF.
 *
 * IRS attachment sequence order:
 *   Form 1040 (00) → Schedule A (07) → Schedule B (08)
 *   → Schedule D (12) → Form 8949 (12A)
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn } from '../model/types'
import type { FormTemplates, CompiledForms, FormSummary, ReturnSummary } from './types'
import { computeForm1040 } from '../rules/2025/form1040'
import type { Form1040Result } from '../rules/2025/form1040'
import { computeScheduleB } from '../rules/2025/scheduleB'
import { fillForm1040 } from './fillers/form1040Filler'
import { fillScheduleA } from './fillers/scheduleAFiller'
import { fillScheduleB } from './fillers/scheduleBFiller'
import { fillScheduleD } from './fillers/scheduleDFiller'
import { fillForm8949 } from './fillers/form8949Filler'
import { generateCoverSheet } from './fillers/coverSheet'

/**
 * Compile a complete filing package for a tax return.
 *
 * @param taxReturn  The input tax return data
 * @param templates  PDF template bytes for each form (loaded by caller)
 * @returns Assembled PDF bytes, forms list, and summary
 */
export async function compileFilingPackage(
  taxReturn: TaxReturn,
  templates: FormTemplates,
): Promise<CompiledForms> {
  // ── Run rules engine ──────────────────────────────────────
  const result = computeForm1040(taxReturn)
  const scheduleB = computeScheduleB(taxReturn)

  // ── Determine which forms are needed ──────────────────────
  const needsScheduleA = result.scheduleA !== null
  const needsScheduleB = scheduleB.required
  const needsScheduleD = result.scheduleD !== null
  const needsForm8949 = needsScheduleD &&
    result.scheduleD!.form8949.categories.length > 0

  // ── Fill forms ─────────────────────────────────────────────
  const filledDocs: Array<{ doc: PDFDocument; summary: FormSummary }> = []

  // Form 1040 (sequence 00)
  const f1040Doc = await fillForm1040(templates.f1040, taxReturn, result)
  filledDocs.push({
    doc: f1040Doc,
    summary: { formId: 'Form 1040', sequenceNumber: '00', pageCount: f1040Doc.getPageCount() },
  })

  // Schedule A (sequence 07)
  if (needsScheduleA) {
    const schADoc = await fillScheduleA(templates.f1040sa, taxReturn, result.scheduleA!)
    filledDocs.push({
      doc: schADoc,
      summary: { formId: 'Schedule A', sequenceNumber: '07', pageCount: schADoc.getPageCount() },
    })
  }

  // Schedule B (sequence 08)
  if (needsScheduleB) {
    const schBDoc = await fillScheduleB(templates.f1040sb, taxReturn, scheduleB)
    filledDocs.push({
      doc: schBDoc,
      summary: { formId: 'Schedule B', sequenceNumber: '08', pageCount: schBDoc.getPageCount() },
    })
  }

  // Schedule D (sequence 12)
  if (needsScheduleD) {
    const schDDoc = await fillScheduleD(templates.f1040sd, taxReturn, result.scheduleD!)
    filledDocs.push({
      doc: schDDoc,
      summary: { formId: 'Schedule D', sequenceNumber: '12', pageCount: schDDoc.getPageCount() },
    })
  }

  // Form 8949 (sequence 12A) — one per category
  if (needsForm8949) {
    for (const cat of result.scheduleD!.form8949.categories) {
      const f8949Doc = await fillForm8949(templates.f8949, taxReturn, cat)
      filledDocs.push({
        doc: f8949Doc,
        summary: {
          formId: `Form 8949 (${cat.category})`,
          sequenceNumber: '12A',
          pageCount: f8949Doc.getPageCount(),
        },
      })
    }
  }

  // ── Build summary ──────────────────────────────────────────
  const summary = buildSummary(taxReturn, result)
  const formsIncluded = filledDocs.map(f => f.summary)

  // ── Generate cover sheet ───────────────────────────────────
  const coverDoc = await generateCoverSheet(taxReturn, summary, formsIncluded)

  // ── Assemble all into single PDF ───────────────────────────
  const finalDoc = await PDFDocument.create()

  // Cover sheet first
  const coverPages = await finalDoc.copyPages(coverDoc, coverDoc.getPageIndices())
  for (const page of coverPages) finalDoc.addPage(page)

  // Then all forms in attachment sequence order
  for (const { doc } of filledDocs) {
    const pages = await finalDoc.copyPages(doc, doc.getPageIndices())
    for (const page of pages) finalDoc.addPage(page)
  }

  const pdfBytes = await finalDoc.save()

  return {
    pdfBytes: new Uint8Array(pdfBytes),
    formsIncluded,
    summary,
  }
}

function buildSummary(taxReturn: TaxReturn, result: Form1040Result): ReturnSummary {
  return {
    taxYear: taxReturn.taxYear,
    filingStatus: taxReturn.filingStatus,
    taxpayerName: `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`,
    agi: result.line11.amount,
    totalTax: result.line24.amount,
    totalPayments: result.line33.amount,
    refund: result.line34.amount,
    amountOwed: result.line37.amount,
  }
}
