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
  makeW2,
  make1099DIV,
  make1099INT,
} from '../fixtures/returns'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
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
    f1116: new Uint8Array(readFileSync(join(dir, 'f1116.pdf'))),
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

  // ── Form 1116 (Foreign Tax Credit) inclusion tests ──────────

  it('includes Form 1116 when foreign taxes exceed direct credit threshold', async () => {
    // Single filer with $400 foreign tax (> $300 threshold) → Form 1116 required
    const taxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Tech Corp',
          box1: cents(80000),
          box2: cents(12000),
        }),
      ],
      form1099DIVs: [
        make1099DIV({
          id: 'div-1',
          payerName: 'Intl Fund',
          box1a: cents(5000),
          box1b: cents(3000),
          box7: cents(400),     // $400 foreign tax (> $300 threshold)
          box8: 'Various',
        }),
      ],
    }
    taxReturn.taxpayer.firstName = 'Ivy'
    taxReturn.taxpayer.lastName = 'Global'
    taxReturn.taxpayer.ssn = '111222333'

    const result = await compileFilingPackage(taxReturn, templates)
    const formIds = result.formsIncluded.map(f => f.formId)

    expect(formIds).toContain('Form 1116')
    expect(formIds).toContain('Schedule 3')

    // Form 1116 at seq 19 (after Form 8863 at seq 18)
    const f1116 = result.formsIncluded.find(f => f.formId === 'Form 1116')
    expect(f1116).toBeDefined()
    expect(f1116!.sequenceNumber).toBe('19')
    expect(f1116!.pageCount).toBe(2)
  })

  it('excludes Form 1116 when foreign taxes are under direct credit threshold', async () => {
    // Single filer with $200 foreign tax (≤ $300 threshold) → direct credit election
    const taxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Tech Corp',
          box1: cents(80000),
          box2: cents(12000),
        }),
      ],
      form1099DIVs: [
        make1099DIV({
          id: 'div-1',
          payerName: 'Intl Fund',
          box1a: cents(3000),
          box1b: cents(2000),
          box7: cents(200),     // $200 foreign tax (≤ $300 threshold)
          box8: 'Japan',
        }),
      ],
    }
    taxReturn.taxpayer.firstName = 'Jack'
    taxReturn.taxpayer.lastName = 'Modest'
    taxReturn.taxpayer.ssn = '444555666'

    const result = await compileFilingPackage(taxReturn, templates)
    const formIds = result.formsIncluded.map(f => f.formId)

    // Form 1116 should NOT be included (direct credit election)
    expect(formIds).not.toContain('Form 1116')
    // Schedule 3 should still be included (FTC goes to line 1)
    expect(formIds).toContain('Schedule 3')
  })

  it('excludes Form 1116 when no foreign taxes paid', async () => {
    const taxReturn = simpleW2Return()
    taxReturn.taxpayer.firstName = 'Kim'
    taxReturn.taxpayer.lastName = 'Domestic'
    taxReturn.taxpayer.ssn = '777888999'

    const result = await compileFilingPackage(taxReturn, templates)
    const formIds = result.formsIncluded.map(f => f.formId)

    expect(formIds).not.toContain('Form 1116')
  })

  it('includes Form 1116 for MFJ with foreign taxes over $600 threshold', async () => {
    // MFJ with $700 foreign tax (> $600 MFJ threshold) → Form 1116 required
    const taxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj' as const,
      spouse: {
        firstName: 'Pat',
        lastName: 'Global',
        ssn: '999888777',
      },
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'BigCo',
          box1: cents(120000),
          box2: cents(20000),
        }),
      ],
      form1099DIVs: [
        make1099DIV({
          id: 'div-1',
          payerName: 'Global Equity Fund',
          box1a: cents(8000),
          box1b: cents(6000),
          box7: cents(500),    // $500
          box8: 'United Kingdom',
        }),
      ],
      form1099INTs: [
        make1099INT({
          id: 'int-1',
          payerName: 'Foreign Bank',
          box1: cents(2000),
          box6: cents(200),    // $200 → total $700 > $600 MFJ threshold
          box7: 'Switzerland',
        }),
      ],
    }
    taxReturn.taxpayer.firstName = 'Max'
    taxReturn.taxpayer.lastName = 'Global'
    taxReturn.taxpayer.ssn = '555666777'

    const result = await compileFilingPackage(taxReturn, templates)
    const formIds = result.formsIncluded.map(f => f.formId)

    expect(formIds).toContain('Form 1116')
    expect(formIds).toContain('Schedule 3')
  })

  it('Form 1116 is in correct attachment sequence order', async () => {
    // Return with both Form 1116 and other forms
    const taxReturn = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Corp',
          box1: cents(90000),
          box2: cents(15000),
        }),
      ],
      form1099DIVs: [
        make1099DIV({
          id: 'div-1',
          payerName: 'Intl Fund',
          box1a: cents(6000),
          box1b: cents(4000),
          box7: cents(500),
          box8: 'Various',
        }),
      ],
    }
    taxReturn.taxpayer.firstName = 'Leo'
    taxReturn.taxpayer.lastName = 'Ordered'
    taxReturn.taxpayer.ssn = '888999000'

    const result = await compileFilingPackage(taxReturn, templates)

    const seqNumbers = result.formsIncluded.map(f => f.sequenceNumber)
    // All forms should be in non-decreasing sequence order
    for (let i = 1; i < seqNumbers.length; i++) {
      expect(seqNumbers[i] >= seqNumbers[i - 1]).toBe(true)
    }
  })
})
