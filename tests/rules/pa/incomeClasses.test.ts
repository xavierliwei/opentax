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
