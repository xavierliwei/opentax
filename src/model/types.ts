/**
 * Canonical tax model — the single source of truth for a tax return.
 *
 * All UI, rules, and form compilers read from / write to this model.
 * Monetary values are in integer cents unless noted otherwise.
 */

// ── Filing status ──────────────────────────────────────────────

export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh' | 'qw'

// ── People ─────────────────────────────────────────────────────

export interface Address {
  street: string
  apartment?: string
  city: string
  state: string          // 2-letter code
  zip: string
}

export interface Taxpayer {
  firstName: string
  middleInitial?: string
  lastName: string
  ssn: string            // 9 digits, no dashes (formatted on output only)
  dateOfBirth?: string   // ISO date
  address: Address
}

export interface Dependent {
  firstName: string
  lastName: string
  ssn: string
  relationship: string   // e.g., "son", "daughter", "parent"
  monthsLived: number    // months lived with taxpayer (0–12)
  dateOfBirth: string    // ISO date (YYYY-MM-DD), empty if unknown
}

// ── W-2 ────────────────────────────────────────────────────────

/** W-2 Box 12 code + amount pair (up to 4 per W-2: 12a–12d) */
export interface W2Box12Entry {
  code: string           // e.g., "D", "DD", "W", "AA"
  amount: number         // cents
}

export interface W2 {
  id: string             // unique within the return
  owner?: 'taxpayer' | 'spouse'  // whose W-2 (MFJ returns); defaults to 'taxpayer'

  // Employer info
  employerEin: string    // XX-XXXXXXX
  employerName: string
  employerAddress?: Address

  // Income boxes
  box1: number           // Wages, tips, other compensation (cents)
  box2: number           // Federal income tax withheld (cents)
  box3: number           // Social security wages (cents)
  box4: number           // Social security tax withheld (cents)
  box5: number           // Medicare wages and tips (cents)
  box6: number           // Medicare tax withheld (cents)
  box7: number           // Social security tips (cents)
  box8: number           // Allocated tips (cents)
  box10: number          // Dependent care benefits (cents)
  box11: number          // Nonqualified plans (cents)

  // Box 12: coded entries (up to 4)
  box12: W2Box12Entry[]

  // Box 13: checkboxes
  box13StatutoryEmployee: boolean
  box13RetirementPlan: boolean
  box13ThirdPartySickPay: boolean

  // Box 14: other (free-form, employer-specific)
  box14: string

  // State/local (boxes 15–20)
  box15State?: string        // 2-letter state code
  box15EmployerStateId?: string
  box16StateWages?: number   // cents
  box17StateIncomeTax?: number  // cents
  box18LocalWages?: number   // cents
  box19LocalIncomeTax?: number  // cents
  box20LocalityName?: string
}

// ── 1099-B ─────────────────────────────────────────────────────

export interface Form1099B {
  id: string

  // Broker info
  brokerName: string
  brokerTin?: string

  // Transaction
  description: string          // security name/description
  cusip?: string               // CUSIP number for matching
  dateAcquired: string | null  // ISO date, null if "Various"
  dateSold: string             // ISO date
  proceeds: number             // cents
  costBasis: number | null     // cents, null if not reported
  washSaleLossDisallowed: number  // cents (0 if none)
  gainLoss: number             // cents (proceeds - basis + washSaleLossDisallowed)

  // Classification
  basisReportedToIrs: boolean  // Box 12 checked = basis reported
  longTerm: boolean | null     // true=long-term, false=short-term, null=unknown
  noncoveredSecurity: boolean  // true if non-covered (basis not reported)

  // Federal withholding (rare for 1099-B)
  federalTaxWithheld: number   // cents
}

// ── 1099-INT ───────────────────────────────────────────────────

export interface Form1099INT {
  id: string
  payerName: string
  payerTin?: string

  box1: number    // Interest income (cents)
  box2: number    // Early withdrawal penalty (cents)
  box3: number    // Interest on U.S. savings bonds and Treasury obligations (cents)
  box4: number    // Federal income tax withheld (cents)
  box6?: number   // Foreign tax paid (cents)
  box7?: string   // Foreign country or U.S. possession
  box8: number    // Tax-exempt interest (cents)
}

// ── 1099-DIV ───────────────────────────────────────────────────

export interface Form1099DIV {
  id: string
  payerName: string
  payerTin?: string

  box1a: number   // Total ordinary dividends (cents)
  box1b: number   // Qualified dividends (cents)
  box2a: number   // Total capital gain distributions (cents)
  box3: number    // Nondividend distributions (cents)
  box4: number    // Federal income tax withheld (cents)
  box5: number    // Section 199A dividends (cents)
  box7?: number   // Foreign tax paid (cents)
  box8?: string   // Foreign country or U.S. possession
  box11: number   // Exempt-interest dividends (cents)
}

// ── 1099-MISC ─────────────────────────────────────────────────

export interface Form1099MISC {
  id: string
  payerName: string
  payerTin?: string
  box1: number   // Rents (cents)
  box2: number   // Royalties (cents)
  box3: number   // Other income — prizes, awards, etc. (cents)
  box4: number   // Federal income tax withheld (cents)
}

// ── 1099-G (Government payments) ──────────────────────────────

export interface Form1099G {
  id: string
  payerName: string        // State agency name
  payerTin?: string

  box1: number             // Unemployment compensation (cents)
  box2: number             // State or local income tax refunds, credits, or offsets (cents)
  box3: number             // Box 2 amount is for tax year (e.g. 2024)
  box4: number             // Federal income tax withheld (cents)
  box5: number             // RTAA payments (cents) — Reemployment Trade Adjustment Assistance
  box10a: number           // Market gain (cents)
  box10b: number           // Market gain tax year
  box11: number            // State income tax withheld (cents)
}

// ── 1099-R (Retirement distributions) ────────────────────────

export interface Form1099R {
  id: string
  payerName: string
  payerTin?: string

  box1: number           // Gross distribution (cents)
  box2a: number          // Taxable amount (cents)
  box2bTaxableNotDetermined: boolean  // Box 2b checkbox — taxable amount not determined
  box2bTotalDistribution: boolean     // Box 2b checkbox — total distribution
  box3: number           // Capital gain (included in box 2a) (cents)
  box4: number           // Federal income tax withheld (cents)
  box5: number           // Employee contributions / Roth contributions (cents)
  box7: string           // Distribution code(s): 1, 2, 3, 4, 7, G, H, T, etc.
  iraOrSep: boolean      // IRA/SEP/SIMPLE checkbox — true = Lines 4a/4b, false = Lines 5a/5b
}

// ── 1099-SA (HSA distributions) ──────────────────────────────

export interface Form1099SA {
  id: string
  payerName: string
  box1: number    // Gross distribution (cents)
  box2: number    // Earnings on excess contributions (cents)
}

// ── 1095-A (Health Insurance Marketplace Statement) ────────────

export interface Form1095AMonthlyRow {
  month: number               // 1–12
  enrollmentPremium: number   // Column A — Monthly enrollment premium (cents)
  slcspPremium: number        // Column B — Monthly SLCSP premium (cents)
  advancePTC: number          // Column C — Monthly advance payment of PTC (cents)
}

export interface Form1095A {
  id: string
  marketplaceName: string
  policyNumber?: string
  recipientName: string
  rows: Form1095AMonthlyRow[]  // up to 12 monthly rows
}

// ── SSA-1099 (Social Security Benefit Statement) ───────────────

export interface FormSSA1099 {
  id: string
  recipientName: string
  owner?: 'taxpayer' | 'spouse'  // whose benefits (MFJ returns); defaults to 'taxpayer'
  box3: number    // Benefits paid (cents)
  box4: number    // Benefits repaid (cents)
  box5: number    // Net benefits: Box 3 − Box 4 (cents) — goes to Form 1040 Line 6a
  box6: number    // Voluntary federal income tax withheld (cents) — goes to Line 25
}

// ── HSA Info ─────────────────────────────────────────────────

export interface HSAInfo {
  coverageType: 'self-only' | 'family'
  contributions: number       // cents — taxpayer's direct HSA contributions
  qualifiedExpenses: number   // cents — qualified medical expenses paid from HSA
  age55OrOlder: boolean       // catch-up contribution eligible
  age65OrDisabled: boolean    // exempt from 20% distribution penalty
}

// ── Schedule C (Profit or Loss From Business) ─────────────────

export type ScheduleCAccountingMethod = 'cash' | 'accrual'

export interface ScheduleC {
  id: string
  owner?: 'taxpayer' | 'spouse'  // whose business (MFJ returns); defaults to 'taxpayer'

  // Business info (Part I header)
  businessName: string
  businessEin?: string            // Employer ID (optional for sole proprietors)
  principalBusinessCode: string   // 6-digit NAICS code (e.g., "541511")
  accountingMethod: ScheduleCAccountingMethod

  // Gross income (Part I)
  grossReceipts: number           // cents — Line 1 (gross receipts or sales)
  returns: number                 // cents — Line 2 (returns and allowances)
  costOfGoodsSold: number         // cents — Line 4 (COGS, simplified — no Part III detail)

  // Expenses (Part II, all cents)
  advertising: number             // Line 8
  carAndTruck: number             // Line 9 (simplified — standard mileage or actual)
  commissions: number             // Line 10
  contractLabor: number           // Line 11
  depreciation: number            // Line 13 (manual entry)
  insurance: number               // Line 15
  mortgageInterest: number        // Line 16a
  otherInterest: number           // Line 16b
  legal: number                   // Line 17
  officeExpense: number           // Line 18
  rent: number                    // Line 20b (machinery/equipment)
  repairs: number                 // Line 21
  supplies: number                // Line 22
  taxes: number                   // Line 23 (taxes and licenses)
  travel: number                  // Line 24a
  meals: number                   // Line 24b (50% deductible meals)
  utilities: number               // Line 25
  wages: number                   // Line 26
  otherExpenses: number           // Line 27a

  // Form 8995-A QBI limitation fields (optional — used for above-threshold computation)
  isSSTB?: boolean                // Is this a Specified Service Trade or Business? (IRC §199A(d)(2))
  qbiW2Wages?: number             // cents — W-2 wages paid by this business (for W-2/UBIA limitation)
  qbiUBIA?: number                // cents — Unadjusted Basis Immediately After Acquisition of qualified property

  // Flags for unsupported features
  hasInventory?: boolean          // if true, COGS Part III required (unsupported)
  hasHomeOffice?: boolean         // if true, Form 8829 required (unsupported)
  hasVehicleExpenses?: boolean    // if true, Form 4562 Part V required (unsupported)
}

// ── Schedule K-1 (Passthrough Income) ─────────────────────────

export type K1EntityType = 'partnership' | 's-corp' | 'trust-estate'

/**
 * Schedule K-1 stub — captures essential fields for ingestion and warning.
 * Full K-1 tax handling is not yet supported; this scaffolding ensures
 * K-1 data does not silently go missing from the return.
 */
export interface ScheduleK1 {
  id: string
  owner?: 'taxpayer' | 'spouse'
  entityType: K1EntityType
  entityName: string
  entityEin: string

  // Key income items (cents) — for display/warning purposes
  ordinaryIncome: number          // Box 1 (1065) / Box 1 (1120-S)
  rentalIncome: number            // Box 2 (1065)
  interestIncome: number          // Box 5 (1065) / Box 4 (1120-S)
  dividendIncome: number          // Box 6a (1065) / Box 5a (1120-S)
  shortTermCapitalGain: number    // Box 8 (1065) / Box 7 (1120-S)
  longTermCapitalGain: number     // Box 9a (1065) / Box 8a (1120-S)
  section199AQBI: number          // Box 20 Code Z (1065) / Box 17 Code V (1120-S)

  // Form 8995-A QBI limitation fields (optional — reported by entity on K-1)
  isSSTB?: boolean                // Is this entity a Specified Service Trade or Business?
  section199AW2Wages?: number     // cents — Entity's allocable share of W-2 wages (Box 20 Code AA / Box 17 Code W)
  section199AUBIA?: number        // cents — Entity's allocable share of UBIA (Box 20 Code AB / Box 17 Code X)

  // Guaranteed payments (Box 4, Form 1065) — partnerships only
  guaranteedPayments?: number     // cents — reported on Schedule 1 as other income + SE tax

  // Self-employment earnings (Box 14, Code A, Form 1065) — partnerships only
  // If provided, used to compute SE tax. If not provided, SE tax is not computed
  // for the K-1 (conservative). Limited partners typically have $0 here.
  selfEmploymentEarnings?: number // cents — net SE income from this partnership

  // Distributions and basis
  distributions: number           // For reference, not directly used in computation yet
}

// ── RSU vest events ────────────────────────────────────────────

export interface RSUVestEvent {
  id: string
  vestDate: string           // ISO date
  symbol: string             // stock ticker
  cusip?: string             // for matching to 1099-B
  sharesVested: number       // total shares that vested
  sharesWithheldForTax: number  // shares sold to cover taxes
  sharesDelivered: number    // net shares received
  fmvAtVest: number          // fair market value per share at vest (cents)
  totalFmv: number           // sharesVested × fmvAtVest (cents)
  linkedW2Id?: string        // which W-2 includes this income
}

// ── ISO exercise events ──────────────────────────────────────────

export interface ISOExercise {
  id: string
  exerciseDate: string     // ISO date
  symbol: string           // stock ticker
  sharesExercised: number
  exercisePrice: number    // cents per share
  fmvAtExercise: number    // cents per share (FMV at exercise date)
}

// ── Schedule E Property (Rental Real Estate) ─────────────────────

export type ScheduleEPropertyType =
  | 'single-family' | 'multi-family' | 'vacation' | 'commercial'
  | 'land' | 'royalties' | 'other'

export interface ScheduleEProperty {
  id: string
  address: string
  propertyType: ScheduleEPropertyType
  fairRentalDays: number       // Schedule E line A
  personalUseDays: number      // Schedule E line B
  // Income
  rentsReceived: number        // cents — line 3
  royaltiesReceived: number    // cents — line 4
  // Expenses (lines 5–19, all cents)
  advertising: number
  auto: number
  cleaning: number
  commissions: number
  insurance: number
  legal: number
  management: number
  mortgageInterest: number
  otherInterest: number
  repairs: number
  supplies: number
  taxes: number
  utilities: number
  depreciation: number         // manual entry — line 18
  other: number                // line 19
  // Depreciation calculator fields (optional — when provided, overrides manual depreciation)
  depreciableBasis: number     // cents — building cost excluding land
  placedInServiceMonth: number // 1–12, 0 = not set
  placedInServiceYear: number  // e.g. 2020, 0 = not set
}

// ── Capital transactions (derived) ─────────────────────────────

/**
 * Form 8949 category codes:
 * A = short-term, basis reported to IRS
 * B = short-term, basis NOT reported to IRS
 * D = long-term, basis reported to IRS
 * E = long-term, basis NOT reported to IRS
 */
export type Form8949Category = 'A' | 'B' | 'D' | 'E'

/**
 * Form 8949 adjustment codes (column f):
 * B = basis incorrect on 1099-B (common for RSU)
 * W = wash sale
 * (others exist but not needed for MVP)
 */
export type AdjustmentCode = 'B' | 'W' | null

export interface CapitalTransaction {
  id: string
  description: string            // security description
  dateAcquired: string | null    // ISO date or null
  dateSold: string               // ISO date
  proceeds: number               // cents
  reportedBasis: number          // basis as reported on 1099-B (cents)
  adjustedBasis: number          // corrected basis after adjustments (cents)
  adjustmentCode: AdjustmentCode
  adjustmentAmount: number       // cents (adjustedBasis - reportedBasis)
  gainLoss: number               // proceeds - adjustedBasis (cents)
  washSaleLossDisallowed: number // cents
  longTerm: boolean
  category: Form8949Category

  // Linkage
  source1099BId: string          // which 1099-B this came from
  linkedRsuVestId?: string       // if this sale is linked to an RSU vest
}

// ── Adjustments to income ──────────────────────────────────────

export interface Adjustment {
  id: string
  type: string            // e.g., "ira_deduction", "student_loan_interest"
  description: string
  amount: number          // cents
}

// ── Deductions ─────────────────────────────────────────────────

export interface ItemizedDeductions {
  // Medical (Line 1)
  medicalExpenses: number           // cents (7.5% AGI floor)

  // SALT (Lines 5a-5e) — system takes max(income, sales) for line 5a
  stateLocalIncomeTaxes: number     // cents — state/local income taxes (Line 5a option A)
  stateLocalSalesTaxes: number      // cents — OR general sales taxes (Line 5a option B)
  realEstateTaxes: number           // cents — real property taxes (Line 5b)
  personalPropertyTaxes: number     // cents — value-based personal property taxes (Line 5c)

  // Mortgage Interest (Line 8a)
  mortgageInterest: number          // cents — total interest paid (from Form 1098 Box 1)
  mortgagePrincipal: number         // cents — outstanding loan balance (Form 1098 Box 2)
  mortgagePreTCJA: boolean          // true = originated ≤ Dec 15 2017 → $1M limit; false → $750K

  // Home Equity Interest (CA-only — TCJA suspended federal deduction)
  homeEquityInterest?: number       // cents — interest on home equity loan/HELOC
  homeEquityPrincipal?: number      // cents — outstanding home equity loan balance

  // Investment Interest (Line 9, Form 4952)
  investmentInterest: number        // cents — margin interest + other investment interest
  priorYearInvestmentInterestCarryforward: number  // cents — disallowed excess from prior year(s)

  // Charitable (Lines 11-14)
  charitableCash: number            // cents (60% AGI limit)
  charitableNoncash: number         // cents (30% AGI limit)

  // Other (Line 16) — four Schedule A Line 16 categories
  gamblingLosses: number            // cents — limited to gambling winnings
  casualtyTheftLosses: number       // cents — Form 4684, federally declared disasters
  federalEstateTaxIRD: number       // cents — IRC §691(c)
  otherMiscDeductions: number       // cents — catch-all
}

// ── Prior Year Info ─────────────────────────────────────────────

export interface PriorYearInfo {
  agi: number                        // cents — prior-year AGI (for e-filing)
  capitalLossCarryforwardST: number  // cents — short-term capital loss carryover (positive)
  capitalLossCarryforwardLT: number  // cents — long-term capital loss carryover (positive)
  itemizedLastYear: boolean          // true if taxpayer itemized on prior-year return (needed for taxable refund calc)
}

// ── Dependent Care (Form 2441) ──────────────────────────────────

export interface DependentCareExpenses {
  totalExpenses: number         // cents — total paid to care providers
  numQualifyingPersons: number  // 1 or 2+ (determines $3K vs $6K limit)
}

// ── Retirement Contributions (Form 8880 — Saver's Credit) ───────

export interface RetirementContributions {
  traditionalIRA: number        // cents
  rothIRA: number               // cents
  // 401(k)/403(b) auto-derived from W-2 Box 12 codes D, E, AA, BB, G, H
}

// ── Energy Credits (Form 5695) ──────────────────────────────────

export interface EnergyCredits {
  // Part I — Residential Clean Energy (§25D) — 30%, no annual cap
  solarElectric: number
  solarWaterHeating: number
  batteryStorage: number        // ≥3 kWh
  geothermal: number
  // Part II — Energy Efficient Home Improvement (§25C) — 30%, capped
  insulation: number
  windows: number               // $600 sub-cap
  exteriorDoors: number         // $250 each, $500 total
  centralAC: number
  waterHeater: number
  heatPump: number              // $2,000 separate cap
  homeEnergyAudit: number       // $150 sub-cap
  biomassStove: number
}

// ── Education Credits (Form 8863) ────────────────────────────

export type EducationCreditType = 'aotc' | 'llc'

export interface StudentEducationExpense {
  studentName: string                   // free text (or dependent name)
  creditType: EducationCreditType       // which credit to claim for this student
  qualifiedExpenses: number             // cents — tuition, fees, course materials
  isAtLeastHalfTime: boolean            // required for AOTC (not for LLC)
  hasCompletedFourYears: boolean        // if true, AOTC not available (LLC only)
  priorYearsAOTCClaimed: number         // 0–3; AOTC max 4 years total
}

export interface EducationExpenses {
  students: StudentEducationExpense[]
}

// ── Credits ────────────────────────────────────────────────────

export interface Credit {
  id: string
  type: string            // e.g., "child_tax_credit", "education"
  description: string
  amount: number          // cents
}

// ── State Return Config ────────────────────────────────────────

/** Supported state codes (expand as states are added) */
export type SupportedStateCode = 'CA' | 'FL'
// Future: | 'NY' | 'NJ' | 'IL' | 'MA' | 'PA'

/** Residency classification for a state return */
export type ResidencyType = 'full-year' | 'part-year' | 'nonresident'

/** Per-state return configuration selected by the user */
export interface StateReturnConfig {
  stateCode: SupportedStateCode
  residencyType: ResidencyType

  /**
   * Date the taxpayer moved INTO the state (part-year only).
   * ISO 8601 format: 'YYYY-MM-DD'
   */
  moveInDate?: string

  /**
   * Date the taxpayer moved OUT OF the state (part-year only).
   * ISO 8601 format: 'YYYY-MM-DD'
   */
  moveOutDate?: string

  // State-specific flags
  rentPaid?: boolean                  // CA renter's credit
}

// ── Tax Return (top-level) ─────────────────────────────────────

export interface TaxReturn {
  taxYear: number
  filingStatus: FilingStatus
  canBeClaimedAsDependent: boolean  // checked on Form 1040 — limits standard deduction
  taxpayer: Taxpayer
  spouse?: Taxpayer
  dependents: Dependent[]

  // Source documents
  w2s: W2[]
  form1099Bs: Form1099B[]
  form1099INTs: Form1099INT[]
  form1099DIVs: Form1099DIV[]
  form1099MISCs: Form1099MISC[]
  form1099Gs: Form1099G[]
  form1099Rs: Form1099R[]
  formSSA1099s: FormSSA1099[]
  form1095As: Form1095A[]

  // RSU data
  rsuVestEvents: RSUVestEvent[]

  // ISO exercise events (AMT preference item)
  isoExercises: ISOExercise[]

  // Schedule C — Sole proprietorship businesses
  scheduleCBusinesses: ScheduleC[]

  // Schedule K-1 — Passthrough income (stub)
  scheduleK1s: ScheduleK1[]

  // Schedule E — Rental real estate properties
  scheduleEProperties: ScheduleEProperty[]

  // Derived / processed data
  capitalTransactions: CapitalTransaction[]

  // Prior year carry-forward data
  priorYear?: PriorYearInfo

  // Adjustments, deductions, credits
  adjustments: Adjustment[]
  deductions: {
    method: 'standard' | 'itemized'
    itemized?: ItemizedDeductions
    // Additional standard deduction flags (age 65+ / blind)
    taxpayerAge65: boolean
    taxpayerBlind: boolean
    spouseAge65: boolean
    spouseBlind: boolean
    // MFS lived-apart flag — affects Social Security taxability thresholds
    // If true and filing MFS, use single-like base amounts per IRC §86(c)(1)(C)
    mfsLivedApartAllYear?: boolean
  }
  credits: Credit[]

  // Estimated tax payments (Form 1040-ES quarterly)
  estimatedTaxPayments?: {
    q1: number  // cents — due April 15
    q2: number  // cents — due June 15
    q3: number  // cents — due September 15
    q4: number  // cents — due January 15 (next year)
  }

  // Student loan interest (Form 1098-E Box 1)
  studentLoanInterest?: number  // cents

  // HSA data
  hsa?: HSAInfo
  form1099SAs?: Form1099SA[]

  // Other credit inputs
  dependentCare?: DependentCareExpenses
  retirementContributions?: RetirementContributions
  energyCredits?: EnergyCredits
  educationExpenses?: EducationExpenses

  // State returns
  stateReturns: StateReturnConfig[]

  /** @deprecated Use stateReturns instead */
  caResident?: boolean
  /** @deprecated Use stateReturns instead */
  rentPaidInCA?: boolean
}

// ── Factory ────────────────────────────────────────────────────

/** Create a blank TaxReturn with sensible defaults. */
export function emptyTaxReturn(taxYear: number): TaxReturn {
  return {
    taxYear,
    filingStatus: 'single',
    canBeClaimedAsDependent: false,
    taxpayer: {
      firstName: '',
      lastName: '',
      ssn: '',
      address: {
        street: '',
        city: '',
        state: '',
        zip: '',
      },
    },
    dependents: [],
    w2s: [],
    form1099Bs: [],
    form1099INTs: [],
    form1099DIVs: [],
    form1099MISCs: [],
    form1099Gs: [],
    form1099Rs: [],
    formSSA1099s: [],
    form1095As: [],
    rsuVestEvents: [],
    isoExercises: [],
    scheduleCBusinesses: [],
    scheduleK1s: [],
    scheduleEProperties: [],
    capitalTransactions: [],
    adjustments: [],
    deductions: {
      method: 'standard',
      taxpayerAge65: false,
      taxpayerBlind: false,
      spouseAge65: false,
      spouseBlind: false,
    },
    credits: [],
    stateReturns: [],
  }
}
