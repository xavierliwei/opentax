/**
 * QBI Deduction Tests — IRC §199A (Form 8995 & Form 8995-A)
 *
 * Tests the qualified business income deduction for:
 * - Below-threshold simplified computation (Form 8995)
 * - Above-threshold W-2/UBIA limitations (Form 8995-A)
 * - SSTB phase-out and exclusion
 * - Phase-in range boundary conditions
 * - Multiple QBI sources
 * - Edge cases (loss, zero income, boundary)
 * - Helper functions (computeWageLimitation, computePhaseInFactor)
 */

import { describe, it, expect } from 'vitest'
import { cents } from '../../src/model/traced'
import {
  computeQBIDeduction,
  computeWageLimitation,
  computePhaseInFactor,
} from '../../src/rules/2025/qbiDeduction'
import type { QBIBusinessInput } from '../../src/rules/2025/qbiDeduction'
import {
  QBI_TAXABLE_INCOME_THRESHOLD,
  QBI_PHASEOUT_RANGE,
} from '../../src/rules/2025/constants'

// ── Helper function to create a business input ──────────────────

function makeBiz(overrides: Partial<QBIBusinessInput> & { qbi: number }): QBIBusinessInput {
  return {
    id: overrides.id ?? 'biz-1',
    name: overrides.name ?? 'Test Business',
    qbi: overrides.qbi,
    w2Wages: overrides.w2Wages ?? 0,
    ubia: overrides.ubia ?? 0,
    isSSTB: overrides.isSSTB ?? false,
  }
}

// ── computeWageLimitation ───────────────────────────────────────

describe('computeWageLimitation', () => {
  it('returns 50% of W-2 wages when greater than 25% + 2.5% UBIA', () => {
    // W2 = $200K, UBIA = $100K
    // 50% × $200K = $100K
    // 25% × $200K + 2.5% × $100K = $50K + $2.5K = $52.5K
    // max($100K, $52.5K) = $100K
    expect(computeWageLimitation(cents(200000), cents(100000))).toBe(cents(100000))
  })

  it('returns 25% W-2 + 2.5% UBIA when greater', () => {
    // W2 = $40K, UBIA = $2M
    // 50% × $40K = $20K
    // 25% × $40K + 2.5% × $2M = $10K + $50K = $60K
    // max($20K, $60K) = $60K
    expect(computeWageLimitation(cents(40000), cents(2000000))).toBe(cents(60000))
  })

  it('returns zero when both W-2 and UBIA are zero', () => {
    expect(computeWageLimitation(0, 0)).toBe(0)
  })

  it('handles UBIA-only case (W-2 = 0)', () => {
    // W2 = $0, UBIA = $400K
    // 50% × $0 = $0
    // 25% × $0 + 2.5% × $400K = $0 + $10K = $10K
    expect(computeWageLimitation(0, cents(400000))).toBe(cents(10000))
  })

  it('handles W-2-only case (UBIA = 0)', () => {
    // W2 = $100K, UBIA = $0
    // 50% × $100K = $50K
    // 25% × $100K + $0 = $25K
    expect(computeWageLimitation(cents(100000), 0)).toBe(cents(50000))
  })

  it('rounds to cents correctly', () => {
    // W2 = $33,333 → 50% = $16,666.50 → rounds to 1666650
    // 25% = $8,333.25 → rounds to 833325
    const w2 = cents(33333)
    const limit = computeWageLimitation(w2, 0)
    expect(limit).toBe(Math.round(w2 * 0.50))
  })
})

// ── computePhaseInFactor ────────────────────────────────────────

describe('computePhaseInFactor', () => {
  it('returns 0 at the threshold', () => {
    expect(computePhaseInFactor(QBI_TAXABLE_INCOME_THRESHOLD['single'], 'single')).toBe(0)
  })

  it('returns 0 below the threshold', () => {
    expect(computePhaseInFactor(cents(100000), 'single')).toBe(0)
  })

  it('returns 1 at threshold + phase-out range', () => {
    const top = QBI_TAXABLE_INCOME_THRESHOLD['single'] + QBI_PHASEOUT_RANGE['single']
    expect(computePhaseInFactor(top, 'single')).toBe(1)
  })

  it('returns 1 above threshold + phase-out range', () => {
    const above = QBI_TAXABLE_INCOME_THRESHOLD['single'] + QBI_PHASEOUT_RANGE['single'] + cents(10000)
    expect(computePhaseInFactor(above, 'single')).toBe(1)
  })

  it('returns 0.5 at midpoint of phase-in range (single)', () => {
    const mid = QBI_TAXABLE_INCOME_THRESHOLD['single'] + QBI_PHASEOUT_RANGE['single'] / 2
    expect(computePhaseInFactor(mid, 'single')).toBeCloseTo(0.5)
  })

  it('returns 0.5 at midpoint for MFJ', () => {
    const mid = QBI_TAXABLE_INCOME_THRESHOLD['mfj'] + QBI_PHASEOUT_RANGE['mfj'] / 2
    expect(computePhaseInFactor(mid, 'mfj')).toBeCloseTo(0.5)
  })

  it('returns $1 above threshold correctly for single', () => {
    const oneAbove = QBI_TAXABLE_INCOME_THRESHOLD['single'] + 100 // 1 dollar = 100 cents
    const factor = computePhaseInFactor(oneAbove, 'single')
    expect(factor).toBeCloseTo(100 / QBI_PHASEOUT_RANGE['single'])
  })
})

// ── computeQBIDeduction — Below-threshold simplified path ───────

describe('computeQBIDeduction', () => {
  describe('below-threshold simplified path', () => {
    it('computes 20% of QBI for simple freelancer', () => {
      // Schedule C profit = $80,000
      // Taxable income before QBI = $64,250 (after standard deduction)
      const result = computeQBIDeduction(cents(80000), 0, cents(64250), 'single')

      expect(result.simplifiedPath).toBe(true)
      expect(result.aboveThreshold).toBe(false)
      expect(result.totalQBI).toBe(cents(80000))
      expect(result.qbiComponent).toBe(Math.round(cents(80000) * 0.20))  // $16,000
      expect(result.taxableIncomeComponent).toBe(Math.round(cents(64250) * 0.20))  // $12,850
      // Deduction = min($16,000, $12,850) = $12,850
      expect(result.deductionAmount).toBe(Math.round(cents(64250) * 0.20))
    })

    it('deduction is limited by taxable income', () => {
      // QBI = $100K, taxable income = $30K
      // 20% QBI = $20K, 20% TI = $6K → deduction = $6K
      const result = computeQBIDeduction(cents(100000), 0, cents(30000), 'single')

      expect(result.deductionAmount).toBe(cents(6000))
    })

    it('deduction is limited by QBI when QBI is smaller', () => {
      // QBI = $20K, taxable income = $120K
      // 20% QBI = $4K, 20% TI = $24K → deduction = $4K
      const result = computeQBIDeduction(cents(20000), 0, cents(120000), 'single')

      expect(result.deductionAmount).toBe(cents(4000))
    })

    it('handles MFJ threshold correctly', () => {
      // MFJ threshold = $383,900
      // Taxable income = $350,000 (below)
      const result = computeQBIDeduction(cents(200000), 0, cents(350000), 'mfj')

      expect(result.simplifiedPath).toBe(true)
      expect(result.deductionAmount).toBe(Math.round(cents(200000) * 0.20))  // $40K
    })

    it('computes exactly at the threshold', () => {
      const threshold = QBI_TAXABLE_INCOME_THRESHOLD['single']
      // Taxable income exactly at threshold → still simplified path
      const result = computeQBIDeduction(cents(50000), 0, threshold, 'single')

      expect(result.simplifiedPath).toBe(true)
      expect(result.aboveThreshold).toBe(false)
    })

    it('does not produce businessResults for simplified path', () => {
      const result = computeQBIDeduction(cents(50000), 0, cents(80000), 'single')
      expect(result.businessResults).toBeNull()
    })
  })

  // ── Above-threshold — backward compatibility (no businesses) ───

  describe('above-threshold cases (backward compat, no businesses)', () => {
    it('returns $0 deduction when above single threshold', () => {
      // Single threshold = $191,950
      const result = computeQBIDeduction(cents(100000), 0, cents(200000), 'single')

      expect(result.aboveThreshold).toBe(true)
      expect(result.simplifiedPath).toBe(false)
      expect(result.deductionAmount).toBe(0)
    })

    it('returns $0 deduction when above MFJ threshold', () => {
      const result = computeQBIDeduction(cents(200000), 0, cents(400000), 'mfj')

      expect(result.aboveThreshold).toBe(true)
      expect(result.deductionAmount).toBe(0)
    })

    it('still reports QBI components even when above threshold', () => {
      const result = computeQBIDeduction(cents(100000), 0, cents(300000), 'single')

      expect(result.totalQBI).toBe(cents(100000))
      expect(result.qbiComponent).toBe(cents(20000))
      expect(result.deductionAmount).toBe(0)
    })
  })

  // ── Multiple QBI sources ──────────────────────────────────────

  describe('multiple QBI sources', () => {
    it('combines Schedule C and K-1 QBI', () => {
      // Schedule C: $60K profit, K-1: $40K QBI
      const result = computeQBIDeduction(cents(60000), cents(40000), cents(100000), 'single')

      expect(result.totalQBI).toBe(cents(100000))
      expect(result.deductionAmount).toBe(Math.round(cents(100000) * 0.20))  // $20K
    })

    it('handles negative Schedule C with positive K-1', () => {
      // Schedule C: -$10K loss, K-1: $30K QBI
      // Net QBI = $20K
      const result = computeQBIDeduction(cents(-10000), cents(30000), cents(80000), 'single')

      expect(result.totalQBI).toBe(cents(20000))
      expect(result.deductionAmount).toBe(cents(4000))  // 20% of $20K
    })
  })

  // ── Edge cases ────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns $0 when QBI is negative', () => {
      const result = computeQBIDeduction(cents(-20000), 0, cents(50000), 'single')

      expect(result.totalQBI).toBe(cents(-20000))
      expect(result.deductionAmount).toBe(0)
    })

    it('returns $0 when taxable income is zero', () => {
      const result = computeQBIDeduction(cents(50000), 0, 0, 'single')

      expect(result.deductionAmount).toBe(0)
    })

    it('returns $0 when taxable income is negative', () => {
      const result = computeQBIDeduction(cents(50000), 0, cents(-5000), 'single')

      expect(result.deductionAmount).toBe(0)
    })

    it('returns $0 when both QBI and taxable income are zero', () => {
      const result = computeQBIDeduction(0, 0, 0, 'single')

      expect(result.deductionAmount).toBe(0)
    })

    it('returns traced line13 value when deduction is positive', () => {
      const result = computeQBIDeduction(cents(50000), 0, cents(80000), 'single')

      expect(result.line13.amount).toBe(result.deductionAmount)
      expect(result.line13.amount).toBeGreaterThan(0)
    })

    it('returns traced zero line13 when deduction is zero', () => {
      const result = computeQBIDeduction(cents(-5000), 0, cents(80000), 'single')

      expect(result.line13.amount).toBe(0)
    })
  })

  // ══════════════════════════════════════════════════════════════
  // Form 8995-A: Above-threshold with per-business data
  // ══════════════════════════════════════════════════════════════

  describe('Form 8995-A: fully above phase-in range (non-SSTB)', () => {
    // Single: fully above = TI ≥ $191,950 + $50,000 = $241,950
    const fullyAboveTI = QBI_TAXABLE_INCOME_THRESHOLD['single'] + QBI_PHASEOUT_RANGE['single']

    it('limits deduction to 50% of W-2 wages', () => {
      // QBI = $200K, W-2 = $100K, UBIA = $0
      // 20% × $200K = $40K
      // Wage limit = max(50% × $100K, 25% × $100K) = max($50K, $25K) = $50K
      // Deduction = min($40K, $50K) = $40K
      const biz = makeBiz({ qbi: cents(200000), w2Wages: cents(100000), ubia: 0 })
      const result = computeQBIDeduction(cents(200000), 0, fullyAboveTI, 'single', [biz])

      expect(result.aboveThreshold).toBe(true)
      expect(result.simplifiedPath).toBe(false)
      expect(result.businessResults).not.toBeNull()
      expect(result.businessResults![0].deductibleQBI).toBe(cents(40000))
      expect(result.deductionAmount).toBe(cents(40000))
    })

    it('limits deduction when W-2 wages are low', () => {
      // QBI = $200K, W-2 = $30K, UBIA = $0
      // 20% × $200K = $40K
      // Wage limit = max(50% × $30K, 25% × $30K) = max($15K, $7.5K) = $15K
      // Deduction = min($40K, $15K) = $15K
      const biz = makeBiz({ qbi: cents(200000), w2Wages: cents(30000) })
      const result = computeQBIDeduction(cents(200000), 0, fullyAboveTI, 'single', [biz])

      expect(result.businessResults![0].wageLimitation).toBe(cents(15000))
      expect(result.businessResults![0].deductibleQBI).toBe(cents(15000))
      expect(result.deductionAmount).toBe(cents(15000))
    })

    it('uses UBIA alternative when it produces higher limit', () => {
      // QBI = $200K, W-2 = $40K, UBIA = $2M
      // 20% × $200K = $40K
      // 50% × $40K = $20K
      // 25% × $40K + 2.5% × $2M = $10K + $50K = $60K
      // Wage limit = max($20K, $60K) = $60K
      // Deduction = min($40K, $60K) = $40K
      const biz = makeBiz({ qbi: cents(200000), w2Wages: cents(40000), ubia: cents(2000000) })
      const result = computeQBIDeduction(cents(200000), 0, fullyAboveTI, 'single', [biz])

      expect(result.businessResults![0].wageLimitation).toBe(cents(60000))
      expect(result.businessResults![0].deductibleQBI).toBe(cents(40000))
      expect(result.deductionAmount).toBe(cents(40000))
    })

    it('returns $0 when W-2 and UBIA are both zero', () => {
      // QBI = $200K, W-2 = $0, UBIA = $0 → wage limit = $0
      const biz = makeBiz({ qbi: cents(200000) })
      const result = computeQBIDeduction(cents(200000), 0, fullyAboveTI, 'single', [biz])

      expect(result.businessResults![0].wageLimitation).toBe(0)
      expect(result.businessResults![0].deductibleQBI).toBe(0)
      expect(result.deductionAmount).toBe(0)
    })

    it('still caps at 20% of taxable income', () => {
      // QBI = $500K, W-2 = $500K, but TI = $250K
      // 20% × $500K = $100K, wage limit = 50% × $500K = $250K
      // min($100K, $250K) = $100K (per-business)
      // 20% TI = $50K → final deduction = min($100K, $50K) = $50K
      const biz = makeBiz({ qbi: cents(500000), w2Wages: cents(500000) })
      const result = computeQBIDeduction(cents(500000), 0, cents(250000), 'single', [biz])

      expect(result.deductionAmount).toBe(cents(50000))
    })

    it('handles multiple businesses with different limitations', () => {
      // Biz A: QBI=$100K, W2=$80K → 20%×$100K=$20K, limit=50%×$80K=$40K → deductible=$20K
      // Biz B: QBI=$100K, W2=$10K → 20%×$100K=$20K, limit=50%×$10K=$5K → deductible=$5K
      // Combined = $25K, 20% TI at $300K = $60K → final = $25K
      const bizA = makeBiz({ id: 'a', qbi: cents(100000), w2Wages: cents(80000) })
      const bizB = makeBiz({ id: 'b', qbi: cents(100000), w2Wages: cents(10000) })
      const result = computeQBIDeduction(cents(200000), 0, cents(300000), 'single', [bizA, bizB])

      expect(result.businessResults![0].deductibleQBI).toBe(cents(20000))
      expect(result.businessResults![1].deductibleQBI).toBe(cents(5000))
      expect(result.deductionAmount).toBe(cents(25000))
    })
  })

  // ── Form 8995-A: Phase-in range (non-SSTB) ───────────────────

  describe('Form 8995-A: phase-in range (non-SSTB)', () => {
    it('applies partial limitation at midpoint of phase-in (single)', () => {
      // Single threshold = $191,950, phase-out range = $50,000
      // TI at midpoint = $191,950 + $25,000 = $216,950 → phaseInFactor = 0.5
      // QBI = $200K, W-2 = $0, UBIA = $0 → wage limit = $0
      // 20% × QBI = $40K
      // excess = max(0, $40K - $0) = $40K
      // deductible = $40K - 0.5 × $40K = $20K
      const midTI = QBI_TAXABLE_INCOME_THRESHOLD['single'] + cents(25000)
      const biz = makeBiz({ qbi: cents(200000) })
      const result = computeQBIDeduction(cents(200000), 0, midTI, 'single', [biz])

      expect(result.aboveThreshold).toBe(true)
      expect(result.businessResults![0].deductibleQBI).toBe(cents(20000))
    })

    it('no limitation at $1 above threshold (almost no phase-in)', () => {
      // TI = $191,951 → phaseInFactor ≈ 0.00002 (1 dollar / $50K range)
      // Excess = $40K (20% × $200K - $0 wage limit)
      // Deduction ≈ $40K - tiny fraction ≈ $40K (nearly full)
      const justAbove = QBI_TAXABLE_INCOME_THRESHOLD['single'] + 100 // $1 above
      const biz = makeBiz({ qbi: cents(200000), w2Wages: cents(200000) })
      const result = computeQBIDeduction(cents(200000), 0, justAbove, 'single', [biz])

      // With large W-2, wage limit = $100K, 20%QBI = $40K → excess = 0
      // So deduction = $40K regardless of phase-in
      expect(result.businessResults![0].deductibleQBI).toBe(cents(40000))
    })

    it('applies full limitation at top of phase-in (= fully above)', () => {
      // TI = $241,950 (threshold + $50K) → phaseInFactor = 1.0
      const topTI = QBI_TAXABLE_INCOME_THRESHOLD['single'] + QBI_PHASEOUT_RANGE['single']
      const biz = makeBiz({ qbi: cents(200000), w2Wages: cents(30000) })
      const result = computeQBIDeduction(cents(200000), 0, topTI, 'single', [biz])

      // Wage limit = 50% × $30K = $15K
      // 20% QBI = $40K → fully limited to min($40K, $15K) = $15K
      expect(result.businessResults![0].deductibleQBI).toBe(cents(15000))
    })

    it('phase-in with generous W-2 wages has no practical effect', () => {
      // QBI = $100K, W-2 = $200K → wage limit = $100K, 20% QBI = $20K
      // excess = max(0, $20K - $100K) = $0 → no reduction regardless of phase-in
      const midTI = QBI_TAXABLE_INCOME_THRESHOLD['single'] + cents(25000)
      const biz = makeBiz({ qbi: cents(100000), w2Wages: cents(200000) })
      const result = computeQBIDeduction(cents(100000), 0, midTI, 'single', [biz])

      expect(result.businessResults![0].deductibleQBI).toBe(cents(20000))
      expect(result.deductionAmount).toBe(cents(20000))
    })

    it('MFJ phase-in range is $100K', () => {
      // MFJ threshold = $383,900, phase-out range = $100K
      // TI at midpoint = $383,900 + $50,000 = $433,900 → phaseInFactor = 0.5
      const midTI = QBI_TAXABLE_INCOME_THRESHOLD['mfj'] + cents(50000)
      const biz = makeBiz({ qbi: cents(200000) })
      const result = computeQBIDeduction(cents(200000), 0, midTI, 'mfj', [biz])

      expect(result.aboveThreshold).toBe(true)
      // 20% QBI = $40K, wage limit = $0
      // deductible = $40K - 0.5 × $40K = $20K
      expect(result.businessResults![0].deductibleQBI).toBe(cents(20000))
    })
  })

  // ── Form 8995-A: SSTB handling ────────────────────────────────

  describe('Form 8995-A: SSTB businesses', () => {
    it('excludes SSTB QBI when fully above phase-in range', () => {
      // Single fully above = TI ≥ $241,950
      const fullyAboveTI = QBI_TAXABLE_INCOME_THRESHOLD['single'] + QBI_PHASEOUT_RANGE['single']
      const biz = makeBiz({ qbi: cents(200000), w2Wages: cents(200000), isSSTB: true })
      const result = computeQBIDeduction(cents(200000), 0, fullyAboveTI, 'single', [biz])

      expect(result.businessResults![0].sstbExcluded).toBe(true)
      expect(result.businessResults![0].deductibleQBI).toBe(0)
      expect(result.deductionAmount).toBe(0)
      expect(result.hasSSTB).toBe(true)
    })

    it('reduces SSTB QBI/W-2/UBIA in phase-in range', () => {
      // TI at midpoint → phaseInFactor = 0.5
      // SSTB: QBI, W-2, UBIA reduced by (1 - 0.5) = 50%
      // effectiveQBI = $200K × 0.5 = $100K
      // effectiveW2 = $200K × 0.5 = $100K
      // 20% × $100K = $20K
      // wage limit = 50% × $100K = $50K
      // deductible = min($20K, $50K) = $20K
      const midTI = QBI_TAXABLE_INCOME_THRESHOLD['single'] + cents(25000)
      const biz = makeBiz({
        qbi: cents(200000), w2Wages: cents(200000), ubia: 0, isSSTB: true,
      })
      const result = computeQBIDeduction(cents(200000), 0, midTI, 'single', [biz])

      expect(result.businessResults![0].sstbPhaseInApplied).toBe(true)
      expect(result.businessResults![0].deductibleQBI).toBe(cents(20000))
    })

    it('mixes SSTB and non-SSTB businesses correctly', () => {
      // Fully above threshold for single
      const fullyAboveTI = QBI_TAXABLE_INCOME_THRESHOLD['single'] + QBI_PHASEOUT_RANGE['single']
      // Non-SSTB: QBI=$100K, W2=$80K → wage limit=$40K, 20%=$20K → deductible=$20K
      const nonSSTB = makeBiz({ id: 'non', qbi: cents(100000), w2Wages: cents(80000) })
      // SSTB: QBI=$100K, W2=$80K → excluded (fully above)
      const sstb = makeBiz({ id: 'sstb', qbi: cents(100000), w2Wages: cents(80000), isSSTB: true })

      const result = computeQBIDeduction(cents(200000), 0, fullyAboveTI, 'single', [nonSSTB, sstb])

      expect(result.businessResults![0].deductibleQBI).toBe(cents(20000))
      expect(result.businessResults![1].sstbExcluded).toBe(true)
      expect(result.businessResults![1].deductibleQBI).toBe(0)
      expect(result.deductionAmount).toBe(cents(20000))
    })

    it('SSTB just $1 above threshold still gets phase-in benefit', () => {
      // TI = threshold + $1 → phaseInFactor ≈ 0 → (1-factor) ≈ 1
      // So effectiveQBI ≈ full QBI, not excluded
      const justAbove = QBI_TAXABLE_INCOME_THRESHOLD['single'] + 100
      const biz = makeBiz({
        qbi: cents(100000), w2Wages: cents(100000), isSSTB: true,
      })
      const result = computeQBIDeduction(cents(100000), 0, justAbove, 'single', [biz])

      // phaseInFactor = 100 / 5000000 ≈ 0.00002
      // effectiveQBI ≈ $100K × 0.99998, effectiveW2 ≈ $100K × 0.99998
      // deductible ≈ 20% × $99,998 ≈ $19,999.60
      expect(result.businessResults![0].deductibleQBI).toBeGreaterThan(cents(19990))
      expect(result.businessResults![0].sstbExcluded).toBe(false)
      expect(result.businessResults![0].sstbPhaseInApplied).toBe(true)
    })

    it('sets hasSSTB and sstbWarning flags', () => {
      const fullyAboveTI = QBI_TAXABLE_INCOME_THRESHOLD['single'] + QBI_PHASEOUT_RANGE['single']
      const biz = makeBiz({ qbi: cents(100000), isSSTB: true })
      const result = computeQBIDeduction(cents(100000), 0, fullyAboveTI, 'single', [biz])

      expect(result.hasSSTB).toBe(true)
      expect(result.sstbWarning).toBe(true)
    })
  })

  // ── Form 8995-A: Losses ───────────────────────────────────────

  describe('Form 8995-A: loss businesses', () => {
    it('passes through negative QBI without limitation', () => {
      const fullyAboveTI = QBI_TAXABLE_INCOME_THRESHOLD['single'] + QBI_PHASEOUT_RANGE['single']
      const loser = makeBiz({ id: 'loss', qbi: cents(-30000) })
      const winner = makeBiz({
        id: 'win', qbi: cents(100000), w2Wages: cents(80000),
      })
      const result = computeQBIDeduction(cents(70000), 0, fullyAboveTI, 'single', [loser, winner])

      // Winner: 20% × $100K = $20K, wage limit = $40K → deductible = $20K
      // Loser: passes through -$30K, 20% × -$30K = -$6K
      // Combined = $20K + (-$6K) = $14K
      expect(result.businessResults![0].deductibleQBI).toBe(cents(-30000))
      expect(result.businessResults![1].deductibleQBI).toBe(cents(20000))
      expect(result.deductionAmount).toBe(cents(14000))
    })

    it('combined deductible cannot go below zero', () => {
      const fullyAboveTI = QBI_TAXABLE_INCOME_THRESHOLD['single'] + QBI_PHASEOUT_RANGE['single']
      const loser = makeBiz({ id: 'loss', qbi: cents(-200000) })
      const winner = makeBiz({ id: 'win', qbi: cents(100000), w2Wages: cents(100000) })
      const result = computeQBIDeduction(cents(-100000), 0, fullyAboveTI, 'single', [loser, winner])

      // totalQBI = -$100K → early return with $0
      expect(result.deductionAmount).toBe(0)
    })
  })

  // ── Form 8995-A: Threshold boundary tests ─────────────────────

  describe('Form 8995-A: threshold boundary precision', () => {
    it('exactly at threshold uses simplified path', () => {
      const threshold = QBI_TAXABLE_INCOME_THRESHOLD['single']
      const biz = makeBiz({ qbi: cents(100000), w2Wages: cents(50000) })
      const result = computeQBIDeduction(cents(100000), 0, threshold, 'single', [biz])

      expect(result.simplifiedPath).toBe(true)
      expect(result.aboveThreshold).toBe(false)
      // Simplified: min(20%×$100K, 20%×$191,950) = $20K
      expect(result.deductionAmount).toBe(cents(20000))
    })

    it('$1 above threshold triggers Form 8995-A', () => {
      const justAbove = QBI_TAXABLE_INCOME_THRESHOLD['single'] + 100 // 1 dollar
      const biz = makeBiz({ qbi: cents(100000), w2Wages: cents(100000) })
      const result = computeQBIDeduction(cents(100000), 0, justAbove, 'single', [biz])

      expect(result.simplifiedPath).toBe(false)
      expect(result.aboveThreshold).toBe(true)
      expect(result.businessResults).not.toBeNull()
      // With ample W-2 wages, deduction should be very close to simplified
      expect(result.deductionAmount).toBe(cents(20000))
    })

    it('$1 below top of phase-in still applies phase-in', () => {
      const almostFullyAbove = QBI_TAXABLE_INCOME_THRESHOLD['single'] +
        QBI_PHASEOUT_RANGE['single'] - 100 // $1 below fully above
      const biz = makeBiz({ qbi: cents(200000) }) // no W-2
      const result = computeQBIDeduction(cents(200000), 0, almostFullyAbove, 'single', [biz])

      // Phase-in factor ≈ 0.99998 → almost fully limited
      // 20% × $200K = $40K, wage limit = $0, excess = $40K
      // deductible = $40K - 0.99998 × $40K ≈ $0.80
      expect(result.businessResults![0].deductibleQBI).toBeGreaterThan(0)
      expect(result.businessResults![0].deductibleQBI).toBeLessThan(cents(100))
    })

    it('exactly at top of phase-in applies full limitation', () => {
      const topOfPhaseIn = QBI_TAXABLE_INCOME_THRESHOLD['single'] +
        QBI_PHASEOUT_RANGE['single']
      const biz = makeBiz({ qbi: cents(200000) }) // no W-2
      const result = computeQBIDeduction(cents(200000), 0, topOfPhaseIn, 'single', [biz])

      // Fully above: deductible = min(20%×QBI, wage limit) = min($40K, $0) = $0
      expect(result.businessResults![0].deductibleQBI).toBe(0)
    })

    it('MFJ exactly at threshold + phase-out range', () => {
      const mfjTop = QBI_TAXABLE_INCOME_THRESHOLD['mfj'] + QBI_PHASEOUT_RANGE['mfj']
      const biz = makeBiz({ qbi: cents(300000), w2Wages: cents(200000) })
      const result = computeQBIDeduction(cents(300000), 0, mfjTop, 'mfj', [biz])

      // Fully above: wage limit = 50% × $200K = $100K, 20% QBI = $60K
      // deductible = min($60K, $100K) = $60K
      expect(result.businessResults![0].deductibleQBI).toBe(cents(60000))
      expect(result.deductionAmount).toBe(cents(60000))
    })
  })

  // ── Form 8995-A: Taxable income cap ───────────────────────────

  describe('Form 8995-A: taxable income limitation', () => {
    it('caps deduction at 20% of taxable income even with ample W-2', () => {
      // Taxable income = $200K, QBI = $500K, W-2 = $1M
      // Per-business: 20% × $500K = $100K, wage limit = $500K → $100K
      // But 20% TI = $40K → capped at $40K
      const biz = makeBiz({ qbi: cents(500000), w2Wages: cents(1000000) })
      const result = computeQBIDeduction(cents(500000), 0, cents(200000), 'single', [biz])

      expect(result.deductionAmount).toBe(cents(40000))
    })
  })

  // ── Form 8995-A: Real-world scenarios ─────────────────────────

  describe('Form 8995-A: real-world scenarios', () => {
    it('consulting LLC with high income and strong W-2 basis', () => {
      // Single filer, consulting LLC (non-SSTB for this test)
      // QBI = $400K, W-2 wages = $250K, UBIA = $100K
      // TI = $350K (well above $241,950 fully-above line)
      // 20% × $400K = $80K
      // 50% × $250K = $125K
      // 25% × $250K + 2.5% × $100K = $62.5K + $2.5K = $65K
      // Wage limit = max($125K, $65K) = $125K
      // Deductible = min($80K, $125K) = $80K
      // 20% TI = $70K → final = min($80K, $70K) = $70K
      const biz = makeBiz({
        qbi: cents(400000), w2Wages: cents(250000), ubia: cents(100000),
      })
      const result = computeQBIDeduction(cents(400000), 0, cents(350000), 'single', [biz])

      expect(result.deductionAmount).toBe(cents(70000))
    })

    it('MFJ with K-1 partnership and Schedule C', () => {
      // MFJ, TI = $450K (in phase-in: $383,900–$483,900)
      // phaseInFactor = ($450K - $383,900) / $100K = $66,100 / $100K = 0.661
      const ti = cents(450000)
      const schedCBiz = makeBiz({
        id: 'sched-c', qbi: cents(150000), w2Wages: cents(60000),
      })
      const k1Biz = makeBiz({
        id: 'k1', qbi: cents(100000), w2Wages: cents(80000), ubia: cents(500000),
      })
      const result = computeQBIDeduction(cents(250000), 0, ti, 'mfj', [schedCBiz, k1Biz])

      expect(result.aboveThreshold).toBe(true)
      expect(result.businessResults).toHaveLength(2)
      // Both businesses should have deductible amounts > 0
      expect(result.businessResults![0].deductibleQBI).toBeGreaterThan(0)
      expect(result.businessResults![1].deductibleQBI).toBeGreaterThan(0)
      expect(result.deductionAmount).toBeGreaterThan(0)
    })

    it('sole proprietor with no W-2 wages in phase-in gets partial deduction', () => {
      // Single, TI = $210K (in phase-in, factor ≈ 0.361)
      // QBI = $150K, W-2 = $0
      // 20% = $30K, wage limit = $0, excess = $30K
      // deductible = $30K - 0.361 × $30K = $30K - $10,830 = $19,170
      const ti = cents(210000)
      const biz = makeBiz({ qbi: cents(150000) })
      const result = computeQBIDeduction(cents(150000), 0, ti, 'single', [biz])

      // Rough check — should be between $15K and $25K
      expect(result.deductionAmount).toBeGreaterThan(cents(15000))
      expect(result.deductionAmount).toBeLessThan(cents(25000))
    })
  })

  // ── Backward compatibility ────────────────────────────────────

  describe('backward compatibility', () => {
    it('below-threshold works identically with or without businesses arg', () => {
      const ti = cents(150000)
      const qbi = cents(100000)

      const withoutBiz = computeQBIDeduction(qbi, 0, ti, 'single')
      const withBiz = computeQBIDeduction(qbi, 0, ti, 'single', [
        makeBiz({ qbi, w2Wages: cents(50000) }),
      ])

      // Both should give same deduction (below threshold ignores businesses)
      expect(withoutBiz.deductionAmount).toBe(withBiz.deductionAmount)
      expect(withoutBiz.simplifiedPath).toBe(true)
      expect(withBiz.simplifiedPath).toBe(true)
    })

    it('above-threshold without businesses gives $0 (conservative fallback)', () => {
      const ti = cents(300000)
      const result = computeQBIDeduction(cents(100000), 0, ti, 'single')

      expect(result.aboveThreshold).toBe(true)
      expect(result.deductionAmount).toBe(0)
      expect(result.businessResults).toBeNull()
    })

    it('above-threshold with businesses gives actual computation', () => {
      const ti = cents(300000)
      const biz = makeBiz({ qbi: cents(100000), w2Wages: cents(100000) })
      const result = computeQBIDeduction(cents(100000), 0, ti, 'single', [biz])

      expect(result.aboveThreshold).toBe(true)
      expect(result.deductionAmount).toBeGreaterThan(0)
      expect(result.businessResults).not.toBeNull()
    })
  })
})
