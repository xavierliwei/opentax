import { describe, it, expect } from 'vitest'
import { emptyTaxReturn } from '../../src/model/types.ts'
import {
  taxReturnSchema,
  taxReturnStrictSchema,
  ssnSchema,
  einSchema,
  employerEinSchema,
  stateCodeSchema,
  filingStatusSchema,
  addressSchema,
  dependentSchema,
  w2Schema,
  form1099INTSchema,
  form1099DIVSchema,
  form1099BSchema,
  form1099GSchema,
  form1099RSchema,
  form1099SASchema,
  form1095ASchema,
  formSSA1099Schema,
  hsaInfoSchema,
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
  form1099MISCSchema,
} from '../../src/model/schemas.ts'

// ── SSN validation ─────────────────────────────────────────────

describe('ssnSchema', () => {
  it('accepts exactly 9 digits', () => {
    expect(ssnSchema.safeParse('123456789').success).toBe(true)
    expect(ssnSchema.safeParse('000000000').success).toBe(true)
  })

  it('rejects non-digit characters', () => {
    const result = ssnSchema.safeParse('12345678a')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('9 digits')
    }
  })

  it('rejects SSN with dashes', () => {
    expect(ssnSchema.safeParse('123-45-6789').success).toBe(false)
  })

  it('rejects too short', () => {
    expect(ssnSchema.safeParse('12345678').success).toBe(false)
  })

  it('rejects too long', () => {
    expect(ssnSchema.safeParse('1234567890').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(ssnSchema.safeParse('').success).toBe(false)
  })
})

// ── EIN validation ─────────────────────────────────────────────

describe('einSchema', () => {
  it('accepts exactly 9 digits', () => {
    expect(einSchema.safeParse('123456789').success).toBe(true)
  })

  it('rejects dashed format', () => {
    expect(einSchema.safeParse('12-3456789').success).toBe(false)
  })

  it('rejects non-digits', () => {
    expect(einSchema.safeParse('1234abcde').success).toBe(false)
  })
})

describe('employerEinSchema', () => {
  it('accepts XX-XXXXXXX format', () => {
    expect(employerEinSchema.safeParse('12-3456789').success).toBe(true)
  })

  it('accepts raw 9-digit format', () => {
    expect(employerEinSchema.safeParse('123456789').success).toBe(true)
  })

  it('rejects invalid formats', () => {
    expect(employerEinSchema.safeParse('1-23456789').success).toBe(false)
    expect(employerEinSchema.safeParse('abc').success).toBe(false)
  })
})

// ── State code validation ──────────────────────────────────────

describe('stateCodeSchema', () => {
  it('accepts 2-letter uppercase', () => {
    expect(stateCodeSchema.safeParse('CA').success).toBe(true)
    expect(stateCodeSchema.safeParse('NY').success).toBe(true)
  })

  it('rejects lowercase', () => {
    expect(stateCodeSchema.safeParse('ca').success).toBe(false)
  })

  it('rejects wrong length', () => {
    expect(stateCodeSchema.safeParse('C').success).toBe(false)
    expect(stateCodeSchema.safeParse('CAL').success).toBe(false)
  })
})

// ── Filing status enum ─────────────────────────────────────────

describe('filingStatusSchema', () => {
  it('accepts valid filing statuses', () => {
    for (const status of ['single', 'mfj', 'mfs', 'hoh', 'qw']) {
      expect(filingStatusSchema.safeParse(status).success).toBe(true)
    }
  })

  it('rejects unknown filing status', () => {
    const result = filingStatusSchema.safeParse('married')
    expect(result.success).toBe(false)
  })

  it('rejects non-string', () => {
    expect(filingStatusSchema.safeParse(1).success).toBe(false)
  })
})

// ── Address schema ─────────────────────────────────────────────

describe('addressSchema', () => {
  it('accepts valid address', () => {
    const result = addressSchema.safeParse({
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
    })
    expect(result.success).toBe(true)
  })

  it('accepts address with optional apartment', () => {
    const result = addressSchema.safeParse({
      street: '123 Main St',
      apartment: 'Apt 4B',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const result = addressSchema.safeParse({ street: '123 Main St' })
    expect(result.success).toBe(false)
  })
})

// ── Dependent schema ───────────────────────────────────────────

describe('dependentSchema', () => {
  it('accepts valid dependent', () => {
    const result = dependentSchema.safeParse({
      firstName: 'Child',
      lastName: 'Doe',
      ssn: '111111111',
      relationship: 'son',
      monthsLived: 12,
      dateOfBirth: '2015-06-15',
    })
    expect(result.success).toBe(true)
  })

  it('rejects monthsLived > 12', () => {
    const result = dependentSchema.safeParse({
      firstName: 'Child',
      lastName: 'Doe',
      ssn: '111111111',
      relationship: 'son',
      monthsLived: 13,
      dateOfBirth: '2015-06-15',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative monthsLived', () => {
    const result = dependentSchema.safeParse({
      firstName: 'Child',
      lastName: 'Doe',
      ssn: '111111111',
      relationship: 'son',
      monthsLived: -1,
      dateOfBirth: '2015-06-15',
    })
    expect(result.success).toBe(false)
  })
})

// ── W-2 schema ─────────────────────────────────────────────────

describe('w2Schema', () => {
  const validW2 = {
    id: 'w2-1',
    employerEin: '12-3456789',
    employerName: 'Acme Corp',
    box1: 5000000,
    box2: 800000,
    box3: 5000000,
    box4: 310000,
    box5: 5000000,
    box6: 72500,
    box7: 0,
    box8: 0,
    box10: 0,
    box11: 0,
    box12: [],
    box13StatutoryEmployee: false,
    box13RetirementPlan: false,
    box13ThirdPartySickPay: false,
    box14: '',
  }

  it('accepts valid W-2', () => {
    expect(w2Schema.safeParse(validW2).success).toBe(true)
  })

  it('rejects negative box1 (wages)', () => {
    const result = w2Schema.safeParse({ ...validW2, box1: -100 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer box1', () => {
    const result = w2Schema.safeParse({ ...validW2, box1: 50000.50 })
    expect(result.success).toBe(false)
  })

  it('accepts optional owner field', () => {
    expect(w2Schema.safeParse({ ...validW2, owner: 'spouse' }).success).toBe(true)
    expect(w2Schema.safeParse(validW2).success).toBe(true)
  })

  it('rejects invalid owner value', () => {
    expect(w2Schema.safeParse({ ...validW2, owner: 'child' }).success).toBe(false)
  })
})

// ── 1099-INT schema ────────────────────────────────────────────

describe('form1099INTSchema', () => {
  it('accepts valid 1099-INT', () => {
    const result = form1099INTSchema.safeParse({
      id: '1099int-1',
      payerName: 'First Bank',
      box1: 120000,
      box2: 0,
      box3: 0,
      box4: 0,
      box8: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative interest income', () => {
    const result = form1099INTSchema.safeParse({
      id: '1099int-1',
      payerName: 'First Bank',
      box1: -100,
      box2: 0,
      box3: 0,
      box4: 0,
      box8: 0,
    })
    expect(result.success).toBe(false)
  })
})

// ── 1099-DIV schema ────────────────────────────────────────────

describe('form1099DIVSchema', () => {
  it('accepts valid 1099-DIV', () => {
    const result = form1099DIVSchema.safeParse({
      id: '1099div-1',
      payerName: 'Vanguard',
      box1a: 300000,
      box1b: 200000,
      box2a: 50000,
      box3: 0,
      box4: 0,
      box5: 0,
      box11: 0,
    })
    expect(result.success).toBe(true)
  })
})

// ── 1099-B schema ──────────────────────────────────────────────

describe('form1099BSchema', () => {
  it('accepts valid 1099-B with nullable fields', () => {
    const result = form1099BSchema.safeParse({
      id: 'b-1',
      brokerName: 'Schwab',
      description: 'AAPL',
      dateAcquired: null,
      dateSold: '2025-06-20',
      proceeds: 1500000,
      costBasis: null,
      washSaleLossDisallowed: 0,
      gainLoss: 500000,
      basisReportedToIrs: false,
      longTerm: null,
      noncoveredSecurity: true,
      federalTaxWithheld: 0,
    })
    expect(result.success).toBe(true)
  })

  it('allows negative gainLoss', () => {
    const result = form1099BSchema.safeParse({
      id: 'b-1',
      brokerName: 'Schwab',
      description: 'TSLA',
      dateAcquired: '2024-01-15',
      dateSold: '2025-06-20',
      proceeds: 500000,
      costBasis: 1000000,
      washSaleLossDisallowed: 0,
      gainLoss: -500000,
      basisReportedToIrs: true,
      longTerm: true,
      noncoveredSecurity: false,
      federalTaxWithheld: 0,
    })
    expect(result.success).toBe(true)
  })
})

// ── Capital transaction schema ─────────────────────────────────

describe('capitalTransactionSchema', () => {
  it('accepts valid transaction', () => {
    const result = capitalTransactionSchema.safeParse({
      id: 'tx-1',
      description: 'AAPL',
      dateAcquired: '2024-01-15',
      dateSold: '2025-06-20',
      proceeds: 1500000,
      reportedBasis: 1000000,
      adjustedBasis: 1000000,
      adjustmentCode: null,
      adjustmentAmount: 0,
      gainLoss: 500000,
      washSaleLossDisallowed: 0,
      longTerm: true,
      category: 'D',
      source1099BId: 'b-1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid category', () => {
    const result = capitalTransactionSchema.safeParse({
      id: 'tx-1',
      description: 'AAPL',
      dateAcquired: '2024-01-15',
      dateSold: '2025-06-20',
      proceeds: 1500000,
      reportedBasis: 1000000,
      adjustedBasis: 1000000,
      adjustmentCode: null,
      adjustmentAmount: 0,
      gainLoss: 500000,
      washSaleLossDisallowed: 0,
      longTerm: true,
      category: 'X',
      source1099BId: 'b-1',
    })
    expect(result.success).toBe(false)
  })
})

// ── Non-negative monetary amounts ──────────────────────────────

describe('non-negative monetary amounts', () => {
  it('rejects negative amounts in itemized deductions', () => {
    const base = {
      medicalExpenses: 0,
      stateLocalIncomeTaxes: 0,
      stateLocalSalesTaxes: 0,
      realEstateTaxes: 0,
      personalPropertyTaxes: 0,
      mortgageInterest: 0,
      mortgagePrincipal: 0,
      mortgagePreTCJA: false,
      investmentInterest: 0,
      priorYearInvestmentInterestCarryforward: 0,
      charitableCash: 0,
      charitableNoncash: 0,
      gamblingLosses: 0,
      casualtyTheftLosses: 0,
      federalEstateTaxIRD: 0,
      otherMiscDeductions: 0,
    }

    const result = itemizedDeductionsSchema.safeParse({ ...base, charitableCash: -100 })
    expect(result.success).toBe(false)
  })

  it('rejects negative energy credit amounts', () => {
    const base = {
      solarElectric: 0,
      solarWaterHeating: 0,
      batteryStorage: 0,
      geothermal: 0,
      insulation: 0,
      windows: 0,
      exteriorDoors: 0,
      centralAC: 0,
      waterHeater: 0,
      heatPump: 0,
      homeEnergyAudit: 0,
      biomassStove: 0,
    }
    const result = energyCreditsSchema.safeParse({ ...base, solarElectric: -500 })
    expect(result.success).toBe(false)
  })

  it('rejects negative retirement contributions', () => {
    const result = retirementContributionsSchema.safeParse({
      traditionalIRA: -100,
      rothIRA: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative HSA contributions', () => {
    const result = hsaInfoSchema.safeParse({
      coverageType: 'self-only',
      contributions: -100,
      qualifiedExpenses: 0,
      age55OrOlder: false,
      age65OrDisabled: false,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative credit amounts', () => {
    const result = creditSchema.safeParse({
      id: 'c-1',
      type: 'child_tax_credit',
      description: 'CTC',
      amount: -100,
    })
    expect(result.success).toBe(false)
  })
})

// ── State return config ────────────────────────────────────────

describe('stateReturnConfigSchema', () => {
  it('accepts valid state return config', () => {
    const result = stateReturnConfigSchema.safeParse({
      stateCode: 'CA',
      residencyType: 'full-year',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unsupported state code', () => {
    const result = stateReturnConfigSchema.safeParse({
      stateCode: 'TX',
      residencyType: 'full-year',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid residency type', () => {
    const result = stateReturnConfigSchema.safeParse({
      stateCode: 'CA',
      residencyType: 'temporary',
    })
    expect(result.success).toBe(false)
  })

  it('accepts NJ-specific fields', () => {
    const result = stateReturnConfigSchema.safeParse({
      stateCode: 'NJ',
      residencyType: 'full-year',
      njPropertyTaxPaid: 500000,
      njIsHomeowner: true,
      njTaxpayerVeteran: false,
    })
    expect(result.success).toBe(true)
  })
})

// ── Estimated tax payments ─────────────────────────────────────

describe('estimatedTaxPaymentsSchema', () => {
  it('accepts valid payments', () => {
    const result = estimatedTaxPaymentsSchema.safeParse({
      q1: 100000, q2: 100000, q3: 100000, q4: 100000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative payments', () => {
    const result = estimatedTaxPaymentsSchema.safeParse({
      q1: -100, q2: 0, q3: 0, q4: 0,
    })
    expect(result.success).toBe(false)
  })
})

// ── Education expenses ─────────────────────────────────────────

describe('educationExpensesSchema', () => {
  it('accepts valid education expenses', () => {
    const result = educationExpensesSchema.safeParse({
      students: [{
        studentName: 'Jane Doe',
        creditType: 'aotc',
        qualifiedExpenses: 400000,
        isAtLeastHalfTime: true,
        hasCompletedFourYears: false,
        priorYearsAOTCClaimed: 2,
      }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid credit type', () => {
    const result = educationExpensesSchema.safeParse({
      students: [{
        studentName: 'Jane Doe',
        creditType: 'invalid',
        qualifiedExpenses: 400000,
        isAtLeastHalfTime: true,
        hasCompletedFourYears: false,
        priorYearsAOTCClaimed: 2,
      }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects priorYearsAOTCClaimed > 3', () => {
    const result = educationExpensesSchema.safeParse({
      students: [{
        studentName: 'Jane Doe',
        creditType: 'aotc',
        qualifiedExpenses: 400000,
        isAtLeastHalfTime: true,
        hasCompletedFourYears: false,
        priorYearsAOTCClaimed: 4,
      }],
    })
    expect(result.success).toBe(false)
  })
})

// ── HSA Info schema ────────────────────────────────────────────

describe('hsaInfoSchema', () => {
  it('accepts valid HSA info', () => {
    const result = hsaInfoSchema.safeParse({
      coverageType: 'family',
      contributions: 700000,
      qualifiedExpenses: 300000,
      age55OrOlder: true,
      age65OrDisabled: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid coverage type', () => {
    const result = hsaInfoSchema.safeParse({
      coverageType: 'individual',
      contributions: 0,
      qualifiedExpenses: 0,
      age55OrOlder: false,
      age65OrDisabled: false,
    })
    expect(result.success).toBe(false)
  })
})

// ── Schedule C schema ──────────────────────────────────────────

describe('scheduleCSchema', () => {
  const validScheduleC = {
    id: 'sc-1',
    businessName: 'Freelance Dev',
    principalBusinessCode: '541511',
    accountingMethod: 'cash' as const,
    grossReceipts: 10000000,
    returns: 0,
    costOfGoodsSold: 0,
    advertising: 0, carAndTruck: 0, commissions: 0, contractLabor: 0,
    depreciation: 0, insurance: 0, mortgageInterest: 0, otherInterest: 0,
    legal: 0, officeExpense: 50000, rent: 120000, repairs: 0, supplies: 10000,
    taxes: 0, travel: 0, meals: 0, utilities: 0, wages: 0, otherExpenses: 0,
  }

  it('accepts valid Schedule C', () => {
    expect(scheduleCSchema.safeParse(validScheduleC).success).toBe(true)
  })

  it('rejects invalid accounting method', () => {
    const result = scheduleCSchema.safeParse({ ...validScheduleC, accountingMethod: 'hybrid' })
    expect(result.success).toBe(false)
  })

  it('rejects negative gross receipts', () => {
    const result = scheduleCSchema.safeParse({ ...validScheduleC, grossReceipts: -100 })
    expect(result.success).toBe(false)
  })
})

// ── Schedule K-1 schema ────────────────────────────────────────

describe('scheduleK1Schema', () => {
  it('accepts valid K-1', () => {
    const result = scheduleK1Schema.safeParse({
      id: 'k1-1',
      entityType: 'partnership',
      entityName: 'Acme Partners',
      entityEin: '123456789',
      ordinaryIncome: 500000,
      rentalIncome: 0,
      interestIncome: 0,
      dividendIncome: 0,
      shortTermCapitalGain: 0,
      longTermCapitalGain: 0,
      section199AQBI: 0,
      distributions: 0,
    })
    expect(result.success).toBe(true)
  })

  it('allows negative ordinary income (loss)', () => {
    const result = scheduleK1Schema.safeParse({
      id: 'k1-1',
      entityType: 's-corp',
      entityName: 'Failing Corp',
      entityEin: '987654321',
      ordinaryIncome: -200000,
      rentalIncome: 0,
      interestIncome: 0,
      dividendIncome: 0,
      shortTermCapitalGain: 0,
      longTermCapitalGain: 0,
      section199AQBI: 0,
      distributions: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid entity type', () => {
    const result = scheduleK1Schema.safeParse({
      id: 'k1-1',
      entityType: 'llc',
      entityName: 'Test',
      entityEin: '123456789',
      ordinaryIncome: 0, rentalIncome: 0, interestIncome: 0,
      dividendIncome: 0, shortTermCapitalGain: 0, longTermCapitalGain: 0,
      section199AQBI: 0, distributions: 0,
    })
    expect(result.success).toBe(false)
  })
})

// ── RSU vest event schema ──────────────────────────────────────

describe('rsuVestEventSchema', () => {
  it('accepts valid RSU vest event', () => {
    const result = rsuVestEventSchema.safeParse({
      id: 'rsu-1',
      vestDate: '2025-03-15',
      symbol: 'GOOG',
      sharesVested: 100,
      sharesWithheldForTax: 37,
      sharesDelivered: 63,
      fmvAtVest: 15000,
      totalFmv: 1500000,
    })
    expect(result.success).toBe(true)
  })
})

// ── ISO exercise schema ────────────────────────────────────────

describe('isoExerciseSchema', () => {
  it('accepts valid ISO exercise', () => {
    const result = isoExerciseSchema.safeParse({
      id: 'iso-1',
      exerciseDate: '2025-06-01',
      symbol: 'ACME',
      sharesExercised: 1000,
      exercisePrice: 1000,
      fmvAtExercise: 5000,
    })
    expect(result.success).toBe(true)
  })
})

// ── Schedule E property schema ─────────────────────────────────

describe('scheduleEPropertySchema', () => {
  const validProperty = {
    id: 'prop-1',
    address: '456 Elm St',
    propertyType: 'single-family' as const,
    fairRentalDays: 365,
    personalUseDays: 0,
    rentsReceived: 2400000,
    royaltiesReceived: 0,
    advertising: 0, auto: 0, cleaning: 5000, commissions: 0,
    insurance: 120000, legal: 0, management: 0, mortgageInterest: 500000,
    otherInterest: 0, repairs: 30000, supplies: 5000, taxes: 200000,
    utilities: 0, depreciation: 300000, other: 0,
    depreciableBasis: 20000000,
    placedInServiceMonth: 6,
    placedInServiceYear: 2020,
  }

  it('accepts valid Schedule E property', () => {
    expect(scheduleEPropertySchema.safeParse(validProperty).success).toBe(true)
  })

  it('rejects invalid property type', () => {
    const result = scheduleEPropertySchema.safeParse({ ...validProperty, propertyType: 'condo' })
    expect(result.success).toBe(false)
  })

  it('rejects placedInServiceMonth > 12', () => {
    const result = scheduleEPropertySchema.safeParse({ ...validProperty, placedInServiceMonth: 13 })
    expect(result.success).toBe(false)
  })
})

// ── Full TaxReturn schema ──────────────────────────────────────

describe('taxReturnSchema', () => {
  it('accepts a valid empty tax return', () => {
    const tr = emptyTaxReturn(2025)
    const result = taxReturnSchema.safeParse(tr)
    expect(result.success).toBe(true)
  })

  it('accepts a tax return with W-2 and income data', () => {
    const tr = emptyTaxReturn(2025)
    tr.taxpayer = {
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
      address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
    }
    tr.w2s = [{
      id: 'w2-1',
      employerEin: '12-3456789',
      employerName: 'Acme Corp',
      box1: 5000000, box2: 800000, box3: 5000000, box4: 310000,
      box5: 5000000, box6: 72500, box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [], box13StatutoryEmployee: false, box13RetirementPlan: false,
      box13ThirdPartySickPay: false, box14: '',
    }]
    const result = taxReturnSchema.safeParse(tr)
    expect(result.success).toBe(true)
  })

  it('rejects missing required top-level fields', () => {
    const result = taxReturnSchema.safeParse({
      taxYear: 2025,
      filingStatus: 'single',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid filing status', () => {
    const tr = emptyTaxReturn(2025)
    const modified = { ...tr, filingStatus: 'married' }
    const result = taxReturnSchema.safeParse(modified)
    expect(result.success).toBe(false)
  })

  it('accepts tax return with optional fields present', () => {
    const tr = emptyTaxReturn(2025)
    tr.spouse = {
      firstName: 'Jane',
      lastName: 'Doe',
      ssn: '987654321',
      address: { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
    }
    tr.estimatedTaxPayments = { q1: 100000, q2: 100000, q3: 100000, q4: 100000 }
    tr.studentLoanInterest = 250000
    tr.hsa = {
      coverageType: 'self-only',
      contributions: 350000,
      qualifiedExpenses: 100000,
      age55OrOlder: false,
      age65OrDisabled: false,
    }
    const result = taxReturnSchema.safeParse(tr)
    expect(result.success).toBe(true)
  })

  it('accepts tax return with dependents', () => {
    const tr = emptyTaxReturn(2025)
    tr.dependents = [{
      firstName: 'Child',
      lastName: 'Doe',
      ssn: '111222333',
      relationship: 'daughter',
      monthsLived: 12,
      dateOfBirth: '2018-03-15',
    }]
    const result = taxReturnSchema.safeParse(tr)
    expect(result.success).toBe(true)
  })

  it('accepts deprecated fields (caResident, rentPaidInCA)', () => {
    const tr = { ...emptyTaxReturn(2025), caResident: true, rentPaidInCA: true }
    const result = taxReturnSchema.safeParse(tr)
    expect(result.success).toBe(true)
  })
})

// ── Strict TaxReturn schema (for HTTP input) ───────────────────

describe('taxReturnStrictSchema', () => {
  it('accepts valid tax return with proper SSN', () => {
    const tr = emptyTaxReturn(2025)
    tr.taxpayer.ssn = '123456789'
    const result = taxReturnStrictSchema.safeParse(tr)
    expect(result.success).toBe(true)
  })

  it('accepts empty SSN (data entry in progress)', () => {
    const tr = emptyTaxReturn(2025)
    tr.taxpayer.ssn = ''
    const result = taxReturnStrictSchema.safeParse(tr)
    expect(result.success).toBe(true)
  })

  it('rejects invalid SSN format on taxpayer', () => {
    const tr = emptyTaxReturn(2025)
    tr.taxpayer.ssn = '12345'  // too short
    const result = taxReturnStrictSchema.safeParse(tr)
    expect(result.success).toBe(false)
    if (!result.success) {
      // Verify error path points to taxpayer.ssn
      const ssnIssue = result.error.issues.find(
        (i) => i.path.join('.') === 'taxpayer.ssn'
      )
      expect(ssnIssue).toBeDefined()
    }
  })

  it('rejects SSN with letters on taxpayer', () => {
    const tr = emptyTaxReturn(2025)
    tr.taxpayer.ssn = '12345678A'
    const result = taxReturnStrictSchema.safeParse(tr)
    expect(result.success).toBe(false)
  })

  it('rejects invalid SSN on spouse', () => {
    const tr = emptyTaxReturn(2025)
    tr.filingStatus = 'mfj'
    tr.spouse = {
      firstName: 'Jane',
      lastName: 'Doe',
      ssn: 'abc',
      address: { street: '', city: '', state: '', zip: '' },
    }
    const result = taxReturnStrictSchema.safeParse(tr)
    expect(result.success).toBe(false)
  })

  it('rejects invalid SSN on dependent', () => {
    const tr = emptyTaxReturn(2025)
    tr.dependents = [{
      firstName: 'Child',
      lastName: 'Doe',
      ssn: '12345',  // too short
      relationship: 'son',
      monthsLived: 12,
      dateOfBirth: '2015-06-15',
    }]
    const result = taxReturnStrictSchema.safeParse(tr)
    expect(result.success).toBe(false)
  })

  it('rejects invalid employer EIN on W-2', () => {
    const tr = emptyTaxReturn(2025)
    tr.w2s = [{
      id: 'w2-1',
      employerEin: 'abcdefghi',  // not digits
      employerName: 'Acme',
      box1: 0, box2: 0, box3: 0, box4: 0, box5: 0, box6: 0,
      box7: 0, box8: 0, box10: 0, box11: 0,
      box12: [], box13StatutoryEmployee: false,
      box13RetirementPlan: false, box13ThirdPartySickPay: false, box14: '',
    }]
    const result = taxReturnStrictSchema.safeParse(tr)
    expect(result.success).toBe(false)
  })

  it('provides descriptive error messages', () => {
    const tr = emptyTaxReturn(2025)
    tr.taxpayer.ssn = '123'
    const result = taxReturnStrictSchema.safeParse(tr)
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('9 digits'))).toBe(true)
    }
  })

  it('collects multiple validation errors', () => {
    const tr = emptyTaxReturn(2025)
    tr.taxpayer.ssn = '123'  // bad SSN
    ;(tr as Record<string, unknown>).filingStatus = 'invalid'  // bad filing status
    const result = taxReturnStrictSchema.safeParse(tr)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2)
    }
  })
})

// ── Other sub-schemas ──────────────────────────────────────────

describe('priorYearInfoSchema', () => {
  it('accepts valid prior year info', () => {
    const result = priorYearInfoSchema.safeParse({
      agi: 7500000,
      capitalLossCarryforwardST: 0,
      capitalLossCarryforwardLT: 300000,
      itemizedLastYear: true,
    })
    expect(result.success).toBe(true)
  })

  it('allows negative AGI', () => {
    const result = priorYearInfoSchema.safeParse({
      agi: -500000,
      capitalLossCarryforwardST: 0,
      capitalLossCarryforwardLT: 0,
      itemizedLastYear: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative capital loss carryforward', () => {
    const result = priorYearInfoSchema.safeParse({
      agi: 0,
      capitalLossCarryforwardST: -100,
      capitalLossCarryforwardLT: 0,
      itemizedLastYear: false,
    })
    expect(result.success).toBe(false)
  })
})

describe('dependentCareExpensesSchema', () => {
  it('accepts valid dependent care', () => {
    const result = dependentCareExpensesSchema.safeParse({
      totalExpenses: 500000,
      numQualifyingPersons: 2,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative expenses', () => {
    const result = dependentCareExpensesSchema.safeParse({
      totalExpenses: -100,
      numQualifyingPersons: 1,
    })
    expect(result.success).toBe(false)
  })
})

describe('form1099GSchema', () => {
  it('accepts valid 1099-G', () => {
    const result = form1099GSchema.safeParse({
      id: 'g-1',
      payerName: 'State Agency',
      box1: 1200000,
      box2: 0,
      box3: 2024,
      box4: 0,
      box5: 0,
      box10a: 0,
      box10b: 0,
      box11: 0,
    })
    expect(result.success).toBe(true)
  })
})

describe('form1099RSchema', () => {
  it('accepts valid 1099-R', () => {
    const result = form1099RSchema.safeParse({
      id: 'r-1',
      payerName: 'Fidelity',
      box1: 5000000,
      box2a: 5000000,
      box2bTaxableNotDetermined: false,
      box2bTotalDistribution: true,
      box3: 0,
      box4: 1000000,
      box5: 0,
      box7: '7',
      iraOrSep: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('form1099SASchema', () => {
  it('accepts valid 1099-SA', () => {
    const result = form1099SASchema.safeParse({
      id: 'sa-1',
      payerName: 'HSA Bank',
      box1: 200000,
      box2: 0,
    })
    expect(result.success).toBe(true)
  })
})

describe('form1095ASchema', () => {
  it('accepts valid 1095-A with monthly rows', () => {
    const result = form1095ASchema.safeParse({
      id: '1095a-1',
      marketplaceName: 'Covered California',
      recipientName: 'John Doe',
      rows: [
        { month: 1, enrollmentPremium: 50000, slcspPremium: 60000, advancePTC: 30000 },
        { month: 2, enrollmentPremium: 50000, slcspPremium: 60000, advancePTC: 30000 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects month > 12', () => {
    const result = form1095ASchema.safeParse({
      id: '1095a-1',
      marketplaceName: 'Test',
      recipientName: 'Test',
      rows: [
        { month: 13, enrollmentPremium: 50000, slcspPremium: 60000, advancePTC: 30000 },
      ],
    })
    expect(result.success).toBe(false)
  })
})

describe('formSSA1099Schema', () => {
  it('accepts valid SSA-1099', () => {
    const result = formSSA1099Schema.safeParse({
      id: 'ssa-1',
      recipientName: 'John Doe',
      box3: 2400000,
      box4: 0,
      box5: 2400000,
      box6: 360000,
    })
    expect(result.success).toBe(true)
  })
})

describe('adjustmentSchema', () => {
  it('accepts valid adjustment', () => {
    const result = adjustmentSchema.safeParse({
      id: 'adj-1',
      type: 'student_loan_interest',
      description: 'Student loan interest deduction',
      amount: 250000,
    })
    expect(result.success).toBe(true)
  })
})

describe('deductionsSchema', () => {
  it('accepts standard deduction config', () => {
    const result = deductionsSchema.safeParse({
      method: 'standard',
      taxpayerAge65: false,
      taxpayerBlind: false,
      spouseAge65: false,
      spouseBlind: false,
    })
    expect(result.success).toBe(true)
  })

  it('accepts itemized deduction config', () => {
    const result = deductionsSchema.safeParse({
      method: 'itemized',
      itemized: {
        medicalExpenses: 500000,
        stateLocalIncomeTaxes: 1000000,
        stateLocalSalesTaxes: 0,
        realEstateTaxes: 500000,
        personalPropertyTaxes: 0,
        mortgageInterest: 1200000,
        mortgagePrincipal: 40000000,
        mortgagePreTCJA: false,
        investmentInterest: 0,
        priorYearInvestmentInterestCarryforward: 0,
        charitableCash: 300000,
        charitableNoncash: 0,
        gamblingLosses: 0,
        casualtyTheftLosses: 0,
        federalEstateTaxIRD: 0,
        otherMiscDeductions: 0,
      },
      taxpayerAge65: true,
      taxpayerBlind: false,
      spouseAge65: false,
      spouseBlind: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid deduction method', () => {
    const result = deductionsSchema.safeParse({
      method: 'flat',
      taxpayerAge65: false,
      taxpayerBlind: false,
      spouseAge65: false,
      spouseBlind: false,
    })
    expect(result.success).toBe(false)
  })
})

describe('form1099MISCSchema', () => {
  it('accepts valid 1099-MISC', () => {
    const result = form1099MISCSchema.safeParse({
      id: 'misc-1',
      payerName: 'Contest Inc',
      box1: 0,
      box2: 0,
      box3: 500000,
      box4: 0,
    })
    expect(result.success).toBe(true)
  })
})
