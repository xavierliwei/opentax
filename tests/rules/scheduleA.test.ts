/**
 * Tests for Schedule A — Itemized Deductions
 *
 * Covers:
 * - Medical expense 7.5% AGI floor
 * - SALT $10K cap ($5K for MFS)
 * - Mortgage, charitable, other pass-through
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
  salt?: number
  mortgage?: number
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
        stateLocalTaxes: overrides.salt ?? 0,
        mortgageInterest: overrides.mortgage ?? 0,
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
    const result = computeScheduleA(model, cents(100000))

    expect(result.line1.amount).toBe(cents(5000))
    expect(result.line3.amount).toBe(cents(7500))   // 7.5% of $100K
    expect(result.line4.amount).toBe(0)
  })

  it('medical above floor → excess is deductible', () => {
    // AGI $100,000, medical $10,000. Floor = $7,500. Deduction = $2,500.
    const model = makeItemized({ medical: cents(10000) })
    const result = computeScheduleA(model, cents(100000))

    expect(result.line4.amount).toBe(cents(2500))
  })

  it('medical exactly at floor → $0 deduction', () => {
    // AGI $100,000, medical $7,500. Floor = $7,500. Deduction = $0.
    const model = makeItemized({ medical: cents(7500) })
    const result = computeScheduleA(model, cents(100000))

    expect(result.line4.amount).toBe(0)
  })

  it('zero medical expenses → $0 deduction', () => {
    const model = makeItemized({})
    const result = computeScheduleA(model, cents(100000))

    expect(result.line1.amount).toBe(0)
    expect(result.line4.amount).toBe(0)
  })

  it('zero AGI → full medical is deductible', () => {
    // AGI $0, medical $5,000. Floor = $0. Deduction = $5,000.
    const model = makeItemized({ medical: cents(5000) })
    const result = computeScheduleA(model, 0)

    expect(result.line3.amount).toBe(0)
    expect(result.line4.amount).toBe(cents(5000))
  })
})

// ── SALT cap tests (OBBBA §70120: $40K base, phase-out above $500K) ──

describe('Schedule A — SALT cap', () => {
  it('SALT under $40K cap → passes through (MAGI below threshold)', () => {
    const model = makeItemized({ salt: cents(25000) })
    const result = computeScheduleA(model, cents(100000))

    expect(result.line5e.amount).toBe(cents(25000))
    expect(result.line7.amount).toBe(cents(25000))
  })

  it('SALT at $40K cap → capped', () => {
    const model = makeItemized({ salt: cents(50000) })
    const result = computeScheduleA(model, cents(100000))

    expect(result.line5e.amount).toBe(cents(50000))  // raw preserved
    expect(result.line7.amount).toBe(cents(40000))    // capped at $40K
  })

  it('SALT over $40K cap → capped at $40,000', () => {
    const model = makeItemized({ salt: cents(60000) })
    const result = computeScheduleA(model, cents(400000))

    expect(result.line5e.amount).toBe(cents(60000))
    expect(result.line7.amount).toBe(cents(40000))
  })

  it('MFS base cap → $20,000', () => {
    const model = makeItemized({ filingStatus: 'mfs', salt: cents(25000) })
    const result = computeScheduleA(model, cents(100000))

    expect(result.line7.amount).toBe(cents(20000))
  })

  it('MFS SALT under cap → passes through', () => {
    const model = makeItemized({ filingStatus: 'mfs', salt: cents(15000) })
    const result = computeScheduleA(model, cents(100000))

    expect(result.line7.amount).toBe(cents(15000))
  })

  it('zero SALT → $0', () => {
    const model = makeItemized({})
    const result = computeScheduleA(model, cents(100000))

    expect(result.line5e.amount).toBe(0)
    expect(result.line7.amount).toBe(0)
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
    const result = computeScheduleA(model, cents(550000))

    expect(result.line7.amount).toBe(cents(25000))
  })

  it('SALT below phased-out cap → passes through', () => {
    // Single, MAGI $550K, SALT $20K, effective cap = $25K
    // $20K < $25K → passes through
    const model = makeItemized({ salt: cents(20000) })
    const result = computeScheduleA(model, cents(550000))

    expect(result.line7.amount).toBe(cents(20000))
  })
})

// ── Pass-through tests ──────────────────────────────────────────

describe('Schedule A — Mortgage, charitable, other', () => {
  it('mortgage interest passes through', () => {
    const model = makeItemized({ mortgage: cents(12000) })
    const result = computeScheduleA(model, cents(100000))

    expect(result.line10.amount).toBe(cents(12000))
  })

  it('charitable sums cash + noncash', () => {
    const model = makeItemized({ charitableCash: cents(4000), charitableNoncash: cents(1000) })
    const result = computeScheduleA(model, cents(100000))

    expect(result.line14.amount).toBe(cents(5000))
  })

  it('other deductions pass through', () => {
    const model = makeItemized({ other: cents(500) })
    const result = computeScheduleA(model, cents(100000))

    expect(result.line16.amount).toBe(cents(500))
  })
})

// ── Rounding edge case ──────────────────────────────────────────

describe('Schedule A — Rounding', () => {
  it('7.5% floor rounds correctly for odd AGI', () => {
    // AGI = $33,333 → 7.5% = $2,499.975 → rounds to $2,500.00 (250000 cents)
    const model = makeItemized({ medical: cents(3000) })
    const result = computeScheduleA(model, cents(33333))

    // $33,333 in cents = 3333300
    // 3333300 * 0.075 = 249997.5 → rounds to 249998
    expect(result.line3.amount).toBe(249998)
    // Medical deduction = 300000 - 249998 = 50002
    expect(result.line4.amount).toBe(50002)
  })

  it('7.5% floor rounds correctly for AGI of 1 cent', () => {
    // AGI = $0.01 = 1 cent → 7.5% = 0.075 → rounds to 0
    const model = makeItemized({ medical: cents(100) })
    const result = computeScheduleA(model, 1)

    expect(result.line3.amount).toBe(0)
    expect(result.line4.amount).toBe(cents(100))
  })
})

// ── Full realistic scenario ─────────────────────────────────────

describe('Schedule A — Full realistic scenario', () => {
  it('computes all lines correctly (MAGI below phase-out)', () => {
    // AGI $150,000 (below $500K threshold, so $40K SALT cap applies).
    // Medical $15,000, SALT $18,000, mortgage $12,000, charitable $5,000.
    const model = makeItemized({
      medical: cents(15000),
      salt: cents(18000),
      mortgage: cents(12000),
      charitableCash: cents(4000),
      charitableNoncash: cents(1000),
    })
    const agi = cents(150000)
    const result = computeScheduleA(model, agi)

    // Medical: floor = $150,000 × 7.5% = $11,250. Deduction = $15,000 - $11,250 = $3,750.
    expect(result.line1.amount).toBe(cents(15000))
    expect(result.line3.amount).toBe(cents(11250))
    expect(result.line4.amount).toBe(cents(3750))

    // SALT: $18,000 < $40,000 cap → passes through fully
    expect(result.line5e.amount).toBe(cents(18000))
    expect(result.line7.amount).toBe(cents(18000))

    // Mortgage: $12,000
    expect(result.line10.amount).toBe(cents(12000))

    // Charitable: $4,000 + $1,000 = $5,000
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
    const model = makeItemized({ medical: cents(1000), salt: cents(1000) })
    const result = computeScheduleA(model, cents(50000))

    expect(result.line1.irsCitation).toBe('Schedule A, Line 1')
    expect(result.line2.irsCitation).toBe('Schedule A, Line 2')
    expect(result.line3.irsCitation).toBe('Schedule A, Line 3')
    expect(result.line4.irsCitation).toBe('Schedule A, Line 4')
    expect(result.line5e.irsCitation).toBe('Schedule A, Line 5e')
    expect(result.line7.irsCitation).toBe('Schedule A, Line 7')
    expect(result.line10.irsCitation).toBe('Schedule A, Line 10')
    expect(result.line14.irsCitation).toBe('Schedule A, Line 14')
    expect(result.line16.irsCitation).toBe('Schedule A, Line 16')
    expect(result.line17.irsCitation).toBe('Schedule A, Line 17')
  })

  it('line2 traces to Form 1040 Line 11 (AGI)', () => {
    const model = makeItemized({})
    const result = computeScheduleA(model, cents(50000))

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
          stateLocalTaxes: cents(3000),
          mortgageInterest: cents(2000),
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
})
