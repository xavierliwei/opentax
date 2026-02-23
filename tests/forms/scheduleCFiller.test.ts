/**
 * Tests for Schedule C PDF filler — field mapping and multi-business support.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'
import { fillScheduleC } from '../../src/forms/fillers/scheduleCFiller'
import { computeScheduleC } from '../../src/rules/2025/scheduleC'
import { emptyTaxReturn } from '../../src/model/types'
import { cents } from '../../src/model/traced'
import type { TaxReturn, ScheduleC } from '../../src/model/types'
import { makeScheduleC } from '../fixtures/returns'
import { SCHC_HEADER, SCHC_INCOME, SCHC_EXPENSES, SCHC_SUMMARY, SCHC_BUSINESS } from '../../src/forms/mappings/scheduleCFields'

let templateBytes: Uint8Array

beforeAll(() => {
  templateBytes = new Uint8Array(
    readFileSync(join(__dirname, '../../public/forms/f1040sc.pdf')),
  )
})

function makeTaxReturn(): TaxReturn {
  const tr = emptyTaxReturn(2025)
  tr.taxpayer.firstName = 'Test'
  tr.taxpayer.lastName = 'User'
  tr.taxpayer.ssn = '123456789'
  return tr
}

describe('fillScheduleC', () => {
  it('fills header fields (name and SSN)', async () => {
    const tr = makeTaxReturn()
    const business = makeScheduleC({
      id: 'biz-1',
      businessName: 'Test Biz',
      grossReceipts: cents(50000),
    })
    const result = computeScheduleC(business)

    const doc = await fillScheduleC(templateBytes, tr, business, result, { flatten: false })
    const form = doc.getForm()

    expect(form.getTextField(SCHC_HEADER.name).getText()).toBe('Test User')
    expect(form.getTextField(SCHC_HEADER.ssn).getText()).toBe('123-45-6789')
  })

  it('fills business info fields', async () => {
    const tr = makeTaxReturn()
    const business = makeScheduleC({
      id: 'biz-1',
      businessName: 'Acme Consulting',
      businessEin: '12-3456789',
      principalBusinessCode: '541611',
    })
    const result = computeScheduleC(business)

    const doc = await fillScheduleC(templateBytes, tr, business, result, { flatten: false })
    const form = doc.getForm()

    expect(form.getTextField(SCHC_BUSINESS.lineC).getText()).toBe('Acme Consulting')
    expect(form.getTextField(SCHC_BUSINESS.lineD).getText()).toBe('12-3456789')
    expect(form.getTextField(SCHC_BUSINESS.lineB).getText()).toBe('541611')
  })

  it('fills income lines correctly', async () => {
    const tr = makeTaxReturn()
    const business = makeScheduleC({
      id: 'biz-1',
      businessName: 'Test Biz',
      grossReceipts: cents(100000),
      returns: cents(5000),
      costOfGoodsSold: cents(20000),
    })
    const result = computeScheduleC(business)

    const doc = await fillScheduleC(templateBytes, tr, business, result, { flatten: false })
    const form = doc.getForm()

    // Line 1 = $100,000
    expect(form.getTextField(SCHC_INCOME.line1).getText()).toBe('100,000')
    // Line 2 = $5,000
    expect(form.getTextField(SCHC_INCOME.line2).getText()).toBe('5,000')
    // Line 3 = $100,000 - $5,000 = $95,000
    expect(form.getTextField(SCHC_INCOME.line3).getText()).toBe('95,000')
    // Line 4 = $20,000
    expect(form.getTextField(SCHC_INCOME.line4).getText()).toBe('20,000')
    // Line 5 = $95,000 - $20,000 = $75,000 (gross profit)
    expect(form.getTextField(SCHC_INCOME.line5).getText()).toBe('75,000')
    // Line 7 = $75,000 (gross income = gross profit on simplified path)
    expect(form.getTextField(SCHC_INCOME.line7).getText()).toBe('75,000')
  })

  it('fills expense lines and computes correct totals', async () => {
    const tr = makeTaxReturn()
    const business = makeScheduleC({
      id: 'biz-1',
      businessName: 'Freelance',
      grossReceipts: cents(80000),
      advertising: cents(1000),
      contractLabor: cents(5000),
      insurance: cents(2000),
      officeExpense: cents(1500),
      supplies: cents(800),
      travel: cents(3000),
      meals: cents(2000),       // 50% = $1,000 deductible
      utilities: cents(600),
    })
    const result = computeScheduleC(business)

    const doc = await fillScheduleC(templateBytes, tr, business, result, { flatten: false })
    const form = doc.getForm()

    expect(form.getTextField(SCHC_EXPENSES.line8).getText()).toBe('1,000')
    expect(form.getTextField(SCHC_EXPENSES.line11).getText()).toBe('5,000')
    expect(form.getTextField(SCHC_EXPENSES.line15).getText()).toBe('2,000')
    expect(form.getTextField(SCHC_EXPENSES.line18).getText()).toBe('1,500')
    expect(form.getTextField(SCHC_EXPENSES.line22).getText()).toBe('800')
    expect(form.getTextField(SCHC_EXPENSES.line24a).getText()).toBe('3,000')
    // Meals: 50% of $2,000 = $1,000
    expect(form.getTextField(SCHC_EXPENSES.line24b).getText()).toBe('1,000')
    expect(form.getTextField(SCHC_EXPENSES.line25).getText()).toBe('600')

    // Total expenses = 1000+5000+2000+1500+800+3000+1000+600 = $14,900
    expect(form.getTextField(SCHC_SUMMARY.line28).getText()).toBe('14,900')

    // Net profit = $80,000 - $14,900 = $65,100
    expect(form.getTextField(SCHC_SUMMARY.line31).getText()).toBe('65,100')
  })

  it('handles a net loss correctly', async () => {
    const tr = makeTaxReturn()
    const business = makeScheduleC({
      id: 'biz-loss',
      businessName: 'Startup',
      grossReceipts: cents(5000),
      contractLabor: cents(12000),
      officeExpense: cents(3000),
    })
    const result = computeScheduleC(business)

    const doc = await fillScheduleC(templateBytes, tr, business, result, { flatten: false })
    const form = doc.getForm()

    // Net loss = $5,000 - $15,000 = -$10,000
    expect(form.getTextField(SCHC_SUMMARY.line31).getText()).toBe('(10,000)')
  })

  it('produces valid PDF bytes', async () => {
    const tr = makeTaxReturn()
    const business = makeScheduleC({
      id: 'biz-1',
      businessName: 'Valid PDF Test',
      grossReceipts: cents(50000),
    })
    const result = computeScheduleC(business)

    const doc = await fillScheduleC(templateBytes, tr, business, result)
    const bytes = await doc.save()

    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(2) // Schedule C has 2 pages
  })

  it('has 2 pages (Parts I-II and Parts III-V)', async () => {
    const tr = makeTaxReturn()
    const business = makeScheduleC({
      id: 'biz-1',
      businessName: 'Page Count Test',
      grossReceipts: cents(50000),
    })
    const result = computeScheduleC(business)

    const doc = await fillScheduleC(templateBytes, tr, business, result)
    expect(doc.getPageCount()).toBe(2)
  })

  it('uses spouse SSN when owner is spouse', async () => {
    const tr = makeTaxReturn()
    tr.spouse = {
      firstName: 'Jane',
      lastName: 'Spouse',
      ssn: '987654321',
      address: tr.taxpayer.address,
    }
    const business = makeScheduleC({
      id: 'biz-spouse',
      businessName: 'Spouse Biz',
      owner: 'spouse',
      grossReceipts: cents(30000),
    })
    const result = computeScheduleC(business)

    const doc = await fillScheduleC(templateBytes, tr, business, result, { flatten: false })
    const form = doc.getForm()

    expect(form.getTextField(SCHC_HEADER.name).getText()).toBe('Jane Spouse')
    expect(form.getTextField(SCHC_HEADER.ssn).getText()).toBe('987-65-4321')
  })
})
