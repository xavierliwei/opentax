/**
 * Filing package compiler.
 *
 * Orchestrates: rules engine → PDF fillers → assembled multi-page PDF.
 *
 * IRS attachment sequence order:
 *   Form 1040 (00) → Schedule 1 (02) → Schedule 2 (05) → Schedule 3 (06)
 *   → Schedule A (07) → Form 4952 (10) → Schedule B (08) → Schedule C (09)
 *   → Schedule D (12) → Form 8949 (12A) → Schedule E (13) → Schedule SE (17)
 *   → Form 8863 (18) → Form 1116 (19) → Form 2441 (21) → Form 5695 (27)
 *   → Form 6251 (32) → Form 8812 (47) → Form 8606 (48)
 *   → Form 8889 (52) → Form 8880 (54) → Form 8995 (55) / Form 8995-A (55A)
 *   → Form 8959 (63) → Form 8960 (64) → Form 8582 (88)
 */

import { PDFDocument } from 'pdf-lib'
import type { TaxReturn, SupportedStateCode } from '../model/types'
import type { FormTemplates, CompiledForms, FormSummary, ReturnSummary, StatePackage } from './types'
import type { StateFormTemplates } from './stateCompiler'
import { computeForm1040 } from '../rules/2025/form1040'
import type { Form1040Result } from '../rules/2025/form1040'
import { computeForm1040NR, form1040NRToForm1040Compat } from '../rules/2025/form1040NR'
import { fillForm1040NR } from './fillers/form1040NRFiller'
import { computeScheduleB } from '../rules/2025/scheduleB'
import { getStateModule } from '../rules/stateRegistry'
import { getStateFormCompiler } from './stateFormRegistry'
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
import { fillForm1116 } from './fillers/form1116Filler'
import { fillScheduleE } from './fillers/scheduleEFiller'
import { fillScheduleC } from './fillers/scheduleCFiller'
import { fillForm8829 } from './fillers/form8829Filler'
import { fillScheduleSE } from './fillers/scheduleSEFiller'
import { fillForm8582 } from './fillers/form8582Filler'
import { fillForm8606 } from './fillers/form8606Filler'
import { fillForm8995 } from './fillers/form8995Filler'
import { fillForm8995A } from './fillers/form8995aFiller'
import { fillForm2441 } from './fillers/form2441Filler'
import { fillForm4952 } from './fillers/form4952Filler'
import { fillForm5695 } from './fillers/form5695Filler'
import { fillForm8880 } from './fillers/form8880Filler'
import { fillForm8959 } from './fillers/form8959Filler'
import { fillForm8960 } from './fillers/form8960Filler'
import { generateCoverSheet } from './fillers/coverSheet'
import { tracedZero } from '../model/traced'
import { validateComputeResult, validateCompilerOutput, runAllGates } from '../rules/qualityGates'
import type { GateResult } from '../rules/qualityGates'

/**
 * Compile a complete filing package for a tax return.
 *
 * @param taxReturn       The input tax return data
 * @param templates       PDF template bytes for each federal form (loaded by caller)
 * @param stateTemplates  Optional state form templates keyed by state code
 * @returns Assembled PDF bytes, forms list, summary, and per-state packages
 */
export async function compileFilingPackage(
  taxReturn: TaxReturn,
  templates: FormTemplates,
  stateTemplates?: Map<SupportedStateCode, StateFormTemplates>,
): Promise<CompiledForms> {
  // ── Run rules engine ──────────────────────────────────────
  const isNRA = taxReturn.isNonresidentAlien === true
  const nrResult = isNRA ? computeForm1040NR(taxReturn) : null
  const result = isNRA ? form1040NRToForm1040Compat(nrResult!) : computeForm1040(taxReturn)
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
    result.studentLoanDeduction !== null ||
    result.educatorExpensesResult !== null ||
    result.seSepSimpleResult !== null ||
    result.seHealthInsuranceResult !== null

  const needsForm2441 =
    result.dependentCareCredit !== null && result.dependentCareCredit.creditAmount > 0

  const needsForm4952 =
    result.scheduleA !== null &&
    (result.scheduleA.line9.amount > 0 || result.scheduleA.investmentInterestCarryforward.amount > 0)

  const needsForm5695 =
    result.energyCredit !== null && result.energyCredit.totalCredit > 0

  const needsForm8880 =
    result.saversCredit !== null && result.saversCredit.creditAmount > 0

  const needsForm8959 =
    result.additionalMedicareTaxResult !== null && result.additionalMedicareTaxResult.additionalTax > 0

  const needsForm8960 =
    result.niitResult !== null && result.niitResult.niitAmount > 0

  const needsSchedule2 =
    (result.amtResult !== null && result.amtResult.amt > 0) ||
    (result.hsaResult !== null && (result.hsaResult.distributionPenalty + result.hsaResult.excessPenalty) > 0) ||
    (result.scheduleSEResult !== null && result.scheduleSEResult.totalSETax > 0) ||
    needsForm8959 || needsForm8960

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

  const needsScheduleC = result.scheduleCResult !== null &&
    result.scheduleCResult.businesses.length > 0

  // Form 8829 is needed for regular method home office deductions
  const needsForm8829 = result.form8829Results.length > 0 &&
    result.form8829Results.some(r => r.method === 'regular' && r.deduction > 0)

  const needsScheduleSE = result.scheduleSEResult !== null &&
    result.scheduleSEResult.totalSETax > 0

  const needsForm1116 =
    result.foreignTaxCreditResult !== null &&
    result.foreignTaxCreditResult.applicable &&
    !result.foreignTaxCreditResult.directCreditElection

  const needsForm8582 =
    result.form8582Result !== null && result.form8582Result.required

  const needsForm8606 =
    result.form8606Result !== null

  const needsForm8889 = result.hsaResult !== null

  // Form 8995 (simplified) vs Form 8995-A (above-threshold):
  // Include when QBI deduction is claimed (line 13 > 0) OR when the computation
  // was triggered (qbiResult exists) — even if deduction is $0 due to limitations,
  // the form documents why.
  const needsForm8995 =
    result.qbiResult !== null && result.qbiResult.simplifiedPath
  const needsForm8995A =
    result.qbiResult !== null && !result.qbiResult.simplifiedPath

  // ── Fill forms (in IRS attachment sequence order) ──────────
  const filledDocs: Array<{ doc: PDFDocument; summary: FormSummary }> = []

  // Form 1040 or Form 1040-NR (sequence 00)
  if (isNRA && nrResult) {
    const f1040NRDoc = await fillForm1040NR(taxReturn, nrResult)
    filledDocs.push({
      doc: f1040NRDoc,
      summary: { formId: 'Form 1040-NR', sequenceNumber: '00', pageCount: f1040NRDoc.getPageCount() },
    })
  } else {
    const f1040Doc = await fillForm1040(templates.f1040, taxReturn, result)
    filledDocs.push({
      doc: f1040Doc,
      summary: { formId: 'Form 1040', sequenceNumber: '00', pageCount: f1040Doc.getPageCount() },
    })
  }

  // Schedule 1 (sequence 02)
  if (needsSchedule1) {
    const sch1Doc = await fillSchedule1(
      templates.f1040s1, taxReturn,
      result.schedule1 ?? { line1: tracedZero('sch1-1'), line2a: tracedZero('sch1-2a'), line3: tracedZero('sch1-3'), line5: tracedZero('sch1-5'), line7: tracedZero('sch1-7'), line8z: tracedZero('sch1-8z'), line10: tracedZero('sch1-10'), line15: tracedZero('sch1-15') },
      result.iraDeduction,
      result.hsaResult,
      result.studentLoanDeduction,
      result.educatorExpensesResult,
      result.seSepSimpleResult,
      result.seHealthInsuranceResult,
      result.scheduleSEResult?.deductibleHalfCents ?? 0,
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
      result.scheduleSEResult,
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

  // Form 4952 (sequence 10) — Investment Interest Expense Deduction
  if (needsForm4952) {
    const f4952Doc = await fillForm4952(templates.f4952, taxReturn, result.scheduleA!)
    filledDocs.push({
      doc: f4952Doc,
      summary: { formId: 'Form 4952', sequenceNumber: '10', pageCount: f4952Doc.getPageCount() },
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

  // Schedule C (sequence 09) — one per business
  if (needsScheduleC) {
    const businesses = taxReturn.scheduleCBusinesses ?? []
    for (let i = 0; i < result.scheduleCResult!.businesses.length; i++) {
      const biz = result.scheduleCResult!.businesses[i]
      const bizInput = businesses[i]
      const schCDoc = await fillScheduleC(templates.f1040sc, taxReturn, bizInput, biz)
      filledDocs.push({
        doc: schCDoc,
        summary: {
          formId: businesses.length > 1
            ? `Schedule C (${biz.businessName})`
            : 'Schedule C',
          sequenceNumber: '09',
          pageCount: schCDoc.getPageCount(),
        },
      })
    }
  }

  // Form 8829 (sequence 66) — one per home office, only for regular method
  if (needsForm8829) {
    for (const f8829Result of result.form8829Results) {
      if (f8829Result.method !== 'regular' || f8829Result.deduction <= 0) continue
      const f8829Doc = await fillForm8829(taxReturn, f8829Result)
      const biz = (taxReturn.scheduleCBusinesses ?? []).find(b => b.id === f8829Result.scheduleCId)
      filledDocs.push({
        doc: f8829Doc,
        summary: {
          formId: biz ? `Form 8829 (${biz.businessName})` : 'Form 8829',
          sequenceNumber: '66',
          pageCount: f8829Doc.getPageCount(),
        },
      })
    }
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

  // Schedule SE (sequence 17)
  if (needsScheduleSE) {
    const schSEDoc = await fillScheduleSE(templates.f1040sse, taxReturn, result.scheduleSEResult!)
    filledDocs.push({
      doc: schSEDoc,
      summary: { formId: 'Schedule SE', sequenceNumber: '17', pageCount: schSEDoc.getPageCount() },
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

  // Form 1116 (sequence 19)
  if (needsForm1116) {
    const f1116Doc = await fillForm1116(templates.f1116, taxReturn, result.foreignTaxCreditResult!)
    filledDocs.push({
      doc: f1116Doc,
      summary: { formId: 'Form 1116', sequenceNumber: '19', pageCount: f1116Doc.getPageCount() },
    })
  }

  // Form 2441 (sequence 21) — Child and Dependent Care Expenses
  if (needsForm2441) {
    const f2441Doc = await fillForm2441(templates.f2441, taxReturn, result.dependentCareCredit!)
    filledDocs.push({
      doc: f2441Doc,
      summary: { formId: 'Form 2441', sequenceNumber: '21', pageCount: f2441Doc.getPageCount() },
    })
  }

  // Form 5695 (sequence 27) — Residential Energy Credits
  if (needsForm5695) {
    const f5695Doc = await fillForm5695(templates.f5695, taxReturn, result.energyCredit!)
    filledDocs.push({
      doc: f5695Doc,
      summary: { formId: 'Form 5695', sequenceNumber: '27', pageCount: f5695Doc.getPageCount() },
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

  // Form 8606 (sequence 48)
  if (needsForm8606 && templates.f8606) {
    const f8606Doc = await fillForm8606(templates.f8606, taxReturn, result.form8606Result!)
    filledDocs.push({
      doc: f8606Doc,
      summary: { formId: 'Form 8606', sequenceNumber: '48', pageCount: f8606Doc.getPageCount() },
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

  // Form 8880 (sequence 54) — Saver's Credit
  if (needsForm8880) {
    const f8880Doc = await fillForm8880(templates.f8880, taxReturn, result.saversCredit!, result.line11.amount)
    filledDocs.push({
      doc: f8880Doc,
      summary: { formId: 'Form 8880', sequenceNumber: '54', pageCount: f8880Doc.getPageCount() },
    })
  }

  // Form 8582 (sequence 88) — Passive Activity Loss Limitations
  if (needsForm8582) {
    const f8582Doc = await fillForm8582(templates.f8582, taxReturn, result.form8582Result!)
    filledDocs.push({
      doc: f8582Doc,
      summary: { formId: 'Form 8582', sequenceNumber: '88', pageCount: f8582Doc.getPageCount() },
    })
  }

  // Form 8995 (sequence 55) — simplified QBI deduction
  if (needsForm8995) {
    const f8995Doc = await fillForm8995(taxReturn, result.qbiResult!, templates.f8995)
    filledDocs.push({
      doc: f8995Doc,
      summary: { formId: 'Form 8995', sequenceNumber: '55', pageCount: f8995Doc.getPageCount() },
    })
  }

  // Form 8995-A (sequence 55A) — above-threshold QBI deduction
  if (needsForm8995A) {
    const f8995ADoc = await fillForm8995A(taxReturn, result.qbiResult!, templates.f8995a)
    filledDocs.push({
      doc: f8995ADoc,
      summary: { formId: 'Form 8995-A', sequenceNumber: '55A', pageCount: f8995ADoc.getPageCount() },
    })
  }

  // Form 8959 (sequence 63) — Additional Medicare Tax
  if (needsForm8959) {
    const f8959Doc = await fillForm8959(templates.f8959, taxReturn, result.additionalMedicareTaxResult!)
    filledDocs.push({
      doc: f8959Doc,
      summary: { formId: 'Form 8959', sequenceNumber: '63', pageCount: f8959Doc.getPageCount() },
    })
  }

  // Form 8960 (sequence 64) — Net Investment Income Tax
  if (needsForm8960) {
    const f8960Doc = await fillForm8960(templates.f8960, taxReturn, result.niitResult!, result.line11.amount)
    filledDocs.push({
      doc: f8960Doc,
      summary: { formId: 'Form 8960', sequenceNumber: '64', pageCount: f8960Doc.getPageCount() },
    })
  }

  // ── Compile state forms ─────────────────────────────────────
  const statePackages: StatePackage[] = []
  const stateGateResults: GateResult[] = []

  for (const config of taxReturn.stateReturns ?? []) {
    const stateCode = config.stateCode
    const compiler = getStateFormCompiler(stateCode)
    const stateModule = getStateModule(stateCode)
    if (!compiler || !stateModule) continue

    // Compute state result
    const stateResult = stateModule.compute(taxReturn, result, config)

    // Quality gate: validate compute result
    stateGateResults.push(validateComputeResult(stateResult, config))

    // Get state templates (may be empty — programmatic generators don't need them)
    const stateTempl = stateTemplates?.get(stateCode) ?? { templates: new Map() }

    const compiled = await compiler.compile(taxReturn, stateResult, stateTempl)

    // Quality gate: validate compiler output
    stateGateResults.push(validateCompilerOutput(compiled, stateCode))

    // Save individual state PDF bytes for separate download
    const statePdfBytes = await compiled.doc.save()
    statePackages.push({
      stateCode,
      label: stateResult.formLabel,
      pdfBytes: new Uint8Array(statePdfBytes),
      forms: compiled.forms,
    })

    // Also add to the combined assembly
    for (const form of compiled.forms) {
      filledDocs.push({ doc: compiled.doc, summary: form })
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

  // Federal forms in attachment sequence order
  for (const { doc } of filledDocs) {
    const pages = await finalDoc.copyPages(doc, doc.getPageIndices())
    for (const page of pages) finalDoc.addPage(page)
  }

  const pdfBytes = await finalDoc.save()

  // Collect quality gate result
  const qualityGates = stateGateResults.length > 0
    ? runAllGates(stateGateResults)
    : undefined

  return {
    pdfBytes: new Uint8Array(pdfBytes),
    formsIncluded,
    summary,
    statePackages,
    qualityGates,
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
