/**
 * Integration tests for the filing package compiler.
 *
 * Tests the full pipeline: TaxReturn → rules → PDF filling → assembly.
 * Uses real IRS PDF templates from public/forms/.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'
import { compileFilingPackage } from '../../src/forms/compiler'
import type { FormTemplates } from '../../src/forms/types'
import {
  simpleW2Return,
  w2WithInvestmentsReturn,
  mixedTradesReturn,
  itemizedDeductionReturn,
  activeTraderReturn,
  allCategoriesReturn,
  rentalPropertyReturn,
  scheduleCProfitReturn,
  scheduleCLossReturn,
  w2PlusSideBizReturn,
  multipleScheduleCReturn,
} from '../fixtures/returns'
import { cents } from '../../src/model/traced'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { computeScheduleB } from '../../src/rules/2025/scheduleB'

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
  }
})

// ── Helper: extract text fields from a non-flattened PDF ─────

async function getFieldValue(pdfBytes: Uint8Array, fieldName: string): Promise<string | undefined> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const form = doc.getForm()
  try {
    return form.getTextField(fieldName).getText() ?? undefined
  } catch {
    return undefined
  }
}

// ── Tests ────────────────────────────────────────────────────

describe('compileFilingPackage', () => {
  it('compiles a simple W-2 return', async () => {
    const taxReturn = simpleW2Return()
    // Give the fixture a real name/SSN for testing
    taxReturn.taxpayer.firstName = 'John'
    taxReturn.taxpayer.lastName = 'Doe'
    taxReturn.taxpayer.ssn = '123456789'
    taxReturn.taxpayer.address = {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip: '90210',
    }

    const result = await compileFilingPackage(taxReturn, templates)

    // Should produce valid PDF bytes
    expect(result.pdfBytes).toBeInstanceOf(Uint8Array)
    expect(result.pdfBytes.length).toBeGreaterThan(0)

    // Should include only Form 1040 (no schedules needed)
    expect(result.formsIncluded).toHaveLength(1)
    expect(result.formsIncluded[0].formId).toBe('Form 1040')

    // Summary should match rules engine
    const expected = computeForm1040(taxReturn)
    expect(result.summary.agi).toBe(expected.line11.amount)
    expect(result.summary.totalTax).toBe(expected.line24.amount)
    expect(result.summary.totalPayments).toBe(expected.line33.amount)
    expect(result.summary.refund).toBe(expected.line34.amount)
    expect(result.summary.taxpayerName).toBe('John Doe')
    expect(result.summary.filingStatus).toBe('single')
    expect(result.summary.taxYear).toBe(2025)
  })

  it('can be loaded as a valid PDF', async () => {
    const taxReturn = simpleW2Return()
    taxReturn.taxpayer.firstName = 'Jane'
    taxReturn.taxpayer.lastName = 'Smith'
    taxReturn.taxpayer.ssn = '987654321'

    const result = await compileFilingPackage(taxReturn, templates)

    // Verify the output can be loaded by pdf-lib
    const doc = await PDFDocument.load(result.pdfBytes)
    // Cover sheet (1) + Form 1040 (2 pages) = 3
    expect(doc.getPageCount()).toBe(3)
  })

  it('includes Schedule B when interest/dividends exceed threshold', async () => {
    const taxReturn = w2WithInvestmentsReturn()
    taxReturn.taxpayer.firstName = 'Alice'
    taxReturn.taxpayer.lastName = 'Jones'
    taxReturn.taxpayer.ssn = '111223333'

    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Form 1040')
    expect(formIds).toContain('Schedule B')

    // Schedule D should be included (cap gain distributions)
    expect(formIds).toContain('Schedule D')
  })

  it('includes Schedule D and Form 8949 for capital transactions', async () => {
    const taxReturn = mixedTradesReturn()
    taxReturn.taxpayer.firstName = 'Bob'
    taxReturn.taxpayer.lastName = 'Trader'
    taxReturn.taxpayer.ssn = '444556666'

    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Form 1040')
    expect(formIds).toContain('Schedule D')
    // Should have Form 8949 for categories A and D
    expect(formIds).toContain('Form 8949 (A)')
    expect(formIds).toContain('Form 8949 (D)')
  })

  it('includes Schedule A when itemizing deductions', async () => {
    const taxReturn = itemizedDeductionReturn()
    taxReturn.taxpayer.firstName = 'Carol'
    taxReturn.taxpayer.lastName = 'Rich'
    taxReturn.taxpayer.ssn = '777889999'

    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Schedule A')
  })

  it('handles all 4 Form 8949 categories', async () => {
    const taxReturn = allCategoriesReturn()
    taxReturn.taxpayer.firstName = 'Dan'
    taxReturn.taxpayer.lastName = 'Investor'
    taxReturn.taxpayer.ssn = '222334444'

    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Form 8949 (A)')
    expect(formIds).toContain('Form 8949 (B)')
    expect(formIds).toContain('Form 8949 (D)')
    expect(formIds).toContain('Form 8949 (E)')
  })

  it('produces multi-page Form 8949 for active trader', async () => {
    const taxReturn = activeTraderReturn()
    taxReturn.taxpayer.firstName = 'Eve'
    taxReturn.taxpayer.lastName = 'Active'
    taxReturn.taxpayer.ssn = '555667777'

    const result = await compileFilingPackage(taxReturn, templates)

    // 12 short-term trades → 2 pages of Form 8949 (A) (11 rows per page)
    const f8949A = result.formsIncluded.find(f => f.formId === 'Form 8949 (A)')
    expect(f8949A).toBeDefined()
    expect(f8949A!.pageCount).toBe(2)

    // 8 long-term trades → 1 page of Form 8949 (D)
    const f8949D = result.formsIncluded.find(f => f.formId === 'Form 8949 (D)')
    expect(f8949D).toBeDefined()
    expect(f8949D!.pageCount).toBe(1)
  })

  it('forms are in attachment sequence order', async () => {
    const taxReturn = itemizedDeductionReturn()
    // Add some trades so we get Schedule D + 8949
    taxReturn.capitalTransactions = [
      {
        id: 'tx-1',
        description: '100 sh TEST',
        dateAcquired: '2024-01-01',
        dateSold: '2025-06-01',
        proceeds: cents(5000),
        adjustedBasis: cents(3000),
        reportedBasis: cents(3000),
        gainLoss: cents(2000),
        adjustmentCode: null,
        adjustmentAmount: 0,
        washSaleLossDisallowed: 0,
        longTerm: true,
        category: 'D',
        source1099BId: '1099b-tx-1',
      },
    ]
    // Also need interest to get Schedule B
    taxReturn.form1099INTs = [
      {
        id: 'int-1',
        payerName: 'Big Bank',
        box1: cents(2000),
        box2: 0,
        box3: 0,
        box4: 0,
        box8: 0,
      },
    ]
    taxReturn.taxpayer.firstName = 'Frank'
    taxReturn.taxpayer.lastName = 'Full'
    taxReturn.taxpayer.ssn = '888990000'

    const result = await compileFilingPackage(taxReturn, templates)

    const seqNumbers = result.formsIncluded.map(f => f.sequenceNumber)
    // Verify attachment sequence order: 00, 07, 08, 12, 12A
    for (let i = 1; i < seqNumbers.length; i++) {
      expect(seqNumbers[i] >= seqNumbers[i - 1]).toBe(true)
    }
  })

  it('includes Schedule E when rental properties exist', async () => {
    const taxReturn = rentalPropertyReturn()
    taxReturn.taxpayer.firstName = 'Helen'
    taxReturn.taxpayer.lastName = 'Landlord'
    taxReturn.taxpayer.ssn = '666778888'

    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Schedule E')
    expect(formIds).toContain('Schedule 1')

    // Schedule E should be in correct sequence order (13)
    const schE = result.formsIncluded.find(f => f.formId === 'Schedule E')
    expect(schE).toBeDefined()
    expect(schE!.sequenceNumber).toBe('13')
    expect(schE!.pageCount).toBe(2) // Schedule E has 2 pages

    // Summary should reflect rental income in AGI
    const expected = computeForm1040(taxReturn)
    expect(result.summary.agi).toBe(expected.line11.amount)
  })

  it('summary has correct refund amount for overpayment', async () => {
    const taxReturn = simpleW2Return() // $75K wages, $8K withholding
    taxReturn.taxpayer.firstName = 'Grace'
    taxReturn.taxpayer.lastName = 'Refund'
    taxReturn.taxpayer.ssn = '333445555'

    const result = await compileFilingPackage(taxReturn, templates)

    // With $75K single, withholding of $8K should result in refund
    const expected = computeForm1040(taxReturn)
    if (expected.line34.amount > 0) {
      expect(result.summary.refund).toBe(expected.line34.amount)
      expect(result.summary.amountOwed).toBe(0)
    } else {
      expect(result.summary.amountOwed).toBe(expected.line37.amount)
      expect(result.summary.refund).toBe(0)
    }
  })

  // ── Schedule C / SE Tests ─────────────────────────────────────

  it('includes Schedule C, SE, Schedule 1, and Schedule 2 for profitable sole proprietor', async () => {
    const taxReturn = scheduleCProfitReturn()
    taxReturn.taxpayer.firstName = 'Ian'
    taxReturn.taxpayer.lastName = 'Freelancer'
    taxReturn.taxpayer.ssn = '111222333'

    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Schedule C')
    expect(formIds).toContain('Schedule SE')
    expect(formIds).toContain('Schedule 1')   // C income flows through Sch 1
    expect(formIds).toContain('Schedule 2')   // SE tax flows through Sch 2

    // Schedule C should have correct sequence number
    const schC = result.formsIncluded.find(f => f.formId === 'Schedule C')
    expect(schC).toBeDefined()
    expect(schC!.sequenceNumber).toBe('09')

    // Schedule SE should have correct sequence number
    const schSE = result.formsIncluded.find(f => f.formId === 'Schedule SE')
    expect(schSE).toBeDefined()
    expect(schSE!.sequenceNumber).toBe('17')

    // Summary should include Schedule C income in AGI
    const expected = computeForm1040(taxReturn)
    expect(result.summary.agi).toBe(expected.line11.amount)
  })

  it('includes Schedule C but not SE when business has a net loss', async () => {
    const taxReturn = scheduleCLossReturn()
    taxReturn.taxpayer.firstName = 'Jill'
    taxReturn.taxpayer.lastName = 'Startup'
    taxReturn.taxpayer.ssn = '444555666'

    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Schedule C')
    expect(formIds).not.toContain('Schedule SE')  // No SE tax on losses
    expect(formIds).toContain('Schedule 1')       // Loss flows through Sch 1
  })

  it('includes Schedule C/SE for W-2 worker with side business', async () => {
    const taxReturn = w2PlusSideBizReturn()
    taxReturn.taxpayer.firstName = 'Kevin'
    taxReturn.taxpayer.lastName = 'Moonlighter'
    taxReturn.taxpayer.ssn = '777888999'

    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).toContain('Form 1040')
    expect(formIds).toContain('Schedule C')
    expect(formIds).toContain('Schedule SE')
    expect(formIds).toContain('Schedule 1')
    expect(formIds).toContain('Schedule 2')

    // AGI should include both W-2 wages and Schedule C income
    const expected = computeForm1040(taxReturn)
    expect(result.summary.agi).toBe(expected.line11.amount)
    expect(result.summary.agi).toBeGreaterThan(cents(85000))
  })

  it('includes separate Schedule C for each business', async () => {
    const taxReturn = multipleScheduleCReturn()
    taxReturn.taxpayer.firstName = 'Lisa'
    taxReturn.taxpayer.lastName = 'Multi'
    taxReturn.taxpayer.ssn = '111333555'

    const result = await compileFilingPackage(taxReturn, templates)

    const schCForms = result.formsIncluded.filter(f => f.formId.startsWith('Schedule C'))
    expect(schCForms).toHaveLength(2)
    expect(schCForms[0].formId).toBe('Schedule C (Consulting Co)')
    expect(schCForms[1].formId).toBe('Schedule C (Design Studio)')
    // Both should have sequence 09
    expect(schCForms[0].sequenceNumber).toBe('09')
    expect(schCForms[1].sequenceNumber).toBe('09')
  })

  it('Schedule C/SE forms are in correct attachment sequence order', async () => {
    const taxReturn = scheduleCProfitReturn()
    taxReturn.taxpayer.firstName = 'Mark'
    taxReturn.taxpayer.lastName = 'Order'
    taxReturn.taxpayer.ssn = '999888777'

    const result = await compileFilingPackage(taxReturn, templates)

    const seqNumbers = result.formsIncluded.map(f => f.sequenceNumber)
    // Verify ascending order
    for (let i = 1; i < seqNumbers.length; i++) {
      expect(seqNumbers[i] >= seqNumbers[i - 1]).toBe(true)
    }

    // Schedule C (09) should appear after Schedule 1 (02) and before Schedule SE (17)
    const schCIdx = result.formsIncluded.findIndex(f => f.formId === 'Schedule C')
    const schSEIdx = result.formsIncluded.findIndex(f => f.formId === 'Schedule SE')
    expect(schCIdx).toBeLessThan(schSEIdx)
  })

  it('does not include Schedule C when no businesses exist', async () => {
    const taxReturn = simpleW2Return()
    taxReturn.taxpayer.firstName = 'No'
    taxReturn.taxpayer.lastName = 'Business'
    taxReturn.taxpayer.ssn = '000111222'

    const result = await compileFilingPackage(taxReturn, templates)

    const formIds = result.formsIncluded.map(f => f.formId)
    expect(formIds).not.toContain('Schedule C')
    expect(formIds).not.toContain('Schedule SE')
  })
})
