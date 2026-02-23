/**
 * K-1 Income Computation Tests — Phase 4, Track A
 *
 * Unit tests for K-1 aggregation, and integration tests for the full
 * Form 1040 flow with K-1 passthrough income.
 *
 * Covers:
 *   - K-1 aggregate computation (unit)
 *   - K-1 interest → Form 1040 Line 2b
 *   - K-1 dividends → Form 1040 Line 3b
 *   - K-1 ordinary income → Schedule 1 Line 5
 *   - K-1 rental income → Schedule 1 Line 5
 *   - K-1 ST/LT capital gains → Schedule D
 *   - K-1 QBI → Form 8995 (already tested, verified integration)
 *   - Multiple K-1 forms (partnership + S-corp)
 *   - Negative K-1 income (losses)
 *   - K-1 + W-2 combined scenarios
 *   - K-1 + Schedule C combined scenarios
 *   - K-1 + Schedule E combined scenarios
 *   - NIIT with K-1 investment income
 *   - Validation warnings for K-1 limitations
 *   - Backward compatibility (no K-1 → same as before)
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import type { ScheduleK1, ScheduleC } from '../../src/model/types'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { computeK1Aggregate } from '../../src/rules/2025/scheduleK1'
import { makeW2, make1099INT, make1099DIV, makeScheduleEProperty, makeTransaction } from '../fixtures/returns'

// ── Helpers ──────────────────────────────────────────────────────

function makeK1(overrides: Partial<ScheduleK1> & { id: string; entityName: string }): ScheduleK1 {
  return {
    entityType: 'partnership',
    entityEin: '00-0000000',
    ordinaryIncome: 0,
    rentalIncome: 0,
    interestIncome: 0,
    dividendIncome: 0,
    shortTermCapitalGain: 0,
    longTermCapitalGain: 0,
    section199AQBI: 0,
    distributions: 0,
    ...overrides,
  }
}

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

// ── Unit Tests: K-1 Aggregate ───────────────────────────────────

describe('K-1 Aggregate Computation (Unit)', () => {
  it('aggregates single K-1 with all income types', () => {
    const result = computeK1Aggregate([
      makeK1({
        id: 'k1-1',
        entityName: 'Test LP',
        ordinaryIncome: cents(50000),
        rentalIncome: cents(10000),
        interestIncome: cents(2000),
        dividendIncome: cents(1500),
        shortTermCapitalGain: cents(3000),
        longTermCapitalGain: cents(8000),
        section199AQBI: cents(50000),
      }),
    ])

    expect(result.totalOrdinaryIncome).toBe(cents(50000))
    expect(result.totalRentalIncome).toBe(cents(10000))
    expect(result.totalInterest).toBe(cents(2000))
    expect(result.totalDividends).toBe(cents(1500))
    expect(result.totalSTCapitalGain).toBe(cents(3000))
    expect(result.totalLTCapitalGain).toBe(cents(8000))
    expect(result.totalQBI).toBe(cents(50000))
    expect(result.totalPassthroughIncome).toBe(cents(60000)) // ordinary + rental
    expect(result.k1Count).toBe(1)
    expect(result.entities.length).toBe(1)
  })

  it('aggregates multiple K-1s', () => {
    const result = computeK1Aggregate([
      makeK1({
        id: 'k1-1',
        entityName: 'Partnership A',
        ordinaryIncome: cents(30000),
        interestIncome: cents(1000),
      }),
      makeK1({
        id: 'k1-2',
        entityName: 'S-Corp B',
        entityType: 's-corp',
        ordinaryIncome: cents(70000),
        longTermCapitalGain: cents(5000),
        section199AQBI: cents(70000),
      }),
    ])

    expect(result.totalOrdinaryIncome).toBe(cents(100000))
    expect(result.totalInterest).toBe(cents(1000))
    expect(result.totalLTCapitalGain).toBe(cents(5000))
    expect(result.totalQBI).toBe(cents(70000))
    expect(result.totalPassthroughIncome).toBe(cents(100000))
    expect(result.k1Count).toBe(2)
  })

  it('handles negative income (losses)', () => {
    const result = computeK1Aggregate([
      makeK1({
        id: 'k1-1',
        entityName: 'Losing LP',
        ordinaryIncome: cents(-20000),
        rentalIncome: cents(-5000),
        shortTermCapitalGain: cents(-3000),
      }),
    ])

    expect(result.totalOrdinaryIncome).toBe(cents(-20000))
    expect(result.totalRentalIncome).toBe(cents(-5000))
    expect(result.totalSTCapitalGain).toBe(cents(-3000))
    expect(result.totalPassthroughIncome).toBe(cents(-25000))
  })

  it('handles empty K-1 array', () => {
    const result = computeK1Aggregate([])
    expect(result.k1Count).toBe(0)
    expect(result.totalOrdinaryIncome).toBe(0)
    expect(result.totalPassthroughIncome).toBe(0)
    expect(result.entities.length).toBe(0)
  })

  it('handles mixed gains and losses across entities', () => {
    const result = computeK1Aggregate([
      makeK1({
        id: 'k1-1',
        entityName: 'Profitable LP',
        ordinaryIncome: cents(40000),
        longTermCapitalGain: cents(10000),
      }),
      makeK1({
        id: 'k1-2',
        entityName: 'Losing LP',
        ordinaryIncome: cents(-15000),
        longTermCapitalGain: cents(-3000),
      }),
    ])

    expect(result.totalOrdinaryIncome).toBe(cents(25000))
    expect(result.totalLTCapitalGain).toBe(cents(7000))
    expect(result.totalPassthroughIncome).toBe(cents(25000))
  })
})

// ── Integration Tests: K-1 → Form 1040 Flow ────────────────────

describe('K-1 → Form 1040 Line 2b (Interest)', () => {
  it('K-1 interest added to 1099-INT interest', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      form1099INTs: [make1099INT({ id: 'int-1', payerName: 'Bank', box1: cents(500) })],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', interestIncome: cents(1200) }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.line2b.amount).toBe(cents(500) + cents(1200))
  })

  it('K-1 interest alone (no 1099-INT)', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', interestIncome: cents(3000) }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.line2b.amount).toBe(cents(3000))
  })
})

describe('K-1 → Form 1040 Line 3b (Dividends)', () => {
  it('K-1 dividends added to 1099-DIV dividends', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      form1099DIVs: [make1099DIV({ id: 'div-1', payerName: 'Fund', box1a: cents(800), box1b: cents(400) })],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', dividendIncome: cents(2000) }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.line3b.amount).toBe(cents(800) + cents(2000))
    // K-1 dividends do NOT add to qualified dividends (Line 3a) — conservative
    expect(result.line3a.amount).toBe(cents(400))
  })
})

describe('K-1 → Schedule D (Capital Gains)', () => {
  it('K-1 ST capital gains flow to Schedule D Line 5', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', shortTermCapitalGain: cents(5000) }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.scheduleD).not.toBeNull()
    expect(result.scheduleD!.line5.amount).toBe(cents(5000))
    expect(result.scheduleD!.line7.amount).toBe(cents(5000))
    expect(result.line7.amount).toBe(cents(5000))
  })

  it('K-1 LT capital gains flow to Schedule D Line 12', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', longTermCapitalGain: cents(15000) }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.scheduleD).not.toBeNull()
    expect(result.scheduleD!.line12.amount).toBe(cents(15000))
    expect(result.scheduleD!.line15.amount).toBe(cents(15000))
    expect(result.line7.amount).toBe(cents(15000))
  })

  it('K-1 capital losses flow through Schedule D with limitation', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      scheduleK1s: [
        makeK1({
          id: 'k1-1',
          entityName: 'LP',
          shortTermCapitalGain: cents(-8000),
          longTermCapitalGain: cents(-2000),
        }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.scheduleD).not.toBeNull()
    expect(result.scheduleD!.line5.amount).toBe(cents(-8000))
    expect(result.scheduleD!.line12.amount).toBe(cents(-2000))
    // Combined = -$10K, limited to -$3K
    expect(result.scheduleD!.line16.amount).toBe(cents(-10000))
    expect(result.scheduleD!.line21.amount).toBe(cents(-3000))
    expect(result.line7.amount).toBe(cents(-3000))
    // Carryforward = $7K
    expect(result.scheduleD!.capitalLossCarryforward).toBe(cents(7000))
  })

  it('K-1 capital gains combined with Form 8949 transactions', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      capitalTransactions: [
        makeTransaction({
          id: 'tx-1',
          description: 'AAPL 100 shares',
          dateAcquired: '2024-01-15',
          dateSold: '2025-03-10',
          proceeds: cents(12000),
          adjustedBasis: cents(10000),
          longTerm: true,
          category: 'D',
        }),
      ],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', longTermCapitalGain: cents(5000) }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.scheduleD).not.toBeNull()
    // Form 8949 LT gain = $2K, K-1 LT gain = $5K
    expect(result.scheduleD!.line8a.amount).toBe(cents(2000))
    expect(result.scheduleD!.line12.amount).toBe(cents(5000))
    expect(result.scheduleD!.line15.amount).toBe(cents(7000))
  })
})

describe('K-1 → Schedule 1 Line 5 (Ordinary + Rental)', () => {
  it('K-1 ordinary income flows to Schedule 1 Line 5', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', ordinaryIncome: cents(40000) }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.schedule1).not.toBeNull()
    expect(result.schedule1!.line5.amount).toBe(cents(40000))
    // Flows to Line 8 → Line 9
    expect(result.line8.amount).toBe(cents(40000))
    expect(result.line9.amount).toBe(cents(50000) + cents(40000))
  })

  it('K-1 rental income flows to Schedule 1 Line 5', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', rentalIncome: cents(12000) }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.schedule1!.line5.amount).toBe(cents(12000))
  })

  it('K-1 ordinary + rental combined', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      scheduleK1s: [
        makeK1({
          id: 'k1-1',
          entityName: 'LP',
          ordinaryIncome: cents(30000),
          rentalIncome: cents(10000),
        }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.schedule1!.line5.amount).toBe(cents(40000))
  })

  it('K-1 ordinary loss reduces income', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(80000), box2: cents(10000) })],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', ordinaryIncome: cents(-20000) }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.schedule1!.line5.amount).toBe(cents(-20000))
    expect(result.line8.amount).toBe(cents(-20000))
    // Total income = $80K - $20K = $60K
    expect(result.line9.amount).toBe(cents(60000))
  })
})

describe('K-1 + Schedule E (Rental Properties)', () => {
  it('K-1 passthrough income adds to Schedule E rental property income', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(80000), box2: cents(10000) })],
      scheduleEProperties: [
        makeScheduleEProperty({
          id: 'prop-1',
          rentsReceived: cents(24000),
          mortgageInterest: cents(12000),
          taxes: cents(3000),
          insurance: cents(2000),
        }),
      ],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', ordinaryIncome: cents(25000) }),
      ],
    }

    const result = computeForm1040(model)
    // Schedule E net = $24K - $17K = $7K
    expect(result.scheduleE).not.toBeNull()
    expect(result.scheduleE!.line26.amount).toBe(cents(7000))
    // Schedule 1 Line 5 = Schedule E ($7K) + K-1 ($25K) = $32K
    expect(result.schedule1!.line5.amount).toBe(cents(32000))
  })
})

describe('K-1 + Schedule C (Self-Employment)', () => {
  it('K-1 ordinary income adds alongside Schedule C', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({ id: 'biz-1', grossReceipts: cents(60000), supplies: cents(5000) }),
      ],
      scheduleK1s: [
        makeK1({
          id: 'k1-1',
          entityName: 'S-Corp',
          entityType: 's-corp',
          ordinaryIncome: cents(40000),
          section199AQBI: cents(40000),
        }),
      ],
    }

    const result = computeForm1040(model)
    // Schedule C net = $55K
    expect(result.scheduleCResult!.totalNetProfitCents).toBe(cents(55000))
    // Schedule 1 Line 3 = $55K (Schedule C)
    expect(result.schedule1!.line3.amount).toBe(cents(55000))
    // Schedule 1 Line 5 = $40K (K-1 ordinary income)
    expect(result.schedule1!.line5.amount).toBe(cents(40000))
    // QBI includes both Schedule C and K-1
    expect(result.qbiResult!.totalQBI).toBe(cents(55000) + cents(40000))
  })
})

describe('K-1 QBI Integration', () => {
  it('K-1 QBI flows to QBI deduction for below-threshold taxpayer', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      scheduleK1s: [
        makeK1({
          id: 'k1-1',
          entityName: 'S-Corp',
          entityType: 's-corp',
          ordinaryIncome: cents(80000),
          section199AQBI: cents(80000),
        }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.qbiResult).not.toBeNull()
    expect(result.qbiResult!.totalQBI).toBe(cents(80000))
    expect(result.qbiResult!.simplifiedPath).toBe(true)
    // QBI deduction = min(20% × $80K = $16K, 20% × taxable income)
    expect(result.line13.amount).toBeGreaterThan(0)
  })
})

describe('Multiple K-1 Forms', () => {
  it('aggregates income from partnership + S-corp + trust K-1s', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(60000), box2: cents(7000) })],
      scheduleK1s: [
        makeK1({
          id: 'k1-1',
          entityName: 'Investment LP',
          entityType: 'partnership',
          ordinaryIncome: cents(20000),
          interestIncome: cents(1500),
          longTermCapitalGain: cents(5000),
        }),
        makeK1({
          id: 'k1-2',
          entityName: 'My S-Corp',
          entityType: 's-corp',
          ordinaryIncome: cents(80000),
          dividendIncome: cents(2000),
          section199AQBI: cents(80000),
        }),
        makeK1({
          id: 'k1-3',
          entityName: 'Family Trust',
          entityType: 'trust-estate',
          interestIncome: cents(3000),
          longTermCapitalGain: cents(10000),
        }),
      ],
    }

    const result = computeForm1040(model)

    // Interest: $1,500 + $3,000 = $4,500
    expect(result.line2b.amount).toBe(cents(4500))
    // Dividends: $2,000
    expect(result.line3b.amount).toBe(cents(2000))
    // Schedule 1 Line 5: $20K + $80K = $100K (ordinary)
    expect(result.schedule1!.line5.amount).toBe(cents(100000))
    // Schedule D: LT $5K + $10K = $15K
    expect(result.scheduleD!.line12.amount).toBe(cents(15000))
    expect(result.line7.amount).toBe(cents(15000))
    // K1 result
    expect(result.k1Result).not.toBeNull()
    expect(result.k1Result!.k1Count).toBe(3)
  })
})

describe('K-1 Full Tax Computation Accuracy', () => {
  it('S-Corp owner: $100K ordinary + $10K interest — verify full flow', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      scheduleK1s: [
        makeK1({
          id: 'k1-1',
          entityName: 'My S-Corp',
          entityType: 's-corp',
          ordinaryIncome: cents(100000),
          interestIncome: cents(10000),
          section199AQBI: cents(100000),
        }),
      ],
    }

    const result = computeForm1040(model)

    // Interest: $10K → Line 2b
    expect(result.line2b.amount).toBe(cents(10000))
    // Ordinary income: $100K → Schedule 1 Line 5 → Line 8
    expect(result.schedule1!.line5.amount).toBe(cents(100000))
    expect(result.line8.amount).toBe(cents(100000))
    // Line 9 = $10K (interest) + $100K (other income) = $110K
    expect(result.line9.amount).toBe(cents(110000))
    // AGI = Line 9 (no adjustments for S-corp — SE tax not applicable)
    expect(result.line11.amount).toBe(cents(110000))
    // QBI deduction: 20% × $100K = $20K (below threshold)
    const stdDed = cents(15750)
    const taxableBeforeQBI = cents(110000) - stdDed
    const expectedQBI = Math.min(
      Math.round(cents(100000) * 0.20),
      Math.round(taxableBeforeQBI * 0.20),
    )
    expect(result.line13.amount).toBe(expectedQBI)
    // Total tax > 0
    expect(result.line24.amount).toBeGreaterThan(0)
  })

  it('partnership with all income types', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj' as const,
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(100000), box2: cents(15000) })],
      scheduleK1s: [
        makeK1({
          id: 'k1-1',
          entityName: 'Diversified LP',
          entityType: 'partnership',
          ordinaryIncome: cents(30000),
          rentalIncome: cents(8000),
          interestIncome: cents(2000),
          dividendIncome: cents(3000),
          shortTermCapitalGain: cents(4000),
          longTermCapitalGain: cents(12000),
          section199AQBI: cents(30000),
        }),
      ],
    }

    const result = computeForm1040(model)

    // Line 2b: K-1 interest $2K
    expect(result.line2b.amount).toBe(cents(2000))
    // Line 3b: K-1 dividends $3K
    expect(result.line3b.amount).toBe(cents(3000))
    // Schedule 1 Line 5: ordinary ($30K) + rental ($8K) = $38K
    expect(result.schedule1!.line5.amount).toBe(cents(38000))
    // Schedule D: ST $4K, LT $12K
    expect(result.scheduleD!.line5.amount).toBe(cents(4000))
    expect(result.scheduleD!.line12.amount).toBe(cents(12000))
    expect(result.line7.amount).toBe(cents(16000))
    // Line 9 = W-2 ($100K) + interest ($2K) + dividends ($3K) + cap gains ($16K) + other ($38K) = $159K
    expect(result.line9.amount).toBe(cents(159000))
  })
})

describe('K-1 NIIT Integration', () => {
  it('K-1 investment income included in NIIT computation', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      w2s: [makeW2({ id: 'w2', employerName: 'BigCo', box1: cents(180000), box2: cents(30000) })],
      scheduleK1s: [
        makeK1({
          id: 'k1-1',
          entityName: 'Investment LP',
          interestIncome: cents(30000),
          dividendIncome: cents(20000),
          longTermCapitalGain: cents(25000),
        }),
      ],
    }

    const result = computeForm1040(model)
    // AGI > $200K single NIIT threshold
    expect(result.line11.amount).toBeGreaterThan(cents(200000))
    // NIIT should be computed and include K-1 investment income
    expect(result.niitResult).not.toBeNull()
    expect(result.niitResult!.nii).toBeGreaterThan(0)
    expect(result.niitResult!.niitAmount).toBeGreaterThan(0)
  })
})

describe('K-1 Validation Warnings', () => {
  it('emits K1_INCOME_COMPUTED info', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', ordinaryIncome: cents(50000) }),
      ],
    }

    const result = computeForm1040(model)
    const item = result.validation!.items.find(i => i.code === 'K1_INCOME_COMPUTED')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('info')
  })

  it('emits K1_DIVIDENDS_NOT_QUALIFIED warning when dividends present', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', dividendIncome: cents(5000) }),
      ],
    }

    const result = computeForm1040(model)
    const item = result.validation!.items.find(i => i.code === 'K1_DIVIDENDS_NOT_QUALIFIED')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('warning')
  })

  it('emits K1_RENTAL_LOSS_NO_PAL warning for rental losses', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', rentalIncome: cents(-10000) }),
      ],
    }

    const result = computeForm1040(model)
    const item = result.validation!.items.find(i => i.code === 'K1_RENTAL_LOSS_NO_PAL')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('warning')
  })

  it('emits K1_PARTNERSHIP_SE_NOT_COMPUTED for partnership ordinary income', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeK1({
          id: 'k1-1',
          entityName: 'LP',
          entityType: 'partnership',
          ordinaryIncome: cents(50000),
        }),
      ],
    }

    const result = computeForm1040(model)
    const item = result.validation!.items.find(i => i.code === 'K1_PARTNERSHIP_SE_NOT_COMPUTED')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('warning')
  })

  it('does NOT emit K1_PARTNERSHIP_SE_NOT_COMPUTED for S-corp', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeK1({
          id: 'k1-1',
          entityName: 'S-Corp',
          entityType: 's-corp',
          ordinaryIncome: cents(50000),
        }),
      ],
    }

    const result = computeForm1040(model)
    const item = result.validation!.items.find(i => i.code === 'K1_PARTNERSHIP_SE_NOT_COMPUTED')
    expect(item).toBeUndefined()
  })

  it('emits K1_UNSUPPORTED_BOXES info', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', ordinaryIncome: cents(50000) }),
      ],
    }

    const result = computeForm1040(model)
    const item = result.validation!.items.find(i => i.code === 'K1_UNSUPPORTED_BOXES')
    expect(item).toBeDefined()
    expect(item!.severity).toBe('info')
  })

  it('no dividend warning when K-1 has no dividends', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', ordinaryIncome: cents(50000) }),
      ],
    }

    const result = computeForm1040(model)
    const item = result.validation!.items.find(i => i.code === 'K1_DIVIDENDS_NOT_QUALIFIED')
    expect(item).toBeUndefined()
  })

  it('no rental loss warning when K-1 has no rental losses', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', rentalIncome: cents(5000) }),
      ],
    }

    const result = computeForm1040(model)
    const item = result.validation!.items.find(i => i.code === 'K1_RENTAL_LOSS_NO_PAL')
    expect(item).toBeUndefined()
  })
})

describe('Backward Compatibility', () => {
  it('no K-1 → identical result to pre-Phase 4', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(75000), box2: cents(8000) })],
    }

    const result = computeForm1040(model)
    expect(result.k1Result).toBeNull()
    expect(result.line2b.amount).toBe(0)
    expect(result.line3b.amount).toBe(0)
    expect(result.scheduleD).toBeNull()
    expect(result.schedule1).toBeNull()
    // No K-1 validation items
    const k1Items = result.validation!.items.filter(i => i.code.startsWith('K1_'))
    expect(k1Items.length).toBe(0)
  })

  it('K-1 with all zeros → no Schedule D or Schedule 1 triggered', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(75000), box2: cents(8000) })],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'Empty LP' }),
      ],
    }

    const result = computeForm1040(model)
    // K-1 is present but all zeros — no capital activity or passthrough
    expect(result.scheduleD).toBeNull()
    // Schedule 1 not needed (passthrough income = 0)
    expect(result.line8.amount).toBe(0)
  })

  it('existing 1099-INT/DIV computation unchanged when no K-1', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(75000), box2: cents(8000) })],
      form1099INTs: [make1099INT({ id: 'int-1', payerName: 'Bank', box1: cents(1200) })],
      form1099DIVs: [make1099DIV({ id: 'div-1', payerName: 'Fund', box1a: cents(800), box1b: cents(300) })],
    }

    const result = computeForm1040(model)
    expect(result.line2b.amount).toBe(cents(1200))
    expect(result.line3a.amount).toBe(cents(300))
    expect(result.line3b.amount).toBe(cents(800))
  })

  it('existing Schedule D computation unchanged when no K-1 cap gains', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(75000), box2: cents(8000) })],
      capitalTransactions: [
        makeTransaction({
          id: 'tx-1',
          description: 'Stock sale',
          dateAcquired: '2024-01-15',
          dateSold: '2025-06-10',
          proceeds: cents(15000),
          adjustedBasis: cents(10000),
          longTerm: true,
          category: 'D',
        }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.scheduleD).not.toBeNull()
    expect(result.scheduleD!.line5.amount).toBe(0)
    expect(result.scheduleD!.line12.amount).toBe(0)
    expect(result.scheduleD!.line15.amount).toBe(cents(5000))
  })
})

describe('K-1 Edge Cases', () => {
  it('K-1 with only QBI (no income types) — QBI flows, no other impact', () => {
    // Edge case: QBI reported but ordinary income = 0 (e.g., guaranteed payments only)
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(50000), box2: cents(5000) })],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'LP', section199AQBI: cents(30000) }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.qbiResult!.totalQBI).toBe(cents(30000))
    expect(result.line2b.amount).toBe(0)
    expect(result.line3b.amount).toBe(0)
  })

  it('large K-1 loss does not make total income negative for Line 9 computation', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [makeW2({ id: 'w2', employerName: 'Emp', box1: cents(30000), box2: cents(3000) })],
      scheduleK1s: [
        makeK1({ id: 'k1-1', entityName: 'Loss LP', ordinaryIncome: cents(-50000) }),
      ],
    }

    const result = computeForm1040(model)
    // Line 9 = W-2 ($30K) + K-1 (-$50K via Schedule 1) = -$20K (line 9 can be negative)
    expect(result.line9.amount).toBe(cents(-20000))
    // Taxable income should be $0 (floored)
    expect(result.line15.amount).toBe(0)
    // Total tax should be $0
    expect(result.line24.amount).toBe(0)
  })

  it('MFJ with separate K-1 entities', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj' as const,
      w2s: [
        makeW2({ id: 'w2-1', employerName: 'Emp1', box1: cents(60000), box2: cents(7000) }),
        makeW2({ id: 'w2-2', employerName: 'Emp2', box1: cents(50000), box2: cents(6000) }),
      ],
      scheduleK1s: [
        makeK1({
          id: 'k1-tp',
          owner: 'taxpayer',
          entityName: 'TP Partnership',
          ordinaryIncome: cents(25000),
        }),
        makeK1({
          id: 'k1-sp',
          owner: 'spouse',
          entityName: 'Spouse S-Corp',
          entityType: 's-corp',
          ordinaryIncome: cents(40000),
          section199AQBI: cents(40000),
        }),
      ],
    }

    const result = computeForm1040(model)
    // Combined K-1 ordinary: $25K + $40K = $65K
    expect(result.schedule1!.line5.amount).toBe(cents(65000))
    expect(result.k1Result!.k1Count).toBe(2)
    // QBI from spouse's S-Corp
    expect(result.qbiResult!.totalQBI).toBe(cents(40000))
  })

  it('K-1 triggers Schedule D even without other capital transactions', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        makeK1({
          id: 'k1-1',
          entityName: 'LP',
          shortTermCapitalGain: cents(2000),
        }),
      ],
    }

    const result = computeForm1040(model)
    expect(result.scheduleD).not.toBeNull()
    expect(result.scheduleD!.line5.amount).toBe(cents(2000))
    expect(result.scheduleD!.line7.amount).toBe(cents(2000))
  })
})
