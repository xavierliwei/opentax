/**
 * GA Form 500 PDF field coordinate mapping.
 *
 * The official GA Form 500 PDF from the Georgia Department of Revenue is a flat
 * (non-fillable) form, so we overlay text at specific (x, y) coordinates rather
 * than filling named AcroForm fields. Coordinates are in PDF points with origin
 * at bottom-left of each page (612 x 792 pt).
 *
 * Calibrated against the 2024 GA Form 500 (Rev. 08/01/24) using pdftotext
 * bounding-box extraction.
 *
 * Page 0 = Header (name, SSN, address, residency, filing status, DOB, dependents)
 * Page 1 = Dependent details, Income lines 8-13
 * Page 2 = Lines 14-23 (tax, credits), Income statements A-C
 * Page 3 = Income statements D-F, Lines 24-39 (payments, donations)
 * Page 4 = Lines 40-46 (penalties, refund), Signature
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

export const GA500_HEADER = {
  // Your first name + middle initial (below "YOUR FIRST NAME" label)
  firstName:        { page: 0, x: 55, y: 488, size: 9, maxWidth: 220 } as FieldPosition,
  // Last name (below "LAST NAME" label)
  lastName:         { page: 0, x: 55, y: 453, size: 9, maxWidth: 220 } as FieldPosition,
  // Your Social Security Number (right of "YOUR SOCIAL SECURITY NUMBER")
  yourSSN:          { page: 0, x: 315, y: 488, size: 9 } as FieldPosition,
  // Suffix
  suffix:           { page: 0, x: 365, y: 453, size: 9 } as FieldPosition,

  // Spouse first name + MI
  spouseFirstName:  { page: 0, x: 55, y: 418, size: 9, maxWidth: 220 } as FieldPosition,
  // Spouse last name
  spouseLastName:   { page: 0, x: 55, y: 381, size: 9, maxWidth: 220 } as FieldPosition,
  // Spouse SSN
  spouseSSN:        { page: 0, x: 315, y: 418, size: 9 } as FieldPosition,

  // Address line 1 (NUMBER AND STREET or P.O. BOX)
  addressLine1:     { page: 0, x: 55, y: 321, size: 9, maxWidth: 340 } as FieldPosition,
  // Address line 2 (Apt, Suite, Building Number)
  addressLine2:     { page: 0, x: 55, y: 307, size: 8, maxWidth: 340 } as FieldPosition,

  // City
  city:             { page: 0, x: 55, y: 273, size: 9, maxWidth: 265 } as FieldPosition,
  // State
  state:            { page: 0, x: 335, y: 273, size: 9 } as FieldPosition,
  // ZIP code
  zip:              { page: 0, x: 380, y: 273, size: 9 } as FieldPosition,
}

// ── Page 0: Residency Status ────────────────────────────────
// Line 4: Enter residency status number (1/2/3)

export const GA500_RESIDENCY = {
  // Box to enter 1, 2, or 3 for residency status
  statusCode:       { page: 0, x: 530, y: 200, size: 10 } as FieldPosition,
  // Part-year "FROM" date
  partYearFrom:     { page: 0, x: 230, y: 178, size: 8 } as FieldPosition,
  // Part-year "TO" date
  partYearTo:       { page: 0, x: 370, y: 178, size: 8 } as FieldPosition,
}

// ── Page 0: Filing Status ───────────────────────────────────
// Line 5: Enter filing status letter (A/B/C/D)

export const GA500_FILING_STATUS = {
  // Box to enter A, B, C, or D
  statusLetter:     { page: 0, x: 530, y: 129, size: 10 } as FieldPosition,
}

// ── Page 0: Date of Birth / Dependents ──────────────────────

export const GA500_DOB = {
  yourDOB:          { page: 0, x: 55, y: 80, size: 9 } as FieldPosition,
  spouseDOB:        { page: 0, x: 300, y: 80, size: 9 } as FieldPosition,
  // Line 7c: Total number of dependents
  totalDependents:  { page: 0, x: 530, y: 58, size: 10 } as FieldPosition,
}

// ── Page 1: SSN Header ──────────────────────────────────────

export const GA500_PAGE1_HEADER = {
  ssn:              { page: 1, x: 435, y: 718, size: 9 } as FieldPosition,
}

// ── Page 1: Dependent Details (up to 4) ─────────────────────

export const GA500_DEPENDENTS = {
  dep1Name:  { page: 1, x: 48, y: 643, size: 8, maxWidth: 200 } as FieldPosition,
  dep1Last:  { page: 1, x: 310, y: 643, size: 8, maxWidth: 150 } as FieldPosition,
  dep1SSN:   { page: 1, x: 48, y: 621, size: 8 } as FieldPosition,
  dep1Rel:   { page: 1, x: 310, y: 621, size: 8 } as FieldPosition,

  dep2Name:  { page: 1, x: 48, y: 571, size: 8, maxWidth: 200 } as FieldPosition,
  dep2Last:  { page: 1, x: 310, y: 571, size: 8, maxWidth: 150 } as FieldPosition,
  dep2SSN:   { page: 1, x: 48, y: 549, size: 8 } as FieldPosition,
  dep2Rel:   { page: 1, x: 310, y: 549, size: 8 } as FieldPosition,

  dep3Name:  { page: 1, x: 48, y: 499, size: 8, maxWidth: 200 } as FieldPosition,
  dep3Last:  { page: 1, x: 310, y: 499, size: 8, maxWidth: 150 } as FieldPosition,
  dep3SSN:   { page: 1, x: 48, y: 477, size: 8 } as FieldPosition,
  dep3Rel:   { page: 1, x: 310, y: 477, size: 8 } as FieldPosition,

  dep4Name:  { page: 1, x: 48, y: 427, size: 8, maxWidth: 200 } as FieldPosition,
  dep4Last:  { page: 1, x: 310, y: 427, size: 8, maxWidth: 150 } as FieldPosition,
  dep4SSN:   { page: 1, x: 48, y: 405, size: 8 } as FieldPosition,
  dep4Rel:   { page: 1, x: 310, y: 405, size: 8 } as FieldPosition,
}

// ── Page 1: Income Lines 8–13 ──────────────────────────────
// Dollar amounts in right-hand column

const P1_DOLLAR_X = 395  // Left edge of dollar amount entry area on page 1
const DOLLAR_SIZE = 9

export const GA500_INCOME = {
  // Line 8: Federal adjusted gross income
  line8:   { page: 1, x: P1_DOLLAR_X, y: 310, size: DOLLAR_SIZE } as FieldPosition,
  // Line 9: Adjustments from Form 500 Schedule 1
  line9:   { page: 1, x: P1_DOLLAR_X, y: 275, size: DOLLAR_SIZE } as FieldPosition,
  // Line 10: Georgia adjusted gross income
  line10:  { page: 1, x: P1_DOLLAR_X, y: 250, size: DOLLAR_SIZE } as FieldPosition,
  // Line 11: Standard deduction
  line11:  { page: 1, x: P1_DOLLAR_X, y: 225, size: DOLLAR_SIZE } as FieldPosition,
  // Line 12a: Federal itemized deductions
  line12a: { page: 1, x: P1_DOLLAR_X, y: 141, size: DOLLAR_SIZE } as FieldPosition,
  // Line 12b: Less adjustments
  line12b: { page: 1, x: P1_DOLLAR_X, y: 117, size: DOLLAR_SIZE } as FieldPosition,
  // Line 12c: Georgia total itemized deductions
  line12c: { page: 1, x: P1_DOLLAR_X, y: 94, size: DOLLAR_SIZE } as FieldPosition,
  // Line 13: Balance (Line 10 minus Line 11 or 12c)
  line13:  { page: 1, x: P1_DOLLAR_X, y: 70, size: DOLLAR_SIZE } as FieldPosition,
}

// ── Page 2: SSN Header ──────────────────────────────────────

export const GA500_PAGE2_HEADER = {
  ssn:     { page: 2, x: 435, y: 718, size: 9 } as FieldPosition,
}

// ── Page 2: Lines 14–23 (Tax / Credits) ─────────────────────

const P2_DOLLAR_X = 395  // Left edge of dollar amount entry area on page 2

export const GA500_TAX = {
  // Line 14: Number from Line 7c x $4,000
  line14:   { page: 2, x: P2_DOLLAR_X, y: 634, size: DOLLAR_SIZE } as FieldPosition,
  // Line 14 count (number of dependents for multiplication)
  line14count: { page: 2, x: 260, y: 634, size: DOLLAR_SIZE } as FieldPosition,
  // Line 15a: Income before GA NOL
  line15a:  { page: 2, x: P2_DOLLAR_X, y: 610, size: DOLLAR_SIZE } as FieldPosition,
  // Line 15b: Georgia NOL utilized
  line15b:  { page: 2, x: P2_DOLLAR_X, y: 587, size: DOLLAR_SIZE } as FieldPosition,
  // Line 15c: Georgia taxable income
  line15c:  { page: 2, x: P2_DOLLAR_X, y: 562, size: DOLLAR_SIZE } as FieldPosition,
  // Line 16: Tax (5.39% of Line 15c)
  line16:   { page: 2, x: P2_DOLLAR_X, y: 538, size: DOLLAR_SIZE } as FieldPosition,
  // Line 17a: Low income credit (number code)
  line17a:  { page: 2, x: 110, y: 514, size: 8 } as FieldPosition,
  // Line 17b: Low income credit (code 2)
  line17b:  { page: 2, x: 210, y: 514, size: 8 } as FieldPosition,
  // Line 17c: Low income credit amount
  line17c:  { page: 2, x: P2_DOLLAR_X, y: 514, size: DOLLAR_SIZE } as FieldPosition,
  // Line 18: Other state(s) tax credit
  line18:   { page: 2, x: P2_DOLLAR_X, y: 489, size: DOLLAR_SIZE } as FieldPosition,
  // Line 19: Georgia Resident Itemizer Tax Credit
  line19:   { page: 2, x: P2_DOLLAR_X, y: 466, size: DOLLAR_SIZE } as FieldPosition,
  // Line 20: Credits from IND-CR Summary Worksheet
  line20:   { page: 2, x: P2_DOLLAR_X, y: 441, size: DOLLAR_SIZE } as FieldPosition,
  // Line 21: Total Credits from Schedule 2
  line21:   { page: 2, x: P2_DOLLAR_X, y: 418, size: DOLLAR_SIZE } as FieldPosition,
  // Line 22: Total credits used (sum of 17-21, cannot exceed Line 16)
  line22:   { page: 2, x: P2_DOLLAR_X, y: 382, size: DOLLAR_SIZE } as FieldPosition,
  // Line 23: Balance (Line 16 minus Line 22)
  line23:   { page: 2, x: P2_DOLLAR_X, y: 358, size: DOLLAR_SIZE } as FieldPosition,
}

// ── Page 2: Income Statement A–C (withholding details) ──────

export const GA500_INCOME_STMT_A = {
  fein:    { page: 2, x: 46, y: 215, size: 7 } as FieldPosition,
  wages:   { page: 2, x: 46, y: 146, size: 7 } as FieldPosition,
  withheld:{ page: 2, x: 46, y: 113, size: 7 } as FieldPosition,
}

export const GA500_INCOME_STMT_B = {
  fein:    { page: 2, x: 223, y: 215, size: 7 } as FieldPosition,
  wages:   { page: 2, x: 223, y: 146, size: 7 } as FieldPosition,
  withheld:{ page: 2, x: 223, y: 113, size: 7 } as FieldPosition,
}

export const GA500_INCOME_STMT_C = {
  fein:    { page: 2, x: 401, y: 215, size: 7 } as FieldPosition,
  wages:   { page: 2, x: 401, y: 146, size: 7 } as FieldPosition,
  withheld:{ page: 2, x: 401, y: 113, size: 7 } as FieldPosition,
}

// ── Page 3: SSN Header ──────────────────────────────────────

export const GA500_PAGE3_HEADER = {
  ssn:     { page: 3, x: 435, y: 718, size: 9 } as FieldPosition,
}

// ── Page 3: Lines 24–39 (Payments / Balance / Donations) ────

const P3_DOLLAR_X = 395  // Left edge of dollar amount entry area on page 3

export const GA500_PAYMENTS = {
  // Line 24: Georgia income tax withheld on wages/1099s
  line24:   { page: 3, x: P3_DOLLAR_X, y: 430, size: DOLLAR_SIZE } as FieldPosition,
  // Line 25: Other Georgia income tax withheld
  line25:   { page: 3, x: P3_DOLLAR_X, y: 406, size: DOLLAR_SIZE } as FieldPosition,
  // Line 26: Estimated tax paid
  line26:   { page: 3, x: P3_DOLLAR_X, y: 381, size: DOLLAR_SIZE } as FieldPosition,
  // Line 27: Schedule 2B refundable tax credits
  line27:   { page: 3, x: P3_DOLLAR_X, y: 358, size: DOLLAR_SIZE } as FieldPosition,
  // Line 28: Total prepayment credits (24+25+26+27)
  line28:   { page: 3, x: P3_DOLLAR_X, y: 333, size: DOLLAR_SIZE } as FieldPosition,
  // Line 29: Balance due (Line 23 exceeds Line 28)
  line29:   { page: 3, x: P3_DOLLAR_X, y: 297, size: DOLLAR_SIZE } as FieldPosition,
  // Line 30: Overpayment (Line 28 exceeds Line 23)
  line30:   { page: 3, x: P3_DOLLAR_X, y: 275, size: DOLLAR_SIZE } as FieldPosition,
  // Line 31: Amount credited to estimated tax
  line31:   { page: 3, x: P3_DOLLAR_X, y: 249, size: DOLLAR_SIZE } as FieldPosition,
  // Lines 32-39: Donation funds
  line32:   { page: 3, x: P3_DOLLAR_X, y: 227, size: DOLLAR_SIZE } as FieldPosition,
  line33:   { page: 3, x: P3_DOLLAR_X, y: 203, size: DOLLAR_SIZE } as FieldPosition,
  line34:   { page: 3, x: P3_DOLLAR_X, y: 179, size: DOLLAR_SIZE } as FieldPosition,
  line35:   { page: 3, x: P3_DOLLAR_X, y: 155, size: DOLLAR_SIZE } as FieldPosition,
  line36:   { page: 3, x: P3_DOLLAR_X, y: 129, size: DOLLAR_SIZE } as FieldPosition,
  line37:   { page: 3, x: P3_DOLLAR_X, y: 106, size: DOLLAR_SIZE } as FieldPosition,
  line38:   { page: 3, x: P3_DOLLAR_X, y: 82, size: DOLLAR_SIZE } as FieldPosition,
  line39:   { page: 3, x: P3_DOLLAR_X, y: 58, size: DOLLAR_SIZE } as FieldPosition,
}

// ── Page 4: SSN Header ──────────────────────────────────────

export const GA500_PAGE4_HEADER = {
  ssn:     { page: 4, x: 435, y: 718, size: 9 } as FieldPosition,
}

// ── Page 4: Lines 40–46 (Penalties / Refund) ────────────────

const P4_DOLLAR_X = 395  // Left edge of dollar amount entry area on page 4

export const GA500_REFUND = {
  // Lines 40-44: Additional donation funds / penalties
  line40:   { page: 4, x: P4_DOLLAR_X, y: 658, size: DOLLAR_SIZE } as FieldPosition,
  line41:   { page: 4, x: P4_DOLLAR_X, y: 633, size: DOLLAR_SIZE } as FieldPosition,
  line42:   { page: 4, x: P4_DOLLAR_X, y: 609, size: DOLLAR_SIZE } as FieldPosition,
  line43:   { page: 4, x: P4_DOLLAR_X, y: 586, size: DOLLAR_SIZE } as FieldPosition,
  line44:   { page: 4, x: P4_DOLLAR_X, y: 562, size: DOLLAR_SIZE } as FieldPosition,
  // Line 45: Total amount due (sum of 29, 32-44)
  line45:   { page: 4, x: P4_DOLLAR_X, y: 537, size: DOLLAR_SIZE } as FieldPosition,
  // Line 46: Refund (Line 30 minus sum of 31-44)
  line46:   { page: 4, x: P4_DOLLAR_X, y: 479, size: DOLLAR_SIZE } as FieldPosition,
}
