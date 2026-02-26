/**
 * IL Form IL-1040 PDF AcroForm field name mapping.
 *
 * Field names correspond to the AcroForm fields in the official IL-1040 PDF
 * from the Illinois Department of Revenue (2024 form, used for TY 2025).
 *
 * The IL-1040 PDF has proper AcroForm text fields that can be filled directly
 * by name (unlike NC D-400 which requires coordinate-based overlay).
 */

// ── Step 1: Personal Information ──────────────────────────────

export const IL1040_HEADER = {
  firstName:        'step1-A-firstnamemi',
  lastName:         'step1-A-lastname',
  dob:              'Step1-A-dob',
  ssn:              'step1-A-ssn',
  spouseFirstName:  'step1-A-spousefirstnamemi',
  spouseLastName:   'step1-A-spouselastname',
  spouseDob:        'step1-A-spousedob',
  spouseSSN:        'step1-A-spousessn',
  address:          'step1-A-mailingaddress',
  aptNo:            'step1-A-aptno',
  city:             'step1-A-city',
  state:            'step1-A-state',
  zip:              'step1-A-zip',
  foreignNation:    'step1-A-foreignnation',
  county:           'step1-A-county',
  email:            'step1-A-email',
}

// ── Filing status & checkboxes ────────────────────────────────

export const IL1040_CHECKBOXES = {
  filingStatus:     'filing_status',
  dependentYou:     'dependent_you',
  dependentStatus:  'dependent_status',
  residency:        'residency',
  over65You:        'over_65_you',
  over65Spouse:     'over_65_spouse',
  blindYou:         'blind_you',
  blindSpouse:      'blind',
}

// ── Income (Step 3: Base Income) ──────────────────────────────

export const IL1040_INCOME = {
  // Line 1: Federal AGI
  federalAGI:             'Federally adjusted income',
  // Line 2: Federally tax-exempt interest
  taxExemptInterest:      'Federally tax-exempt interest',
  // Line 3: Other additions
  otherAdditions:         'Other additions',
  // Line 4: Total (Lines 1+2+3)
  totalIncome:            'Total income',
  // Line 5: Social Security & retirement subtraction
  line5:                  'step3-5',
  // Line 6: Other subtractions
  line6:                  'step3-6',
  // Line 7: Total subtractions (Lines 5+6)
  line7:                  'step3-7',
  // Line 8: Total (Lines 5+6+7)
  totalSubtractions:      'Total of your subtractions',
  // Line 9: IL base income
  baseIncome:             'Illinois base income',
}

// ── Exemptions (Step 4) ───────────────────────────────────────

export const IL1040_EXEMPTIONS = {
  exemptionAmount:        'Exemption amount',
  over65ExemptionAmount:  '65 or older exemption amount',
  blindExemptionAmount:   'Legally blind exemption amount',
  dependentsClaimed:      'Claiming dependents',
  exemptionAllowance:     'Exemption allowance',
}

// ── Tax (Step 5-7) ───────────────────────────────────────────

export const IL1040_TAX = {
  netIncomeNR:            'Illinois net income from Schedule NR',
  residencyRate:          'Multiply residency rate',
  recaptureCredits:       'Recapture of investment tax credits',
  incomeTax:              'Income tax',
  taxPaidOtherState:      'Income tax paid to another state',
  scheduleICR:            'Schedule ICR',
  credits1299C:           'Credit amount from Schedule 1299-C',
  totalCredits:           'Total of your credits',
  taxAfterCredits:        'Tax after nonrefundable credits',
  householdTax:           'Household employment tax',
  useTax:                 'Use tax',
  cannabisTax:            'Compassionate Use of Medical Cannabis Program Act',
  totalTax:               'Total Tax',
}

// ── Payments (Step 8-9) ──────────────────────────────────────

export const IL1040_PAYMENTS = {
  totalTaxPage1:          'Total tax from Page 1',
  withheld:               'Illinois Income Tax withheld',
  estimatedPayments:      'Estimated payments',
  passthroughWithholding: 'Pass-through withholding',
  passthroughCredit:      'Pass-through entity tax credit',
  eic:                    'Earned Income Tax Credit from Schedule IL-E/EIC',
  childTaxCredit:         'Child Tax credit from Sch.IL-EITC',
  totalPayments:          'Total payments and refundable credit',
}

// ── Result (Step 10-11) ──────────────────────────────────────

export const IL1040_RESULT = {
  overpayment:            'If Line 31 is greater',
  underpayment:           'If Line 24 is greater',
  latePenalty:            'Late-payment penalty for underpayment',
  voluntaryDonations:     'Voluntary charitable donations',
  totalPenaltyDonations:  'Total penalty and donations',
  overpaymentAmount:      'Overpayment amount',
  refund:                 'Refunded to you',
  routingNumber:          'Routing number',
  accountNumber:          'Account number',
  creditForward:          'Amount to be credited forwarded',
  amountYouOwe:           'Amount you owe',
}
