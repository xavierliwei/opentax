/**
 * CT Form CT-1040 PDF field coordinate mapping.
 *
 * The official CT-1040 PDF from DRS is a flat (non-fillable) form, so we
 * overlay text at specific (x, y) coordinates rather than filling named
 * AcroForm fields.  Coordinates are in PDF points with origin at
 * bottom-left of each page (589.68 × 774 pt).
 *
 * Calibrated against the 2024 CT-1040 form (ct-1040_1224.pdf) using
 * grid-overlay testing.
 *
 * Page 1 = Header, Filing Status, Income (Lines 1-16)
 * Page 2 = Withholding, Payments, Tax Due / Refund (Lines 17-30)
 * Page 3 = Schedule 1 (Modifications to Federal AGI, Lines 31-50)
 * Page 4 = Schedule 3 (Property Tax Credit), Schedule 4, Schedule 5
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

// ── Page 1: Header ──────────────────────────────────────────

export const CT1040_HEADER = {
  // Your Social Security Number (top-left boxes)
  yourSSN:          { page: 0, x: 140, y: 714, size: 9 } as FieldPosition,
  // Spouse's Social Security Number (top-right boxes)
  spouseSSN:        { page: 0, x: 395, y: 714, size: 9 } as FieldPosition,

  // Your first name and middle initial
  firstName:        { page: 0, x: 85,  y: 601, size: 9, maxWidth: 185 } as FieldPosition,
  // Your last name
  lastName:         { page: 0, x: 280, y: 601, size: 9, maxWidth: 140 } as FieldPosition,

  // Spouse/civil union partner first name
  spouseFirstName:  { page: 0, x: 85,  y: 581, size: 9, maxWidth: 185 } as FieldPosition,
  // Spouse last name
  spouseLastName:   { page: 0, x: 280, y: 581, size: 9, maxWidth: 140 } as FieldPosition,

  // Mailing address (number and street)
  street:           { page: 0, x: 85,  y: 561, size: 9, maxWidth: 275 } as FieldPosition,
  // Apartment number
  apt:              { page: 0, x: 370, y: 561, size: 9, maxWidth: 60  } as FieldPosition,

  // City, town, or post office
  city:             { page: 0, x: 85,  y: 541, size: 9, maxWidth: 245 } as FieldPosition,
  // State
  state:            { page: 0, x: 340, y: 541, size: 9 } as FieldPosition,
  // ZIP code
  zip:              { page: 0, x: 395, y: 541, size: 9 } as FieldPosition,

  // City or town of legal residence (if different)
  residenceCity:    { page: 0, x: 85,  y: 525, size: 9, maxWidth: 245 } as FieldPosition,
  // Residence ZIP code
  residenceZip:     { page: 0, x: 340, y: 525, size: 9 } as FieldPosition,
}

// ── Page 1: Filing Status ───────────────────────────────────
// Checkbox positions — we draw an "X" at these coordinates

export const CT1040_FILING_STATUS = {
  single:   { page: 0, x: 77, y: 669, size: 10 } as FieldPosition,
  hoh:      { page: 0, x: 262, y: 669, size: 10 } as FieldPosition,
  mfs:      { page: 0, x: 405, y: 669, size: 10 } as FieldPosition,
  mfj:      { page: 0, x: 77, y: 655, size: 10 } as FieldPosition,
  qw:       { page: 0, x: 262, y: 655, size: 10 } as FieldPosition,
}

// ── Page 1: Income (Lines 1–16) ─────────────────────────────
// Dollar amounts in the right-hand column

const DOLLAR_X = 505   // Left edge of dollar amount column
const DOLLAR_SIZE = 9

export const CT1040_INCOME = {
  line1:  { page: 0, x: DOLLAR_X, y: 369, size: DOLLAR_SIZE } as FieldPosition,  // Federal AGI
  line2:  { page: 0, x: DOLLAR_X, y: 352, size: DOLLAR_SIZE } as FieldPosition,  // Additions from Schedule 1
  line3:  { page: 0, x: DOLLAR_X, y: 336, size: DOLLAR_SIZE } as FieldPosition,  // Add Lines 1 and 2
  line4:  { page: 0, x: DOLLAR_X, y: 320, size: DOLLAR_SIZE } as FieldPosition,  // Subtractions from Schedule 1
  line5:  { page: 0, x: DOLLAR_X, y: 304, size: DOLLAR_SIZE } as FieldPosition,  // CT AGI (Line 3 minus Line 4)
  line6:  { page: 0, x: DOLLAR_X, y: 289, size: DOLLAR_SIZE } as FieldPosition,  // Income from Table A or B
  line7:  { page: 0, x: DOLLAR_X, y: 273, size: DOLLAR_SIZE } as FieldPosition,  // Personal exemption
  line8:  { page: 0, x: DOLLAR_X, y: 257, size: DOLLAR_SIZE } as FieldPosition,  // CT taxable income (Line 6 minus Line 7)
  line9:  { page: 0, x: DOLLAR_X, y: 241, size: DOLLAR_SIZE } as FieldPosition,  // Tax from tax tables or Schedule
  line10: { page: 0, x: DOLLAR_X, y: 225, size: DOLLAR_SIZE } as FieldPosition,  // Credit from Table C
  line11: { page: 0, x: DOLLAR_X, y: 206, size: DOLLAR_SIZE } as FieldPosition,  // Line 9 minus Line 10
  // Lines 11a-11d (Table D recapture) are in the left column area
  line11a: { page: 0, x: 260, y: 189, size: 8 } as FieldPosition,  // Table D recapture amount
  line11b: { page: 0, x: 260, y: 176, size: 8 } as FieldPosition,
  line11c: { page: 0, x: 260, y: 163, size: 8 } as FieldPosition,
  line12: { page: 0, x: DOLLAR_X, y: 152, size: DOLLAR_SIZE } as FieldPosition,  // CT income tax
  line13: { page: 0, x: DOLLAR_X, y: 136, size: DOLLAR_SIZE } as FieldPosition,  // Credit (property tax, etc.)
  line14: { page: 0, x: DOLLAR_X, y: 120, size: DOLLAR_SIZE } as FieldPosition,  // Balance (Line 12 minus Line 13)
  line15: { page: 0, x: DOLLAR_X, y: 104, size: DOLLAR_SIZE } as FieldPosition,  // Individual use tax
  line16: { page: 0, x: DOLLAR_X, y: 88,  size: DOLLAR_SIZE } as FieldPosition,  // Total tax (Line 14 + Line 15)
}

// ── Page 2: Payments / Tax Due / Refund (Lines 17–30) ───────

export const CT1040_PAGE2_HEADER = {
  ssn: { page: 1, x: 450, y: 752, size: 9 } as FieldPosition,
}

export const CT1040_PAYMENTS = {
  line17: { page: 1, x: DOLLAR_X, y: 728, size: DOLLAR_SIZE } as FieldPosition,  // Enter amount from Line 16

  // W-2 withholding table (Lines 18a–18f)
  // Column A = Employer FEIN, Column B = CT wages, Column C = CT tax withheld
  w2: [
    { fein: { page: 1, x: 125, y: 690, size: 8 }, wages: { page: 1, x: 320, y: 690, size: 8 }, withheld: { page: 1, x: 465, y: 690, size: 8 } },
    { fein: { page: 1, x: 125, y: 677, size: 8 }, wages: { page: 1, x: 320, y: 677, size: 8 }, withheld: { page: 1, x: 465, y: 677, size: 8 } },
    { fein: { page: 1, x: 125, y: 664, size: 8 }, wages: { page: 1, x: 320, y: 664, size: 8 }, withheld: { page: 1, x: 465, y: 664, size: 8 } },
    { fein: { page: 1, x: 125, y: 651, size: 8 }, wages: { page: 1, x: 320, y: 651, size: 8 }, withheld: { page: 1, x: 465, y: 651, size: 8 } },
    { fein: { page: 1, x: 125, y: 638, size: 8 }, wages: { page: 1, x: 320, y: 638, size: 8 }, withheld: { page: 1, x: 465, y: 638, size: 8 } },
    { fein: { page: 1, x: 125, y: 625, size: 8 }, wages: { page: 1, x: 320, y: 625, size: 8 }, withheld: { page: 1, x: 465, y: 625, size: 8 } },
  ] as Array<{ fein: FieldPosition; wages: FieldPosition; withheld: FieldPosition }>,

  line18: { page: 1, x: DOLLAR_X, y: 610, size: DOLLAR_SIZE } as FieldPosition,  // Total CT tax withheld
  line19: { page: 1, x: DOLLAR_X, y: 593, size: DOLLAR_SIZE } as FieldPosition,  // All 2024 estimated tax payments
  line20: { page: 1, x: DOLLAR_X, y: 576, size: DOLLAR_SIZE } as FieldPosition,  // Payments with extension
  line20a: { page: 1, x: DOLLAR_X, y: 559, size: DOLLAR_SIZE } as FieldPosition, // CT EITC
  line20b: { page: 1, x: DOLLAR_X, y: 542, size: DOLLAR_SIZE } as FieldPosition, // CT Child Tax Rebate
  line20c: { page: 1, x: DOLLAR_X, y: 525, size: DOLLAR_SIZE } as FieldPosition, // Excess PE Tax Credit
  line21: { page: 1, x: DOLLAR_X, y: 508, size: DOLLAR_SIZE } as FieldPosition,  // Total payments (sum 18-20c)
  line22: { page: 1, x: DOLLAR_X, y: 491, size: DOLLAR_SIZE } as FieldPosition,  // Tax due (Line 17 minus Line 21, if 17 > 21)

  // Refund section
  line23: { page: 1, x: DOLLAR_X, y: 457, size: DOLLAR_SIZE } as FieldPosition,  // Overpayment (Line 21 minus Line 17, if 21 > 17)
  line24: { page: 1, x: DOLLAR_X, y: 440, size: DOLLAR_SIZE } as FieldPosition,  // Applied to 2025 estimated tax
  line25: { page: 1, x: DOLLAR_X, y: 424, size: DOLLAR_SIZE } as FieldPosition,  // Refund (Line 23 minus Line 24)

  // Tax due section
  line26: { page: 1, x: DOLLAR_X, y: 361, size: DOLLAR_SIZE } as FieldPosition,  // Tax due (if Line 22 > 0)
  line27: { page: 1, x: DOLLAR_X, y: 344, size: DOLLAR_SIZE } as FieldPosition,  // Penalty for late filing
  line28: { page: 1, x: DOLLAR_X, y: 327, size: DOLLAR_SIZE } as FieldPosition,  // Interest
  line29: { page: 1, x: DOLLAR_X, y: 312, size: DOLLAR_SIZE } as FieldPosition,  // Interest on underpayment
  line30: { page: 1, x: DOLLAR_X, y: 295, size: DOLLAR_SIZE } as FieldPosition,  // Total amount due (sum 26-29)

  // Direct deposit routing/account fields
  routingNumber: { page: 1, x: 130, y: 254, size: 9 } as FieldPosition,
  accountNumber: { page: 1, x: 350, y: 254, size: 9 } as FieldPosition,
}

// ── Page 3: Schedule 1 — Modifications to Federal AGI ───────

export const CT1040_SCHEDULE1 = {
  // Page 3 header SSN
  ssn: { page: 2, x: 450, y: 752, size: 9 } as FieldPosition,

  // Additions to Federal AGI (Lines 31-37)
  line31: { page: 2, x: DOLLAR_X, y: 695, size: DOLLAR_SIZE } as FieldPosition,  // Interest on non-CT state/municipal bonds
  line32: { page: 2, x: DOLLAR_X, y: 678, size: DOLLAR_SIZE } as FieldPosition,  // Mutual fund exempt-interest dividends
  line33: { page: 2, x: DOLLAR_X, y: 661, size: DOLLAR_SIZE } as FieldPosition,  // Other additions (from Schedule 1, Line 38)
  line34: { page: 2, x: DOLLAR_X, y: 644, size: DOLLAR_SIZE } as FieldPosition,  // Total additions (sum 31-33)

  // Subtractions from Federal AGI (Lines 35-50)
  line35: { page: 2, x: DOLLAR_X, y: 610, size: DOLLAR_SIZE } as FieldPosition,  // Interest on US obligations
  line36: { page: 2, x: DOLLAR_X, y: 593, size: DOLLAR_SIZE } as FieldPosition,  // Exempt dividends from CT bonds
  line37: { page: 2, x: DOLLAR_X, y: 576, size: DOLLAR_SIZE } as FieldPosition,  // Social Security benefit adjustment
  line38: { page: 2, x: DOLLAR_X, y: 559, size: DOLLAR_SIZE } as FieldPosition,  // Tier 1 & Tier 2 railroad retirement
  line39: { page: 2, x: DOLLAR_X, y: 542, size: DOLLAR_SIZE } as FieldPosition,  // Military retirement pay
  line40: { page: 2, x: DOLLAR_X, y: 525, size: DOLLAR_SIZE } as FieldPosition,  // CT Teachers' Retirement System
  line41: { page: 2, x: DOLLAR_X, y: 508, size: DOLLAR_SIZE } as FieldPosition,  // Refund of state/local income taxes
  line42: { page: 2, x: DOLLAR_X, y: 491, size: DOLLAR_SIZE } as FieldPosition,  // Other subtractions
  line43: { page: 2, x: DOLLAR_X, y: 474, size: DOLLAR_SIZE } as FieldPosition,  // Total subtractions (sum 35-42)
}

// ── Page 4: Schedules 3/4/5 ────────────────────────────────

export const CT1040_SCHEDULE3 = {
  // Page 4 header SSN
  ssn: { page: 3, x: 450, y: 752, size: 9 } as FieldPosition,

  // Schedule 3: Property Tax Credit (Lines 60-68)
  line60: { page: 3, x: DOLLAR_X, y: 668, size: DOLLAR_SIZE } as FieldPosition,  // Property tax paid
  line61: { page: 3, x: DOLLAR_X, y: 651, size: DOLLAR_SIZE } as FieldPosition,  // Property tax limit
  line62: { page: 3, x: DOLLAR_X, y: 634, size: DOLLAR_SIZE } as FieldPosition,  // Enter lesser of Line 60 or 61
  line63: { page: 3, x: DOLLAR_X, y: 617, size: DOLLAR_SIZE } as FieldPosition,  // Decimal amount from Table
  line64: { page: 3, x: DOLLAR_X, y: 600, size: DOLLAR_SIZE } as FieldPosition,  // Multiply Line 62 by Line 63
  line65: { page: 3, x: DOLLAR_X, y: 583, size: DOLLAR_SIZE } as FieldPosition,  // Enter amount from Line 9
  line66: { page: 3, x: DOLLAR_X, y: 566, size: DOLLAR_SIZE } as FieldPosition,  // Enter lesser of Line 64 or 65
  line67: { page: 3, x: DOLLAR_X, y: 549, size: DOLLAR_SIZE } as FieldPosition,  // Decimal from Table
  line68: { page: 3, x: DOLLAR_X, y: 532, size: DOLLAR_SIZE } as FieldPosition,  // Property tax credit (Line 66 × Line 67)
}
