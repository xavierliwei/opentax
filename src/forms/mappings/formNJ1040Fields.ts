/**
 * NJ Form NJ-1040 PDF field name mapping.
 *
 * Field names discovered from nj.gov nj1040.pdf (2024) using pdf-lib enumeration.
 * The NJ-1040 uses individual single-digit text fields for dollar amounts,
 * so each line maps to an array of field names (left-to-right, most-significant
 * digit first). Dollar amounts are filled right-to-left.
 *
 * Page 0 = Header, address, filing status, exemptions, dependents
 * Page 1 = Income (Lines 15–29), deductions (30–36), exemptions total (37),
 *          property tax (38a), tax (39), tax liability (41)
 * Page 2 = Credits (40–48), balance (49–56), refund/owed (58–66)
 * Page 3 = Contributions (68–76), signature
 */

// ── Page 0: Header / Address / Filing Status ────────────────

export const NJ1040_HEADER = {
  /** Taxpayer SSN — 9 individual digit fields */
  ssnDigits: [
    'undefined', 'undefined_2', 'Your Social Security Number required',
    'Text3', 'Text4', 'Text5', 'Text6', 'Text7', 'Text8',
  ],
  /** Taxpayer name (combined first, MI, last) — wide text field */
  fullName: 'Last Name First Name Initial Joint Filers enter first name and middle initial of each Enter spousesCU partners last name ONLY if different',
  /** Spouse SSN — 9 individual digit fields */
  spouseSsnDigits: [
    'undefined_3', 'undefined_4', 'undefined_5',
    'Text9', 'Text10', 'Text11', 'Text12', 'Text13', 'Text14',
  ],
  /** Spouse/CU partner name — wide text field */
  spouseName: 'SpousesCU Partners SSN if filing jointly',
  /** County/municipality code */
  countyMuniCode: 'CountyMunicipality Code See Table page 50',
  /** State */
  state: 'State',
  /** ZIP code */
  zip: 'ZIP Code',
  /** County/municipality code digit fields (4 digits) */
  cmDigits: ['CM4', 'CM3', 'CM2', 'CM1'],
  /** Daytime phone digits (8 digit fields) */
  phoneDigits: [
    'Text21', 'Text22', 'Text23', 'Text24',
    'Text25', 'Text26', 'Text27', 'Text28',
  ],
  /** Tax year last 2 digits */
  taxYear1: '2020',
  taxYear2: 'Text29',
}

// ── Filing Status ─────────────────────────────────────────────

export const NJ1040_FILING_STATUS = {
  /** Filing status radio group */
  radioGroup: 'Group1',
  single: 'Choice1',
  mfj: 'Choice2',
  mfs: 'Choice3',
  hoh: 'Choice4',
  qw: 'Choice5',
  /** MFS: spouse SSN digits (9 fields) */
  mfsSpouseSsnDigits: [
    'undefined_7', 'undefined_8', 'Enter spousesCU partners SSN',
    'Text31', 'Text32', 'Text33', 'Text34', 'Text35', 'Text36',
  ],
  /** Qualifying widow(er) sub-radio */
  qwRadioGroup: 'Group1qualwi5ab',
}

// ── Exemptions (Page 0 lower section) ────────────────────────

export const NJ1040_EXEMPTIONS = {
  // Checkboxes
  selfRegular: 'Check Box39',
  spouseRegular: 'Check Box40',
  selfAge65: 'Check Box41',
  spouseAge65: 'Check Box42',
  selfBlindDisabled: 'Check Box43',
  spouseBlindDisabled: 'Check Box44',
  selfVeteran: 'Check Box45',
  spouseVeteran: 'Check Box46',

  // Count + amount fields (count is single digit, amount is wide text)
  regularCount: 'Domestic',
  regularAmount: 'x  1000',
  age65Count: 'undefined_9',
  age65Amount: 'x  1000_2',
  blindDisabledCount: 'undefined_10',
  blindDisabledAmount: 'x  1000_3',
  veteranCount: 'undefined_11',
  veteranAmount: 'x  6000',
  dependentChildCount: 'undefined_12',
  dependentChildAmount: 'x  1500',
  collegeStudentCount: 'undefined_13',
  collegeStudentAmount: 'x  1500_2',
  otherDependentCount: 'undefined_14',
  otherDependentAmount: 'x  1000_4',
}

// ── Dependents (Page 0 bottom) ───────────────────────────────

export const NJ1040_DEPENDENTS = {
  dep1Name: 'Last Name First Name Middle Initial 1',
  dep1SsnDigits: [
    'undefined_18', 'undefined_19', 'undefined_20',
    'Text54', 'Text55', 'Text56', 'Text57', 'Text58', 'Text59',
  ],
  dep1BirthYearDigits: ['Birth Year', 'Text60', 'Text61', 'Text62'],
  dep1HealthCoverage: 'Check Box63',

  dep2Name: 'Last Name First Name Middle Initial 2',
  dep2SsnDigits: [
    'undefined_21', 'undefined_22', 'undefined_23', 'undefined_24',
    'Text65', 'Text66', 'Text67', 'Text68', 'Text69',
  ],
  dep2BirthYearDigits: ['Text70', 'Text71', 'Text72', 'Text73'],
  dep2HealthCoverage: 'Check Box74',

  dep3Name: 'Last Name First Name Middle Initial 3',
  dep3SsnDigits: [
    'undefined_25', 'undefined_26', 'undefined_27', 'undefined_28',
    'Text75', 'Text76', 'Text77', 'Text78', 'Text79',
  ],
  dep3BirthYearDigits: ['Text80', 'Text81', 'Text82', 'Text83'],
  dep3HealthCoverage: 'Check Box84',

  dep4Name: 'Last Name First Name Middle Initial 4',
  dep4SsnDigits: [
    'undefined_29', 'undefined_30', 'undefined_31', 'undefined_32',
    'Text85', 'Text86', 'Text87', 'Text88', 'Text89',
  ],
  dep4BirthYearDigits: ['Text90', 'Text91', 'Text92', 'Text93'],
  dep4HealthCoverage: 'Check Box94',
}

// ── Page 1 header ─────────────────────────────────────────────

export const NJ1040_PAGE1_HEADER = {
  yourSSN: 'Your Social Security Number',
  yourName: 'Names as shown on Form NJ1040',
}

// ── Income Lines (Page 1: Lines 15–29) ────────────────────────
// Each line is an array of single-digit field names, left-to-right.

export const NJ1040_INCOME = {
  /** Line 15 — Wages, salaries, tips (9 digits) */
  line15: ['15', 'undefined_36', 'undefined_37', 'Text100', 'Text101', 'Text103', 'Text104', 'Text105', 'Text106'],
  /** Line 16a — Taxable interest (7 digits) */
  line16a: ['16a', 'undefined_44', '113', '114', '115', '116', '117'],
  /** Line 17 — Dividends (10 digits) */
  line17: ['17', 'undefined_45', 'undefined_46', 'undefined_47', '118', '119', '120', '121', '122', '123'],
  /** Line 18 — Net business income (10 digits) */
  line18: ['18', 'undefined_48', 'undefined_49', 'undefined_50', '124', '125', '126', '127', '128', '129'],
  /** Line 19 — Net gains from disposition of property (10 digits) */
  line19: ['19', 'undefined_51', 'undefined_52', 'undefined_53', '130', '131', '132', '133', '134', '135'],
  /** Line 20a — Pensions, annuities, IRA (10 digits) */
  line20a: ['20a', 'undefined_54', 'undefined_55', 'undefined_56', '136', '137', '138', '139', '140', '141'],
  /** Line 20b — Pension exclusion (9 digits) */
  line20b: ['20b', 'undefined_57', '142', '143', 'undefined_58', '144', '145', 'undefined_59', '146'],
  /** Line 21 — Partnership/S-corp income (10 digits) */
  line21: ['21', '147', 'undefined_60', '148', '149', 'undefined_61', '150', '151', 'undefined_62', '152'],
  /** Line 22 — Rental income (10 digits) */
  line22: ['22', '153', 'undefined_63', '154', '155', 'undefined_64', '156', '157', 'undefined_65', '158'],
  /** Line 23 — Unused (10 digits) */
  line23: ['23', '159', 'undefined_66', '160', '161', 'undefined_67', '162', '163', 'undefined_68', '164'],
  /** Line 24 — Unused (10 digits) */
  line24: ['24', '165', 'undefined_69', '166', '167', 'undefined_70', '168', '169', 'undefined_71', '170'],
  /** Line 25 — Other income (10 digits) */
  line25: ['25', '171', 'undefined_72', '172', '173', 'undefined_73', '174', '175', 'undefined_74', '176'],
  /** Line 26 — Unused (10 digits) */
  line26: ['26', '177', 'undefined_75', '178', '179', 'undefined_76', '180', '181', 'undefined_77', '182'],
  /** Line 27 — Total income (10 digits) */
  line27: ['27', '183', 'undefined_78', '184', '185', 'undefined_79', '186', '187', 'undefined_80', '188'],
  /** Line 28a — Excludable pensions/annuities (8 digits) */
  line28a: ['28a', '189', '190', 'undefined_81', '191', '192', 'undefined_82', '193'],
  /** Line 28b — Other income exclusions (8 digits) */
  line28b: ['28b', '194', '195', 'undefined_83', '196', '197', 'undefined_84', '198'],
  /** Line 28c — Total exclusions (8 digits) */
  line28c: ['28c', '199', '200', 'undefined_85', '201', '202', 'undefined_86', '203'],
  /** Line 29 — NJ gross income (10 digits) */
  line29: ['29', '204', 'undefined_87', '205', '206', 'undefined_88', '207', '208', 'undefined_89', '209'],
}

// ── Deductions (Page 1: Lines 30–36) ─────────────────────────

export const NJ1040_DEDUCTIONS = {
  /** Line 30 — Property tax deduction (8 digits) */
  line30: ['30', '210', '211', 'undefined_90', '212', '213', 'undefined_91', '214'],
  /** Line 31 — Medical expenses (8 digits) */
  line31: ['31', '215', '216', 'undefined_92', '217', '218', 'undefined_93', '219'],
  /** Line 32 — Alimony/maintenance payments (8 digits) */
  line32: ['32', '220', '221', 'undefined_94', '222', '223', 'undefined_95', '224'],
  /** Line 33 — Qualified conservation contribution (8 digits) */
  line33: ['33', '225', '226', 'undefined_96', '227', '228', 'undefined_97', '229'],
  /** Line 34 — Health enterprise zone deduction (8 digits) */
  line34: ['34', '230', '231', 'undefined_98', '232', '233', 'undefined_99', '234'],
  /** Line 35 — Alternative business income (8 digits) */
  line35: ['35', '235', '236', 'undefined_100', '237', '238', 'undefined_101', '239'],
  /** Line 36 — Total deductions (8 digits) */
  line36: ['36', '240', '241', 'undefined_102', '242', '243', 'undefined_103', '244'],
}

// ── Exemptions total / Property Tax / Tax (Page 1 bottom) ────

export const NJ1040_TAX = {
  /** Line 37 — Exemptions amount (3 digits, x=463+) */
  line37: ['37', '245', '24539a#2'],
  /** Line 38a — Total property taxes (10 digits) */
  line38a: [
    '38a Total Property Taxes 18 of Rent Paid See instructions page 23 38a',
    '251', 'undefined_107', '252', '253', 'undefined_108', '254', '255', 'undefined_109', '256',
  ],
  /** Line 38b — Block/lot/qualifier fields */
  line38bBlock: '38b Block',
  line38bQualifier: 'Qualifier',
  /** Property tax deduction vs credit radio */
  propertyTaxRadio: 'Group182',
  propertyTaxDeduction: 'Choice1',
  propertyTaxCredit: 'Choice2',
  propertyTaxNone: 'Choice3',
  /** Line 39 — NJ tax (7 digits, x=334–445) */
  line39: ['39', '280', 'undefined_112', '281', '282', 'undefined_113', '283'],
  /** Line 41 — Total tax + penalty/interest (6 digits) */
  line41: ['41', 'undefined_117', 'undefined_118', 'Text1', 'Text2', 'Text18'],
}

// ── Page 2 header ─────────────────────────────────────────────

export const NJ1040_PAGE2_HEADER = {
  yourSSN: 'Your Social Security Number_2',
  yourName: 'Names as shown on Form NJ1040_2',
}

// ── Credits (Page 2: Lines 40–48) ────────────────────────────

export const NJ1040_CREDITS = {
  /** Line 40 — Credit for income tax paid to other jurisdictions (8 digits) */
  line40: ['40', 'undefined_114', 'Text19', 'Text37', 'Text38', 'Text39', 'Text40', 'Text41'],
  /** Line 42 — Credit for excess UI/HC/WD contributions (8 digits) */
  line42: ['42', 'undefined_119', 'undefined_120', 'Text43', 'Text44', 'Text45', 'Text46', 'Text63'],
  /** Line 43 — Property tax credit (8 digits) */
  line43: ['43', 'undefined_121', 'undefined_122', 'Text64', 'Text74', 'Text84', 'Text94', 'Text95'],
  /** Line 44 — NJ Earned Income Tax Credit (6 digits) */
  line44: ['44', 'undefined_123', 'undefined_124', 'Text96', 'Text97', 'Text98'],
  /** Line 45 — NJ Child Tax Credit (8 digits) */
  line45: ['45', 'undefined_125', 'undefined_126', 'Text99', 'Text102', 'Text108', 'Text109', 'Text110'],
  /** Line 46 — Excess NJ UI/HC/WD withheld (8 digits) */
  line46: ['46', 'undefined_127', 'undefined_128', 'Text111', 'Text112', 'Text113', 'Text114', 'Text115'],
  /** Line 47 — Other credits (8 digits) */
  line47: ['47', 'undefined_129', 'undefined_130', 'Text116', 'Text117', 'Text118', 'Text119', 'Text120'],
  /** Line 48 — Total credits (8 digits) */
  line48: ['48', 'undefined_131', 'undefined_132', 'Text121', 'Text122', 'Text123', 'Text124', 'Text125'],
}

// ── Balance (Page 2: Lines 49–56) ────────────────────────────

export const NJ1040_BALANCE = {
  /** Line 49 — Tax after credits (8 digits) */
  line49: ['49', 'undefined_133', 'undefined_134', 'Text126', 'Text127', 'Text128', 'Text129', 'Text130'],
  /** Line 50 — Use tax (8 digits, 50/50_2/50_3 + Text131-134 + 50_7) */
  line50: ['50', '50_2', '50_3', 'Text131', 'Text132', 'Text133', 'Text134', '50_7'],
  /** Line 51 — Total tax due (8 digits) */
  line51: ['51', 'undefined_137', 'undefined_138', 'Text136', 'Text137', 'Text138', 'Text139', 'Text140'],
  /** W-2 attachment checkboxes */
  w2Attached: 'Check Box146',
  /** Line 52 — NJ income tax withheld (8 digits) */
  line52: ['52', 'undefined_139', 'undefined_140', 'Text141', 'Text142', 'Text143', 'Text144', 'Text145'],
  /** 1099-R attached checkbox */
  form1099RAttached: 'Check Box147',
  /** Line 53 — Estimated tax payments (8 digits) */
  line53: ['53', 'undefined_141', 'undefined_142', 'Text148', 'Text149', 'Text150', 'Text151', 'Text152'],
  /** Line 55 — Total payments (4 digits, x=486+) */
  line55: ['55', 'undefined_146', 'Text158', 'Text159'],
  /** Line 56 — Overpaid (6 digits, x=374–480) */
  line56: ['56!#$$', '56', 'undefined_147', 'undefined_148', 'undefined_149', 'Text160'],
}

// ── Refund / Amount Owed (Page 2: Lines 58–66) ──────────────

export const NJ1040_RESULT = {
  /** Line 58 — Amount of overpayment to be applied to 2026 (6 digits) */
  line58: ['58', 'undefined_152', 'undefined_153', 'Text170', 'Text171', 'Text172'],
  /** Line 59 — Amount of overpayment to NJ Gross Income Tax Trust Fund (6 digits) */
  line59: ['59', 'undefined_154', 'undefined_155', 'Text173', 'Text174', 'Text175'],
  /** Line 60 — Amount of overpayment to Endangered Wildlife Fund (6 digits) */
  line60: ['60', 'undefined_156', 'undefined_157', 'Text176', 'Text177', 'Text178'],
  /** Line 61 — Amount of overpayment to Children's Trust Fund (6 digits) */
  line61: ['61', 'undefined_158', 'undefined_159', 'Text179', 'Text180', 'Text181'],
  /** Line 62 — Amount of line 56 you want refunded (3 digits, x=411–460) */
  line62: ['62', 'undefined_160', 'undefined_161'],
  /** Line 63 — Other credits/adjustments (8 digits) */
  line63: ['63', 'undefined_163', 'undefined_164', 'Text187', 'Text188', 'Text189', 'Text190', 'Text191'],
  /** Line 64 — Amount of refund (6 digits) */
  line64: ['64', 'Text182', 'Text183', 'Text184', 'Text185', 'Text186'],
  /** Direct deposit checkbox */
  directDeposit: 'Check Box169123',
  /** Line 66 — Amount you owe (5 digits, x=467+) */
  line66: ['66', 'undefined_172', 'Text202', 'Text203', 'Text204'],
}

// ── Page 3 header ─────────────────────────────────────────────

export const NJ1040_PAGE3_HEADER = {
  yourSSN: 'Your Social Security Number_3',
  yourName: 'Names as shown on Form NJ1040_3',
}

// ── Contributions (Page 3: Lines 68–76) ──────────────────────

export const NJ1040_PAGE3 = {
  /** Line 68 (5 digits) */
  line68: ['68', 'undefined_17268', 'Text20268', 'Text20368', 'Text20468'],
  /** Line 71 (5 digits) */
  line71: ['71', 'undefined_177', 'Text218', 'Text219', 'Text220'],
  /** Line 72 (5 digits) */
  line72: ['72', 'undefined_178', 'Text222', 'Text223', 'Text224'],
  /** Line 73 (5 digits) */
  line73: ['73', 'Text280', 'Text226', 'Text227', 'Text228'],
  /** Line 74 — Total contributions (9 digits) */
  line74: ['74', 'undefined_181', 'undefined_182', 'undefined_183', 'Text229', 'Text230', 'Text231', 'Text232', 'Text233'],
  /** Line 75 — Total amount due (9 digits) */
  line75: ['75', 'undefined_184', 'undefined_185', 'undefined_186', 'Text234', 'Text235', 'Text236', 'Text237', 'Text238'],
  /** Line 76 — Total overpayment (9 digits) */
  line76: ['76', 'undefined_187', 'undefined_188', 'undefined_189', 'Text240', 'Text241', 'Text242', 'Text243', 'Text244'],
}
