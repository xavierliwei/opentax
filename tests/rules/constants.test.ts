import { describe, it, expect } from 'vitest'
import {
  STANDARD_DEDUCTION,
  INCOME_TAX_BRACKETS,
  LTCG_BRACKETS,
  CAPITAL_LOSS_LIMIT,
  SCHEDULE_B_THRESHOLD,
  SS_WAGE_BASE,
  SS_TAX_RATE,
  MEDICARE_TAX_RATE,
  ADDITIONAL_MEDICARE_RATE,
  ADDITIONAL_MEDICARE_THRESHOLD,
  NIIT_RATE,
  NIIT_THRESHOLD,
  TAX_YEAR,
} from '../../src/rules/2025/constants'
import type { FilingStatus } from '../../src/model/types'
import { cents } from '../../src/model/traced'

const ALL_STATUSES: FilingStatus[] = ['single', 'mfj', 'mfs', 'hoh', 'qw']

// ── Spot checks against IRS Rev. Proc. 2024-40 ────────────────

describe('standard deduction (Rev. Proc. 2024-40 §3.01)', () => {
  it('single = $15,000', () => {
    expect(STANDARD_DEDUCTION.single).toBe(cents(15000))
  })

  it('married filing jointly = $30,000', () => {
    expect(STANDARD_DEDUCTION.mfj).toBe(cents(30000))
  })

  it('married filing separately = $15,000', () => {
    expect(STANDARD_DEDUCTION.mfs).toBe(cents(15000))
  })

  it('head of household = $22,500', () => {
    expect(STANDARD_DEDUCTION.hoh).toBe(cents(22500))
  })

  it('qualifying surviving spouse = $30,000 (same as MFJ)', () => {
    expect(STANDARD_DEDUCTION.qw).toBe(cents(30000))
  })

  it('has an entry for every filing status', () => {
    for (const status of ALL_STATUSES) {
      expect(STANDARD_DEDUCTION[status]).toBeGreaterThan(0)
    }
  })
})

describe('income tax brackets — spot checks (IRS.gov)', () => {
  it('single: 7 brackets', () => {
    expect(INCOME_TAX_BRACKETS.single).toHaveLength(7)
  })

  it('single: 10% starts at $0', () => {
    expect(INCOME_TAX_BRACKETS.single[0]).toEqual({ rate: 0.10, floor: cents(0) })
  })

  it('single: 12% starts at $11,925', () => {
    expect(INCOME_TAX_BRACKETS.single[1]).toEqual({ rate: 0.12, floor: cents(11925) })
  })

  it('single: 22% starts at $48,475', () => {
    expect(INCOME_TAX_BRACKETS.single[2]).toEqual({ rate: 0.22, floor: cents(48475) })
  })

  it('single: 37% starts at $626,350', () => {
    expect(INCOME_TAX_BRACKETS.single[6]).toEqual({ rate: 0.37, floor: cents(626350) })
  })

  it('MFJ: 10% starts at $0', () => {
    expect(INCOME_TAX_BRACKETS.mfj[0]).toEqual({ rate: 0.10, floor: cents(0) })
  })

  it('MFJ: 12% starts at $23,850', () => {
    expect(INCOME_TAX_BRACKETS.mfj[1]).toEqual({ rate: 0.12, floor: cents(23850) })
  })

  it('MFJ: 37% starts at $751,600', () => {
    expect(INCOME_TAX_BRACKETS.mfj[6]).toEqual({ rate: 0.37, floor: cents(751600) })
  })

  it('HoH: 10% starts at $0, 12% at $17,000', () => {
    expect(INCOME_TAX_BRACKETS.hoh[0]).toEqual({ rate: 0.10, floor: cents(0) })
    expect(INCOME_TAX_BRACKETS.hoh[1]).toEqual({ rate: 0.12, floor: cents(17000) })
  })

  it('MFS: 35% bracket differs from single (caps at $375,800)', () => {
    expect(INCOME_TAX_BRACKETS.mfs[6]).toEqual({ rate: 0.37, floor: cents(375800) })
  })

  it('QW brackets match MFJ', () => {
    expect(INCOME_TAX_BRACKETS.qw).toEqual(INCOME_TAX_BRACKETS.mfj)
  })
})

describe('LTCG brackets — spot checks (Rev. Proc. 2024-40 §3.03)', () => {
  it('single: 0% up to $48,350, 15% to $533,400, 20% above', () => {
    expect(LTCG_BRACKETS.single).toEqual([
      { rate: 0.00, floor: cents(0) },
      { rate: 0.15, floor: cents(48350) },
      { rate: 0.20, floor: cents(533400) },
    ])
  })

  it('MFJ: 0% up to $96,700, 15% to $600,050, 20% above', () => {
    expect(LTCG_BRACKETS.mfj).toEqual([
      { rate: 0.00, floor: cents(0) },
      { rate: 0.15, floor: cents(96700) },
      { rate: 0.20, floor: cents(600050) },
    ])
  })

  it('HoH: 0% up to $64,750', () => {
    expect(LTCG_BRACKETS.hoh[0]).toEqual({ rate: 0.00, floor: cents(0) })
    expect(LTCG_BRACKETS.hoh[1]).toEqual({ rate: 0.15, floor: cents(64750) })
  })

  it('QW LTCG brackets match MFJ', () => {
    expect(LTCG_BRACKETS.qw).toEqual(LTCG_BRACKETS.mfj)
  })
})

// ── Structural validation ──────────────────────────────────────

describe('bracket structural integrity', () => {
  for (const status of ALL_STATUSES) {
    describe(`income brackets — ${status}`, () => {
      const brackets = INCOME_TAX_BRACKETS[status]

      it('has exactly 7 brackets', () => {
        expect(brackets).toHaveLength(7)
      })

      it('first bracket starts at $0', () => {
        expect(brackets[0].floor).toBe(0)
      })

      it('floors are strictly ascending', () => {
        for (let i = 1; i < brackets.length; i++) {
          expect(brackets[i].floor).toBeGreaterThan(brackets[i - 1].floor)
        }
      })

      it('rates are strictly ascending', () => {
        for (let i = 1; i < brackets.length; i++) {
          expect(brackets[i].rate).toBeGreaterThan(brackets[i - 1].rate)
        }
      })

      it('rates are between 0 and 1', () => {
        for (const b of brackets) {
          expect(b.rate).toBeGreaterThanOrEqual(0)
          expect(b.rate).toBeLessThanOrEqual(1)
        }
      })

      it('floors are positive integers (cents)', () => {
        for (const b of brackets) {
          expect(b.floor).toBeGreaterThanOrEqual(0)
          expect(Number.isInteger(b.floor)).toBe(true)
        }
      })
    })

    describe(`LTCG brackets — ${status}`, () => {
      const brackets = LTCG_BRACKETS[status]

      it('has exactly 3 brackets', () => {
        expect(brackets).toHaveLength(3)
      })

      it('starts at 0% from $0', () => {
        expect(brackets[0]).toEqual({ rate: 0.00, floor: 0 })
      })

      it('floors are strictly ascending', () => {
        for (let i = 1; i < brackets.length; i++) {
          expect(brackets[i].floor).toBeGreaterThan(brackets[i - 1].floor)
        }
      })

      it('rates are strictly ascending', () => {
        for (let i = 1; i < brackets.length; i++) {
          expect(brackets[i].rate).toBeGreaterThan(brackets[i - 1].rate)
        }
      })
    })
  }
})

// ── Other constants ────────────────────────────────────────────

describe('Social Security constants', () => {
  it('wage base = $176,100', () => {
    expect(SS_WAGE_BASE).toBe(cents(176100))
  })

  it('employee tax rate = 6.2%', () => {
    expect(SS_TAX_RATE).toBe(0.062)
  })

  it('Medicare rate = 1.45%', () => {
    expect(MEDICARE_TAX_RATE).toBe(0.0145)
  })

  it('additional Medicare rate = 0.9%', () => {
    expect(ADDITIONAL_MEDICARE_RATE).toBe(0.009)
  })

  it('additional Medicare threshold has entry for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(ADDITIONAL_MEDICARE_THRESHOLD[status]).toBeGreaterThan(0)
    }
  })
})

describe('NIIT constants', () => {
  it('rate = 3.8%', () => {
    expect(NIIT_RATE).toBe(0.038)
  })

  it('threshold has entry for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(NIIT_THRESHOLD[status]).toBeGreaterThan(0)
    }
  })

  it('single threshold = $200,000', () => {
    expect(NIIT_THRESHOLD.single).toBe(cents(200000))
  })

  it('MFJ threshold = $250,000', () => {
    expect(NIIT_THRESHOLD.mfj).toBe(cents(250000))
  })
})

describe('Schedule B threshold', () => {
  it('= $1,500', () => {
    expect(SCHEDULE_B_THRESHOLD).toBe(cents(1500))
  })
})

describe('capital loss limit', () => {
  it('$3,000 for single, MFJ, HoH, QW', () => {
    expect(CAPITAL_LOSS_LIMIT.single).toBe(cents(3000))
    expect(CAPITAL_LOSS_LIMIT.mfj).toBe(cents(3000))
    expect(CAPITAL_LOSS_LIMIT.hoh).toBe(cents(3000))
    expect(CAPITAL_LOSS_LIMIT.qw).toBe(cents(3000))
  })

  it('$1,500 for MFS', () => {
    expect(CAPITAL_LOSS_LIMIT.mfs).toBe(cents(1500))
  })

  it('has entry for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(CAPITAL_LOSS_LIMIT[status]).toBeGreaterThan(0)
    }
  })
})

describe('tax year', () => {
  it('= 2025', () => {
    expect(TAX_YEAR).toBe(2025)
  })
})
