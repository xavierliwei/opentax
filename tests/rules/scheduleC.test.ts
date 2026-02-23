/**
 * Schedule C Tests — Profit or Loss From Business
 *
 * Tests the Schedule C computation for sole proprietorship businesses.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { computeScheduleC, computeAllScheduleC } from '../../src/rules/2025/scheduleC'
import type { ScheduleC } from '../../src/model/types'

// ── Helper: create a basic Schedule C business ────────────────

function makeScheduleC(overrides: Partial<ScheduleC> & { id: string }): ScheduleC {
  return {
    businessName: 'Test Business',
    principalBusinessCode: '541511',
    accountingMethod: 'cash',
    grossReceipts: 0,
    returns: 0,
    costOfGoodsSold: 0,
    advertising: 0,
    carAndTruck: 0,
    commissions: 0,
    contractLabor: 0,
    depreciation: 0,
    insurance: 0,
    mortgageInterest: 0,
    otherInterest: 0,
    legal: 0,
    officeExpense: 0,
    rent: 0,
    repairs: 0,
    supplies: 0,
    taxes: 0,
    travel: 0,
    meals: 0,
    utilities: 0,
    wages: 0,
    otherExpenses: 0,
    ...overrides,
  }
}

describe('computeScheduleC', () => {
  it('computes net profit for a simple freelance business', () => {
    const biz = makeScheduleC({
      id: 'biz-1',
      businessName: 'Freelance Consulting',
      grossReceipts: cents(120000),  // $120,000
      insurance: cents(3000),
      officeExpense: cents(2000),
      supplies: cents(1000),
      utilities: cents(1200),
    })
    const result = computeScheduleC(biz)

    expect(result.line1.amount).toBe(cents(120000))
    expect(result.line3.amount).toBe(cents(120000))  // no returns or COGS
    expect(result.line7.amount).toBe(cents(120000))
    expect(result.totalExpenses).toBe(cents(7200))
    expect(result.line28.amount).toBe(cents(7200))
    expect(result.line31.amount).toBe(cents(112800))  // $120K - $7,200 = $112,800
  })

  it('handles returns and COGS', () => {
    const biz = makeScheduleC({
      id: 'biz-2',
      businessName: 'Online Store',
      grossReceipts: cents(200000),
      returns: cents(5000),
      costOfGoodsSold: cents(80000),
      advertising: cents(10000),
      wages: cents(30000),
    })
    const result = computeScheduleC(biz)

    // Gross profit = $200K - $5K - $80K = $115K
    expect(result.line3.amount).toBe(cents(115000))
    // Total expenses = $10K + $30K = $40K
    expect(result.totalExpenses).toBe(cents(40000))
    // Net profit = $115K - $40K = $75K
    expect(result.line31.amount).toBe(cents(75000))
  })

  it('computes net loss when expenses exceed income', () => {
    const biz = makeScheduleC({
      id: 'biz-3',
      businessName: 'Startup',
      grossReceipts: cents(30000),
      rent: cents(24000),
      supplies: cents(5000),
      utilities: cents(6000),
      insurance: cents(3000),
    })
    const result = computeScheduleC(biz)

    // Net loss = $30K - $38K = -$8K
    expect(result.line31.amount).toBe(cents(-8000))
  })

  it('applies 50% meals deduction', () => {
    const biz = makeScheduleC({
      id: 'biz-4',
      businessName: 'Sales Rep',
      grossReceipts: cents(100000),
      meals: cents(10000),  // $10K meals → $5K deductible
      travel: cents(5000),
    })
    const result = computeScheduleC(biz)

    // Meals deductible = $10K × 50% = $5K
    // Total expenses = $5K (meals) + $5K (travel) = $10K
    expect(result.totalExpenses).toBe(cents(10000))
    expect(result.line31.amount).toBe(cents(90000))
  })

  it('handles zero income', () => {
    const biz = makeScheduleC({
      id: 'biz-5',
      businessName: 'New Business',
      grossReceipts: 0,
      supplies: cents(2000),
    })
    const result = computeScheduleC(biz)

    expect(result.line7.amount).toBe(0)
    expect(result.line31.amount).toBe(cents(-2000))
  })

  it('emits warnings for unsupported features', () => {
    const biz = makeScheduleC({
      id: 'biz-6',
      businessName: 'Complex Business',
      grossReceipts: cents(100000),
      hasInventory: true,
      hasHomeOffice: true,
      hasVehicleExpenses: true,
    })
    const result = computeScheduleC(biz)

    expect(result.warnings.length).toBe(3)
    expect(result.warnings[0]).toContain('Cost of Goods Sold')
    expect(result.warnings[1]).toContain('Home office')
    expect(result.warnings[2]).toContain('Vehicle')
  })

  it('emits no warnings for simple business', () => {
    const biz = makeScheduleC({
      id: 'biz-7',
      businessName: 'Simple',
      grossReceipts: cents(50000),
    })
    const result = computeScheduleC(biz)
    expect(result.warnings.length).toBe(0)
  })
})

describe('computeAllScheduleC', () => {
  it('returns zero aggregate for no businesses', () => {
    const result = computeAllScheduleC([])
    expect(result.businesses.length).toBe(0)
    expect(result.totalNetProfitCents).toBe(0)
    expect(result.totalNetProfit.amount).toBe(0)
  })

  it('aggregates profit from multiple businesses', () => {
    const result = computeAllScheduleC([
      makeScheduleC({
        id: 'biz-a',
        businessName: 'Consulting',
        grossReceipts: cents(80000),
        supplies: cents(5000),
      }),
      makeScheduleC({
        id: 'biz-b',
        businessName: 'Tutoring',
        grossReceipts: cents(20000),
        supplies: cents(2000),
      }),
    ])

    expect(result.businesses.length).toBe(2)
    // Business A: $80K - $5K = $75K
    // Business B: $20K - $2K = $18K
    // Total: $93K
    expect(result.totalNetProfitCents).toBe(cents(93000))
    expect(result.totalNetProfit.amount).toBe(cents(93000))
  })

  it('aggregates profit and loss across businesses', () => {
    const result = computeAllScheduleC([
      makeScheduleC({
        id: 'biz-profit',
        businessName: 'Profitable',
        grossReceipts: cents(100000),
        supplies: cents(10000),
      }),
      makeScheduleC({
        id: 'biz-loss',
        businessName: 'Loss Maker',
        grossReceipts: cents(5000),
        rent: cents(20000),
      }),
    ])

    // Profitable: $90K
    // Loss: -$15K
    // Net: $75K
    expect(result.totalNetProfitCents).toBe(cents(75000))
  })

  it('handles all businesses at loss', () => {
    const result = computeAllScheduleC([
      makeScheduleC({
        id: 'biz-x',
        businessName: 'Loss A',
        grossReceipts: cents(5000),
        rent: cents(10000),
      }),
      makeScheduleC({
        id: 'biz-y',
        businessName: 'Loss B',
        grossReceipts: cents(3000),
        supplies: cents(8000),
      }),
    ])

    // Loss A: -$5K, Loss B: -$5K, Total: -$10K
    expect(result.totalNetProfitCents).toBe(cents(-10000))
  })

  it('computes all expense categories', () => {
    const biz = makeScheduleC({
      id: 'biz-full',
      businessName: 'Full Expense Test',
      grossReceipts: cents(200000),
      advertising: cents(1000),
      carAndTruck: cents(2000),
      commissions: cents(3000),
      contractLabor: cents(4000),
      depreciation: cents(5000),
      insurance: cents(6000),
      mortgageInterest: cents(1000),
      otherInterest: cents(500),
      legal: cents(2000),
      officeExpense: cents(1500),
      rent: cents(12000),
      repairs: cents(3000),
      supplies: cents(2000),
      taxes: cents(1000),
      travel: cents(5000),
      meals: cents(8000),   // 50% = $4K
      utilities: cents(3000),
      wages: cents(40000),
      otherExpenses: cents(1000),
    })
    const result = computeScheduleC(biz)

    // Total = $1K+$2K+$3K+$4K+$5K+$6K+$1K+$0.5K+$2K+$1.5K+$12K+$3K+$2K+$1K+$5K+$4K(meals)+$3K+$40K+$1K = $97K
    const expectedExpenses = cents(97000)
    expect(result.totalExpenses).toBe(expectedExpenses)
    expect(result.line31.amount).toBe(cents(200000) - expectedExpenses)
  })
})
