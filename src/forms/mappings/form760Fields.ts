/**
 * VA Form 760 PDF field name mapping.
 *
 * Field names discovered from Virginia f760.pdf using pdf-lib enumeration.
 * The official VA form uses descriptive field names matching form labels.
 *
 * Page 1 (page 0): Header, address, filing status, exemptions, income (Lines 1-15)
 * Page 2 (page 1): Tax, payments, credits, refund/owed (Lines 16-36)
 */

// ── Page 1: Header / Personal Info ──────────────────────────

export const F760_HEADER = {
  firstName:        'Your Name',
  middleInitial:    'Middle initial',
  lastName:         'Last name including suffix',
  ssn:              'Your SSN',
  lastNameLetters:  'First four letters of last name',

  spouseFirstName:  'Spouse Name',
  spouseMiddleInitial: 'Middle initial_2',
  spouseLastName:   'Spouse Last Name',
  spouseSSN:        'Spouse SSN',
  spouseLastNameLetters: 'First four letters of last name_2',

  addressChange:    'Address change',        // checkbox
  address:          'Address',
  city:             'City, Town OR Post Office',
  state:            'State',
  zip:              'Zip Code',

  yourBirthdate:    'Your Birthdate',
  youDeceased:      'You Deceased',          // checkbox
  spouseBirthdate:  'Spouse Birthdate',
  spouseDeceased:   'Spouse Deceased',       // checkbox
  localityCode:     'Locality Code',
}

// ── Page 1: Filing Status & Checkboxes ──────────────────────

export const F760_FILING_STATUS = {
  /** Text field: enter 1=Single, 2=MFJ, 3=MFS, 4=HOH, 5=QW */
  filingStatus:     'Filing Status',

  /** Checkbox: checked if federal filing status is HOH */
  federalHOH:       'Federal Head of household',

  /** Text field: spouse name (if filing status 2) */
  spouseNameFS:     'Spouse Name_2',

  /** Text field: spouse if filing status 2 (number of spouses) */
  spouseIfFS2:      'Spouse if Filing Status 2',
}

// ── Page 1: Special Checkboxes ──────────────────────────────

export const F760_SPECIAL = {
  authorizeDMAS:           'Autrhorize shared Info to DMAS',        // checkbox
  nameOrStatusChanged:     'Name or Fliling Status Changed',        // checkbox
  returnNotFiledLastYear:  'Return Not Filed Last Year',            // checkbox
  dependentOnAnother:      "Dependent on Another's Return",         // checkbox
  farmerFisherman:         'Farmer, Fisherman or Merchant Seaman',  // checkbox
  amendedReturn:           'Amended Return',                        // checkbox
  reasonCode:              'Reason Code',
  overseasOnDueDate:       'Overseas on due date',                  // checkbox
  scheduleCFiled:          'Schedule C filed with Federal',          // checkbox
  earnedIncomeCredit:      'Earned Income Credit',                  // checkbox
  earnedIncomeCreditAmt:   'Earned Income Credit Amount',

  yourDriversLicense:      "You Virginia Driver's License Number",
  yourIssueDate:           'You Issue Date',
  spouseDriversLicense:    "Spouse Virginia Driver's License Number",
  spouseIssueDate:         'Spouse Issue Date',
}

// ── Page 1: Exemptions (Sections A & B) ─────────────────────

export const F760_EXEMPTIONS = {
  // Section A: Personal exemptions
  dependents:              'Dependents',
  totalExemptionsA:        'Total Exemptions Section A',
  totalExemptionsDollarA:  'Total Exemptions Dollar Amount Section A',

  // Section B: Age 65+ and Blind exemptions
  youOver65:               'You over 65',
  spouseOver65:            'Spouse over 65',
  youBlind:                'You Blind',
  spouseBlind:             'Spouse Blind',
  totalExemptionsB:        'Total Exemptions Section B',
  totalExemptionsDollarB:  'Total Exemption Dollar Amount Section B',
}

// ── Page 1: Income (Lines 1–15) ─────────────────────────────

export const F760_INCOME = {
  line1:   '1. Federal Adjusted Gross Income',         // Line 1: Federal AGI
  line2:   '2. Additions',                             // Line 2: Additions from Schedule ADJ
  line3:   '3. Add Lines 1 and 2',                     // Line 3: FAGI + additions

  // Age deduction (part of Line 4)
  yourAgeDeduction:    'You Age Deduction',
  spouseAgeDeduction:  'Spouse Age Deduction',
  line4:   '4. Total Age Deduction',                   // Line 4: Total age deduction

  line5:   '5. Soc Sec and Rail benefits',             // Line 5: Social Security & Railroad benefits
  line6:   '6. State Income tax refund or overpayment',// Line 6: State income tax refund
  line7:   '7. Subtractions',                          // Line 7: Subtractions from Schedule ADJ
  line8:   '8. Add lines 4,5,6 and 7',                 // Line 8: Total subtractions (4+5+6+7)

  line9:   '9. Virginia Adjusted Gross Income',        // Line 9: VA AGI = Line 3 - Line 8

  line10:  '10. Itemized Deductions',                  // Line 10: VA itemized deductions
  line11:  '11. Standard Deduction',                   // Line 11: VA standard deduction
  line12:  '12. Total Exemptions Section A plus Section B above',  // Line 12: Total exemptions
  line13:  '13 Total Deductions',                      // Line 13: Total deductions (larger of 10/11 + 12)
  line14:  '14. Add Lines 10,11, 12 and 13',           // Line 14: Total deductions + exemptions
  line15:  '15. Virginia Taxable income',              // Line 15: VA taxable income = Line 9 - Line 14
}

// ── Page 2: Tax & Credits (Lines 16–25) ─────────────────────

export const F760_TAX = {
  ssn:     'SSN 1',                                    // SSN repeated at top of page 2

  line16:  '16. Amount of tax',                        // Line 16: VA income tax
  line17:  '17. Spouse Tax Adjustment',                // Line 17: Spouse tax adjustment (MFS)
  line17a: '17a Spouse Tax Adjustment Dollar Amount',  // Line 17a: Spouse tax adjustment $
  line18:  '18. Net Amount of Tax',                    // Line 18: Net tax (16-17a)

  line19a: '19a Your Virginia Witholding',             // Line 19a: Your VA withholding
  line19b: "19b Spouse's Virginia Witholding",         // Line 19b: Spouse VA withholding
  line20:  '20. Estimated Payments Made',              // Line 20: Estimated tax payments
  line21:  '21. 2022 Overpayment applied to 2023',     // Line 21: Prior year overpayment credit
  line22:  '22. Extension Payments',                   // Line 22: Extension payments

  line23:  '23. Tax Credit for Low Income or Earned Income', // Line 23: Low-income / EIC credit
  line24:  '24. Credit for Taxes paid to another State',     // Line 24: Credit for other state taxes
  line25:  '25. Credits from SCH CR',                  // Line 25: Credits from Schedule CR
}

// ── Page 2: Payments & Result (Lines 26–36) ─────────────────

export const F760_PAYMENTS = {
  line26:  '26. Add Lines 19a Through 25',             // Line 26: Total payments & credits
  line27:  '27. Tax you owe',                          // Line 27: Tax owed (if 18 > 26)
  line28:  '28. Overpayment',                          // Line 28: Overpayment (if 26 > 18)
  line29:  '29. Overpayment credited to next year',    // Line 29: Amount applied to next year
  line30:  '30. Virginia529 and ABLE Contributions',   // Line 30: 529/ABLE contributions
  line31:  '31.  Other Contributions from SCH VAC',    // Line 31: Other voluntary contributions
  line32:  '32. Addition to Tax , Penalty and Interest',// Line 32: Penalty & interest
  line33:  "33. Consumer's Use Tax",                   // Line 33: Consumer use tax
  line34:  '34. Add lines 29 Through 33',              // Line 34: Total deductions from overpayment
  line35:  '35. Amount You Owe',                       // Line 35: Amount you owe
  line36:  '36. Your Refund',                          // Line 36: Your refund
}

// ── Page 2: Additional Fields ───────────────────────────────

export const F760_REFUND = {
  penaltyEnclosed:       'Fill in oval if 760C or 760F is enclosed',  // checkbox
  noSalesTaxDue:         'Fill in oval if no sales tax is due',       // checkbox
  payingByCard:          'Paying by Debit or Credit',                 // checkbox

  accountTypeChecking:   'Account Type',  // checkbox (first instance — checking)
  // Note: "Account Type" appears twice in PDF — 2nd instance is savings
  routingNumber:         'Bank Routing Transit Number',
  accountNumber:         'Bank Account Number',
  electronic1099G:       'Option for electronic 1099G',               // checkbox

  date1:                 'Date',
  date2:                 'Date_2',
  yourPhone:             'Your Phone Number',
  spousePhone:           "Spouse's Phone Number",
  idTheftPin:            'ID Theft PIN',

  discussWithPreparer:   'Permission to Discuss with Preparer',       // checkbox
  preparerName:          "Preparer's Name",
  preparerFirmName:      'Preparer Firm Name',
  preparerPhone:         'Preparer Phone Number',
  filingElection:        'Filing Election',
  preparerPTIN:          'Prepares PTIN',
}
