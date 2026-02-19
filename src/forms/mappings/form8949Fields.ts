/**
 * Form 8949 (Sales and Other Dispositions of Capital Assets) PDF field name mapping.
 *
 * Field names discovered from IRS f8949.pdf (2025) using pdf-lib enumeration.
 * 202 fields, 2 pages.
 * Page 1 prefix: "topmostSubform[0].Page1[0]."
 * Page 2 prefix: "topmostSubform[0].Page2[0]."
 */

const P1 = 'topmostSubform[0].Page1[0].'
const P2 = 'topmostSubform[0].Page2[0].'

/** Number of transaction rows per page (Part I or Part II) */
export const ROWS_PER_PAGE = 11

/** Columns in each transaction row */
export const TRANSACTION_COLUMNS = [
  'description',     // (a) Description of property
  'dateAcquired',    // (b) Date acquired
  'dateSold',        // (c) Date sold or disposed of
  'proceeds',        // (d) Proceeds (sales price)
  'basis',           // (e) Cost or other basis
  'adjustmentCode',  // (f) Code(s) from instructions
  'adjustmentAmount',// (g) Amount of adjustment
  'gainLoss',        // (h) Gain or (loss)
] as const

/** Number of columns per transaction row */
export const COLUMNS_PER_ROW = TRANSACTION_COLUMNS.length // 8

// ── Header fields ────────────────────────────────────────────

export const F8949_HEADER = {
  name: `${P1}f1_01[0]`,  // Name(s) shown on return
  ssn:  `${P1}f1_02[0]`,  // Social security number or taxpayer ID
}

// ── Part I: Short-Term (Page 1) ──────────────────────────────

/**
 * Part I category checkboxes (short-term transactions).
 * Check the box that describes your Form 1099-B reporting.
 */
export const F8949_PART1_CHECKBOXES = {
  boxA: `${P1}c1_1[0]`,  // (A) Basis reported to IRS, no adjustments needed
  boxB: `${P1}c1_1[1]`,  // (B) Basis reported to IRS, adjustments needed
  boxC: `${P1}c1_1[2]`,  // (C) Basis NOT reported to IRS
}

/** A single transaction row's field names */
export interface TransactionRowFields {
  description:      string
  dateAcquired:     string
  dateSold:         string
  proceeds:         string
  basis:            string
  adjustmentCode:   string
  adjustmentAmount: string
  gainLoss:         string
}

/**
 * Build field names for a Part I (short-term) transaction row.
 * @param rowIndex 0-based row index (0–10 for 11 rows)
 */
function part1Row(rowIndex: number): TransactionRowFields {
  // Fields start at f1_03 and increment by 8 per row
  const base = 3 + rowIndex * COLUMNS_PER_ROW
  const pad = (n: number) => n.toString().padStart(2, '0')
  const row = `Row${rowIndex + 1}[0].`
  return {
    description:      `${P1}Table_Line1_Part1[0].${row}f1_${pad(base)}[0]`,
    dateAcquired:     `${P1}Table_Line1_Part1[0].${row}f1_${pad(base + 1)}[0]`,
    dateSold:         `${P1}Table_Line1_Part1[0].${row}f1_${pad(base + 2)}[0]`,
    proceeds:         `${P1}Table_Line1_Part1[0].${row}f1_${pad(base + 3)}[0]`,
    basis:            `${P1}Table_Line1_Part1[0].${row}f1_${pad(base + 4)}[0]`,
    adjustmentCode:   `${P1}Table_Line1_Part1[0].${row}f1_${pad(base + 5)}[0]`,
    adjustmentAmount: `${P1}Table_Line1_Part1[0].${row}f1_${pad(base + 6)}[0]`,
    gainLoss:         `${P1}Table_Line1_Part1[0].${row}f1_${pad(base + 7)}[0]`,
  }
}

/**
 * Part I transaction rows (short-term), 11 rows.
 * Index 0 = Row 1, Index 10 = Row 11.
 */
export const F8949_PART1_ROWS: readonly TransactionRowFields[] = Array.from(
  { length: ROWS_PER_PAGE },
  (_, i) => part1Row(i),
)

/** Part I totals line (Line 2) */
export const F8949_PART1_TOTALS = {
  description: `${P1}f1_91[0]`,  // (blank/unused)
  proceeds:    `${P1}f1_92[0]`,  // Total proceeds
  basis:       `${P1}f1_93[0]`,  // Total cost basis
  adjustments: `${P1}f1_94[0]`,  // Total adjustments
  gainLoss:    `${P1}f1_95[0]`,  // Total gain or (loss)
}

// ── Part II: Long-Term (Page 2) ──────────────────────────────

export const F8949_PART2_HEADER = {
  name: `${P2}f2_01[0]`,  // Name(s) shown on return
  ssn:  `${P2}f2_02[0]`,  // Social security number or taxpayer ID
}

/**
 * Part II category checkboxes (long-term transactions).
 * Check the box that describes your Form 1099-B reporting.
 */
export const F8949_PART2_CHECKBOXES = {
  boxD: `${P2}c2_1[0]`,  // (D) Basis reported to IRS, no adjustments needed
  boxE: `${P2}c2_1[1]`,  // (E) Basis reported to IRS, adjustments needed
  boxF: `${P2}c2_1[2]`,  // (F) Basis NOT reported to IRS
}

/**
 * Build field names for a Part II (long-term) transaction row.
 * @param rowIndex 0-based row index (0–10 for 11 rows)
 */
function part2Row(rowIndex: number): TransactionRowFields {
  // Fields start at f2_03 and increment by 8 per row
  const base = 3 + rowIndex * COLUMNS_PER_ROW
  const pad = (n: number) => n.toString().padStart(2, '0')
  const row = `Row${rowIndex + 1}[0].`
  return {
    description:      `${P2}Table_Line1_Part2[0].${row}f2_${pad(base)}[0]`,
    dateAcquired:     `${P2}Table_Line1_Part2[0].${row}f2_${pad(base + 1)}[0]`,
    dateSold:         `${P2}Table_Line1_Part2[0].${row}f2_${pad(base + 2)}[0]`,
    proceeds:         `${P2}Table_Line1_Part2[0].${row}f2_${pad(base + 3)}[0]`,
    basis:            `${P2}Table_Line1_Part2[0].${row}f2_${pad(base + 4)}[0]`,
    adjustmentCode:   `${P2}Table_Line1_Part2[0].${row}f2_${pad(base + 5)}[0]`,
    adjustmentAmount: `${P2}Table_Line1_Part2[0].${row}f2_${pad(base + 6)}[0]`,
    gainLoss:         `${P2}Table_Line1_Part2[0].${row}f2_${pad(base + 7)}[0]`,
  }
}

/**
 * Part II transaction rows (long-term), 11 rows.
 * Index 0 = Row 1, Index 10 = Row 11.
 */
export const F8949_PART2_ROWS: readonly TransactionRowFields[] = Array.from(
  { length: ROWS_PER_PAGE },
  (_, i) => part2Row(i),
)

/** Part II totals line (Line 4) */
export const F8949_PART2_TOTALS = {
  description: `${P2}f2_91[0]`,  // (blank/unused)
  proceeds:    `${P2}f2_92[0]`,  // Total proceeds
  basis:       `${P2}f2_93[0]`,  // Total cost basis
  adjustments: `${P2}f2_94[0]`,  // Total adjustments
  gainLoss:    `${P2}f2_95[0]`,  // Total gain or (loss)
}

// ── Helper functions ─────────────────────────────────────────

/**
 * Get the field name for a specific cell in a transaction table.
 *
 * @param part 1 for short-term (Part I, Page 1), 2 for long-term (Part II, Page 2)
 * @param row 0-based row index (0–10)
 * @param column Column name from TRANSACTION_COLUMNS
 * @returns The full PDF field name string
 */
export function getTransactionField(
  part: 1 | 2,
  row: number,
  column: typeof TRANSACTION_COLUMNS[number],
): string {
  if (row < 0 || row >= ROWS_PER_PAGE) {
    throw new RangeError(`Row index ${row} out of range (0–${ROWS_PER_PAGE - 1})`)
  }
  const rows = part === 1 ? F8949_PART1_ROWS : F8949_PART2_ROWS
  return rows[row][column]
}
