/**
 * Zod runtime validation schemas — mirrors the TypeScript types in types.ts.
 *
 * These schemas provide runtime validation for tax return data coming from
 * HTTP requests or loaded from SQLite storage. They complement (but do not
 * replace) the TypeScript types.
 *
 * Conventions:
 *  - Monetary amounts are in integer cents (non-negative unless noted).
 *  - SSN/EIN are 9-digit strings (no dashes).
 *  - State codes are 2-letter uppercase.
 */

import { z } from 'zod'

// ── Reusable validators ──────────────────────────────────────────

/** Exactly 9 digits, no dashes. */
const ssnSchema = z.string().regex(/^\d{9}$/, 'SSN must be exactly 9 digits')

/** Exactly 9 digits, no dashes (same format as SSN but semantically an EIN). */
const einSchema = z.string().regex(/^\d{9}$/, 'EIN must be exactly 9 digits')

/**
 * EIN as typically formatted on a W-2: XX-XXXXXXX.
 * We accept both the dashed format and the raw 9-digit format.
 */
const employerEinSchema = z.string().regex(
  /^(\d{2}-\d{7}|\d{9})$/,
  'Employer EIN must be 9 digits, optionally formatted as XX-XXXXXXX',
)

/** 2-letter uppercase state code. */
const stateCodeSchema = z.string().regex(/^[A-Z]{2}$/, 'State must be a 2-letter uppercase code')

/** Non-negative integer (cents). */
const centsNonNeg = z.number().int().min(0, 'Amount must be non-negative')

/** Integer (cents) — may be negative (e.g. gains/losses, adjustments). */
const centsAny = z.number().int()

// ── Income source identifiers ────────────────────────────────────

const incomeSourceIdSchema = z.enum([
  'w2', 'interest', 'dividends', 'unemployment', 'retirement',
  'stocks', 'rsu', 'iso', 'rental', 'business', '1099-nec', 'k1', 'other',
  'health-marketplace',
])

// ── Filing status ────────────────────────────────────────────────

const filingStatusSchema = z.enum(['single', 'mfj', 'mfs', 'hoh', 'qw'])

// ── Address ──────────────────────────────────────────────────────

const addressSchema = z.object({
  street: z.string(),
  apartment: z.string().optional(),
  city: z.string(),
  state: z.string(),   // loose — not enforced as 2-letter here (users may enter partial)
  zip: z.string(),
})

// ── Taxpayer ─────────────────────────────────────────────────────

const taxpayerSchema = z.object({
  firstName: z.string(),
  middleInitial: z.string().optional(),
  lastName: z.string(),
  ssn: z.string(),              // validated more strictly at the top-level (allows empty during entry)
  dateOfBirth: z.string().optional(),
  address: addressSchema,
})

// ── Dependent ────────────────────────────────────────────────────

const dependentSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  ssn: z.string(),
  relationship: z.string(),
  monthsLived: z.number().int().min(0).max(12),
  dateOfBirth: z.string(),
})

// ── W-2 ──────────────────────────────────────────────────────────

const w2Box12EntrySchema = z.object({
  code: z.string(),
  amount: centsAny,
})

const w2Schema = z.object({
  id: z.string(),
  owner: z.enum(['taxpayer', 'spouse']).optional(),

  // Employer info
  employerEin: z.string(),
  employerName: z.string(),
  employerAddress: addressSchema.optional(),

  // Income boxes (cents — non-negative)
  box1: centsNonNeg,
  box2: centsNonNeg,
  box3: centsNonNeg,
  box4: centsNonNeg,
  box5: centsNonNeg,
  box6: centsNonNeg,
  box7: centsNonNeg,
  box8: centsNonNeg,
  box10: centsNonNeg,
  box11: centsNonNeg,

  // Box 12
  box12: z.array(w2Box12EntrySchema),

  // Box 13 checkboxes
  box13StatutoryEmployee: z.boolean(),
  box13RetirementPlan: z.boolean(),
  box13ThirdPartySickPay: z.boolean(),

  // Box 14
  box14: z.string(),

  // State/local (optional)
  box15State: z.string().optional(),
  box15EmployerStateId: z.string().optional(),
  box16StateWages: centsNonNeg.optional(),
  box17StateIncomeTax: centsNonNeg.optional(),
  box18LocalWages: centsNonNeg.optional(),
  box19LocalIncomeTax: centsNonNeg.optional(),
  box20LocalityName: z.string().optional(),
})

// ── 1099-B ───────────────────────────────────────────────────────

const form1099BSchema = z.object({
  id: z.string(),
  brokerName: z.string(),
  brokerTin: z.string().optional(),
  description: z.string(),
  cusip: z.string().optional(),
  dateAcquired: z.string().nullable(),
  dateSold: z.string(),
  proceeds: centsAny,
  costBasis: centsAny.nullable(),
  washSaleLossDisallowed: centsNonNeg,
  gainLoss: centsAny,
  basisReportedToIrs: z.boolean(),
  longTerm: z.boolean().nullable(),
  noncoveredSecurity: z.boolean(),
  federalTaxWithheld: centsNonNeg,
})

// ── 1099-INT ─────────────────────────────────────────────────────

const form1099INTSchema = z.object({
  id: z.string(),
  payerName: z.string(),
  payerTin: z.string().optional(),
  box1: centsNonNeg,
  box2: centsNonNeg,
  box3: centsNonNeg,
  box4: centsNonNeg,
  box6: centsNonNeg.optional(),
  box7: z.string().optional(),
  box8: centsNonNeg,
})

// ── 1099-DIV ─────────────────────────────────────────────────────

const form1099DIVSchema = z.object({
  id: z.string(),
  payerName: z.string(),
  payerTin: z.string().optional(),
  box1a: centsNonNeg,
  box1b: centsNonNeg,
  box2a: centsNonNeg,
  box3: centsNonNeg,
  box4: centsNonNeg,
  box5: centsNonNeg,
  box7: centsNonNeg.optional(),
  box8: z.string().optional(),
  box11: centsNonNeg,
})

// ── 1099-MISC ────────────────────────────────────────────────────

const form1099MISCSchema = z.object({
  id: z.string(),
  payerName: z.string(),
  payerTin: z.string().optional(),
  box1: centsNonNeg,
  box2: centsNonNeg,
  box3: centsNonNeg,
  box4: centsNonNeg,
})

// ── 1099-NEC ────────────────────────────────────────────────────

const form1099NECSchema = z.object({
  id: z.string(),
  payerName: z.string(),
  payerTIN: z.string().optional(),
  nonemployeeCompensation: centsNonNeg,
  federalTaxWithheld: centsNonNeg.optional(),
  stateTaxWithheld: centsNonNeg.optional(),
  statePayerNo: z.string().optional(),
  stateIncome: centsNonNeg.optional(),
})

// ── 1099-G ───────────────────────────────────────────────────────

const form1099GSchema = z.object({
  id: z.string(),
  payerName: z.string(),
  payerTin: z.string().optional(),
  box1: centsNonNeg,
  box2: centsNonNeg,
  box3: centsAny,
  box4: centsNonNeg,
  box5: centsNonNeg,
  box10a: centsNonNeg,
  box10b: centsAny,
  box11: centsNonNeg,
})

// ── 1099-R ───────────────────────────────────────────────────────

const form1099RSchema = z.object({
  id: z.string(),
  payerName: z.string(),
  payerTin: z.string().optional(),
  box1: centsNonNeg,
  box2a: centsNonNeg,
  box2bTaxableNotDetermined: z.boolean(),
  box2bTotalDistribution: z.boolean(),
  box3: centsNonNeg,
  box4: centsNonNeg,
  box5: centsNonNeg,
  box7: z.string(),
  iraOrSep: z.boolean(),
})

// ── 1099-SA ──────────────────────────────────────────────────────

const form1099SASchema = z.object({
  id: z.string(),
  payerName: z.string(),
  box1: centsNonNeg,
  box2: centsNonNeg,
})

// ── 1095-A ───────────────────────────────────────────────────────

const form1095AMonthlyRowSchema = z.object({
  month: z.number().int().min(1).max(12),
  enrollmentPremium: centsNonNeg,
  slcspPremium: centsNonNeg,
  advancePTC: centsNonNeg,
})

const form1095ASchema = z.object({
  id: z.string(),
  marketplaceName: z.string(),
  policyNumber: z.string().optional(),
  recipientName: z.string(),
  rows: z.array(form1095AMonthlyRowSchema),
})

// ── SSA-1099 ─────────────────────────────────────────────────────

const formSSA1099Schema = z.object({
  id: z.string(),
  recipientName: z.string(),
  owner: z.enum(['taxpayer', 'spouse']).optional(),
  box3: centsAny,
  box4: centsAny,
  box5: centsAny,
  box6: centsNonNeg,
})

// ── HSA Info ─────────────────────────────────────────────────────

const hsaInfoSchema = z.object({
  coverageType: z.enum(['self-only', 'family']),
  contributions: centsNonNeg,
  qualifiedExpenses: centsNonNeg,
  age55OrOlder: z.boolean(),
  age65OrDisabled: z.boolean(),
})

// ── Form 8829 (Expenses for Business Use of Your Home) ──────────

const form8829DataSchema = z.object({
  scheduleCId: z.string(),
  method: z.enum(['simplified', 'regular']),

  // Simplified method
  businessSquareFootage: z.number().int().min(0).max(300).optional(),

  // Regular method — square footage
  totalHomeSquareFootage: z.number().int().min(0).optional(),
  businessUseSquareFootage: z.number().int().min(0).optional(),
  businessUsePercentage: z.number().min(0).max(100).optional(),

  // Direct expenses (100% business)
  directRepairs: centsNonNeg.optional(),
  directOther: centsNonNeg.optional(),

  // Indirect expenses (prorated)
  mortgageInterest: centsNonNeg.optional(),
  realEstateTaxes: centsNonNeg.optional(),
  insurance: centsNonNeg.optional(),
  rent: centsNonNeg.optional(),
  utilities: centsNonNeg.optional(),
  repairs: centsNonNeg.optional(),
  other: centsNonNeg.optional(),

  // Depreciation
  homeValue: centsNonNeg.optional(),
  datePlacedInService: z.string().optional(),
})

// ── Schedule C ───────────────────────────────────────────────────

const scheduleCAccountingMethodSchema = z.enum(['cash', 'accrual'])

const scheduleCSchema = z.object({
  id: z.string(),
  owner: z.enum(['taxpayer', 'spouse']).optional(),
  businessName: z.string(),
  businessEin: z.string().optional(),
  principalBusinessCode: z.string(),
  accountingMethod: scheduleCAccountingMethodSchema,

  // Gross income
  grossReceipts: centsNonNeg,
  returns: centsNonNeg,
  costOfGoodsSold: centsNonNeg,

  // Expenses (all cents, non-negative)
  advertising: centsNonNeg,
  carAndTruck: centsNonNeg,
  commissions: centsNonNeg,
  contractLabor: centsNonNeg,
  depreciation: centsNonNeg,
  insurance: centsNonNeg,
  mortgageInterest: centsNonNeg,
  otherInterest: centsNonNeg,
  legal: centsNonNeg,
  officeExpense: centsNonNeg,
  rent: centsNonNeg,
  repairs: centsNonNeg,
  supplies: centsNonNeg,
  taxes: centsNonNeg,
  travel: centsNonNeg,
  meals: centsNonNeg,
  utilities: centsNonNeg,
  wages: centsNonNeg,
  otherExpenses: centsNonNeg,

  // QBI fields (optional)
  isSSTB: z.boolean().optional(),
  qbiW2Wages: centsNonNeg.optional(),
  qbiUBIA: centsNonNeg.optional(),

  // Flags
  hasInventory: z.boolean().optional(),
  hasHomeOffice: z.boolean().optional(),
  hasVehicleExpenses: z.boolean().optional(),
})

// ── Schedule K-1 ─────────────────────────────────────────────────

const k1EntityTypeSchema = z.enum(['partnership', 's-corp', 'trust-estate'])

const scheduleK1Schema = z.object({
  id: z.string(),
  owner: z.enum(['taxpayer', 'spouse']).optional(),
  entityType: k1EntityTypeSchema,
  entityName: z.string(),
  entityEin: z.string(),

  // Key income items (cents — may be negative)
  ordinaryIncome: centsAny,
  rentalIncome: centsAny,
  interestIncome: centsAny,
  dividendIncome: centsAny,
  qualifiedDividends: centsNonNeg.optional(),
  shortTermCapitalGain: centsAny,
  longTermCapitalGain: centsAny,
  section199AQBI: centsAny,

  // QBI fields (optional)
  isSSTB: z.boolean().optional(),
  section199AW2Wages: centsNonNeg.optional(),
  section199AUBIA: centsNonNeg.optional(),

  // Guaranteed payments / SE (optional)
  guaranteedPayments: centsAny.optional(),
  selfEmploymentEarnings: centsAny.optional(),

  // Distributions
  distributions: centsAny,
})

// ── RSU vest events ──────────────────────────────────────────────

const rsuVestEventSchema = z.object({
  id: z.string(),
  vestDate: z.string(),
  symbol: z.string(),
  cusip: z.string().optional(),
  sharesVested: z.number().min(0),
  sharesWithheldForTax: z.number().min(0),
  sharesDelivered: z.number().min(0),
  fmvAtVest: centsNonNeg,
  totalFmv: centsNonNeg,
  linkedW2Id: z.string().optional(),
})

// ── ISO exercise events ──────────────────────────────────────────

const isoExerciseSchema = z.object({
  id: z.string(),
  exerciseDate: z.string(),
  symbol: z.string(),
  sharesExercised: z.number().min(0),
  exercisePrice: centsNonNeg,
  fmvAtExercise: centsNonNeg,
})

// ── Schedule E Property ──────────────────────────────────────────

const scheduleEPropertyTypeSchema = z.enum([
  'single-family', 'multi-family', 'vacation', 'commercial',
  'land', 'royalties', 'other',
])

const scheduleEPropertySchema = z.object({
  id: z.string(),
  address: z.string(),
  propertyType: scheduleEPropertyTypeSchema,
  fairRentalDays: z.number().int().min(0),
  personalUseDays: z.number().int().min(0),

  // Income
  rentsReceived: centsNonNeg,
  royaltiesReceived: centsNonNeg,

  // Expenses (all cents, non-negative)
  advertising: centsNonNeg,
  auto: centsNonNeg,
  cleaning: centsNonNeg,
  commissions: centsNonNeg,
  insurance: centsNonNeg,
  legal: centsNonNeg,
  management: centsNonNeg,
  mortgageInterest: centsNonNeg,
  otherInterest: centsNonNeg,
  repairs: centsNonNeg,
  supplies: centsNonNeg,
  taxes: centsNonNeg,
  utilities: centsNonNeg,
  depreciation: centsNonNeg,
  other: centsNonNeg,

  // Depreciation calculator fields
  depreciableBasis: centsNonNeg,
  placedInServiceMonth: z.number().int().min(0).max(12),
  placedInServiceYear: z.number().int().min(0),
})

// ── Capital transactions ─────────────────────────────────────────

const form8949CategorySchema = z.enum(['A', 'B', 'D', 'E'])
const adjustmentCodeSchema = z.enum(['B', 'W']).nullable()

const capitalTransactionSchema = z.object({
  id: z.string(),
  description: z.string(),
  dateAcquired: z.string().nullable(),
  dateSold: z.string(),
  proceeds: centsAny,
  reportedBasis: centsAny,
  adjustedBasis: centsAny,
  adjustmentCode: adjustmentCodeSchema,
  adjustmentAmount: centsAny,
  gainLoss: centsAny,
  washSaleLossDisallowed: centsNonNeg,
  longTerm: z.boolean(),
  category: form8949CategorySchema,
  source1099BId: z.string(),
  linkedRsuVestId: z.string().optional(),
})

// ── Adjustments ──────────────────────────────────────────────────

const adjustmentSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string(),
  amount: centsAny,
})

// ── Itemized deductions ──────────────────────────────────────────

const itemizedDeductionsSchema = z.object({
  medicalExpenses: centsNonNeg,
  stateLocalIncomeTaxes: centsNonNeg,
  stateLocalSalesTaxes: centsNonNeg,
  realEstateTaxes: centsNonNeg,
  personalPropertyTaxes: centsNonNeg,
  mortgageInterest: centsNonNeg,
  mortgagePrincipal: centsNonNeg,
  mortgagePreTCJA: z.boolean(),
  homeEquityInterest: centsNonNeg.optional(),
  homeEquityPrincipal: centsNonNeg.optional(),
  investmentInterest: centsNonNeg,
  priorYearInvestmentInterestCarryforward: centsNonNeg,
  charitableCash: centsNonNeg,
  charitableNoncash: centsNonNeg,
  gamblingLosses: centsNonNeg,
  casualtyTheftLosses: centsNonNeg,
  federalEstateTaxIRD: centsNonNeg,
  otherMiscDeductions: centsNonNeg,
})

// ── Prior Year Info ──────────────────────────────────────────────

const priorYearInfoSchema = z.object({
  agi: centsAny,
  capitalLossCarryforwardST: centsNonNeg,
  capitalLossCarryforwardLT: centsNonNeg,
  itemizedLastYear: z.boolean(),
  suspendedPassiveActivityLoss: centsNonNeg.optional(),
})

// ── Dependent Care ───────────────────────────────────────────────

const dependentCareExpensesSchema = z.object({
  totalExpenses: centsNonNeg,
  numQualifyingPersons: z.number().int().min(0),
})

// ── Retirement Contributions ─────────────────────────────────────

const retirementContributionsSchema = z.object({
  traditionalIRA: centsNonNeg,
  rothIRA: centsNonNeg,
})

// ── Form 8606 (Nondeductible IRAs / Roth Conversions) ────────────

const form8606DataSchema = z.object({
  nondeductibleContributions: centsNonNeg,
  priorYearBasis: centsNonNeg,
  traditionalIRAValueYearEnd: centsNonNeg,
  distributionsInYear: centsNonNeg,
  rothConversionAmount: centsNonNeg,
  rothDistributions: centsNonNeg.optional(),
  rothContributionBasis: centsNonNeg.optional(),
})

// ── Energy Credits ───────────────────────────────────────────────

const energyCreditsSchema = z.object({
  solarElectric: centsNonNeg,
  solarWaterHeating: centsNonNeg,
  batteryStorage: centsNonNeg,
  geothermal: centsNonNeg,
  insulation: centsNonNeg,
  windows: centsNonNeg,
  exteriorDoors: centsNonNeg,
  centralAC: centsNonNeg,
  waterHeater: centsNonNeg,
  heatPump: centsNonNeg,
  homeEnergyAudit: centsNonNeg,
  biomassStove: centsNonNeg,
})

// ── Education ────────────────────────────────────────────────────

const educationCreditTypeSchema = z.enum(['aotc', 'llc'])

const studentEducationExpenseSchema = z.object({
  studentName: z.string(),
  creditType: educationCreditTypeSchema,
  qualifiedExpenses: centsNonNeg,
  isAtLeastHalfTime: z.boolean(),
  hasCompletedFourYears: z.boolean(),
  priorYearsAOTCClaimed: z.number().int().min(0).max(3),
})

const educationExpensesSchema = z.object({
  students: z.array(studentEducationExpenseSchema),
})

// ── Credits ──────────────────────────────────────────────────────

const creditSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string(),
  amount: centsNonNeg,
})

// ── State Return Config ──────────────────────────────────────────

const supportedStateCodeSchema = z.enum([
  'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NJ', 'NM', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'UT', 'VA', 'VT', 'WI', 'WV',
])

const residencyTypeSchema = z.enum(['full-year', 'part-year', 'nonresident'])

const stateReturnConfigSchema = z.object({
  stateCode: supportedStateCodeSchema,
  residencyType: residencyTypeSchema,
  moveInDate: z.string().optional(),
  moveOutDate: z.string().optional(),

  // State-specific flags
  rentPaid: z.boolean().optional(),
  county: z.string().optional(),
  rentAmount: centsNonNeg.optional(),
  contributions529: centsNonNeg.optional(),
  contributions529PerBeneficiary: z.array(
    z.object({ name: z.string().optional(), amount: centsNonNeg }),
  ).optional(),
  ctPropertyTaxPaid: centsNonNeg.optional(),
  dcCommuterResidentState: z.enum(['MD', 'VA', 'OTHER']).optional(),

  // NJ-specific
  njPropertyTaxPaid: centsNonNeg.optional(),
  njRentPaid: centsNonNeg.optional(),
  njIsHomeowner: z.boolean().optional(),
  njTaxpayerVeteran: z.boolean().optional(),
  njSpouseVeteran: z.boolean().optional(),
  njTaxpayerBlindDisabled: z.boolean().optional(),
  njSpouseBlindDisabled: z.boolean().optional(),
  njDependentCollegeStudents: z.array(z.string()).optional(),
})

// ── NRA Info ────────────────────────────────────────────────────

const nraInfoSchema = z.object({
  countryOfResidence: z.string(),
  visaType: z.string().optional(),
  treatyCountry: z.string().optional(),
  treatyArticle: z.string().optional(),
  treatyExemptIncome: centsNonNeg.optional(),
  fdapDividends: centsNonNeg.optional(),
  fdapInterest: centsNonNeg.optional(),
  fdapRoyalties: centsNonNeg.optional(),
  fdapOtherIncome: centsNonNeg.optional(),
  fdapWithholdingRate: z.number().min(0).max(1).optional(),
  scholarshipIncome: centsNonNeg.optional(),
  daysInUS: z.number().int().min(0).max(366).optional(),
  rentalElectECI: z.boolean().optional(),
  socialSecurityTreatyExempt: z.boolean().optional(),
})

// ── Deductions block ─────────────────────────────────────────────

const deductionsSchema = z.object({
  method: z.enum(['standard', 'itemized']),
  itemized: itemizedDeductionsSchema.optional(),
  taxpayerAge65: z.boolean(),
  taxpayerBlind: z.boolean(),
  spouseAge65: z.boolean(),
  spouseBlind: z.boolean(),
  mfsLivedApartAllYear: z.boolean().optional(),
})

// ── Estimated tax payments ───────────────────────────────────────

const estimatedTaxPaymentsSchema = z.object({
  q1: centsNonNeg,
  q2: centsNonNeg,
  q3: centsNonNeg,
  q4: centsNonNeg,
})

// ── Tax Return (top-level) ───────────────────────────────────────

export const taxReturnSchema = z.object({
  isNonresidentAlien: z.boolean().optional(),
  nraInfo: nraInfoSchema.optional(),
  taxYear: z.number().int(),
  filingStatus: filingStatusSchema,
  canBeClaimedAsDependent: z.boolean(),
  taxpayer: taxpayerSchema,
  spouse: taxpayerSchema.optional(),
  dependents: z.array(dependentSchema),

  // Income source checklist
  incomeSources: z.array(incomeSourceIdSchema),

  // Source documents
  w2s: z.array(w2Schema),
  form1099Bs: z.array(form1099BSchema),
  form1099INTs: z.array(form1099INTSchema),
  form1099DIVs: z.array(form1099DIVSchema),
  form1099MISCs: z.array(form1099MISCSchema),
  form1099NECs: z.array(form1099NECSchema),
  form1099Gs: z.array(form1099GSchema),
  form1099Rs: z.array(form1099RSchema),
  formSSA1099s: z.array(formSSA1099Schema),
  form1095As: z.array(form1095ASchema),

  // RSU data
  rsuVestEvents: z.array(rsuVestEventSchema),

  // ISO exercise events
  isoExercises: z.array(isoExerciseSchema),

  // Form 8829
  form8829s: z.array(form8829DataSchema),

  // Schedule C
  scheduleCBusinesses: z.array(scheduleCSchema),

  // Schedule K-1
  scheduleK1s: z.array(scheduleK1Schema),

  // Schedule E
  scheduleEProperties: z.array(scheduleEPropertySchema),

  // Derived data
  capitalTransactions: z.array(capitalTransactionSchema),

  // Prior year
  priorYear: priorYearInfoSchema.optional(),

  // Adjustments, deductions, credits
  adjustments: z.array(adjustmentSchema),
  deductions: deductionsSchema,
  credits: z.array(creditSchema),

  // Estimated tax payments
  estimatedTaxPayments: estimatedTaxPaymentsSchema.optional(),

  // Student loan interest
  studentLoanInterest: centsNonNeg.optional(),

  // HSA data
  hsa: hsaInfoSchema.optional(),
  form1099SAs: z.array(form1099SASchema).optional(),

  // Form 8606
  form8606: form8606DataSchema.optional(),

  // Other credit inputs
  dependentCare: dependentCareExpensesSchema.optional(),
  retirementContributions: retirementContributionsSchema.optional(),
  energyCredits: energyCreditsSchema.optional(),
  educationExpenses: educationExpensesSchema.optional(),

  // State returns
  stateReturns: z.array(stateReturnConfigSchema),

  // Deprecated fields (still accepted for backwards compatibility)
  caResident: z.boolean().optional(),
  rentPaidInCA: z.boolean().optional(),
})

// ── Strict validation schemas (for HTTP input) ───────────────────
// These add stricter rules on top of the base schema for API input validation.

/** SSN must be exactly 9 digits when provided and non-empty. */
const strictSsnTaxpayer = taxpayerSchema.extend({
  ssn: z.union([
    z.literal(''),
    ssnSchema,
  ]),
})

/**
 * Strict TaxReturn schema for HTTP input validation.
 * Enforces SSN format (9 digits) on taxpayer and spouse when non-empty,
 * and EIN format on employers.
 */
export const taxReturnStrictSchema = taxReturnSchema.extend({
  taxpayer: strictSsnTaxpayer,
  spouse: strictSsnTaxpayer.optional(),
  dependents: z.array(dependentSchema.extend({
    ssn: z.union([z.literal(''), ssnSchema]),
  })),
  w2s: z.array(w2Schema.extend({
    employerEin: employerEinSchema,
  })),
  scheduleK1s: z.array(scheduleK1Schema.extend({
    entityEin: z.union([z.literal(''), einSchema, employerEinSchema]),
  })),
})

// ── Export sub-schemas for testing ────────────────────────────────

export {
  ssnSchema,
  einSchema,
  employerEinSchema,
  stateCodeSchema,
  filingStatusSchema,
  addressSchema,
  taxpayerSchema,
  dependentSchema,
  w2Schema,
  form1099BSchema,
  form1099INTSchema,
  form1099DIVSchema,
  form1099MISCSchema,
  form1099NECSchema,
  form1099GSchema,
  form1099RSchema,
  form1099SASchema,
  form1095ASchema,
  formSSA1099Schema,
  hsaInfoSchema,
  form8829DataSchema,
  scheduleCSchema,
  scheduleK1Schema,
  rsuVestEventSchema,
  isoExerciseSchema,
  scheduleEPropertySchema,
  capitalTransactionSchema,
  adjustmentSchema,
  itemizedDeductionsSchema,
  priorYearInfoSchema,
  dependentCareExpensesSchema,
  retirementContributionsSchema,
  energyCreditsSchema,
  creditSchema,
  stateReturnConfigSchema,
  deductionsSchema,
  estimatedTaxPaymentsSchema,
  educationExpensesSchema,
  form8606DataSchema,
  nraInfoSchema,
}
