/**
 * DC Form D-40 PDF field name mapping.
 *
 * Field names discovered from the official 2024 DC D-40 (fill-in) PDF
 * using pdf-lib enumeration. The form uses a mix of descriptive field
 * names and abbreviated codes.
 *
 * 102 total fields: 77 text fields, 18 checkboxes, 5 radio groups, 2 buttons.
 *
 * Form structure:
 *   Page 1: Header, filing status, part-year, income (Lines 1-7),
 *           federal AGI (Line 8), additions/subtractions (Lines 9-16),
 *           DC AGI, deduction, DC taxable income, DC tax
 *   Page 2: Credits (Lines 21-26), refundable credits (Lines 27-32),
 *           payments (Lines 33-36), tax due/refund (Lines 37-44),
 *           direct deposit, signature
 */

// ── Header / Personal Info ──────────────────────────────────

export const D40_HEADER = {
  firstName:        'fIRST_NAME',           // Your first name
  middleInitial:    'MI',                    // Middle initial
  lastName:         'LAST_NAME',             // Last name
  ssn:              'TAX ID_NUM_1',          // Primary SSN
  spouseFirstName:  'SPOUSE_FIRST_NAME',     // Spouse first name
  spouseMiddleInitial: 'SPOUSE_MI',          // Spouse middle initial
  spouseLastName:   'SPOUSE_LAST_NAME',      // Spouse last name
  spouseSSN:        'TAX ID NUMBER_2',       // Spouse SSN
  primaryDOB:       'Primary_DOB',           // Primary date of birth
  spouseDOB:        'Spouse_DOB',            // Spouse date of birth
  daytimePhone:     'DAYTIME_PHONE',         // Daytime telephone number
  emailAddress:     'EMAIL ADDRESS',         // Email address
  addressLine1:     'ADDRESS_1',             // Mailing address line 1
  addressLine2:     'ADDRESS_2',             // Mailing address line 2
  city:             'CITY_1',                // City
  state:            'STATE_1',               // State
  zip:              'ZIP_1',                 // ZIP code
  zipPlus4:         'ZIP plus 4',            // ZIP +4
}

// ── Filing Status ───────────────────────────────────────────
// Radio group "FS" with options "1"-"9":
//   1 = Single
//   2 = Head of Household
//   3 = Married/RDP Filing Jointly
//   4 = Married/RDP Filing Separately
//   5 = Qualifying Surviving Spouse
//   6-9 = DC-specific statuses (dependent filer, etc.)

export const D40_FILING_STATUS = {
  radioGroup: 'FS',
  single:     '1',
  hoh:        '2',
  mfj:        '3',
  mfs:        '4',
  qw:         '5',
}

// ── Checkboxes ──────────────────────────────────────────────

export const D40_CHECKBOXES = {
  amended:          'AMENDED',               // Amended return
  deceasedTP1:      'DECEASED_TP1',          // Taxpayer deceased
  deceasedTP2:      'DECEASED_TP2',          // Spouse deceased
  partYearTotal:    'PART_YR_TOTAL',         // Part-year resident
  mfsIndicator:     'MFS_Indicator',         // MFS on same return indicator
}

// ── Part-Year Residency ─────────────────────────────────────

export const D40_PART_YEAR = {
  monthFrom:        'PY_Month_1',            // Part-year from month
  monthTo:          'PY_Month_2',            // Part-year to month
}

// ── Income (Lines 1-7) ─────────────────────────────────────
// Lines 1-7 are individual income categories that sum to federal AGI

export const D40_INCOME = {
  line1_wagesSalary:    'WAGES_SALARY_TIPS',       // Line 1: Wages, salaries, tips
  line2_busIncome:      'BUS_INCOME',              // Line 2: Business income or (loss)
  line2_busLoss:        'BUS_LOSS',                // Line 2: Loss checkbox
  line3_gainLoss:       'LOSS_GAIN',               // Line 3: Capital gain or (loss)
  line3_gainLossCheck:  'LOSS_GAIN_LOSS',          // Line 3: Loss checkbox
  line4_busHoldings:    'BUS_HOLDINGS',            // Line 4: Business holdings income
  line4_busHoldingsLoss:'BUS_HOLDINGS_LOSS',       // Line 4: Loss checkbox
  line5_fedAdjGross:    'HFED_ADJ_GORSS',          // Line 5: Federal adjusted gross income addtl
  line5_fedAdjLoss:     'HFED_ADY_GROSS_LOSS',     // Line 5: Loss checkbox
}

// ── Additions & Federal AGI (Lines 6-8) ─────────────────────

export const D40_ADDITIONS = {
  line6_franTaxDed:     'FRANTAXDED',                    // Line 6: DC franchise tax deduction
  line7_otherAdd:       'Other ADD from Sch I, Cal A',   // Line 7: Other additions from Sch I
  line8_addFedAGI:      'ADD-FEDAGI',                    // Line 8: Additions to federal AGI
  line8_addFedAGIMinus: 'ADD_FEDAGI_MINUS',              // Line 8: Minus checkbox
}

// ── Subtractions (Lines 9-16) ───────────────────────────────

export const D40_SUBTRACTIONS = {
  line9_nonResIncome:   'INCNON_RESI',                  // Line 9: Income of nonresidents
  line10_taxableRefund: 'TAXABLE_RCO',                   // Line 10: Taxable refunds/credits/offsets
  line11_socSecurity:   'TAXABLE_SOC',                   // Line 11: Taxable Social Security benefits
  line12_taxCoFid:      'TAX_CO_FID',                    // Line 12: Tax-exempt interest/fiduciary
  line13_survBenefit:   'SURV_BNEFT',                    // Line 13: Survivor benefits
  line14_uiBenefit:     'UI_BNEFT',                      // Line 14: Unemployment compensation
  line15_otherSub:      'OTH_FROM_B',                    // Line 15: Other from Schedule N
  line16_totalSub:      'SUB_L_8_14',                    // Line 16: Total subtractions (sum 9-15)
}

// ── DC AGI, Deductions, Taxable Income ──────────────────────

export const D40_AGI = {
  dcAGI:                'ADJUSTED_GROSS_INCOME',         // Line 17: DC adjusted gross income
  dcAGILoss:            'ASJUSTED_GROSS_INCOME_LOSS',    // Line 17: Loss checkbox
  deductionType:        'Deduction_Type',                // Radio: "S" = Standard, "I" = Itemized
  deductionAmount:      'DED_AMT',                       // Line 18: Deduction amount
  dcTaxableIncome:      'DC TAXABLE INCOME',             // Line 19: DC taxable income
  dcTaxableIncomeLoss:  'TAX_INCOME_LOSS',               // Line 19: Loss checkbox
}

// ── Tax (Line 20) ──────────────────────────────────────────

export const D40_TAX = {
  dcTax:                'D40_Line 20',                   // Line 20: Tax from tax rate schedule
}

// ── Non-Refundable Credits (Lines 21-24) ────────────────────

export const D40_CREDITS = {
  line21_childCareCal:  'CHILDCARCAL',                   // Line 21: Child care calculated amount
  line21_childCareExp:  'Child Care Exp',                // Line 21: Child and dependent care credit
  line22_nonRefCr:      'NONREFCR',                      // Line 22: Non-refundable credits from Sch U
  line23_totalNRCredit: 'TOTAL_NR_CREDIT',               // Line 23: Total non-refundable credits
  line24_taxAfterCr:    'D40_Line_24',                   // Line 24: Tax after non-refundable credits
}

// ── Health Shared Responsibility ────────────────────────────

export const D40_HSR = {
  coverage:             'HSR Coverage',                  // Radio: "Choice1"/"Choice2"
  amount:               'DC HSR',                        // Line 25: DC HSR amount
}

// ── Refundable Credits (Lines 26-32) ────────────────────────

export const D40_REFUNDABLE = {
  line26_totalTax:      'D40_Line_26',                   // Line 26: Total tax (L24 + L25)
  eitcOptIn:            'EITC Opt in',                   // EITC opt-in radio
  line27_qualChild:     'QLFY_CHILD',                    // Line 27: Number of qualifying children
  line28_earnedIncome:  'EARNED_INC_AMT',                // Line 28: Earned income amount
  line29_fedEIC:        'FED_EIC',                       // Line 29: Federal EIC
  line26d:              'D40_Line_26d',                   // Line 26d: DC EITC
  line26e:              'D40_Line_26e',                   // Line 26e: Additional EITC
  line31_propTaxCr:     'PROP_TX_CR',                    // Line 31: Property tax credit
  line32_refundableCr:  'REFUNDABLECR',                  // Line 32: Total refundable credits
  line33_totalCr:       'TOTALCR',                       // Line 33: Total credits
}

// ── Payments (Lines 34-36) ──────────────────────────────────

export const D40_PAYMENTS = {
  line34_withheld:      'DC_TAX_WITHHELD',               // Line 34: DC tax withheld (W-2/1099)
  line35_estPayments:   'EST_PMT',                       // Line 35: Estimated tax payments
  line36_extension:     'EXTEN',                         // Line 36: Extension payment
  amendPaid:            'TAX AMEND PAID',                // Amended: previously paid
  amendRefund:          'TAX AMEND REF',                 // Amended: previously refunded
  line37_totalPayment:  'TOTAL_PAYMENT',                 // Line 37: Total payments
}

// ── Tax Due / Refund (Lines 38-44) ──────────────────────────

export const D40_RESULT = {
  line38_taxDue:        'TAX_DUE',                       // Line 38: Tax due (if L26 > L37)
  line39_overpayment:   'OVERPAYMENT',                   // Line 39: Overpayment (if L37 > L26)
  line40_estTax:        'EST_TAX',                       // Line 40: Applied to estimated tax
  line41_underpayment:  'UNDERPAYMENT',                  // Line 41: Underpayment penalty (Form 2210)
  line42_contributions: 'CONT_AMT_REF',                  // Line 42: Contributions
  line43_totalDue:      'TOTAL AMOUNT DUE',              // Line 43: Total amount due
  line44_netRefund:     'NET_REFUND',                    // Line 44: Net refund
  form2210D:            '2210-D',                        // Checkbox: underpayment penalty form
}

// ── Direct Deposit ──────────────────────────────────────────

export const D40_DIRECT_DEPOSIT = {
  directDeposit:        'Direct Deposit',                // Checkbox: direct deposit
  iatFlag:              'IAT_FLAG',                      // IAT international flag
  injuredSpouse:        'INJ SP',                        // Injured spouse checkbox
  accountType:          'choice',                        // Radio: "1"=Checking, "2"=Savings, "3"=Other
  routingNumber:        'DD_ID_BANK',                    // Bank routing number
  accountNumber:        'DD_ID_ACCT_ORIG',               // Account number
  request1099G:         '1099G',                         // Request 1099-G checkbox
}

// ── Signature / Third Party ─────────────────────────────────

export const D40_SIGNATURE = {
  thirdParty:           'Third_Party',                   // Third party designee checkbox
  thirdPartyName:       'ThirdParty_Designee',           // Third party name
  thirdPartyPhone:      'ThirdParty_Telephone',          // Third party phone
  signDate:             'DATE',                          // Taxpayer signature date
  spouseDate:           'sp_DATE',                       // Spouse signature date
  preparerDate:         'Preparer\'s DATE',              // Preparer date
  preparerID:           'PREPARER_ID',                   // Preparer PTIN/ID
  preparerPhone:        'Preparer_Telephone',            // Preparer phone
}
