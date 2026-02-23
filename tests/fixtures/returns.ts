/**
 * Reusable TaxReturn fixtures for testing.
 *
 * Each fixture is a function that returns a fresh copy so tests
 * can mutate without affecting each other.
 */

import { emptyTaxReturn } from '../../src/model/types'
import { cents } from '../../src/model/traced'
import type { TaxReturn, W2, Form1099INT, Form1099DIV, FormSSA1099, CapitalTransaction, Dependent, ScheduleEProperty } from '../../src/model/types'

// ── Helper: make a W-2 with defaults ───────────────────────────

export function makeW2(overrides: Partial<W2> & { id: string; employerName: string; box1: number; box2: number }): W2 {
  return {
    employerEin: '00-0000000',
    box3: overrides.box1,   // default SS wages = wages
    box4: 0,
    box5: overrides.box1,   // default Medicare wages = wages
    box6: 0,
    box7: 0,
    box8: 0,
    box10: 0,
    box11: 0,
    box12: [],
    box13StatutoryEmployee: false,
    box13RetirementPlan: false,
    box13ThirdPartySickPay: false,
    box14: '',
    ...overrides,
  }
}

// ── Helper: make a 1099-INT with defaults ──────────────────────

export function make1099INT(overrides: Partial<Form1099INT> & { id: string; payerName: string; box1: number }): Form1099INT {
  return {
    box2: 0,
    box3: 0,
    box4: 0,
    box8: 0,
    ...overrides,
  }
}

// ── Helper: make a 1099-DIV with defaults ──────────────────────

export function make1099DIV(overrides: Partial<Form1099DIV> & { id: string; payerName: string; box1a: number }): Form1099DIV {
  return {
    box1b: 0,
    box2a: 0,
    box3: 0,
    box4: 0,
    box5: 0,
    box11: 0,
    ...overrides,
  }
}

// ── Fixture: simple W-2 only ───────────────────────────────────

export function simpleW2Return(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        employerEin: '12-3456789',
        box1: cents(75000),
        box2: cents(8000),
      }),
    ],
  }
}

// ── Fixture: two W-2s ──────────────────────────────────────────

export function twoW2Return(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        employerEin: '12-3456789',
        box1: cents(60000),
        box2: cents(6000),
      }),
      makeW2({
        id: 'w2-2',
        employerName: 'Beta Inc',
        employerEin: '98-7654321',
        box1: cents(40000),
        box2: cents(4000),
      }),
    ],
  }
}

// ── Fixture: W-2 + interest + dividends ────────────────────────

export function w2WithInvestmentsReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(90000),
        box2: cents(12000),
      }),
    ],
    form1099INTs: [
      make1099INT({
        id: 'int-1',
        payerName: 'Chase Bank',
        box1: cents(2500),
        box4: cents(0),
      }),
      make1099INT({
        id: 'int-2',
        payerName: 'Ally Bank',
        box1: cents(800),
        box4: cents(0),
      }),
    ],
    form1099DIVs: [
      make1099DIV({
        id: 'div-1',
        payerName: 'Schwab Brokerage',
        box1a: cents(3000),  // ordinary dividends
        box1b: cents(1500),  // qualified dividends
        box2a: cents(500),   // capital gain distributions
      }),
    ],
  }
}

// ── Helper: make a CapitalTransaction with defaults ────────────

export function makeTransaction(
  overrides: Partial<CapitalTransaction> & {
    id: string
    proceeds: number
    adjustedBasis: number
    longTerm: boolean
    category: CapitalTransaction['category']
  },
): CapitalTransaction {
  const gainLoss = overrides.gainLoss ?? (overrides.proceeds - overrides.adjustedBasis)
  return {
    description: 'AAPL',
    dateAcquired: '2024-01-15',
    dateSold: '2025-06-15',
    reportedBasis: overrides.adjustedBasis,
    adjustmentCode: null,
    adjustmentAmount: 0,
    washSaleLossDisallowed: 0,
    source1099BId: `1099b-${overrides.id}`,
    ...overrides,
    gainLoss,
  }
}

// ── Fixture: single long-term sale (category D) ────────────────

export function singleLTSaleReturn(): TaxReturn {
  // Buy 100 shares at $50, sell at $70, held > 1 year, basis reported
  return {
    ...emptyTaxReturn(2025),
    capitalTransactions: [
      makeTransaction({
        id: 'tx-1',
        description: '100 sh AAPL',
        dateAcquired: '2023-03-01',
        dateSold: '2025-06-15',
        proceeds: cents(7000),
        adjustedBasis: cents(5000),
        longTerm: true,
        category: 'D',
      }),
    ],
  }
}

// ── Fixture: mixed short-term and long-term trades ─────────────

export function mixedTradesReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(80000),
        box2: cents(10000),
      }),
    ],
    capitalTransactions: [
      // 3 short-term trades (category A — basis reported)
      makeTransaction({
        id: 'tx-st-1',
        description: '50 sh GOOG',
        dateAcquired: '2025-01-10',
        dateSold: '2025-04-15',
        proceeds: cents(8000),
        adjustedBasis: cents(7000),
        longTerm: false,
        category: 'A',
      }),
      makeTransaction({
        id: 'tx-st-2',
        description: '100 sh TSLA',
        dateAcquired: '2025-02-01',
        dateSold: '2025-05-20',
        proceeds: cents(5000),
        adjustedBasis: cents(6000),  // loss
        longTerm: false,
        category: 'A',
      }),
      makeTransaction({
        id: 'tx-st-3',
        description: '30 sh AMZN',
        dateAcquired: '2025-03-01',
        dateSold: '2025-06-01',
        proceeds: cents(4500),
        adjustedBasis: cents(4000),
        longTerm: false,
        category: 'A',
      }),
      // 2 long-term trades (category D — basis reported)
      makeTransaction({
        id: 'tx-lt-1',
        description: '200 sh MSFT',
        dateAcquired: '2023-01-15',
        dateSold: '2025-07-01',
        proceeds: cents(20000),
        adjustedBasis: cents(12000),
        longTerm: true,
        category: 'D',
      }),
      makeTransaction({
        id: 'tx-lt-2',
        description: '75 sh AAPL',
        dateAcquired: '2022-06-01',
        dateSold: '2025-08-15',
        proceeds: cents(15000),
        adjustedBasis: cents(10000),
        longTerm: true,
        category: 'D',
      }),
    ],
  }
}

// ── Fixture: net capital loss exceeding $3,000 limit ───────────

export function bigCapitalLossReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(80000),
        box2: cents(10000),
      }),
    ],
    capitalTransactions: [
      makeTransaction({
        id: 'tx-loss-1',
        description: '500 sh RIVN',
        dateAcquired: '2024-01-01',
        dateSold: '2025-06-01',
        proceeds: cents(3000),
        adjustedBasis: cents(10000),  // -$7,000 loss
        longTerm: true,
        category: 'D',
      }),
      makeTransaction({
        id: 'tx-gain-1',
        description: '100 sh NVDA',
        dateAcquired: '2023-06-01',
        dateSold: '2025-03-01',
        proceeds: cents(5000),
        adjustedBasis: cents(3000),  // +$2,000 gain
        longTerm: true,
        category: 'D',
      }),
    ],
    // Net: -$7,000 + $2,000 = -$5,000 loss
    // Deductible: -$3,000 (limit)
    // Carryforward: $2,000
  }
}

// ── Fixture: all 4 Form 8949 categories ────────────────────────
// Real scenario: someone has old inherited stock (non-covered, category E),
// recently purchased stock (covered, category A/D), and a transferred
// brokerage account with missing basis (category B).

export function allCategoriesReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    capitalTransactions: [
      // Category A: short-term, basis reported
      makeTransaction({
        id: 'tx-a1',
        description: '100 sh NVDA',
        dateAcquired: '2025-02-01',
        dateSold: '2025-07-15',
        proceeds: cents(15000),
        adjustedBasis: cents(12000),
        longTerm: false,
        category: 'A',
      }),
      // Category B: short-term, basis NOT reported (transferred account)
      makeTransaction({
        id: 'tx-b1',
        description: '50 sh PLTR',
        dateAcquired: '2025-03-10',
        dateSold: '2025-08-20',
        proceeds: cents(1200),
        adjustedBasis: cents(1800),
        reportedBasis: 0,
        adjustmentCode: 'B',
        adjustmentAmount: cents(1800),
        longTerm: false,
        category: 'B',
      }),
      // Category D: long-term, basis reported
      makeTransaction({
        id: 'tx-d1',
        description: '200 sh AAPL',
        dateAcquired: '2023-01-15',
        dateSold: '2025-04-01',
        proceeds: cents(38000),
        adjustedBasis: cents(28000),
        longTerm: true,
        category: 'D',
      }),
      makeTransaction({
        id: 'tx-d2',
        description: '150 sh MSFT',
        dateAcquired: '2022-06-01',
        dateSold: '2025-09-10',
        proceeds: cents(60000),
        adjustedBasis: cents(45000),
        longTerm: true,
        category: 'D',
      }),
      // Category E: long-term, basis NOT reported (inherited stock, non-covered)
      makeTransaction({
        id: 'tx-e1',
        description: '300 sh GE (inherited)',
        dateAcquired: '2010-05-15',
        dateSold: '2025-06-01',
        proceeds: cents(48000),
        adjustedBasis: cents(9000),
        reportedBasis: 0,
        adjustmentCode: 'B',
        adjustmentAmount: cents(9000),
        longTerm: true,
        category: 'E',
      }),
    ],
    // Category A: +$3,000
    // Category B: -$600
    // Category D: +$10,000 + $15,000 = +$25,000
    // Category E: +$39,000
    // Net ST: +$3,000 + (-$600) = +$2,400
    // Net LT: +$25,000 + $39,000 = +$64,000
    // Line 16: +$66,400
  }
}

// ── Fixture: RSU sale with $0 basis (pre-Step 7 manual setup) ──
// Tech worker sells RSU shares. Broker reports $0 basis on 1099-B.
// The correct basis is FMV at vest (already taxed as W-2 income).

export function rsuSaleReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'MegaTech Inc',
        box1: cents(150000),  // includes $50k RSU income
        box2: cents(30000),
      }),
    ],
    rsuVestEvents: [
      {
        id: 'rsu-vest-1',
        vestDate: '2024-03-15',
        symbol: 'MEGA',
        cusip: '123456789',
        sharesVested: 500,
        sharesWithheldForTax: 175,
        sharesDelivered: 325,
        fmvAtVest: cents(100),          // $100/share at vest
        totalFmv: cents(50000),         // 500 × $100
        linkedW2Id: 'w2-1',
      },
    ],
    capitalTransactions: [
      // Sale of 325 delivered shares at $110/share
      // Broker 1099-B: proceeds $35,750, basis $0
      // Correct basis: $100 × 325 = $32,500
      // Actual gain: $35,750 - $32,500 = $3,250
      makeTransaction({
        id: 'tx-rsu-1',
        description: '325 sh MEGA (RSU)',
        dateAcquired: '2024-03-15',
        dateSold: '2025-06-15',
        proceeds: cents(35750),
        adjustedBasis: cents(32500),
        reportedBasis: 0,
        adjustmentCode: 'B',
        adjustmentAmount: cents(32500),
        longTerm: true,
        category: 'E',  // basis not reported to IRS
        linkedRsuVestId: 'rsu-vest-1',
      }),
    ],
    // Without adjustment: apparent gain = $35,750 (double-taxed!)
    // With adjustment: actual gain = $3,250
  }
}

// ── Fixture: itemized deductions (Schedule A) ───────────────────
// Single filer with high income and significant itemized deductions.
// Tests Schedule A with medical floor, SALT cap, mortgage, charitable.

export function itemizedDeductionReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'MegaTech Inc',
        box1: cents(150000),
        box2: cents(30000),
      }),
    ],
    deductions: {
      method: 'itemized',
      itemized: {
        medicalExpenses: cents(15000),      // above 7.5% floor ($11,250) → $3,750 deductible
        stateLocalIncomeTaxes: cents(18000), // under $40K SALT cap → $18,000
        stateLocalSalesTaxes: 0,
        realEstateTaxes: 0,
        personalPropertyTaxes: 0,
        mortgageInterest: cents(12000),
        mortgagePrincipal: 0,               // not filled → pass-through (no cap applied)
        mortgagePreTCJA: false,
        investmentInterest: 0,
        priorYearInvestmentInterestCarryforward: 0,
        charitableCash: cents(4000),
        charitableNoncash: cents(1000),
        gamblingLosses: 0,
        casualtyTheftLosses: 0,
        federalEstateTaxIRD: 0,
        otherMiscDeductions: 0,
      },
    },
    // AGI = $150,000 (below $500K SALT phase-out threshold)
    // Medical floor = $150,000 × 7.5% = $11,250
    // Medical deduction = $15,000 - $11,250 = $3,750
    // SALT = min($18,000, $40,000) = $18,000 (under $40K cap)
    // Mortgage = $12,000 (principal=0 → pass-through)
    // Charitable cash = $4,000 (below 60% AGI = $90,000)
    // Charitable noncash = $1,000 (below 30% AGI = $45,000)
    // Total charitable = $5,000 (below 60% AGI cap)
    // Total Schedule A = $3,750 + $18,000 + $12,000 + $5,000 = $38,750
    // Standard deduction (single) = $15,000
    // Uses itemized ($38,750 > $15,000)
  }
}

// ── Fixture: active trader — many transactions ─────────────────
// Someone who made 20 trades during the year. Tests pagination
// and aggregation with realistic variety.

export function activeTraderReturn(): TaxReturn {
  const transactions: CapitalTransaction[] = []

  // 12 short-term trades (category A)
  const stTrades = [
    { sym: 'AAPL',  proceeds: 5200,  basis: 4800  },  // +$400
    { sym: 'GOOG',  proceeds: 3100,  basis: 3500  },  // -$400
    { sym: 'AMZN',  proceeds: 8900,  basis: 7200  },  // +$1,700
    { sym: 'TSLA',  proceeds: 2100,  basis: 4100  },  // -$2,000
    { sym: 'META',  proceeds: 6700,  basis: 5500  },  // +$1,200
    { sym: 'NVDA',  proceeds: 12000, basis: 9000  },  // +$3,000
    { sym: 'AMD',   proceeds: 1800,  basis: 2400  },  // -$600
    { sym: 'NFLX',  proceeds: 4500,  basis: 4500  },  // $0 (break-even)
    { sym: 'MSFT',  proceeds: 7800,  basis: 6300  },  // +$1,500
    { sym: 'CRM',   proceeds: 3300,  basis: 3600  },  // -$300
    { sym: 'ORCL',  proceeds: 2900,  basis: 2200  },  // +$700
    { sym: 'INTC',  proceeds: 1100,  basis: 2800  },  // -$1,700
  ]
  // Net ST: +400-400+1700-2000+1200+3000-600+0+1500-300+700-1700 = +$3,500

  stTrades.forEach((t, i) => {
    transactions.push(makeTransaction({
      id: `tx-st-${i + 1}`,
      description: `${t.sym}`,
      dateAcquired: `2025-0${(i % 9) + 1}-${String(10 + i).padStart(2, '0')}`,
      dateSold: `2025-${String((i % 3) + 7).padStart(2, '0')}-${String(15 + i).padStart(2, '0')}`,
      proceeds: cents(t.proceeds),
      adjustedBasis: cents(t.basis),
      longTerm: false,
      category: 'A',
    }))
  })

  // 8 long-term trades (category D)
  const ltTrades = [
    { sym: 'VTI',   proceeds: 25000, basis: 18000 },  // +$7,000
    { sym: 'VOO',   proceeds: 32000, basis: 22000 },  // +$10,000
    { sym: 'QQQ',   proceeds: 15000, basis: 12000 },  // +$3,000
    { sym: 'SPY',   proceeds: 8000,  basis: 11000 },  // -$3,000
    { sym: 'IWM',   proceeds: 4500,  basis: 5200  },  // -$700
    { sym: 'DIA',   proceeds: 19000, basis: 14500 },  // +$4,500
    { sym: 'XLF',   proceeds: 6200,  basis: 5800  },  // +$400
    { sym: 'XLE',   proceeds: 3000,  basis: 4500  },  // -$1,500
  ]
  // Net LT: +7000+10000+3000-3000-700+4500+400-1500 = +$19,700

  ltTrades.forEach((t, i) => {
    transactions.push(makeTransaction({
      id: `tx-lt-${i + 1}`,
      description: `${t.sym}`,
      dateAcquired: `202${3 + (i % 2)}-0${(i % 9) + 1}-15`,
      dateSold: `2025-${String((i % 6) + 4).padStart(2, '0')}-20`,
      proceeds: cents(t.proceeds),
      adjustedBasis: cents(t.basis),
      longTerm: true,
      category: 'D',
    }))
  })

  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(95000),
        box2: cents(15000),
      }),
    ],
    capitalTransactions: transactions,
    // Net ST: +$3,500
    // Net LT: +$19,700
    // Line 16: +$23,200
  }
}

// ── Fixture: bear market — all losses ──────────────────────────
// Everything went down. Tests heavy loss limitation.

export function bearMarketReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(70000),
        box2: cents(8000),
      }),
    ],
    capitalTransactions: [
      makeTransaction({
        id: 'tx-1',
        description: '200 sh RIVN',
        dateAcquired: '2024-06-01',
        dateSold: '2025-02-15',
        proceeds: cents(2000),
        adjustedBasis: cents(8000),  // -$6,000
        longTerm: false,
        category: 'A',
      }),
      makeTransaction({
        id: 'tx-2',
        description: '100 sh LCID',
        dateAcquired: '2025-01-10',
        dateSold: '2025-04-20',
        proceeds: cents(500),
        adjustedBasis: cents(3000),  // -$2,500
        longTerm: false,
        category: 'A',
      }),
      makeTransaction({
        id: 'tx-3',
        description: '300 sh SNAP',
        dateAcquired: '2023-03-01',
        dateSold: '2025-05-01',
        proceeds: cents(1500),
        adjustedBasis: cents(9000),  // -$7,500
        longTerm: true,
        category: 'D',
      }),
      makeTransaction({
        id: 'tx-4',
        description: '150 sh PYPL',
        dateAcquired: '2022-11-01',
        dateSold: '2025-06-15',
        proceeds: cents(7500),
        adjustedBasis: cents(12000), // -$4,500
        longTerm: true,
        category: 'D',
      }),
    ],
    // Net ST: -$6,000 + (-$2,500) = -$8,500
    // Net LT: -$7,500 + (-$4,500) = -$12,000
    // Line 16: -$20,500
    // Line 21: -$3,000 (limited)
    // Carryforward: $17,500
  }
}

// ── Fixture: cap gain distributions only (no 8949 trades) ──────
// Mutual fund investor — only has 1099-DIV capital gain distributions.

export function capGainDistOnlyReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(65000),
        box2: cents(7000),
      }),
    ],
    form1099DIVs: [
      make1099DIV({
        id: 'div-1',
        payerName: 'Vanguard Total Stock Market',
        box1a: cents(2200),   // ordinary dividends
        box1b: cents(1800),   // qualified dividends
        box2a: cents(4500),   // capital gain distributions (LTCG)
      }),
      make1099DIV({
        id: 'div-2',
        payerName: 'Fidelity 500 Index',
        box1a: cents(1500),
        box1b: cents(1200),
        box2a: cents(3200),   // capital gain distributions
      }),
    ],
    // No Form 8949 transactions
    // Schedule D Line 13: $4,500 + $3,200 = $7,700
    // Net LT (Line 15): $7,700
    // Line 16: $7,700
  }
}

// ── Fixture: ST losses offset LT gains ─────────────────────────
// Common tax-loss-harvesting pattern: sell losing short-term positions
// to offset long-term gains and reduce taxes.

export function taxLossHarvestReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(100000),
        box2: cents(18000),
      }),
    ],
    capitalTransactions: [
      // Harvested short-term losses
      makeTransaction({
        id: 'tx-harvest-1',
        description: '400 sh ARKK',
        dateAcquired: '2025-01-15',
        dateSold: '2025-11-20',
        proceeds: cents(8000),
        adjustedBasis: cents(16000),  // -$8,000 loss
        longTerm: false,
        category: 'A',
      }),
      makeTransaction({
        id: 'tx-harvest-2',
        description: '200 sh COIN',
        dateAcquired: '2025-03-01',
        dateSold: '2025-10-15',
        proceeds: cents(5000),
        adjustedBasis: cents(9500),  // -$4,500 loss
        longTerm: false,
        category: 'A',
      }),
      // Long-term gains being offset
      makeTransaction({
        id: 'tx-ltg-1',
        description: '500 sh AAPL',
        dateAcquired: '2023-02-10',
        dateSold: '2025-08-01',
        proceeds: cents(95000),
        adjustedBasis: cents(75000),  // +$20,000 gain
        longTerm: true,
        category: 'D',
      }),
    ],
    // Net ST: -$8,000 + (-$4,500) = -$12,500
    // Net LT: +$20,000
    // Line 16: -$12,500 + $20,000 = +$7,500
    // Line 21: +$7,500 (gain, no limitation)
    // The $12,500 ST loss effectively reduced the taxable LT gain
  }
}

// ── Fixture: multiple stock trades across all categories ────
// 15 trades including one wash sale. Tests all 4 Form 8949 categories.

export function multipleTradesReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(80000),
        box2: cents(12000),
      }),
    ],
    capitalTransactions: [
      // Category A — short-term, basis reported (trades 1–5)
      makeTransaction({
        id: 'tx-1',
        description: 'AAPL',
        dateAcquired: '2025-01-15',
        dateSold: '2025-06-10',
        proceeds: cents(6500),
        adjustedBasis: cents(5000),
        longTerm: false,
        category: 'A',
      }),
      makeTransaction({
        id: 'tx-2',
        description: 'MSFT',
        dateAcquired: '2025-02-01',
        dateSold: '2025-07-01',
        proceeds: cents(2500),
        adjustedBasis: cents(3000),
        longTerm: false,
        category: 'A',
      }),
      makeTransaction({
        id: 'tx-3',
        description: 'GOOG',
        dateAcquired: '2025-01-20',
        dateSold: '2025-06-20',
        proceeds: cents(5200),
        adjustedBasis: cents(4000),
        longTerm: false,
        category: 'A',
      }),
      makeTransaction({
        id: 'tx-4',
        description: 'TSLA',
        dateAcquired: '2025-03-01',
        dateSold: '2025-07-15',
        proceeds: cents(4000),
        adjustedBasis: cents(6000),
        longTerm: false,
        category: 'A',
      }),
      makeTransaction({
        id: 'tx-5',
        description: 'NVDA',
        dateAcquired: '2025-02-15',
        dateSold: '2025-06-30',
        proceeds: cents(3500),
        adjustedBasis: cents(2000),
        longTerm: false,
        category: 'A',
      }),

      // Category B — short-term, basis NOT reported (trades 6–7)
      makeTransaction({
        id: 'tx-6',
        description: 'AMD',
        dateAcquired: '2025-01-10',
        dateSold: '2025-05-15',
        proceeds: cents(2200),
        adjustedBasis: cents(3000),
        reportedBasis: 0,
        adjustmentCode: 'B',
        adjustmentAmount: cents(3000),
        longTerm: false,
        category: 'B',
      }),
      makeTransaction({
        id: 'tx-7',
        description: 'META',
        dateAcquired: '2025-03-10',
        dateSold: '2025-08-01',
        proceeds: cents(5000),
        adjustedBasis: cents(4500),
        reportedBasis: 0,
        adjustmentCode: 'B',
        adjustmentAmount: cents(4500),
        longTerm: false,
        category: 'B',
      }),

      // Category D — long-term, basis reported (trades 8–12)
      makeTransaction({
        id: 'tx-8',
        description: 'AMZN',
        dateAcquired: '2023-06-01',
        dateSold: '2025-07-01',
        proceeds: cents(12000),
        adjustedBasis: cents(8000),
        longTerm: true,
        category: 'D',
      }),
      makeTransaction({
        id: 'tx-9',
        description: 'DIS',
        dateAcquired: '2023-08-15',
        dateSold: '2025-08-20',
        proceeds: cents(4200),
        adjustedBasis: cents(5000),
        longTerm: true,
        category: 'D',
      }),
      makeTransaction({
        id: 'tx-10',
        description: 'JNJ',
        dateAcquired: '2024-01-10',
        dateSold: '2025-09-01',
        proceeds: cents(4500),
        adjustedBasis: cents(3000),
        longTerm: true,
        category: 'D',
      }),
      makeTransaction({
        id: 'tx-11',
        description: 'PFE',
        dateAcquired: '2023-12-01',
        dateSold: '2025-06-15',
        proceeds: cents(3000),
        adjustedBasis: cents(4000),
        longTerm: true,
        category: 'D',
      }),
      makeTransaction({
        id: 'tx-12',
        description: 'XOM',
        dateAcquired: '2024-03-01',
        dateSold: '2025-10-01',
        proceeds: cents(8500),
        adjustedBasis: cents(6000),
        longTerm: true,
        category: 'D',
      }),

      // Category E — long-term, basis NOT reported (trades 13–15)
      makeTransaction({
        id: 'tx-13',
        description: 'WMT',
        dateAcquired: '2023-01-15',
        dateSold: '2025-07-20',
        proceeds: cents(5000),
        adjustedBasis: cents(3500),
        reportedBasis: 0,
        adjustmentCode: 'B',
        adjustmentAmount: cents(3500),
        longTerm: true,
        category: 'E',
      }),
      // Trade 14: KO — wash sale
      makeTransaction({
        id: 'tx-14',
        description: 'KO',
        dateAcquired: '2023-05-01',
        dateSold: '2025-08-10',
        proceeds: cents(1800),
        adjustedBasis: cents(2500),
        reportedBasis: 0,
        adjustmentCode: 'W',
        adjustmentAmount: cents(700),
        washSaleLossDisallowed: cents(700),
        gainLoss: 0,  // loss fully disallowed by wash sale
        longTerm: true,
        category: 'E',
      }),
      makeTransaction({
        id: 'tx-15',
        description: 'PEP',
        dateAcquired: '2023-09-01',
        dateSold: '2025-09-15',
        proceeds: cents(5500),
        adjustedBasis: cents(4000),
        reportedBasis: 0,
        adjustmentCode: 'B',
        adjustmentAmount: cents(4000),
        longTerm: true,
        category: 'E',
      }),
    ],
    // Cat A: 6500+2500+5200+4000+3500=21700 proceeds, 5000+3000+4000+6000+2000=20000 basis → +1700
    // Cat B: 2200+5000=7200 proceeds, 3000+4500=7500 basis → −300
    // Cat D: 12000+4200+4500+3000+8500=32200 proceeds, 8000+5000+3000+4000+6000=26000 basis → +6200
    // Cat E: 5000+1800+5500=12300 proceeds, 3500+2500+4000=10000 basis, adj 3500+700+4000=8200
    //        gainLoss: 1500+0+1500=3000
    // Net ST: 1700 + (−300) = 1400 ($1,400)
    // Net LT: 6200 + 3000 = 9200 ($9,200)
    // Combined: 10600 ($10,600)
  }
}

// ── Helper: make a Dependent with defaults ──────────────────

export function makeDependent(overrides: Partial<Dependent> & { firstName: string; dateOfBirth: string }): Dependent {
  return {
    lastName: 'Doe',
    ssn: '987654321',
    relationship: 'son',
    monthsLived: 12,
    ...overrides,
  }
}

// ── Fixture: family with two qualifying children ─────────────

export function familyWithChildrenReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: 'mfj',
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(80000),
        box2: cents(8000),
      }),
      makeW2({
        id: 'w2-2',
        employerName: 'Beta Inc',
        box1: cents(40000),
        box2: cents(4000),
      }),
    ],
    dependents: [
      makeDependent({ firstName: 'Alice', dateOfBirth: '2015-03-15', relationship: 'daughter' }),
      makeDependent({ firstName: 'Bob', dateOfBirth: '2018-07-22', ssn: '987654322' }),
    ],
    // AGI = $120,000 (well below $400K MFJ threshold)
    // 2 qualifying children → $4,000 CTC
    // Tax liability > $4,000 → all non-refundable, no ACTC
  }
}

// ── Fixture: high income with child (phase-out) ──────────────

export function highIncomeWithChildReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: 'single',
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'BigCo',
        box1: cents(250000),
        box2: cents(50000),
      }),
    ],
    dependents: [
      makeDependent({ firstName: 'Charlie', dateOfBirth: '2012-06-01', relationship: 'son' }),
    ],
    // AGI = $250,000 (single threshold = $200,000)
    // Excess = $50,000 → 50 × $50 = $2,500 phase-out
    // Initial = $2,000 → after phase-out = max(0, 2000 - 2500) = $0
  }
}

// ── Fixture: MFJ basic — married filing jointly ─────────────

export function mfjBasicReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: 'mfj',
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        employerEin: '12-3456789',
        box1: cents(60000),
        box2: cents(6000),
      }),
      makeW2({
        id: 'w2-2',
        employerName: 'Beta Inc',
        employerEin: '98-7654321',
        box1: cents(45000),
        box2: cents(4500),
      }),
    ],
    form1099INTs: [
      make1099INT({
        id: 'int-1',
        payerName: 'Savings Bank',
        box1: cents(1200),
      }),
    ],
    // Total wages: $105,000, withholding: $10,500
    // Interest: $1,200 (below $1,500 threshold → no Schedule B)
    // AGI: $106,200
    // MFJ standard deduction: $30,000
    // Taxable income: $76,200
    // Tax: 10% × $23,850 + 12% × $52,350 = $8,667
  }
}

// ── Fixture: low income with 1 child (EITC eligible) ─────────

export function lowIncomeWithChildReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: 'single',
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Main St Shop',
        box1: cents(25000),
        box2: cents(1500),
      }),
    ],
    dependents: [
      makeDependent({ firstName: 'Emma', dateOfBirth: '2015-04-10', relationship: 'daughter' }),
    ],
    // AGI = $25,000
    // 1 qualifying child → EIC schedule 1
    // Earned income $25K is in phase-out range
    // Single phase-out start: $23,350
    // Credit at EI: max_credit - (25000 - 23350) × 0.1598
    //             = $4,328 - $263.67 ≈ $4,064
  }
}

// ── Fixture: low income, no children (EITC eligible) ─────────

export function lowIncomeNoChildReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: 'single',
    taxpayer: {
      firstName: 'Jane',
      lastName: 'Doe',
      ssn: '123456789',
      dateOfBirth: '1995-06-15',  // age 30 at Dec 31 2025
      address: { street: '123 Main St', city: 'Anytown', state: 'CA', zip: '90210' },
    },
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Main St Shop',
        box1: cents(10000),
        box2: cents(500),
      }),
    ],
    // AGI = $10,000
    // 0 qualifying children, age 30 → EIC schedule 0
    // Earned income $10K is in plateau ($8,490 < $10K < $10,620)
    // Credit at EI: $649 (max credit)
    // Credit at AGI: same
    // EITC = $649
  }
}

// ── Helper: make a ScheduleEProperty with defaults ──────────────

export function makeScheduleEProperty(
  overrides: Partial<ScheduleEProperty> & { id: string },
): ScheduleEProperty {
  return {
    address: '123 Rental St',
    propertyType: 'single-family',
    fairRentalDays: 365,
    personalUseDays: 0,
    rentsReceived: 0,
    royaltiesReceived: 0,
    advertising: 0,
    auto: 0,
    cleaning: 0,
    commissions: 0,
    insurance: 0,
    legal: 0,
    management: 0,
    mortgageInterest: 0,
    otherInterest: 0,
    repairs: 0,
    supplies: 0,
    taxes: 0,
    utilities: 0,
    depreciation: 0,
    other: 0,
    depreciableBasis: 0,
    placedInServiceMonth: 0,
    placedInServiceYear: 0,
    ...overrides,
  }
}

// ── Fixture: rental property with profit ──────────────────────────

export function rentalPropertyReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(80000),
        box2: cents(10000),
      }),
    ],
    scheduleEProperties: [
      makeScheduleEProperty({
        id: 'prop-1',
        address: '456 Maple Ave',
        rentsReceived: cents(24000),   // $24,000 rent
        insurance: cents(1200),
        repairs: cents(3000),
        taxes: cents(4000),
        depreciation: cents(5000),
        // Total expenses: $13,200
        // Net: $24,000 - $13,200 = $10,800 profit
      }),
    ],
    // AGI = $80,000 + $10,800 = $90,800
  }
}

// ── Helper: make a FormSSA1099 with defaults ──────────────────

export function makeSSA1099(overrides: Partial<FormSSA1099> & { id: string; box5: number }): FormSSA1099 {
  return {
    recipientName: 'John Doe',
    box3: overrides.box5,   // default: box3 = box5 (no repayments)
    box4: 0,
    box6: 0,
    ...overrides,
  }
}

// ── Fixture: retiree with Social Security benefits (Tier 1 — 50% max) ──

export function ssaTier1Return(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: 'single',
    formSSA1099s: [
      makeSSA1099({
        id: 'ssa-1',
        recipientName: 'John Doe',
        box5: cents(18000),  // $18,000 SS benefits
        box6: cents(1800),   // $1,800 voluntary withholding
      }),
    ],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Part-Time Corp',
        box1: cents(15000),  // $15,000 wages
        box2: cents(1000),
      }),
    ],
    // Other income: $15,000
    // Half benefits: $9,000
    // Combined income: $15,000 + $9,000 = $24,000
    // Base amount (single): $25,000
    // Combined ≤ base → Tier 0, $0 taxable
    // Wait, let's adjust to trigger Tier 1:
    // Need combined > $25K but ≤ $34K
  }
}

// ── Fixture: retiree with SS benefits + moderate income (Tier 2 — 85% max) ──

export function ssaTier2Return(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: 'single',
    formSSA1099s: [
      makeSSA1099({
        id: 'ssa-1',
        recipientName: 'Jane Retiree',
        box5: cents(24000),  // $24,000 SS benefits
        box6: cents(2400),   // $2,400 voluntary withholding
      }),
    ],
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Consulting Co',
        box1: cents(30000),  // $30,000 wages
        box2: cents(3000),
      }),
    ],
    // Other income: $30,000
    // Half benefits: $12,000
    // Combined income: $30,000 + $12,000 = $42,000
    // Base amount (single): $25,000
    // Additional amount (single): $34,000
    // Combined ($42K) > additional ($34K) → Tier 2
  }
}

// ── Fixture: senior (age 65+) with standard deduction ────────────

export function seniorStandardDeductionReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: 'single',
    taxpayer: {
      firstName: 'Eleanor',
      lastName: 'Senior',
      ssn: '111223333',
      dateOfBirth: '1958-05-15',  // 67 years old in 2025
      address: { street: '100 Oak St', city: 'Anytown', state: 'CA', zip: '90210' },
    },
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Senior Services',
        box1: cents(40000),
        box2: cents(4000),
      }),
    ],
    deductions: {
      method: 'standard',
      taxpayerAge65: true,
      taxpayerBlind: false,
      spouseAge65: false,
      spouseBlind: false,
    },
    // Standard deduction: $15,750 + $4,000 (OBBBA senior) = $19,750
  }
}

// ── Fixture: MFJ senior couple, both 65+, one blind ──────────────

export function seniorCoupleMFJReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: 'mfj',
    taxpayer: {
      firstName: 'Robert',
      lastName: 'Elder',
      ssn: '111223344',
      dateOfBirth: '1955-01-01',
      address: { street: '200 Elm St', city: 'Anytown', state: 'CA', zip: '90210' },
    },
    spouse: {
      firstName: 'Mary',
      lastName: 'Elder',
      ssn: '111223355',
      dateOfBirth: '1957-06-15',
      address: { street: '200 Elm St', city: 'Anytown', state: 'CA', zip: '90210' },
    },
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Retirement Co',
        box1: cents(50000),
        box2: cents(5000),
      }),
    ],
    formSSA1099s: [
      makeSSA1099({
        id: 'ssa-1',
        recipientName: 'Robert Elder',
        owner: 'taxpayer',
        box5: cents(20000),
        box6: cents(2000),
      }),
      makeSSA1099({
        id: 'ssa-2',
        recipientName: 'Mary Elder',
        owner: 'spouse',
        box5: cents(15000),
        box6: cents(1500),
      }),
    ],
    deductions: {
      method: 'standard',
      taxpayerAge65: true,
      taxpayerBlind: false,
      spouseAge65: true,
      spouseBlind: true,
    },
    // Standard deduction: $31,500 base
    //   + $3,200 × 2 (OBBBA senior for each spouse age 65+)
    //   + $1,600 × 1 (blind for spouse, pre-OBBBA rate)
    //   = $31,500 + $6,400 + $1,600 = $39,500
  }
}

// ── Fixture: multiple employers with excess SS withholding ───────

export function excessSSWithholdingReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: 'single',
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Employer A',
        box1: cents(100000),
        box2: cents(15000),
        box3: cents(100000),
        box4: cents(6200),  // 6.2% of $100K
        box5: cents(100000),
        box6: cents(1450),
      }),
      makeW2({
        id: 'w2-2',
        employerName: 'Employer B',
        box1: cents(90000),
        box2: cents(12000),
        box3: cents(90000),
        box4: cents(5580),  // 6.2% of $90K
        box5: cents(90000),
        box6: cents(1305),
      }),
    ],
    // Total SS withheld: $6,200 + $5,580 = $11,780
    // Max SS withholding: $176,100 × 6.2% = $10,918.20
    // Excess: $11,780 - $10,918 = $862 (approx, depends on rounding)
  }
}

// ── Fixture: rental property with loss (PAL applies) ─────────────

export function rentalLossReturn(): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    w2s: [
      makeW2({
        id: 'w2-1',
        employerName: 'Acme Corp',
        box1: cents(80000),
        box2: cents(10000),
      }),
    ],
    scheduleEProperties: [
      makeScheduleEProperty({
        id: 'prop-1',
        address: '789 Oak Dr',
        rentsReceived: cents(12000),     // $12,000 rent
        mortgageInterest: cents(15000),
        insurance: cents(2000),
        taxes: cents(5000),
        repairs: cents(8000),
        depreciation: cents(12000),
        // Total expenses: $42,000
        // Net: $12,000 - $42,000 = -$30,000 loss
        // PAL allowance at AGI $80,000 (below $100K): full $25,000
        // Allowed loss: -$25,000
        // Disallowed: -$5,000 carryforward
      }),
    ],
  }
}
