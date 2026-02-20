/**
 * Filing package compiler.
 *
 * Orchestrates: rules engine → PDF fillers → assembled multi-page PDF.
 *
 * IRS attachment sequence order:
 *   Form 1040 (00) → Schedule 1 (02) → Schedule 2 (05) → Schedule 3 (06)
 *   → Schedule A (07) → Schedule B (08) → Schedule D (12)
 *   → Form 8949 (12A) → Schedule E (13) → Form 8863 (18) → Form 6251 (32)
 *   → Form 8812 (47) → Form 8889 (52)
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
import { fillSchedule1 } from './fillers/schedule1Filler'
import { fillSchedule2 } from './fillers/schedule2Filler'
import { fillSchedule3 } from './fillers/schedule3Filler'
import { fillForm8812 } from './fillers/form8812Filler'
import { fillForm8863 } from './fillers/form8863Filler'
import { fillForm6251 } from './fillers/form6251Filler'
import { fillForm8889 } from './fillers/form8889Filler'
import { fillScheduleE } from './fillers/scheduleEFiller'
import { generateCoverSheet } from './fillers/coverSheet'
import { tracedZero } from '../model/traced'

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

  const needsSchedule1 = result.schedule1 !== null ||
    result.iraDeduction !== null ||
    result.hsaResult !== null ||
    result.studentLoanDeduction !== null

  const needsSchedule2 =
    (result.amtResult !== null && result.amtResult.amt > 0) ||
    (result.hsaResult !== null && (result.hsaResult.distributionPenalty + result.hsaResult.excessPenalty) > 0)

  const needsSchedule3 =
    result.line20.amount > 0 ||
    (result.educationCredit !== null && result.educationCredit.aotcRefundable > 0)

  const needsForm8812 =
    result.childTaxCredit !== null &&
    (result.childTaxCredit.nonRefundableCredit + result.childTaxCredit.additionalCTC) > 0

  const needsForm8863 =
    result.educationCredit !== null &&
    (result.educationCredit.totalNonRefundable + result.educationCredit.totalRefundable) > 0

  const needsForm6251 =
    result.amtResult !== null && result.amtResult.amt > 0

  const needsScheduleE = result.scheduleE !== null

  const needsForm8889 = result.hsaResult !== null

  // ── Fill forms (in IRS attachment sequence order) ──────────
  const filledDocs: Array<{ doc: PDFDocument; summary: FormSummary }> = []

  // Form 1040 (sequence 00)
  const f1040Doc = await fillForm1040(templates.f1040, taxReturn, result)
  filledDocs.push({
    doc: f1040Doc,
    summary: { formId: 'Form 1040', sequenceNumber: '00', pageCount: f1040Doc.getPageCount() },
  })

  // Schedule 1 (sequence 02)
  if (needsSchedule1) {
    const sch1Doc = await fillSchedule1(
      templates.f1040s1, taxReturn,
      result.schedule1 ?? { line1: tracedZero('sch1-1'), line5: tracedZero('sch1-5'), line7: tracedZero('sch1-7'), line8z: tracedZero('sch1-8z'), line10: tracedZero('sch1-10') },
      result.iraDeduction,
      result.hsaResult,
      result.studentLoanDeduction,
    )
    filledDocs.push({
      doc: sch1Doc,
      summary: { formId: 'Schedule 1', sequenceNumber: '02', pageCount: sch1Doc.getPageCount() },
    })
  }

  // Schedule 2 (sequence 05)
  if (needsSchedule2) {
    const sch2Doc = await fillSchedule2(
      templates.f1040s2, taxReturn,
      result.amtResult,
      result.hsaResult,
    )
    filledDocs.push({
      doc: sch2Doc,
      summary: { formId: 'Schedule 2', sequenceNumber: '05', pageCount: sch2Doc.getPageCount() },
    })
  }

  // Schedule 3 (sequence 06)
  if (needsSchedule3) {
    const sch3Doc = await fillSchedule3(templates.f1040s3, taxReturn, result)
    filledDocs.push({
      doc: sch3Doc,
      summary: { formId: 'Schedule 3', sequenceNumber: '06', pageCount: sch3Doc.getPageCount() },
    })
  }

  // Schedule A (sequence 07)
  // Note: Schedule A is included whenever the user selects "itemized", even if
  // standard deduction is larger. This is intentional — the IRS requires Schedule A
  // to be filed if the taxpayer elects itemized, and it helps taxpayers see why
  // the standard deduction was more beneficial.
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

  // Schedule E (sequence 13)
  if (needsScheduleE) {
    const schEDoc = await fillScheduleE(templates.f1040se, taxReturn, result.scheduleE!)
    filledDocs.push({
      doc: schEDoc,
      summary: { formId: 'Schedule E', sequenceNumber: '13', pageCount: schEDoc.getPageCount() },
    })
  }

  // Form 8863 (sequence 18)
  if (needsForm8863) {
    const f8863Doc = await fillForm8863(templates.f8863, taxReturn, result.educationCredit!)
    filledDocs.push({
      doc: f8863Doc,
      summary: { formId: 'Form 8863', sequenceNumber: '18', pageCount: f8863Doc.getPageCount() },
    })
  }

  // Form 6251 (sequence 32)
  if (needsForm6251) {
    const f6251Doc = await fillForm6251(templates.f6251, taxReturn, result.amtResult!)
    filledDocs.push({
      doc: f6251Doc,
      summary: { formId: 'Form 6251', sequenceNumber: '32', pageCount: f6251Doc.getPageCount() },
    })
  }

  // Form 8812 (sequence 47)
  if (needsForm8812) {
    const f8812Doc = await fillForm8812(templates.f8812, taxReturn, result.childTaxCredit!)
    filledDocs.push({
      doc: f8812Doc,
      summary: { formId: 'Form 8812', sequenceNumber: '47', pageCount: f8812Doc.getPageCount() },
    })
  }

  // Form 8889 (sequence 52)
  if (needsForm8889) {
    const f8889Doc = await fillForm8889(templates.f8889, taxReturn, result.hsaResult!)
    filledDocs.push({
      doc: f8889Doc,
      summary: { formId: 'Form 8889', sequenceNumber: '52', pageCount: f8889Doc.getPageCount() },
    })
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
