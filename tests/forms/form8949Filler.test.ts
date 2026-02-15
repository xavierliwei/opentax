/**
 * Tests for Form 8949 PDF filler — especially multi-page support.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'
import { fillForm8949 } from '../../src/forms/fillers/form8949Filler'
import { ROWS_PER_PAGE } from '../../src/forms/mappings/form8949Fields'
import { computeForm8949 } from '../../src/rules/2025/form8949'
import { makeTransaction } from '../fixtures/returns'
import { emptyTaxReturn } from '../../src/model/types'
import { cents } from '../../src/model/traced'
import type { TaxReturn, CapitalTransaction } from '../../src/model/types'
import type { Form8949CategoryTotals } from '../../src/rules/2025/form8949'

let templateBytes: Uint8Array

beforeAll(() => {
  templateBytes = new Uint8Array(
    readFileSync(join(__dirname, '../../public/forms/f8949.pdf')),
  )
})

function makeTaxReturn(): TaxReturn {
  const tr = emptyTaxReturn(2025)
  tr.taxpayer.firstName = 'Test'
  tr.taxpayer.lastName = 'User'
  tr.taxpayer.ssn = '123456789'
  return tr
}

function makeNTransactions(n: number, category: 'A' | 'D'): CapitalTransaction[] {
  return Array.from({ length: n }, (_, i) =>
    makeTransaction({
      id: `tx-${i + 1}`,
      description: `STOCK${i + 1}`,
      dateAcquired: '2024-01-15',
      dateSold: '2025-06-15',
      proceeds: cents(1000 + i * 100),
      adjustedBasis: cents(800 + i * 50),
      longTerm: category === 'D',
      category,
    }),
  )
}

describe('ROWS_PER_PAGE', () => {
  it('is 11', () => {
    expect(ROWS_PER_PAGE).toBe(11)
  })
})

describe('fillForm8949', () => {
  it('fills a single page for <= 11 transactions', async () => {
    const tr = makeTaxReturn()
    const txs = makeNTransactions(5, 'A')
    tr.capitalTransactions = txs
    const result = computeForm8949(tr.capitalTransactions)
    const cat = result.byCategory['A']!

    const doc = await fillForm8949(templateBytes, tr, cat)

    // Should be exactly 1 page (Part I only, Part II removed)
    expect(doc.getPageCount()).toBe(1)
  })

  it('fills exactly 11 rows on one page', async () => {
    const tr = makeTaxReturn()
    const txs = makeNTransactions(11, 'D')
    tr.capitalTransactions = txs
    const result = computeForm8949(tr.capitalTransactions)
    const cat = result.byCategory['D']!

    const doc = await fillForm8949(templateBytes, tr, cat)
    expect(doc.getPageCount()).toBe(1)
  })

  it('creates 2 pages for 12 transactions', async () => {
    const tr = makeTaxReturn()
    const txs = makeNTransactions(12, 'A')
    tr.capitalTransactions = txs
    const result = computeForm8949(tr.capitalTransactions)
    const cat = result.byCategory['A']!

    const doc = await fillForm8949(templateBytes, tr, cat)
    expect(doc.getPageCount()).toBe(2)
  })

  it('creates 3 pages for 25 transactions', async () => {
    const tr = makeTaxReturn()
    const txs = makeNTransactions(25, 'A')
    tr.capitalTransactions = txs
    const result = computeForm8949(tr.capitalTransactions)
    const cat = result.byCategory['A']!

    const doc = await fillForm8949(templateBytes, tr, cat)
    // 25 / 11 = 3 pages (11 + 11 + 3)
    expect(doc.getPageCount()).toBe(3)
  })

  it('creates correct pages for 30 transactions', async () => {
    const tr = makeTaxReturn()
    const txs = makeNTransactions(30, 'D')
    tr.capitalTransactions = txs
    const result = computeForm8949(tr.capitalTransactions)
    const cat = result.byCategory['D']!

    const doc = await fillForm8949(templateBytes, tr, cat)
    // 30 / 11 = 3 pages (11 + 11 + 8)
    expect(doc.getPageCount()).toBe(3)
  })

  it('handles long-term category (removes Part I page)', async () => {
    const tr = makeTaxReturn()
    const txs = makeNTransactions(3, 'D')
    tr.capitalTransactions = txs
    const result = computeForm8949(tr.capitalTransactions)
    const cat = result.byCategory['D']!

    const doc = await fillForm8949(templateBytes, tr, cat)
    expect(doc.getPageCount()).toBe(1)
  })

  it('handles short-term category (removes Part II page)', async () => {
    const tr = makeTaxReturn()
    const txs = makeNTransactions(3, 'A')
    tr.capitalTransactions = txs
    const result = computeForm8949(tr.capitalTransactions)
    const cat = result.byCategory['A']!

    const doc = await fillForm8949(templateBytes, tr, cat)
    expect(doc.getPageCount()).toBe(1)
  })

  it('produces valid PDF bytes', async () => {
    const tr = makeTaxReturn()
    const txs = makeNTransactions(15, 'A')
    tr.capitalTransactions = txs
    const result = computeForm8949(tr.capitalTransactions)
    const cat = result.byCategory['A']!

    const doc = await fillForm8949(templateBytes, tr, cat)
    const bytes = await doc.save()

    // Should be loadable
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(2)
  })
})
