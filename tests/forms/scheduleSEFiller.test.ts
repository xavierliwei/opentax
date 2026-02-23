/**
 * Tests for Schedule SE PDF filler — field mapping and SE tax computation display.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'
import { fillScheduleSE } from '../../src/forms/fillers/scheduleSEFiller'
import { computeScheduleSE } from '../../src/rules/2025/scheduleSE'
import { emptyTaxReturn } from '../../src/model/types'
import { cents } from '../../src/model/traced'
import type { TaxReturn } from '../../src/model/types'
import { SCHSE_HEADER, SCHSE_LINES } from '../../src/forms/mappings/scheduleSEFields'

let templateBytes: Uint8Array

beforeAll(() => {
  templateBytes = new Uint8Array(
    readFileSync(join(__dirname, '../../public/forms/f1040sse.pdf')),
  )
})

function makeTaxReturn(): TaxReturn {
  const tr = emptyTaxReturn(2025)
  tr.taxpayer.firstName = 'Test'
  tr.taxpayer.lastName = 'User'
  tr.taxpayer.ssn = '123456789'
  return tr
}

describe('fillScheduleSE', () => {
  it('fills header fields', async () => {
    const tr = makeTaxReturn()
    const result = computeScheduleSE(cents(50000), 0, 'single')

    const doc = await fillScheduleSE(templateBytes, tr, result, { flatten: false })
    const form = doc.getForm()

    expect(form.getTextField(SCHSE_HEADER.name).getText()).toBe('Test User')
    expect(form.getTextField(SCHSE_HEADER.ssn).getText()).toBe('123-45-6789')
  })

  it('fills SE tax lines for a typical self-employed person', async () => {
    const tr = makeTaxReturn()
    // $100,000 net Schedule C profit, no W-2 wages
    const result = computeScheduleSE(cents(100000), 0, 'single')

    const doc = await fillScheduleSE(templateBytes, tr, result, { flatten: false })
    const form = doc.getForm()

    // Line 2: $100,000
    expect(form.getTextField(SCHSE_LINES.line2).getText()).toBe('100,000')
    // Line 3: $100,000 × 92.35% = $92,350
    expect(form.getTextField(SCHSE_LINES.line3).getText()).toBe('92,350')
    // Line 4a: min($92,350, $176,100) = $92,350
    expect(form.getTextField(SCHSE_LINES.line4a).getText()).toBe('92,350')
    // Line 4b: $92,350 × 12.4% = $11,451
    expect(form.getTextField(SCHSE_LINES.line4b).getText()).toMatch(/^11,4\d{2}$/)
    // Line 5: $92,350 × 2.9% = $2,678
    expect(form.getTextField(SCHSE_LINES.line5).getText()).toMatch(/^2,6\d{2}$/)
    // Line 6: total SE tax
    const line6 = form.getTextField(SCHSE_LINES.line6).getText()
    expect(line6).toBeTruthy()
    // Line 12: deductible half = line 6 / 2
    const line12 = form.getTextField(SCHSE_LINES.line12).getText()
    expect(line12).toBeTruthy()
  })

  it('coordinates with W-2 Social Security wages', async () => {
    const tr = makeTaxReturn()
    // $50K net profit + $150K W-2 SS wages → only $26,100 SS room
    const result = computeScheduleSE(cents(50000), cents(150000), 'single')

    const doc = await fillScheduleSE(templateBytes, tr, result, { flatten: false })
    const form = doc.getForm()

    // Line 2: $50,000
    expect(form.getTextField(SCHSE_LINES.line2).getText()).toBe('50,000')
    // Line 3: $50,000 × 92.35% = $46,175
    expect(form.getTextField(SCHSE_LINES.line3).getText()).toBe('46,175')
    // Line 4a: min($46,175, $176,100 - $150,000 = $26,100) = $26,100
    expect(form.getTextField(SCHSE_LINES.line4a).getText()).toBe('26,100')
    // Line 5: Medicare on full $46,175 (uncapped)
    expect(form.getTextField(SCHSE_LINES.line5).getText()).toMatch(/^1,3\d{2}$/)
  })

  it('produces valid PDF bytes', async () => {
    const tr = makeTaxReturn()
    const result = computeScheduleSE(cents(75000), 0, 'single')

    const doc = await fillScheduleSE(templateBytes, tr, result)
    const bytes = await doc.save()

    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(1) // Schedule SE short form is 1 page
  })

  it('has 1 page (Section A short form)', async () => {
    const tr = makeTaxReturn()
    const result = computeScheduleSE(cents(50000), 0, 'single')

    const doc = await fillScheduleSE(templateBytes, tr, result)
    expect(doc.getPageCount()).toBe(1)
  })
})
