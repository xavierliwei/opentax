/**
 * Tests for Form 8995 / Form 8995-A PDF generation and packet inclusion.
 *
 * Verifies:
 *   1. Form 8995 is included for below-threshold QBI (simplified path)
 *   2. Form 8995-A is included for above-threshold QBI
 *   3. Neither form is included when there is no QBI
 *   4. SSTB above-threshold produces Form 8995-A (even when deduction is $0)
 *   5. Correct attachment sequence numbers (55 / 55A)
 *   6. Generated PDFs are valid and loadable
 *   7. K-1 QBI triggers Form 8995 inclusion
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'
import { compileFilingPackage } from '../../src/forms/compiler'
import type { FormTemplates } from '../../src/forms/types'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import {
  simpleW2Return,
  qbiSimplifiedReturn,
  qbiK1SimplifiedReturn,
  qbiAboveThresholdReturn,
  qbiSSTBAboveThresholdReturn,
} from '../fixtures/returns'
import { fillForm8995 } from '../../src/forms/fillers/form8995Filler'
import { fillForm8995A } from '../../src/forms/fillers/form8995aFiller'

// ── Load PDF templates once ──────────────────────────────────

let templates: FormTemplates

beforeAll(() => {
  const dir = join(__dirname, '../../public/forms')
  templates = {
    f1040: new Uint8Array(readFileSync(join(dir, 'f1040.pdf'))),
    f1040sa: new Uint8Array(readFileSync(join(dir, 'f1040sa.pdf'))),
    f1040sb: new Uint8Array(readFileSync(join(dir, 'f1040sb.pdf'))),
    f1040sd: new Uint8Array(readFileSync(join(dir, 'f1040sd.pdf'))),
    f8949: new Uint8Array(readFileSync(join(dir, 'f8949.pdf'))),
    f1040s1: new Uint8Array(readFileSync(join(dir, 'f1040s1.pdf'))),
    f1040s2: new Uint8Array(readFileSync(join(dir, 'f1040s2.pdf'))),
    f1040s3: new Uint8Array(readFileSync(join(dir, 'f1040s3.pdf'))),
    f8812: new Uint8Array(readFileSync(join(dir, 'f8812.pdf'))),
    f8863: new Uint8Array(readFileSync(join(dir, 'f8863.pdf'))),
    f6251: new Uint8Array(readFileSync(join(dir, 'f6251.pdf'))),
    f8889: new Uint8Array(readFileSync(join(dir, 'f8889.pdf'))),
    f1040se: new Uint8Array(readFileSync(join(dir, 'f1040se.pdf'))),
    f1040sc: new Uint8Array(readFileSync(join(dir, 'f1040sc.pdf'))),
    f1040sse: new Uint8Array(readFileSync(join(dir, 'f1040sse.pdf'))),
    f1116: new Uint8Array(readFileSync(join(dir, 'f1116.pdf'))),
  }
})

// ── Packet inclusion tests ───────────────────────────────────

describe('QBI PDF packet inclusion', () => {
  it('does NOT include Form 8995 or 8995-A for a simple W-2 return', async () => {
    const taxReturn = simpleW2Return()
    taxReturn.taxpayer.firstName = 'John'
    taxReturn.taxpayer.lastName = 'Doe'
    taxReturn.taxpayer.ssn = '123456789'

    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).not.toContain('Form 8995')
    expect(formIds).not.toContain('Form 8995-A')
  })

  it('includes Form 8995 for below-threshold Schedule C QBI', async () => {
    const taxReturn = qbiSimplifiedReturn()
    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Form 8995')
    expect(formIds).not.toContain('Form 8995-A')

    // Verify sequence number
    const f8995 = result.formsIncluded.find(f => f.formId === 'Form 8995')
    expect(f8995).toBeDefined()
    expect(f8995!.sequenceNumber).toBe('55')
  })

  it('includes Form 8995 for K-1 QBI below threshold', async () => {
    const taxReturn = qbiK1SimplifiedReturn()
    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Form 8995')
    expect(formIds).not.toContain('Form 8995-A')
  })

  it('includes Form 8995-A for above-threshold QBI', async () => {
    const taxReturn = qbiAboveThresholdReturn()
    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Form 8995-A')
    expect(formIds).not.toContain('Form 8995')

    // Verify sequence number
    const f8995a = result.formsIncluded.find(f => f.formId === 'Form 8995-A')
    expect(f8995a).toBeDefined()
    expect(f8995a!.sequenceNumber).toBe('55A')
  })

  it('includes Form 8995-A for SSTB above-threshold (even when deduction is $0)', async () => {
    const taxReturn = qbiSSTBAboveThresholdReturn()
    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Form 8995-A')
    expect(formIds).not.toContain('Form 8995')
  })

  it('Form 8995/8995-A appears after Form 8889 in sequence order', async () => {
    const taxReturn = qbiSimplifiedReturn()
    const result = await compileFilingPackage(taxReturn, templates)

    const seqNumbers = result.formsIncluded.map(f => f.sequenceNumber)
    for (let i = 1; i < seqNumbers.length; i++) {
      expect(seqNumbers[i] >= seqNumbers[i - 1]).toBe(true)
    }
  })
})

// ── PDF validity tests ───────────────────────────────────────

describe('Form 8995 PDF generation', () => {
  it('generates a valid single-page PDF for simplified path', async () => {
    const taxReturn = qbiSimplifiedReturn()
    const f1040Result = computeForm1040(taxReturn)

    expect(f1040Result.qbiResult).not.toBeNull()
    expect(f1040Result.qbiResult!.simplifiedPath).toBe(true)

    const doc = await fillForm8995(taxReturn, f1040Result.qbiResult!)
    const bytes = await doc.save()

    // Should be valid PDF
    expect(bytes.length).toBeGreaterThan(0)
    const loaded = await PDFDocument.load(bytes)
    expect(loaded.getPageCount()).toBe(1)
  })

  it('includes correct QBI deduction amount', async () => {
    const taxReturn = qbiSimplifiedReturn()
    const f1040Result = computeForm1040(taxReturn)
    const qbiResult = f1040Result.qbiResult!

    expect(qbiResult.deductionAmount).toBeGreaterThan(0)
    expect(qbiResult.totalQBI).toBeGreaterThan(0)

    // Deduction should be min(20% of QBI, 20% of taxable income)
    expect(qbiResult.deductionAmount).toBeLessThanOrEqual(qbiResult.qbiComponent)
    expect(qbiResult.deductionAmount).toBeLessThanOrEqual(qbiResult.taxableIncomeComponent)
  })
})

describe('Form 8995-A PDF generation', () => {
  it('generates a valid PDF for above-threshold path', async () => {
    const taxReturn = qbiAboveThresholdReturn()
    const f1040Result = computeForm1040(taxReturn)

    expect(f1040Result.qbiResult).not.toBeNull()
    expect(f1040Result.qbiResult!.simplifiedPath).toBe(false)
    expect(f1040Result.qbiResult!.businessResults).not.toBeNull()
    expect(f1040Result.qbiResult!.businessResults!.length).toBeGreaterThan(0)

    const doc = await fillForm8995A(taxReturn, f1040Result.qbiResult!)
    const bytes = await doc.save()

    expect(bytes.length).toBeGreaterThan(0)
    const loaded = await PDFDocument.load(bytes)
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('generates a valid PDF for SSTB exclusion case', async () => {
    const taxReturn = qbiSSTBAboveThresholdReturn()
    const f1040Result = computeForm1040(taxReturn)
    const qbiResult = f1040Result.qbiResult!

    expect(qbiResult.simplifiedPath).toBe(false)
    expect(qbiResult.hasSSTB).toBe(true)

    const doc = await fillForm8995A(taxReturn, qbiResult)
    const bytes = await doc.save()

    expect(bytes.length).toBeGreaterThan(0)
    const loaded = await PDFDocument.load(bytes)
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('lists per-business results with W-2/UBIA limitations', async () => {
    const taxReturn = qbiAboveThresholdReturn()
    const f1040Result = computeForm1040(taxReturn)
    const qbiResult = f1040Result.qbiResult!

    // Should have 2 businesses (Schedule C + K-1)
    expect(qbiResult.businessResults).not.toBeNull()
    expect(qbiResult.businessResults!.length).toBe(2)

    // Each business should have wage limitation computed
    for (const biz of qbiResult.businessResults!) {
      expect(biz.wageLimitation).toBeGreaterThanOrEqual(0)
      expect(biz.deductibleQBI).toBeGreaterThanOrEqual(0)
    }
  })
})

// ── Full pipeline integration test ──────────────────────────

describe('QBI PDF full pipeline', () => {
  it('produces valid combined PDF with Form 8995 included', async () => {
    const taxReturn = qbiSimplifiedReturn()
    const result = await compileFilingPackage(taxReturn, templates)

    expect(result.pdfBytes).toBeInstanceOf(Uint8Array)
    expect(result.pdfBytes.length).toBeGreaterThan(0)

    // Verify final PDF is valid
    const doc = await PDFDocument.load(result.pdfBytes)
    expect(doc.getPageCount()).toBeGreaterThan(1)

    // Should include Form 1040 + Schedule 1 + Form 8995 at minimum
    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Form 1040')
    expect(formIds).toContain('Form 8995')
  })

  it('produces valid combined PDF with Form 8995-A included', async () => {
    const taxReturn = qbiAboveThresholdReturn()
    const result = await compileFilingPackage(taxReturn, templates)

    expect(result.pdfBytes).toBeInstanceOf(Uint8Array)
    expect(result.pdfBytes.length).toBeGreaterThan(0)

    const doc = await PDFDocument.load(result.pdfBytes)
    expect(doc.getPageCount()).toBeGreaterThan(1)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Form 1040')
    expect(formIds).toContain('Form 8995-A')
  })

  it('QBI deduction flows to Form 1040 Line 13', async () => {
    const taxReturn = qbiSimplifiedReturn()
    const f1040Result = computeForm1040(taxReturn)

    // Line 13 should be populated with QBI deduction
    expect(f1040Result.line13.amount).toBeGreaterThan(0)
    expect(f1040Result.qbiResult).not.toBeNull()
    expect(f1040Result.line13.amount).toBe(f1040Result.qbiResult!.deductionAmount)
  })
})
