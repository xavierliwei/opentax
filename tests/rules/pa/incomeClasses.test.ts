/**
 * Tests for PA Income Classification — 8-class income reclassification
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../../src/model/traced'
import { emptyTaxReturn } from '../../../src/model/types'
import type { TaxReturn, StateReturnConfig, Form1099B } from '../../../src/model/types'
import { classifyPAIncome, sumPositiveClasses } from '../../../src/rules/2025/pa/incomeClasses'
import { makeW2, make1099INT, make1099DIV, makeScheduleC, makeScheduleK1, makeScheduleEProperty } from '../../fixtures/returns'

// ── Helpers ─────────────────────────────────────────────────────

function paConfig(residencyType: 'full-year' | 'part-year' | 'nonresident' = 'full-year'): StateReturnConfig {
  return { stateCode: 'PA', residencyType }
}

function make1099B(overrides: Partial<Form1099B> & { id: string; proceeds: number; costBasis: number | null }): Form1099B {
  return {
    brokerName: 'Test Broker',
    description: 'AAPL',
    dateAcquired: '2024-01-15',
    dateSold: '2025-06-15',
    washSaleLossDisallowed: 0,
    gainLoss: overrides.proceeds - (overrides.costBasis ?? 0),
    basisReportedToIrs: true,
    longTerm: true,
    noncoveredSecurity: false,
    federalTaxWithheld: 0,
    ...overrides,
  }
}

// ── Class 1: Compensation ───────────────────────────────────────

describe('PA Income Classes — Compensation (Class 1)', () => {
  it('uses W-2 Box 16 when Box 15 is PA', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1', employerName: 'PA Corp',
        box1: cents(80000), box2: cents(10000),
        box15State: 'PA', box16StateWages: cents(75000),
      })],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.compensation).toBe(cents(75000))
    expect(ic.netCompensation).toBe(cents(75000))
  })

  it('falls back to Box 1 when Box 16 is missing', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({
        id: 'w2-1', employerName: 'Corp',
        box1: cents(85000), box2: cents(10000),
      })],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.compensation).toBe(cents(85000))
  })

  it('full-year resident includes all W-2s regardless of state', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'PA', box1: cents(50000), box2: cents(5000), box15State: 'PA', box16StateWages: cents(50000) }),
        makeW2({ id: 'w2-2', employerName: 'NY', box1: cents(30000), box2: cents(3000), box15State: 'NY', box16StateWages: cents(30000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('full-year'))
    // PA W-2 uses Box 16, NY W-2 uses Box 1 (no PA Box 16)
    expect(ic.compensation).toBe(cents(50000) + cents(30000))
  })

  it('nonresident only counts PA W-2s', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'PA', box1: cents(50000), box2: cents(5000), box15State: 'PA', box16StateWages: cents(50000) }),
        makeW2({ id: 'w2-2', employerName: 'NY', box1: cents(30000), box2: cents(3000), box15State: 'NY' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.compensation).toBe(cents(50000))
  })

  it('no W-2s → compensation is $0', () => {
    const model = emptyTaxReturn(2025)
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.compensation).toBe(0)
    expect(ic.netCompensation).toBe(0)
  })
})

// ── Class 2: Interest ───────────────────────────────────────────

describe('PA Income Classes — Interest (Class 2)', () => {
  it('sums taxable interest from 1099-INTs', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Bank A', box1: cents(2500) }),
        make1099INT({ id: 'int-2', payerName: 'Bank B', box1: cents(800) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.interest).toBe(cents(3300))
  })

  it('includes federally tax-exempt interest (box8) — PA taxes non-PA munis', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Muni Fund', box1: cents(1000), box8: cents(500) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.interest).toBe(cents(1500))
  })

  it('no 1099-INTs → interest is $0', () => {
    const model = emptyTaxReturn(2025)
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.interest).toBe(0)
  })
})

// ── Class 3: Dividends ──────────────────────────────────────────

describe('PA Income Classes — Dividends (Class 3)', () => {
  it('sums ordinary dividends (box1a)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Broker', box1a: cents(3000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.dividends).toBe(cents(3000))
  })

  it('includes capital gain distributions (box2a) in Class 3, not Class 5', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Vanguard', box1a: cents(2000), box2a: cents(1500) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.dividends).toBe(cents(3500))
  })

  it('multiple 1099-DIVs → sum all', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'A', box1a: cents(2000), box2a: cents(500) }),
        make1099DIV({ id: 'div-2', payerName: 'B', box1a: cents(1000), box2a: cents(300) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.dividends).toBe(cents(3800))
  })
})

// ── Class 4: Net Business Income ────────────────────────────────

describe('PA Income Classes — Net Business Income (Class 4)', () => {
  it('Schedule C with profit → positive', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({ id: 'biz-1', businessName: 'Consulting', grossReceipts: cents(80000), supplies: cents(5000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.netBusinessIncome).toBe(cents(75000))
  })

  it('Schedule C with loss → floors at $0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({ id: 'biz-1', businessName: 'Failing Biz', grossReceipts: cents(10000), supplies: cents(20000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.netBusinessIncome).toBe(0)
  })
})

// ── Class 5: Net Gains from Property ────────────────────────────

describe('PA Income Classes — Net Gains (Class 5)', () => {
  it('1099-B net gain → positive Class 5', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099Bs: [
        make1099B({ id: 'b-1', proceeds: cents(10000), costBasis: cents(7000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.netGains).toBe(cents(3000))
  })

  it('1099-B net loss → floors at $0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099Bs: [
        make1099B({ id: 'b-1', proceeds: cents(5000), costBasis: cents(10000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.netGains).toBe(0)
  })

  it('1099-B with null costBasis → treats basis as $0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099Bs: [
        make1099B({ id: 'b-1', proceeds: cents(8000), costBasis: null }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.netGains).toBe(cents(8000))
  })

  it('multiple 1099-Bs → net within class before flooring', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099Bs: [
        make1099B({ id: 'b-1', proceeds: cents(10000), costBasis: cents(7000) }),  // +$3K
        make1099B({ id: 'b-2', proceeds: cents(5000), costBasis: cents(12000) }),  // -$7K
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    // Net = -$4K, floors at 0
    expect(ic.netGains).toBe(0)
  })
})

// ── Class 6: Rents & Royalties ──────────────────────────────────

describe('PA Income Classes — Rents/Royalties (Class 6)', () => {
  it('rental property with profit', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleEProperties: [
        makeScheduleEProperty({ id: 'p-1', rentsReceived: cents(24000), insurance: cents(1200), repairs: cents(3000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.rentsRoyalties).toBe(cents(19800))
  })

  it('rental property with loss → floors at $0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleEProperties: [
        makeScheduleEProperty({ id: 'p-1', rentsReceived: cents(10000), mortgageInterest: cents(15000), taxes: cents(5000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.rentsRoyalties).toBe(0)
  })
})

// ── Class 7: Estate/Trust Income ────────────────────────────────

describe('PA Income Classes — Estate/Trust (Class 7)', () => {
  it('K-1 with entityType trust-estate → counted', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeScheduleK1({ id: 'k1-1', entityName: 'Family Trust', entityType: 'trust-estate', ordinaryIncome: cents(15000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.estateTrustIncome).toBe(cents(15000))
  })

  it('K-1 with entityType partnership → NOT counted in Class 7', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeScheduleK1({ id: 'k1-1', entityName: 'LP Fund', entityType: 'partnership', ordinaryIncome: cents(20000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.estateTrustIncome).toBe(0)
  })

  it('negative trust income → floors at $0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeScheduleK1({ id: 'k1-1', entityName: 'Loss Trust', entityType: 'trust-estate', ordinaryIncome: cents(-5000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.estateTrustIncome).toBe(0)
  })
})

// ── Cross-class isolation ───────────────────────────────────────

describe('PA Income Classes — Cross-class isolation', () => {
  it('capital loss does NOT offset compensation', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
      form1099Bs: [
        make1099B({ id: 'b-1', proceeds: cents(5000), costBasis: cents(15000) }),  // -$10K loss
      ],
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.netCompensation).toBe(cents(50000))
    expect(ic.netGains).toBe(0)
    expect(sumPositiveClasses(ic)).toBe(cents(50000))
  })

  it('all classes positive → sums all', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(50000), box2: cents(5000) })],
      form1099INTs: [make1099INT({ id: 'i-1', payerName: 'B', box1: cents(2000) })],
      form1099DIVs: [make1099DIV({ id: 'd-1', payerName: 'B', box1a: cents(1500) })],
      scheduleCBusinesses: [makeScheduleC({ id: 'biz-1', businessName: 'Biz', grossReceipts: cents(30000) })],
      form1099Bs: [make1099B({ id: 'b-1', proceeds: cents(10000), costBasis: cents(7000) })],
    }
    const ic = classifyPAIncome(model, paConfig())
    const total = sumPositiveClasses(ic)
    expect(total).toBe(cents(50000) + cents(2000) + cents(1500) + cents(30000) + cents(3000))
  })

  it('mixed positive and negative → only sums positive', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2-1', employerName: 'X', box1: cents(60000), box2: cents(6000) })],
      form1099INTs: [make1099INT({ id: 'i-1', payerName: 'B', box1: cents(1000) })],
      form1099Bs: [make1099B({ id: 'b-1', proceeds: cents(3000), costBasis: cents(10000) })],  // -$7K loss → 0
      scheduleCBusinesses: [makeScheduleC({ id: 'biz-1', businessName: 'Biz', grossReceipts: cents(5000), supplies: cents(15000) })],  // -$10K loss → 0
    }
    const ic = classifyPAIncome(model, paConfig())
    expect(ic.netGains).toBe(0)
    expect(ic.netBusinessIncome).toBe(0)
    expect(sumPositiveClasses(ic)).toBe(cents(60000) + cents(1000))
  })
})

// ── sumPositiveClasses ──────────────────────────────────────────

describe('sumPositiveClasses', () => {
  it('all zero → returns 0', () => {
    const classes = {
      compensation: 0, unreimbursedExpenses: 0, netCompensation: 0,
      interest: 0, dividends: 0, netBusinessIncome: 0, netGains: 0,
      rentsRoyalties: 0, estateTrustIncome: 0, gamblingWinnings: 0,
    }
    expect(sumPositiveClasses(classes)).toBe(0)
  })

  it('only sums positive values', () => {
    const classes = {
      compensation: cents(50000), unreimbursedExpenses: 0, netCompensation: cents(50000),
      interest: cents(1000), dividends: 0, netBusinessIncome: 0, netGains: 0,
      rentsRoyalties: 0, estateTrustIncome: 0, gamblingWinnings: 0,
    }
    expect(sumPositiveClasses(classes)).toBe(cents(51000))
  })
})

// ══════════════════════════════════════════════════════════════════
// Nonresident source apportionment tests — all 8 classes
// ══════════════════════════════════════════════════════════════════

// ── Nonresident Class 1: Compensation ───────────────────────────

describe('PA Nonresident — Compensation (Class 1)', () => {
  it('only includes W-2s with Box 15 = PA', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-pa', employerName: 'PA Corp', box1: cents(60000), box2: cents(6000), box15State: 'PA', box16StateWages: cents(60000) }),
        makeW2({ id: 'w2-nj', employerName: 'NJ Corp', box1: cents(40000), box2: cents(4000), box15State: 'NJ', box16StateWages: cents(40000) }),
        makeW2({ id: 'w2-ny', employerName: 'NY Corp', box1: cents(30000), box2: cents(3000), box15State: 'NY' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.compensation).toBe(cents(60000))
    expect(ic.netCompensation).toBe(cents(60000))
  })

  it('no PA W-2s for nonresident → $0 compensation', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-nj', employerName: 'NJ Corp', box1: cents(80000), box2: cents(8000), box15State: 'NJ' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.compensation).toBe(0)
  })
})

// ── Nonresident Class 2: Interest ───────────────────────────────

describe('PA Nonresident — Interest (Class 2)', () => {
  it('nonresident interest is $0 (intangible income, not PA-source)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Big Bank', box1: cents(5000) }),
        make1099INT({ id: 'int-2', payerName: 'PA Bank', box1: cents(3000), box8: cents(500) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.interest).toBe(0)
  })

  it('full-year resident still gets full interest', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Big Bank', box1: cents(5000), box8: cents(500) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('full-year'))
    expect(ic.interest).toBe(cents(5500))
  })
})

// ── Nonresident Class 3: Dividends ──────────────────────────────

describe('PA Nonresident — Dividends (Class 3)', () => {
  it('nonresident dividends are $0 (intangible income, not PA-source)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Vanguard', box1a: cents(4000), box2a: cents(1000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.dividends).toBe(0)
  })

  it('full-year resident still gets full dividends', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Vanguard', box1a: cents(4000), box2a: cents(1000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('full-year'))
    expect(ic.dividends).toBe(cents(5000))
  })
})

// ── Nonresident Class 4: Net Business Income ────────────────────

describe('PA Nonresident — Net Business Income (Class 4)', () => {
  it('nonresident only includes PA-state businesses', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({ id: 'biz-pa', businessName: 'PA Consulting', grossReceipts: cents(60000), supplies: cents(5000), businessState: 'PA' }),
        makeScheduleC({ id: 'biz-nj', businessName: 'NJ Plumbing', grossReceipts: cents(40000), supplies: cents(3000), businessState: 'NJ' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    // Only PA business: $60K - $5K = $55K
    expect(ic.netBusinessIncome).toBe(cents(55000))
  })

  it('nonresident with no PA businesses → $0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({ id: 'biz-ny', businessName: 'NY Studio', grossReceipts: cents(80000), businessState: 'NY' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.netBusinessIncome).toBe(0)
  })

  it('nonresident with PA business loss → floors at $0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({ id: 'biz-pa', businessName: 'PA Startup', grossReceipts: cents(10000), supplies: cents(25000), businessState: 'PA' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.netBusinessIncome).toBe(0)
  })

  it('nonresident business without businessState set → excluded', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({ id: 'biz-1', businessName: 'Unknown State Biz', grossReceipts: cents(50000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.netBusinessIncome).toBe(0)
  })

  it('full-year resident includes all businesses regardless of state', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({ id: 'biz-pa', businessName: 'PA Consulting', grossReceipts: cents(60000), businessState: 'PA' }),
        makeScheduleC({ id: 'biz-nj', businessName: 'NJ Plumbing', grossReceipts: cents(40000), businessState: 'NJ' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('full-year'))
    expect(ic.netBusinessIncome).toBe(cents(100000))
  })
})

// ── Nonresident Class 5: Net Gains ──────────────────────────────

describe('PA Nonresident — Net Gains (Class 5)', () => {
  it('nonresident only includes gains from PA-property 1099-Bs', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099Bs: [
        make1099B({ id: 'b-pa', proceeds: cents(50000), costBasis: cents(30000), propertyState: 'PA' }),
        make1099B({ id: 'b-stock', proceeds: cents(20000), costBasis: cents(15000) }),  // no state → stock, not PA-source
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    // Only PA real property: $50K - $30K = $20K
    expect(ic.netGains).toBe(cents(20000))
  })

  it('nonresident publicly traded stock (no propertyState) is excluded', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099Bs: [
        make1099B({ id: 'b-1', proceeds: cents(10000), costBasis: cents(7000) }),
        make1099B({ id: 'b-2', proceeds: cents(15000), costBasis: cents(9000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.netGains).toBe(0)
  })

  it('nonresident PA property loss → floors at $0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099Bs: [
        make1099B({ id: 'b-pa', proceeds: cents(20000), costBasis: cents(30000), propertyState: 'PA' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.netGains).toBe(0)
  })

  it('full-year resident includes all 1099-Bs regardless of property state', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      form1099Bs: [
        make1099B({ id: 'b-pa', proceeds: cents(50000), costBasis: cents(30000), propertyState: 'PA' }),
        make1099B({ id: 'b-stock', proceeds: cents(20000), costBasis: cents(15000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('full-year'))
    expect(ic.netGains).toBe(cents(25000))
  })
})

// ── Nonresident Class 6: Rents & Royalties ──────────────────────

describe('PA Nonresident — Rents/Royalties (Class 6)', () => {
  it('nonresident only includes PA-located properties', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleEProperties: [
        makeScheduleEProperty({ id: 'p-pa', address: '123 Main St, Philadelphia', propertyState: 'PA', rentsReceived: cents(24000), insurance: cents(1200) }),
        makeScheduleEProperty({ id: 'p-nj', address: '456 Shore Rd, Cape May', propertyState: 'NJ', rentsReceived: cents(18000), insurance: cents(900) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    // Only PA property: $24K - $1.2K = $22.8K
    expect(ic.rentsRoyalties).toBe(cents(22800))
  })

  it('nonresident with no PA properties → $0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleEProperties: [
        makeScheduleEProperty({ id: 'p-ny', address: '100 Broadway, NYC', propertyState: 'NY', rentsReceived: cents(36000), taxes: cents(5000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.rentsRoyalties).toBe(0)
  })

  it('nonresident PA property with loss → floors at $0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleEProperties: [
        makeScheduleEProperty({ id: 'p-pa', propertyState: 'PA', rentsReceived: cents(10000), mortgageInterest: cents(15000), taxes: cents(5000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.rentsRoyalties).toBe(0)
  })

  it('nonresident property without propertyState set → excluded', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleEProperties: [
        makeScheduleEProperty({ id: 'p-1', rentsReceived: cents(24000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.rentsRoyalties).toBe(0)
  })

  it('full-year resident includes all properties regardless of state', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleEProperties: [
        makeScheduleEProperty({ id: 'p-pa', propertyState: 'PA', rentsReceived: cents(24000), insurance: cents(1200) }),
        makeScheduleEProperty({ id: 'p-nj', propertyState: 'NJ', rentsReceived: cents(18000), insurance: cents(900) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('full-year'))
    expect(ic.rentsRoyalties).toBe(cents(24000) - cents(1200) + cents(18000) - cents(900))
  })
})

// ── Nonresident Class 7: Estate/Trust Income ────────────────────

describe('PA Nonresident — Estate/Trust Income (Class 7)', () => {
  it('nonresident only includes PA-situs trusts', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeScheduleK1({ id: 'k1-pa', entityName: 'PA Family Trust', entityType: 'trust-estate', ordinaryIncome: cents(20000), entityState: 'PA' }),
        makeScheduleK1({ id: 'k1-ny', entityName: 'NY Trust', entityType: 'trust-estate', ordinaryIncome: cents(15000), entityState: 'NY' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.estateTrustIncome).toBe(cents(20000))
  })

  it('nonresident with no PA trusts → $0', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeScheduleK1({ id: 'k1-ny', entityName: 'NY Trust', entityType: 'trust-estate', ordinaryIncome: cents(25000), entityState: 'NY' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.estateTrustIncome).toBe(0)
  })

  it('nonresident trust without entityState set → excluded', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeScheduleK1({ id: 'k1-1', entityName: 'Unknown Trust', entityType: 'trust-estate', ordinaryIncome: cents(10000) }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.estateTrustIncome).toBe(0)
  })

  it('nonresident PA partnership K-1 is NOT counted in Class 7', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeScheduleK1({ id: 'k1-1', entityName: 'PA Partners LP', entityType: 'partnership', ordinaryIncome: cents(30000), entityState: 'PA' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))
    expect(ic.estateTrustIncome).toBe(0)
  })

  it('full-year resident includes all trust-estate K-1s regardless of state', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeScheduleK1({ id: 'k1-pa', entityName: 'PA Trust', entityType: 'trust-estate', ordinaryIncome: cents(20000), entityState: 'PA' }),
        makeScheduleK1({ id: 'k1-ny', entityName: 'NY Trust', entityType: 'trust-estate', ordinaryIncome: cents(15000), entityState: 'NY' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('full-year'))
    expect(ic.estateTrustIncome).toBe(cents(35000))
  })
})

// ── Nonresident Class 8: Gambling/Lottery ─────────────────────

describe('PA Nonresident — Gambling/Lottery (Class 8)', () => {
  it('gambling is $0 for both resident and nonresident (Phase 2)', () => {
    const model = emptyTaxReturn(2025)
    const residentIc = classifyPAIncome(model, paConfig('full-year'))
    const nrIc = classifyPAIncome(model, paConfig('nonresident'))
    expect(residentIc.gamblingWinnings).toBe(0)
    expect(nrIc.gamblingWinnings).toBe(0)
  })
})

// ── Nonresident mixed scenario ──────────────────────────────────

describe('PA Nonresident — mixed scenario', () => {
  it('PA wages + out-of-state investments + PA rental → only PA-source income taxed', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-pa', employerName: 'PA Corp', box1: cents(80000), box2: cents(8000), box15State: 'PA', box16StateWages: cents(80000) }),
        makeW2({ id: 'w2-nj', employerName: 'NJ Corp', box1: cents(40000), box2: cents(4000), box15State: 'NJ' }),
      ],
      // Interest and dividends — NOT PA-source for NR
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Bank', box1: cents(5000) }),
      ],
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Broker', box1a: cents(3000), box2a: cents(1000) }),
      ],
      // Schedule C — one PA, one out of state
      scheduleCBusinesses: [
        makeScheduleC({ id: 'biz-pa', businessName: 'PA Consulting', grossReceipts: cents(50000), supplies: cents(5000), businessState: 'PA' }),
        makeScheduleC({ id: 'biz-ny', businessName: 'NY Art Studio', grossReceipts: cents(30000), businessState: 'NY' }),
      ],
      // 1099-B — publicly traded stock (not PA-source) + PA real property
      form1099Bs: [
        make1099B({ id: 'b-stock', proceeds: cents(20000), costBasis: cents(15000) }),  // stock, no state
        make1099B({ id: 'b-pa-land', proceeds: cents(100000), costBasis: cents(60000), propertyState: 'PA' }),  // PA land sale
      ],
      // Schedule E — one PA, one NJ
      scheduleEProperties: [
        makeScheduleEProperty({ id: 'p-pa', propertyState: 'PA', rentsReceived: cents(24000), insurance: cents(1200), taxes: cents(3000) }),
        makeScheduleEProperty({ id: 'p-nj', propertyState: 'NJ', rentsReceived: cents(18000), insurance: cents(900) }),
      ],
      // K-1 estate/trust — one PA, one NY
      scheduleK1s: [
        makeScheduleK1({ id: 'k1-pa', entityName: 'PA Trust', entityType: 'trust-estate', ordinaryIncome: cents(12000), entityState: 'PA' }),
        makeScheduleK1({ id: 'k1-ny', entityName: 'NY Trust', entityType: 'trust-estate', ordinaryIncome: cents(8000), entityState: 'NY' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('nonresident'))

    // Class 1: Only PA W-2 = $80K
    expect(ic.netCompensation).toBe(cents(80000))
    // Class 2: $0 (intangible)
    expect(ic.interest).toBe(0)
    // Class 3: $0 (intangible)
    expect(ic.dividends).toBe(0)
    // Class 4: Only PA business = $50K - $5K = $45K
    expect(ic.netBusinessIncome).toBe(cents(45000))
    // Class 5: Only PA land sale = $100K - $60K = $40K
    expect(ic.netGains).toBe(cents(40000))
    // Class 6: Only PA rental = $24K - $1.2K - $3K = $19.8K
    expect(ic.rentsRoyalties).toBe(cents(19800))
    // Class 7: Only PA trust = $12K
    expect(ic.estateTrustIncome).toBe(cents(12000))
    // Class 8: $0 (Phase 2)
    expect(ic.gamblingWinnings).toBe(0)

    // Total PA-source income
    const total = sumPositiveClasses(ic)
    expect(total).toBe(cents(80000) + cents(45000) + cents(40000) + cents(19800) + cents(12000))
  })

  it('same scenario as full-year resident includes ALL income', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-pa', employerName: 'PA Corp', box1: cents(80000), box2: cents(8000), box15State: 'PA', box16StateWages: cents(80000) }),
        makeW2({ id: 'w2-nj', employerName: 'NJ Corp', box1: cents(40000), box2: cents(4000), box15State: 'NJ' }),
      ],
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Bank', box1: cents(5000) }),
      ],
      form1099DIVs: [
        make1099DIV({ id: 'div-1', payerName: 'Broker', box1a: cents(3000), box2a: cents(1000) }),
      ],
      scheduleCBusinesses: [
        makeScheduleC({ id: 'biz-pa', businessName: 'PA Consulting', grossReceipts: cents(50000), supplies: cents(5000), businessState: 'PA' }),
        makeScheduleC({ id: 'biz-ny', businessName: 'NY Art Studio', grossReceipts: cents(30000), businessState: 'NY' }),
      ],
      form1099Bs: [
        make1099B({ id: 'b-stock', proceeds: cents(20000), costBasis: cents(15000) }),
        make1099B({ id: 'b-pa-land', proceeds: cents(100000), costBasis: cents(60000), propertyState: 'PA' }),
      ],
      scheduleEProperties: [
        makeScheduleEProperty({ id: 'p-pa', propertyState: 'PA', rentsReceived: cents(24000), insurance: cents(1200), taxes: cents(3000) }),
        makeScheduleEProperty({ id: 'p-nj', propertyState: 'NJ', rentsReceived: cents(18000), insurance: cents(900) }),
      ],
      scheduleK1s: [
        makeScheduleK1({ id: 'k1-pa', entityName: 'PA Trust', entityType: 'trust-estate', ordinaryIncome: cents(12000), entityState: 'PA' }),
        makeScheduleK1({ id: 'k1-ny', entityName: 'NY Trust', entityType: 'trust-estate', ordinaryIncome: cents(8000), entityState: 'NY' }),
      ],
    }
    const ic = classifyPAIncome(model, paConfig('full-year'))

    // Class 1: All W-2s = $80K + $40K = $120K
    expect(ic.netCompensation).toBe(cents(120000))
    // Class 2: $5K
    expect(ic.interest).toBe(cents(5000))
    // Class 3: $3K + $1K = $4K
    expect(ic.dividends).toBe(cents(4000))
    // Class 4: ($50K-$5K) + $30K = $75K
    expect(ic.netBusinessIncome).toBe(cents(75000))
    // Class 5: ($20K-$15K) + ($100K-$60K) = $45K
    expect(ic.netGains).toBe(cents(45000))
    // Class 6: ($24K-$1.2K-$3K) + ($18K-$0.9K) = $36.9K
    expect(ic.rentsRoyalties).toBe(cents(19800) + cents(17100))
    // Class 7: $12K + $8K = $20K
    expect(ic.estateTrustIncome).toBe(cents(20000))
  })

  it('part-year resident includes all income (apportionment handled in pa40)', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({ id: 'w2-pa', employerName: 'PA Corp', box1: cents(80000), box2: cents(8000), box15State: 'PA', box16StateWages: cents(80000) }),
        makeW2({ id: 'w2-nj', employerName: 'NJ Corp', box1: cents(40000), box2: cents(4000), box15State: 'NJ' }),
      ],
      form1099INTs: [
        make1099INT({ id: 'int-1', payerName: 'Bank', box1: cents(5000) }),
      ],
    }
    const config: StateReturnConfig = { stateCode: 'PA', residencyType: 'part-year', moveInDate: '2025-07-01' }
    const ic = classifyPAIncome(model, config)

    // Part-year includes all income — apportionment is done in pa40.ts
    expect(ic.netCompensation).toBe(cents(120000))
    expect(ic.interest).toBe(cents(5000))
  })
})
