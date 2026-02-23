/**
 * Self-Employment Integration Tests
 *
 * Tests the full flow from Schedule C → Schedule SE → QBI → Form 1040.
 * Verifies that SE tax, deductible half, and QBI deduction are properly
 * integrated into the Form 1040 computation.
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import { emptyTaxReturn } from '../../src/model/types'
import { computeForm1040 } from '../../src/rules/2025/form1040'
import { makeW2 } from '../fixtures/returns'
import type { ScheduleC, ScheduleK1 } from '../../src/model/types'

// ── Helpers ──────────────────────────────────────────────────────

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

describe('Self-employment full integration', () => {
  it('computes correct tax for freelancer with no W-2', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Freelance Dev',
          grossReceipts: cents(100000),
          supplies: cents(5000),
          insurance: cents(3000),
        }),
      ],
    }

    const result = computeForm1040(model)

    // Schedule C net profit = $100K - $8K = $92K
    expect(result.scheduleCResult).not.toBeNull()
    expect(result.scheduleCResult!.totalNetProfitCents).toBe(cents(92000))

    // Schedule SE should be computed
    expect(result.scheduleSEResult).not.toBeNull()

    // Net SE earnings = $92K × 92.35% = $84,962
    const netSE = Math.round(cents(92000) * 0.9235)
    expect(result.scheduleSEResult!.netSEEarnings).toBe(netSE)

    // SE tax should be > 0
    expect(result.scheduleSEResult!.totalSETax).toBeGreaterThan(0)

    // Line 8 (Schedule 1 Line 10) should include Schedule C income
    expect(result.line8.amount).toBeGreaterThan(0)

    // Line 10 should include SE deductible half
    expect(result.line10.amount).toBeGreaterThan(0)

    // Line 23 should include SE tax (Schedule 2 Part II)
    expect(result.line23.amount).toBeGreaterThanOrEqual(result.scheduleSEResult!.totalSETax)

    // QBI deduction should be computed (below threshold)
    expect(result.qbiResult).not.toBeNull()
    expect(result.qbiResult!.simplifiedPath).toBe(true)
    expect(result.line13.amount).toBeGreaterThan(0)
  })

  it('integrates SE with W-2 wages correctly', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Day Job',
          box1: cents(80000),
          box2: cents(10000),
          box3: cents(80000),
          box4: cents(4960),  // 6.2% of $80K
          box5: cents(80000),
          box6: cents(1160),
        }),
      ],
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Side Gig',
          grossReceipts: cents(30000),
          supplies: cents(2000),
        }),
      ],
    }

    const result = computeForm1040(model)

    // Schedule C net = $28K
    expect(result.scheduleCResult!.totalNetProfitCents).toBe(cents(28000))

    // SE tax computed — SS portion should account for W-2 wages
    expect(result.scheduleSEResult).not.toBeNull()
    const netSE = result.scheduleSEResult!.netSEEarnings
    expect(netSE).toBe(Math.round(cents(28000) * 0.9235))

    // Line 1a = W-2 wages
    expect(result.line1a.amount).toBe(cents(80000))

    // Line 9 (total income) should include both W-2 and Schedule C
    // Line 9 = W-2 ($80K) + Schedule C ($28K via Schedule 1)
    expect(result.line9.amount).toBeGreaterThan(cents(80000))

    // AGI reduction from deductible half of SE
    expect(result.line10.amount).toBeGreaterThan(0)

    // Total tax includes SE tax
    expect(result.line24.amount).toBeGreaterThan(0)
  })

  it('handles Schedule C loss correctly (no SE tax)', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Employer',
          box1: cents(60000),
          box2: cents(7000),
        }),
      ],
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Startup',
          grossReceipts: cents(5000),
          rent: cents(12000),
          supplies: cents(3000),
        }),
      ],
    }

    const result = computeForm1040(model)

    // Schedule C net loss = $5K - $15K = -$10K
    expect(result.scheduleCResult!.totalNetProfitCents).toBe(cents(-10000))

    // No SE tax on losses
    expect(result.scheduleSEResult).toBeNull()

    // QBI deduction should be $0 (negative QBI)
    expect(result.qbiResult).not.toBeNull()
    expect(result.qbiResult!.deductionAmount).toBe(0)

    // Loss reduces total income
    expect(result.line8.amount).toBeLessThan(0)
  })

  it('computes QBI deduction correctly in full flow', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Consulting',
          grossReceipts: cents(80000),
          supplies: cents(5000),
        }),
      ],
    }

    const result = computeForm1040(model)

    // Schedule C net = $75K
    const schedCProfit = cents(75000)
    expect(result.scheduleCResult!.totalNetProfitCents).toBe(schedCProfit)

    // QBI = Schedule C profit = $75K
    expect(result.qbiResult!.totalQBI).toBe(schedCProfit)

    // QBI deduction = min(20% × $75K, 20% × taxable income before QBI)
    expect(result.line13.amount).toBeGreaterThan(0)

    // Line 14 should be line12 + line13
    expect(result.line14.amount).toBe(result.line12.amount + result.line13.amount)
  })

  it('computes Form 8995-A deduction when taxable income is above threshold', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'BigCo',
          box1: cents(200000),
          box2: cents(40000),
        }),
      ],
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Side Biz',
          grossReceipts: cents(50000),
        }),
      ],
    }

    const result = computeForm1040(model)

    // AGI should be > $191,950 single threshold
    expect(result.line11.amount).toBeGreaterThan(cents(191950))

    // QBI above threshold triggers Form 8995-A path
    expect(result.qbiResult!.aboveThreshold).toBe(true)
    expect(result.qbiResult!.simplifiedPath).toBe(false)

    // Business has no W-2 wages/UBIA, so in phase-in range the deduction is
    // partially limited. With $0 W-2/$0 UBIA, the wage limitation is $0,
    // and the deduction depends on phase-in factor.
    // In the phase-in range (between threshold and threshold + $50K),
    // deductible = 20%×QBI - phaseInFactor × 20%×QBI = 20%×QBI × (1 - phaseInFactor)
    // Since this is in the phase-in range, deduction should be > $0 but < 20% × QBI
    expect(result.line13.amount).toBeGreaterThan(0)
    expect(result.line13.amount).toBeLessThan(Math.round(cents(50000) * 0.20))
  })

  it('MFJ with both spouses having businesses', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'mfj' as const,
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-tp',
          owner: 'taxpayer',
          businessName: 'TP Consulting',
          grossReceipts: cents(60000),
          supplies: cents(5000),
        }),
        makeScheduleC({
          id: 'biz-sp',
          owner: 'spouse',
          businessName: 'Spouse Tutoring',
          grossReceipts: cents(30000),
          supplies: cents(2000),
        }),
      ],
    }

    const result = computeForm1040(model)

    // Combined net = ($60K-$5K) + ($30K-$2K) = $55K + $28K = $83K
    expect(result.scheduleCResult!.totalNetProfitCents).toBe(cents(83000))
    expect(result.scheduleSEResult).not.toBeNull()
    expect(result.scheduleSEResult!.totalSETax).toBeGreaterThan(0)
  })

  it('backward compatible — no Schedule C returns same as before', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Acme',
          box1: cents(75000),
          box2: cents(8000),
        }),
      ],
    }

    const result = computeForm1040(model)

    // No Schedule C → no SE tax, no QBI
    expect(result.scheduleCResult).toBeNull()
    expect(result.scheduleSEResult).toBeNull()
    expect(result.qbiResult).toBeNull()
    expect(result.line13.amount).toBe(0)
  })

  it('includes SE tax in Line 23 (other taxes)', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Freelance',
          grossReceipts: cents(50000),
        }),
      ],
    }

    const result = computeForm1040(model)

    const seTax = result.scheduleSEResult!.totalSETax
    expect(seTax).toBeGreaterThan(0)

    // Line 23 should include SE tax
    expect(result.line23.amount).toBeGreaterThanOrEqual(seTax)
  })

  it('deductible half of SE reduces AGI', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Consulting',
          grossReceipts: cents(100000),
        }),
      ],
    }

    const result = computeForm1040(model)

    const deductibleHalf = result.scheduleSEResult!.deductibleHalfCents
    expect(deductibleHalf).toBeGreaterThan(0)

    // Line 10 includes deductible half
    expect(result.line10.amount).toBeGreaterThanOrEqual(deductibleHalf)

    // AGI = Line 9 - Line 10
    expect(result.line11.amount).toBe(result.line9.amount - result.line10.amount)
  })
})

describe('K-1 model integration', () => {
  it('K-1 income flows into Form 1040 computation', () => {
    const model = {
      ...emptyTaxReturn(2025),
      w2s: [
        makeW2({
          id: 'w2-1',
          employerName: 'Day Job',
          box1: cents(80000),
          box2: cents(10000),
        }),
      ],
      scheduleK1s: [
        {
          id: 'k1-1',
          entityType: 'partnership' as const,
          entityName: 'Investment LP',
          entityEin: '12-3456789',
          ordinaryIncome: cents(50000),
          rentalIncome: 0,
          interestIncome: cents(2000),
          dividendIncome: cents(1000),
          shortTermCapitalGain: 0,
          longTermCapitalGain: cents(10000),
          section199AQBI: cents(50000),
          distributions: cents(30000),
        },
      ],
    }

    const result = computeForm1040(model)

    // K-1 QBI flows to QBI deduction
    expect(result.qbiResult).not.toBeNull()
    expect(result.qbiResult!.totalQBI).toBe(cents(50000))

    // K-1 interest flows into Line 2b
    expect(result.line2b.amount).toBe(cents(2000))

    // K-1 dividends flow into Line 3b
    expect(result.line3b.amount).toBe(cents(1000))

    // K-1 ordinary income flows through Schedule 1 Line 5
    expect(result.schedule1).not.toBeNull()
    expect(result.schedule1!.line5.amount).toBe(cents(50000))

    // K-1 LT capital gains flow through Schedule D
    expect(result.scheduleD).not.toBeNull()
    expect(result.scheduleD!.line12.amount).toBe(cents(10000))

    // W-2 wages unchanged
    expect(result.line1a.amount).toBe(cents(80000))

    // Line 9 should include all K-1 income
    expect(result.line9.amount).toBeGreaterThan(cents(80000))

    // Validation should flag K-1 as computed (info)
    const k1Info = result.validation!.items.find(i => i.code === 'K1_INCOME_COMPUTED')
    expect(k1Info).toBeDefined()
    expect(k1Info!.severity).toBe('info')
  })

  it('K-1 validation includes computed info when K-1 has QBI', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleK1s: [
        {
          id: 'k1-1',
          entityType: 's-corp' as const,
          entityName: 'My S-Corp',
          entityEin: '98-7654321',
          ordinaryIncome: cents(100000),
          rentalIncome: 0,
          interestIncome: 0,
          dividendIncome: 0,
          shortTermCapitalGain: 0,
          longTermCapitalGain: 0,
          section199AQBI: cents(80000),
          distributions: cents(60000),
        },
      ],
    }

    const result = computeForm1040(model)

    // K-1 income is computed now, so no error
    const k1Error = result.validation!.items.find(i => i.code === 'K1_INCOME_NOT_COMPUTED')
    expect(k1Error).toBeUndefined()

    // K-1 computed info should be present
    const k1Info = result.validation!.items.find(i => i.code === 'K1_INCOME_COMPUTED')
    expect(k1Info).toBeDefined()
    expect(k1Info!.severity).toBe('info')
  })

  it('no K-1 validation items when no K-1s present', () => {
    const model = emptyTaxReturn(2025)
    const result = computeForm1040(model)

    const k1Items = result.validation!.items.filter(i =>
      i.code.startsWith('K1_'))
    expect(k1Items.length).toBe(0)
  })
})

describe('Validation integration for Phase 3', () => {
  it('emits Schedule C/SE computed info when businesses present', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Consulting',
          grossReceipts: cents(50000),
        }),
      ],
    }

    const result = computeForm1040(model)
    const seInfo = result.validation!.items.find(i => i.code === 'SCHEDULE_C_SE_COMPUTED')
    expect(seInfo).toBeDefined()
    expect(seInfo!.severity).toBe('info')
  })

  it('emits QBI computed info when Schedule C present', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Consulting',
          grossReceipts: cents(50000),
        }),
      ],
    }

    const result = computeForm1040(model)
    const qbiInfo = result.validation!.items.find(i => i.code === 'QBI_DEDUCTION_COMPUTED')
    expect(qbiInfo).toBeDefined()
  })

  it('emits PHASE4_LIMITATIONS for all returns', () => {
    const model = emptyTaxReturn(2025)
    const result = computeForm1040(model)
    const item = result.validation!.items.find(i => i.code === 'PHASE4_LIMITATIONS')
    expect(item).toBeDefined()
  })

  it('emits home office warning when flagged', () => {
    const model = {
      ...emptyTaxReturn(2025),
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Home Biz',
          grossReceipts: cents(50000),
          hasHomeOffice: true,
        }),
      ],
    }

    const result = computeForm1040(model)
    const homeOffice = result.validation!.items.find(i => i.code === 'SCHEDULE_C_HOME_OFFICE')
    expect(homeOffice).toBeDefined()
    expect(homeOffice!.severity).toBe('warning')
  })

  it('emits possible SE income warning for large 1099-MISC without Schedule C', () => {
    const model = {
      ...emptyTaxReturn(2025),
      form1099MISCs: [{
        id: 'misc-1',
        payerName: 'Client',
        box1: 0,
        box2: 0,
        box3: cents(50000),
        box4: 0,
      }],
    }

    const result = computeForm1040(model)
    const seWarn = result.validation!.items.find(i => i.code === 'POSSIBLE_SE_INCOME')
    expect(seWarn).toBeDefined()
    expect(seWarn!.severity).toBe('warning')
  })

  it('does NOT emit SE income warning when Schedule C is present', () => {
    const model = {
      ...emptyTaxReturn(2025),
      form1099MISCs: [{
        id: 'misc-1',
        payerName: 'Client',
        box1: 0,
        box2: 0,
        box3: cents(50000),
        box4: 0,
      }],
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Consulting',
          grossReceipts: cents(50000),
        }),
      ],
    }

    const result = computeForm1040(model)
    const seWarn = result.validation!.items.find(i => i.code === 'POSSIBLE_SE_INCOME')
    expect(seWarn).toBeUndefined()  // Schedule C present, no warning
  })
})

describe('Numerical accuracy verification', () => {
  it('freelancer $100K: verify exact SE tax and QBI', () => {
    const model = {
      ...emptyTaxReturn(2025),
      filingStatus: 'single' as const,
      scheduleCBusinesses: [
        makeScheduleC({
          id: 'biz-1',
          businessName: 'Consulting',
          grossReceipts: cents(100000),
        }),
      ],
    }

    const result = computeForm1040(model)

    // Schedule C net = $100,000
    const schedCNet = cents(100000)
    expect(result.scheduleCResult!.totalNetProfitCents).toBe(schedCNet)

    // Net SE earnings = $100,000 × 0.9235 = $92,350
    const netSE = Math.round(schedCNet * 0.9235)
    expect(result.scheduleSEResult!.netSEEarnings).toBe(netSE)

    // SS tax = $92,350 × 12.4% = $11,451.40 → $11,451
    const ssTax = Math.round(netSE * 0.124)
    expect(result.scheduleSEResult!.line4b.amount).toBe(ssTax)

    // Medicare tax = $92,350 × 2.9% = $2,678.15 → $2,678
    const medTax = Math.round(netSE * 0.029)
    expect(result.scheduleSEResult!.line5.amount).toBe(medTax)

    // Total SE tax
    const totalSE = ssTax + medTax
    expect(result.scheduleSEResult!.totalSETax).toBe(totalSE)

    // Deductible half
    const deductHalf = Math.round(totalSE * 0.50)
    expect(result.scheduleSEResult!.deductibleHalfCents).toBe(deductHalf)

    // AGI = $100,000 (Schedule C income) - deductible half
    expect(result.line11.amount).toBe(schedCNet - deductHalf)

    // QBI = Schedule C profit = $100K
    expect(result.qbiResult!.totalQBI).toBe(schedCNet)
    // taxable income before QBI = AGI - standard deduction
    const agi = schedCNet - deductHalf
    const stdDed = cents(15750) // single standard deduction 2025
    const taxableBeforeQBI = Math.max(0, agi - stdDed)

    // QBI deduction = min(20% × $100K, 20% × taxableBeforeQBI)
    const qbiComp = Math.round(schedCNet * 0.20)
    const tiComp = Math.round(taxableBeforeQBI * 0.20)
    const expectedQBI = Math.min(qbiComp, tiComp)
    expect(result.line13.amount).toBe(expectedQBI)
  })
})
