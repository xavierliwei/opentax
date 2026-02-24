/**
 * CA Form 540 PDF field name mapping.
 *
 * Field names discovered from FTB f540.pdf (2025) using pdf-lib enumeration.
 * Prefix: "540_form_" followed by page-group digit and sequence number.
 *
 * Page 1 = 1xxx (header, address, filing status, exemptions)
 * Page 2 = 2xxx (dependents, income, tax, credits)
 * Page 3 = 3xxx (credits, other taxes, payments, use tax, overpaid)
 * Page 4 = 4xxx (overpaid cont., contributions)
 * Page 5 = 5xxx (amount you owe, refund, direct deposit)
 * Page 6 = 6xxx (signature)
 */

// ── Page 1: Header / Filing Status / Exemptions ─────────

export const F540_HEADER = {
  amendedReturn:    '540_form_1001 CB',   // Amended return checkbox
  fiscalYearMonth:  '540_form_1002',       // Fiscal year end month
  firstName:        '540_form_1003',       // Your first name
  initial:          '540_form_1004',       // Your initial
  lastName:         '540_form_1005',       // Your last name
  suffix:           '540_form_1006',       // Suffix
  ssn:              '540_form_1007',       // Your SSN or ITIN
  spouseFirstName:  '540_form_1008',       // Spouse/RDP first name
  spouseInitial:    '540_form_1009',       // Spouse/RDP initial
  spouseLastName:   '540_form_1010',       // Spouse/RDP last name
  spouseSuffix:     '540_form_1011',       // Spouse/RDP suffix
  spouseSSN:        '540_form_1012',       // Spouse/RDP SSN or ITIN
  additionalInfo:   '540_form_1013',       // Additional information
  pbaCode:          '540_form_1014',       // PBA code
  street:           '540_form_1015',       // Street address or PO box
  apt:              '540_form_1016',       // Apt no/ste no
  pmb:              '540_form_1017',       // PMB/private mailbox
  city:             '540_form_1018',       // City
  state:            '540_form_1019',       // State
  zip:              '540_form_1020',       // ZIP code
  foreignCountry:   '540_form_1021',       // Foreign country name
  foreignProvince:  '540_form_1022',       // Foreign province/state/county
  foreignPostal:    '540_form_1023',       // Foreign postal code
  yourDOB:          '540_form_1024',       // Your DOB (mm/dd/yyyy)
  spouseDOB:        '540_form_1025',       // Spouse/RDP DOB
  yourPriorName:    '540_form_1026',       // Your prior name
  spousePriorName:  '540_form_1027',       // Spouse/RDP prior name
  county:           '540_form_1028',       // County at time of filing
  sameAddress:      '540_form_1029 CB',    // Same as principal residence checkbox
}

// Filing status radio group — option values from the PDF
export const F540_FILING_STATUS = {
  radioGroup:       '540_form_1036 RB',
  // Options (exact values from PDF AcroForm):
  single:  '1 . Single.',
  mfj:     '2 . Married/R D P filing jointly (even if only one spouse / R D P had income). See instructions.',
  mfs:     '3 . Married or R D P filing separately.',
  hoh:     '4 . Head of household (with qualifying person). See instructions.',
  qw:      '5 . Qualifying surviving spouse or R D P .',
  // Associated fields
  mfsSpouseName:    '540_form_1037',       // MFS: spouse's name
  qwYearDied:       '540_form_1038',       // QW: year spouse/RDP died
  hohQualPerson:    '540_form_1039',       // HOH: qualifying person
  dependentCB:      '540_form_1040 CB',    // Line 6: can be claimed as dependent
}

export const F540_EXEMPTIONS = {
  line7count:    '540_form_1041',   // Line 7 personal exemption count
  line7amount:   '540_form_1042',   // Line 7 personal exemption $ amount
  line8count:    '540_form_1043',   // Line 8 blind count
  line8amount:   '540_form_1044',   // Line 8 blind $ amount
  line9count:    '540_form_1045',   // Line 9 senior count
  line9amount:   '540_form_1046',   // Line 9 senior $ amount
}

// ── Page 2: Dependents / Income / Tax / Credits ─────────

export const F540_PAGE2_HEADER = {
  yourName: '540_form_2001',   // Your name (top of each page)
  yourSSN:  '540_form_2002',   // Your SSN (top of each page)
}

export const F540_DEPENDENTS = {
  dep1FirstName:    '540_form_2003',
  dep1LastName:     '540_form_2004',
  dep1SSN:          '540_form_2005',
  dep1Relationship: '540_form_2006',
  dep2FirstName:    '540_form_2007',
  dep2LastName:     '540_form_2008',
  dep2SSN:          '540_form_2009',
  dep2Relationship: '540_form_2010',
  dep3FirstName:    '540_form_2011',
  dep3LastName:     '540_form_2012',
  dep3SSN:          '540_form_2013',
  dep3Relationship: '540_form_2014',
  line10count:      '540_form_2015',   // Total dependent exemptions count
  line10amount:     '540_form_2016',   // Line 10 $ amount (count × $475)
  line11:           '540_form_2017',   // Line 11 total exemption amount
}

export const F540_INCOME = {
  line12:  '540_form_2018',   // State wages from W-2 box 16
  line13:  '540_form_2019',   // Federal AGI
  line14:  '540_form_2020',   // CA adjustments – subtractions (Schedule CA col B)
  line15:  '540_form_2021',   // Line 13 – Line 14
  line16:  '540_form_2022',   // CA adjustments – additions (Schedule CA col C)
  line17:  '540_form_2023',   // CA AGI (Line 15 + Line 16)
  line18:  '540_form_2024',   // Deduction (larger of itemized or standard)
  line19:  '540_form_2025',   // Taxable income (Line 17 – Line 18)
}

export const F540_TAX = {
  taxTableCB:      '540_form_2026 CB',   // Tax Table checkbox
  taxRateSchedCB:  '540_form_2027 CB',   // Tax Rate Schedule checkbox
  ftb3800CB:       '540_form_2028 CB',   // FTB 3800 checkbox
  ftb3803CB:       '540_form_2029 CB',   // FTB 3803 checkbox
  line31:          '540_form_2030',       // Line 31 tax
  line32:          '540_form_2031',       // Line 32 exemption credits
  line33:          '540_form_2032',       // Line 33 (line 31 – line 32)
  schedG1CB:       '540_form_2033 CB',   // Line 34 Schedule G-1 checkbox
  ftb5870ACB:      '540_form_2034 CB',   // Line 34 FTB 5870A checkbox
  line34:          '540_form_2035',       // Line 34 tax
  line35:          '540_form_2036',       // Line 35 (line 33 + line 34)
}

export const F540_CREDITS = {
  line40:         '540_form_2037',       // Line 40 child/dependent care credit
  line43name:     '540_form_2038',       // Line 43 credit name
  line43code:     '540_form_2039',       // Line 43 credit code
  line43amount:   '540_form_2040',       // Line 43 credit amount
  line44name:     '540_form_2041',       // Line 44 credit name
  line44code:     '540_form_2042',       // Line 44 credit code
  line44amount:   '540_form_2043',       // Line 44 credit amount
}

// ── Page 3: Credits (cont), Other Taxes, Payments, Use Tax, Overpaid ──

export const F540_PAGE3 = {
  line45:   '540_form_3003',   // Line 45 additional credits
  line46:   '540_form_3004',   // Line 46 nonrefundable renter's credit
  line47:   '540_form_3005',   // Line 47 total credits
  line48:   '540_form_3006',   // Line 48 tax after credits (line 35 – line 47)
  // Other Taxes
  line61:   '540_form_3007',   // Line 61 AMT
  line62:   '540_form_3008',   // Line 62 Behavioral Health Services Tax
  line63:   '540_form_3009',   // Line 63 other taxes
  line64:   '540_form_3010',   // Line 64 total tax
  // Payments
  line71:   '540_form_3011',   // Line 71 CA income tax withheld
  line72:   '540_form_3012',   // Line 72 estimated tax payments
  line73:   '540_form_3013',   // Line 73 withholding (592-B/593)
  line74:   '540_form_3014',   // Line 74 motion picture credit
  line75:   '540_form_3015',   // Line 75 EITC
  line76:   '540_form_3016',   // Line 76 YCTC
  line77:   '540_form_3017',   // Line 77 FYTC
  line78:   '540_form_3018',   // Line 78 total payments
  // Use Tax
  line91:   '540_form_3019',   // Line 91 use tax
  useTaxRadio: '540_form_3020 RB', // Use tax: no use tax / paid to CDTFA
  useTaxNoOwed: 'No use tax is owed.',
  line92cb: '540_form_3021 CB',   // Line 92 health care coverage
  isrPenalty: '540_form_3022',     // ISR penalty
  // Overpaid Tax / Tax Due
  line93:   '540_form_3023',   // Line 93 payments balance
  line94:   '540_form_3024',   // Line 94 use tax balance
  line95:   '540_form_3025',   // Line 95 payments after ISR penalty
  line96:   '540_form_3026',   // Line 96 ISR penalty balance
  line97:   '540_form_3027',   // Line 97 overpaid tax
}

// ── Page 4: Overpaid (cont) / Contributions ──────────────

export const F540_PAGE4 = {
  line98:   '540_form_4003',   // Line 98 applied to 2026 estimated tax
  line99:   '540_form_4004',   // Line 99 overpaid tax available this year
  line100:  '540_form_4005',   // Line 100 tax due
}

// ── Page 5: Amount You Owe / Refund ─────────────────────

export const F540_PAGE5 = {
  line111:  '540_form_5002',   // Line 111 amount you owe
  line115:  '540_form_5007',   // Line 115 refund or no amount due
}
