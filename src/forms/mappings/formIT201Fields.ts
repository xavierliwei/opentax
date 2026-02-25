/**
 * NY Form IT-201 PDF field name mapping.
 *
 * Field names discovered from NYS DTF IT-201 (2024) using pdf-lib enumeration.
 * The form has 4 pages and 214 fields total.
 *
 * Page 1: Header (name, address, filing status), dependents, income (Lines 1-19)
 * Page 2: NY subtractions/additions (Lines 20-37), deductions, tax computation
 * Page 3: Credits, other taxes, payments (Lines 38-76)
 * Page 4: Refund/amount owed, third-party designee, signature
 *
 * Note: Filing status and several other "checkboxes" are multi-widget checkbox
 * fields that act like radio buttons. Each widget has a unique on-value key.
 */

// ── Page 1: Header / Filing Status / Dependents ────────────

export const IT201_HEADER = {
  tpFirstName:      'TP_first_name',       // Taxpayer first name
  tpMI:             'TP_MI',               // Taxpayer middle initial
  tpLastName:       'TP_last_name',        // Taxpayer last name
  tpSSN:            'TP_SSN',              // Taxpayer SSN
  tpDOB:            'TP_DOB',              // Taxpayer date of birth

  spouseFirstName:  'Spouse_first_name',   // Spouse first name
  spouseMI:         'Spouse_MI',           // Spouse middle initial
  spouseLastName:   'Spouse_last_name',    // Spouse last name
  spouseSSN:        'Spouse_SSN',          // Spouse SSN
  spouseDOB:        'Spouse_DOB',          // Spouse date of birth

  mailAddress:      'TP_mail_address',     // Mailing address
  mailApt:          'TP_mail_apt',         // Mailing apartment
  mailCity:         'TP_mail_city',        // Mailing city
  mailState:        'TP_mail_state',       // Mailing state
  mailZip:          'TP_mail_zip',         // Mailing zip
  mailCountry:      'TP_mail_country',     // Foreign country

  homeAddress:      'TP_home_address',     // Home address (if different)
  homeApt:          'TP_home_apt',         // Home apartment
  homeCity:         'TP_home_city',        // Home city
  homeZip:          'TP_home_zip',         // Home zip

  countyResidence:  'NYS_county_residence', // NYS county of residence
  sdCode:           'SD_code',             // School district code
  sdName:           'SD_name',             // School district name

  tpDateDeath:      'TP_date_death',       // Taxpayer date of death
  spouseDateDeath:  'Spouse_date_death',   // Spouse date of death

  fiscalYearStart:  'Fiscal_year_start',   // Fiscal year start
  fiscalYearEnd:    'Fiscal_year_end',     // Fiscal year end
}

// Filing status — multi-widget checkbox (5 widgets, one per status)
// Widget on-value keys (hex-encoded in PDF):
//   0: "1 Single"
//   1: "2 Married Filing Joint Return (enter spouse\x90s social security number above)"
//   2: "3 Married Filing Seperate Return (enter spouse\x90s social security number above)"
//   3: "Head of Household (with qualifying person)"
//   4: "Qualifying widow(er) with dependent child"
export const IT201_FILING_STATUS = {
  fieldName:  'Filing_status',
  // Widget indices for each filing status
  singleIdx:  0,
  mfjIdx:     1,
  mfsIdx:     2,
  hohIdx:     3,
  qwIdx:      4,
}

export const IT201_CHECKBOXES = {
  itemized:           'Itemized',            // Itemized deduction box (yes/no widgets)
  dependent:          'Dependent',           // Can be claimed as dependent (yes/no)
  foreignAccount:     'Foreign_account',     // Foreign account checkbox
  yonkersFreezeCredit: 'yonkers_freeze_credit',
  additionalDependents: 'H_additional_dependents',
  line9Box:           'Line 9_box',          // Line 9 checkbox
  line10Box:          'Line 10_box',         // Line 10 checkbox
  e1:                 'E1',                  // E1 checkbox (yes/no)
}

// ── Dependents (Section H) — up to 7 dependents ────────────

export const IT201_DEPENDENTS = {
  // Arrays of field names indexed by dependent number (0-6)
  firstName: [
    'H_first1', 'H_first2', 'H_first3', 'H_first4',
    'H_first5', 'H_first6', 'H_first7',
  ],
  middleInitial: [
    'H_middle1', 'H_middle2', 'H_middle3', 'H_middle4',
    'H_middle5', 'H_middle6', 'H_middle7',
  ],
  lastName: [
    'H_last1', 'H_last2', 'H_last3', 'H_last4',
    'H_last5', 'H_last6', 'H_last7',
  ],
  relationship: [
    'H_relationship1', 'H_relationship2', 'H_relationship3', 'H_relationship4',
    'H_relationship5', 'H_relationship6', 'H_relationship7',
  ],
  ssn: [
    'H_dependent_ssn1', 'H_dependent_ssn2', 'H_dependent_ssn3', 'H_dependent_ssn4',
    'H_dependent_ssn5', 'H_dependent_ssn6', 'H_dependent_ssn7',
  ],
  dob: [
    'H_dependent_dob1', 'H_dependent_dob2', 'H_dependent_dob3', 'H_dependent_dob4',
    'H_dependent_dob5', 'H_dependent_dob6', 'H_dependent_dob7',
  ],
}

// ── Page 1-2: Income lines ─────────────────────────────────

export const IT201_INCOME = {
  line1:   'Line1',    // Wages, salaries, tips (federal amount)
  line2:   'Line2',    // Taxable interest income
  line3:   'Line3',    // Ordinary dividends
  line4:   'Line4',    // Taxable refunds, credits, offsets
  line5:   'Line5',    // Alimony received
  line6:   'Line6',    // Business income or (loss)
  line7:   'Line7',    // Capital gain or (loss)
  line8:   'Line8',    // Other gains or (losses)
  line9:   'Line9',    // Taxable IRA distributions
  line10:  'Line10',   // Taxable pensions and annuities
  line11:  'Line11',   // Rental real estate, royalties, etc.
  line12:  'Line12',   // Farm income or (loss)
  line13:  'Line13',   // Unemployment compensation
  line14:  'Line14',   // Taxable Social Security benefits
  line15:  'Line15',   // Other income (identify)
  line15Identify: '15_identify', // Other income description
  line16:  'Line16',   // Total federal income (add lines 1-15)
  line17:  'Line17',   // Federal adjustments to income
  line18:  'Line18',   // Federal AGI (line 16 - line 17)
  line18Identify: '18_identify', // Line 18 identification
  line19:  'Line19',   // NY additions (from Form IT-225)
}

// ── Page 2: NY subtractions, additions, AGI ─────────────────

export const IT201_ADJUSTMENTS = {
  line20:  'Line20',   // Interest income on US gov obligations
  line21:  'Line21',   // Pensions of NYS/local govts or federal govt
  line22:  'Line22',   // Taxable SS benefits (from line 14)
  line23:  'Line23',   // Pension/annuity exclusion
  line24:  'Line24',   // College tuition deduction
  line25:  'Line25',   // Other (see instructions)
  line26:  'Line26',   // Total NY subtractions (add lines 20-25)
  line27:  'Line27',   // Line 18 +/- 19 - 26
  line28:  'Line28',   // Interest income on state/local bonds (non-NY)
  line29:  'Line29',   // Public employee 414(h) contributions
  line30:  'Line30',   // Other additions (Form IT-225)
  line31:  'Line31',   // Total NY additions (add lines 28-30)
  line32:  'Line32',   // NY AGI (line 27 + line 31)
  line33:  'Line33',   // NY standard deduction OR NY itemized deduction
  line34:  'Line34',   // NY standard/itemized deduction amount
  line35:  'Line35',   // Subtract line 34 from line 33
  line36:  'Line36',   // Dependent exemption (number of dependents x $1,000)
  line37:  'Line37',   // NY taxable income (line 35 - line 36)
}

// 34Deduction checkbox — multi-widget (Standard / Itemized)
export const IT201_DEDUCTION_TYPE = {
  fieldName: '34Deduction',
  standardIdx: 0,  // Widget 0 = Standard
  itemizedIdx: 1,  // Widget 1 = Itemized
}

// ── Page 2-3: Tax computation ───────────────────────────────

export const IT201_TAX = {
  line38:  'Line38',   // NY tax on line 37 amount
  line39:  'Line39',   // NY tax table / rate schedule
  line40:  'Line40',   // NY household credit
  line41:  'Line41',   // Subtract line 40 from line 39
  line42:  'Line42',   // NY child and dependent care credit
  line43:  'Line43',   // Subtract line 42 from line 41
  line44:  'Line44',   // NY earned income credit
  line45:  'Line45',   // Subtract line 44 from line 43
  line46:  'Line46',   // Real property tax credit
  line47:  'Line47',   // College tuition credit
  line47a: 'Line47a',  // College tuition credit additional
  line48:  'Line48',   // Subtract lines 46 and 47/47a from line 45
}

// ── Page 3: Other taxes, NYC tax, credits, payments ─────────

export const IT201_OTHER_TAXES = {
  line49:  'Line49',   // Other NYS taxes
  line50:  'Line50',   // NYS total (line 48 + line 49)
  line51:  'Line51',   // NYC taxable income
  line52:  'Line52',   // NYC tax
  line53:  'Line53',   // NYC household credit
  line54:  'Line54',   // Net NYC tax (line 52 - line 53)
  line54a: 'Line54a',  // UBT credit
  line54b: 'Line54b',  // NYC school tax credit
  line54c: 'Line54c',  // Net NYC tax after credits
  line54d: 'Line54d',  // NYC EITC
  line54e: 'Line54e',  // Net NYC tax after EITC
  line55:  'Line55',   // Sales/use tax
  line56:  'Line56',   // Part-year NYC resident tax
  line57:  'Line57',   // Other NYC taxes
  line58:  'Line58',   // Total NYC taxes
}

export const IT201_YONKERS = {
  line59:  'Line59',   // Yonkers resident income tax surcharge
  line60:  'Line60',   // Yonkers nonresident earnings tax
  line61:  'Line61',   // Total Yonkers tax
  line62:  'Line62',   // Net Yonkers tax
  line63:  'Line63',   // Total NY State, NYC, Yonkers taxes
}

export const IT201_CREDITS = {
  line64:  'Line64',   // Total NY State tax withheld
  line65:  'Line65',   // Total NYC tax withheld
  line66:  'Line66',   // Total Yonkers tax withheld
  line67:  'Line67',   // Estimated tax payments
  line68:  'Line68',   // Extension payment (Form IT-370)
  line69:  'Line69',   // Other payments/credits
  line69a: 'Line69a',  // Total credits
  line70:  'Line70',   // Total NY State, City, Yonkers taxes withheld
  line70a: 'Line70a',  // Total payments
  line71:  'Line71',   // Earned income credit
  line72:  'Line72',   // NYC school tax credit (added)
  line73:  'Line73',   // Empire State child credit
  line74:  'Line74',   // Real property tax credit
  line75:  'Line75',   // City of NY EITC
  line76:  'Line76',   // Total payments and credits
  eitc65:  '65_EIC',   // EIC checkbox amount (line 65)
  eitc70:  '70_EIC',   // EIC checkbox amount (line 70)
}

// ── Page 3-4: Refund / Amount owed ──────────────────────────

export const IT201_RESULT = {
  line77:  'Line77',   // Amount overpaid (line 76 - line 63)
  line78:  'Line78',   // Amount of line 77 to be refunded
  line78a: 'Line78a',  // Applied to estimated tax
  line78b: 'Line78b',  // Estimated tax penalty
  line79:  'Line79',   // Amount you owe (line 63 - line 76)
  line80:  'Line80',   // Estimated tax penalty amount
  line81:  'Line81',   // Total amount due (line 79 + line 80)
  line82:  'Line82',   // Voluntary contributions
}

export const IT201_REFUND = {
  refundCheckbox:     'Line78_refund',      // Refund method (check / direct deposit)
  amountOwedCheckbox: 'Line80_box',         // Electronic funds withdrawal
  ddBox:              'Line83_box',          // Direct deposit yes
  ddAccountType:      'Line83a_account',     // Account type (4 widgets: personal savings/checking, business checking/savings)
  ddRouting:          'Line83b_routing',     // Routing number
  ddAccount:          'Line83c_account_num', // Account number
  withdrawalDate:     'Line84_withdrawal_Date',   // Electronic withdrawal date
  withdrawalAmount:   'Line84_withdrawal_amount', // Electronic withdrawal amount
}

// ── Page 4: Signature / Third-party ─────────────────────────

export const IT201_SIGNATURE = {
  tpOccupation:       'TP_occupation',       // Taxpayer occupation
  spouseOccupation:   'Spouse_occupation',   // Spouse occupation
  signedDate:         'signed_date',         // Signature date
  dayAC:              'day_ac',              // Daytime area code
  dayPhone:           'day_phone',           // Daytime phone number
  signEmail:          'sign_email',          // Email address
}

export const IT201_THIRD_PARTY = {
  thirdPartyBox:      '3rd_party_box',       // Third party designee checkbox
  designeeName:       'designee_name',       // Designee name
  designeeEmail:      'designee_email',      // Designee email
  designeeAC:         'designee_ac',         // Designee area code
  designeePhone:      'designees_phone',     // Designee phone
  designeePIN:        'designee_pin',        // Designee PIN
}

export const IT201_PREPARER = {
  nytprin:            'Prep_NYTPRIN',        // Preparer NYTPRIN
  nytprinExclCode:    'NYTPRIN_excl_code',   // NYTPRIN exclusion code
  prepName:           'Prep_name',           // Preparer name
  firmName:           'firm_name',           // Firm name
  firmAddress1:       'Firm_address1',       // Firm address line 1
  firmAddress2:       'Firm_address2',       // Firm address line 2
  firmEmail:          'Firm_email',          // Firm email
  prepPTIN:           'Prep_PTIN_SSN',       // Preparer PTIN or SSN
  prepEIN:            'Prep_EIN',            // Firm EIN
  prepDate:           'Prep_date',           // Preparer date
}

// ── NYC / Yonkers special fields ────────────────────────────

export const IT201_NYC_YONKERS = {
  f1NYC:        'F1_NYC',          // NYC resident months
  f2NYC:        'F2_NYC',          // NYC part-year info
  d1Yonkers:    'D1_Yonkers',      // Yonkers resident info
  d3Yonkers:    'D3_Yonkers',      // Yonkers nonresident info
}

// ── Page 2 header ──────────────────────────────────────────

export const IT201_PAGE2_HEADER = {
  nameAsPage1: 'Name_as_page1',   // Name repeated on page 2
}

// ── Special field constants ────────────────────────────────

export const IT201_SPECIAL = {
  e2:          'E2',               // E2 text field
  g1ConCode:   'G1_con_code',     // Contribution code 1
  g2ConCode:   'G2_con_code',     // Contribution code 2
}
