/**
 * Tests for Form 1116 (Foreign Tax Credit) PDF filler.
 *
 * Verifies:
 *   - Field mapping correctness (key fields are populated)
 *   - Header fields (name, SSN) on both pages
 *   - Part I: foreign-source income breakdown
 *   - Part II: foreign taxes paid
 *   - Part III: limitation computation and credit amount
 *   - Part IV: summary and total credit
 *   - Country field population
 *   - Excess credit (informational carryforward)
 *   - Valid PDF output that can be reloaded
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'
import { fillForm1116 } from '../../src/forms/fillers/form1116Filler'
import type { ForeignTaxCreditResult } from '../../src/rules/2025/foreignTaxCredit'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn } from '../../src/model/types'
import {
  F1116_HEADER,
  F1116_INFO,
  F1116_PART1,
  F1116_PART2,
  F1116_PART3,
  F1116_PART4,
} from '../../src/forms/mappings/form1116Fields'

let templateBytes: Uint8Array

beforeAll(() => {
  templateBytes = new Uint8Array(
    readFileSync(join(__dirname, '../../public/forms/f1116.pdf')),
  )
})

// ── Helpers ─────────────────────────────────────────────────

function makeTaxReturn(): TaxReturn {
  const tr = emptyTaxReturn(2025)
  tr.taxpayer.firstName = 'Jane'
  tr.taxpayer.lastName = 'Investor'
  tr.taxpayer.ssn = '123456789'
  return tr
}

/** Standard FTC result for a passive portfolio case */
function makeResult(overrides?: Partial<ForeignTaxCreditResult>): ForeignTaxCreditResult {
  return {
    foreignTaxDIV: 45_000,          // $450 from dividends
    foreignTaxINT: 15_000,          // $150 from interest
    totalForeignTaxPaid: 60_000,    // $600 total
    foreignSourceIncome: 500_000,   // $5,000 gross foreign income
    worldwideTaxableIncome: 8_000_000, // $80,000
    usTaxBeforeCredits: 1_000_000,  // $10,000
    limitation: 62_500,             // $625 = $10,000 * ($5,000 / $80,000)
    creditAmount: 60_000,           // $600 = min($600, $625)
    directCreditElection: false,    // Over $300 threshold → Form 1116 required
    excessForeignTax: 0,
    countries: ['United Kingdom', 'Japan'],
    applicable: true,
    ...overrides,
  }
}

async function getFieldValue(doc: PDFDocument, fieldName: string): Promise<string | undefined> {
  const form = doc.getForm()
  try {
    return form.getTextField(fieldName).getText() ?? undefined
  } catch {
    return undefined
  }
}

// ── Tests ───────────────────────────────────────────────────

describe('fillForm1116', () => {
  it('fills header fields on both pages', async () => {
    const tr = makeTaxReturn()
    const result = makeResult()

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    expect(await getFieldValue(doc, F1116_HEADER.p1Name)).toBe('Jane Investor')
    expect(await getFieldValue(doc, F1116_HEADER.p1Ssn)).toBe('123-45-6789')
    expect(await getFieldValue(doc, F1116_HEADER.p2Name)).toBe('Jane Investor')
    expect(await getFieldValue(doc, F1116_HEADER.p2Ssn)).toBe('123-45-6789')
  })

  it('fills country field', async () => {
    const tr = makeTaxReturn()
    const result = makeResult()

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    expect(await getFieldValue(doc, F1116_INFO.country)).toBe('United Kingdom, Japan')
  })

  it('fills Part I foreign-source income', async () => {
    const tr = makeTaxReturn()
    const result = makeResult()

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    // Line 2: total foreign-source income
    expect(await getFieldValue(doc, F1116_PART1.line2)).toBe('5,000')
    // Line 3g: net foreign-source taxable income
    expect(await getFieldValue(doc, F1116_PART1.line3g)).toBe('5,000')
  })

  it('fills Part II foreign taxes paid', async () => {
    const tr = makeTaxReturn()
    const result = makeResult()

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    // Dividends tax
    expect(await getFieldValue(doc, F1116_PART2.line8Dividends)).toBe('450')
    // Interest tax
    expect(await getFieldValue(doc, F1116_PART2.line8Interest)).toBe('150')
    // Total
    expect(await getFieldValue(doc, F1116_PART2.line9)).toBe('600')
    // Line 11: total (same as line 9 since no carryover)
    expect(await getFieldValue(doc, F1116_PART2.line11)).toBe('600')
    // Line 14: net creditable taxes
    expect(await getFieldValue(doc, F1116_PART2.line14)).toBe('600')
  })

  it('fills Part III limitation computation', async () => {
    const tr = makeTaxReturn()
    const result = makeResult()

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    // Line 15: foreign-source income
    expect(await getFieldValue(doc, F1116_PART3.line15)).toBe('5,000')
    // Line 17: same (no adjustments)
    expect(await getFieldValue(doc, F1116_PART3.line17)).toBe('5,000')
    // Line 18: worldwide taxable income
    expect(await getFieldValue(doc, F1116_PART3.line18)).toBe('80,000')
    // Line 19: ratio
    expect(await getFieldValue(doc, F1116_PART3.line19)).toBe('0.0625')
    // Line 20: U.S. tax
    expect(await getFieldValue(doc, F1116_PART3.line20)).toBe('10,000')
    // Line 21: limitation
    expect(await getFieldValue(doc, F1116_PART3.line21)).toBe('625')
  })

  it('fills Part III credit amount (page 2)', async () => {
    const tr = makeTaxReturn()
    const result = makeResult()

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    // Line 22: credit = min(taxes, limitation)
    expect(await getFieldValue(doc, F1116_PART3.line22)).toBe('600')
    // Line 24: same (single category)
    expect(await getFieldValue(doc, F1116_PART3.line24)).toBe('600')
    // Line 33: final credit
    expect(await getFieldValue(doc, F1116_PART3.line33)).toBe('600')
  })

  it('fills Part IV summary', async () => {
    const tr = makeTaxReturn()
    const result = makeResult()

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    // Line 35: passive category credit
    expect(await getFieldValue(doc, F1116_PART4.line35)).toBe('600')
    // Line 38: total
    expect(await getFieldValue(doc, F1116_PART4.line38)).toBe('600')
  })

  it('shows excess foreign tax when limitation binds', async () => {
    const tr = makeTaxReturn()
    // Taxes paid ($800) exceed limitation ($500)
    const result = makeResult({
      totalForeignTaxPaid: 80_000,
      foreignTaxDIV: 60_000,
      foreignTaxINT: 20_000,
      limitation: 50_000,
      creditAmount: 50_000,
      excessForeignTax: 30_000, // $300 excess
    })

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    // Line 34: excess
    expect(await getFieldValue(doc, F1116_PART3.line34)).toBe('300')
    // Credit is limited
    expect(await getFieldValue(doc, F1116_PART3.line22)).toBe('500')
  })

  it('produces a 2-page PDF', async () => {
    const tr = makeTaxReturn()
    const result = makeResult()

    const doc = await fillForm1116(templateBytes, tr, result)

    expect(doc.getPageCount()).toBe(2)
  })

  it('produces valid PDF bytes', async () => {
    const tr = makeTaxReturn()
    const result = makeResult()

    const doc = await fillForm1116(templateBytes, tr, result)
    const bytes = await doc.save()

    // Reloadable
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(2)
  })

  it('handles single-country case', async () => {
    const tr = makeTaxReturn()
    const result = makeResult({ countries: ['Switzerland'] })

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    expect(await getFieldValue(doc, F1116_INFO.country)).toBe('Switzerland')
  })

  it('handles zero interest (dividend-only foreign tax)', async () => {
    const tr = makeTaxReturn()
    const result = makeResult({
      foreignTaxDIV: 50_000,
      foreignTaxINT: 0,
      totalForeignTaxPaid: 50_000,
    })

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    expect(await getFieldValue(doc, F1116_PART2.line8Dividends)).toBe('500')
    // Interest field should be empty (zero)
    expect(await getFieldValue(doc, F1116_PART2.line8Interest)).toBeUndefined()
  })

  it('handles zero dividends (interest-only foreign tax)', async () => {
    const tr = makeTaxReturn()
    const result = makeResult({
      foreignTaxDIV: 0,
      foreignTaxINT: 40_000,
      totalForeignTaxPaid: 40_000,
    })

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    expect(await getFieldValue(doc, F1116_PART2.line8Dividends)).toBeUndefined()
    expect(await getFieldValue(doc, F1116_PART2.line8Interest)).toBe('400')
  })

  it('caps ratio at 1.0 when foreign income exceeds worldwide', async () => {
    const tr = makeTaxReturn()
    // Edge case: foreign-source income > worldwide taxable income
    const result = makeResult({
      foreignSourceIncome: 10_000_000,
      worldwideTaxableIncome: 8_000_000,
    })

    const doc = await fillForm1116(templateBytes, tr, result, { flatten: false })

    // Ratio capped at 1.0
    expect(await getFieldValue(doc, F1116_PART3.line19)).toBe('1.0000')
  })
})
