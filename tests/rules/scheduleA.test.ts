/**
 * Tests for Schedule A — Itemized Deductions
 *
 * Covers:
 * - Medical expense 7.5% AGI floor
 * - SALT: income/sales election, real estate, personal property, cap + phase-out
 * - Mortgage interest $750K/$1M loan balance cap (post/pre-TCJA, MFS)
 * - Investment interest limited to net investment income
 * - Charitable 60%/30% AGI limits and overall 60% cap
 * - Full realistic scenario
 * - Integration through computeForm1040
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { TaxReturn } from '../../src/model/types'
import { computeScheduleA, computeSaltCap } from '../../src/rules/2025/scheduleA'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { STANDARD_DEDUCTION } from '../../src/rules/2025/constants'
import { itemizedDeductionReturn } from '../fixtures/returns'

// ── Helper: build an itemized return ─────────────────────────

function makeItemized(overrides: {
  filingStatus?: TaxReturn['filingStatus']
  medical?: number
  // SALT sub-fields
  saltIncome?: number        // stateLocalIncomeTaxes
  saltSales?: number         // stateLocalSalesTaxes
  saltRealEstate?: number    // realEstateTaxes
  saltPersonal?: number      // personalPropertyTaxes
  salt?: number              // convenience: maps to stateLocalIncomeTaxes
  // Mortgage
  mortgage?: number
  mortgagePrincipal?: number
  mortgagePreTCJA?: boolean
  // Investment interest
  investmentInterest?: number
  // Charitable
  charitableCash?: number
  charitableNoncash?: number
  other?: number
  wages?: number
}): TaxReturn {
  return {
    ...emptyTaxReturn(2025),
    filingStatus: overrides.filingStatus ?? 'single',
    w2s: overrides.wages != null ? [{
      id: 'w2-1',
      employerEin: '00-0000000',
      employerName: 'Test Corp',
      box1: overrides.wages,
      box2: cents(10000),
      box3: overrides.wages,
      box4: 0,
      box5: overrides.wages,
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
    }] : [],
    deductions: {
      method: 'itemized',
      itemized: {
        medicalExpenses: overrides.medical ?? 0,
        stateLocalIncomeTaxes: overrides.saltIncome ?? overrides.salt ?? 0,
        stateLocalSalesTaxes: overrides.saltSales ?? 0,
        realEstateTaxes: overrides.saltRealEstate ?? 0,
        personalPropertyTaxes: overrides.saltPersonal ?? 0,
        mortgageInterest: overrides.mortgage ?? 0,
        mortgagePrincipal: overrides.mortgagePrincipal ?? 0,
        mortgagePreTCJA: overrides.mortgagePreTCJA ?? false,
        investmentInterest: overrides.investmentInterest ?? 0,
        charitableCash: overrides.charitableCash ?? 0,
        charitableNoncash: overrides.charitableNoncash ?? 0,
        otherDeductions: overrides.other ?? 0,
      },
    },
  }
}

// ── Medical expense floor tests ────────────────────────────────

describe('Schedule A — Medical expenses (7.5% AGI floor)', () => {
  it('medical below floor → $0 deduction', () => {
    // AGI $100,000, medical $5,000. Floor = $7,500. Below floor.
    const model = makeItemized({ medical: cents(5000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line1.amount).toBe(cents(5000))
    expect(result.line3.amount).toBe(cents(7500))   // 7.5% of $100K
    expect(result.line4.amount).toBe(0)
  })

  it('medical above floor → excess is deductible', () => {
    // AGI $100,000, medical $10,000. Floor = $7,500. Deduction = $2,500.
    const model = makeItemized({ medical: cents(10000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line4.amount).toBe(cents(2500))
  })

  it('medical exactly at floor → $0 deduction', () => {
    // AGI $100,000, medical $7,500. Floor = $7,500. Deduction = $0.
    const model = makeItemized({ medical: cents(7500) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line4.amount).toBe(0)
  })

  it('zero medical expenses → $0 deduction', () => {
    const model = makeItemized({})
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line1.amount).toBe(0)
    expect(result.line4.amount).toBe(0)
  })

  it('zero AGI → full medical is deductible', () => {
    // AGI $0, medical $5,000. Floor = $0. Deduction = $5,000.
    const model = makeItemized({ medical: cents(5000) })
    const result = computeScheduleA(model, 0, 0)

    expect(result.line3.amount).toBe(0)
    expect(result.line4.amount).toBe(cents(5000))
  })
})

// ── SALT cap tests (OBBBA §70120: $40K base, phase-out above $500K) ──

describe('Schedule A — SALT cap', () => {
  it('SALT under $40K cap → passes through (MAGI below threshold)', () => {
    const model = makeItemized({ salt: cents(25000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line5e.amount).toBe(cents(25000))
    expect(result.line7.amount).toBe(cents(25000))
  })

  it('SALT at $40K cap → capped', () => {
    const model = makeItemized({ salt: cents(50000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line5e.amount).toBe(cents(50000))  // raw preserved
    expect(result.line7.amount).toBe(cents(40000))    // capped at $40K
  })

  it('SALT over $40K cap → capped at $40,000', () => {
    const model = makeItemized({ salt: cents(60000) })
    const result = computeScheduleA(model, cents(400000), 0)

    expect(result.line5e.amount).toBe(cents(60000))
    expect(result.line7.amount).toBe(cents(40000))
  })

  it('MFS base cap → $20,000', () => {
    const model = makeItemized({ filingStatus: 'mfs', salt: cents(25000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line7.amount).toBe(cents(20000))
  })

  it('MFS SALT under cap → passes through', () => {
    const model = makeItemized({ filingStatus: 'mfs', salt: cents(15000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line7.amount).toBe(cents(15000))
  })

  it('zero SALT → $0', () => {
    const model = makeItemized({})
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line5e.amount).toBe(0)
    expect(result.line7.amount).toBe(0)
  })

  it('income tax > sales tax → uses income tax (line5a)', () => {
    const model = makeItemized({ saltIncome: cents(8000), saltSales: cents(5000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line5a.amount).toBe(cents(8000))
    expect(result.line5e.amount).toBe(cents(8000))
  })

  it('sales tax > income tax → uses sales tax (line5a)', () => {
    const model = makeItemized({ saltIncome: cents(3000), saltSales: cents(6500) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line5a.amount).toBe(cents(6500))
    expect(result.line5e.amount).toBe(cents(6500))
  })

  it('real estate + personal property taxes added to line5e', () => {
    // income = $5K, real estate = $8K, personal property = $2K → line5e = $15K
    const model = makeItemized({
      saltIncome: cents(5000),
      saltRealEstate: cents(8000),
      saltPersonal: cents(2000),
    })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line5a.amount).toBe(cents(5000))
    expect(result.line5b.amount).toBe(cents(8000))
    expect(result.line5c.amount).toBe(cents(2000))
    expect(result.line5e.amount).toBe(cents(15000))
    expect(result.line7.amount).toBe(cents(15000))  // under $40K cap
  })
})

// ── SALT phase-out tests ────────────────────────────────────────

describe('Schedule A — SALT phase-out (MAGI > $500K)', () => {
  it('MAGI at threshold → full $40K cap', () => {
    expect(computeSaltCap('single', cents(500000))).toBe(cents(40000))
  })

  it('MAGI $50K over threshold → cap reduced by 30% of $50K = $15K → $25K', () => {
    // $40,000 - 0.30 * $50,000 = $40,000 - $15,000 = $25,000
    expect(computeSaltCap('single', cents(550000))).toBe(cents(25000))
  })

  it('MAGI $100K over threshold → cap reduced to floor $10K', () => {
    // $40,000 - 0.30 * $100,000 = $40,000 - $30,000 = $10,000 (= floor)
    expect(computeSaltCap('single', cents(600000))).toBe(cents(10000))
  })

  it('MAGI way above threshold → floor at $10K', () => {
    // Reduction would go below floor, but floor applies
    expect(computeSaltCap('single', cents(1000000))).toBe(cents(10000))
  })

  it('MFS phase-out: MAGI $250K threshold', () => {
    expect(computeSaltCap('mfs', cents(250000))).toBe(cents(20000))
  })

  it('MFS phase-out: MAGI $50K over threshold → $5K floor', () => {
    // $20,000 - 0.30 * $50,000 = $20,000 - $15,000 = $5,000 (= floor)
    expect(computeSaltCap('mfs', cents(300000))).toBe(cents(5000))
  })

  it('MFS phase-out: MAGI way above → floor at $5K', () => {
    expect(computeSaltCap('mfs', cents(500000))).toBe(cents(5000))
  })

  it('phase-out applies to SALT deduction in full computation', () => {
    // Single, MAGI $550K, SALT $30K
    // Effective cap = $25K, so deduction = min($30K, $25K) = $25K
    const model = makeItemized({ salt: cents(30000) })
    const result = computeScheduleA(model, cents(550000), 0)

    expect(result.line7.amount).toBe(cents(25000))
  })

  it('SALT below phased-out cap → passes through', () => {
    // Single, MAGI $550K, SALT $20K, effective cap = $25K
    // $20K < $25K → passes through
    const model = makeItemized({ salt: cents(20000) })
    const result = computeScheduleA(model, cents(550000), 0)

    expect(result.line7.amount).toBe(cents(20000))
  })
})

// ── Mortgage interest cap tests ─────────────────────────────────

describe('Schedule A — Mortgage interest cap (IRC §163(h)(3))', () => {
  it('post-TCJA $750K limit: loan $1M → only 75% of interest deductible', () => {
    // Loan $1M > $750K limit → deductible = $10K × 750K/1M = $7,500
    const model = makeItemized({
      mortgage: cents(10000),
      mortgagePrincipal: cents(1_000_000),
      mortgagePreTCJA: false,
    })
    const result = computeScheduleA(model, cents(200000), 0)

    expect(result.line8a.amount).toBe(cents(7500))
  })

  it('pre-TCJA $1M limit: loan $1.5M → only 2/3 of interest deductible', () => {
    // Loan $1.5M > $1M limit → deductible = $15K × 1M/1.5M = $10,000
    const model = makeItemized({
      mortgage: cents(15000),
      mortgagePrincipal: cents(1_500_000),
      mortgagePreTCJA: true,
    })
    const result = computeScheduleA(model, cents(200000), 0)

    expect(result.line8a.amount).toBe(cents(10000))
  })

  it('MFS filing status: post-TCJA $375K limit', () => {
    // MFS post-TCJA limit = $375K. Loan $500K > $375K.
    // Deductible = $10K × 375K/500K = $7,500
    const model = makeItemized({
      filingStatus: 'mfs',
      mortgage: cents(10000),
      mortgagePrincipal: cents(500_000),
      mortgagePreTCJA: false,
    })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line8a.amount).toBe(cents(7500))
  })

  it('loan balance ≤ limit → full interest deductible', () => {
    // Loan $500K < $750K limit → full $8K deductible
    const model = makeItemized({
      mortgage: cents(8000),
      mortgagePrincipal: cents(500_000),
      mortgagePreTCJA: false,
    })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line8a.amount).toBe(cents(8000))
  })

  it('principal = 0 (not filled) → full interest passes through', () => {
    // User did not enter loan balance → assume within limits
    const model = makeItemized({
      mortgage: cents(12000),
      mortgagePrincipal: 0,
    })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line8a.amount).toBe(cents(12000))
  })

  it('pre-TCJA MFS $500K limit: loan $800K → deductible proportional', () => {
    // MFS pre-TCJA limit = $500K. Loan $800K.
    // Deductible = $16K × 500K/800K = $10,000
    const model = makeItemized({
      filingStatus: 'mfs',
      mortgage: cents(16000),
      mortgagePrincipal: cents(800_000),
      mortgagePreTCJA: true,
    })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line8a.amount).toBe(cents(10000))
  })
})

// ── Investment interest tests ───────────────────────────────────

describe('Schedule A — Investment interest (IRC §163(d))', () => {
  it('investment interest ≤ net investment income → fully deductible', () => {
    // NII = $5K, investment interest = $3K → deductible = $3K
    const model = makeItemized({ investmentInterest: cents(3000) })
    const result = computeScheduleA(model, cents(100000), cents(5000))

    expect(result.line9.amount).toBe(cents(3000))
  })

  it('investment interest > net investment income → capped at NII', () => {
    // NII = $2K, investment interest = $5K → deductible = $2K
    const model = makeItemized({ investmentInterest: cents(5000) })
    const result = computeScheduleA(model, cents(100000), cents(2000))

    expect(result.line9.amount).toBe(cents(2000))
  })

  it('zero net investment income → investment interest not deductible', () => {
    // NII = $0, investment interest = $10K → deductible = $0
    const model = makeItemized({ investmentInterest: cents(10000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line9.amount).toBe(0)
  })

  it('line10 = line8a + line9', () => {
    // Mortgage $8K + investment interest $3K (NII $5K) → line10 = $11K
    const model = makeItemized({
      mortgage: cents(8000),
      investmentInterest: cents(3000),
    })
    const result = computeScheduleA(model, cents(100000), cents(5000))

    expect(result.line8a.amount).toBe(cents(8000))
    expect(result.line9.amount).toBe(cents(3000))
    expect(result.line10.amount).toBe(cents(11000))
  })
})

// ── Charitable AGI limit tests ──────────────────────────────────

describe('Schedule A — Charitable contributions (IRC §170(b))', () => {
  it('cash within 60% AGI limit → passes through', () => {
    // AGI $100K, 60% = $60K. Cash $20K < $60K → $20K deductible
    const model = makeItemized({ charitableCash: cents(20000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line11.amount).toBe(cents(20000))
  })

  it('cash exceeds 60% AGI → capped at 60%', () => {
    // AGI $50K, 60% = $30K. Cash $40K > $30K → $30K deductible
    const model = makeItemized({ charitableCash: cents(40000) })
    const result = computeScheduleA(model, cents(50000), 0)

    expect(result.line11.amount).toBe(cents(30000))
  })

  it('noncash within 30% AGI limit → passes through', () => {
    // AGI $100K, 30% = $30K. Noncash $10K < $30K → $10K deductible
    const model = makeItemized({ charitableNoncash: cents(10000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line12.amount).toBe(cents(10000))
  })

  it('noncash exceeds 30% AGI → capped at 30%', () => {
    // AGI $40K, 30% = $12K. Noncash $20K > $12K → $12K deductible
    const model = makeItemized({ charitableNoncash: cents(20000) })
    const result = computeScheduleA(model, cents(40000), 0)

    expect(result.line12.amount).toBe(cents(12000))
  })

  it('combined charitable > 60% AGI → overall cap applies', () => {
    // AGI $100K. Cash $50K (below 60%=$60K) + Noncash $20K (below 30%=$30K) = $70K total.
    // Overall 60% cap = $60K → line14 = $60K
    const model = makeItemized({ charitableCash: cents(50000), charitableNoncash: cents(20000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line11.amount).toBe(cents(50000))  // cash: min(50K, 60K) = 50K
    expect(result.line12.amount).toBe(cents(20000))  // noncash: min(20K, 30K) = 20K
    expect(result.line14.amount).toBe(cents(60000))  // total: min(70K, 60K) = 60K
  })

  it('zero charitable → $0 all lines', () => {
    const model = makeItemized({})
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line11.amount).toBe(0)
    expect(result.line12.amount).toBe(0)
    expect(result.line14.amount).toBe(0)
  })
})

// ── Pass-through tests ──────────────────────────────────────────

describe('Schedule A — Other pass-through', () => {
  it('mortgage interest passes through (no principal → no cap)', () => {
    const model = makeItemized({ mortgage: cents(12000) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line8a.amount).toBe(cents(12000))
    expect(result.line10.amount).toBe(cents(12000))
  })

  it('other deductions pass through', () => {
    const model = makeItemized({ other: cents(500) })
    const result = computeScheduleA(model, cents(100000), 0)

    expect(result.line16.amount).toBe(cents(500))
  })
})

// ── Rounding edge case ──────────────────────────────────────────

describe('Schedule A — Rounding', () => {
  it('7.5% floor rounds correctly for odd AGI', () => {
    // AGI = $33,333 → 7.5% = $2,499.975 → rounds to $2,500.00 (250000 cents)
    const model = makeItemized({ medical: cents(3000) })
    const result = computeScheduleA(model, cents(33333), 0)

    // $33,333 in cents = 3333300
    // 3333300 * 0.075 = 249997.5 → rounds to 249998
    expect(result.line3.amount).toBe(249998)
    // Medical deduction = 300000 - 249998 = 50002
    expect(result.line4.amount).toBe(50002)
  })

  it('7.5% floor rounds correctly for AGI of 1 cent', () => {
    // AGI = $0.01 = 1 cent → 7.5% = 0.075 → rounds to 0
    const model = makeItemized({ medical: cents(100) })
    const result = computeScheduleA(model, 1, 0)

    expect(result.line3.amount).toBe(0)
    expect(result.line4.amount).toBe(cents(100))
  })
})

// ── Full realistic scenario ─────────────────────────────────────

describe('Schedule A — Full realistic scenario', () => {
  it('computes all lines correctly (MAGI below phase-out)', () => {
    // AGI $150,000 (below $500K threshold, so $40K SALT cap applies).
    // Medical $15,000, SALT income $18,000, mortgage $12,000, charitable $5,000.
    const model = makeItemized({
      medical: cents(15000),
      saltIncome: cents(18000),
      mortgage: cents(12000),
      charitableCash: cents(4000),
      charitableNoncash: cents(1000),
    })
    const agi = cents(150000)
    const result = computeScheduleA(model, agi, 0)

    // Medical: floor = $150,000 × 7.5% = $11,250. Deduction = $15,000 - $11,250 = $3,750.
    expect(result.line1.amount).toBe(cents(15000))
    expect(result.line3.amount).toBe(cents(11250))
    expect(result.line4.amount).toBe(cents(3750))

    // SALT: income $18K > sales $0 → line5a = $18K. No real estate or personal. line5e = $18K.
    // $18K < $40K cap → line7 = $18K
    expect(result.line5a.amount).toBe(cents(18000))
    expect(result.line5e.amount).toBe(cents(18000))
    expect(result.line7.amount).toBe(cents(18000))

    // Mortgage: $12K, no principal → pass-through. line8a = $12K
    expect(result.line8a.amount).toBe(cents(12000))
    // Investment interest: $0
    expect(result.line9.amount).toBe(0)
    // line10 = $12K + $0 = $12K
    expect(result.line10.amount).toBe(cents(12000))

    // Charitable: cash $4K (< 60% × $150K = $90K) + noncash $1K (< 30% × $150K = $45K)
    // Total $5K < $90K overall cap → line14 = $5K
    expect(result.line11.amount).toBe(cents(4000))
    expect(result.line12.amount).toBe(cents(1000))
    expect(result.line14.amount).toBe(cents(5000))

    // Other: $0
    expect(result.line16.amount).toBe(0)

    // Total: $3,750 + $18,000 + $12,000 + $5,000 = $38,750
    expect(result.line17.amount).toBe(cents(38750))
  })
})

// ── IRS citations ───────────────────────────────────────────────

describe('Schedule A — IRS citations', () => {
  it('all lines have correct citations', () => {
    const model = makeItemized({ medical: cents(1000), saltIncome: cents(1000) })
    const result = computeScheduleA(model, cents(50000), 0)

    expect(result.line1.irsCitation).toBe('Schedule A, Line 1')
    expect(result.line2.irsCitation).toBe('Schedule A, Line 2')
    expect(result.line3.irsCitation).toBe('Schedule A, Line 3')
    expect(result.line4.irsCitation).toBe('Schedule A, Line 4')
    expect(result.line5a.irsCitation).toBe('Schedule A, Line 5a')
    expect(result.line5b.irsCitation).toBe('Schedule A, Line 5b')
    expect(result.line5c.irsCitation).toBe('Schedule A, Line 5c')
    expect(result.line5e.irsCitation).toBe('Schedule A, Line 5e')
    expect(result.line7.irsCitation).toBe('Schedule A, Line 7')
    expect(result.line8a.irsCitation).toBe('Schedule A, Line 8a')
    expect(result.line9.irsCitation).toBe('Schedule A, Line 9')
    expect(result.line10.irsCitation).toBe('Schedule A, Line 10')
    expect(result.line11.irsCitation).toBe('Schedule A, Line 11')
    expect(result.line12.irsCitation).toBe('Schedule A, Line 12')
    expect(result.line14.irsCitation).toBe('Schedule A, Line 14')
    expect(result.line16.irsCitation).toBe('Schedule A, Line 16')
    expect(result.line17.irsCitation).toBe('Schedule A, Line 17')
  })

  it('line2 traces to Form 1040 Line 11 (AGI)', () => {
    const model = makeItemized({})
    const result = computeScheduleA(model, cents(50000), 0)

    expect(result.line2.source.kind).toBe('computed')
    if (result.line2.source.kind === 'computed') {
      expect(result.line2.source.inputs).toContain('form1040.line11')
    }
  })
})

// ── Integration: computeForm1040 ────────────────────────────────

describe('Integration — Schedule A through computeForm1040', () => {
  it('picks itemized ($38,750) over standard ($15,000) for realistic scenario', () => {
    const model = itemizedDeductionReturn()
    const result = computeForm1040(model)

    // Line 12 should use itemized total
    // Medical $3,750 + SALT $18,000 (under $40K cap) + mortgage $12,000 + charitable $5,000 = $38,750
    expect(result.line12.amount).toBe(cents(38750))

    // Schedule A should be attached
    expect(result.scheduleA).not.toBeNull()
    expect(result.scheduleA!.line17.amount).toBe(cents(38750))
  })

  it('computes correct taxable income with Schedule A', () => {
    const model = itemizedDeductionReturn()
    const result = computeForm1040(model)

    // AGI = $150,000. Deduction = $38,750. Taxable = $111,250.
    expect(result.line11.amount).toBe(cents(150000))
    expect(result.line15.amount).toBe(cents(111250))
  })

  it('falls back to standard for small itemized amounts', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [{
        id: 'w2-1',
        employerEin: '00-0000000',
        employerName: 'Test Corp',
        box1: cents(75000),
        box2: cents(8000),
        box3: cents(75000),
        box4: 0,
        box5: cents(75000),
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
      }],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: cents(2000),   // way below 7.5% floor
          stateLocalIncomeTaxes: cents(3000),
          stateLocalSalesTaxes: 0,
          realEstateTaxes: 0,
          personalPropertyTaxes: 0,
          mortgageInterest: cents(2000),
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: 0,
          charitableCash: cents(500),
          charitableNoncash: 0,
          otherDeductions: 0,
        },
      },
    }
    const result = computeForm1040(model)

    // Medical floor: $75,000 × 7.5% = $5,625 > $2,000 → medical deduction = $0
    // Schedule A total: $0 + $3,000 + $2,000 + $500 = $5,500
    // Standard: $15,000 → use standard
    expect(result.line12.amount).toBe(STANDARD_DEDUCTION.single)
    // Schedule A still computed for display
    expect(result.scheduleA).not.toBeNull()
    expect(result.scheduleA!.line17.amount).toBe(cents(5500))
  })

  it('returns null scheduleA when standard deduction method', () => {
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [{
        id: 'w2-1',
        employerEin: '00-0000000',
        employerName: 'Test Corp',
        box1: cents(75000),
        box2: cents(8000),
        box3: cents(75000),
        box4: 0,
        box5: cents(75000),
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
      }],
    }
    const result = computeForm1040(model)

    expect(result.scheduleA).toBeNull()
  })

  it('investment interest limited to net investment income from engine', () => {
    // Return with: $5K taxable interest (NII), $10K investment interest expense
    // NII = $5K → only $5K of investment interest deductible
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [{
        id: 'w2-1',
        employerEin: '00-0000000',
        employerName: 'Test Corp',
        box1: cents(100000),
        box2: cents(15000),
        box3: cents(100000),
        box4: 0,
        box5: cents(100000),
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
      }],
      form1099INTs: [{
        id: 'int-1',
        payerName: 'Brokerage',
        box1: cents(5000),   // $5K taxable interest = NII
        box2: 0,
        box3: 0,
        box4: 0,
        box8: 0,
      }],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: 0,
          personalPropertyTaxes: 0,
          mortgageInterest: 0,
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: cents(10000),  // $10K expense, limited to $5K NII
          charitableCash: 0,
          charitableNoncash: 0,
          otherDeductions: 0,
        },
      },
    }
    const result = computeForm1040(model)

    expect(result.scheduleA).not.toBeNull()
    expect(result.scheduleA!.line9.amount).toBe(cents(5000))   // limited to NII
    expect(result.scheduleA!.line10.amount).toBe(cents(5000))  // = line8a(0) + line9(5K)
  })

  it('net investment income includes ST gains from Schedule D', () => {
    // $2K taxable interest + $3K ST gain = $5K NII
    // Investment interest $4K → fully deductible (< $5K NII)
    const model: TaxReturn = {
      ...emptyTaxReturn(2025),
      w2s: [{
        id: 'w2-1',
        employerEin: '00-0000000',
        employerName: 'Test Corp',
        box1: cents(80000),
        box2: cents(10000),
        box3: cents(80000),
        box4: 0,
        box5: cents(80000),
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
      }],
      form1099INTs: [{
        id: 'int-1',
        payerName: 'Bank',
        box1: cents(2000),  // $2K taxable interest
        box2: 0,
        box3: 0,
        box4: 0,
        box8: 0,
      }],
      capitalTransactions: [{
        id: 'tx-1',
        description: 'AAPL',
        dateAcquired: '2025-01-01',
        dateSold: '2025-06-01',
        proceeds: cents(10000),
        reportedBasis: cents(7000),
        adjustedBasis: cents(7000),
        adjustmentCode: null,
        adjustmentAmount: 0,
        gainLoss: cents(3000),  // $3K ST gain
        washSaleLossDisallowed: 0,
        longTerm: false,
        category: 'A',
        source1099BId: '1099b-tx-1',
      }],
      deductions: {
        method: 'itemized',
        itemized: {
          medicalExpenses: 0,
          stateLocalIncomeTaxes: 0,
          stateLocalSalesTaxes: 0,
          realEstateTaxes: 0,
          personalPropertyTaxes: 0,
          mortgageInterest: 0,
          mortgagePrincipal: 0,
          mortgagePreTCJA: false,
          investmentInterest: cents(4000),  // $4K expense, NII = $5K → fully deductible
          charitableCash: 0,
          charitableNoncash: 0,
          otherDeductions: 0,
        },
      },
    }
    const result = computeForm1040(model)

    expect(result.scheduleA).not.toBeNull()
    expect(result.scheduleA!.line9.amount).toBe(cents(4000))  // fully deductible (NII $5K > $4K)
  })
})
