/**
 * KY Form 740 PDF AcroForm field name mapping.
 *
 * Field names correspond to the AcroForm fields in the official KY Form 740 PDF
 * from the Kentucky Department of Revenue (2025 form).
 *
 * The KY Form 740 PDF has proper AcroForm text fields that can be filled
 * directly by name.
 */

// ── Header / Personal Information ──────────────────────────────

export const KY740_HEADER = {
  name:               '740Name',
  primarySSN:         '740PrimarySSN',
  spouseSSN:          '740SpouseSSN',
  streetAddress:      '740StreetAddress2',
  city:               '740City',
  state:              '740State',
  zip:                '740Zip',
  beginningDate:      '740BeginningDate',
  endingDate:         '740EndingDate',
  filingStatus:       '740FilingStatus',
  mfsSpouseName:      '740SFS4SpouseName',
  deceasedTaxpayer:   '740DeceasedIndTaxpayer',
  deceasedSpouse:     '740DeceasedIndSpouse',
  amended:            'AmendedCheckbox',
}

// ── Income (Lines 5-12) ────────────────────────────────────────
// Lines have A (you) and B (spouse) columns for MFS filers

export const KY740_INCOME = {
  // Line 5: Wages, salaries, tips, etc.
  line5A:             '740Line5A',
  line5B:             '740Line5B',
  // Line 6: Interest income
  line6A:             '740Line6A',
  line6B:             '740Line6B',
  // Line 7: Dividend income
  line7A:             '740Line7A',
  line7B:             '740Line7B',
  // Line 8: Business income or loss
  line8A:             '740Line8A',
  line8B:             '740Line8B',
  // Line 9: Capital gain or loss
  line9A:             '740Line9A',
  line9B:             '740Line9B',
  // Line 10: Other gains or losses
  line10A:            '740Line10A',
  line10B:            '740Line10B',
  // Line 11: Other income
  line11A:            '740Line11A',
  line11B:            '740Line11B',
  // Line 12: Total income (sum of lines 5-11)
  line12A:            '740Line12A',
  line12B:            '740Line12B',
}

// ── Adjustments / Deductions (Lines 13-19) ─────────────────────

export const KY740_DEDUCTIONS = {
  // Line 13: Federal adjustments
  line13A:            '740Line13A',
  line13B:            '740Line13B',
  // Line 14: Adjusted gross income (Line 12 minus Line 13)
  line14A:            '740Line14A',
  line14B:            '740Line14B',
  // Line 15: Additions from Schedule M
  line15A:            '740Line15A',
  line15B:            '740Line15B',
  // Line 16: Subtractions from Schedule M
  line16A:            '740Line16A',
  line16B:            '740Line16B',
  // Line 17: KY AGI (Line 14 + Line 15 - Line 16)
  line17A:            '740Line17A',
  line17B:            '740Line17B',
  // Line 18: Standard deduction or itemized deductions
  line18A:            '740Line18A',
  line18B:            '740Line18B',
  // Line 19: Taxable income (Line 17 - Line 18)
  line19:             '740Line19',
}

// ── Tax & Credits (Lines 21-30) ────────────────────────────────

export const KY740_TAX = {
  // Line 21: Family Size Tax Credit decimal
  fstcDecimal:        '740Line21FSTCdecimal',
  // Line 21: Family Size Tax Credit percentage
  fstcPercentage:     '740Line21FSTCPercentage',
  // Line 21: Family Size Tax Credit
  line21:             '740Line21',
  // Line 22: KY income tax after FSTC
  line22:             '740Line22',
  // Line 23: Other nonrefundable credits
  line23:             '740Line23',
  // Line 24: Tax credit
  line24:             '740Line24',
  // Line 26: Tax after nonrefundable credits
  line26:             '740Line26',
  // Line 27: Limited liability entity tax
  line27:             '740Line27',
  // Line 28: Use tax
  line28:             '740Line28',
  // Line 29: Additional tax
  line29:             '740Line29',
  // Line 30: Total tax
  line30:             '740Line30',
}

// ── Payments (Lines 31-36) ─────────────────────────────────────

export const KY740_PAYMENTS = {
  // Line 31a: KY income tax withheld (W-2s)
  line31a:            '740Line31a',
  // Line 31b: KY income tax withheld (1099s)
  line31b:            '740Line31b',
  // Line 31c: KY income tax withheld (K-1s)
  line31c:            '740Line31c',
  // Line 31d: KY income tax withheld (Schedule K-1)
  line31d:            '740Line31d',
  // Line 31e-h: Other withholding
  line31e:            '740Line31e',
  line31f:            '740Line31f',
  line31g:            '740Line31g',
  line31h:            '740Line31h',
  // Line 32: Total Kentucky income tax withheld
  line32:             '740Line32',
  // Line 33: Estimated tax payments
  line33:             '740Line33',
  // Line 34a-d: Other payments
  line34a:            '740Line34a',
  line34b:            '740Line34b',
  line34c:            '740Line34c',
  line34d:            '740Line34d',
  // Line 35: Total payments and credits
  line35:             '740Line35',
  // Line 36: Underpayment (if tax > payments)
  line36:             '740Line36',
}

// ── Result (Lines 37-41) ───────────────────────────────────────

export const KY740_RESULT = {
  // Line 37: Tax due
  line37:             '740Line37',
  // Line 38a-k: Overpayment allocations
  line38a:            '740Line38a',
  line38b:            '740Line38b',
  line38c:            '740Line38c',
  line38d:            '740Line38d',
  line38e:            '740Line38e',
  line38f:            '740Line38f',
  line38g:            '740Line38g',
  line38h:            '740Line38h',
  line38i:            '740Line38i',
  line38j:            '740Line38j',
  line38k:            '740Line38k',
  // Line 39: Total contributions
  line39:             '740Line39',
  // Line 40: Net refund
  line40:             '740Line40',
  // Line 41: Amount you owe
  line41:             '740Line41',
}

// ── Signature ──────────────────────────────────────────────────

export const KY740_SIGNATURE = {
  driverLicTP:        '740DriversLic-TP',
  sigDateTP:          '740TP1SigDate',
  phone:              '740DaytimePhoneNum',
  driverLicSP:        '740DriversLic-SP',
  sigDateSP:          '740TP2SigDate',
  preparerSigDate:    '740PreparerSigDate',
  firmName:           '740FirmName',
  preparerID:         '740PreparerID',
  prepEmail:          '740PrepEmail',
  preparerPhone:      '740PreparerPhoneNum',
}
