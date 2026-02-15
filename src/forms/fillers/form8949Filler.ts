/**
 * Form 8949 PDF filler — with multi-page support.
 *
 * Each Form 8949 page holds 11 transaction rows.
 * For categories with more transactions, we load fresh template
 * copies for each page, fill, flatten, and merge.
 */

import { PDFDocument } from 'pdf-lib'
import type { Form8949CategoryTotals } from '../../rules/2025/form8949'
import type { CapitalTransaction } from '../../model/types'
import {
  F8949_HEADER, F8949_PART2_HEADER,
  F8949_PART1_CHECKBOXES, F8949_PART2_CHECKBOXES,
  F8949_PART1_ROWS, F8949_PART2_ROWS,
  F8949_PART1_TOTALS, F8949_PART2_TOTALS,
  ROWS_PER_PAGE,
} from '../mappings/form8949Fields'
import { setTextField, setDollarCentsField, formatSSN, formatDateShort } from '../helpers'
import type { TaxReturn } from '../../model/types'

/** Fill a single page of Form 8949. */
async function fillPage(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  category: string,
  transactions: CapitalTransaction[],
  isShortTerm: boolean,
  totals: Form8949CategoryTotals | null,
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  try { form.deleteXFA() } catch { /* ok */ }

  // Use Part I page (short-term) or Part II page (long-term)
  const header = isShortTerm ? F8949_HEADER : F8949_PART2_HEADER
  const catCheckboxes = isShortTerm ? F8949_PART1_CHECKBOXES : F8949_PART2_CHECKBOXES
  const rows = isShortTerm ? F8949_PART1_ROWS : F8949_PART2_ROWS
  const totalFields = isShortTerm ? F8949_PART1_TOTALS : F8949_PART2_TOTALS

  // Header
  setTextField(form, header.name, `${taxReturn.taxpayer.firstName} ${taxReturn.taxpayer.lastName}`)
  setTextField(form, header.ssn, formatSSN(taxReturn.taxpayer.ssn))

  // Category checkbox
  const catField = (catCheckboxes as Record<string, string>)[`box${category}`]
  if (catField) {
    try { form.getCheckBox(catField).check() } catch { /* ok */ }
  }

  // Fill transaction rows
  for (let i = 0; i < transactions.length && i < rows.length; i++) {
    const tx = transactions[i]
    const row = rows[i]

    setTextField(form, row.description, tx.description)
    setTextField(form, row.dateAcquired, formatDateShort(tx.dateAcquired))
    setTextField(form, row.dateSold, formatDateShort(tx.dateSold))
    setDollarCentsField(form, row.proceeds, tx.proceeds)
    setDollarCentsField(form, row.basis, tx.reportedBasis)
    if (tx.adjustmentCode) {
      setTextField(form, row.adjustmentCode, tx.adjustmentCode)
    }
    setDollarCentsField(form, row.adjustmentAmount, tx.adjustmentAmount)
    setDollarCentsField(form, row.gainLoss, tx.gainLoss)
  }

  // Totals (only on the last page for this category)
  if (totals) {
    setDollarCentsField(form, totalFields.proceeds, totals.totalProceeds.amount)
    setDollarCentsField(form, totalFields.basis, totals.totalBasis.amount)
    setDollarCentsField(form, totalFields.adjustments, totals.totalAdjustments.amount)
    setDollarCentsField(form, totalFields.gainLoss, totals.totalGainLoss.amount)
  }

  // Remove the page we don't need (Part I or Part II)
  if (pdfDoc.getPageCount() === 2) {
    const removeIndex = isShortTerm ? 1 : 0
    pdfDoc.removePage(removeIndex)
  }

  form.flatten()
  return pdfDoc
}

/**
 * Fill Form 8949 for a single category, producing multiple pages if needed.
 */
export async function fillForm8949(
  templateBytes: Uint8Array,
  taxReturn: TaxReturn,
  categoryTotals: Form8949CategoryTotals,
): Promise<PDFDocument> {
  const transactions = categoryTotals.transactions
  const isShortTerm = categoryTotals.category === 'A' || categoryTotals.category === 'B'
  const totalPages = Math.max(1, Math.ceil(transactions.length / ROWS_PER_PAGE))

  if (totalPages === 1) {
    return fillPage(templateBytes, taxReturn, categoryTotals.category, transactions, isShortTerm, categoryTotals)
  }

  // Multi-page: merge all pages into one document
  const finalDoc = await PDFDocument.create()

  for (let p = 0; p < totalPages; p++) {
    const start = p * ROWS_PER_PAGE
    const pageTransactions = transactions.slice(start, start + ROWS_PER_PAGE)
    const isLastPage = p === totalPages - 1

    const pageDoc = await fillPage(
      templateBytes,
      taxReturn,
      categoryTotals.category,
      pageTransactions,
      isShortTerm,
      isLastPage ? categoryTotals : null,
    )

    const [copiedPage] = await finalDoc.copyPages(pageDoc, [0])
    finalDoc.addPage(copiedPage)
  }

  return finalDoc
}
