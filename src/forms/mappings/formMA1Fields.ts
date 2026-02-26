/**
 * MA Form 1 PDF field name mapping.
 *
 * Field names discovered from MA DOR Form 1 (2024) using pdf-lib enumeration.
 * The MA form uses readable field names (e.g. "fname", "res3") rather than
 * numeric codes like the CA form.
 *
 * Page 1 = Header, address, filing status, exemptions (Lines 1–2)
 * Page 2 = Income (Lines 3–10), deductions/exemptions (Lines 11–23)
 * Page 3 = Tax, credits (Lines 24–38)
 * Page 4 = Payments, refund/owed (Lines 39–54), direct deposit, signature
 */

// ── Page 1: Header / Filing Status / Exemptions ─────────

export const MA1_HEADER = {
  firstName:        'fname',           // Your first name (appears on all pages)
  middleInitial:    'mi',              // Your middle initial (appears on all pages)
  lastName:         'lname',           // Your last name (appears on all pages)
  ssn:              'SSN',             // Your SSN (appears on all pages)
  spouseFirstName:  'Spfname',         // Spouse first name
  spouseMiddleInit: 'Spmi',            // Spouse middle initial
  spouseLastName:   'Splname',         // Spouse last name
  spouseSSN:        'SSNSP',           // Spouse SSN
  street:           'madd',            // Mailing address
  city:             'city',            // City/Town
  state:            'state',           // State
  zip:              'zip',             // Zip code
  foreignAddress:   'fmadd',           // Foreign address (if applicable)
  foreignCity:      'fcity',           // Foreign city
  foreignZip:       'fzip',            // Foreign zip/postal code
  taxYear:          'date',            // Tax year
}

export const MA1_FILING_STATUS = {
  radioGroup:       'filing status',
  // Options (exact values from PDF AcroForm):
  single:           'Single',
  mfs:              'Married filing separate return',
  mfj:              'Married filing joint return',
  hoh:              'Head of household',
}

// Page 1 checkboxes
export const MA1_PAGE1_CHECKS = {
  // Exemption checkboxes (Lines 1–2 area)
  check1a:               'check1a',                // Line 1a: taxpayer 65 or over
  check1b:               'check1b',                // Line 1b: taxpayer blind
  custodialParent:       'custodial parent',        // Custodial parent
  custodialRelease:      'custodial parent release claim', // Custodial parent release claim
  jointFilingExemption:  'joint filing exemption',  // Joint filing exemption
  nonresidentAlien:      'nonresident alien',       // Nonresident alien spouse
  notSameFedStatus:      'not using same federal filing status', // Not using same federal filing status
}

// ── Page 1: Exemptions (Lines 1–2) ─────────────────────

export const MA1_EXEMPTIONS = {
  line1a:           'res1a',           // Line 1a: personal exemption amount
  line1b:           'res1b',           // Line 1b: spouse exemption amount (blind/65+)
  line2a:           'res2a',           // Line 2a: number of dependents
  total1:           'restotal1',       // Total 1: personal exemption total
  line2b:           'res2b',           // Line 2b: dependent under 12
  total2:           'restotal2',       // Total 2: dependent exemption amount
  line2c:           'res2c',           // Line 2c: dependent with disability
  total3:           'restotal3',       // Total 3
  line2d:           'res2d',           // Line 2d: age 65+ exemption
  line2e:           'res2e',           // Line 2e: blind exemption
  line2f:           'res2f',           // Line 2f: medical/dental expenses
  line2g:           'res2g',           // Line 2g: total exemptions (sum)
}

// ── Page 2: Income (Lines 3–10) ─────────────────────────

export const MA1_INCOME = {
  line3:            'res3',            // Line 3: wages, salaries, tips (from W-2)
  line4:            'res4',            // Line 4: taxable pensions and annuities
  line5:            'res5',            // Line 5: Massachusetts bank interest
  line6a:           'res6a',           // Line 6a: business/profession income
  check6a:          'check6a',         // Line 6a checkbox
  line6b:           'res6b',           // Line 6b: rental, patent, copyright income
  check6b:          'check6b',         // Line 6b checkbox
  line7:            'res7',            // Line 7: other income (unemployment, alimony, etc.)
  check7:           'check7',          // Line 7 checkbox
  line8a:           'res8a',           // Line 8a: total 5.0% income (lines 3-7)
  line8b:           'res8b',           // Line 8b: total 8.5% income
  line9:            'res9',            // Line 9: total 12% income
  check10:          'check10',         // Line 10 checkbox
  line10:           'res10',           // Line 10: total income
}

// ── Page 2: Adjustments / Deductions (Lines 11–23) ──────

export const MA1_DEDUCTIONS = {
  line11a:          'res11a',          // Line 11a: amount from Schedule Y, line 17
  line11b:          'res11b',          // Line 11b: other adjustments
  line14a:          'res14a',          // Line 14a: additional adjustments
  line14:           'res14',           // Line 14: Massachusetts AGI
  line15:           'res15',           // Line 15: exemption amount (from line 2g)
  line16:           'res16',           // Line 16: adjusted income after exemptions
  line17:           'res17',           // Line 17: deductions from Schedule Y, line 19
  line18:           'res18',           // Line 18: adjusted after deductions
  line19:           'res19',           // Line 19: Interest from Schedule B
  line20:           'res20',           // Line 20: dividends from Schedule B
  line21:           'res21',           // Line 21: total 5% income (taxable)
  line22:           'res22',           // Line 22: 8.5% income (short-term capital gains)
  check22:          'Checktp2222',     // Line 22 checkbox
  line23a:          'res23a',          // Line 23a: long-term capital gains
  line23a1:         'res23a1',         // Line 23a1: capital gains detail
  line23b:          'res23b',          // Line 23b: collectibles gains
  line23b1:         'res23b1',         // Line 23b1: collectibles detail
  line23:           'res23',           // Line 23: total 12% income (taxable)
}

// ── Page 3: Tax / Credits (Lines 24–38) ──────────────────

export const MA1_TAX = {
  check23a:         'Checktp23',       // Tax computation checkbox
  check23b:         'Checktp234',      // Tax computation checkbox
  line24:           'res24',           // Line 24: 5% tax on Line 21
  line25:           'res25',           // Line 25: 8.5% tax on Line 22
  line26:           'res26',           // Line 26: 12% tax on Line 23
  check26:          'Checktp24',       // Line 26 checkbox
  line28a:          'res28a',          // Line 28a: subtotal
  line28b:          'res28b',          // Line 28b: adjustments
  line28:           'res28',           // Line 28: total income tax
  line29:           'res29',           // Line 29: additional tax (surtax)
  line30:           'res30',           // Line 30: total Massachusetts income tax
  line31:           'res31',           // Line 31: limited income credit
  line32:           'res32',           // Line 32: credits from Schedule CMS
  line33a:          'res33a',          // Line 33a: credit type 1
  line33b:          'res33b',          // Line 33b: credit type 2
  line33c:          'res33c',          // Line 33c: credit type 3
  line33d:          'res33d',          // Line 33d: credit type 4
  line33e:          'res33e',          // Line 33e: credit type 5
  line33f:          'res33f',          // Line 33f: credit type 6
  line33:           'res33',           // Line 33: total credits
  line34:           'res34',           // Line 34: income tax after credits
  line35a:          'res35a',          // Line 35a: use tax on vehicles
  line35b:          'res35b',          // Line 35b: use tax on other items
  line35:           'res35',           // Line 35: total use tax
  line36:           'res36',           // Line 36: health care penalty
  line37:           'res37',           // Line 37: total (line 34 + 35 + 36)
  line38a:          'res38a',          // Line 38a: total voluntary contributions
  line38b:          'res38b',          // Line 38b: total political contributions
  line38c:          'res38c',          // Line 38c: other
  line38:           'res38',           // Line 38: total additions
}

// ── Page 4: Payments / Refund / Amount Owed (Lines 39–54) ─

export const MA1_PAYMENTS = {
  line39:           'res39',           // Line 39: total tax + additions
  line40:           'res40',           // Line 40: Massachusetts income tax withheld
  line41:           'res41',           // Line 41: 2024 estimated tax payments
  line42:           'res42',           // Line 42: payments on extension
  numQualChildren:  'number of qualifying childer', // Number of qualifying children (EIC)
  line43b:          'res43b',          // Line 43b: EIC amount
  line43c:          '43c',             // Line 43c: dependent EIC
  res43c:           'res43c',          // Line 43c: dependent EIC amount
  check43:          'Checktp5618',     // Line 43 checkbox
  line44:           'res44',           // Line 44: senior circuit breaker credit
  line46a:          'res46a',          // Line 46a: refundable credits
  line46b:          'res46b',          // Line 46b: excess payroll tax
  line46:           'res46',           // Line 46: total refundable credits
  line47:           'res47',           // Line 47: total payments and credits
  line48:           'res48',           // Line 48: overpayment
  line49:           'res49',           // Line 49: amount to apply to next year est. tax
  line50:           'res50',           // Line 50: refund amount
  line51:           'res51',           // Line 51: tax due
  line52:           'res52',           // Line 52: penalty for underpayment
  line53:           'res53',           // Line 53: total amount due
  line53a:          'res53a',          // Line 53a: amount detail
  line53b:          'res53b',          // Line 53b: amount detail
  line54:           'res54',           // Line 54: amount paid with return
  check54:          'Checktp22',       // Line 54 checkbox (electronic payment)
  line54a:          'res54a',          // Line 54a: bank routing number
  line54b:          'res54b',          // Line 54b: bank account number
  line54c:          'res54c',          // Line 54c: payment detail
}

// ── Page 4: Direct Deposit ───────────────────────────────

export const MA1_DIRECT_DEPOSIT = {
  radioGroup:       'direct deposit',
  checking:         'Checking',
  savings:          'Savings',
}

// ── Page 4: Preparer / Signature ─────────────────────────

export const MA1_SIGNATURE = {
  signature:        'Signature',       // Taxpayer signature (page 1)
  signatureDate:    'date3',           // Signature date (page 1)
  spouseSignature:  'Spsignature',     // Spouse signature (page 1)
  spouseSignDate:   'date4',           // Spouse signature date (page 1)
  email:            'email',           // Email
  phone:            'TPphone',         // Phone number
  preparerName:     'pname',           // Preparer name (page 4)
  preparerTIN:      'ptinorssn',       // Preparer TIN/SSN (page 4)
  preparerPhone:    'pphone',          // Preparer phone (page 4)
  preparerDate:     'date2',           // Preparer date (page 4)
  preparerSignature:'signature',       // Preparer signature (page 4)
  preparerEIN:      'PaidEIN',         // Preparer EIN (page 4)
}
