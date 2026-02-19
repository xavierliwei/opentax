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

// ── 1099-SA (HSA distributions) ──────────────────────────────

export interface Form1099SA {
  id: string
  payerName: string
  box1: number    // Gross distribution (cents)
  box2: number    // Earnings on excess contributions (cents)
}

// ── HSA Info ─────────────────────────────────────────────────

export interface HSAInfo {
  coverageType: 'self-only' | 'family'
  contributions: number       // cents — taxpayer's direct HSA contributions
  qualifiedExpenses: number   // cents — qualified medical expenses paid from HSA
  age55OrOlder: boolean       // catch-up contribution eligible
  age65OrDisabled: boolean    // exempt from 20% distribution penalty
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

  // Investment Interest (Line 9, Form 4952)
  investmentInterest: number        // cents — margin interest + other investment interest
  priorYearInvestmentInterestCarryforward: number  // cents — disallowed excess from prior year(s)

  // Charitable (Lines 11-14)
  charitableCash: number            // cents (60% AGI limit)
  charitableNoncash: number         // cents (30% AGI limit)

  // Other (Line 16)
  otherDeductions: number           // cents
}

// ── Prior Year Info ─────────────────────────────────────────────

export interface PriorYearInfo {
  agi: number                        // cents — prior-year AGI (for e-filing)
  capitalLossCarryforwardST: number  // cents — short-term capital loss carryover (positive)
  capitalLossCarryforwardLT: number  // cents — long-term capital loss carryover (positive)
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

// ── Credits ────────────────────────────────────────────────────

export interface Credit {
  id: string
  type: string            // e.g., "child_tax_credit", "education"
  description: string
  amount: number          // cents
}

// ── Tax Return (top-level) ─────────────────────────────────────

export interface TaxReturn {
  taxYear: number
  filingStatus: FilingStatus
  taxpayer: Taxpayer
  spouse?: Taxpayer
  dependents: Dependent[]

  // Source documents
  w2s: W2[]
  form1099Bs: Form1099B[]
  form1099INTs: Form1099INT[]
  form1099DIVs: Form1099DIV[]
  form1099MISCs: Form1099MISC[]

  // RSU data
  rsuVestEvents: RSUVestEvent[]

  // ISO exercise events (AMT preference item)
  isoExercises: ISOExercise[]

  // Derived / processed data
  capitalTransactions: CapitalTransaction[]

  // Prior year carry-forward data
  priorYear?: PriorYearInfo

  // Adjustments, deductions, credits
  adjustments: Adjustment[]
  deductions: {
    method: 'standard' | 'itemized'
    itemized?: ItemizedDeductions
  }
  credits: Credit[]

  // Student loan interest (Form 1098-E Box 1)
  studentLoanInterest?: number  // cents

  // HSA data
  hsa?: HSAInfo
  form1099SAs?: Form1099SA[]

  // Other credit inputs
  dependentCare?: DependentCareExpenses
  retirementContributions?: RetirementContributions
  energyCredits?: EnergyCredits
}

// ── Factory ────────────────────────────────────────────────────

/** Create a blank TaxReturn with sensible defaults. */
export function emptyTaxReturn(taxYear: number): TaxReturn {
  return {
    taxYear,
    filingStatus: 'single',
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
    rsuVestEvents: [],
    isoExercises: [],
    capitalTransactions: [],
    adjustments: [],
    deductions: { method: 'standard' },
    credits: [],
  }
}
