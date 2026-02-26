/**
 * PA Form PA-40 PDF field name mapping.
 *
 * Field names discovered from the official PA-40 PDF using pdf-lib enumeration.
 * The PA-40 uses descriptive AcroForm field names.
 *
 * Page 1: Header / Personal Info / Filing Status / Income Classes (Lines 1-11)
 * Page 2: Tax / Credits / Payments / Result (Lines 12-36)
 */

// ── Page 1: Header / Personal Info ──────────────────────────

export const PA40_HEADER = {
  // Taxpayer SSN (appears on both pages)
  ssn:                'Enter SSN shown first without dashes or spaces',
  lastName:           'Use all caps to enter taxpayer\'s last name',
  lastNameSuffix:     'Use all caps to enter suffixes such as JR, SR, III',
  firstName:          'Use all caps to enter taxpayer\'s first name',
  middleInitial:      'Use Cap For Your Middle Initial',

  // Spouse
  spouseSSN:          'Enter SSN of spouse without dashes or spaces',
  spouseFirstName:    'Use all caps to enter spouse\'s first name',
  spouseMiddleInitial:'Use Cap For Your Spouse\'s Middle Initial',
  spouseLastName:     'Use all caps to enter spouse\'s last name if different from above',
  spouseLastSuffix:   'Use all caps to enter spouse\'s suffixes such as JR, SR, III',

  // Address
  addressLine1:       'Use all caps to enter First Line of Address',
  addressLine2:       'Use all caps to enter Second Line of Address',
  city:               'Use all caps to enter City or Post Office',
  state:              'Use all caps to enter two character State abbreviation',
  zip:                'Enter five digit Zip Code',
  countryCode:        'Use all caps to enter two character Country Code',

  // Other header
  phone:              'Enter Daytime Telephone Number without parenthesis, dashes or spaces',
  schoolCode:         'Enter five digit School Code from list on pags 42 & 43',
  schoolDistrict:     'Name of School District',

  // Page 2 header
  namePage2:          'Name(s)',
}

// ── Page 1: Filing Status & Residency ───────────────────────

export const PA40_FILING_STATUS = {
  // "Filing Status" checkbox has 4 widgets (0-3):
  //   widget[0] = single, widget[1] = mfj, widget[2] = mfs, widget[3] = (another status)
  // Note: PA uses a single "Filing Status" checkbox field with multiple widgets.
  // Cannot individually select via pdf-lib checkBox — need to use the field name directly.
  filingStatus:       'Filing Status',
}

export const PA40_RESIDENCY = {
  // "Residency Status" checkbox has 3 widgets (0-2):
  //   widget[0] = Resident, widget[1] = Part-Year, widget[2] = Nonresident
  residencyStatus:    'Residency Status',
  partYearFrom:       'Part Year Resident from',
  partYearTo:         'Part year resident to',
}

export const PA40_FLAGS = {
  extension:          'Extension',
  amended:            'Amended Return',
  farmers:            'Farmers',
  eFileOptOut:        'E-File Opt Out',
  deceased:           'Deceased',
}

// ── Page 1: Occupations ─────────────────────────────────────

export const PA40_OCCUPATION = {
  yourOccupation:     'Your Occupation',
  spouseOccupation:   'Spouse\'s occupation',
}

// ── Page 1: Income Classes (Lines 1–11) ─────────────────────

export const PA40_INCOME = {
  // Line 1: Compensation
  line1a:             '1a. Gross Compensation',
  line1b:             '1b. Unreimbursed Employee Business Expenses',
  line1c:             '1c. Net Compensation',

  // Lines 2-8: Other income classes
  line2:              '2. Interest Income',
  line3:              '3. Dividend  and Capital Gains Distributions Income',
  line4:              '4. Net Income or Loss from the Operation of a Business, etc',
  line4Loss:          '4. Loss',  // Checkbox for loss indicator
  line5:              '5. Net Gain or Loss from Sale, etc. of Property',
  line5Loss:          '5. Loss',  // Checkbox for loss indicator
  line6:              '6. Net Income or Loss from Rents, etc',
  line6Loss:          '6. Loss',  // Checkbox for loss indicator
  line7:              '7. Estate or Trust income',
  line8:              '8. Gambling and Lottery Winnings',

  // Line 9: Total PA Taxable Income
  line9:              '9. Total PA Taxable Income',

  // Line 10: Deductions (§529)
  line10Code:         'Code',
  line10:             '10.  Other Deductions',

  // Line 11: Adjusted PA Taxable Income
  line11:             '11. Adjusted PA Taxable Income',
}

// ── Page 2: Tax / Credits (Lines 12–24) ─────────────────────

export const PA40_TAX = {
  line12:             '12. PA Tax Liability. Multiply Line 11 by 3.07%',
  line13:             '13. Total PA Tax Withheld',
  line14:             '14. Credit from your PA Income Tax Return',
  line15:             '15. Estimated Installment Payments',
  line16:             '16. Extension Payment',
  line17:             '17. Nonredsident Tax Withheld',
  line18:             '18.Total Estimated Payments and Credits',
}

export const PA40_TAX_FORGIVENESS = {
  // Tax Forgiveness checkboxes (3 widgets):
  //   widget[0] = Yes, widget[1] = No, widget[2] = N/A
  taxForgiveness:     'Tax Forgiveness',
  dependents:         'Dependents',
  totalEligibility:   '20. Total Eligibility Income',
  forgivenessCredit:  '21. Tax Forgiveness Credit',
}

export const PA40_CREDITS = {
  residentCredit:     '22. Resident Credit',
  otherCredits:       '23.Total Other Credits',
  totalPayments:      '24. Total Payments and Credits',
}

// ── Page 2: Payments / Result (Lines 25–36) ─────────────────

export const PA40_PAYMENTS = {
  useTax:             '25. USE TAX',
  taxDue:             '26. TAX DUE',
  penaltiesInterest:  '27.Penalties and Interest',
  penaltiesCode:      '27. Code',
  penaltiesCB:        '27. REV-1630',
  totalPayment:       '28. TOTAL PAYMENT',
  overpayment:        '29. OVERPAYMENT',
  refund:             '30. Refund',
  credit:             '31. Credit',
}

// ── Page 2: Refund Donations (Lines 32–36) ──────────────────

export const PA40_DONATIONS = {
  code32:             '32. Refund',
  amount32:           '32. Refund donation line',
  code33:             '33. Refund',
  amount33:           '33. Refund donation line',
  code34:             '34. Refund',
  amount34:           '34. Refund donation line',
  code35:             '35. Refund',
  amount35:           '35. Refund donation line',
  code36:             '36. Refund',
  amount36:           '36. Refund donation line',
}

// ── Page 2: Deceased / Final Return ─────────────────────────

export const PA40_DECEASED = {
  taxpayerDeceased:   'Taxpayer',
  spouseDeceased:     'Spouse',
  taxpayerDOD:        'Taxpayer Date of Death',
  spouseDOD:          'Spouse Date of Death',
  finalReturn:        'Final Return',
}

// ── Page 2: Signature / Preparer ────────────────────────────

export const PA40_SIGNATURE = {
  date:               'Date',
  preparerSSN:        'Preparerês SSN / PTIN',
  preparerName:       'Preparer\'s Name',
  preparerPhone:      'Preparer\'s Telephone Number',
  firmFEIN:           'Firm FEIN',
  formREV459B:        'Form REV-459B',
}
