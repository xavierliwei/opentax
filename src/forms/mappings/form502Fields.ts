/**
 * MD Form 502 PDF field name mapping.
 *
 * Field names discovered from Maryland 502.pdf using pdf-lib enumeration.
 * The official MD form uses descriptive field names rather than numbered
 * prefixes like CA's form.
 *
 * Page 1: Header, address, filing status, county/subdivision, residence dates
 * Page 2: Exemptions (A-D), Income lines 1-20
 * Page 3: Tax computation lines 21-46, local tax, payments, refund/owed
 * Page 4: Signature, direct deposit, paid preparer
 */

// ── Page 1: Header / Personal Info / Filing Status ─────────

export const F502_HEADER = {
  fiscalYearBegin:    'Enter day and month of Fiscal Year beginning',
  fiscalYearEnd:      'Enter day and month of Fiscal Year Ending',
  firstName:          'Enter your first name',
  middleInitial:      'Enter your middle initial',
  lastName:           'Enter your last name',
  ssn:                'Enter social security number',
  spouseFirstName:    'Enter Spouse\'s First Name',
  spouseMiddleInitial:'Enter Spouse\'s middle initial',
  spouseLastName:     'Enter Spouse\'s last name',
  spouseSSN:          'Enter spouse\'s social security number',
  addressLine1:       'Enter Current Mailing Address Line 1 (Street No. and Street Name or PO Box)',
  addressLine2:       'Enter Current Mailing Address Line 2 (Street No. and Street Name or PO Box)',
  city:               'Enter city or town',
  state:              'Enter state',
  zip:                'Enter zip code + 4',
  foreignCountry:     'Enter foreign country name',
  foreignProvince:    'Enter foreign country name 3',
  foreignPostal:      'Enter foreign postal code',
}

export const F502_FILING_STATUS = {
  // Checkboxes numbered 1-6 by position (y-coord ordering, 1=Single at top)
  single:     'Check Box - 1',    // Filing status 1: Single
  mfj:        'Check Box - 2',    // Filing status 2: Married filing jointly
  mfs:        'Check Box - 3',    // Filing status 3: Married filing separately
  hoh:        'Check Box - 4',    // Filing status 4: Head of household
  qw:         'Check Box - 5',    // Filing status 5: Qualifying widow(er)
  dependent:  '6. Check here',    // Filing status 6: Can be claimed as dependent
}

export const F502_COUNTY = {
  subdivisionCode:   'Enter 4 Digit Political Subdivision Code (See Instruction 6)',
  subdivisionName:   'Enter Maryland Political Subdivision (See Instruction 6)',
  physAddressLine1:  'Enter Maryland Physical Address Line 1 (Street No. and Street Name) (No PO Box)',
  physAddressLine2:  'Enter Maryland Physical Address Line 2 No. and Street Name) (No PO Box)',
  physCity:          'Enter city',
  physZip:           'Enter zip code + 5',
}

export const F502_RESIDENCE = {
  residenceFrom:     'Enter dates of Maryland Residence from MM/DD/YYYY',
  residenceTo:       'Enter dates of Maryland Residence to MM/DD/YYYY',
  partYearCode:      'If you began or ended legal residence in Maryland in 2023 place a P in the box.MILITARY: If you or ',
  militaryIncome:    'Enter Military Income amount here',
}

// ── Page 2: Exemptions ─────────────────────────────────────

export const F502_EXEMPTIONS = {
  // Exemptions — Section A: Regular
  yourselfRegular:      'Check Box 15',       // A. Yourself regular
  spouseRegular:        'Check Box 18',       // A. Spouse regular
  numRegular:           'Text Field 15',      // A. Number of regular exemptions
  yourselfOver65:       'Check Box 20',       // A. Yourself 65 or over
  spouseOver65:         'Check Box 21',       // A. Spouse 65 or over
  amountA:              'Enter A $',          // A. Dollar amount

  // Exemptions — Section B: Blind
  yourselfBlind:        'B. Check this box if you are blind',
  spouseBlind:          'B. Check this box if your spouse is blind',
  numBlind:             'B. Enter number exemptions checked B',
  amountB:              'Enter B $ ',

  // Exemptions — Section C: Dependents
  numDependents:        'Text Field 16',      // C. Number of dependents
  amountC:              'Enter C $ ',         // C. Dollar amount

  // Exemptions — Total D
  totalExemptions:      'D. Enter Dollar Amount Total Exemptions (Add A, B and C.) ',

  // Dependent detail checkboxes
  dep1Box:              'Check Box 27',       // First dependent checkbox
  dep2Box:              'Check Box 28',       // Second dependent checkbox
  dep3Box:              'Check Box 29',       // Third dependent checkbox
}

// ── Page 2: Income (Lines 1-20) ────────────────────────────

export const F502_INCOME = {
  line1:          'Enter 1',                // Line 1: Federal AGI
  line1a:         'Enter 1a',               // Line 1a: Wage adjustment
  line1b:         'Enter 1b',               // Line 1b: Wage adjustment
  line1c:         'Enter 1c',               // Line 1c: Wage adjustment
  line1d:         'Enter 1dEnter 1d',       // Line 1d: Wage adjustment (note: duplicate name in PDF)
  line1e:         'Enter Y of income more than $11,000',  // Line 1e: Income flag
  line2:          'Enter 2',                // Line 2: State retirement pickup
  line3:          'Enter 3',                // Line 3: Additions (Form 502SU)
  line4:          'Enter 4',                // Line 4: Total income (1+2+3)
  line5:          'Enter 5',                // Line 5: Subtractions (Form 502SU)
  line6:          'Enter 6',                // Line 6: Subtracted amount
  line7:          'Enter 7',                // Line 7: MD AGI
  line8:          'Enter 8',                // Line 8: Standard deduction
  line9:          'Enter 9',                // Line 9: Itemized deductions (from Sch. A)
  line10a:        'Enter 10a',              // Line 10a: Deduction (larger of 8 or 9)
  line10b:        'Enter 10b',              // Line 10b: Net of AGI less deduction
  line11:         'Enter 11',               // Line 11: Exemptions from Section D
  line12:         'Enter 12',               // Line 12: Net income (10b - 11)
  line13:         'Enter 13',               // Line 13: Taxable net income
  line14:         'Enter 14',               // Line 14: Maryland tax
  line15:         'Enter 15',               // Line 15: Earned income credit
  line16:         'Enter 16',               // Line 16: Poverty level credit
  line17a:        'Enter 17a ',             // Line 17a: Credits (various)
  line17b:        'Enter 17b',              // Line 17b: Credits (various)
  line17:         'Enter 17',               // Line 17: Total credits
  line18:         'Enter 18',               // Line 18: Tax after credits (14-17)
  line19:         'Enter 19 ',              // Line 19: State tax (if joint filing)
  line20:         'Enter 20',               // Line 20: Total Maryland tax
}

// ── Page 2: Dependent Details ──────────────────────────────

export const F502_DEPENDENTS = {
  // Lines 5-8 dependent detail on lower part of page 2
  dep1Name:      'Text Field 5',            // Dependent 1 first name
  dep1Last:      'Text Field 6',            // Dependent 1 last name
  dep1SSNa:      'Text Field 7',            // Dependent 1 SSN part a
  dep1SSNb:      'Text Field 8',            // Dependent 1 SSN part b
  dep2Name:      'Text Field 9',            // Dependent 2 first name
  dep2Last:      'Text Field 10',           // Dependent 2 last name
  dep2SSNa:      'Text Field 11',           // Dependent 2 SSN part a
  dep2SSNb:      'Text Field 12',           // Dependent 2 SSN part b
}

// ── Page 3: Tax Computation / Local Tax / Payments ─────────

export const F502_TAX = {
  // Tax computation check boxes
  taxTableCB:        'Check Box 36',        // Used tax table
  taxRateCalcCB:     'Check Box 37',        // Used tax rate computation
  localTaxRate:      'Enter local tax rate', // County/local tax rate

  // Lines 21+: Tax amounts (Text Box series maps to form lines)
  line21:   'Text Box 30',     // Line 21: State tax from table/rate
  line22:   'Text Box 32',     // Line 22: Local (county) tax
  line23:   'Text Box 34',     // Line 23: Total tax (state + local)
  // Lines 24-25 skipped
  line24:   'Text Box 36',     // Line 24: Earned income credit
  line25:   'Text Box 38',     // Line 25: Poverty level credit
  // Lines 26-29 credits
  line26:   'Text Box 40',     // Line 26: Additional credits (502CR)
  line27:   'Text Box 42',     // Line 27: Total credits (24+25+26)
  line28:   'Text Box 44',     // Line 28: Taxes after credits (23-27)
  // Lines 29-32 use tax
  line29:   'Text Box 46',     // Line 29: Use tax
  line30:   'Text Box 48',     // Line 30: Total Maryland tax, local tax, and contributions
  line31:   'Text Box 50',     // Line 31: Balance (30-contributions)
  line32:   'Text Box 52',     // Line 32: Additions to tax
  line33:   'Text Box 54',     // Line 33: Total Maryland tax and additions
}

export const F502_PAYMENTS = {
  line34:   'Text Box 56',     // Line 34: Total MD tax and local tax withheld
  line35:   'Text Box 58',     // Line 35a: Estimated tax payments
  line35b:  'Text Box 60',     // Line 35b: Extension payments
  line36:   'Text Box 62',     // Line 36: Earned income credit (refundable portion)
  line37:   'Text Box 64',     // Line 37: Total payments and credits (34+35+36)
  line38:   'Text Box 66',     // Line 38: Tax to pay if Line 33 > Line 37
  line38Cents:'Text Box 67',   // Line 38 cents
  line39:   'Text Box 68',     // Line 39: Interest and penalty
  line39Cents:'Text Box 69',   // Line 39 cents
  line40:   'Text Box 70',     // Line 40: Total amount due (38+39)
  line40Cents:'Text Box 71',   // Line 40 cents
  line41:   'Text Box 72',     // Line 41: Overpayment (37-33)
  line41Cents:'Text Box 73',   // Line 41 cents
  line42:   'Text Box 74',     // Line 42: Amount to apply to 2024 estimated tax
  line42Cents:'Text Box 75',   // Line 42 cents
  line43:   'Text Box 76',     // Line 43: Amount to refund to you
  line43Cents:'Text Box 77',   // Line 43 cents
}

export const F502_LOCAL_TAX = {
  line44:    'Text Box 78',    // Line 44: Local tax after credits
  line44Cents:'Text Box 79',   // Line 44 cents
  line45:    'Text Box 80',    // Line 45: Local tax withheld (W-2)
  line45Cents:'Text Box 81',   // Line 45 cents
  line46:    'Text Box 82',    // Line 46: Local earned income credit
  line46Cents:'Text Box 83',   // Line 46 cents
}

// ── Page 3: Refund/Owed continuation ───────────────────────

export const F502_REFUND = {
  localOverpaid:     'Text Box 84',     // Local overpayment
  localOverpaidCents:'Text Box 85',     // Local overpayment cents
  // Contributions fields
  contribCode:       'Text Box 86',     // Contribution fund code
  contribName:       'Text Box 87',     // Contribution fund name
  contribAmount:     'Text Box 88',     // Contribution amount
  totalRefund:       'Text Box 89',     // Total refund
  totalRefundCents:  'Text Box 90',     // Total refund cents
  totalOwed:         'Text Box 91',     // Total amount owed
  totalOwedCents:    'Text Box 92',     // Total amount owed cents
}

// ── Page 4: Signature / Direct Deposit ─────────────────────

export const F502_SIGNATURE = {
  checkAuthorize:    'Check Box 38',     // Authorize discussion checkbox
}

export const F502_DIRECT_DEPOSIT = {
  checkDeposit:      'Check Box 39',     // Direct deposit checkbox
  checkPaperCheck:   'Check Box 40',     // Paper check checkbox
  checkChecking:     'Check Box 41',     // Checking account checkbox
  checkSavings:      'Check Box 42',     // Savings account checkbox
  routingNumber:     'Text Box 93',      // Bank routing number
  accountName:       'Text Box 94',      // Account holder name
  accountNumber:     'Text Box 95',      // Account number
  bankName:          'Text Box 96',      // Bank name
  bankBranch:        'Text Box 97',      // Bank branch/city

  // Preparer fields
  preparerName:      'Text Box 102',
  preparerSSN:       'Text Box 104',
  preparerAddress:   'Text Box 105',
  preparerPhone:     'Text Box 106',
  preparerPTIN:      'Text Box 107',
}

// ── Page headers (SSN/Name repeated on pages 2-4) ─────────
// The SSN field 'Enter social security number' has 4 widget appearances
// across all 4 pages. Similarly 'Enter your last name' appears on
// multiple pages as a header.

export const F502_PAGE_HEADER = {
  nameAllPages:      'Enter your last name',            // Appears on pages 1-4 header
  ssnAllPages:       'Enter social security number',    // Appears on pages 1-4 header
}
