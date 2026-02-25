/**
 * NC Form D-400 PDF field coordinate mapping.
 *
 * The official NC D-400 PDF has AcroForm widgets that pdf-lib cannot parse
 * due to corrupted object references, so we overlay text at specific (x, y)
 * coordinates rather than filling named AcroForm fields.  Coordinates are
 * in PDF points with origin at bottom-left of each page (612 x 792 pt).
 *
 * Calibrated against the 2024 NC D-400 Web-Fill form (d400.pdf).
 *
 * Page 0 = Cover image (no fillable content)
 * Page 1 = Header, Filing Status, Residency, Income Lines 6-15
 * Page 2 = Lines 16-34, Payments, Refund/Amount Due, Signature
 */

/** A positioned text field: page index (0-based), x, y coordinates */
export interface FieldPosition {
  page: number
  x: number
  y: number
  /** Font size override (default 9) */
  size?: number
  /** Max width in points — text will be scaled down if wider */
  maxWidth?: number
}

// ── Page 1: Header / Personal Info ──────────────────────────

export const D400_HEADER = {
  // Your Social Security Number
  ssn1:             { page: 1, x: 62,  y: 638, size: 10 } as FieldPosition,
  // Spouse's Social Security Number
  ssn2:             { page: 1, x: 380, y: 638, size: 10 } as FieldPosition,

  // Fiscal year dates (usually blank for calendar year)
  dateBeg:          { page: 1, x: 280, y: 672, size: 9 } as FieldPosition,
  dateEnd:          { page: 1, x: 474, y: 672, size: 9 } as FieldPosition,

  // Your first name
  firstName:        { page: 1, x: 73,  y: 603, size: 9, maxWidth: 210 } as FieldPosition,
  // Your middle initial
  mi1:              { page: 1, x: 297, y: 603, size: 9 } as FieldPosition,
  // Your last name
  lastName:         { page: 1, x: 329, y: 603, size: 9, maxWidth: 230 } as FieldPosition,

  // Spouse first name (if joint return)
  spouseFirstName:  { page: 1, x: 73,  y: 573, size: 9, maxWidth: 210 } as FieldPosition,
  // Spouse middle initial
  spouseMI:         { page: 1, x: 297, y: 573, size: 9 } as FieldPosition,
  // Spouse last name
  spouseLastName:   { page: 1, x: 329, y: 573, size: 9, maxWidth: 230 } as FieldPosition,

  // Mailing address
  address:          { page: 1, x: 73,  y: 544, size: 9, maxWidth: 420 } as FieldPosition,
  // Apartment number
  apartment:        { page: 1, x: 507, y: 544, size: 9 } as FieldPosition,
  // City
  city:             { page: 1, x: 73,  y: 514, size: 9, maxWidth: 225 } as FieldPosition,
  // State
  state:            { page: 1, x: 314, y: 514, size: 9 } as FieldPosition,
  // Zip code
  zip:              { page: 1, x: 360, y: 514, size: 9 } as FieldPosition,
  // Country (if not U.S.)
  country:          { page: 1, x: 419, y: 514, size: 9 } as FieldPosition,
  // County (first five letters)
  county:           { page: 1, x: 508, y: 514, size: 9 } as FieldPosition,
}

// ── Page 1: Filing Status ───────────────────────────────────
// Checkbox positions — we draw an "X" at these coordinates

export const D400_FILING_STATUS = {
  single:   { page: 1, x: 78, y: 345, size: 10 } as FieldPosition,  // 1. Single
  mfj:      { page: 1, x: 78, y: 333, size: 10 } as FieldPosition,  // 2. Married Filing Jointly
  mfs:      { page: 1, x: 78, y: 320, size: 10 } as FieldPosition,  // 3. Married Filing Separately
  hoh:      { page: 1, x: 78, y: 307, size: 10 } as FieldPosition,  // 4. Head of Household
  qw:       { page: 1, x: 78, y: 294, size: 10 } as FieldPosition,  // 5. Qualifying Widow(er)
}

// MFS spouse info
export const D400_SPOUSE_INFO = {
  // Spouse's name (for MFS)
  spouseName:       { page: 1, x: 288, y: 333, size: 8, maxWidth: 220 } as FieldPosition,
  // Spouse's SSN (for MFS)
  spouseSSN:        { page: 1, x: 288, y: 318, size: 8 } as FieldPosition,
}

// ── Page 1: Residency Status ────────────────────────────────

export const D400_RESIDENCY = {
  // Were you a resident for the entire year? (Yes/No)
  res1Yes:          { page: 1, x: 365, y: 409, size: 10 } as FieldPosition,
  res1No:           { page: 1, x: 393, y: 409, size: 10 } as FieldPosition,
  // Was your spouse a resident for the entire year? (Yes/No)
  res2Yes:          { page: 1, x: 365, y: 397, size: 10 } as FieldPosition,
  res2No:           { page: 1, x: 393, y: 397, size: 10 } as FieldPosition,
}

// ── Page 1: Veteran Information ─────────────────────────────

export const D400_VETERAN = {
  vetYes:           { page: 1, x: 242, y: 381, size: 10 } as FieldPosition,
  vetNo:            { page: 1, x: 271, y: 381, size: 10 } as FieldPosition,
  spouseVetYes:     { page: 1, x: 452, y: 381, size: 10 } as FieldPosition,
  spouseVetNo:      { page: 1, x: 480, y: 381, size: 10 } as FieldPosition,
}

// ── Page 1: Income (Lines 6-15) ─────────────────────────────
// Dollar amounts in the right-hand column

const P1_DOLLAR_X = 378  // Left edge of dollar amount column on page 1
const DOLLAR_SIZE = 9

export const D400_INCOME = {
  // Line 6: Federal adjusted gross income
  line6:            { page: 1, x: P1_DOLLAR_X, y: 276, size: DOLLAR_SIZE } as FieldPosition,
  // Line 7: Additions to Federal AGI (from D-400 Schedule S, Part A)
  line7:            { page: 1, x: P1_DOLLAR_X, y: 252, size: DOLLAR_SIZE } as FieldPosition,
  // Line 8: Add Lines 6 and 7
  line8:            { page: 1, x: P1_DOLLAR_X, y: 228, size: DOLLAR_SIZE } as FieldPosition,
  // Line 9: Deductions from Federal AGI (from D-400 Schedule S, Part B)
  line9:            { page: 1, x: P1_DOLLAR_X, y: 203, size: DOLLAR_SIZE } as FieldPosition,
  // Line 10a: Number of qualifying children
  line10a:          { page: 1, x: 359, y: 179, size: DOLLAR_SIZE } as FieldPosition,
  // Line 10b: Child deduction amount
  line10b:          { page: 1, x: 426, y: 179, size: DOLLAR_SIZE } as FieldPosition,
  // Deduction type checkboxes
  standardDeductionCB: { page: 1, x: 77, y: 161, size: 10 } as FieldPosition,
  itemizedDeductionCB: { page: 1, x: 211, y: 161, size: 10 } as FieldPosition,
  // Line 11: N.C. Standard Deduction OR N.C. Itemized Deductions
  line11:           { page: 1, x: P1_DOLLAR_X, y: 152, size: DOLLAR_SIZE } as FieldPosition,
  // Line 12a: Add Lines 9, 10b, and 11
  line12a:          { page: 1, x: 141, y: 124, size: DOLLAR_SIZE } as FieldPosition,
  // Line 12b: Subtract Line 12a from Line 8
  line12b:          { page: 1, x: P1_DOLLAR_X, y: 124, size: DOLLAR_SIZE } as FieldPosition,
  // Line 13: Part-year/nonresident taxable percentage (decimal)
  line13:           { page: 1, x: P1_DOLLAR_X, y: 96, size: DOLLAR_SIZE } as FieldPosition,
  // Line 14: North Carolina taxable income
  line14:           { page: 1, x: P1_DOLLAR_X, y: 70, size: DOLLAR_SIZE } as FieldPosition,
  // Line 15: North Carolina income tax (Line 14 x 4.5%)
  line15:           { page: 1, x: P1_DOLLAR_X, y: 44, size: DOLLAR_SIZE } as FieldPosition,
}

// ── Page 2: Header ──────────────────────────────────────────

export const D400_PAGE2_HEADER = {
  lastName:         { page: 2, x: 112, y: 733, size: 9 } as FieldPosition,
  ssn:              { page: 2, x: 417, y: 733, size: 9 } as FieldPosition,
}

// ── Page 2: Tax Credits & Payments (Lines 16-25) ────────────

const P2_DOLLAR_X = 461  // Left edge of dollar amount column on page 2
const P2_DOLLAR_SIZE = 9

export const D400_TAX = {
  // Line 16: Tax Credits (from Form D-400TC)
  line16:           { page: 2, x: P2_DOLLAR_X, y: 705, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 17: Subtract Line 16 from Line 15
  line17:           { page: 2, x: P2_DOLLAR_X, y: 681, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 18: Consumer Use Tax
  line18:           { page: 2, x: P2_DOLLAR_X, y: 657, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 19: Add Lines 17 and 18
  line19:           { page: 2, x: P2_DOLLAR_X, y: 633, size: P2_DOLLAR_SIZE } as FieldPosition,
}

// ── Page 2: NC Income Tax Withheld (Lines 20-21) ────────────

export const D400_WITHHOLDING = {
  // Line 20a: Your tax withheld
  line20a:          { page: 2, x: 161, y: 606, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 20b: Spouse's tax withheld
  line20b:          { page: 2, x: 327, y: 606, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 21a: 2024 estimated tax
  line21a:          { page: 2, x: 161, y: 573, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 21b: Paid with extension
  line21b:          { page: 2, x: 327, y: 573, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 21c: Partnership
  line21c:          { page: 2, x: 161, y: 540, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 21d: S Corporation
  line21d:          { page: 2, x: 327, y: 540, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 22: Additional Payments (amended returns)
  line22:           { page: 2, x: P2_DOLLAR_X, y: 519, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 23: Add Lines 20a through 22
  line23:           { page: 2, x: P2_DOLLAR_X, y: 493, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 24: Previous Refunds (amended returns)
  line24:           { page: 2, x: P2_DOLLAR_X, y: 468, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 25: Subtract Line 24 from Line 23
  line25:           { page: 2, x: P2_DOLLAR_X, y: 443, size: P2_DOLLAR_SIZE } as FieldPosition,
}

// ── Page 2: Tax Due / Overpayment (Lines 26-34) ─────────────

export const D400_RESULT = {
  // Line 26a: Tax Due (if Line 25 < Line 19)
  line26a:          { page: 2, x: P2_DOLLAR_X, y: 417, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 26b: Penalties
  line26b:          { page: 2, x: 65,  y: 389, size: 8 } as FieldPosition,
  // Line 26c: Interest
  line26c:          { page: 2, x: 183, y: 389, size: 8 } as FieldPosition,
  // Line 26d: Sum of 26b and 26c
  line26d:          { page: 2, x: P2_DOLLAR_X, y: 389, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 26e: Interest on underpayment of estimated tax
  line26e:          { page: 2, x: P2_DOLLAR_X, y: 364, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 27: Amount Due (add Lines 26a, 26d, 26e)
  line27:           { page: 2, x: P2_DOLLAR_X, y: 340, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 28: Overpayment (Line 25 minus Line 19)
  line28:           { page: 2, x: P2_DOLLAR_X, y: 315, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 29: Amount to apply to 2025 estimated tax
  line29:           { page: 2, x: P2_DOLLAR_X, y: 291, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 30: Contribution to NC Nongame and Endangered Wildlife Fund
  line30:           { page: 2, x: P2_DOLLAR_X, y: 267, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 31: Contribution to NC Education Endowment Fund
  line31:           { page: 2, x: P2_DOLLAR_X, y: 242, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 32: Contribution to NC Breast and Cervical Cancer Control Program
  line32:           { page: 2, x: P2_DOLLAR_X, y: 218, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 33: Add Lines 29 through 32
  line33:           { page: 2, x: P2_DOLLAR_X, y: 194, size: P2_DOLLAR_SIZE } as FieldPosition,
  // Line 34: Subtract Line 33 from Line 28 (Amount to Be Refunded)
  line34:           { page: 2, x: P2_DOLLAR_X, y: 168, size: P2_DOLLAR_SIZE } as FieldPosition,
}
