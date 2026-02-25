/**
 * Ohio Form IT 1040 PDF field coordinate mapping.
 *
 * The official Ohio IT 1040 PDF is a flat (non-fillable) form bundled with
 * schedules (15 pages total). The IT 1040 itself occupies pages 0-1.
 * We overlay text at calibrated (x, y) coordinates rather than filling
 * named AcroForm fields. Coordinates are in PDF points with origin at
 * bottom-left of each page (612 x 792 pt).
 *
 * Calibrated against the 2025 Ohio IT 1040 bundle from tax.ohio.gov using
 * pdftotext bounding-box extraction.
 *
 * Page 0 = IT 1040 Page 1: Header, personal info, residency, filing status,
 *          income lines 1-7
 * Page 1 = IT 1040 Page 2: Lines 7a-26 (tax, credits, payments, refund)
 */

/** A positioned text field: page index (0-based), x, y coordinates */
export interface FieldPosition {
  page: number
  x: number
  y: number
  /** Font size override (default 9) */
  size?: number
  /** Max width in points -- text will be scaled down if wider */
  maxWidth?: number
}

// ── Page 0: Header / Personal Info ──────────────────────────

export const IT1040_HEADER = {
  primarySSN:      { page: 0, x: 36, y: 655, size: 10 } as FieldPosition,
  firstName:       { page: 0, x: 36, y: 617, size: 9, maxWidth: 210 } as FieldPosition,
  middleInitial:   { page: 0, x: 252, y: 617, size: 9 } as FieldPosition,
  lastName:        { page: 0, x: 274, y: 617, size: 9, maxWidth: 200 } as FieldPosition,

  spouseSSN:       { page: 0, x: 253, y: 655, size: 10 } as FieldPosition,
  spouseFirstName: { page: 0, x: 36, y: 583, size: 9, maxWidth: 210 } as FieldPosition,
  spouseMI:        { page: 0, x: 252, y: 583, size: 9 } as FieldPosition,
  spouseLastName:  { page: 0, x: 274, y: 583, size: 9, maxWidth: 200 } as FieldPosition,

  addressLine1:    { page: 0, x: 36, y: 548, size: 9, maxWidth: 440 } as FieldPosition,
  addressLine2:    { page: 0, x: 36, y: 512, size: 9, maxWidth: 440 } as FieldPosition,
  city:            { page: 0, x: 36, y: 477, size: 9, maxWidth: 275 } as FieldPosition,
  state:           { page: 0, x: 324, y: 477, size: 9 } as FieldPosition,
  zip:             { page: 0, x: 360, y: 477, size: 9 } as FieldPosition,
  county:          { page: 0, x: 440, y: 477, size: 9, maxWidth: 80 } as FieldPosition,
}

// ── Page 0: Residency Status ────────────────────────────────
// Checkbox labels for residency (draw "X" at the checkbox position)

export const IT1040_RESIDENCY = {
  resident:        { page: 0, x: 42, y: 410, size: 9 } as FieldPosition,
  partYear:        { page: 0, x: 112, y: 410, size: 9 } as FieldPosition,
  nonresident:     { page: 0, x: 183, y: 410, size: 9 } as FieldPosition,
  indicateState:   { page: 0, x: 260, y: 410, size: 9 } as FieldPosition,

  spouseResident:  { page: 0, x: 42, y: 374, size: 9 } as FieldPosition,
  spousePartYear:  { page: 0, x: 112, y: 374, size: 9 } as FieldPosition,
  spouseNonres:    { page: 0, x: 183, y: 374, size: 9 } as FieldPosition,
  spouseIndState:  { page: 0, x: 260, y: 374, size: 9 } as FieldPosition,
}

// ── Page 0: Filing Status ───────────────────────────────────
// Checkbox positions for filing status

export const IT1040_FILING_STATUS = {
  singleHohQw:     { page: 0, x: 333, y: 410, size: 9 } as FieldPosition,
  mfj:             { page: 0, x: 333, y: 387, size: 9 } as FieldPosition,
  mfs:             { page: 0, x: 333, y: 363, size: 9 } as FieldPosition,
  mfsSpouseSSN:    { page: 0, x: 483, y: 363, size: 9 } as FieldPosition,
}

// ── Page 0: Income Lines 1-7 ────────────────────────────────
// Dollar amounts in the right column

const P0_DOLLAR_X = 470
const DOLLAR_SIZE = 9

export const IT1040_INCOME = {
  // Line 1: Federal adjusted gross income
  line1:   { page: 0, x: P0_DOLLAR_X, y: 265, size: DOLLAR_SIZE } as FieldPosition,
  // Line 2a: Additions from Schedule of Adjustments
  line2a:  { page: 0, x: P0_DOLLAR_X, y: 238, size: DOLLAR_SIZE } as FieldPosition,
  // Line 2b: Deductions from Schedule of Adjustments
  line2b:  { page: 0, x: P0_DOLLAR_X, y: 215, size: DOLLAR_SIZE } as FieldPosition,
  // Line 3: Ohio adjusted gross income
  line3:   { page: 0, x: P0_DOLLAR_X, y: 192, size: DOLLAR_SIZE } as FieldPosition,
  // Line 4: Exemption amount
  line4:   { page: 0, x: P0_DOLLAR_X, y: 167, size: DOLLAR_SIZE } as FieldPosition,
  // Line 4 exemption count
  line4count: { page: 0, x: 350, y: 155, size: 8 } as FieldPosition,
  // Line 5: Ohio income tax base
  line5:   { page: 0, x: P0_DOLLAR_X, y: 142, size: DOLLAR_SIZE } as FieldPosition,
  // Line 6: Taxable business income
  line6:   { page: 0, x: P0_DOLLAR_X, y: 118, size: DOLLAR_SIZE } as FieldPosition,
  // Line 7: Taxable nonbusiness income
  line7:   { page: 0, x: P0_DOLLAR_X, y: 95, size: DOLLAR_SIZE } as FieldPosition,
}

// ── Page 1: SSN Header ──────────────────────────────────────

export const IT1040_PAGE1_HEADER = {
  ssn:     { page: 1, x: 65, y: 728, size: 9 } as FieldPosition,
}

// ── Page 1: Tax Lines 7a-13 ─────────────────────────────────

const P1_DOLLAR_X = 470

export const IT1040_TAX = {
  // Line 7a: Amount from line 7 on page 1
  line7a:  { page: 1, x: P1_DOLLAR_X, y: 707, size: DOLLAR_SIZE } as FieldPosition,
  // Line 8a: Nonbusiness income tax liability
  line8a:  { page: 1, x: P1_DOLLAR_X, y: 683, size: DOLLAR_SIZE } as FieldPosition,
  // Line 8b: Business income tax liability
  line8b:  { page: 1, x: P1_DOLLAR_X, y: 659, size: DOLLAR_SIZE } as FieldPosition,
  // Line 8c: Income tax liability before credits
  line8c:  { page: 1, x: P1_DOLLAR_X, y: 635, size: DOLLAR_SIZE } as FieldPosition,
  // Line 9: Ohio nonrefundable credits
  line9:   { page: 1, x: P1_DOLLAR_X, y: 611, size: DOLLAR_SIZE } as FieldPosition,
  // Line 10: Tax liability after nonrefundable credits
  line10:  { page: 1, x: P1_DOLLAR_X, y: 588, size: DOLLAR_SIZE } as FieldPosition,
  // Line 11: Interest penalty on underpayment
  line11:  { page: 1, x: P1_DOLLAR_X, y: 563, size: DOLLAR_SIZE } as FieldPosition,
  // Line 12: Unpaid use tax
  line12:  { page: 1, x: P1_DOLLAR_X, y: 541, size: DOLLAR_SIZE } as FieldPosition,
  // Line 13: Total Ohio tax liability
  line13:  { page: 1, x: P1_DOLLAR_X, y: 517, size: DOLLAR_SIZE } as FieldPosition,
}

// ── Page 1: Payments Lines 14-17 ─────────────────────────────

export const IT1040_PAYMENTS = {
  // Line 14: Ohio income tax withheld
  line14:  { page: 1, x: P1_DOLLAR_X, y: 491, size: DOLLAR_SIZE } as FieldPosition,
  // Line 15: Estimated and extension payments
  line15:  { page: 1, x: P1_DOLLAR_X, y: 467, size: DOLLAR_SIZE } as FieldPosition,
  // Line 16: Refundable credits
  line16:  { page: 1, x: P1_DOLLAR_X, y: 443, size: DOLLAR_SIZE } as FieldPosition,
  // Line 17: Total Ohio tax payments
  line17:  { page: 1, x: P1_DOLLAR_X, y: 420, size: DOLLAR_SIZE } as FieldPosition,
}

// ── Page 1: Result Lines 19-26 ──────────────────────────────

export const IT1040_RESULT = {
  // Line 19: Line 17 minus line 18
  line19:  { page: 1, x: P1_DOLLAR_X, y: 373, size: DOLLAR_SIZE } as FieldPosition,
  // Line 20: Tax due
  line20:  { page: 1, x: P1_DOLLAR_X, y: 348, size: DOLLAR_SIZE } as FieldPosition,
  // Line 22: TOTAL AMOUNT DUE
  line22:  { page: 1, x: P1_DOLLAR_X, y: 300, size: DOLLAR_SIZE } as FieldPosition,
  // Line 23: Overpayment
  line23:  { page: 1, x: P1_DOLLAR_X, y: 276, size: DOLLAR_SIZE } as FieldPosition,
  // Line 26: REFUND
  line26:  { page: 1, x: P1_DOLLAR_X, y: 155, size: DOLLAR_SIZE } as FieldPosition,
}
